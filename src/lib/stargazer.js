// The star wheel's arithmetic: moon phase and sidereal time worked out here, plus the
// fetches for the sun, ISS, launches and the NASA picture of the day (all browser → API).
import { MIN, HOUR, apiKey } from "./apis";
import { peekJSON, haversine, instant, inLabel } from "./sky";

const DAYMS = 86400000;

// ── Moon (computed locally) ──────────────────────────────────────────────────
const SYNODIC = 29.530588853;
const NEW_MOON_JD = 2451550.1; // 2000-01-06 ~14:20 UTC
export const jdOf = (ms) => ms / DAYMS + 2440587.5;

// age in days since the last new moon, 0..29.53
export const moonAge = (ms) => ((((jdOf(ms) - NEW_MOON_JD) % SYNODIC) + SYNODIC) % SYNODIC);

const PHASES = [
  ["new moon", "🌑"], ["waxing crescent", "🌒"], ["first quarter", "🌓"], ["waxing gibbous", "🌔"],
  ["full moon", "🌕"], ["waning gibbous", "🌖"], ["last quarter", "🌗"], ["waning crescent", "🌘"],
];
export function moonOf(ms = Date.now()) {
  const age = moonAge(ms);
  const frac = age / SYNODIC;
  const light = (1 - Math.cos(2 * Math.PI * frac)) / 2; // 0 new .. 1 full
  const [name, icon] = PHASES[Math.round(frac * 8) % 8];
  return { age, frac, light, name, icon, waxing: frac < 0.5 };
}
// Days until the moon is next at `target` (0 new, 0.5 full) of its cycle
export const daysUntilPhase = (ms, target) => {
  const f = moonAge(ms) / SYNODIC;
  return ((target - f + 1) % 1) * SYNODIC;
};
// "full moon tonight" when full is within about 18 hours either way
export function moonNote(ms = Date.now()) {
  const m = moonOf(ms);
  const toFull = daysUntilPhase(ms, 0.5);
  const sinceFull = SYNODIC - toFull;
  if (toFull < 0.75 || sinceFull < 1.0) return { text: "🌕 full moon tonight", m };
  const toNew = daysUntilPhase(ms, 0);
  if (toNew < 0.75 || SYNODIC - toNew < 1.0) return { text: "🌑 new moon: darkest skies", m };
  return { text: null, m };
}

// ── Sky orientation ──────────────────────────────────────────────────────────
// Local sidereal time in degrees: which right ascension is on your meridian right now
export function lstDeg(ms, lon) {
  const gmst = 280.46061837 + 360.98564736629 * (jdOf(ms) - 2451545.0);
  return (((gmst + lon) % 360) + 360) % 360;
}

// The bright stars and figures drawn on the wheel: [name, RA hours, dec degrees]
export const STARS = {
  polaris: ["Polaris", 2.53, 89.26],
  dubhe: ["Dubhe", 11.06, 61.75], merak: ["Merak", 11.03, 56.38], phecda: ["Phecda", 11.9, 53.69],
  megrez: ["Megrez", 12.26, 57.03], alioth: ["Alioth", 12.9, 55.96], mizar: ["Mizar", 13.4, 54.93], alkaid: ["Alkaid", 13.79, 49.31],
  caph: ["Caph", 0.15, 59.15], schedar: ["Schedar", 0.68, 56.54], gamcas: ["Gamma Cas", 0.945, 60.72], ruchbah: ["Ruchbah", 1.43, 60.24], segin: ["Segin", 1.91, 63.67],
  betelgeuse: ["Betelgeuse", 5.92, 7.41], bellatrix: ["Bellatrix", 5.42, 6.35], alnitak: ["Alnitak", 5.68, -1.94], alnilam: ["Alnilam", 5.6, -1.2],
  mintaka: ["Mintaka", 5.53, -0.3], saiph: ["Saiph", 5.8, -9.67], rigel: ["Rigel", 5.24, -8.2],
  deneb: ["Deneb", 20.69, 45.28], sadr: ["Sadr", 20.37, 40.26], albireo: ["Albireo", 19.51, 27.96], gienah: ["Gienah", 20.77, 33.97], deltacyg: ["Delta Cyg", 19.75, 45.13],
  vega: ["Vega", 18.62, 38.78], arcturus: ["Arcturus", 14.26, 19.18], capella: ["Capella", 5.28, 46.0], sirius: ["Sirius", 6.75, -16.72],
  acrux: ["Acrux", 12.44, -63.1], mimosa: ["Mimosa", 12.8, -59.69], gacrux: ["Gacrux", 12.52, -57.11], deltacru: ["Delta Cru", 12.25, -58.75],
  alphacen: ["Alpha Cen", 14.66, -60.83], betacen: ["Beta Cen", 14.06, -60.37], canopus: ["Canopus", 6.4, -52.7],
};
export const FIGURES = [
  { name: "Big Dipper", lines: [["dubhe", "merak", "phecda", "megrez", "dubhe"], ["megrez", "alioth", "mizar", "alkaid"]], label: "mizar" },
  { name: "Cassiopeia", lines: [["caph", "schedar", "gamcas", "ruchbah", "segin"]], label: "gamcas" },
  { name: "Orion", lines: [["betelgeuse", "bellatrix", "mintaka", "alnilam", "alnitak", "betelgeuse"], ["alnitak", "saiph", "rigel", "mintaka"]], label: "alnilam" },
  { name: "Cygnus", lines: [["deneb", "sadr", "albireo"], ["deltacyg", "sadr", "gienah"]], label: "sadr" },
  { name: "Southern Cross", lines: [["acrux", "gacrux"], ["mimosa", "deltacru"]], label: "mimosa" },
];
export const NAMED = ["polaris", "vega", "arcturus", "capella", "sirius", "rigel", "betelgeuse", "canopus", "alphacen", "deneb"];

