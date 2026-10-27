// The TV guide: shows from TVMaze (free, no key, CORS) and movies from TMDB (free key).
// The module keeps just enough on each show to answer "what's next / where am I / what's
// left" without the network: the episode counts per season, the next episode's air time,
// and which episodes you've ticked. The full episode list is fetched only when you open
// a show.
import { cachedJSON, HOUR, DAY } from "./apis";

const TV = "https://api.tvmaze.com";
const TMDB = "https://api.themoviedb.org/3";

// ── Finding things ──────────────────────────────────────────────────────────
// A pasted tvmaze or imdb link → { tvmaze } | { imdb } | null
export function showRefOf(text) {
  const t = String(text ?? "");
  const tv = /tvmaze\.com\/shows\/(\d+)/i.exec(t);
  if (tv) return { tvmaze: Number(tv[1]) };
  const im = /imdb\.com\/title\/(tt\d+)/i.exec(t) ?? /^\s*(tt\d{6,10})\s*$/i.exec(t);
  if (im) return { imdb: im[1].toLowerCase() };
  return null;
}

export async function searchShows(q) {
  const { data } = await cachedJSON(`${TV}/search/shows?q=${encodeURIComponent(q)}`, { ttl: DAY });
  return (data ?? []).slice(0, 8).map((r) => ({
    tvmaze: r.show.id,
    title: r.show.name,
    year: (r.show.premiered ?? "").slice(0, 4),
    status: r.show.status,
    network: r.show.network?.name ?? r.show.webChannel?.name ?? "",
    img: r.show.image?.medium ?? null,
  }));
}

export async function showByImdb(imdb) {
  const { data } = await cachedJSON(`${TV}/lookup/shows?imdb=${imdb}`, { ttl: DAY });
  return data?.id ?? null;
}

// ── One show, boiled down ───────────────────────────────────────────────────
// Regular episodes only (specials don't count towards "where am I")
const regular = (eps) => eps.filter((e) => e.type === "regular" && e.number != null);
const stamp = (e) => (e.airstamp ? Date.parse(e.airstamp) : null);

// Episodes → { seasons: [[season, total, aired]], next: {s,e,name,at}|null }
export function boil(eps, now = Date.now()) {
  const by = {};
  let next = null;
  for (const e of regular(eps)) {
    const row = (by[e.season] ??= { total: 0, aired: 0 });
    row.total++;
    const at = stamp(e);
    // no time given counts as aired if its date has passed
    const out = at != null ? at <= now : e.airdate && Date.parse(e.airdate) <= now;
    if (out) row.aired++;
    else if (!next || (at ?? Infinity) < next.at) next = { s: e.season, e: e.number, name: e.name, at: at ?? Date.parse(`${e.airdate}T20:00:00`) };
  }
  const seasons = Object.keys(by).map(Number).sort((a, b) => a - b).map((s) => [s, by[s].total, by[s].aired]);
  return { seasons, next: next && Number.isFinite(next.at) ? next : null };
}

// What we keep on a show, from TVMaze's answer
export async function loadShow(id, { force = false } = {}) {
  const [show, eps] = await Promise.all([
    cachedJSON(`${TV}/shows/${id}`, { ttl: 6 * HOUR, force }),
    cachedJSON(`${TV}/shows/${id}/episodes`, { ttl: 6 * HOUR, force }),
  ]);
  const s = show.data;
  return {
    tvmaze: s.id,
    title: s.name,
    status: s.status, // Running | Ended | To Be Determined | In Development
    network: s.network?.name ?? s.webChannel?.name ?? "",
    img: s.image?.medium ?? null,
    imdb: s.externals?.imdb ?? null,
    url: s.url,
    checkedAt: Date.now(),
    ...boil(eps.data ?? []),
  };
}

// The full list, only when a show is opened: [{ s, e, name, at, runtime }]
export async function loadEpisodes(id) {
  const { data } = await cachedJSON(`${TV}/shows/${id}/episodes`, { ttl: 6 * HOUR });
  return regular(data ?? []).map((e) => ({ s: e.season, e: e.number, name: e.name, at: stamp(e), runtime: e.runtime }));
}

// ── Movies (TMDB) ───────────────────────────────────────────────────────────
// A v3 key is short hex; a v4 "read access token" is a long JWT sent as a bearer
const auth = (key) => (key.length > 60 ? { headers: { Authorization: `Bearer ${key}` } } : {});
const withKey = (path, key, extra = "") =>
  `${TMDB}${path}?${key.length > 60 ? "" : `api_key=${key}&`}${extra}`;

export async function searchMovies(q, key) {
  const { data } = await cachedJSON(withKey("/search/movie", key, `query=${encodeURIComponent(q)}`), {
    ttl: DAY,
    key: `tmdb:search:${q.toLowerCase()}`,
    init: auth(key),
  });
  return (data?.results ?? []).slice(0, 8).map((m) => ({
    tmdb: m.id,
    title: m.title,
    date: m.release_date || "",
    img: m.poster_path ? `https://image.tmdb.org/t/p/w154${m.poster_path}` : null,
  }));
}

