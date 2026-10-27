// Live camera / mic / screen between people in a shared space, on top of the peer bus
// (room.addStream / onStream in peers.js). A room carries every stream of every module, so each
// one is labelled ("call:<module id>", "show:<module id>") with a small "media" message sent
// just before it, and watchers only take the labels they asked for. Nothing is recorded or kept.
//
//   const out = shareMedia(room, "show:abc", stream);   // nobody sees it yet
//   out.to(ids)         who gets it right now; call again whenever that changes
//   out.swap(stream)    send a different stream to the same people (e.g. a new mic setting)
//   out.stop()          take it back from everyone
//
//   const off = watchMedia(room, "show:abc", (stream, from, live) => ...)
//                       live is true when one arrives, false when it ends or its sender leaves

export function shareMedia(room, label, stream) {
  let cur = stream;
  let to = new Set();

  const give = (ids) => {
    if (!ids.length) return;
    room.send("media", { k: "on", sid: cur.id, label }, ids);
    room.addStream(cur, ids);
  };
  const take = (ids) => {
    if (!ids.length) return;
    room.send("media", { k: "off", sid: cur.id, label }, ids);
    room.removeStream(cur, ids);
  };

  return {
    to(ids) {
      const next = new Set(ids.filter((id) => id !== room.self));
      take([...to].filter((id) => !next.has(id)));
      give([...next].filter((id) => !to.has(id)));
      to = next;
    },
    swap(s) {
      const ids = [...to];
      take(ids);
      cur = s;
      give(ids);
    },
    stop() {
      take([...to]);
      to = new Set();
    },
  };
}

// Remembers what's arrived in a room, so a module that mounts later still finds it.
// useRoom starts this for every room it opens.
const hubs = new WeakMap();

export function track(room) {
  if (hubs.has(room)) return hubs.get(room);
  const h = { tags: new Map(), have: new Map(), subs: new Set() }; // "from/sid" → label / stream
  const tell = (k, live) => {
    const stream = h.have.get(k);
    if (stream && h.tags.get(k)) for (const fn of h.subs) fn(k, stream, live);
  };
  room.on("media", (m, from) => {
    const k = `${from}/${m.sid}`;
    if (m.k === "on") {
      h.tags.set(k, m.label);
      tell(k, true);
    } else {
      tell(k, false);
      h.tags.delete(k);
    }
  });
  room.onStream((stream, from, live) => {
    const k = `${from}/${stream.id}`;
    if (live) {
      h.have.set(k, stream);
      tell(k, true);
    } else {
      tell(k, false);
      h.have.delete(k);
      h.tags.delete(k);
    }
  });
  hubs.set(room, h);
  return h;
}

export function watchMedia(room, label, fn) {
  const h = track(room);
  const shown = new Map(); // "from/sid" → stream
  const from = (k) => k.slice(0, k.indexOf("/"));
  const sub = (k, stream, live) => {
    if (h.tags.get(k) !== label || live === shown.has(k)) return;
    live ? shown.set(k, stream) : shown.delete(k);
    fn(stream, from(k), live);
  };
  h.subs.add(sub);
  for (const [k, stream] of h.have) if (h.tags.has(k)) sub(k, stream, true);
  return () => {
    h.subs.delete(sub);
    for (const [k, stream] of shown) fn(stream, from(k), false);
    shown.clear();
  };
}
