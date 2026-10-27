// Open Trivia DB (no key, CORS open). Its rules: one request per 5 seconds per IP, and a
// session token so the same question doesn't come twice. Text arrives URL-encoded
// (encode=url3986) because the default encoding is full of HTML entities.

export const CATEGORIES = [
  { id: 0, name: "Anything", icon: "🎲" },
  { id: 9, name: "General", icon: "💡" },
  { id: 17, name: "Science & nature", icon: "🔬" },
  { id: 22, name: "Geography", icon: "🌍" },
  { id: 23, name: "History", icon: "🏛" },
  { id: 11, name: "Film", icon: "🎬" },
  { id: 14, name: "Television", icon: "📺" },
  { id: 12, name: "Music", icon: "🎵" },
  { id: 15, name: "Video games", icon: "🎮" },
  { id: 10, name: "Books", icon: "📚" },
  { id: 27, name: "Animals", icon: "🐾" },
  { id: 21, name: "Sports", icon: "⚽" },
  { id: 20, name: "Mythology", icon: "⚡" },
  { id: 25, name: "Art", icon: "🎨" },
  { id: 18, name: "Computers", icon: "💻" },
];
export const catName = (id) => CATEGORIES.find((c) => c.id === id)?.name ?? "Anything";

const GAP = 5200; // a little over 5 seconds between requests
const TOKEN = "boards-trivia-token";
const LASTCALL = "boards-trivia-last";
let queue = Promise.resolve();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readLast = () => { try { return Number(localStorage.getItem(LASTCALL)) || 0; } catch { return 0; } };

// Every call waits its turn so we stay under the limit, even across modules and reloads
function polite(url) {
  const run = async () => {
    const wait = readLast() + GAP - Date.now();
    if (wait > 0) await sleep(wait);
    try { localStorage.setItem(LASTCALL, String(Date.now())); } catch { /* fine */ }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

async function getToken(fresh) {
  try { const t = !fresh && localStorage.getItem(TOKEN); if (t) return t; } catch { /* fine */ }
  const j = await polite("https://opentdb.com/api_token.php?command=request");
  try { localStorage.setItem(TOKEN, j.token); } catch { /* fine */ }
  return j.token;
}

const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};

// → [{ q, answers: [..4], right: index, difficulty, category }]
export async function fetchRound(category = 0, amount = 10, tries = 0) {
  let token = null;
  try { token = await getToken(tries > 0); } catch { /* play without one */ }
  const url = `https://opentdb.com/api.php?amount=${amount}&type=multiple&encode=url3986` +
    (category ? `&category=${category}` : "") + (token ? `&token=${token}` : "");
  const j = await polite(url);
  // 3 token unknown, 4 token has seen everything: get a fresh one. 5 slow down. 1 too few left.
  if ([3, 4].includes(j.response_code) && tries < 2) {
    try { localStorage.removeItem(TOKEN); } catch { /* fine */ }
    return fetchRound(category, amount, tries + 1);
  }
  if (j.response_code === 5 && tries < 2) { await sleep(GAP); return fetchRound(category, amount, tries + 1); }
  if (j.response_code === 1 && amount > 5 && tries < 3) return fetchRound(category, Math.max(5, amount - 3), tries + 1);
  if (j.response_code !== 0 || !j.results?.length) throw new Error("no questions");
  return j.results.map((r) => {
    const right = dec(r.correct_answer);
    const answers = shuffle([right, ...r.incorrect_answers.map(dec)]);
    return { q: dec(r.question), answers, right: answers.indexOf(right), difficulty: r.difficulty, category: dec(r.category) };
  });
}

// ── score history ──
export const WEEK = 7 * 86400000;
export const roundsThisWeek = (state, now = Date.now()) => (state.rounds ?? []).filter((r) => now - r.at < WEEK);
export const bestThisWeek = (state, now) => {
  const rs = roundsThisWeek(state, now);
  return rs.length ? rs.reduce((a, r) => (r.score / r.of > a.score / a.of ? r : a)) : null;
};
export function glanceLine(mods, now = Date.now()) {
  const best = mods.map((m) => bestThisWeek(m.state, now)).filter(Boolean)
    .sort((a, b) => b.score / b.of - a.score / a.of)[0];
  return best ? `🔔 trivia best ${best.score}/${best.of} this week` : null;
}
