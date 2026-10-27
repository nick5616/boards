// The "rtdb" transport for the peer bus (see peers.js): WebRTC data channels, with the
// handshake carried by our own tiny signaling on the Realtime Database.
//
// Why not a library like Trystero? Its Firebase strategy builds its own database handle from a
// URL, so it can't be pointed at the local emulator, and it writes under its own `__trystero__`
// paths, which our rules (members only, own rows only) don't allow. This is ~200 lines and fits.
// The phone remote uses this too (rooms named "pair:..."), signed in as an anonymous guest.
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

async function pairRoomId(secret) {
  const sum = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`boards-pair:${secret}`));
  return "pair_" + [...new Uint8Array(sum)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// hooks: { onPeer(id, joined), onMessage(channel, msg, from, seq), onStream(stream, from, live) }
//   → { self, send, leave, addStream(stream, to?: ids), removeStream(stream, to?: ids) }
export async function join(key, hooks) {
  await auth.authStateReady(); // a reload restores the sign-in a moment after the page starts
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("rtdb room: not signed in");
  const { db, ref, set, push, remove, onDisconnect, onChildAdded, onChildRemoved } = await rtdb();

  // A phone-remote room ("pair:<code or secret>") is named by a hash of what you must know to
  // get in, and its access row is just "pair". A space's row (with its room secret) is written
  // by presence.js before the room starts.
  let room;
  if (key.startsWith("pair:")) {
    room = await pairRoomId(key.slice(5));
    await set(ref(db, `access/${room}/${uid}`), "pair");
  } else {
    room = safe(key.includes(":") ? key.slice(key.indexOf(":") + 1) : key);
  }
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
    // Of a pair the higher id is "polite": if both sides offer at once, it backs down.
    p = { id, pc, dc: null, since: Date.now(), queue: [], hdr: null, early: [], timer: null, polite: self > id, making: false, ignore: false, chain: Promise.resolve(), sent: new Map(), remote: new Map() };
    pc.onicecandidate = (e) => e.candidate && tell(id, { t: "ice", c: JSON.stringify(e.candidate.toJSON()) });
    pc.ondatachannel = (e) => wire(p, e.channel);
    // Adding or removing a track (or the first data channel) asks for a new offer
    pc.onnegotiationneeded = async () => {
      try {
        p.making = true;
        await pc.setLocalDescription();
        tell(id, { t: "offer", sdp: pc.localDescription.sdp });
      } catch (e) {
        console.warn("peers: offer failed", e);
      } finally {
        p.making = false;
      }
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!stream) return;
      if (!p.remote.has(stream.id)) {
        p.remote.set(stream.id, stream);
        hooks.onStream?.(stream, id, true);
        // The sender dropping its last track also ends it
        stream.onremovetrack = () => {
          if (!stream.getTracks().length) endRemote(p, stream.id);
        };
      }
    };
    // Whatever was waiting for a direct route goes through the database after a while
    p.timer = setTimeout(() => {
      for (const raw of p.queue.splice(0)) if (raw.length === 1) tell(id, { t: "msg", d: raw[0] });
    }, FALLBACK);
    links.set(id, p);
    return p;
  }

  // The lower id opens the data channel; that asks for the first offer (see onnegotiationneeded)
  function offer(p) {
    wire(p, p.pc.createDataChannel("bus"));
  }

  function endRemote(p, sid) {
    const stream = p.remote.get(sid);
    if (!stream) return;
    p.remote.delete(sid);
    hooks.onStream?.(stream, p.id, false);
  }

  // Offers, answers and candidates are handled one at a time per peer, in order
  function heard(from, m) {
    if (gone.has(from) || !m) return;
    if (m.t === "msg") {
      const x = JSON.parse(m.d);
      return hooks.onMessage(x.ch, x.d, from, x.s);
    }
    const p = link(from);
    p.chain = p.chain.then(() => negotiate(p, m)).catch(() => {});
  }

  // Perfect negotiation: if both sides offer at once, the polite one takes its offer back
  async function negotiate(p, m) {
    const pc = p.pc;
    if (pc.signalingState === "closed") return;
    try {
      if (m.t === "offer" || m.t === "answer") {
        const clash = m.t === "offer" && (p.making || pc.signalingState !== "stable");
        p.ignore = !p.polite && clash;
        if (p.ignore) return;
        await pc.setRemoteDescription({ type: m.t, sdp: m.sdp });
        for (const c of p.early.splice(0)) pc.addIceCandidate(c).catch(() => {});
        if (m.t === "offer") {
          await pc.setLocalDescription();
          tell(p.id, { t: "answer", sdp: pc.localDescription.sdp });
        }
      } else if (m.t === "ice") {
        const c = JSON.parse(m.c);
        if (pc.remoteDescription) pc.addIceCandidate(c).catch((e) => !p.ignore && console.warn("peers: candidate", e));
        else p.early.push(c); // the candidate beat its offer here
      } else if (m.t === "stream-off") {
        endRemote(p, m.id);
      }
    } catch (e) {
      console.warn("peers: handshake hiccup", e);
    }
  }

  // ---- Streams (camera, mic, screen) ----
  // `shared` is what we're sending: { stream, to: Set of peers | null for everyone }. A peer who
  // arrives later gets what was meant for them. Tracks come and go through renegotiation.
  const shared = [];

  function giveTo(p, stream) {
    if (p.sent.has(stream)) return;
    p.sent.set(stream, stream.getTracks().map((t) => p.pc.addTrack(t, stream)));
  }

  function takeFrom(p, stream) {
    const senders = p.sent.get(stream);
    if (!senders) return;
    p.sent.delete(stream);
    if (p.pc.signalingState !== "closed") {
      for (const s of senders) {
        try {
          p.pc.removeTrack(s);
        } catch {
          /* already gone */
        }
      }
      tell(p.id, { t: "stream-off", id: stream.id });
    }
  }

  function addStream(stream, to) {
    if (left || !stream) return;
    const set = to ? new Set(to) : null;
    const was = shared.find((s) => s.stream === stream);
    if (was) was.to = was.to && set ? new Set([...was.to, ...set]) : null;
    else shared.push({ stream, to: set });
    for (const p of links.values()) if (!set || set.has(p.id)) giveTo(p, stream);
  }

  function removeStream(stream, to) {
    const i = shared.findIndex((s) => s.stream === stream);
    if (to && i >= 0 && shared[i].to) to.forEach((id) => shared[i].to.delete(id));
    else if (i >= 0) shared.splice(i, 1);
    for (const p of links.values()) if (!to || to.includes(p.id)) takeFrom(p, stream);
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
      for (const s of shared) if (!s.to || s.to.has(id)) giveTo(p, s.stream);
      if (self < id && !p.dc && !p.opened) {
        p.opened = true;
        offer(p);
      }
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
        for (const sid of [...p.remote.keys()]) endRemote(p, sid);
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

  return { self, send, leave, addStream, removeStream };
}
