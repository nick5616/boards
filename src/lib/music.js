// The music pack's plain logic: lyric lines, the record-crate lookups, Last.fm calls and
// chord shapes. Kept out of the components so it can be tested with a quick node script.
import { cachedJSON, HOUR, DAY, MIN } from "./apis";

// ── Lyrics (LRCLIB: no key, CORS open) ───────────────────────────────────────

// "Queen – Under Pressure" / "Under Pressure by Queen" → a search string
export const songQuery = (line) =>
  (line ?? "").replace(/\s+[–—-]\s+/g, " ").replace(/\s+by\s+/i, " ").replace(/\s+/g, " ").trim();

export async function searchLyrics(q) {
  const url = `https://lrclib.net/api/search?q=${encodeURIComponent(songQuery(q))}`;
  const { data } = await cachedJSON(url, { ttl: DAY });
  const seen = new Set();
  return (Array.isArray(data) ? data : [])
    .filter((r) => !r.instrumental && (r.plainLyrics || r.syncedLyrics))
    .filter((r) => {
      const k = `${r.trackName}|${r.artistName}`.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      title: r.trackName,
      artist: r.artistName,
      album: r.albumName || "",
      duration: Math.round(r.duration || 0),
      plain: r.plainLyrics || stripTimes(r.syncedLyrics),
      synced: r.syncedLyrics || "",
    }));
}

const stripTimes = (lrc) => (lrc ?? "").replace(/^\s*\[[^\]]*\]\s?/gm, "");

// "[01:23.45] words" lines → [{ t: seconds, text }] sorted by time
export function parseLrc(lrc) {
  const out = [];
  for (const raw of (lrc ?? "").split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    for (const s of stamps) out.push({ t: Number(s[1]) * 60 + Number(s[2]), text });
  }
  return out.sort((a, b) => a.t - b.t);
}

// Index of the line being sung at `sec` (-1 before the first line)
export function lineAt(lines, sec) {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= sec) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

// Lines worth memorizing: non-empty, as { text, key } (key = same line sung twice counts once)
export const lineKey = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export function songLines(song) {
  if (!song) return [];
  const src = song.synced ? parseLrc(song.synced).map((l) => l.text) : (song.plain ?? "").split(/\r?\n/);
  return src.map((t) => t.trim()).filter(Boolean).map((text) => ({ text, key: lineKey(text) }));
}

// { got, total } for the "memorized 12/40 lines" glance
export function memorized(state) {
  const keys = new Set(songLines(state.song).map((l) => l.key));
  const mem = new Set(state.mem ?? []);
  let got = 0;
  keys.forEach((k) => mem.has(k) && got++);
  return { got, total: keys.size };
}

// ── Record crate (MusicBrainz + Cover Art Archive + iTunes previews) ─────────

// MusicBrainz asks for at most one request a second, so ours queue up a beat apart
let mbTail = Promise.resolve();
let mbLast = 0;
function mbSlot() {
  const mine = mbTail.then(async () => {
    const wait = mbLast + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    mbLast = Date.now();
  });
  mbTail = mine.catch(() => {});
  return mine;
}

async function mbGet(url, ttl) {
  // cached answers skip the queue entirely
  try {
    const hit = localStorage.getItem("boards-api:" + url);
    if (hit && Date.now() - JSON.parse(hit).at < ttl) return (await cachedJSON(url, { ttl })).data;
  } catch { /* fine */ }
  await mbSlot();
  return (await cachedJSON(url, { ttl })).data;
}

const creditOf = (ac) => (ac ?? []).map((c) => (c.name ?? c.artist?.name ?? "") + (c.joinphrase ?? "")).join("").trim();

export async function searchAlbums(q) {
  const url = `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(q.trim())}&fmt=json&limit=12`;
  const data = await mbGet(url, 7 * DAY);
  return (data["release-groups"] ?? [])
    .filter((g) => ["Album", "EP", "Single"].includes(g["primary-type"]) && !(g["secondary-types"] ?? []).some((t) => /live|compilation|remix|dj-mix|mixtape|demo/i.test(t)))
    .slice(0, 8)
    .map((g) => ({
      mbid: g.id,
      title: g.title,
      artist: creditOf(g["artist-credit"]),
      year: (g["first-release-date"] ?? "").slice(0, 4),
    }));
}

// The best-known album by an artist (for "similar artist → crate")
export async function topAlbumBy(artist) {
  const q = `artist:"${artist.replace(/"/g, "")}" AND primarytype:album AND status:official`;
  const hits = await searchAlbums(q);
  return hits.find((h) => h.artist.toLowerCase() === artist.toLowerCase()) ?? hits[0] ?? null;
}

export const coverUrl = (mbid) => `https://coverartarchive.org/release-group/${mbid}/front-250`;

