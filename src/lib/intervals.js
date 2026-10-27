// The interval coach's brain. A plan is a few plain numbers; it unrolls into steps, and one
// ticker (not the card) watches the clock, so the cues keep coming when you've wandered off to
// another board. The dock holds the ticket; this file speaks and beeps.
import { tone } from "./audio";
import { caps } from "./caps";
import { fmtClock } from "./geo";
import { sendAll } from "./readings";

export const planState = (s = {}) => ({
  warm: 300,
  reps: 6,
  hardName: "run",
  hardSecs: 60,
  easyName: "walk",
  easySecs: 90,
  cool: 300,
  voice: true,
  ...s,
});

export const PRESETS = [
  { label: "walk/run", warm: 300, reps: 6, hardName: "run", hardSecs: 60, easyName: "walk", easySecs: 90, cool: 300 },
  { label: "30/30", warm: 300, reps: 10, hardName: "fast", hardSecs: 30, easyName: "jog", easySecs: 30, cool: 300 },
  { label: "tabata", warm: 120, reps: 8, hardName: "go", hardSecs: 20, easyName: "rest", easySecs: 10, cool: 120 },
  { label: "4 × 4 min", warm: 600, reps: 4, hardName: "hard", hardSecs: 240, easyName: "easy", easySecs: 180, cool: 300 },
];

// "5:00" or "90" or "1:30" in, seconds out (null if it isn't a time)
export function parseTime(str) {
  const m = String(str).trim().match(/^(?:(\d+):)?(\d{1,3})(?::(\d{2}))?$/);
  if (!m) return null;
  if (m[3] != null) return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return m[1] != null ? Number(m[1]) * 60 + Number(m[2]) : Number(m[2]);
}

// [{ kind: warm | hard | easy | cool, name, secs, rep?, reps? }]
export function stepsOf(p) {
  const out = [];
  if (p.warm > 0) out.push({ kind: "warm", name: "warm-up", secs: p.warm });
  for (let i = 1; i <= p.reps; i++) {
    out.push({ kind: "hard", name: p.hardName, secs: p.hardSecs, rep: i, reps: p.reps });
    // the cool-down is the last rest, so don't walk twice
    if (p.easySecs > 0 && !(i === p.reps && p.cool > 0)) out.push({ kind: "easy", name: p.easyName, secs: p.easySecs, rep: i, reps: p.reps });
  }
  if (p.cool > 0) out.push({ kind: "cool", name: "cool-down", secs: p.cool });
  return out;
}

export const totalSecs = (steps) => steps.reduce((n, s) => n + s.secs, 0);

// Which step the clock is in: { idx, into (secs into it), left (secs to go in it) }
export function stepAt(steps, elapsed) {
  let t = 0;
  for (let idx = 0; idx < steps.length; idx++) {
    if (elapsed < t + steps[idx].secs) return { idx, into: elapsed - t, left: t + steps[idx].secs - elapsed };
    t += steps[idx].secs;
  }
  return { idx: steps.length, into: 0, left: 0 };
}

export const summary = (p) => `${p.reps}× ${p.hardName} ${fmtClock(p.hardSecs)} / ${p.easyName} ${fmtClock(p.easySecs)}`;

// How long a step is, said aloud: "one minute thirty", "five minutes", "forty five seconds"
function say(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const mm = m ? `${m} minute${m === 1 ? "" : "s"}` : "";
  const ss = s ? `${s} second${s === 1 ? "" : "s"}` : "";
  return [mm, ss].filter(Boolean).join(" ");
}

export function cueFor(step, steps, idx, plan) {
  if (step.kind === "warm") return `warm up, ${say(step.secs)}`;
  if (step.kind === "cool") return "cool down. nice work, nearly there";
  if (step.kind === "hard") {
    const left = step.reps - step.rep;
    if (step.reps === 1) return `${step.name} now`;
    if (left === 0) return `${step.name} now. last one!`;
    return step.rep === 1 ? `${step.name} now. ${step.reps} to go` : `${step.name} now`;
  }
  const left = step.reps - step.rep;
  return left === 0 ? `${step.name}` : `${step.name} now. ${left} more to go!`;
}

export const speak = (text) => {
  if (!caps.speech) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  } catch {
    /* no voice today */
  }
};

const BEEP = { warm: 659, hard: 1175, easy: 784, cool: 659 };

/* ── Running sessions (one per module) ── */

const runs = new Map(); // modId -> { startedAt, steps, total, plan, idx, beeped, timer, sendTo, boardId, onComplete }
const listeners = new Set();
let snap = {};
const publish = () => {
  snap = Object.fromEntries([...runs].map(([id, r]) => [id, { startedAt: r.startedAt, steps: r.steps, total: r.total, plan: r.plan }]));
  listeners.forEach((f) => f());
};
export const subscribe = (f) => (listeners.add(f), () => listeners.delete(f));
export const coachSnap = () => snap;

export function startCoach(modId, boardId, plan, sendTo, onComplete) {
  if (runs.has(modId)) return null;
  const steps = stepsOf(plan);
  if (!steps.length) return null;
  const r = { startedAt: Date.now(), steps, total: totalSecs(steps), plan, idx: -1, beeped: -1, sendTo, boardId, onComplete };
  const tick = () => {
    const elapsed = (Date.now() - r.startedAt) / 1000;
    if (elapsed >= r.total) {
      if (plan.voice) speak("all done. you did it!");
      tone(1568, { dur: 0.3, gain: 0.25 });
      return r.onComplete?.();
    }
    const at = stepAt(r.steps, elapsed);
    if (at.idx !== r.idx) {
      r.idx = at.idx;
      r.beeped = -1;
      const step = r.steps[at.idx];
      tone(BEEP[step.kind], { dur: 0.25, gain: 0.25 });
      if (plan.voice) speak(cueFor(step, r.steps, at.idx, plan));
    }
    // three little ticks before the change
    const sec = Math.ceil(at.left);
    if (sec <= 3 && sec >= 1 && r.beeped !== sec && r.steps[at.idx].secs > 6) {
      r.beeped = sec;
      tone(880, { dur: 0.08, gain: 0.18 });
    }
  };
  r.timer = setInterval(tick, 200);
  runs.set(modId, r);
  publish();
  tick();
  return r;
}

// Put the coach away. Returns what happened (or null if it wasn't running); the caller logs it.
export function endCoach(modId) {
  const r = runs.get(modId);
  if (!r) return null;
  clearInterval(r.timer);
  runs.delete(modId);
  if (caps.speech) try { window.speechSynthesis.cancel(); } catch { /* fine */ }
  publish();
  const secs = Math.min(r.total, Math.round((Date.now() - r.startedAt) / 1000));
  return { secs, plan: r.plan, sendTo: r.sendTo, done: secs >= r.total - 1 };
}

// Stopped (or finished): a sticker if you got a minute in
export function logCoach(data, boardId, ended) {
  const { updateBoard, logPractice, undoLog, toast } = data;
  if (!ended) return;
  const mins = Math.round(ended.secs / 60);
  if (mins < 1) return toast({ text: "under a minute, not logged" });
  const entry = logPractice(boardId, `📋 ${summary(ended.plan)} · ${mins} min${ended.done ? "" : " (cut short)"}`, { mins });
  const sent = sendAll(updateBoard, boardId, ended.sendTo, { value: mins, unit: "min", label: "intervals" });
  toast({ text: `${mins} min on the chart ✓${sent ? " · sent" : ""}`, actions: [{ label: "undo", run: () => undoLog(entry) }] });
}
