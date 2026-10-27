// The traveller's arithmetic, kept out of the components: the country list, money,
// days off, and nearby places. Network calls go through ./apis (cached in the browser).
import { cachedJSON, HOUR, DAY } from "./apis";
import { dayKey, keyToDate, addDays, dayDiff } from "../utils/date";
import { haversine } from "./geo";
import { homePlace } from "./place";

// ── Countries ────────────────────────────────────────────────────────────────
// REST Countries' free v3.1 endpoint is retired (it answers "deprecated"), so the list
// is built in: ISO codes grouped by region. Names come from the browser's own
// Intl.DisplayNames, and the flag is the emoji for the two letters (no images).
const REGIONS = {
  Africa: "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW",
  Americas: "AG AR BS BB BZ BO BR CA CL CO CR CU DM DO EC SV GD GT GY HT HN JM MX NI PA PY PE KN LC VC SR TT US UY VE PR",
  Asia: "AF AM AZ BH BD BT BN KH CN GE IN ID IR IQ IL JP JO KZ KW KG LA LB MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE HK MO",
  Europe: "AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA",
  Oceania: "AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU",
};
export const REGION_NAMES = Object.keys(REGIONS);
const REGION_OF = {};
for (const [r, codes] of Object.entries(REGIONS)) for (const c of codes.split(" ")) REGION_OF[c] = r;

export const flagOf = (cc) =>
  /^[A-Za-z]{2}$/.test(cc ?? "") ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🏳";

let names = null;
export const countryName = (cc) => {
  try { names ??= new Intl.DisplayNames(undefined, { type: "region" }); return names.of(cc) || cc; } catch { return cc; }
};
export const regionOf = (cc) => REGION_OF[cc] ?? "Elsewhere";

// [{ cc, name, region, flag }] sorted by name
let all = null;
export const allCountries = () =>
  (all ??= Object.keys(REGION_OF).map((cc) => ({ cc, name: countryName(cc), region: REGION_OF[cc], flag: flagOf(cc) })).sort((a, b) => a.name.localeCompare(b.name)));

export const findCountries = (q, limit = 8) => {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return allCountries()
    .filter((c) => c.name.toLowerCase().includes(s) || c.cc.toLowerCase() === s)
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(s)) - Number(!b.name.toLowerCase().startsWith(s)))
    .slice(0, limit);
};

// Which countries have a stamp, once each: [{ cc, stamps: n }]
export const visitedCountries = (stamps = []) => [...new Set(stamps.map((s) => s.cc))];

export function regionCounts(stamps = []) {
  const seen = visitedCountries(stamps);
  const out = {};
  for (const cc of seen) out[regionOf(cc)] = (out[regionOf(cc)] ?? 0) + 1;
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
}

