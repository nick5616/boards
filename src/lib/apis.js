// Free web APIs the modules call straight from the browser (docs/plans/free-apis.md).
// Each call goes from this browser to the API and never through us, so it costs nothing
// at any scale. Answers are kept in localStorage for a while so reopening a board doesn't
// ask again, and two modules asking for the same thing at once share one request.
import { useEffect, useState } from "react";

export const MIN = 60000;
export const HOUR = 3600000;
export const DAY = 86400000;

// ── Keys ─────────────────────────────────────────────────────────────────────
// Most of what we use needs no key. The rest are free for personal use; a person pastes
// their own in Settings → API keys and it stays in this browser (localStorage), only ever
// sent to that one API. A VITE_KEY_<NAME> in .env.local wins, for development.
// `demo` is a shared public key that works out of the box with tight rate limits.
// `feature` names what the key turns on, for the tray's "unlock with a free key" shelf;
// keys nothing uses yet have none, so the tray never promises what pasting won't do.
export const KEYS = {
  datagov: {
    label: "NASA / api.data.gov",
    get: "https://api.nasa.gov/",
    demo: "DEMO_KEY",
    unlocks: "picture of the day, Mars photos, USDA nutrition facts",
  },
  guardian: {
    label: "The Guardian",
    get: "https://open-platform.theguardian.com/access/",
    unlocks: "the newspaper's world, culture and science pages",
    feature: "World pages",
  },
  europeana: {
    label: "Europeana",
    get: "https://pro.europeana.eu/pages/get-api",
    demo: "api2demo",
    unlocks: "more museum postcards from European collections",
  },
  tmdb: {
    label: "TMDB (movies)",
    get: "https://www.themoviedb.org/settings/api",
    unlocks: "movies on the TV guide: posters, release dates, where to stream",
    feature: "Movies",
  },
  lastfm: {
    label: "Last.fm",
    get: "https://www.last.fm/api/account/create",
    unlocks: "what you've been listening to, similar artists for the record crate",
    feature: "Your plays",
  },
  rawg: {
    label: "RAWG (video games)",
    get: "https://rawg.io/apidocs",
    unlocks: "covers and release dates for the game backlog",
    feature: "Game covers",
  },
  youtube: {
    label: "YouTube Data",
    get: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
    unlocks: "searching lessons and videos without leaving the board",
  },
  freesound: {
    label: "Freesound",
    get: "https://freesound.org/apiv2/apply/",
    unlocks: "sound samples for the studio",
  },
  ebird: {
    label: "eBird",
    get: "https://ebird.org/api/keygen",
    unlocks: "birds seen near you lately, for the field guide",
    feature: "Birds nearby",
  },
  unsplash: {
    label: "Unsplash",
    get: "https://unsplash.com/oauth/applications",
    unlocks: "searching real photos for reference",
  },
};

const LS = (name) => `boards-key:${name}`;
const CHANGED = "boards-keys-changed";

// The person's own key, else the dev env key, else the shared demo key, else null
export function apiKey(name) {
  const env = import.meta.env?.[`VITE_KEY_${name.toUpperCase()}`];
  let mine = null;
  try { mine = localStorage.getItem(LS(name)); } catch { /* private window */ }
  return mine || env || KEYS[name]?.demo || null;
}

// "mine" | "env" | "demo" | null: where apiKey(name) would come from
export function keySource(name) {
  try { if (localStorage.getItem(LS(name))) return "mine"; } catch { /* fine */ }
  if (import.meta.env?.[`VITE_KEY_${name.toUpperCase()}`]) return "env";
  return KEYS[name]?.demo ? "demo" : null;
}

export function setApiKey(name, value) {
  try {
    const v = (value ?? "").trim();
    if (v) localStorage.setItem(LS(name), v);
    else localStorage.removeItem(LS(name));
  } catch { /* fine */ }
  window.dispatchEvent(new Event(CHANGED));
}

// A short human reason a module can't start without keys you haven't pasted, or null
export function keyHint(names = []) {
  const gone = names.filter((n) => !apiKey(n));
  if (!gone.length) return null;
  return `needs a free ${gone.map((n) => KEYS[n].label).join(" and ")} key`;
}

function onKeysChanged(sync) {
  window.addEventListener(CHANGED, sync);
  window.addEventListener("storage", sync);
  return () => {
    window.removeEventListener(CHANGED, sync);
    window.removeEventListener("storage", sync);
  };
}

