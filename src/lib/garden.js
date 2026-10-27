// The gardener's arithmetic, kept out of the components: how thirsty a plant is,
// when the last frost lands, which seeds want sowing this week, and the weather fetch.
import { dayKey, keyToDate } from "../utils/date";

const DAY = 86400000;

export const LIGHTS = [
  { id: "low", label: "low light", icon: "🌙" },
  { id: "medium", label: "medium light", icon: "⛅" },
  { id: "bright", label: "bright light", icon: "☀️" },
];
export const PLANT_KINDS = ["pothos", "snake", "fern", "cactus", "monstera"];

// A fresh plant on the sill. Cacti get a long drink interval, the rest a weekly one.
export const newPlant = (id, kind = "pothos", name = "") => ({
  id,
  name,
  kind,
  every: kind === "cactus" ? 21 : kind === "snake" ? 14 : 7,
  light: kind === "cactus" ? "bright" : kind === "snake" ? "low" : "medium",
  watered: Date.now(),
  feedEvery: 6, // weeks; 0 = never
  fed: Date.now(),
  notes: "",
  photos: [], // [{ imageId, at }] progress photos, newest first
  history: [], // the last handful of waterings (ms), newest first
});

// 0 = just watered, 1 = due now, >1 = overdue. Fractions of the watering interval.
export const thirst = (p, now = Date.now()) => {
  const every = Math.max(1, p.every || 7) * DAY;
  return Math.max(0, (now - (p.watered ?? now)) / every);
};
export const isThirsty = (p, now) => thirst(p, now) >= 1;
// How far the leaves hang: perky until about half-way, then sagging towards a full wilt
export const droop = (t) => Math.max(0, Math.min(1, (t - 0.55) / 0.85));

export function dueLabel(p, now = Date.now()) {
  const left = Math.ceil(((p.watered ?? now) + p.every * DAY - now) / DAY);
  if (left < 0) return `${-left}d overdue`;
  if (left === 0) return "thirsty today";
  if (left === 1) return "tomorrow";
  return `in ${left}d`;
}

export const needsFeed = (p, now = Date.now()) =>
  p.feedEvery > 0 && now - (p.fed ?? now) >= p.feedEvery * 7 * DAY;

export const thirstyPlants = (state, now) => (state.plants ?? []).filter((p) => isThirsty(p, now));

// ── Frost & sowing ───────────────────────────────────────────────────────────
// Frost dates are kept as "MM-DD" so they repeat every year.
const pad = (n) => String(n).padStart(2, "0");
const atYear = (md, y) => {
  const [m, d] = md.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const validMD = (md) => /^\d{2}-\d{2}$/.test(md ?? "") && !isNaN(atYear(md, 2024));
export const mdOf = (d) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// The last-frost date we're counting from: this year's if it's recent or ahead, else next year's.
export function frostDate(md, today = new Date()) {
  if (!validMD(md)) return null;
  const t = midnight(today);
  let d = atYear(md, t.getFullYear());
  if (d - t < -75 * DAY) d = atYear(md, t.getFullYear() + 1);
  return d;
}
export const weeksBetween = (from, to) => Math.round(((midnight(to) - midnight(from)) / DAY) / 7 * 10) / 10;

// seeds: [{ id, name, indoors: weeks before last frost | null, sow: weeks after last frost | null }]
// → dated jobs, soonest first. `week` = falls in the 7 days around today.
export function sowingTasks(seeds = [], lastFrostMD, today = new Date()) {
  const lf = frostDate(lastFrostMD, today);
  if (!lf) return [];
  const t = midnight(today);
  const jobs = [];
  for (const s of seeds) {
    if (!s.name) continue;
    if (s.indoors != null && s.indoors !== "") {
      jobs.push({ id: `${s.id}-in`, seed: s, what: "start indoors", date: new Date(lf.getTime() - s.indoors * 7 * DAY) });
    }
    if (s.sow != null && s.sow !== "") {
      jobs.push({ id: `${s.id}-out`, seed: s, what: "sow outside", date: new Date(lf.getTime() + s.sow * 7 * DAY) });
    }
  }
  for (const j of jobs) {
    j.days = Math.round((j.date - t) / DAY);
    j.week = j.days >= -3 && j.days <= 7;
    // ticked off for this year (the tick is remembered as the year it was made)
    j.done = j.seed.done?.[j.what === "start indoors" ? "in" : "out"] === j.date.getFullYear();
  }
  return jobs.sort((a, b) => a.date - b.date);
}

export const dayLabel = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

// ── Weather (Open-Meteo: free, no key, CORS) ────────────────────────────────
// Cached 3 hours in localStorage so reopening a board doesn't ask again.
const TTL = 3 * 3600000;
const keyFor = (p) => `boards-garden-wx:${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;

export const toF = (c) => (c * 9) / 5 + 32;
export const showTemp = (c, units) => `${Math.round(units === "F" ? toF(c) : c)}°`;

export async function getForecast(place, force = false) {
  const key = keyFor(place);
  if (!force) {
    try {
      const hit = JSON.parse(localStorage.getItem(key) || "null");
      if (hit && Date.now() - hit.at < TTL) return { ...hit, cached: true };
    } catch { /* private window: just fetch */ }
  }
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    "&daily=temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max" +
    "&timezone=auto&forecast_days=7";
  const res = await fetch(url);
  if (!res.ok) throw new Error("forecast");
  const j = await res.json();
  const d = j.daily;
  const days = d.time.map((day, i) => ({
    day,
    min: d.temperature_2m_min[i],
    max: d.temperature_2m_max[i],
    rain: d.precipitation_sum[i] ?? 0, // mm
    chance: d.precipitation_probability_max?.[i] ?? null,
  }));
  const out = { at: Date.now(), days };
  try { localStorage.setItem(key, JSON.stringify(out)); } catch { /* fine */ }
  return out;
}

export async function findTown(name) {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`
  );
  if (!res.ok) throw new Error("geocode");
  const r = (await res.json()).results?.[0];
  if (!r) return null;
  return { name: [r.name, r.admin1].filter(Boolean).join(", "), lat: r.latitude, lon: r.longitude };
}

export const hereNow = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("no geolocation"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ name: "here", lat: p.coords.latitude, lon: p.coords.longitude }),
      reject,
      { timeout: 10000, maximumAge: 3600000 }
    );
  });

export const weekdayOf = (key) => keyToDate(key).toLocaleDateString(undefined, { weekday: "short" });
export { dayKey };

// Glance line for a Frost calendar: what to sow this week
export const sowThisWeek = (state, today = new Date()) =>
  sowingTasks(state.seeds, state.lastFrost, today).filter((j) => j.week && !j.done);
