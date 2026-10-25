import { useState, useRef, useCallback } from "react";
import { blankBoard } from "../lib/migrate";
import { memory } from "../lib/demo";
import { demoProfile } from "../lib/demoSeed";
import { uid } from "../utils/uid";
import { sortBoards } from "./useBoards";

// Same shape as useBoards, but the boards only ever live in memory. Updates
// apply synchronously, like the real thing, so back-to-back updates compose.
export function useDemoBoards() {
  const local = useRef(null);
  if (!local.current) local.current = new Map(demoProfile().boards.map((b) => [b.id, b]));
  const [boards, setBoards] = useState(() => sortBoards([...local.current.values()]));
  const publish = () => setBoards(sortBoards([...local.current.values()]));

  const updateBoard = useCallback((id, updater) => {
    const prev = local.current.get(id);
    if (!prev) return;
    const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
    if (next === prev) return;
    local.current.set(id, { ...next, updatedAt: Date.now() });
    publish();
  }, []);

  const createBoard = useCallback((fields) => {
    const id = `demo-${uid()}`;
    const order = Math.max(-1, ...[...local.current.values()].map((b) => b.order ?? 0)) + 1;
    local.current.set(id, { id, ...blankBoard(fields, order) });
    publish();
    return id;
  }, []);

  const deleteBoard = useCallback((id) => {
    local.current.delete(id);
    publish();
    memory.deleteEntries((e) => e.boardId === id);
  }, []);

  return { boards, error: null, updateBoard, createBoard, deleteBoard };
}
