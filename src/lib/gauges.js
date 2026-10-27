import { dayKey } from "../utils/date";

// "What number does this module show?" for the gauge cluster. Each reader gets the
// module's state and returns { value, unit, goal?, hi? } or null when there's nothing yet.
// hi = a sensible top of the dial when the person hasn't set one.
// Types with no reader here are left out of the picker.
const sum = (xs) => xs.reduce((t, x) => t + x, 0);

export const READERS = {
  graph: (s) => {
    const pts = [...(s.points ?? [])].sort((a, b) => a.day.localeCompare(b.day));
    const last = pts[pts.length - 1];
    if (!last) return null;
    return { value: last.v, unit: s.unit, goal: s.goal ?? null, hi: Math.max(...pts.map((p) => p.v), s.goal ?? 0) };
  },
  tally: (s) => {
    const v = s.counts?.[dayKey()] ?? 0;
    const best = Math.max(0, ...Object.values(s.counts ?? {}));
    return { value: v, unit: s.unit || "today", hi: best };
  },
  jar: (s) => ({ value: sum((s.drops ?? []).map((d) => d.amt)), unit: s.unit, goal: s.goal, hi: s.goal }),
  metronome: (s) => ({ value: s.bpm ?? 90, unit: "bpm", hi: 220, lo: 30 }),
  staff: (s) => ({ value: s.tempo ?? 100, unit: "bpm", hi: 220, lo: 30 }),
  keys: (s) => ({ value: s.phrases?.length ?? 0, unit: "phrases" }),
  tape: (s) => ({ value: s.takes?.length ?? 0, unit: "takes" }),
  fortune: (s) => ({ value: s.items?.length ?? 0, unit: "fortunes" }),
  magnets: (s) => ({ value: (s.words?.length ?? 0) + (s.box?.length ?? 0), unit: "words" }),
};

export const readable = (mod) => !!READERS[mod.type];
export const readOf = (mod) => (READERS[mod.type] ? READERS[mod.type](mod.state ?? {}) : null);

// A friendly ceiling: 37 -> 40, 130 -> 150, 8 -> 10
export function niceMax(v) {
  if (!(v > 0)) return 10;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

// The dial's range for one reading + the person's overrides
export function rangeOf(read, dial) {
  const min = Number.isFinite(dial.min) ? dial.min : read.lo ?? 0;
  const goal = Number.isFinite(dial.goal) ? dial.goal : read.goal ?? null;
  const top = Math.max(read.value, goal ?? 0, read.hi ?? 0);
  const max = Number.isFinite(dial.max) && dial.max > min ? dial.max : niceMax(top);
  return { min, max: max > min ? max : min + 1, goal };
}
