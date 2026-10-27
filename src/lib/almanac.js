// The Almanac's sums: the moon is worked out here, no API; sunrise and sunset come from
// Open-Meteo for a place; "on this day" comes from Wikimedia (see lib/wiki.js).
import { cachedJSON, HOUR } from "./apis";
import { dayKey } from "../utils/date";

const SYNODIC = 29.530588853;
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // a known new moon

const NAMES = [
  ["new moon", "🌑"], ["waxing crescent", "🌒"], ["first quarter", "🌓"], ["waxing gibbous", "🌔"],
  ["full moon", "🌕"], ["waning gibbous", "🌖"], ["last quarter", "🌗"], ["waning crescent", "🌘"],
];

// Age in days into the cycle (0 = new), how lit it is (0..1), and its name
export function moonPhase(date = new Date()) {
  // noon local time, so the answer holds all day
  const t = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime();
  const age = (((t - NEW_MOON) / 86400000) % SYNODIC + SYNODIC) % SYNODIC;
  const frac = age / SYNODIC;
  const lit = (1 - Math.cos(2 * Math.PI * frac)) / 2;
  const slot = Math.round(frac * 8) % 8;
  const [name, icon] = NAMES[slot];
  // days to the next full and new moon
  const toFull = ((SYNODIC / 2 - age) + SYNODIC) % SYNODIC;
  const toNew = SYNODIC - age;
  return { age, frac, lit, name, icon, toFull, toNew };
}

// → { sunrise, sunset } as Dates (local to that place), or null
export async function sunTimes(place, date = new Date()) {
  const day = dayKey(date);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    `&daily=sunrise,sunset&timezone=auto&start_date=${day}&end_date=${day}`;
  const r = await cachedJSON(url, { ttl: 12 * HOUR });
  const d = r.data?.daily;
  if (!d?.sunrise?.[0]) return null;
  // Open-Meteo gives wall-clock strings for the place ("2026-10-26T07:18"); show them as they are
  return { sunrise: d.sunrise[0], sunset: d.sunset[0] };
}

export const clock = (iso) => {
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
export const daylight = ({ sunrise, sunset }) => {
  const mins = (s) => Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16));
  const d = mins(sunset) - mins(sunrise);
  return `${Math.floor(d / 60)}h ${d % 60}m of daylight`;
};

// One event for the day, the same all day long: pick by day number from the "selected" list
export function featured(feed, date = new Date()) {
  const ok = (e) => e.text && e.year != null;
  const sel = (feed?.selected ?? []).filter(ok);
  const pool = sel.length ? sel : (feed?.events ?? []).filter(ok);
  if (!pool.length) return null;
  return pool[Number(dayKey(date).replace(/-/g, "")) % pool.length];
}

export const factLine = (e) => {
  const t = `${e.year}: ${e.text}`;
  return t.length > 80 ? t.slice(0, 77).trimEnd() + "…" : t;
};

// Glance: one "on this day" line, saved on the module when its page loaded today
export function glanceLine(mods, now = new Date()) {
  const key = dayKey(now);
  const m = mods.find((x) => x.state?.today?.day === key);
  return m ? `📅 ${m.state.today.line}` : null;
}
