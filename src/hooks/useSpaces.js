import { useState, useEffect, useRef, useCallback } from "react";
import { onSnapshot, deleteField, deleteDoc, updateDoc, runTransaction } from "firebase/firestore";
import {
  mountsCol, spaceDoc, modulesCol, modDoc, mountDoc, newId, boardsCol, createSpace, deleteBoardData, commitQueued, errorSink,
  readOnlyBoards, viewOnlyNote,
} from "../lib/data";
import { ensureMigrated, ensureSpaces, blankBoard } from "../lib/migrate";
import { leaveSpace } from "../lib/share";
import { auth, db } from "../firebase";
import { sortBoards } from "./useBoards";

// Same job and same returned shape as useBoards, but a board is a space: the
// board's own fields in spaces/{id}, one doc per module under it, and my order
// in users/{uid}/mounts/{id}. The `board` objects handed out are unchanged
// ({ id, ...fields, modules: [...] }), so nothing downstream knows the difference.
//
// A space can also sit inside one of my boards as a mounted tab (see MountedTab). Its
// mount says where: { board, parent, tab } instead of "home". Those load the same way
// but stay off the shelf; they come back as `mounted` (sid -> board, null while loading).
//
// updateBoard still takes (id, updater), but it diffs before/after and only
// writes what changed: board fields, and each changed module on its own.

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

// Per space: what the server last told us, plus edits still waiting to be written.
// Server data is never mutated by edits; the pending part is laid over it.
const blankSpace = () => ({
  fields: {},            // space doc, minus id
  mods: new Map(),       // mid -> module, as on the server
  mount: null,           // my mount doc (order, where)
  order: [],             // module ids in the order we show them
  ready: { doc: false, mods: false },
  unsubs: null,          // null until its listeners are attached
  // Pending edits. The local copy wins for exactly these fields / modules
  // while they wait, not for the whole board.
  dirty: { fields: new Set(), mods: new Set(), gone: new Set() },
  lf: {},                // dirty field values
  lm: new Map(),         // dirty module values
  ups: [],               // the updaters behind those edits, kept only while the space is shared
});

const isDirty = (s) => s.dirty.fields.size + s.dirty.mods.size + s.dirty.gone.size > 0;

// The board the UI sees: server data with pending edits laid on top
function assemble(sid, s, uid) {
  const { dirty, lf, lm } = s;
  const fields = { ...s.fields };
  for (const k of dirty.fields) {
    if (lf[k] === undefined) delete fields[k];
    else fields[k] = lf[k];
  }
  // Order is mine alone (it lives on my mount), not part of the shared space
  const order = dirty.fields.has("order") ? lf.order : s.mount?.order ?? fields.order ?? 0;

  const have = new Set([...s.mods.keys(), ...lm.keys()]);
  const ids = s.order.filter((id) => have.has(id) && !dirty.gone.has(id));
  const seen = new Set(ids);
  for (const id of have) if (!seen.has(id) && !dirty.gone.has(id)) ids.push(id);
  s.order = ids;
  const modules = ids.map((id) => (dirty.mods.has(id) ? lm.get(id) : s.mods.get(id)));

  // Whose board this is to me. The owner is on the space; for a board someone shared
  // with me, the role I joined with and who it came from are kept on my own mount.
  const role = !fields.owner || fields.owner === uid ? "owner" : s.mount?.role ?? "view";
  const sharedBy = role === "owner" ? undefined : s.mount?.fromName || "someone";

  return { id: sid, ...fields, order, role, sharedBy, modules };
}

// The space as the server last had it (no pending edits), for replaying updaters on
function serverBoard(sid, s) {
  const modules = s.order.filter((id) => s.mods.has(id)).map((id) => s.mods.get(id));
  return { id: sid, ...s.fields, order: s.mount?.order ?? 0, modules };
}

// Fields that belong to my view of a board, not to the space itself
const MINE = new Set(["id", "modules", "updatedAt", "role", "sharedBy"]);

