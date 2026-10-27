// The brass barometer's arithmetic: Open-Meteo weather + air quality (both free, no key, CORS)
// boiled down to a pressure trend, a rain warning and the best hour for a run.
import { MIN } from "./apis";
import { homePlace } from "./place";
import { peekJSON, instant, clock } from "./sky";

export const WX_TTL = 30 * MIN;
const at = (p) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
export const wxKey = (p) => `sky-wx:${at(p)}`;
export const aqKey = (p) => `sky-aq:${at(p)}`;

export const wxUrl = (p) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
  "&current=temperature_2m,apparent_temperature,wind_speed_10m,precipitation,surface_pressure,weather_code" +
  "&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,uv_index,wind_speed_10m,surface_pressure,is_day" +
  "&daily=sunrise,sunset&timezone=auto&forecast_days=2&past_hours=6";

export const aqUrl = (p) =>
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${p.lat}&longitude=${p.lon}` +
  "&current=us_aqi,pm2_5,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen&timezone=auto";

// ── Display ──────────────────────────────────────────────────────────────────
export const toF = (c) => (c * 9) / 5 + 32;
export const showTemp = (c, units) => (c == null ? "–" : `${Math.round(units === "F" ? toF(c) : c)}°`);
export const showWind = (kmh, units) => (kmh == null ? "–" : units === "F" ? `${Math.round(kmh * 0.621371)} mph` : `${Math.round(kmh)} km/h`);
export const showPressure = (hpa, units) => (hpa == null ? "–" : units === "F" ? `${(hpa * 0.02953).toFixed(2)} inHg` : `${Math.round(hpa)} hPa`);

// ── Pressure trend ───────────────────────────────────────────────────────────
// Change over the last three hours, the way a barograph is read.
export function trendOf(delta) {
  if (delta == null) return { label: "no trend yet", word: "steady", angle: 0 };
  const angle = Math.max(-60, Math.min(60, (delta / 5) * 60));
  const word =
    delta <= -3 ? "falling fast" : delta <= -1 ? "falling" : delta >= 3 ? "rising fast" : delta >= 1 ? "rising" : "steady";
  const label =
    delta <= -3 ? "storm weather on the way" : delta <= -1 ? "turning wetter" : delta >= 3 ? "clearing quickly" : delta >= 1 ? "settling fair" : "no change coming";
  return { word, label, angle };
}

export function aqiBand(aqi) {
  if (aqi == null) return null;
  if (aqi <= 50) return { word: "good", color: "#6bb36b" };
  if (aqi <= 100) return { word: "moderate", color: "#f2c94c" };
  if (aqi <= 150) return { word: "unhealthy for some", color: "#f2994a" };
  if (aqi <= 200) return { word: "unhealthy", color: "#eb5757" };
  return { word: "very unhealthy", color: "#9b51e0" };
}

const POLLENS = [
  ["alder_pollen", "alder"], ["birch_pollen", "birch"], ["grass_pollen", "grass"],
  ["mugwort_pollen", "mugwort"], ["olive_pollen", "olive"], ["ragweed_pollen", "ragweed"],
];
// Pollen is only modelled for Europe; elsewhere every value is null. → [{name, n}] biggest first
export function pollenOf(aq) {
  const c = aq?.current;
  if (!c) return [];
  return POLLENS.map(([k, name]) => ({ name, n: c[k] })).filter((x) => x.n != null && x.n >= 1).sort((a, b) => b.n - a.n);
}

// ── Reading the forecast ─────────────────────────────────────────────────────
// wx = raw Open-Meteo forecast, aq = raw air-quality (or null). → everything the dial shows.
export function summarize(wx, aq, now = Date.now()) {
  if (!wx?.current) return null;
  const off = wx.utc_offset_seconds ?? 0;
  const h = wx.hourly;
  const hours = (h?.time ?? []).map((t, i) => ({
    t: instant(t, off),
    temp: h.temperature_2m[i],
    feels: h.apparent_temperature[i],
    pop: h.precipitation_probability?.[i] ?? 0,
    rain: h.precipitation[i] ?? 0,
    uv: h.uv_index?.[i] ?? 0,
    wind: h.wind_speed_10m[i],
    pressure: h.surface_pressure[i],
    day: h.is_day?.[i] === 1,
  }));
  const c = wx.current;
  const ago = hours.find((x) => Math.abs(x.t - (now - 3 * 3600000)) < 30 * 60000);
  const delta = ago && c.surface_pressure != null ? c.surface_pressure - ago.pressure : null;
  const upcoming = hours.filter((x) => x.t >= now - 30 * 60000);
  const next12 = upcoming.slice(0, 12);
  const aqi = aq?.current?.us_aqi ?? null;
  const sunset = wx.daily?.sunset?.[0] ? instant(wx.daily.sunset[0], off) : null;
  return {
    off,
    now: { temp: c.temperature_2m, feels: c.apparent_temperature, wind: c.wind_speed_10m, rain: c.precipitation, pressure: c.surface_pressure },
    delta,
    trend: trendOf(delta),
    hours,
    next12,
    rainAt: rainAt(upcoming.slice(0, 24)),
    run: runHour(next12, aqi),
    aqi,
    pollen: pollenOf(aq),
    sunset,
  };
}

// The first coming hour likely to be wet: { t, pop } or null
export function rainAt(hours) {
  const wet = hours.find((x) => x.pop >= 50 || x.rain >= 0.3);
  return wet ? { t: wet.t, pop: wet.pop, rain: wet.rain } : null;
}

// Best hour for a run in the next twelve. Each hour loses points for being too cold or hot
// (by how it feels), rain, wind, strong sun and dark; dirty air rules the whole day out.
// → { hour, score, why } or { none: "why not" }
export function runHour(hours, aqi) {
  if (aqi != null && aqi > 100) return { none: `air is ${aqi > 150 ? "unhealthy" : "iffy"} (AQI ${aqi})` };
  if (!hours.length) return null;
  let best = null;
  for (const x of hours) {
    let pen = 0;
    if (x.feels < 5) pen += (5 - x.feels) * 1.2;
    if (x.feels > 21) pen += (x.feels - 21) * 1.5;
    pen += x.pop * 0.08 + (x.rain > 0.2 ? 5 : 0);
    if (x.wind > 25) pen += (x.wind - 25) * 0.3;
    if (x.uv > 7) pen += 2;
    if (!x.day) pen += 1.5;
    if (aqi != null && aqi > 50) pen += 1;
    if (!best || pen < best.score) best = { hour: x, score: pen };
  }
  if (!best || best.score > 5) return { none: "nothing great in the next 12 hours" };
  const x = best.hour;
  const bits = [x.feels >= 8 && x.feels <= 19 ? "mild" : x.feels < 8 ? "chilly" : "warm", x.pop < 20 ? "dry" : "chance of rain", x.wind < 20 ? "calm" : "breezy"];
  return { hour: x, score: best.score, why: bits.join(", ") };
}

// ── Glance (reads what's cached, never fetches) ──────────────────────────────
export function glanceFor(state, now = Date.now()) {
  const p = state?.place ?? homePlace();
  if (!p) return null;
  const aq = peekJSON(aqKey(p));
  const s = summarize(peekJSON(wxKey(p)), aq, now);
  if (!s) return null;
  if (s.aqi != null && s.aqi > 100) return `AQI ${s.aqi} — stay in`;
  if (s.rainAt && s.rainAt.t - now < 12 * 3600000) return `☔ rain at ${clock(s.rainAt.t, s.off)}`;
  if (s.trend.word === "falling fast") return "📉 pressure falling fast";
  return null;
}