// The key, kept fresh when it's pasted in Settings (or another tab)
export function useApiKey(name) {
  const [key, setKey] = useState(() => apiKey(name));
  useEffect(() => onKeysChanged(() => setKey(apiKey(name))), [name]);
  return key;
}

// Re-render whenever any key is pasted or forgotten
export function useKeysChanged() {
  const [, bump] = useState(0);
  useEffect(() => onKeysChanged(() => bump((n) => n + 1)), []);
}

// ── Fetching ─────────────────────────────────────────────────────────────────
const inflight = new Map();
const CACHE = "boards-api:";

function readCache(key, ttl) {
  try {
    const hit = JSON.parse(localStorage.getItem(CACHE + key) || "null");
    if (hit && Date.now() - hit.at < ttl) return hit;
  } catch { /* fine */ }
  return null;
}

function writeCache(key, data) {
  const put = () => localStorage.setItem(CACHE + key, JSON.stringify({ at: Date.now(), data }));
  try { put(); } catch {
    // full: drop the older half of our cached answers and try once more
    try {
      const ours = Object.keys(localStorage).filter((k) => k.startsWith(CACHE));
      const aged = ours
        .map((k) => [k, JSON.parse(localStorage.getItem(k) || "{}").at ?? 0])
        .sort((a, b) => a[1] - b[1]);
      aged.slice(0, Math.ceil(aged.length / 2)).forEach(([k]) => localStorage.removeItem(k));
      put();
    } catch { /* give up quietly; it just won't be cached */ }
  }
}

// GET a JSON answer, cached `ttl` ms under `key` (the URL by default; pass a key when the
// URL carries an API key). `force` skips the cache. A stale copy is returned with
// `stale: true` when the network fails, so cards keep showing something offline.
// Resolves to { data, at, cached, stale? }.
export async function cachedJSON(url, { ttl = HOUR, key = url, force = false, init, jsonp: viaScript = false } = {}) {
  if (!force) {
    const hit = readCache(key, ttl);
    if (hit) return { data: hit.data, at: hit.at, cached: true };
  }
  if (inflight.has(key)) return inflight.get(key);
  const go = (async () => {
    try {
      let data;
      if (viaScript) data = await jsonp(url);
      else {
        const res = await fetch(url, init);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim());
        data = await res.json();
      }
      writeCache(key, data);
      return { data, at: Date.now(), cached: false };
    } catch (err) {
      const old = readCache(key, Infinity);
      if (old) return { data: old.data, at: old.at, cached: true, stale: true };
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, go);
  return go;
}

// For the few APIs that only speak JSONP (no CORS header): a script tag and a callback
let jsonpN = 0;
export function jsonp(url, param = "callback", timeout = 12000) {
  return new Promise((resolve, reject) => {
    const cb = `__boardsJsonp${++jsonpN}`;
    const s = document.createElement("script");
    const done = () => { delete window[cb]; s.remove(); clearTimeout(t); };
    const t = setTimeout(() => { done(); reject(new Error("timed out")); }, timeout);
    window[cb] = (data) => { done(); resolve(data); };
    s.onerror = () => { done(); reject(new Error("couldn't load")); };
    s.src = `${url}${url.includes("?") ? "&" : "?"}${param}=${cb}`;
    document.head.appendChild(s);
  });
}

// A tiny hook for the common case: fetch on mount (and when `url` changes), cached.
// url null = don't fetch yet. Returns { data, at, loading, error, stale, reload }.
export function useCachedJSON(url, opts = {}) {
  const [st, setSt] = useState({ data: null, at: null, loading: !!url, error: null, stale: false });
  const [nonce, setNonce] = useState(0);
  const { ttl, key } = opts;
  useEffect(() => {
    if (!url) { setSt((s) => ({ ...s, loading: false })); return; }
    let live = true;
    setSt((s) => ({ ...s, loading: true, error: null }));
    cachedJSON(url, { ...opts, force: nonce > 0 })
      .then((r) => live && setSt({ data: r.data, at: r.at, loading: false, error: null, stale: !!r.stale }))
      .catch((e) => live && setSt((s) => ({ ...s, loading: false, error: e.message || "couldn't reach it" })));
    return () => { live = false; };
    // opts other than ttl/key are per-call details, not reasons to refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ttl, key, nonce]);
  return { ...st, reload: () => setNonce((n) => n + 1) };
}
