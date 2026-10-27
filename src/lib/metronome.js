// The metronome's engine and its start/stop. The engine lives here (not in the card)
// and is run by the live dock, so the ticking carries on when you leave the board.
// Clicks are booked a little ahead on the audio clock by a loop that wakes up often;
// the loop's own timing is sloppy, the booked clicks are not.
import { getAudio, click } from "./audio";
import { sendReading } from "./readings";
import { syncOf, sharedNow, retime, mayTrain } from "./metroSync";

export const BPM_MIN = 30;
export const BPM_MAX = 260;
export const clampBpm = (n) => Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(Number(n)) || 90));

// Fills in anything an older or half-made module is missing
export const metroState = (s = {}) => ({
  bpm: 90,
  beats: 4,
  accent: true,
  sub: 1,
  sendTo: [],
  startedAt: null,
  anchor: null, // shared space: the shared-clock moment of a downbeat (see metroSync.js)
  ...s,
  trainer: { on: false, step: 4, every: 4, target: 120, ...s.trainer },
});

const LOOP_MS = 25;
const AHEAD = 0.1; // seconds of clicks booked in advance
const AHEAD_HIDDEN = 1.5; // background tabs wake the loop about once a second, so book further out

const patchMod = (updateBoard, boardId, modId, fn) =>
  updateBoard(boardId, (b) => ({
    ...b,
    modules: b.modules.map((m) => (m.id === modId ? { ...m, state: fn(metroState(m.state)) } : m)),
  }));

// read() gives the module's current state (or nothing if it's gone); onBar(n) is told
// each time a whole bar has been booked. beatAt(t) is the latest booked beat at or
// before audio time t, for the swinging arm to follow.
function runEngine({ read, onBar, boardId }) {
  let next = null; // audio time of the next click to book
  let pos = 0; // beat within the bar
  let n = 0; // beats since the start (the arm swings one way per beat)
  let bars = 0;
  const booked = [];

  // In a shared space the beats sit on a grid: anchor + k * period, on the shared clock.
  // Everyone who can see the same anchor and tempo books the same moments.
  let gridKey = "";
  let k = 0;
  const grid = (a, s) => {
    const clk = () => sharedNow(boardId);
    const per = 60000 / clampBpm(s.bpm);
    const aud = (j) => a.currentTime + (s.anchor + j * per - clk()) / 1000;
    const key = `${s.anchor}/${per}`;
    // New grid, or we fell behind (tab asleep): jump to the next beat that's still ahead
    if (key !== gridKey || aud(k) < a.currentTime - 0.05) {
      gridKey = key;
      k = Math.max(0, Math.ceil((clk() + 60 - s.anchor) / per));
    }
    const until = a.currentTime + (document.hidden ? AHEAD_HIDDEN : AHEAD);
    while (aud(k) < until) {
      const t = aud(k);
      const pos = k % s.beats;
      click(t, { accent: s.accent && pos === 0 });
      for (let j = 1; j < s.sub; j++) click(t + (per / 1000 * j) / s.sub, { gain: 0.18 });
      booked.push({ time: t, n: k, pos, period: per / 1000 });
      if (booked.length > 16) booked.shift();
      if (pos === s.beats - 1) onBar(++bars);
      k++;
    }
  };

  const tick = () => {
    const a = getAudio();
    if (!a) {
      next = null; // no sound yet (a reload before any tap): wait, and start fresh
      return;
    }
    const cur = read();
    if (cur && typeof cur.anchor === "number") return grid(a, metroState(cur));
    gridKey = "";
    if (next === null || next < a.currentTime - 0.05) {
      next = a.currentTime + 0.06; // fell behind (tab asleep): don't play catch-up, start a bar over
      pos = 0;
    }
    const until = a.currentTime + (document.hidden ? AHEAD_HIDDEN : AHEAD);
    while (next < until) {
      const raw = read();
      if (!raw) return;
      const s = metroState(raw);
      const period = 60 / clampBpm(s.bpm);
      if (pos >= s.beats) pos = 0;
      click(next, { accent: s.accent && pos === 0 });
      for (let k = 1; k < s.sub; k++) click(next + (period * k) / s.sub, { gain: 0.18 });
      booked.push({ time: next, n, pos, period });
      if (booked.length > 16) booked.shift();
      n++;
      pos++;
      next += period;
      if (pos >= s.beats) onBar(++bars);
    }
  };

  tick();
  const timer = setInterval(tick, LOOP_MS);
  return {
    stop: () => clearInterval(timer),
    beatAt: (t) => {
      for (let i = booked.length - 1; i >= 0; i--) if (booked[i].time <= t) return booked[i];
      return null;
    },
  };
}

const engines = new Map(); // modId -> engine

// Make the engines match the set of running metronomes
export function syncEngines(ids, make) {
  for (const [id, e] of engines) {
    if (!ids.includes(id)) {
      e.stop();
      engines.delete(id);
    }
  }
  for (const id of ids) if (!engines.has(id)) engines.set(id, runEngine(make(id)));
}

export const beatAt = (modId, t) => engines.get(modId)?.beatAt(t) ?? null;

// Speed trainer: every N bars, nudge the tempo up toward the target
export function trainerStep(updateBoard, boardId, modId, bar, cur) {
  // Shared: one browser steers, and the new tempo goes out on the grid
  if (syncOf(boardId) && cur && typeof cur.anchor === "number") {
    const s = metroState(cur);
    const t = s.trainer;
    if (!mayTrain(boardId) || !t.on || bar % Math.max(1, t.every) !== 0 || s.bpm >= t.target) return;
    const patch = retime(boardId, modId, s, { bpm: clampBpm(Math.min(t.target, s.bpm + t.step)) });
    return patchMod(updateBoard, boardId, modId, (m) => ({ ...m, ...patch }));
  }
  patchMod(updateBoard, boardId, modId, (s) => {
    const t = s.trainer;
    if (!t.on || bar % Math.max(1, t.every) !== 0 || s.bpm >= t.target) return s;
    return { ...s, bpm: clampBpm(Math.min(t.target, s.bpm + t.step)) };
  });
}

export function startMetronome({ updateBoard }, boardId, modId) {
  // In a shared space the start time is the room's, and the beat grid starts with it
  const patch = retime(boardId, modId, {}, { startedAt: sharedNow(boardId) });
  patchMod(updateBoard, boardId, modId, (s) => ({ ...s, ...patch }));
}

// state is the module's state; log=false just puts it away
export function stopMetronome({ updateBoard, logPractice, undoLog, toast }, boardId, modId, state, log) {
  const s = metroState(state);
  const patch = retime(boardId, modId, s, { startedAt: null });
  patchMod(updateBoard, boardId, modId, (m) => ({ ...m, ...patch }));
  if (!log || !s.startedAt) return;
  const mins = Math.round(Math.max(0, sharedNow(boardId) - s.startedAt) / 60000);
  if (mins < 1) {
    toast({ text: "under a minute, not logged" });
    return;
  }
  const entry = logPractice(boardId, `♩ ${mins} min at ${s.bpm}`, { mins, bpm: s.bpm, moduleId: modId });
  // The tempo you finished at goes to whatever it's wired to
  for (const id of s.sendTo) sendReading(updateBoard, boardId, id, { value: s.bpm, unit: "bpm", at: Date.now(), label: "metronome" });
  toast({
    text: `${mins} min on the chart ✓${s.sendTo.length ? ` · ${s.bpm} bpm sent` : ""}`,
    actions: [{ label: "undo", run: () => undoLog(entry) }],
  });
}