// A 30-second preview from the iTunes Search API (it sends CORS headers). null if none found.
export async function findPreview(artist, title) {
  const term = encodeURIComponent(`${artist} ${title}`);
  const url = `https://itunes.apple.com/search?term=${term}&entity=song&limit=10`;
  const { data } = await cachedJSON(url, { ttl: DAY });
  const want = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const rows = (data?.results ?? []).filter((r) => r.previewUrl);
  const pick = rows.find((r) => (r.collectionName ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").includes(want)) ?? rows[0];
  return pick ? { url: pick.previewUrl, track: pick.trackName, album: pick.collectionName } : null;
}

// The record at the front of the crate: what "next up" means
export const crateNext = (state) => {
  const c = state.crate ?? [];
  return c[Math.min(state.idx ?? 0, c.length - 1)] ?? null;
};

// ── Last.fm (key needed; CORS open) ──────────────────────────────────────────

const LFM = "https://ws.audioscrobbler.com/2.0/";

// A friendly line for Last.fm's numbered errors (https://www.last.fm/api/errorcodes)
const lfmWords = (code, fallback) =>
  ({
    6: "Last.fm doesn't know that username",
    10: "that Last.fm key doesn't look right",
    26: "that Last.fm key has been suspended",
    29: "Last.fm says slow down; try again in a minute",
    8: "Last.fm is having a moment; try again soon",
    11: "Last.fm is offline for a bit",
    16: "Last.fm is having a moment; try again soon",
    17: "that listener keeps their history private",
  })[code] ?? fallback ?? "couldn't read Last.fm";

export async function lastfm(method, params, key, ttl = 5 * MIN, force = false) {
  const qs = new URLSearchParams({ method, ...params, api_key: key, format: "json" });
  const url = `${LFM}?${qs}`;
  let data;
  try {
    ({ data } = await cachedJSON(url, { ttl, key: `lfm:${method}:${JSON.stringify(params)}`, force }));
  } catch (err) {
    // Last.fm explains errors in the body of a 4xx; read it for a better message
    try {
      const body = await (await fetch(url)).json();
      if (body?.error) throw new Error(lfmWords(body.error, body.message));
    } catch (e2) {
      if (e2 instanceof SyntaxError || e2 instanceof TypeError) throw new Error("couldn't reach Last.fm");
      throw e2;
    }
    throw err;
  }
  if (data?.error) throw new Error(lfmWords(data.error, data.message));
  return data;
}

const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);

export async function recentTracks(user, key, force) {
  const d = await lastfm("user.getrecenttracks", { user, limit: "12" }, key, 2 * MIN, force);
  return arr(d?.recenttracks?.track).map((t) => ({
    name: t.name,
    artist: t.artist?.["#text"] ?? t.artist?.name ?? "",
    album: t.album?.["#text"] ?? "",
    playing: t["@attr"]?.nowplaying === "true",
    at: t.date?.uts ? Number(t.date.uts) * 1000 : null,
  }));
}

export async function weeklyArtists(user, key, force) {
  const d = await lastfm("user.gettopartists", { user, period: "7day", limit: "6" }, key, HOUR, force);
  return arr(d?.topartists?.artist).map((a) => ({ name: a.name, plays: Number(a.playcount) || 0 }));
}

export async function similarArtists(artist, key) {
  const d = await lastfm("artist.getsimilar", { artist, limit: "6", autocorrect: "1" }, key, DAY);
  return arr(d?.similarartists?.artist).map((a) => a.name);
}

// ── Chords (computed locally) ────────────────────────────────────────────────

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const QUALITY = {
  "": "maj", maj: "maj", M: "maj",
  m: "m", min: "m", "-": "m",
  7: "7", dom7: "7",
  m7: "m7", min7: "m7", "-7": "m7",
  maj7: "maj7", M7: "maj7", "Δ": "maj7", "Δ7": "maj7",
  sus2: "sus2", sus4: "sus4", sus: "sus4",
  dim: "dim", "°": "dim",
};
const SUFFIX = { maj: "", m: "m", 7: "7", m7: "m7", maj7: "maj7", sus2: "sus2", sus4: "sus4", dim: "dim" };

// "Am7" → { root: 9, q: "m7", name: "Am7" }; null when it isn't a chord we know
export function parseChord(tok) {
  const m = /^([A-Ga-g])([#b♯♭]?)([^/]*)(?:\/([A-Ga-g][#b♯♭]?))?$/.exec(tok.trim());
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const acc = m[2] === "#" || m[2] === "♯" ? 1 : m[2] === "b" || m[2] === "♭" ? -1 : 0;
  const q = QUALITY[m[3]];
  if (q == null) return null;
  const root = (SEMI[letter] + acc + 12) % 12;
  const base = (acc < 0 ? FLATS : SHARPS)[root];
  return { root, q, name: base + SUFFIX[q] + (m[4] ? `/${m[4][0].toUpperCase()}${m[4].slice(1)}` : "") };
}

export const parseProgression = (text) =>
  (text ?? "").split(/[\s,|]+/).filter((t) => t && !/^[-–—>→]+$/.test(t)).map((t) => ({ tok: t, chord: parseChord(t) }));

// Shapes are fret numbers per string (-1 = don't play), low string first.
// Guitar: strings E A D G B e. Open chords are written out; the rest slide a barre
// shape (E-shape or A-shape) up the neck.
const G_OPEN = {
  "0maj": [-1, 3, 2, 0, 1, 0], "0maj7": [-1, 3, 2, 0, 0, 0], "07": [-1, 3, 2, 3, 1, 0],
  "7maj": [3, 2, 0, 0, 0, 3], "7maj7": [3, 2, 0, 0, 0, 2], "77": [3, 2, 0, 0, 0, 1],
  "2maj": [-1, -1, 0, 2, 3, 2], "2m": [-1, -1, 0, 2, 3, 1], "27": [-1, -1, 0, 2, 1, 2],
  "2maj7": [-1, -1, 0, 2, 2, 2], "2sus2": [-1, -1, 0, 2, 3, 0], "2sus4": [-1, -1, 0, 2, 3, 3],
  "2m7": [-1, -1, 0, 2, 1, 1],
  "5maj7": [-1, -1, 3, 2, 1, 0],
};
const G_E = {
  maj: [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], 7: [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0], sus4: [0, 2, 2, 2, 0, 0],
};
const G_A = {
  maj: [-1, 0, 2, 2, 2, 0], m: [-1, 0, 2, 2, 1, 0], 7: [-1, 0, 2, 0, 2, 0], m7: [-1, 0, 2, 0, 1, 0],
  maj7: [-1, 0, 2, 1, 2, 0], sus2: [-1, 0, 2, 2, 0, 0], sus4: [-1, 0, 2, 2, 3, 0], dim: [-1, 0, 1, 2, 1, -1],
};
// Ukulele: strings G C E A. Movable C-shapes and A-shapes, whichever sits lower on the neck.
const U_A = {
  maj: [2, 1, 0, 0], m: [2, 0, 0, 0], 7: [0, 1, 0, 0], m7: [0, 0, 0, 0], maj7: [1, 1, 0, 0], sus4: [2, 2, 0, 0],
};
const U_C = {
  maj: [0, 0, 0, 3], m: [0, 3, 3, 3], 7: [0, 0, 0, 1], m7: [3, 3, 3, 3],
  maj7: [0, 0, 0, 2], sus2: [0, 2, 3, 3], sus4: [0, 0, 1, 3],
};
const U_OPEN = {
  "2maj": [2, 2, 2, 0], "2m": [2, 2, 1, 0], "27": [2, 2, 2, 3], "4maj": [4, 4, 4, 2], "4m": [0, 4, 3, 2],
  "5maj": [2, 0, 1, 0], "5m": [1, 0, 1, 3], "7maj": [0, 2, 3, 2], "7m": [0, 2, 3, 1], "77": [0, 2, 1, 2],
  "9maj": [2, 1, 0, 0], "9m": [2, 0, 0, 0], "97": [0, 1, 0, 0], "11maj": [4, 3, 2, 2], "11m": [4, 2, 2, 2],
  "0maj": [0, 0, 0, 3], "0m": [0, 3, 3, 3],
};

// → { frets, base (first fret drawn), barre: { fret, from, to } | null } or null
export function shapeFor(chord, inst = "guitar") {
  if (!chord) return null;
  const { root, q } = chord;
  let frets = null;
  let barre = null;
  const slide = (shape, by) => {
    frets = shape.map((f) => (f < 0 ? -1 : f + by));
    if (by > 0 && shape.filter((f) => f === 0).length >= 2) {
      const live = shape.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
      const zeros = shape.map((f, i) => (f === 0 ? i : -1)).filter((i) => i >= 0);
      barre = { fret: by, from: Math.min(...zeros), to: live[live.length - 1] };
    }
  };
  if (inst === "ukulele") {
    const open = U_OPEN[`${root}${q === "maj" || q === "m" || q === "7" ? q : "?"}`];
    if (open) frets = open;
    else {
      const c = U_C[q] && root;
      const a = U_A[q] && (root - 9 + 12) % 12;
      if (c != null && (a == null || c <= a)) slide(U_C[q], c);
      else if (a != null) slide(U_A[q], a);
    }
  } else {
    const open = G_OPEN[`${root}${q}`];
    if (open) frets = open;
    else {
      const e = G_E[q] && (root - 4 + 12) % 12;
      const a = G_A[q] && (root - 9 + 12) % 12;
      if (e != null && (a == null || e <= a + 1)) slide(G_E[q], e);
      else if (a != null) slide(G_A[q], a);
    }
  }
  if (!frets) return null;
  const used = frets.filter((f) => f > 0);
  const top = used.length ? Math.max(...used) : 0;
  const base = top > 4 ? Math.min(...used) : 1;
  return { frets, base, barre };
}

const OPEN_MIDI = { guitar: [40, 45, 50, 55, 59, 64], ukulele: [67, 60, 64, 69] };

// MIDI notes to strum, low to high
export function chordNotes(shape, inst = "guitar") {
  const open = OPEN_MIDI[inst];
  return shape.frets.map((f, i) => (f < 0 ? null : open[i] + f)).filter((n) => n != null);
}

// A pasted line made only of chord names ("Am F C G") is a progression
export const chordLine = (line) => {
  const p = parseProgression(line);
  return p.length >= 2 && p.every((x) => x.chord);
};
