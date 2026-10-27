// The tide clock's arithmetic. US tides come from NOAA CO-OPS (free, keyless, CORS);
// waves anywhere (and rough tides outside the US) come from Open-Meteo Marine.
import { DAY, HOUR } from "./apis";
import { homePlace } from "./place";
import { peekJSON, haversine, instant, clock } from "./sky";

const NOAA = "https://api.tidesandcurrents.noaa.gov";
export const STATIONS_URL = `${NOAA}/mdapi/prod/webapi/stations.json?type=tidepredictions`;
const STATIONS_LS = "boards-tide-stations";
export const NEAR_KM = 120; // beyond this a NOAA station isn't "your" tide

// The station list is ~1MB of JSON, so we keep only what we show (id, name, state, lat, lon)
// and remember it for a week.
export async function getStations(force = false) {
  if (!force) {
    try {
      const hit = JSON.parse(localStorage.getItem(STATIONS_LS) || "null");
      if (hit && Date.now() - hit.at < 7 * DAY) return hit.list;
    } catch { /* fetch below */ }
  }
  try {
    const res = await fetch(STATIONS_URL);
    if (!res.ok) throw new Error("stations");
    const j = await res.json();
    const list = (j.stations ?? []).map((s) => [s.id, s.name, s.state ?? "", s.lat, s.lng]);
    try { localStorage.setItem(STATIONS_LS, JSON.stringify({ at: Date.now(), list })); } catch { /* fine */ }
    return list;
  } catch (e) {
    try { const old = JSON.parse(localStorage.getItem(STATIONS_LS) || "null"); if (old) return old.list; } catch { /* none */ }
    throw e;
  }
}

// → [{ id, name, state, lat, lon, km }] closest first
export function nearest(list, place, n = 5) {
  return list
    .map(([id, name, state, lat, lon]) => ({ id, name, state, lat, lon, km: haversine(place, { lat, lon }) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
export const tideKey = (id) => `tides:${id}`;
// High/low predictions for yesterday through tomorrow, in GMT so every time is unambiguous
export const tideUrl = (id, now = Date.now()) =>
  `${NOAA}/api/prod/datagetter?product=predictions&interval=hilo&datum=MLLW&station=${id}&format=json&units=english` +
  `&time_zone=gmt&begin_date=${ymd(now - DAY)}&range=72`;
export const TIDE_TTL = 6 * HOUR;

const mKey = (p) => `sky-marine:${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
export const marineKey = mKey;
export const marineUrl = (p) =>
  `https://marine-api.open-meteo.com/v1/marine?latitude=${p.lat}&longitude=${p.lon}` +
  "&current=wave_height,wave_period&hourly=sea_level_height_msl&timezone=auto&past_days=1&forecast_days=3";
export const MARINE_TTL = HOUR;

// ── Events ───────────────────────────────────────────────────────────────────
// Everything is [{ t (ms), type "H"|"L", ft }] in time order.
export function noaaEvents(data) {
  return (data?.predictions ?? [])
    .map((p) => ({ t: Date.parse(`${p.t.replace(" ", "T")}:00Z`), type: p.type === "H" ? "H" : "L", ft: Number(p.v) }))
    .filter((e) => Number.isFinite(e.t) && Number.isFinite(e.ft));
}

// Outside NOAA's reach: find the hourly peaks and troughs of Open-Meteo's sea level model
export function marineEvents(marine) {
  const h = marine?.hourly;
  if (!h?.sea_level_height_msl) return [];
  const off = marine.utc_offset_seconds ?? 0;
  const v = h.sea_level_height_msl;
  const out = [];
  for (let i = 1; i < v.length - 1; i++) {
    if (v[i] == null || v[i - 1] == null || v[i + 1] == null) continue;
    const up = v[i] > v[i - 1] && v[i] >= v[i + 1];
    const down = v[i] < v[i - 1] && v[i] <= v[i + 1];
    if (up || down) out.push({ t: instant(h.time[i], off), type: up ? "H" : "L", ft: v[i] * 3.28084 });
  }
  return out;
}

// Where in the tide we are: the events either side of now, how far between them, and the
// hand's angle (0 = high tide at 12, 180 = low tide at 6, sweeping once per tide)
export function phaseAt(events, now = Date.now()) {
  const i = events.findIndex((e) => e.t > now);
  if (i < 1) return null;
  const prev = events[i - 1];
  const next = events[i];
  const frac = (now - prev.t) / (next.t - prev.t);
  const angle = (prev.type === "H" ? 0 : 180) + 180 * frac;
  return { prev, next, frac, angle, level: (1 + Math.cos((angle * Math.PI) / 180)) / 2, rising: next.type === "H" };
}

export const showHeight = (ft, units) => (units === "m" ? `${(ft * 0.3048).toFixed(1)} m` : `${ft.toFixed(1)} ft`);
export const showWave = (m, units) => (m == null ? "–" : units === "m" ? `${m.toFixed(1)} m` : `${(m * 3.28084).toFixed(1)} ft`);

// ── Glance (caches only) ─────────────────────────────────────────────────────
export function glanceFor(state, now = Date.now()) {
  const here = state?.place ?? homePlace();
  const marine = here || state?.station ? peekJSON(mKey(state.station ?? here)) : null;
  const events = state?.station ? noaaEvents(peekJSON(tideKey(state.station.id))) : marineEvents(marine);
  const next = events.find((e) => e.t > now);
  if (!next || next.t - now > 14 * HOUR) return null;
  return `🌊 ${next.type === "H" ? "high" : "low"} tide ${clock(next.t, marine?.utc_offset_seconds ?? null)}`;
}
