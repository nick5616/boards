// The peer bus: things that go straight between browsers, never through a server.
//
//   const r = room("space:abc", { transport: "net" });   // or "local" (the default)
//
//   r.self                       this browser's peer id (net: "" until r.ready resolves)
//   r.peers                      live Set of the other peers' ids. Read it, don't edit it.
//   r.ready                      Promise, resolves once the room is joined (local: already)
//   r.send(channel, msg, to?)    msg is JSON, or an ArrayBuffer / typed array (binary).
//                                to = a peer id, an array of them, or left out for everyone.
//                                Returns a Promise; you don't need to wait for it.
//   r.on(channel, fn) → off      fn(msg, fromId). Binary arrives as an ArrayBuffer.
//   r.onPeer(fn) → off           fn(id, joined) when someone arrives (true) or goes (false)
//   r.offPeer(fn)                same as calling the off that onPeer gave back
//   r.addStream(stream, to?)     share a camera / mic / screen. Net only; local does nothing.
//   r.onStream(fn) → off         fn(stream, fromId)
//   r.leave()                    say goodbye and let go of everything
//
//   sendFile(r, blob, { to, meta, onProgress, id }) → Promise, resolves when the receiver(s)
//                                have it and its SHA-256 matched
//   onFile(r, fn) → off          fn(blob, { from, name, type, meta, id }) for each finished file
//   clock(r) → { now(), offset, ready, stop() }   a shared clock: now() is the same moment on
//                                every browser in the room (ms since 1970, like Date.now())
//
// Transports
//   "local"  BroadcastChannel: same computer, no network at all. Tabs, pop-out windows, a
//            board on a second monitor. Peers announce hello / bye and send a heartbeat, so
//            a closed or crashed tab drops out of `peers` within a few seconds.
//   "net"    WebRTC through Trystero. Finding each other ("signaling") rides on the Realtime
//            Database, a few KB per connection, and nothing heavy ever touches it. Trystero is
//            loaded on demand so it stays out of the main bundle. (Its BitTorrent / Nostr
//            strategies could drop even that: swap the import and the config below.)
//
//   "rtdb"   WebRTC with our own handshake over the Realtime Database (rtdbPeers.js). Members-only
//            rules, works against the local emulator, and small messages fall back to the
//            database when no direct route forms. Shared spaces use this one. Needs sign-in.
//
// Delivery
//   Trystero actions are reliable and ordered, and so is BroadcastChannel. For things where
//   a late message is useless (cursors, ink, the clock) we don't need anything unreliable;
//   the receiver just drops any message older than one it already saw (a per-sender sequence
//   number). Channels in LOSSY get that; add a name to the set if yours should too.

export const LOSSY = new Set(["cursor", "ink", "clock"]);

// Where Trystero's signaling lives. The Realtime Database isn't switched on yet: once it is,
// paste its URL here (Firebase console → Realtime Database → the URL at the top). Nothing
// connects until someone calls room(key, { transport: "net" }).
import { RTDB_URL, RTDB_EMULATOR } from "./rtdb";
import { app as firebaseApp } from "../firebase";

// Google's free public STUN servers help two browsers find a route to each other
const ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

const HEARTBEAT = 3000; // local peers say "still here" this often…
const TIMEOUT = 9000; // …and are dropped after this much silence

const newId = () => Math.random().toString(36).slice(2, 10);
const isBinary = (v) => v instanceof ArrayBuffer || ArrayBuffer.isView(v) || v instanceof Blob;
const toList = (to) => (to == null ? null : Array.isArray(to) ? to : [to]);

// ── Trystero's Firebase app (added for the phone remote; reconcile with any other net work) ──
// Trystero starts its own Firebase app from the database URL, which clashes with the one the
// rest of the app already has. So hand it a second, named app that points at the same database
// (and at the local emulator when VITE_RTDB_EMULATOR is set; Trystero knows nothing of that).
async function signalingApp() {
  const [{ initializeApp, getApp }, { getDatabase, connectDatabaseEmulator }] = await Promise.all([
    import("firebase/app"),
    import("firebase/database"),
  ]);
  try {
    return getApp("peers");
  } catch {
    const a = initializeApp({ ...firebaseApp.options, databaseURL: RTDB_URL }, "peers");
    if (RTDB_EMULATOR) {
      const [host, port] = RTDB_EMULATOR.split(":");
      connectDatabaseEmulator(getDatabase(a), host, +port);
    }
    return a;
  }
}

