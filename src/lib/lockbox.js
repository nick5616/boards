import { useSyncExternalStore } from "react";
import { hash } from "../components/Sticker";

// A lock box covers other modules on its board. Honest version: the PIN keeps things
// shut to someone glancing at your screen. It is NOT encryption: the covered modules'
// contents are stored and synced like everything else.

export const pinHash = (box, pin) => String(hash(`${box.id}:${pin}`));

// Boxes opened during this visit (like the Diary: closing the tab shuts them again)
const opened = new Set();
const listeners = new Set();
let version = 0;
const bump = () => {
  version++;
  listeners.forEach((f) => f());
};
const subscribe = (f) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

export const isOpen = (boxId) => opened.has(boxId);
export function setOpen(boxId, open) {
  if (open === opened.has(boxId)) return;
  open ? opened.add(boxId) : opened.delete(boxId);
  bump();
}

// The shut lock box (if any) that has this module under its cover
export const coverOf = (board, modId) =>
  board?.modules.find(
    (m) => m.type === "lockbox" && m.id !== modId && m.state.pinHash && m.state.ids?.includes(modId) && !opened.has(m.id)
  ) ?? null;

// Re-renders when any box opens or shuts
export function useCover(board, modId) {
  useSyncExternalStore(subscribe, () => version);
  return coverOf(board, modId);
}
