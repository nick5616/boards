// Recording a run: the GPS watch lives here, not in the card, so it carries on while you
// browse other boards (the live dock holds the ticket and the screen awake).
// One recording per route module, kept in module-level state and read with useSyncExternalStore.
import { haversine, simplify, encodeTrack, toMiles, fmtClock, fmtMiles } from "./geo";
import { addEntry, deleteEntry } from "./data";
import { sendAll } from "./readings";
import { uid } from "../utils/uid";

const live = new Map(); // modId -> { watch, startedAt, pts, meters, acc, sendTo, error }
const listeners = new Set();
let snap = {}; // modId -> immutable view for the card; replaced on every change

const publish = () => {
  snap = Object.fromEntries([...live].map(([id, r]) => [id, { startedAt: r.startedAt, pts: r.pts, meters: r.meters, acc: r.acc, error: r.error }]));
  listeners.forEach((f) => f());
};
export const subscribe = (f) => (listeners.add(f), () => listeners.delete(f));
export const runSnap = () => snap;
export const isRecording = (modId) => live.has(modId);

// Fixes worse than this (metres) are the GPS guessing; a hop under MIN is standing still
const BAD_ACC = 40;
const MIN_HOP = 4;
const MAX_SPEED = 12; // m/s: a world-class sprinter. Faster than this is a glitch.

export const canLocate = () => typeof navigator !== "undefined" && !!navigator.geolocation;

export function startTrack(modId, sendTo) {
  if (live.has(modId) || !canLocate()) return false;
  const r = { startedAt: Date.now(), pts: [], meters: 0, acc: null, sendTo: sendTo ?? [], error: null, last: 0 };
  r.watch = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      r.acc = accuracy;
      r.error = null;
      const p = [latitude, longitude];
      const prev = r.pts[r.pts.length - 1];
      if (accuracy <= BAD_ACC) {
        if (!prev) r.pts = [p];
        else {
          const d = haversine(prev, p);
          const dt = Math.max(1, (pos.timestamp - r.last) / 1000);
          if (d >= MIN_HOP && d / dt <= MAX_SPEED) {
            r.meters += d;
            r.pts = [...r.pts, p];
          }
        }
        r.last = pos.timestamp;
      }
      publish();
    },
    (err) => {
      r.error = err.code === 1 ? "location is blocked for this site" : "can't find you (try the open sky)";
      publish();
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
  );
  live.set(modId, r);
  publish();
  return true;
}

// Stop watching; hands back what was recorded (or null if nothing was running)
export function endTrack(modId) {
  const r = live.get(modId);
  if (!r) return null;
  navigator.geolocation.clearWatch(r.watch);
  live.delete(modId);
  publish();
  return { startedAt: r.startedAt, pts: r.pts, meters: r.meters, sendTo: r.sendTo, secs: Math.round((Date.now() - r.startedAt) / 1000) };
}

const KEEP_RUNS = 60; // how many runs the card remembers (the full lines live in entries)

// Put a finished run in the world: the line in an entry, a summary on the card,
// a sticker on the chart, miles down the wires. data = useData(); toast offers undo.
export function saveRun(data, boardId, modId, run, sendTo = run.sendTo) {
  const { uid: user, updateBoard, logPractice, undoLog, toast } = data;
  const miles = toMiles(run.meters);
  if (miles < 0.02) {
    toast({ text: "that was hardly a step, not saved" });
    return null;
  }
  const poly = encodeTrack(simplify(run.pts, 500));
  const id = uid();
  const text = `🏃 ${fmtMiles(miles)} mi in ${fmtClock(run.secs)}`;
  const mins = Math.max(1, Math.round(run.secs / 60));
  const at = Date.now();
  const entry = addEntry(user, { kind: "run", boardId, moduleId: modId, text, miles, secs: run.secs, poly, runId: id });
  updateBoard(boardId, (b) => ({
    ...b,
    modules: b.modules.map((m) =>
      m.id === modId ? { ...m, state: { ...m.state, runs: [{ id, at, miles: Math.round(miles * 100) / 100, secs: run.secs, entryId: entry.id }, ...(m.state.runs ?? [])].slice(0, KEEP_RUNS), shown: id } } : m
    ),
  }));
  const log = logPractice(boardId, text, { mins });
  const sent = sendAll(updateBoard, boardId, sendTo, { value: Math.round(miles * 100) / 100, unit: "mi", label: "run" });
  toast({
    text: `${fmtMiles(miles)} mi on the map ✓${sent ? " · sent" : ""}`,
    actions: [
      {
        label: "undo",
        run: () => {
          undoLog(log);
          deleteEntry(user, { id: entry.id, boardId, kind: "run", moduleId: modId });
          updateBoard(boardId, (b) => ({
            ...b,
            modules: b.modules.map((m) => (m.id === modId ? { ...m, state: { ...m.state, runs: (m.state.runs ?? []).filter((x) => x.id !== id), shown: null } } : m)),
          }));
        },
      },
    ],
  });
  return id;
}
