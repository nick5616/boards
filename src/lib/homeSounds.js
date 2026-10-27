// Little table-top noises for the Home & table modules: a wheel's ratchet, a coin,
// dice on felt. Built on the shared sound-maker (lib/audio); each does nothing
// until the page has been touched, like everything else that makes noise.
import { getAudio, tone } from "./audio";

// A flapper flicking over a peg. pitch nudges it so a fast wheel sounds busy, not robotic.
export function ratchet(pitch = 1) {
  const a = getAudio();
  if (!a) return;
  tone(1900 * pitch, { dur: 0.03, gain: 0.1, type: "square", attack: 0.001 });
  tone(620 * pitch, { dur: 0.05, gain: 0.08, type: "triangle", attack: 0.001 });
}

// A short burst of noise, filtered: the bones of a clack
function noise(dur, { freq = 1800, q = 1, gain = 0.25 } = {}) {
  const a = getAudio();
  if (!a) return;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  src.buffer = buf;
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

// Dice knocking on felt or on each other
export const clack = (soft = false) => noise(0.06, { freq: 900 + Math.random() * 900, q: 1.4, gain: soft ? 0.12 : 0.3 });

// A coin dropping into a slot: a ping, then a little ringing tail
export function coin(out = false) {
  const a = getAudio();
  if (!a) return;
  const t = a.currentTime;
  const hi = out ? 1568 : 2093;
  tone(hi, { when: t, dur: 0.12, gain: 0.12, type: "triangle" });
  tone(hi * 1.5, { when: t + 0.06, dur: 0.3, gain: 0.09, type: "sine" });
}

// A tiny fanfare for a landing
export function landed() {
  const a = getAudio();
  if (!a) return;
  const t = a.currentTime;
  [784, 988, 1175].forEach((f, i) => tone(f, { when: t + i * 0.09, dur: 0.22, gain: 0.12, type: "triangle" }));
}
