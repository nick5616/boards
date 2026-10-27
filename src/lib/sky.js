// Small helpers the sky pack shares (barometer, stargazer, field guide, tide clock).
// The place picking itself lives in garden.js (findTown / hereNow).

// What apis.js has cached for `key`, however old (null if never fetched). Glance lines read
// this so the home screen can say something without the board being open.
export function peekJSON(key) {
  try {
    const hit = JSON.parse(localStorage.getItem(`boards-api:${key}`) || "null");
    return hit ? hit.data : null;
  } catch { return null; }
}

const R = 6371;
const rad = (d) => (d * Math.PI) / 180;
export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Open-Meteo hands back wall-clock strings ("2026-10-26T14:00") in the place's own zone.
// This turns one into a real instant, given the response's utc_offset_seconds.
export const instant = (str, offsetSec = 0) => Date.parse(`${str}Z`) - offsetSec * 1000;

// "3pm", "4:12pm" — in the place's zone when an offset is given, else this device's
export function clock(ms, offsetSec = null) {
  const d = offsetSec == null ? new Date(ms) : new Date(ms + offsetSec * 1000);
  const opts = { hour: "numeric", minute: "2-digit", ...(offsetSec == null ? {} : { timeZone: "UTC" }) };
  return d.toLocaleTimeString([], opts).replace(/:00(?=\s| |$)/, "").replace(/\s| /g, "").toLowerCase();
}

// "in 2h", "in 35m", "in 3d"
export function inLabel(ms, now = Date.now()) {
  const m = Math.round((ms - now) / 60000);
  if (m <= 0) return "now";
  if (m < 90) return `in ${m}m`;
  if (m < 36 * 60) return `in ${Math.round(m / 60)}h`;
  return `in ${Math.round(m / 1440)}d`;
}

export const kmToMi = (km) => km * 0.621371;
