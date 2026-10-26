// The "rtdb" transport for the peer bus (see peers.js): WebRTC data channels, with the
// handshake carried by our own tiny signaling on the Realtime Database.
//
// Why not Trystero's Firebase strategy? It builds its own database handle from a URL, so it
// can't be pointed at the local emulator, and it writes under its own `__trystero__` paths,
// which our rules (members only, own rows only) don't allow. This is ~200 lines and fits.
//
//   rooms/{room}/{peer}              who's here right now (removed when the tab goes)
//   signal/{room}/{to}/{from}/{msg}  offers, answers, route candidates, and small messages
//                                    for pairs that couldn't connect directly
//
// A peer id is `{uid}-{random}`, so the rules can tie it to the signed-in account and one
// person can have two tabs open. Of each pair, the lower id makes the offer.
//
// If a direct route hasn't opened within 5 seconds, small JSON messages go through the
// database instead (cursors slow down to a couple a second there). Binary needs the direct route.

import { auth } from "../firebase";
import { rtdb } from "./rtdb";

const ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
const FALLBACK = 5000; // wait this long for a direct route before using the database
const SLOW = 500; // …and send lossy messages through it no faster than this
const FULL = 1 << 20; // pause binary sends while this much is queued on a channel

const rand = () => Math.random().toString(36).slice(2, 8);
const safe = (s) => s.replace(/[.#$[\]/]/g, "_");

// hooks: { onPeer(id, joined), onMessage(channel, msg, from, seq) } → { self, send, leave }
export async function join(key, hooks) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("rtdb room: not signed in");
  const { db, ref, set, push, remove, onDisconnect, onChildAdded, onChildRemoved } = await rtdb();

  const room = safe(key.includes(":") ? key.slice(key.indexOf(":") + 1) : key);
  const self = `${uid}-${rand()}`;
  const here = ref(db, `rooms/${room}/${self}`);
  const inbox = ref(db, `signal/${room}/${self}`);
  const links = new Map(); // peer → { pc, dc, since, queue, hdr, early, timer }
  const gone = new Set(); // peers that left, so a late offer from them is ignored
  const slow = new Map(); // "peer/channel" → when we last sent it through the database
  const offs = [];
  let left = false;

  const tell = (to, m) => push(ref(db, `signal/${room}/${to}/${self}`), m).catch(() => {});

  function wire(p, dc) {
    dc.binaryType = "arraybuffer";
    dc.bufferedAmountLowThreshold = FULL / 4;
    dc.onopen = () => {
      p.dc = dc;
      clearTimeout(p.timer);
      for (const raw of p.queue.splice(0)) raw.forEach((x) => dc.send(x));
    };
    dc.onclose = () => p.dc === dc && (p.dc = null);
    dc.onmessage = ({ data }) => {
      if (typeof data === "string") {
        const m = JSON.parse(data);
        // A binary message is a JSON header, then the bytes right behind it
        if (m.bin) p.hdr = m;
        else hooks.onMessage(m.ch, m.d, p.id, m.s);
      } else if (p.hdr) {
        const h = p.hdr;
        p.hdr = null;
        hooks.onMessage(h.ch, data, p.id, h.s);
      }
    };
  }

  function link(id) {
    let p = links.get(id);
    if (p) return p;
    const pc = new RTCPeerConnection({ iceServers: ICE });
    p = { id, pc, dc: null, since: Date.now(), queue: [], hdr: null, early: [], timer: null };
    pc.onicecandidate = (e) => e.candidate && tell(id, { t: "ice", c: JSON.stringify(e.candidate.toJSON()) });
    pc.ondatachannel = (e) => wire(p, e.channel);
    // Whatever was waiting for a direct route goes through the database after a while
    p.timer = setTimeout(() => {
      for (const raw of p.queue.splice(0)) if (raw.length === 1) tell(id, { t: "msg", d: raw[0] });
    }, FALLBACK);
    links.set(id, p);
    return p;
  }

  async function offer(p) {
    wire(p, p.pc.createDataChannel("bus"));
    await p.pc.setLocalDescription(await p.pc.createOffer());
    tell(p.id, { t: "offer", sdp: p.pc.localDescription.sdp });
  }

  async function heard(from, m) {
    if (gone.has(from) || !m) return;
    if (m.t === "msg") {
      const x = JSON.parse(m.d);
      return hooks.onMessage(x.ch, x.d, from, x.s);
    }
    const p = link(from);
    try {
      if (m.t === "offer") {
        await p.pc.setRemoteDescription({ type: "offer", sdp: m.sdp });
        await p.pc.setLocalDescription(await p.pc.createAnswer());
        tell(from, { t: "answer", sdp: p.pc.localDescription.sdp });
        for (const c of p.early.splice(0)) p.pc.addIceCandidate(c).catch(() => {});
      } else if (m.t === "answer") {
        await p.pc.setRemoteDescription({ type: "answer", sdp: m.sdp });
        for (const c of p.early.splice(0)) p.pc.addIceCandidate(c).catch(() => {});
      } else if (m.t === "ice") {
        const c = JSON.parse(m.c);
        if (p.pc.remoteDescription) p.pc.addIceCandidate(c).catch(() => {});
        else p.early.push(c); // the candidate beat its offer here
      }
    } catch (e) {
      console.warn("peers: handshake hiccup", e);
    }
  }

  // Who's here
  const roster = ref(db, `rooms/${room}`);
  offs.push(
    onChildAdded(roster, (s) => {
      const id = s.key;
      if (id === self || left) return;
      gone.delete(id);
      const p = link(id);
      hooks.onPeer(id, true);
      if (self < id && !p.pc.localDescription) offer(p).catch((e) => console.warn("peers: offer failed", e));
    }),
    onChildRemoved(roster, (s) => {
      const id = s.key;
      if (id === self) return;
      gone.add(id);
      const p = links.get(id);
      if (p) {
        clearTimeout(p.timer);
        p.pc.close();
        links.delete(id);
      }
      remove(ref(db, `signal/${room}/${self}/${id}`)).catch(() => {});
      hooks.onPeer(id, false);
    })
  );

  // What they say to me: read it, then take it off the database
  offs.push(
    onChildAdded(inbox, (from) => {
      offs.push(
        onChildAdded(from.ref, (m) => {
          heard(from.key, m.val());
          remove(m.ref).catch(() => {});
        })
      );
    })
  );

  await onDisconnect(here).remove();
  await onDisconnect(inbox).remove();
  await set(here, Date.now());

  // JSON goes as one text frame; bytes as a header frame then the bytes
  const frames = (ch, msg, seq) => {
    if (msg instanceof Blob) return null;
    if (msg instanceof ArrayBuffer) return [JSON.stringify({ bin: 1, ch, s: seq }), msg];
    if (ArrayBuffer.isView(msg)) {
      return [JSON.stringify({ bin: 1, ch, s: seq }), msg.buffer.slice(msg.byteOffset, msg.byteOffset + msg.byteLength)];
    }
    return [JSON.stringify({ ch, s: seq, d: msg })];
  };

  async function send(ch, msg, seq, to, lossy) {
    const raw = frames(ch, msg, seq);
    if (!raw || left) return;
    const targets = (to ?? [...links.keys()]).map((id) => links.get(id)).filter(Boolean);
    for (const p of targets) {
      if (p.dc?.readyState === "open") {
        // Big files: don't pile on while the channel is backed up
        if (raw.length > 1 && p.dc.bufferedAmount > FULL) {
          await new Promise((res) => {
            p.dc.onbufferedamountlow = res;
          });
        }
        raw.forEach((x) => p.dc.send(x));
      } else if (Date.now() - p.since < FALLBACK) {
        if (!lossy) p.queue.push(raw); // a late cursor is useless; anything else waits
      } else if (raw.length === 1) {
        // No direct route: small messages go through the database, lossy ones not too fast
        const k = `${p.id}/${ch}`;
        if (lossy && Date.now() - (slow.get(k) ?? 0) < SLOW) continue;
        slow.set(k, Date.now());
        tell(p.id, { t: "msg", d: raw[0] });
      }
    }
  }

  function leave() {
    if (left) return;
    left = true;
    offs.forEach((off) => off());
    for (const p of links.values()) {
      clearTimeout(p.timer);
      p.pc.close();
    }
    links.clear();
    remove(here).catch(() => {});
    remove(inbox).catch(() => {});
  }

  return { self, send, leave };
}
