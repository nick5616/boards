// Time zones with nothing but Intl: no API for the clocks themselves. Cities come from
// Open-Meteo's free geocoder, which hands back an IANA zone ("Asia/Tokyo") with each place.
import { cachedJSON, DAY } from "./apis";

export const myZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const fmts = new Map();
const parts = (tz) => {
  if (!fmts.has(tz)) {
    fmts.set(tz, new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", weekday: "short",
    }));
  }
  return fmts.get(tz);
};

export const validZone = (tz) => {
  try { parts(tz); return true; } catch { return false; }
};

// The wall clock in a zone at a moment: { h, m, day (a number that orders days), wd }
export function wall(tz, at = Date.now()) {
  const o = {};
  for (const p of parts(tz).formatToParts(new Date(at))) o[p.type] = p.value;
  return { h: Number(o.hour) % 24, m: Number(o.minute), day: Math.floor(Date.UTC(o.year, o.month - 1, o.day) / 86400000), wd: o.weekday };
}

// Minutes this zone is ahead of UTC
export function offsetMin(tz, at = Date.now()) {
  const w = wall(tz, at);
  const asUtc = w.day * 1440 + w.h * 60 + w.m;
  return asUtc - Math.floor(at / 60000);
}

// "9pm", "9:30pm"
export function fmt12(h, m = 0) {
  const ap = h >= 12 ? "pm" : "am";
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}${ap}` : `${hh}${ap}`;
}

// How their day sits against yours: "today", "tomorrow", "yesterday"
export function dayWord(tz, from, at = Date.now()) {
  const d = wall(tz, at).day - wall(from, at).day;
  return d === 0 ? "today" : d === 1 ? "tomorrow" : d === -1 ? "yesterday" : d > 0 ? `+${d} days` : `${d} days`;
}

// "+9h", "−2h30", "same time"
export function ahead(tz, from, at = Date.now()) {
  const mins = offsetMin(tz, at) - offsetMin(from, at);
  if (!mins) return "same time";
  const a = Math.abs(mins);
  const t = a % 60 ? `${Math.floor(a / 60)}h${String(a % 60).padStart(2, "0")}` : `${a / 60}h`;
  return `${mins > 0 ? "+" : "−"}${t}`;
}

// Is someone awake at this hour (0-23, local)? Waking hours may wrap past midnight (wake 10, sleep 2).
export const awake = (p, h) => {
  const { wake = 8, sleep = 22 } = p;
  return wake <= sleep ? h >= wake && h < sleep : h >= wake || h < sleep;
};

// The next 24 hours from the top of this hour, in `me`'s zone. Each slot lists who is awake.
// → [{ at, hour (my local), up: [person...], all }]
export function strip(people, me, at = Date.now()) {
  const start = Math.floor(at / 3600000) * 3600000;
  return Array.from({ length: 24 }, (_, i) => {
    const t = start + i * 3600000;
    const up = people.filter((p) => awake(p, wall(p.tz, t).h));
    return { at: t, hour: wall(me.tz, t).h, up, all: up.length === people.length };
  });
}

// The longest runs where everyone is up (or, failing that, the most people are): [{ from, to, n }]
export function bestWindows(slots, total) {
  const top = Math.max(0, ...slots.map((s) => s.up.length));
  if (!top) return { runs: [], top, everyone: false };
  const runs = [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].up.length !== top) continue;
    const from = i;
    while (i + 1 < slots.length && slots[i + 1].up.length === top) i++;
    runs.push({ from: slots[from], to: slots[i], len: i - from + 1 });
  }
  return { runs: runs.sort((a, b) => b.len - a.len), top, everyone: top === total };
}

// ── Cities ───────────────────────────────────────────────────────────────────
export async function findCity(q) {
  const { data } = await cachedJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en`, { ttl: DAY });
  return (data.results ?? [])
    .filter((r) => r.timezone && validZone(r.timezone))
    .map((r) => ({ city: r.name, place: [r.admin1, r.country].filter((x) => x && x !== r.name).join(", "), tz: r.timezone }));
}

// The Glance line: the first person's clock, "Sam’s 9pm in Tokyo"
export function glanceOf(people, at = Date.now()) {
  const p = people?.[0];
  if (!p || !validZone(p.tz)) return null;
  const w = wall(p.tz, at);
  return `${p.name}’s ${fmt12(w.h, w.m >= 30 ? 30 : 0)} in ${p.city}`;
}
