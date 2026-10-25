import { MODULES } from "../constants/modules";

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
}