// Where a star lands on the wheel (viewBox units from the centre): the visible celestial pole
// sits in the middle, the meridian runs straight up. `R` = dial radius, reach = degrees from the pole shown.
export function project(raHours, dec, lst, lat, R, reach = 130) {
  const south = lat < 0;
  const dist = south ? 90 + dec : 90 - dec; // degrees from the pole in view
  const r = (dist / reach) * R;
  const ang = ((raHours * 15 - lst) * Math.PI) / 180 * (south ? 1 : -1);
  return [r * Math.sin(ang), -r * Math.cos(ang)];
}

// The horizon as a closed polygon of wheel points: everything inside is above the horizon
export function horizon(lst, lat, R, reach = 130) {
  const phi = (lat * Math.PI) / 180;
  const pts = [];
  for (let a = 0; a < 360; a += 5) {
    const A = (a * Math.PI) / 180; // azimuth from north through east
    const dec = Math.asin(Math.cos(phi) * Math.cos(A));
    let c = (-Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec) || 1e-9);
    c = Math.max(-1, Math.min(1, c));
    let H = Math.acos(c); // hour angle magnitude in radians
    if (a < 180) H = -H; // east of the meridian
    const ra = (lst - (H * 180) / Math.PI) / 15;
    pts.push(project(((ra % 24) + 24) % 24, (dec * 180) / Math.PI, lst, lat, R, reach));
  }
  return pts;
}

// ── Fetches ──────────────────────────────────────────────────────────────────
export const sunKey = (p) => `sky-sun:${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
export const sunUrl = (p) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&daily=sunrise,sunset&timezone=auto&forecast_days=3`;
export const SUN_TTL = 6 * HOUR;

export const ISS_URL = "https://api.wheretheiss.at/v1/satellites/25544";
export const ISS_NEAR_KM = 1500;
export const issNear = (iss, place) => (iss && place ? haversine({ lat: iss.latitude, lon: iss.longitude }, place) : null);

// Launch Library 2 allows 15 requests an hour, so we keep an answer for 90 minutes
export const LAUNCH_URL = "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=5";
export const LAUNCH_KEY = "sky-launches";
export const LAUNCH_TTL = 90 * MIN;

export const apodKey = () => `sky-apod:${new Date().toISOString().slice(0, 10)}`;
export const apodUrl = () => `https://api.nasa.gov/planetary/apod?api_key=${apiKey("datagov")}`;
export const APOD_TTL = 6 * HOUR;

// "Falcon 9 Block 5 | Starlink 15-16" → "Falcon 9", with the mission after the bar
export function launchBits(l) {
  const [rocketFull, mission] = (l.name ?? "").split(" | ");
  const rocket = l.rocket?.configuration?.name || rocketFull?.replace(/ Block \d+/, "") || "a rocket";
  return {
    id: l.id,
    rocket,
    mission: l.mission?.name || mission || "",
    net: Date.parse(l.net),
    status: l.status?.abbrev ?? "",
    where: [l.pad?.name, l.pad?.location?.name].filter(Boolean).join(", "),
  };
}

// Tonight's dark window: sunset from Open-Meteo plus about 75 minutes for the sky to
// darken, until 75 minutes before the next sunrise. Picks the first window not yet over.
export function darkness(sun, now = Date.now()) {
  if (!sun?.daily) return null;
  const off = sun.utc_offset_seconds ?? 0;
  const set = sun.daily.sunset.map((t) => instant(t, off));
  const rise = sun.daily.sunrise.map((t) => instant(t, off));
  for (let k = 0; k < set.length - 1; k++) {
    const start = set[k] + 75 * MIN;
    const end = rise[k + 1] - 75 * MIN;
    if (end > now) return { off, sunset: set[k], dark: [start, end], inDark: now >= start, toDark: start - now };
  }
  return null;
}

// ── Glance (reads caches only) ───────────────────────────────────────────────
export function glanceFor(state, now = Date.now()) {
  const launches = (peekJSON(LAUNCH_KEY)?.results ?? []).map(launchBits).filter((l) => l.net > now - 30 * MIN);
  const soon = launches.find((l) => l.net - now < 24 * HOUR);
  if (soon) return `🚀 ${soon.rocket} ${inLabel(soon.net, now)}`;
  return moonNote(now).text;
}