export function room(key, { transport = "local" } = {}) {
  const handlers = new Map(); // channel → Set of fn
  const peerFns = new Set();
  const streamFns = new Set();
  const peers = new Set();
  const seen = new Map(); // "peer/channel" → newest sequence number seen, for LOSSY channels
  const seqs = new Map(); // channel → our own next sequence number
  let left = false;

  const api = {
    peers,
    self: "",
    ready: Promise.resolve(),
    send: () => Promise.resolve(),
    addStream() {},
    leave() {},
    on(channel, fn) {
      if (!handlers.has(channel)) handlers.set(channel, new Set());
      handlers.get(channel).add(fn);
      return () => handlers.get(channel)?.delete(fn);
    },
    onPeer(fn) {
      peerFns.add(fn);
      return () => peerFns.delete(fn);
    },
    offPeer: (fn) => peerFns.delete(fn),
    onStream(fn) {
      streamFns.add(fn);
      return () => streamFns.delete(fn);
    },
  };

  const nextSeq = (channel) => {
    const s = (seqs.get(channel) ?? 0) + 1;
    seqs.set(channel, s);
    return s;
  };

  // A message arrived. Lossy channels throw away anything older than what we've already seen
  function deliver(channel, msg, from, seq) {
    if (left) return;
    if (LOSSY.has(channel) && seq != null) {
      const k = `${from}/${channel}`;
      if (seq <= (seen.get(k) ?? 0)) return;
      seen.set(k, seq);
    }
    for (const fn of handlers.get(channel) ?? []) {
      try {
        fn(msg, from);
      } catch (e) {
        console.error(e);
      }
    }
  }

  function peerSet(id, joined) {
    if (left || id === api.self || peers.has(id) === joined) return;
    if (joined) peers.add(id);
    else {
      peers.delete(id);
      for (const k of [...seen.keys()]) if (k.startsWith(`${id}/`)) seen.delete(k);
    }
    for (const fn of peerFns) fn(id, joined);
  }

  if (transport === "local") {
    const me = newId();
    const bc = new BroadcastChannel(`boards:${key}`);
    const lastHeard = new Map();
    const post = (m) => {
      try {
        bc.postMessage({ from: me, ...m });
      } catch (e) {
        console.error(e);
      }
    };
    const heard = (id) => {
      lastHeard.set(id, Date.now());
      peerSet(id, true);
    };

    bc.onmessage = ({ data: m }) => {
      if (!m || m.from === me) return;
      if (m.to && !m.to.includes(me)) return;
      if (m.t === "bye") {
        lastHeard.delete(m.from);
        return peerSet(m.from, false);
      }
      heard(m.from);
      // A newcomer said hello: answer so they learn about us too
      if (m.t === "hello") post({ t: "hi", to: [m.from] });
      if (m.t === "msg") deliver(m.ch, m.d, m.from, m.s);
    };

    post({ t: "hello" });
    const beat = setInterval(() => {
      post({ t: "hb" });
      const stale = Date.now() - TIMEOUT;
      for (const [id, at] of lastHeard) {
        if (at < stale) {
          lastHeard.delete(id);
          peerSet(id, false);
        }
      }
    }, HEARTBEAT);
    const bye = () => post({ t: "bye" });
    window.addEventListener("pagehide", bye);

    api.self = me;
    api.send = (channel, msg, to) => {
      if (!left) post({ t: "msg", ch: channel, d: msg, s: nextSeq(channel), to: toList(to) });
      return Promise.resolve();
    };
    api.addStream = () => console.warn("peers: streams need the net transport");
    api.leave = () => {
      if (left) return;
      bye();
      left = true;
      clearInterval(beat);
      window.removeEventListener("pagehide", bye);
      bc.close();
      peers.clear();
    };
    return api;
  }

  // "rtdb": the same WebRTC, but we do the handshake ourselves over the Realtime Database
  // (see rtdbPeers.js). Members-only rules, the local emulator, and a database fallback
  // for small messages when no direct route forms. This is what shared spaces use.
  if (transport === "rtdb") {
    let link = null;
    api.ready = import("./rtdbPeers")
      .then(({ join }) => join(key, { onPeer: peerSet, onMessage: (ch, msg, from, seq) => deliver(ch, msg, from, seq) }))
      .then((h) => {
        if (left) return h.leave();
        link = h;
        api.self = h.self;
      })
      .catch((e) => console.warn("peers: couldn't join the rtdb room", e));
    api.send = async (channel, msg, to) => {
      await api.ready;
      if (link && !left) await link.send(channel, msg, nextSeq(channel), toList(to), LOSSY.has(channel));
    };
    api.leave = () => {
      left = true;
      peers.clear();
      link?.leave();
    };
    return api;
  }

  // "net": WebRTC. One Trystero action ("bus") carries every channel; the channel name and
  // sequence number ride along as its metadata, so binary and JSON travel the same way.
  let live = null;
  api.ready = Promise.all([import("@trystero-p2p/firebase"), signalingApp()]).then(([{ joinRoom, selfId }, sigApp]) => {
    if (left) return;
    api.self = selfId;
    live = joinRoom(
      { appId: RTDB_URL, rtcConfig: { iceServers: ICE }, relayConfig: { firebaseApp: sigApp } },
      `boards:${key}`
    );
    const bus = live.makeAction("bus", {
      onMessage: (data, { peerId, metadata }) => deliver(metadata?.ch, data, peerId, metadata?.s),
    });
    live.onPeerJoin = (id) => peerSet(id, true);
    live.onPeerLeave = (id) => peerSet(id, false);
    live.onPeerStream = (stream, id) => streamFns.forEach((fn) => fn(stream, id));
    live.bus = bus;
  });
  // Signaling can fail (no database yet, offline): the room just stays empty
  api.ready = api.ready.catch((e) => console.warn("peers: couldn't join the net room", e));

  api.send = async (channel, msg, to) => {
    await api.ready;
    if (!live || left) return;
    const data = msg instanceof Blob ? await msg.arrayBuffer() : msg;
    await live.bus.send(data, { target: toList(to), metadata: { ch: channel, s: nextSeq(channel) } });
  };
  api.addStream = (stream, to) => {
    api.ready.then(() => live?.addStream(stream, { target: toList(to) }));
  };
  api.leave = () => {
    left = true;
    peers.clear();
    live?.leave();
  };
  return api;
}

