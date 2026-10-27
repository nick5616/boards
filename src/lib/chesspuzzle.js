// Lichess puzzles, straight from the browser (no key; CORS is open).
// The API sends the game's PGN and the puzzle's solution as UCI moves ("e2e4"). The PGN is
// replayed up to puzzle.initialPly (the last move before the puzzle starts), and the
// solution then alternates: the person's move, the opponent's reply, and so on.
import { Chess } from "chess.js";
import { cachedJSON, HOUR } from "./apis";
import { dayKey, keyToDate } from "../utils/date";

const DAILY = "https://lichess.org/api/puzzle/daily";
const NEXT = "https://lichess.org/api/puzzle/next";

export const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

export const uciParts = (u) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });

// A raw API answer → { id, rating, themes, fen, solution, last, daily }, or throws
export function buildPuzzle(raw, daily = false) {
  const pz = raw?.puzzle;
  if (!pz?.solution?.length || !raw?.game?.pgn) throw new Error("odd puzzle");
  const c = new Chess();
  c.loadPgn(raw.game.pgn);
  const moves = c.history({ verbose: true });
  const g = new Chess();
  let last = null;
  moves.slice(0, (pz.initialPly ?? moves.length - 1) + 1).forEach((m) => { last = g.move(m.san); });
  return {
    id: pz.id,
    rating: pz.rating,
    themes: pz.themes ?? [],
    fen: g.fen(),
    solution: pz.solution,
    last: last ? { from: last.from, to: last.to } : null,
    daily,
  };
}

export async function dailyPuzzle(force = false) {
  const r = await cachedJSON(DAILY, { ttl: 3 * HOUR, force });
  return buildPuzzle(r.data, true);
}

// A fresh random one (needs no login; never cached)
export async function anotherPuzzle() {
  const res = await fetch(NEXT);
  if (!res.ok) throw new Error("puzzle");
  return buildPuzzle(await res.json(), false);
}

// Try the person's move against the solution at step `idx`.
// → { ok, san, fen, done, reply? }  (ok false = not it; a mate-in-one other than the book move also counts)
export function tryMove(puz, fen, idx, from, to, promo) {
  const g = new Chess(fen);
  let mv;
  try { mv = g.move({ from, to, promotion: promo || "q" }); } catch { return { ok: false, illegal: true }; }
  if (!mv) return { ok: false, illegal: true };
  const want = puz.solution[idx];
  const same = want && mv.from + mv.to === want.slice(0, 4) && (!want[4] || want[4] === mv.promotion);
  if (!same && !g.isCheckmate()) return { ok: false, san: mv.san };
  const finished = g.isCheckmate() || idx + 1 >= puz.solution.length;
  return { ok: true, san: mv.san, fen: g.fen(), move: { from: mv.from, to: mv.to }, done: finished };
}

// The opponent's scripted reply at step `idx`
export function replyMove(fen, uci) {
  const g = new Chess(fen);
  const { from, to, promotion } = uciParts(uci);
  const mv = g.move({ from, to, promotion });
  return { fen: g.fen(), move: { from: mv.from, to: mv.to }, san: mv.san };
}

// Streak of days solved. `lastSolved` is a day key; it counts while it's today or yesterday.
export function liveStreak(state, now = new Date()) {
  const { streak = 0, lastSolved = null } = state ?? {};
  if (!lastSolved || !streak) return 0;
  const gap = Math.round((keyToDate(dayKey(now)) - keyToDate(lastSolved)) / 86400000);
  return gap <= 1 ? streak : 0;
}

export const solvedToday = (state, now = new Date()) => state?.lastSolved === dayKey(now);

// After solving the daily puzzle: bump the streak once per day
export function withSolved(state, now = new Date()) {
  const today = dayKey(now);
  if (state.lastSolved === today) return state;
  const streak = liveStreak(state, now) + 1;
  return { ...state, streak, best: Math.max(state.best ?? 0, streak), lastSolved: today };
}

export function glanceLine(mods, now = new Date()) {
  const m = mods[0];
  if (!m) return null;
  const s = liveStreak(m.state, now);
  if (solvedToday(m.state, now)) return `♞ ${s}-day streak`;
  return s > 1 ? `♞ today's puzzle waiting · ${s}-day streak` : "♞ today's puzzle waiting";
}