// Where to stream it: names of the flat-rate services in the person's region
export async function movieProviders(id, key) {
  const region = ((navigator.language || "en-US").split("-")[1] || "US").toUpperCase();
  const { data } = await cachedJSON(withKey(`/movie/${id}/watch/providers`, key), {
    ttl: DAY,
    key: `tmdb:prov:${id}`,
    init: auth(key),
  });
  const r = data?.results?.[region];
  return (r?.flatrate ?? []).map((p) => p.provider_name).slice(0, 4);
}

// ── Where am I? ─────────────────────────────────────────────────────────────
const seenIn = (show, s) => new Set(show.seen?.[s] ?? []);

export const isMovie = (x) => x.kind === "movie";

// Aired episodes, watched or not: { aired, seen }
export function counts(show) {
  let aired = 0;
  let seen = 0;
  for (const [s, , a] of show.seasons ?? []) {
    aired += a;
    const got = seenIn(show, s);
    for (let e = 1; e <= a; e++) if (got.has(e)) seen++;
  }
  return { aired, seen };
}

export const epsLeft = (show) => {
  const { aired, seen } = counts(show);
  return aired - seen;
};

// The first aired episode not ticked yet → { s, e } | null
export function onEpisode(show) {
  for (const [s, , a] of show.seasons ?? []) {
    const got = seenIn(show, s);
    for (let e = 1; e <= a; e++) if (!got.has(e)) return { s, e };
  }
  return null;
}

// Progress through the season you're on: { s, seen, total }
export function seasonBar(show) {
  const on = onEpisode(show) ?? (show.seasons?.length ? { s: show.seasons[show.seasons.length - 1][0] } : null);
  const row = on && show.seasons?.find(([s]) => s === on.s);
  if (!row) return null;
  const got = seenIn(show, row[0]);
  let seen = 0;
  for (let e = 1; e <= row[1]; e++) if (got.has(e)) seen++;
  return { s: row[0], seen, total: row[1] };
}

// A show is finished once it has ended and you've seen every aired episode (or you said so)
export function isFinished(x) {
  if (isMovie(x)) return !!x.seenAt;
  if (x.done) return true;
  return x.status === "Ended" && (x.seasons?.length ?? 0) > 0 && epsLeft(x) === 0;
}

// Tick or untick one episode
export function toggleEp(show, s, e) {
  const got = new Set(show.seen?.[s] ?? []);
  if (got.has(e)) got.delete(e);
  else got.add(e);
  return { ...show, seen: { ...(show.seen ?? {}), [s]: [...got].sort((a, b) => a - b) } };
}

// Tick a whole season (or clear it)
export function setSeason(show, s, on) {
  const row = show.seasons?.find(([n]) => n === s);
  if (!row) return show;
  const all = on ? Array.from({ length: row[2] }, (_, i) => i + 1) : [];
  return { ...show, seen: { ...(show.seen ?? {}), [s]: all } };
}

// ── Saying when ─────────────────────────────────────────────────────────────
const dayStart = (ms) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

// "tonight 9:00 PM" | "today 9:00 AM" | "tomorrow 8 PM" | "Sun 9:00 PM" | "Nov 3"
export function whenLabel(at, now = Date.now()) {
  if (at == null) return "date not set";
  const days = Math.round((dayStart(at) - dayStart(now)) / 86400000);
  const d = new Date(at);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return `${d.getHours() >= 17 ? "tonight" : "today"} ${time}`;
  if (days === 1) return `tomorrow ${time}`;
  if (days < 7) return `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// A movie's date is a plain day, not a moment
export function movieWhen(date, now = Date.now()) {
  if (!date) return "";
  const at = Date.parse(`${date}T12:00:00`);
  const days = Math.round((dayStart(at) - dayStart(now)) / 86400000);
  if (days === 0) return "out today";
  if (days === 1) return "out tomorrow";
  if (days > 1 && days < 7) return `out ${new Date(at).toLocaleDateString([], { weekday: "long" })}`;
  if (days > 0) return `out ${new Date(at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
  return `${new Date(at).getFullYear()}`;
}

export const ep = (s, e) => `S${s}E${e}`;

// The home Glance line over all TV guide modules' lists
export function glanceFor(lists, now = Date.now()) {
  const all = lists.flat();
  const active = all.filter((x) => !isFinished(x));
  // a new episode landing today (or just landed unseen) wins
  const tonight = active
    .filter((x) => !isMovie(x) && x.next && dayStart(x.next.at) === dayStart(now))
    .sort((a, b) => a.next.at - b.next.at)[0];
  if (tonight) return `📺 new ${tonight.title} ${new Date(tonight.next.at).getHours() >= 17 ? "tonight" : "today"}`;
  const film = active.find((x) => isMovie(x) && x.date && dayStart(Date.parse(`${x.date}T12:00:00`)) === dayStart(now));
  if (film) return `🎬 ${film.title} is out today`;
  const left = active.filter((x) => !isMovie(x) && x.seasons?.length && epsLeft(x) > 0).sort((a, b) => epsLeft(a) - epsLeft(b))[0];
  if (left) return `📺 ${epsLeft(left)} ep${epsLeft(left) === 1 ? "" : "s"} left of ${left.title}`;
  return null;
}