// ---- Files ----------------------------------------------------------------
// A file goes over as small pieces (~64 KB) on the "file" channel's binary twin
// "file:chunk": [4-byte index][8-char transfer id][bytes]. The receiver keeps every piece it
// has by index, so it can say exactly which are missing ("need"), and the sender resends
// just those. A SHA-256 of the whole file is checked at the end.

const CHUNK = 64 * 1024;
const ID_LEN = 8;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

function frame(index, id, bytes) {
  const out = new Uint8Array(4 + ID_LEN + bytes.byteLength);
  new DataView(out.buffer).setUint32(0, index);
  out.set(new TextEncoder().encode(id.padEnd(ID_LEN).slice(0, ID_LEN)), 4);
  out.set(bytes, 4 + ID_LEN);
  return out.buffer;
}

function unframe(buf) {
  // Over the net, binary can arrive as a typed array rather than an ArrayBuffer
  const u8 = ArrayBuffer.isView(buf) ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) : new Uint8Array(buf);
  return {
    index: new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0),
    id: new TextDecoder().decode(u8.subarray(4, 4 + ID_LEN)),
    bytes: u8.subarray(4 + ID_LEN),
  };
}

export async function sendFile(r, blob, { to, meta = null, onProgress, id = newId() } = {}) {
  id = id.padEnd(ID_LEN).slice(0, ID_LEN);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const count = Math.max(1, Math.ceil(bytes.length / CHUNK));
  const sha = hex(await crypto.subtle.digest("SHA-256", bytes));
  const chunk = (i) => frame(i, id, bytes.subarray(i * CHUNK, (i + 1) * CHUNK));

  await r.ready;
  const waiting = new Set(toList(to) ?? r.peers); // whoever hasn't confirmed yet
  if (!waiting.size) throw new Error("nobody to send to");

  return new Promise((resolve, reject) => {
    let idle;
    const finish = (err) => {
      clearTimeout(idle);
      off();
      err ? reject(err) : resolve();
    };
    const bump = () => {
      clearTimeout(idle);
      idle = setTimeout(() => finish(new Error("the other side stopped answering")), 30000);
    };
    const done = () => r.send("file", { k: "done", id }, to);
    const off = r.on("file", (m, from) => {
      if (m.id !== id || !waiting.has(from)) return;
      bump();
      if (m.k === "bad") return finish(new Error("the file got scrambled on the way"));
      if (m.k === "need") {
        // Resend just the missing pieces, then ask again
        (async () => {
          for (const i of m.missing) await r.send("file:chunk", chunk(i), from);
          r.send("file", { k: "done", id }, from);
        })();
      }
      if (m.k === "ok") {
        waiting.delete(from);
        if (!waiting.size) {
          onProgress?.(1);
          finish();
        }
      }
    });

    bump();
    (async () => {
      await r.send("file", { k: "offer", id, name: blob.name ?? "", type: blob.type, size: bytes.length, count, sha, meta }, to);
      for (let i = 0; i < count; i++) {
        await r.send("file:chunk", chunk(i), to);
        onProgress?.(((i + 1) / count) * 0.95); // the last bit waits for the receiver's thumbs-up
        if (i % 16 === 15) await new Promise((res) => setTimeout(res));
      }
      await done();
    })().catch(finish);
  });
}

