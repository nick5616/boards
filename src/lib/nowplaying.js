// "What song is this?" Stations announce their songs in different ways, so this tries
// each way in turn and remembers which one works for a station (per stream url):
//   triton    - StreamTheWorld stations (Los 40 and friends) share a public now-playing list
//   icecast   - Icecast / Shoutcast status pages, when the station lets browsers read them
//   proxy     - our own server peeks at the stream's built-in song name (server/nowplaying.js)
// Each step answers a song, null ("works, but nothing's announced right now") or
// undefined ("can't help with this station", never asked again).
// nowPlaying(station) → { artist, title, album?, source } | null

const TTL = 15000; // nobody needs the song fresher than this
const cache = new Map(); // stream url -> { at, song }
const flying = new Map(); // stream url -> promise, so two askers share one lookup
const ruledOut = new Map(); // stream url -> steps that can't help here
const worked = new Map(); // stream url -> the step that last gave a song

const get = (url, as) =>
  fetch(url, { signal: AbortSignal.timeout(4000) }).then((r) => (r.ok ? r[as]() : Promise.reject(new Error(String(r.status)))));

// "Artist - Title" → both halves
const split = (t) => {
  const i = t.indexOf(" - ");
  return i > 0 ? { artist: t.slice(0, i).trim(), title: t.slice(i + 3).trim() } : { artist: "", title: t.trim() };
};

/* ── StreamTheWorld / Triton ── */

// The stream url's last piece names the mount: …/LOS40_COLOMBIAAAC_SC.mp3 → LOS40_COLOMBIA
// (their list wants it in capitals, though the stream urls are often mixed case: Los40)
const mounts = (url) => {
  const name = new URL(url).pathname.split("/").pop().replace(/\.(mp3|aac)$/i, "").toUpperCase();
  return [...new Set([name, name.replace(/_SC$/, ""), name.replace(/(AAC)?(_SC)?$/, "")])].filter(Boolean);
};

async function triton(url) {
  if (!/streamtheworld\.com$/i.test(new URL(url).hostname)) return undefined;
  const tried = [worked.get(url + "#mount"), ...mounts(url)].filter(Boolean);
  for (const mount of new Set(tried)) {
    const xml = await get(`https://np.tritondigital.com/public/nowplaying?mountName=${encodeURIComponent(mount)}&numberToFetch=1&eventType=track`, "text").catch(() => null);
    if (!xml) continue;
    const info = new DOMParser().parseFromString(xml, "text/xml").querySelector("nowplaying-info");
    if (!info) continue; // not this mount
    worked.set(url + "#mount", mount);
    const prop = (n) => info.querySelector(`property[name="${n}"]`)?.textContent.trim() || "";
    const song = prop("track_artist_name") ? { artist: prop("track_artist_name"), title: prop("cue_title") } : split(prop("cue_title"));
    return song.title ? { ...song, album: prop("track_album_name") || undefined } : null;
  }
  return undefined;
}

/* ── Icecast / Shoutcast ── */

async function icecast(url) {
  const u = new URL(url);
  if (/streamtheworld\.com$/i.test(u.hostname)) return undefined; // no status page there
  const from = (t) => (t ? split(t) : null);
  // Icecast: a list of mounts, each with what's playing on it
  const ice = await get(u.origin + "/status-json.xsl", "json").catch(() => null);
  if (ice?.icestats) {
    const all = [].concat(ice.icestats.source ?? []);
    const src = all.find((s) => s.listenurl && new URL(s.listenurl, u.origin).pathname === u.pathname) ?? (all.length === 1 ? all[0] : null);
    if (!src) return null;
    if (src.artist && src.title) return { artist: src.artist, title: src.title };
    return from(src.title);
  }
  // Shoutcast v2, then the old plain-text one
  const sc = await get(u.origin + "/stats?json=1", "json").catch(() => null);
  if (sc?.songtitle) return from(sc.songtitle);
  const cur = await get(u.origin + "/currentsong?sid=1", "text").catch(() => null);
  return cur ? from(cur.trim()) : undefined;
}

/* ── Our own server ── */

async function proxy(url) {
  const r = await fetch(`/api/nowplaying?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(7000) }).catch(() => null);
  // No server here (the page came back instead of an answer): nothing to ask
  if (!r?.ok || !/json/.test(r.headers.get("content-type") ?? "")) return undefined;
  const s = await r.json().catch(() => null);
  return s?.title ? { artist: s.artist || "", title: s.title } : null;
}

const STEPS = { triton, icecast, proxy };

async function look(url) {
  const out = ruledOut.get(url) ?? new Set();
  ruledOut.set(url, out);
  // The one that worked last time goes first
  const order = Object.keys(STEPS).sort((a, b) => (b === worked.get(url)) - (a === worked.get(url)));
  for (const name of order) {
    if (out.has(name)) continue;
    let song;
    try {
      song = await STEPS[name](url);
    } catch {
      song = undefined;
    }
    if (song === undefined) out.add(name);
    else if (song) {
      worked.set(url, name);
      return { ...song, source: name };
    }
  }
  return null;
}

export function nowPlaying(station) {
  const url = station?.url;
  if (!url) return Promise.resolve(null);
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.song);
  if (!flying.has(url)) {
    flying.set(
      url,
      look(url)
        .catch(() => null)
        .then((song) => {
          cache.set(url, { at: Date.now(), song });
          flying.delete(url);
          return song;
        })
    );
  }
  return flying.get(url);
}

/* ── Looking it up elsewhere ── */

export const searchLinks = (song) => {
  const q = encodeURIComponent([song.artist, song.title].filter(Boolean).join(" "));
  return [
    { name: "YouTube Music", url: `https://music.youtube.com/search?q=${q}` },
    { name: "Spotify", url: `https://open.spotify.com/search/${q}` },
    { name: "Apple Music", url: `https://music.apple.com/search?term=${q}` },
  ];
};

// "Ariana Grande — Hate that I made you love me"
export const songLine = (song) => [song.artist, song.title].filter(Boolean).join(" — ");