// Each stamp gets its own ink, tilt and shape, always the same for the same stamp
const INKS = ["#b8433a", "#2f5f9e", "#2f7d52", "#6b3f8f", "#8a5a1e"];
export function stampLook(s) {
  let h = 0;
  for (const ch of `${s.id}${s.cc}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { ink: INKS[h % INKS.length], tilt: ((h >> 3) % 31) - 15, round: (h >> 8) % 3 === 0, dx: (h >> 5) % 9 - 4 };
}

export function passportGlance(state) {
  const n = visitedCountries(state.stamps).length;
  const next = (state.want ?? [])[0];
  if (!n && !next) return null;
  return `🛂 ${n} ${n === 1 ? "country" : "countries"}${next ? ` · next: ${countryName(next.cc)}` : ""}`;
}

// ── Money (Frankfurter: ECB rates, no key, CORS) ────────────────────────────
// frankfurter.app now redirects to frankfurter.dev, so we ask the new address directly.
const FX = "https://api.frankfurter.dev/v1/latest";
export const ratesFor = (base, force = false) =>
  cachedJSON(`${FX}?base=${base}`, { ttl: 6 * HOUR, force }).then((r) => ({ ...r.data, at: r.at, stale: r.stale }));

export const CURRENCY_SYMBOLS = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", INR: "₹", KRW: "₩", CHF: "Fr", CAD: "$", AUD: "$", NZD: "$", MXN: "$", BRL: "R$", THB: "฿", PHP: "₱", PLN: "zł", SEK: "kr", NOK: "kr", DKK: "kr", ILS: "₪", TRY: "₺", ZAR: "R" };
export const symbolOf = (cur) => CURRENCY_SYMBOLS[cur] ?? cur;
export const currencyName = (cur) => {
  try { return new Intl.DisplayNames(undefined, { type: "currency" }).of(cur) || cur; } catch { return cur; }
};
export function fmtMoney(n, cur) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: Math.abs(n) >= 1000 || cur === "JPY" || cur === "KRW" ? 0 : 2 }).format(n); }
  catch { return `${symbolOf(cur)}${n.toFixed(2)}`; }
}

// The spend log is in either currency; each line keeps the rate it was converted at
// (`rate` = trip currency per 1 home currency) so history doesn't shift as rates move.
export const spendInTrip = (sp, trip) => (sp.cur === trip ? sp.amt : sp.amt * sp.rate);
export const spentTotal = (spends = [], trip) => spends.reduce((t, s) => t + spendInTrip(s, trip), 0);

// What's left, and what's left of today's share (budget spread over the days still ahead).
// Everything in the trip currency. daysLeft counts today.
export function allowance(state, today = new Date()) {
  const { budget = 0, trip = "EUR", spends = [], start = "", end = "" } = state;
  const t = dayKey(today);
  if (!(budget > 0)) return null;
  const before = spends.filter((s) => s.day < t);
  const todays = spends.filter((s) => s.day === t);
  const total = spentTotal(spends, trip);
  const left = budget - total;
  let daysLeft = null;
  if (end) daysLeft = Math.max(1, dayDiff(today, keyToDate(end)) + 1);
  if (start && t < start) daysLeft = end ? dayDiff(keyToDate(start), keyToDate(end)) + 1 : null;
  const perDay = daysLeft ? (budget - spentTotal(before, trip)) / daysLeft : null;
  const today$ = perDay == null ? null : perDay - spentTotal(todays, trip);
  return { left, total, daysLeft, perDay, todayLeft: today$ };
}

export function walletGlance(state) {
  const a = allowance(state);
  if (!a) return null;
  const sym = (n) => fmtMoney(Math.round(n), state.trip);
  if (a.todayLeft != null) return `${bills(state.trip)} ${sym(Math.max(0, a.todayLeft))} left today`;
  return `${bills(state.trip)} ${sym(Math.max(0, a.left))} left`;
}
const bills = (cur) => (cur === "USD" || cur === "CAD" || cur === "AUD" ? "💵" : cur === "EUR" ? "💶" : cur === "GBP" ? "💷" : cur === "JPY" || cur === "CNY" ? "💴" : "💱");

// ── Days off (Nager.Date: public holidays, no key, CORS) ────────────────────
const NAGER = "https://date.nager.at/api/v3";
export const holidaysUrl = (year, cc) => `${NAGER}/PublicHolidays/${year}/${cc}`;
export const countriesUrl = `${NAGER}/AvailableCountries`;
export const getHolidays = (year, cc) => cachedJSON(holidaysUrl(year, cc), { ttl: 7 * DAY }).then((r) => r.data);
export const getHolidayCountries = () => cachedJSON(countriesUrl, { ttl: 7 * DAY }).then((r) => r.data);

// Whatever holidays we already have in the browser cache (for the sync home Glance)
export function cachedHolidays(cc, years) {
  const out = [];
  for (const y of years) {
    try {
      const hit = JSON.parse(localStorage.getItem(`boards-api:${holidaysUrl(y, cc)}`) || "null");
      if (hit?.data) out.push(...hit.data);
    } catch { /* fine */ }
  }
  return out;
}

const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
const longDate = (d) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

// days: [{ date: "YYYY-MM-DD", end?, name }] — public holidays plus your own days off.
// → long weekends [{ start, end (keys), length, take: [keys to book off], names, days (until start) }]
// A "free" day is a weekend or any day off. A run of free days with a holiday in it that's
// 3+ days long is a long weekend; booking one workday next to a run can bridge to 4+.
export function longWeekends(days, today = new Date(), horizon = 400) {
  const free = new Set();
  const holiday = new Map();
  for (const h of days) {
    const from = keyToDate(h.date);
    const to = h.end ? keyToDate(h.end) : from;
    for (let d = from; d <= to; d = addDays(d, 1)) {
      free.add(dayKey(d));
      if (!h.own) holiday.set(dayKey(d), h.name);
    }
  }
  const isFree = (d) => isWeekend(d) || free.has(dayKey(d));
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const runAround = (d, extra) => {
    let a = d;
    let b = d;
    while (isFree(addDays(a, -1)) || (extra && dayKey(addDays(a, -1)) === extra)) a = addDays(a, -1);
    while (isFree(addDays(b, 1)) || (extra && dayKey(addDays(b, 1)) === extra)) b = addDays(b, 1);
    return [a, b];
  };
  const found = new Map();
  const add = (a, b, take) => {
    if (b < t0) return;
    const len = dayDiff(a, b) + 1;
    const names = [];
    for (let d = a; d <= b; d = addDays(d, 1)) if (holiday.has(dayKey(d))) names.push(holiday.get(dayKey(d)));
    if (!names.length) return;
    const key = dayKey(a);
    const prev = found.get(key);
    if (prev && (prev.take.length < take.length || (prev.take.length === take.length && prev.length >= len))) return;
    found.set(key, { start: key, end: dayKey(b), length: len, take, names: [...new Set(names)], days: dayDiff(t0, a) });
  };
  for (let d = new Date(t0); dayDiff(t0, d) <= horizon; d = addDays(d, 1)) {
    if (!isFree(d)) {
      // book this one workday and see how long the break gets
      const [a, b] = runAround(d, dayKey(d));
      if (dayDiff(a, b) + 1 >= 4) add(a, b, [dayKey(d)]);
    } else if (holiday.has(dayKey(d))) {
      const [a, b] = runAround(d);
      if (dayDiff(a, b) + 1 >= 3) add(a, b, []);
    }
  }
  return [...found.values()].sort((x, y) => x.days - y.days);
}

export function describeBreak(w) {
  const span = w.start === w.end ? longDate(keyToDate(w.start)) : `${longDate(keyToDate(w.start))} – ${longDate(keyToDate(w.end))}`;
  return {
    span,
    deal: w.take.length ? `take 1 day off, get ${w.length}` : `${w.length} days, no leave needed`,
    takeLabel: w.take.length ? longDate(keyToDate(w.take[0])) : null,
  };
}

export const inDays = (n) => (n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

export function daysOffGlance(state, today = new Date()) {
  const cc = state.country;
  const years = [today.getFullYear(), today.getFullYear() + 1];
  const hols = cc ? cachedHolidays(cc, years).map((h) => ({ date: h.date, name: h.localName || h.name })) : [];
  const own = (state.days ?? []).map((d) => ({ date: d.date, end: d.end, name: d.label, own: true }));
  const lw = longWeekends([...hols, ...own], today).find((w) => w.take.length === 0);
  if (lw) return `🏖 long weekend ${inDays(lw.days)}`;
  const t = dayKey(today);
  const next = (state.days ?? []).filter((d) => (d.end || d.date) >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (next) return `🏖 ${next.label || "day off"} ${inDays(Math.max(0, dayDiff(today, keyToDate(next.date))))}`;
  const nh = hols.filter((h) => h.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
  return nh ? `🏖 ${nh.name} ${inDays(dayDiff(today, keyToDate(nh.date)))}` : null;
}

// ── Errand map (Overpass + Nominatim: OpenStreetMap data, no key, CORS) ─────
// What each kind of place is called in OSM tags.
export const PLACE_KINDS = [
  { id: "thrift", label: "thrift stores", icon: "🧥", tags: ['["shop"="second_hand"]', '["shop"="charity"]'] },
  { id: "fabric", label: "fabric shops", icon: "🧵", tags: ['["shop"="fabric"]', '["shop"="sewing"]', '["craft"="sewing"]'] },
  { id: "music", label: "music stores", icon: "🎸", tags: ['["shop"="musical_instrument"]', '["shop"="music"]', '["shop"="records"]'] },
  { id: "library", label: "libraries", icon: "📚", tags: ['["amenity"="library"]'] },
  { id: "books", label: "bookshops", icon: "📖", tags: ['["shop"="books"]'] },
  { id: "park", label: "parks", icon: "🌳", tags: ['["leisure"="park"]'] },
  { id: "cafe", label: "cafés", icon: "☕", tags: ['["amenity"="cafe"]'] },
  { id: "hardware", label: "hardware", icon: "🔩", tags: ['["shop"="hardware"]', '["shop"="doityourself"]'] },
  { id: "craft", label: "art & craft", icon: "🎨", tags: ['["shop"="craft"]', '["shop"="art"]', '["shop"="stationery"]'] },
  { id: "grocer", label: "groceries", icon: "🥬", tags: ['["shop"="supermarket"]', '["shop"="greengrocer"]'] },
  { id: "pharmacy", label: "pharmacies", icon: "💊", tags: ['["amenity"="pharmacy"]'] },
  { id: "post", label: "post offices", icon: "📮", tags: ['["amenity"="post_office"]'] },
];
export const kindById = (id) => PLACE_KINDS.find((k) => k.id === id) ?? PLACE_KINDS[0];

export const overpassQuery = (kind, [lat, lon], radius = 2000) =>
  `[out:json][timeout:20];(${kindById(kind).tags.map((t) => `nwr${t}(around:${radius},${lat},${lon});`).join("")});out center 60;`;

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

// → [{ id, name, lat, lon, meters }] nearest first. Busy public servers say no sometimes, so
// we try the second one, and a stale copy is used if both fail.
export async function nearbyPlaces(kind, here, radius = 2000, force = false) {
  const q = overpassQuery(kind, here, radius);
  const key = `overpass:${kind}:${here[0].toFixed(3)},${here[1].toFixed(3)}:${radius}`;
  let res;
  let err;
  for (const url of OVERPASS) {
    try {
      res = await cachedJSON(url, { key, ttl: 6 * HOUR, force, init: { method: "POST", body: new URLSearchParams({ data: q }) } });
      break;
    } catch (e) { err = e; }
  }
  if (!res) throw err;
  return placesFrom(res.data, here, kind);
}

export function placesFrom(json, here, kind) {
  const seen = new Set();
  return (json?.elements ?? [])
    .map((e) => {
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      const tg = e.tags ?? {};
      const name = tg.name || tg.brand || tg.operator;
      if (lat == null || lon == null || !name) return null; // unnamed ones aren't errands
      const addr = [tg["addr:housenumber"], tg["addr:street"]].filter(Boolean).join(" ");
      return { id: `${e.type}${e.id}`, name, lat, lon, kind, addr, meters: haversine(here, [lat, lon]) };
    })
    .filter((p) => p && !seen.has(p.id) && seen.add(p.id))
    .sort((a, b) => a.meters - b.meters);
}

// Nominatim asks for one request a second at most
let lastNom = 0;
export async function findAddress(q) {
  const wait = lastNom + 1100 - Date.now();
  lastNom = Date.now() + Math.max(0, wait);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const r = (await cachedJSON(url, { ttl: DAY })).data?.[0];
  if (!r) return null;
  return { name: (r.display_name || q).split(",").slice(0, 2).join(",").trim(), lat: Number(r.lat), lon: Number(r.lon) };
}

const KM_LOCALE = !/^en-(US|GB|LR|MM)/.test(typeof navigator === "undefined" ? "en-US" : navigator.language || "en-US");
export function fmtDistance(m) {
  if (KM_LOCALE) return m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
  const mi = m / 1609.344;
  return mi < 0.2 ? `${Math.round(m * 3.281 / 50) * 50} ft` : `${mi.toFixed(mi < 10 ? 1 : 0)} mi`;
}

export const openErrands = (state) => (state.pins ?? []).filter((p) => !p.done);
export function errandsGlance(state) {
  const open = openErrands(state);
  if (!open.length) return null;
  const at = state.place ?? homePlace();
  const near = at ? open.filter((p) => haversine([at.lat, at.lon], [p.lat, p.lon]) <= 5000) : open;
  const n = near.length;
  return n ? `📍 ${n} ${n === 1 ? "errand" : "errands"}${at ? " nearby" : ""}` : `📍 ${open.length} errands`;
}
