// One shared sound-maker for the whole app. Browsers won't let a page make noise
// until someone has touched it, so nothing is created until the first gesture.
// Every voice takes `when` in AudioContext seconds (see now()) so a lookahead
// scheduler can book a beat ahead of time and have it land sample-accurately.

let ctx = null;
let unlocked = false;

// Any real gesture unlocks sound for the rest of the session
const GESTURES = ["pointerdown", "keydown", "touchend"];
if (typeof window !== "undefined") {
  const unlock = () => {
    unlocked = true;
    if (ctx) ctx.resume?.().catch(() => {});
    GESTURES.forEach((t) => window.removeEventListener(t, unlock, true));
  };
  GESTURES.forEach((t) => window.addEventListener(t, unlock, true));
}

export const hasGesture = () => unlocked;

// The shared context, made on first ask. Returns null before a gesture or where
// there's no Web Audio, so callers can just skip the noise.
export function getAudio() {
  if (!ctx) {
    const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AC || !unlocked) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume?.().catch(() => {});
  return ctx;
}

// The clock to schedule against (seconds). 0 if sound isn't available yet.
export const now = () => getAudio()?.currentTime ?? 0;

export const mtof = (midi) => 440 * 2 ** ((midi - 69) / 12);

// A plain beep with a quick fade so it never clicks. The building block for the rest.
export function tone(freq, { when, dur = 0.2, gain = 0.2, type = "sine", attack = 0.005 } = {}) {
  const a = getAudio();
  if (!a) return null;
  const t = when ?? a.currentTime;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  return osc;
}

// A keyboard-ish note: midi number in, soft attack, held, then a gentle release
export function note(midi, { when, dur = 0.5, vel = 0.7, type = "triangle" } = {}) {
  const a = getAudio();
  if (!a) return null;
  const t = when ?? a.currentTime;
  const peak = 0.05 + 0.3 * vel;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(mtof(midi), t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(peak * 0.5, t + 0.01 + dur * 0.4); // decay to sustain
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15); // release
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.2);
  return osc;
}

// A woodblock tock: a short pitched blip that drops fast. accent = the downbeat.
export function click(when, { accent = false, gain = 0.5 } = {}) {
  const a = getAudio();
  if (!a) return null;
  const t = when ?? a.currentTime;
  const f = accent ? 1500 : 1000;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(f, t);
  osc.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.04);
  g.gain.setValueAtTime(gain * (accent ? 0.5 : 0.35), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.06);
  return osc;
}

// The kitchen-timer bell: a bright ring with a shimmer, rung twice
export function ding() {
  const a = getAudio();
  if (!a) return;
  const t = a.currentTime;
  [0, 0.45].forEach((d) => {
    tone(1318.5, { when: t + d, dur: 0.9, gain: 0.25 });
    tone(1318.5 * 2.76, { when: t + d, dur: 0.4, gain: 0.07 });
  });
}

// A held reference pitch (a tuning drone). Returns stop(), which fades it out; null if sound is not ready.
export function drone(freq, { gain = 0.18, type = "triangle" } = {}) {
  const a = getAudio();
  if (!a) return null;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.08);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const u = a.currentTime;
    g.gain.cancelScheduledValues(u);
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.0002), u);
    g.gain.exponentialRampToValueAtTime(0.0001, u + 0.15);
    osc.stop(u + 0.2);
  };
}
