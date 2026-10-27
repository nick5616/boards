// The focus booth's pomodoro, shared by its card and the live dock (like lib/timer.js).
// state: { focus, short, long, every, phase: focus|short|long, round, startedAt, marks: [{ at, mins }] }
import { sendAll } from "./readings";
import { dayKey } from "../utils/date";

export const DEFAULTS = { focus: 25, short: 5, long: 15, every: 4 };

export const cfg = (s) => ({ ...DEFAULTS, ...Object.fromEntries(Object.entries(s ?? {}).filter(([k, v]) => k in DEFAULTS && v > 0)) });
export const phaseOf = (s) => s.phase ?? "focus";
export const phaseMins = (s) => cfg(s)[phaseOf(s)];
export const PHASE_NAME = { focus: "focus", short: "short break", long: "long break" };

export const hm = (mins) => (mins >= 60 ? `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}` : `${mins} min`);

export const todayMarks = (s) => (s.marks ?? []).filter((m) => dayKey(new Date(m.at)) === dayKey());

const patch = (updateBoard, boardId, modId, fn) =>
  updateBoard(boardId, (b) => ({
    ...b,
    modules: b.modules.map((m) => (m.id === modId ? { ...m, state: { ...m.state, ...fn(m.state) } } : m)),
  }));

export const startFocus = ({ updateBoard }, boardId, modId) =>
  patch(updateBoard, boardId, modId, () => ({ startedAt: Date.now() }));

// Skip ahead without logging anything (the "skip break" button)
export const setPhase = (updateBoard, boardId, modId, phase) =>
  patch(updateBoard, boardId, modId, () => ({ phase, startedAt: null }));

// Stopping a finished focus round counts it, logs it, and rolls straight into the break.
// Stopping a break just puts the booth back to focus. log=false puts it away quietly.
export function stopFocus({ updateBoard, logPractice, undoLog, toast }, boardId, modId, state, log) {
  const phase = phaseOf(state);
  const c = cfg(state);
  const { startedAt } = state;
  if (!startedAt) return;
  const elapsed = Date.now() - startedAt;
  const done = elapsed >= c[phase] * 60000 - 2000;

  if (!log) return patch(updateBoard, boardId, modId, () => ({ startedAt: null }));

  if (phase !== "focus") {
    patch(updateBoard, boardId, modId, () => ({ phase: "focus", startedAt: null }));
    return;
  }

  const mins = Math.round(Math.min(elapsed, c.focus * 60000 * 1.5) / 60000);
  if (!done) {
    // Left early: keep the minutes if it was a real stretch, but no tomato
    patch(updateBoard, boardId, modId, () => ({ startedAt: null }));
    if (mins >= 5) {
      const e = logPractice(boardId, `🍅 ${mins} min of focus (cut short)`, { mins });
      toast({ text: `${mins} min logged, no tomato`, actions: [{ label: "undo", run: () => undoLog(e) }] });
    } else toast({ text: "under 5 minutes, not logged" });
    return;
  }

  const round = (state.round ?? 0) + 1;
  const long = round >= c.every;
  patch(updateBoard, boardId, modId, (s) => ({
    phase: long ? "long" : "short",
    round: long ? 0 : round,
    startedAt: Date.now(),
    marks: [...(s.marks ?? []), { at: Date.now(), mins: c.focus }].slice(-120),
  }));
  const todayN = todayMarks(state).length + 1;
  const e = logPractice(boardId, `🍅 focus round ${todayN} · ${hm(c.focus)}`, { mins: c.focus });
  const sent = sendAll(updateBoard, boardId, state.sendTo, { value: c.focus, unit: "min", label: "focus" });
  toast({
    text: `🍅 ${todayN} focus round${todayN === 1 ? "" : "s"}, ${hm(todayN * c.focus)} today${sent ? " · sent" : ""} · ${long ? "long" : "short"} break!`,
    actions: [{ label: "undo", run: () => undoLog(e) }],
  });
}
