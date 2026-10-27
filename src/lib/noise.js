// Ambient noise for the focus booth, made from nothing on the shared Web Audio context.
// It's a singleton that lives outside React, so it keeps hushing along while you
// wander to other boards (the live dock holds the stop button).
import { getAudio } from "./audio";

export const LAYERS = [
  { id: "brown", label: "brown", hint: "deep rumble" },
  { id: "pink", label: "pink", hint: "soft hiss" },
  { id: "white", label: "white", hint: "bright static" },
  { id: "rain", label: "rain", hint: "patter + drips" },
  { id: "cafe", label: "café", hint: "far-off chatter" },
];

let on = false;
let master = null;
let nodes = null; // { gains: {id: GainNode}, drip: timer, stops: [] }
let levels = {};
const listeners = new Set();
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const isOn = () => on;
const poke = () => listeners.forEach((f) => f());

// A few seconds of each colour of noise, looped. Long enough that the loop never sounds like one.
function buffer(a, kind) {
  const len = a.sampleRate * 4;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") d[i] = w * 0.5;
    else if (kind === "pink") {
      // Paul Kellet's cheap pink-noise filter
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02; // brown: a leaky running sum of white
      d[i] = last * 3.5;
    }
  }
  // Fade the seam so the loop point can't click
  const n = 800;
  for (let i = 0; i < n; i++) d[len - 1 - i] *= i / n;
  return buf;
}

const src = (a, buf) => {
  const s = a.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.start(0, Math.random() * 3);
  return s;
};

function build(a) {
  const bufs = { white: buffer(a, "white"), pink: buffer(a, "pink"), brown: buffer(a, "brown") };
  master = a.createGain();
  master.gain.value = 0.0001;
  master.connect(a.destination);
  const gains = {};
  const stops = [];
  const layer = (id, make) => {
    const g = a.createGain();
    g.gain.value = 0;
    g.connect(master);
    gains[id] = g;
    make(g);
  };
  const chain = (kind, filters, to) => {
    const s = src(a, bufs[kind]);
    let node = s;
    for (const [type, f, q] of filters) {
      const bq = a.createBiquadFilter();
      bq.type = type;
      bq.frequency.value = f;
      if (q) bq.Q.value = q;
      node.connect(bq);
      node = bq;
    }
    node.connect(to);
    stops.push(() => s.stop());
  };
  layer("brown", (g) => chain("brown", [], g));
  layer("pink", (g) => chain("pink", [], g));
  layer("white", (g) => chain("white", [["highpass", 400]], g));
  // Rain: hissy mid-high noise (the drips are added below)
  layer("rain", (g) => chain("pink", [["highpass", 900], ["lowpass", 7000]], g));
  // Café: noise squeezed into the voice range, swelling and fading like a room of people
  layer("cafe", (g) => {
    const bed = a.createGain();
    bed.gain.value = 0.7;
    bed.connect(g);
    chain("brown", [["bandpass", 500, 0.8], ["bandpass", 1400, 0.6]], bed);
    const lfo = a.createOscillator();
    const depth = a.createGain();
    lfo.frequency.value = 0.18;
    depth.gain.value = 0.3;
    lfo.connect(depth).connect(bed.gain);
    lfo.start();
    stops.push(() => lfo.stop());
  });
  // Rain drips: the odd plink of a drop landing on something
  const drip = setInterval(() => {
    const amt = levels.rain ?? 0;
    if (!on || amt < 0.05 || Math.random() > 0.35 + amt * 0.5) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const e = a.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(1400 + Math.random() * 2200, t);
    o.frequency.exponentialRampToValueAtTime(600 + Math.random() * 500, t + 0.05);
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(0.05 * amt, t + 0.004);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(e).connect(master);
    o.start(t);
    o.stop(t + 0.1);
  }, 140);
  nodes = { gains, drip, stops };
}

function apply() {
  const a = getAudio();
  if (!a || !nodes) return;
  const t = a.currentTime;
  for (const { id } of LAYERS) {
    // squared so the slider feels even, and mixed down so all five at once is not a wall of sound
    nodes.gains[id].gain.setTargetAtTime((levels[id] ?? 0) ** 2 * 0.55, t, 0.08);
  }
}

export function setLevels(next) {
  levels = { ...next };
  apply();
}

// false when sound isn't available yet (no tap on the page, or no Web Audio)
export function startNoise(mix) {
  const a = getAudio();
  if (!a) return false;
  if (!nodes) build(a);
  levels = { ...mix };
  on = true;
  apply();
  master.gain.cancelScheduledValues(a.currentTime);
  master.gain.setTargetAtTime(1, a.currentTime, 0.4);
  poke();
  return true;
}

export function stopNoise() {
  const a = getAudio();
  on = false;
  if (a && nodes) {
    master.gain.setTargetAtTime(0.0001, a.currentTime, 0.15);
    const dead = nodes;
    const m = master;
    nodes = null;
    clearInterval(dead.drip);
    // let the fade finish, then really let go of everything
    setTimeout(() => {
      dead.stops.forEach((f) => {
        try { f(); } catch { /* already stopped */ }
      });
      m.disconnect();
    }, 800);
  }
  poke();
}

// "rain + café", for the dock ticket
export const mixName = (mix) => {
  const names = LAYERS.filter((l) => (mix?.[l.id] ?? 0) > 0.02).map((l) => l.label);
  return names.length ? names.join(" + ") : "quiet";
};