export function useSpaces(user) {
  const [boards, setBoards] = useState(null); // null = not yet loaded
  const [mounted, setMounted] = useState(new Map()); // spaces tucked into boards, not on the shelf
  const [error, setError] = useState(null);
  const spaces = useRef(new Map());   // sid -> blankSpace()
  const local = useRef(new Map());    // sid -> latest assembled board
  const timers = useRef(new Map());   // sid -> pending debounced write
  const deleting = useRef(new Set()); // sids on their way out; their mounts linger a moment
  const loaded = useRef(false);       // first full load done
  const mountsIn = useRef(false);
  const uid = user?.uid;

  const publish = () => {
    if (!mountsIn.current) return;
    // Until the first load finishes, wait for every space so boards don't pop in one by one
    if (!loaded.current) {
      for (const s of spaces.current.values()) if (!s.failed && !(s.ready.doc && s.ready.mods)) return;
      loaded.current = true;
    }
    const home = [];
    const away = new Map();
    for (const [sid, s] of spaces.current) {
      const b = local.current.get(sid);
      if (typeof s.mount?.where === "object") away.set(sid, b ?? null);
      else if (b) home.push(b);
    }
    setBoards(sortBoards(home));
    setMounted(away);
  };

  const refresh = (sid) => {
    const s = spaces.current.get(sid);
    if (!s || !s.ready.doc || !s.ready.mods) return;
    const board = assemble(sid, s, uid);
    local.current.set(sid, board);
    // Writes check this list, so a viewer's stray write never leaves the browser
    if (board.role === "view") readOnlyBoards.add(sid);
    else readOnlyBoards.delete(sid);
    publish();
  };

  const drop = (sid) => {
    readOnlyBoards.delete(sid);
    spaces.current.get(sid)?.unsubs?.forEach((u) => u());
    spaces.current.delete(sid);
    local.current.delete(sid);
    clearTimeout(timers.current.get(sid));
    timers.current.delete(sid);
  };

  const attach = (sid, s) => {
    // A space we can't read any more (access removed) just disappears from the home view
    const lost = (e) => {
      console.warn("space unavailable", sid, e?.code ?? e);
      s.failed = true;
      // Taken off a board someone shared with me (or they stopped sharing): tidy my shelf
      if (e?.code === "permission-denied" && s.mount?.shared) deleteDoc(mountDoc(uid, sid)).catch(() => {});
      drop(sid);
      publish();
    };
    s.unsubs = [
      onSnapshot(
        spaceDoc(sid),
        (snap) => {
          if (!snap.exists()) { if (s.ready.doc) { drop(sid); publish(); } else lost("missing"); return; }
          s.fields = snap.data();
          s.ready.doc = true;
          refresh(sid);
        },
        lost
      ),
      onSnapshot(
        modulesCol(sid),
        (snap) => {
          snap.docChanges().forEach((c) => {
            if (c.type === "removed") s.mods.delete(c.doc.id);
            else s.mods.set(c.doc.id, { id: c.doc.id, ...c.doc.data() });
          });
          s.ready.mods = true;
          refresh(sid);
        },
        lost
      ),
    ];
  };

  useEffect(() => {
    if (!uid) { setBoards(null); return; }
    let unsub = () => {};
    let cancelled = false;
    setError(null);
    loaded.current = false;
    mountsIn.current = false;

    // A guest with a view link has no old boards to bring over (and shouldn't be handed starter ones)
    const guest = !!auth.currentUser?.isAnonymous;
    (guest ? Promise.resolve() : ensureMigrated(uid).then(() => ensureSpaces(uid)))
      .then(() => {
        if (cancelled) return;
        unsub = onSnapshot(
          mountsCol(uid),
          (snap) => {
            const mine = new Map();
            // Everything I have a mount for loads; where it shows (shelf or a board's tab) is decided at publish
            snap.docs.forEach((d) => !deleting.current.has(d.id) && mine.set(d.id, d.data()));
            for (const sid of [...spaces.current.keys()]) if (!mine.has(sid)) drop(sid);
            for (const [sid, mount] of mine) {
              let s = spaces.current.get(sid);
              if (!s) spaces.current.set(sid, (s = blankSpace()));
              s.mount = mount;
              if (!s.unsubs) attach(sid, s);
              else refresh(sid);
            }
            mountsIn.current = true;
            publish();
          },
          setError
        );
      })
      .catch(setError);

    return () => {
      cancelled = true;
      unsub();
      spaces.current.forEach((s) => s.unsubs?.forEach((u) => u()));
      spaces.current = new Map();
      local.current = new Map();
    };
  }, [uid]);

  // Writes only what's pending for one space, then forgets it's pending.
  // quick = skip the transaction (the tab is closing; only a plain write can still get out)
  const write = useCallback((sid, quick = false) => {
    timers.current.delete(sid);
    const s = spaces.current.get(sid);
    if (!s || !uid || !isDirty(s)) return;
    const { dirty, lf, lm, ups } = s;
    const now = Date.now();
    const ops = [];

    // A shared space: module edits are replayed on the latest copy inside a transaction
    // (below), so two people's edits to the same module compose. A solo space, or a
    // change with no module in it, keeps this instant write.
    const together = !quick && !!s.fields.shared && dirty.mods.size > 0;
    const base = together ? serverBoard(sid, s) : null;

    const fields = {};
    for (const k of dirty.fields) if (k !== "order") fields[k] = lf[k] === undefined ? deleteField() : lf[k];
    if (Object.keys(fields).length) ops.push((b) => b.update(spaceDoc(sid), fields));
    if (dirty.fields.has("order")) ops.push((b) => b.update(mountDoc(uid, sid), { order: lf.order }));
    for (const id of dirty.mods) ops.push((b) => b.set(modDoc(sid, id), { ...lm.get(id), updatedAt: now, updatedBy: uid }));
    for (const id of dirty.gone) ops.push((b) => b.delete(modDoc(sid, id)));

    // The server copy now matches what we just sent, so nothing is left pending
    for (const k of dirty.fields) {
      if (k === "order") continue;
      if (lf[k] === undefined) delete s.fields[k];
      else s.fields[k] = lf[k];
    }
    if (dirty.fields.has("order")) s.mount = { ...s.mount, order: lf.order };
    for (const id of dirty.mods) s.mods.set(id, lm.get(id));
    for (const id of dirty.gone) s.mods.delete(id);
    s.dirty = { fields: new Set(), mods: new Set(), gone: new Set() };
    s.lf = {};
    s.lm = new Map();
    s.ups = [];

    if (!together) return void commitQueued(ops).catch(errorSink.report);

    // Read the latest of each module I touched, run my updaters on that, write the result.
    // If the server can't be reached (offline), fall back to the plain write; the cache
    // queues it and it lands when we're back.
    const ids = [...dirty.mods];
    runTransaction(db, async (tx) => {
      const snaps = await Promise.all(ids.map((id) => tx.get(modDoc(sid, id))));
      const latest = new Map(ids.map((id, i) => [id, snaps[i]]));
      let board = {
        ...base,
        modules: base.modules.flatMap((m) => {
          const sn = latest.get(m.id);
          return !sn ? [m] : sn.exists() ? [{ id: m.id, ...sn.data() }] : []; // gone meanwhile: stays gone
        }),
      };
      for (const up of ups) board = up(board);
      const out = new Map(board.modules.map((m) => [m.id, m]));
      if (Object.keys(fields).length) tx.update(spaceDoc(sid), fields);
      if (dirty.fields.has("order")) tx.update(mountDoc(uid, sid), { order: lf.order });
      for (const id of ids) if (out.has(id)) tx.set(modDoc(sid, id), { ...out.get(id), updatedAt: now, updatedBy: uid });
      for (const id of dirty.gone) tx.delete(modDoc(sid, id));
      return out;
    })
      .then((out) => {
        // Show what was really written (it may include someone else's change)
        const now = spaces.current.get(sid);
        if (!now) return;
        for (const id of ids) if (out.has(id) && !now.dirty.mods.has(id)) now.mods.set(id, out.get(id));
        refresh(sid);
      })
      .catch(() => commitQueued(ops).catch(errorSink.report));
  }, [uid]);

  // Push pending edits out when the tab is hidden or closed (phones kill tabs freely)
  useEffect(() => {
    const flush = () => [...timers.current.keys()].forEach((sid) => {
      clearTimeout(timers.current.get(sid));
      write(sid, true);
    });
    const onVis = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
    };
  }, [write]);

  // Compares the board before and after an update and marks just the differences pending
  const record = (s, prev, next) => {
    const { dirty } = s;
    let changed = false;
    for (const k of new Set([...Object.keys(prev), ...Object.keys(next)])) {
      if (MINE.has(k) || same(prev[k], next[k])) continue;
      s.lf[k] = next[k];
      dirty.fields.add(k);
      if (k !== "order") changed = true;
    }
    // A module move alone doesn't touch the space doc (the module doc has its own stamp)
    if (changed) { s.lf.updatedAt = Date.now(); dirty.fields.add("updatedAt"); }

    // Updaters hand back new objects only for modules they changed, so the
    // reference check is the quick path and the JSON compare the safety net
    const before = new Map(prev.modules.map((m) => [m.id, m]));
    const after = new Set();
    for (const m of next.modules) {
      after.add(m.id);
      const p = before.get(m.id);
      if (p && same(p, m)) continue;
      s.lm.set(m.id, m);
      dirty.mods.add(m.id);
      dirty.gone.delete(m.id);
    }
    for (const id of before.keys()) {
      if (after.has(id)) continue;
      dirty.gone.add(id);
      dirty.mods.delete(id);
      s.lm.delete(id);
    }
    s.order = next.modules.map((m) => m.id);
  };

  // updater: partial fields, or prev => next. Applied synchronously, so
  // back-to-back updates compose. debounce (ms) batches rapid typing.
  const updateBoard = useCallback((sid, updater, { debounce = 0 } = {}) => {
    const prev = local.current.get(sid);
    const s = spaces.current.get(sid);
    if (!prev || !s) return;
    // A viewer can look at everything, but nothing they do is kept
    if (prev.role === "view") return viewOnlyNote();
    const up = typeof updater === "function" ? updater : (b) => ({ ...b, ...updater });
    const next = up(prev);
    if (next === prev) return;
    record(s, prev, next);
    s.ups.push(up);
    refresh(sid);
    clearTimeout(timers.current.get(sid));
    if (debounce) timers.current.set(sid, setTimeout(() => write(sid), debounce));
    else write(sid);
  }, [write]);

  const createBoard = useCallback((fields) => {
    const id = newId(boardsCol(uid));
    const order = Math.max(-1, ...[...local.current.values()].map((b) => b.order ?? 0)) + 1;
    const { modules, ...board } = blankBoard(fields, order);
    // Shows up at once; the mount snapshot then attaches its listeners as usual
    const s = blankSpace();
    s.fields = board;
    s.mount = { where: "home", order };
    modules.forEach((m) => s.mods.set(m.id, m));
    s.ready = { doc: true, mods: true };
    spaces.current.set(id, s);
    refresh(id);
    const who = auth.currentUser;
    createSpace(uid, id, board, modules, order, { name: who?.displayName, photo: who?.photoURL }).catch(errorSink.report);
    return id;
  }, [uid]);

  const deleteBoard = useCallback((id) => {
    deleting.current.add(id);
    // Shared tabs mounted on this board: mine go with it, other people's go back to my shelf
    for (const [sid, s] of spaces.current) {
      if (s.mount?.where?.board !== id) continue;
      if (local.current.get(sid)?.role === "owner") {
        deleting.current.add(sid);
        drop(sid);
        deleteBoardData(uid, sid).catch(errorSink.report).finally(() => deleting.current.delete(sid));
      } else updateDoc(mountDoc(uid, sid), { where: "home" }).catch(errorSink.report);
    }
    const mine = local.current.get(id)?.role === "owner";
    drop(id);
    publish();
    // Someone else's board: I only leave it, they keep it
    if (!mine) return void leaveSpace(id, uid).catch(errorSink.report).finally(() => deleting.current.delete(id));
    deleteBoardData(uid, id).catch(errorSink.report).finally(() => deleting.current.delete(id));
  }, [uid]);

  return { boards, mounted, error, updateBoard, createBoard, deleteBoard };
}
