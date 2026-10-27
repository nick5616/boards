// The lifting log's brains: the wger exercise list (free, no key, CORS-friendly), sets,
// personal records and weekly volume. wger can't search on the server any more, so we
// fetch the English list once, boil it down to a name and a few tags, and keep that.
import { cachedJSON, DAY } from "./apis";
import { dayKey, keyToDate, addDays } from "../utils/date";

const WGER = "https://wger.de/api/v2";
const INDEX = "boards-wger-index:v1";
const FRESH = 30 * DAY;

// A few lifts to start with, and for when wger can't be reached
export const STARTERS = [
  { name: "Back squat", muscles: ["Quads", "Glutes"], equip: ["Barbell"] },
  { name: "Bench press", muscles: ["Chest", "Triceps"], equip: ["Barbell", "Bench"] },
  { name: "Deadlift", muscles: ["Hamstrings", "Glutes"], equip: ["Barbell"] },
  { name: "Overhead press", muscles: ["Shoulders", "Triceps"], equip: ["Barbell"] },
  { name: "Barbell row", muscles: ["Back"], equip: ["Barbell"] },
  { name: "Pull-up", muscles: ["Lats", "Biceps"], equip: ["Pull-up bar"] },
];

let loading = null;

async function build() {
  const page = (path) => fetch(`${WGER}/${path}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
  const [names, ex, mus, eq] = await Promise.all([
    page("exercise-translation/?language=2&limit=1000"),
    page("exercise/?language=2&limit=1000"),
    cachedJSON(`${WGER}/muscle/`, { ttl: 30 * DAY }).then((r) => r.data),
    cachedJSON(`${WGER}/equipment/`, { ttl: 30 * DAY }).then((r) => r.data),
  ]);
  const muscle = Object.fromEntries(mus.results.map((m) => [m.id, m.name_en || m.name]));
  const gear = Object.fromEntries(eq.results.map((e) => [e.id, e.name]));
  const byId = Object.fromEntries(ex.results.map((e) => [e.id, e]));
  const seen = new Set();
  const list = [];
  for (const t of names.results) {
    const e = byId[t.exercise];
    const name = (t.name ?? "").trim();
    if (!e || !name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    list.push({
      name,
      muscles: [...new Set((e.muscles ?? []).map((i) => muscle[i]).filter(Boolean))],
      equip: (e.equipment ?? []).map((i) => gear[i]).filter(Boolean),
    });
  }
  const out = { at: Date.now(), list };
  try { localStorage.setItem(INDEX, JSON.stringify(out)); } catch { /* too big or private: it just refetches next time */ }
  return out;
}

// → [{ name, muscles, equip }]; the stored copy if it's fresh, else a fresh fetch, else a stale copy
export function loadExercises() {
  let old = null;
  try { old = JSON.parse(localStorage.getItem(INDEX) || "null"); } catch { /* fine */ }
  if (old && Date.now() - old.at < FRESH) return Promise.resolve(old.list);
  loading ??= build().then((r) => r.list).catch((e) => {
    if (old) return old.list;
    throw e;
  }).finally(() => { loading = null; });
  return loading;
}

// Names that start with the words rank first, then names that contain them, then muscles & gear
export function findExercises(list, q, max = 8) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return list
    .map((e) => {
      const n = e.name.toLowerCase();
      const tags = [...e.muscles, ...e.equip].join(" ").toLowerCase();
      if (!words.every((w) => n.includes(w) || tags.includes(w))) return null;
      const score = (n.startsWith(words[0]) ? 0 : words.every((w) => n.includes(w)) ? 1 : 2) * 100 + n.length;
      return [score, e];
    })
    .filter(Boolean)
    .sort((a, b) => a[0] - b[0])
    .slice(0, max)
    .map((x) => x[1]);
}

// ── Sets ─────────────────────────────────────────────────────────────────────
export const volume = (s) => s.reps * s.w;

// Epley's estimate of the most you could lift once
export const oneRep = (s) => (s.reps <= 1 ? s.w : s.w * (1 + s.reps / 30));

// The set that is this exercise's record: heaviest weight, more reps breaking a tie
export function recordOf(log, ex) {
  let best = null;
  for (const s of log) {
    if (s.ex !== ex || !(s.w > 0)) continue;
    if (!best || s.w > best.w || (s.w === best.w && s.reps > best.reps)) best = s;
  }
  return best;
}

// Would this set beat everything logged before it? (the first time you lift something isn't a record)
export function isRecord(log, set) {
  const prev = recordOf(log, set.ex);
  return !!prev && set.w > prev.w;
}

// Every exercise's record, the freshest first
export function records(log) {
  const names = [...new Set(log.map((s) => s.ex))];
  return names
    .map((n) => recordOf(log, n))
    .filter(Boolean)
    .sort((a, b) => b.at - a.at);
}

// The most recent record set, for the Glance: "squat 185 lb"
export function latestPR(log, unit = "lb") {
  const r = records(log)[0];
  return r ? `${r.ex.toLowerCase()} ${r.w} ${unit}` : null;
}

// Monday of the week a day falls in
export function weekStart(key) {
  const d = keyToDate(key);
  return dayKey(addDays(d, -((d.getDay() + 6) % 7)));
}

// The last `n` weeks (oldest first): { start, vol, sets }
export function weeklyVolume(log, n = 8, today = dayKey()) {
  const here = weekStart(today);
  const weeks = Array.from({ length: n }, (_, i) => ({ start: dayKey(addDays(keyToDate(here), -7 * (n - 1 - i))), vol: 0, sets: 0 }));
  const at = Object.fromEntries(weeks.map((w, i) => [w.start, i]));
  for (const s of log) {
    const i = at[weekStart(s.day)];
    if (i == null) continue;
    weeks[i].vol += volume(s);
    weeks[i].sets += 1;
  }
  return weeks;
}

export const fmtVol = (v) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)));

export const fmtW = (w) => (Number.isInteger(w) ? String(w) : String(Math.round(w * 10) / 10));