export function onFile(r, fn) {
  const incoming = new Map(); // "from/id" → { offer, got: Map(index → bytes) }

  const offFile = r.on("file", async (m, from) => {
    const k = `${from}/${m.id}`;
    if (m.k === "offer") {
      // An offer for something we already hold part of (a resend) keeps what we have
      if (!incoming.has(k)) incoming.set(k, { offer: m, got: new Map() });
      return;
    }
    const t = incoming.get(k);
    if (m.k !== "done" || !t) return;
    const missing = [];
    for (let i = 0; i < t.offer.count; i++) if (!t.got.has(i)) missing.push(i);
    if (missing.length) return r.send("file", { k: "need", id: m.id, missing }, from);
    const blob = new Blob([...Array.from({ length: t.offer.count }, (_, i) => t.got.get(i))], { type: t.offer.type });
    const sha = hex(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
    incoming.delete(k);
    if (sha !== t.offer.sha) return r.send("file", { k: "bad", id: m.id }, from);
    r.send("file", { k: "ok", id: m.id }, from);
    const { name, type, meta } = t.offer;
    fn(blob, { from, name, type, meta, id: m.id });
  });

  const offChunk = r.on("file:chunk", (buf, from) => {
    const { index, id, bytes } = unframe(buf);
    incoming.get(`${from}/${id}`)?.got.set(index, bytes.slice());
  });

  return () => {
    offFile();
    offChunk();
  };
}

// ---- Shared clock ---------------------------------------------------------
// NTP-style: ask the reference peer (the lowest id in the room) what time it is, note how
// long the answer took, and assume it was halfway. Do that 8 times, take the median offset,
// and again every 30 seconds. If we are the lowest id ourselves, we are the reference.

export function clock(r) {
  let offset = 0;
  let ready = false;
  let stopped = false;
  let run = 0; // bumps whenever a new round of samples starts, so old ones are ignored
  let samples = [];
  let ref = null;

  const reference = () => [r.self, ...r.peers].filter(Boolean).sort()[0];

  const offPing = r.on("clock", (m, from) => {
    if (m.k === "ping") r.send("clock", { k: "pong", t0: m.t0, t1: Date.now(), run: m.run }, from);
    else if (m.k === "pong" && m.run === run && from === ref) {
      const t2 = Date.now();
      samples.push((m.t1 + (t2 - m.t0) / 2) - t2);
    }
  });

  async function sync() {
    ref = reference();
    if (!ref || ref === r.self) {
      offset = 0;
      ready = !!ref; // alone in the room counts: our own clock is the room's clock
      return;
    }
    const mine = ++run;
    samples = [];
    for (let i = 0; i < 8 && !stopped && mine === run; i++) {
      r.send("clock", { k: "ping", t0: Date.now(), run: mine }, ref);
      await new Promise((res) => setTimeout(res, 120));
    }
    if (stopped || mine !== run || !samples.length) return;
    const s = [...samples].sort((a, b) => a - b);
    offset = s[Math.floor(s.length / 2)];
    ready = true;
  }

  r.ready.then(sync);
  const again = setInterval(sync, 30000);
  // Someone new may now have the lowest id; sync again
  const offPeer = r.onPeer(() => {
    if (reference() !== ref) sync();
  });

  return {
    now: () => Date.now() + offset,
    get offset() {
      return offset;
    },
    get ready() {
      return ready;
    },
    stop() {
      stopped = true;
      clearInterval(again);
      offPing();
      offPeer();
    },
  };
}
