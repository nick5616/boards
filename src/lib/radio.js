// The radio's engine: one <audio> element for the whole app, so the station keeps
// playing when you leave the board (the live dock shows it and can stop it).
// Plus the station directory (radio-browser.info) and the little burst of static
// you hear between stations.
//
// On a shared board the switch and the dial are the module's state, so they reach everyone;
// each screen streams the station itself. Whoever is hearing it follows the dial and the
// switch (LiveContext), and says so on the peer bus (radioSync.js) so the card can show who.
import { getAudio } from "./audio";
import { nowPlaying } from "./nowplaying";

export const MAX_FAVS = 6;
export const LOG_MIN = 5; // shorter listens aren't worth a sticker
export const MAX_HEARD = 50; // songs kept on the receipt
const SONG_EVERY = 20000; // how often we ask what's playing

// startedAt / by: when it was switched on, and by whom (uid)
export const radioState = (s = {}) => ({
  lang: "spanish",
  query: "",
  favorites: [],
  station: null,
  heard: [], // songs kept from the radio: { id, artist, title, album?, station, at, by }
  startedAt: null,
  by: null,
  ...s,
});

/* ── The directory ── */

const FALLBACK = ["de1", "fi1", "at1", "nl1"].map((h) => `https://${h}.api.radio-browser.info`);
let servers = null; // resolved once per page load

async function hosts() {
  if (!servers) {
    servers = fetch("https://all.api.radio-browser.info/json/servers")
      .then((r) => r.json())
      .then((list) => {
        const names = [...new Set(list.map((x) => x.name).filter(Boolean))].sort(() => Math.random() - 0.5);
        return [...names.map((n) => `https://${n}`), ...FALLBACK];
      })
      .catch(() => FALLBACK);
  }
  return servers;
}

// Try each server in turn until one answers
async function api(path) {
  let err;
  for (const h of (await hosts()).slice(0, 5)) {
    try {
      const r = await fetch(h + path);
      if (r.ok) return await r.json();
    } catch (e) {
      err = e;
    }
  }
  throw err ?? new Error("no radio directory");
}

export async function findStations({ lang, query }) {
  const p = new URLSearchParams({
    order: "clickcount",
    reverse: "true",
    limit: "40",
    hidebroken: "true",
    is_https: "true",
  });
  if (lang.trim()) p.set("language", lang.trim().toLowerCase());
  if (query.trim()) p.set("name", query.trim());
  const rows = await api(`/json/stations/search?${p}`);
  const seen = new Set();
  return rows
    .filter((r) => r.url_resolved?.startsWith("https:"))
    .map((r) => ({
      id: r.stationuuid,
      name: r.name.trim().replace(/\s+/g, " "),
      url: r.url_resolved,
      favicon: r.favicon || "",
      country: r.country || "",
      language: r.language || "",
      homepage: r.homepage || "",
    }))
    .filter((s) => s.name && !seen.has(s.name.toLowerCase()) && seen.add(s.name.toLowerCase()))
    .slice(0, 30);
}

// Their etiquette: tell them a station was played (it feeds their popularity chart)
const reportClick = (id) =>
  hosts()
    .then((hs) => fetch(`${hs[0]}/json/url/${id}`).catch(() => {}))
    .catch(() => {});

/* ── Static ── */

// A short crackle of filtered white noise, quiet. Nothing if sound isn't unlocked yet.
export function staticBurst(dur = 0.22) {
  const a = getAudio();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.08 ? 1 : 0.35); // hiss with pops
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 2800;
  const g = a.createGain();
  const t = a.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.02);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

/* ── The player ── */

// snap: { boardId, modId, id, status: "idle" | "tuning" | "on" | "dead", song, asked, since } (a new object on each change)
//   song  - what's playing, { artist, title, album?, source }, once known
//   asked - true once we've had an answer, even "the station doesn't say"
//   since - when this screen started hearing this radio (turning the dial doesn't reset it)
const IDLE = { boardId: null, modId: null, id: null, status: "idle", song: null, asked: false, since: 0 };
let snap = IDLE;
const listeners = new Set();
const set = (p) => {
  snap = { ...snap, ...p };
  listeners.forEach((l) => l());
};
export const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const radioSnap = () => snap;

let el = null;
let giveUp = null;
let songTimer = null;

// The volume is this screen's own: someone turning a shared radio up shouldn't make it louder on your phone
const VOL_KEY = "boards:radio-volume";
let volume = (() => {
  try {
    const v = parseFloat(localStorage.getItem(VOL_KEY));
    return v >= 0 && v <= 1 ? v : 0.7;
  } catch {
    return 0.7;
  }
})();
export const radioVolume = () => volume;

