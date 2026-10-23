import { useState, useEffect, useRef, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { boardsCol, newId, deleteBoardData, errorSink } from "../lib/data";
import { ensureMigrated, blankBoard } from "../lib/migrate";

const sortBoards = (list) =>
  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));

export function useBoards(user) {
  const [boards, setBoards] = useState(null); // null = not yet loaded
  const [error, setError] = useState(null);
  const local = useRef(new Map());   // id -> latest board, including unsaved edits
  const timers = useRef(new Map());  // id -> pending debounced write
  const uid = user?.uid;

  const publish = () => setBoards(sortBoards([...local.current.values()]));

  useEffect(() => {
    if (!uid) { setBoards(null); return; }
    let unsub = () => {};
    let cancelled = false;
    setError(null);

    ensureMigrated(uid)
      .then(() => {
        if (cancelled) return;
        unsub = onSnapshot(
          boardsCol(uid),
          (snap) => {
            const next = new Map();
            snap.docs.forEach((d) => {
              // While a local edit is waiting to be written, it wins over the server copy
              next.set(d.id, timers.current.has(d.id) ? local.current.get(d.id) : { id: d.id, ...d.data() });
            });
            local.current = next;
            publish();
          },
          setError
        );
      })
      .catch(setError);

    return () => { cancelled = true; unsub(); };
  }, [uid]);

  const write = useCallback((id) => {
    timers.current.delete(id);
    const board = local.current.get(id);
    if (!board || !uid) return;
    const { id: _, ...data } = board;
    setDoc(doc(boardsCol(uid), id), data).catch(errorSink.report);
  }, [uid]);

  // Push pending edits out when the tab is hidden or closed (phones kill tabs freely)
  useEffect(() => {
    const flush = () => [...timers.current.keys()].forEach((id) => {
      clearTimeout(timers.current.get(id));
      write(id);
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

  // updater: partial fields, or prev => next. Applied synchronously, so
  // back-to-back updates compose. debounce (ms) batches rapid typing.
  const updateBoard = useCallback((id, updater, { debounce = 0 } = {}) => {
    const prev = local.current.get(id);
    if (!prev) return;
    const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
    if (next === prev) return;
    local.current.set(id, { ...next, updatedAt: Date.now() });
    publish();
    clearTimeout(timers.current.get(id));
    if (debounce) timers.current.set(id, setTimeout(() => write(id), debounce));
    else write(id);
  }, [write]);

  const createBoard = useCallback((fields) => {
    const id = newId(boardsCol(uid));
    const order = Math.max(-1, ...[...local.current.values()].map((b) => b.order ?? 0)) + 1;
    local.current.set(id, { id, ...blankBoard(fields, order) });
    publish();
    write(id);
    return id;
  }, [uid, write]);

  const deleteBoard = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    local.current.delete(id);
    publish();
    deleteBoardData(uid, id).catch(errorSink.report);
  }, [uid]);

  return { boards, error, updateBoard, createBoard, deleteBoard };
}
