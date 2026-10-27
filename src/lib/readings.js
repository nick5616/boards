import { MODULES } from "../constants/modules";

// Anyone who wants to watch readings travel (the patch bay's blinking lights) listens here.
// fn({ boardId, modId, reading }) runs after a reading lands; returns the unsubscribe.
const watchers = new Set();
export const onReading = (fn) => {
  watchers.add(fn);
  return () => watchers.delete(fn);
};

// Hand a module a measurement from somewhere else (a metronome's bpm, a timer's
// minutes): { value, unit?, at, label? }. The module decides what to do with it;
// ones that don't receive anything are left alone.
export function sendReading(updateBoard, boardId, modId, reading) {
  updateBoard(boardId, (b) => ({
    ...b,
    modules: b.modules.map((m) => {
      const receive = m.id === modId && MODULES[m.type]?.receive;
      return receive ? { ...m, state: receive(m.state, reading) } : m;
    }),
  }));
  watchers.forEach((fn) => fn({ boardId, modId, reading }));
}

// A finished session goes down every wire the source module has (its state.sendTo).
// Returns how many wires there were, for the toast.
export function sendAll(updateBoard, boardId, ids, reading) {
  const wires = ids ?? [];
  for (const id of wires) sendReading(updateBoard, boardId, id, { at: Date.now(), ...reading });
  return wires.length;
}