// Ask what's playing now and every so often after, for as long as this station is on.
// It lives here, not in the card, so it carries on while you're on another board.
function watchSong(station) {
  clearInterval(songTimer);
  const ask = () => {
    if (snap.id !== station.id || snap.status === "idle" || snap.status === "dead") return;
    nowPlaying(station).then((song) => {
      // They may have turned the dial while we waited
      if (snap.id === station.id && snap.status !== "idle") set({ song, asked: true });
    });
  };
  ask();
  songTimer = setInterval(ask, SONG_EVERY);
}

function dead() {
  clearTimeout(giveUp);
  clearInterval(songTimer);
  if (snap.status === "idle" || snap.status === "dead") return;
  set({ status: "dead" });
}

function audio() {
  if (el) return el;
  el = new Audio();
  el.preload = "none";
  el.addEventListener("playing", () => {
    clearTimeout(giveUp);
    if (snap.status !== "idle") set({ status: "on" });
  });
  el.addEventListener("error", () => {
    if (el.getAttribute("src")) dead();
  });
  return el;
}

export function playStation(boardId, modId, station) {
  const a = audio();
  clearTimeout(giveUp);
  a.volume = volume;
  a.src = station.url;
  const since = snap.modId === modId && snap.status !== "idle" ? snap.since : Date.now();
  set({ boardId, modId, id: station.id, status: "tuning", song: null, asked: false, since });
  watchSong(station);
  a.play().catch((e) => {
    // A blocked autoplay isn't a dead station; anything else is
    if (e?.name !== "NotAllowedError" && e?.name !== "AbortError") dead();
  });
  giveUp = setTimeout(dead, 12000); // nothing but silence
  reportClick(station.id);
}

export function stopAudio() {
  clearTimeout(giveUp);
  clearInterval(songTimer);
  if (el) {
    el.pause();
    el.removeAttribute("src");
    el.load();
  }
  set(IDLE);
}

export function setRadioVolume(v) {
  volume = v;
  if (el) el.volume = v;
  try {
    localStorage.setItem(VOL_KEY, String(v));
  } catch {
    /* private mode: it just won't be remembered */
  }
}

/* ── Start / stop (the dock calls these too) ── */

const patchMod = (updateBoard, boardId, modId, fn) =>
  updateBoard(boardId, (b) => ({
    ...b,
    modules: b.modules.map((m) => (m.id === modId ? { ...m, state: fn(radioState(m.state)) } : m)),
  }));

export const startRadio = ({ updateBoard, uid }, boardId, modId) =>
  patchMod(updateBoard, boardId, modId, (s) => ({ ...s, startedAt: Date.now(), by: uid ?? null }));

// How many minutes of this radio are mine to log. On a shared board I may have tuned in after
// someone else switched it on (count from when I did), or be switching off one I'm not hearing
// (count it only if I'm the one who switched it on).
function myMins(uid, modId, s) {
  const from = s.startedAt && (!s.by || s.by === uid) ? s.startedAt : snap.modId === modId ? snap.since : 0;
  return from ? Math.round(Math.max(0, Date.now() - from) / 60000) : 0;
}

// → true if it went on the chart
function logMins({ logPractice, undoLog, toast }, boardId, modId, s, mins, why = "") {
  if (mins < LOG_MIN) return false; // a quick listen isn't practice
  const name = s.station?.name ?? "the radio";
  const entry = logPractice(boardId, `📻 listened ${mins} min — ${name}`, { mins, moduleId: modId });
  toast({ text: `${why}${mins} min of listening on the chart ✓`, actions: [{ label: "undo", run: () => undoLog(entry) }] });
  return true;
}

// state is the module's state; log=false just switches it off (for everyone listening)
export function stopRadio(data, boardId, modId, state, log) {
  const s = radioState(state);
  const mins = myMins(data.uid, modId, s);
  if (snap.modId === modId || snap.modId === null) stopAudio();
  patchMod(data.updateBoard, boardId, modId, (m) => ({ ...m, startedAt: null, by: null }));
  if (log) logMins(data, boardId, modId, s, mins);
}

// Stop hearing it on this screen only: the radio stays on for whoever else is listening.
// Also how a listener lets go when someone else switches it off (why says so on the toast).
// → true if the listen went on the chart
export function leaveRadio(data, boardId, modId, state, why) {
  if (snap.modId !== modId) return false;
  const s = radioState(state);
  const mins = myMins(data.uid, modId, s);
  stopAudio();
  return logMins(data, boardId, modId, s, mins, why);
}
