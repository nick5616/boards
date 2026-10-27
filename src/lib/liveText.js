// Live text: one text box that several people type in at once. The text is a Yjs Y.Text, and
// the little updates it makes go between browsers on the peer bus ("text" channel, reliable),
// never through a server. See docs/plans/peer-to-peer.md P5.
//
//   const lt = liveText(room, key, { initial, myUid, uidOf, onPersist })
//   lt.text()            the merged text
//   lt.set(next)         I typed: the textarea now says `next` (diffed into Yjs ops)
//   lt.onRemote(fn)      fn({ delta, text }) after someone else's edit lands
//   lt.destroy()         leave (and save, if the record is mine to keep)
//
// Firestore stays the record: only the peer with the lowest uid among those editing right now
// calls onPersist(text), debounced, so a note costs one write stream however many are typing.
// A late joiner asks the others for their state; if nobody has it, it starts from the text
// Firestore gave it.

import * as Y from "yjs";

export const WAIT_SYNC = 700; // how long a newcomer waits for a peer's state before starting from Firestore's text
export const EDITING = 10000; // someone who sent an edit this recently counts as editing
export const QUIET = 800; // save this long after the last change…
export const MAX_WAIT = 4000; // …or at least this often while the typing never stops

const toB64 = (u8) => {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// The one edit that turns a into b: { at, del, ins }
export function diffText(a, b) {
  let s = 0;
  const max = Math.min(a.length, b.length);
  while (s < max && a.charCodeAt(s) === b.charCodeAt(s)) s++;
  // Don't cut an emoji in half
  if (s > 0 && s < a.length && /[\uD800-\uDBFF]/.test(a[s - 1])) s--;
  let e = 0;
  while (e < max - s && a.charCodeAt(a.length - 1 - e) === b.charCodeAt(b.length - 1 - e)) e++;
  if (e > 0 && /[\uDC00-\uDFFF]/.test(a[a.length - e])) e--;
  return { at: s, del: a.length - s - e, ins: b.slice(s, b.length - e) };
}

// Where a caret at `pos` lands after a Yjs delta (retain / insert / delete) is applied.
// Text put in right at the caret goes after it, so your caret doesn't jump while you type.
export function shiftPos(pos, delta) {
  let at = 0; // position in the old text
  let shift = 0;
  for (const op of delta) {
    if (op.retain) at += op.retain;
    else if (typeof op.insert === "string") {
      if (at < pos) shift += op.insert.length;
    } else if (op.delete) {
      if (at + op.delete <= pos) shift -= op.delete;
      else if (at < pos) shift -= pos - at;
      at += op.delete;
    }
  }
  return pos + shift;
}

// The person who keeps the record: the lowest uid among the people editing (me included, if I am)
export function pickWriter(uids) {
  return [...uids].sort()[0] ?? null;
}

// A starting document that is the same bytes on every browser for the same text, so two people
// opening a note at once don't both add it (the merge sees one insert, not two)
function seedUpdate(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  const d = new Y.Doc();
  d.clientID = (h % 0xfffffff0) + 1;
  d.getText("t").insert(0, text);
  return Y.encodeStateAsUpdate(d);
}

export function liveText(room, key, { initial = "", myUid = "", uidOf = (p) => p, onPersist, now = Date.now } = {}) {
  const doc = new Y.Doc();
  const yt = doc.getText("t");
  const touched = new Map(); // peer → last time it sent an edit
  const remoteFns = new Set();
  let mineAt = -Infinity;
  let synced = false; // heard from a peer, or started from `initial`
  let dead = false;
  let timer = null;
  let firstChange = 0;
  let lastSaved = initial; // what Firestore holds, as far as we know
  let waitTimer = null;

  const send = (m, to) => room.send("text", { key, ...m }, to);

  // What we send out: our own edits (not the seed, which everyone can make for themselves)
  doc.on("update", (u, origin) => {
    if (origin === "local") send({ k: "upd", u: toB64(u) });
  });
  yt.observe((ev) => {
    if (ev.transaction.origin === "remote") for (const fn of remoteFns) fn({ delta: ev.delta, text: yt.toString() });
  });

  const editors = () => {
    const t = now();
    const out = new Set();
    for (const [peer, at] of touched) if (t - at < EDITING && room.peers.has(peer)) out.add(uidOf(peer));
    if (t - mineAt < EDITING) out.add(myUid);
    return out;
  };
  const isWriter = () => pickWriter(editors()) === myUid;

  const save = () => {
    clearTimeout(timer);
    timer = null;
    firstChange = 0;
    const text = yt.toString();
    if (text === lastSaved || !isWriter()) return;
    lastSaved = text;
    onPersist?.(text);
  };
  const changed = () => {
    if (dead) return;
    const t = now();
    if (!firstChange) firstChange = t;
    clearTimeout(timer);
    timer = setTimeout(save, Math.min(QUIET, Math.max(0, firstChange + MAX_WAIT - t)));
  };
  yt.observe(changed);

  const seed = () => {
    if (synced) return;
    synced = true;
    if (initial) Y.applyUpdate(doc, seedUpdate(initial), "seed");
  };

  const off = room.on("text", (m, from) => {
    if (dead || m.key !== key) return;
    if (m.k === "want") {
      // A newcomer: tell it everything it's missing (if we have the note ready)
      if (synced) send({ k: "state", u: toB64(Y.encodeStateAsUpdate(doc, fromB64(m.sv))) }, from);
    } else if (m.k === "state" || m.k === "upd") {
      if (m.k === "upd") touched.set(from, now());
      synced = true;
      clearTimeout(waitTimer);
      Y.applyUpdate(doc, fromB64(m.u), "remote");
    }
  });
  // Someone leaving may have been the one who saves
  const offPeer = room.onPeer((id, joined) => {
    if (joined) return;
    touched.delete(id);
    changed();
  });

  send({ k: "want", sv: toB64(Y.encodeStateVector(doc)) });
  waitTimer = setTimeout(seed, WAIT_SYNC);

  return {
    text: () => yt.toString(),
    set(next) {
      seed();
      const cur = yt.toString();
      if (next === cur) return;
      const { at, del, ins } = diffText(cur, next);
      mineAt = now();
      doc.transact(() => {
        if (del) yt.delete(at, del);
        if (ins) yt.insert(at, ins);
      }, "local");
    },
    onRemote(fn) {
      remoteFns.add(fn);
      return () => remoteFns.delete(fn);
    },
    destroy() {
      if (dead) return;
      // Leaving: if the record is mine to keep, keep it now (I may be the only one editing)
      if (synced) save();
      dead = true;
      clearTimeout(timer);
      clearTimeout(waitTimer);
      off();
      offPeer();
      doc.destroy();
    },
  };
}
