// The heart-rate strap, over Web Bluetooth (Chrome / Edge). Any strap or watch that shows up as a
// standard "heart rate" device works. The connection lives here, not in the card, so the
// beat carries on while you browse other boards.
import { sendAll } from "./readings";
import { fmtClock } from "./geo";

export const ZONES = [
  { name: "easy", from: 0.5, color: "#7fbf8e" },
  { name: "fat burn", from: 0.6, color: "#c5d86a" },
  { name: "cardio", from: 0.7, color: "#f2c14e" },
  { name: "hard", from: 0.8, color: "#ee8a4a" },
  { name: "max", from: 0.9, color: "#d9453a" },
];
export const DEFAULT_MAX = 190;

// 0 = below the zones, 1..5 inside one
export function zoneOf(bpm, max = DEFAULT_MAX) {
  const f = bpm / max;
  let z = 0;
  ZONES.forEach((zn, i) => f >= zn.from && (z = i + 1));
  return z;
}

// The bytes of a heart rate measurement (Bluetooth characteristic 0x2A37): bit 0 of the flags
// says whether the number is 8 or 16 bits wide.
export function parseHeartRate(dv) {
  return dv.getUint8(0) & 1 ? dv.getUint16(1, true) : dv.getUint8(1);
}

export const canBluetooth = () => typeof navigator !== "undefined" && !!navigator.bluetooth;

const straps = new Map(); // modId -> { device, bpm, status, name, error, rec, max, last }
const listeners = new Set();
let snap = {};
const publish = () => {
  snap = Object.fromEntries(
    [...straps].map(([id, h]) => [id, { status: h.status, bpm: h.bpm, name: h.name, error: h.error, rec: h.rec ? { ...h.rec, trace: h.rec.trace } : null }])
  );
  listeners.forEach((f) => f());
};
export const subscribe = (f) => (listeners.add(f), () => listeners.delete(f));
export const heartSnap = () => snap;

function sample(h, bpm) {
  const t = Date.now();
  h.bpm = bpm;
  h.status = "live";
  h.error = null;
  const r = h.rec;
  if (r && bpm > 30 && bpm < 240) {
    const dt = h.last ? Math.min(5, (t - h.last) / 1000) : 0; // a gap longer than 5s isn't counted
    r.sum += bpm * dt;
    r.secs += dt;
    r.max = Math.max(r.max, bpm);
    r.zones[zoneOf(bpm, h.max)] += dt;
    if (t - r.lastTrace >= 5000) {
      r.trace = [...r.trace, bpm].slice(-60);
      r.lastTrace = t;
    }
  }
  h.last = t;
  publish();
}

const touch = (modId, patch) => {
  const h = straps.get(modId) ?? { status: "idle", bpm: null, name: "", error: null, rec: null, max: DEFAULT_MAX, last: 0 };
  Object.assign(h, patch);
  straps.set(modId, h);
  publish();
  return h;
};

export const setMax = (modId, max) => straps.has(modId) && (straps.get(modId).max = max);

// Ask the browser to pair (this must come from a click). max = the module's max heart rate.
export async function connectStrap(modId, max = DEFAULT_MAX) {
  const h = touch(modId, { status: "connecting", error: null, max });
  try {
    const device = h.device ?? (await navigator.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] }));
    h.device = device;
    h.name = device.name || "heart strap";
    if (!h.wired) {
      h.wired = true;
      device.addEventListener("gattserverdisconnected", () => touch(modId, { status: "lost", bpm: null }));
    }
    const server = await device.gatt.connect();
    const svc = await server.getPrimaryService("heart_rate");
    const ch = await svc.getCharacteristic("heart_rate_measurement");
    await ch.startNotifications();
    ch.addEventListener("characteristicvaluechanged", (e) => sample(h, parseHeartRate(e.target.value)));
    touch(modId, { status: "waiting" }); // paired; the first beat flips it to "live"
  } catch (err) {
    // closing the picker isn't an error
    const cancelled = err?.name === "NotFoundError";
    touch(modId, { status: h.rec ? "lost" : "idle", error: cancelled ? null : "couldn't reach the strap (is it on, and not paired to something else?)" });
  }
}

export function disconnectStrap(modId) {
  const h = straps.get(modId);
  if (!h) return;
  try { h.device?.gatt?.disconnect(); } catch { /* already gone */ }
  straps.delete(modId);
  publish();
}

export const isSession = (modId) => !!straps.get(modId)?.rec;

export function startSession(modId) {
  const h = straps.get(modId);
  if (!h || h.rec) return null;
  h.rec = { startedAt: Date.now(), sum: 0, secs: 0, max: 0, zones: [0, 0, 0, 0, 0, 0], trace: [], lastTrace: 0 };
  h.last = 0;
  publish();
  return h.rec;
}

// What the session came to: { secs, avg, max, zones } (null if it wasn't running)
export function endSession(modId) {
  const h = straps.get(modId);
  const r = h?.rec;
  if (!r) return null;
  h.rec = null;
  publish();
  return { secs: Math.round((Date.now() - r.startedAt) / 1000), avg: r.secs ? Math.round(r.sum / r.secs) : 0, max: r.max, zones: r.zones, sendTo: h.sendTo };
}

export const rememberWires = (modId, sendTo) => straps.has(modId) && (straps.get(modId).sendTo = sendTo ?? []);

export function logSession(data, boardId, modId, done) {
  const { updateBoard, logPractice, undoLog, toast } = data;
  if (!done) return;
  const mins = Math.round(done.secs / 60);
  if (mins < 1 || !done.avg) return toast({ text: done.avg ? "under a minute, not logged" : "no beats heard, not logged" });
  const entry = logPractice(boardId, `❤️ ${fmtClock(done.secs)} · avg ${done.avg} · max ${done.max} bpm`, { mins, avgHr: done.avg, maxHr: done.max });
  const sent = sendAll(updateBoard, boardId, done.sendTo, { value: done.avg, unit: "bpm", label: "heart" });
  toast({ text: `avg ${done.avg} bpm logged ✓${sent ? " · sent" : ""}`, actions: [{ label: "undo", run: () => undoLog(entry) }] });
}
