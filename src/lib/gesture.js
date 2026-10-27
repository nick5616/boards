// The gesture timer's engine. A drawing session outlives the card (the dock keeps it
// alive while you wander off), so it lives here rather than in a component: the card
// just reads it. Sessions aren't saved; closing the tab ends one, like the tape recorder.
import { tone, ding } from "./audio";
import { sendAll } from "./readings";

let sessions = {}; // modId -> session
const subs = new Set();
let timer = null;

export const subscribe = (f) => (subs.add(f), () => subs.delete(f));
export const gestureSnap = () => sessions;
export const isDrawing = (modId) => !!sessions[modId];

// A new object each time, so useSyncExternalStore sees the change
const emit = () => {
  sessions = { ...sessions };
  subs.forEach((f) => f());
};

// The "class" mix: warm up quick, then settle in for the long ones (20 minutes)
export const CLASS_PLAN = [...Array(10).fill(30), ...Array(5).fill(60), ...Array(2).fill(300)];
export const planFor = ({ secs = 60, count = 10, klass = false }) => (klass ? CLASS_PLAN : Array(count).fill(secs));

const shuffle = (xs) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Which reference photo each pose uses: all of them shuffled, then shuffled again if
// the session is longer than the pile (never the same one twice in a row)
export function posesFor(imageIds, n) {
  const out = [];
  while (out.length < n) {
    let round = shuffle(imageIds);
    if (round.length > 1 && round[0] === out[out.length - 1]) round.push(round.shift());
    out.push(...round);
  }
  return out.slice(0, n);
}

export const poseMs = (s, now = Date.now()) => (s.paused ? s.carried : s.carried + now - s.resumedAt);
export const clock = (secs) => `${Math.floor(Math.max(0, secs) / 60)}:${String(Math.max(0, Math.floor(secs) % 60)).padStart(2, "0")}`;
export const mix = (plan) => {
  const m = plan.reduce((t, s) => t + s, 0) / 60;
  return `${Math.round(m)} min`;
};

const label = (s) => `gesture ${Math.min(s.idx + 1, s.plan.length)}/${s.plan.length} · ${s.plan[s.idx] >= 60 ? `${s.plan[s.idx] / 60} min` : `${s.plan[s.idx]}s`}`;

// A soft two-note "next pose" chime (silent if the page hasn't been touched)
const chime = () => {
  tone(784, { dur: 0.35, gain: 0.14 });
  tone(1175, { when: undefined, dur: 0.5, gain: 0.1 });
};

function advance(s, now) {
  s.idx += 1;
  if (s.idx >= s.plan.length) return finish(s.modId, { log: true, natural: true });
  s.carried = 0;
  s.resumedAt = now;
  chime();
  s.live.update(s.id, { label: label(s) });
  emit();
}

function tick() {
  const now = Date.now();
  for (const s of Object.values(sessions)) {
    if (s.paused) continue;
    if (poseMs(s, now) >= s.plan[s.idx] * 1000) {
      s.doneMs += s.plan[s.idx] * 1000;
      s.drawn += 1;
      advance(s, now);
    }
  }
  if (!Object.keys(sessions).length) {
    clearInterval(timer);
    timer = null;
  } else emit();
}

export function startGesture({ data, live, boardId, modId, imageIds, plan, sendTo }) {
  if (sessions[modId] || !imageIds.length) return;
  const now = Date.now();
  const id = `gesture:${modId}`;
  const s = {
    id, boardId, modId, data, live, plan, sendTo,
    poses: posesFor(imageIds, plan.length),
    idx: 0, carried: 0, resumedAt: now, paused: false, doneMs: 0, drawn: 0, startedAt: now,
  };
  sessions[modId] = s;
  live.start({
    id, kind: "gesture", boardId, modId, icon: "✏️", label: label(s),
    // The dock's ■ logs what you drew so far
    onStop: () => finish(modId, { log: true, fromDock: true }),
  });
  if (!timer) timer = setInterval(tick, 250);
  emit();
}

export function togglePause(modId) {
  const s = sessions[modId];
  if (!s) return;
  const now = Date.now();
  if (s.paused) s.resumedAt = now;
  else s.carried = poseMs(s, now);
  s.paused = !s.paused;
  emit();
}

// Move on early: the time counts, but the pose only counts as drawn if you gave it a go
// (a few seconds, or half of a very short one)
export function skip(modId) {
  const s = sessions[modId];
  if (!s) return;
  const now = Date.now();
  const spent = poseMs(s, now);
  s.doneMs += spent;
  if (spent >= Math.min(8000, s.plan[s.idx] * 500)) s.drawn += 1;
  advance(s, now);
}

// log=false just puts it away. natural = we ran out of poses, so ring the bell.
export function finish(modId, { log = true, natural = false, fromDock = false } = {}) {
  const s = sessions[modId];
  if (!s) return;
  const now = Date.now();
  const cur = natural ? 0 : poseMs(s, now);
  delete sessions[modId];
  emit();
  if (!fromDock) s.live.stop(s.id, { log: false });
  if (natural) ding();
  if (!log) return;

  // The pose you're in counts as drawn once you've given it a few seconds
  const poses = Math.min(s.plan.length, s.drawn + (!natural && cur >= Math.min(8000, s.plan[s.idx] * 500) ? 1 : 0));
  const mins = Math.round((s.doneMs + cur) / 60000);
  const { logPractice, undoLog, toast, updateBoard } = s.data;
  if (poses < 1) return toast({ text: "no poses finished, nothing logged" });
  const entry = logPractice(s.boardId, `✏️ ${poses} gesture${poses === 1 ? "" : "s"}, ${Math.max(1, mins)} min`, { mins: Math.max(1, mins) });
  const sent = sendAll(updateBoard, s.boardId, s.sendTo, { value: poses, unit: "gestures", label: "gesture timer" });
  toast({
    text: `${poses} gesture${poses === 1 ? "" : "s"} on the chart ✓${sent ? " · sent" : ""}`,
    actions: [{ label: "undo", run: () => undoLog(entry) }],
  });
}
