import { uid } from "../utils/uid";

// Fridge magnets: words as tiles on a door. x / y are fractions of the door (top-left of the tile)
// so the door can be any size. rot is a slight tilt in degrees.
const rnd = (a, b) => a + Math.random() * (b - a);
export const tilt = () => Math.round(rnd(-4, 4) * 10) / 10;
export const spot = () => ({ x: rnd(0.04, 0.8), y: rnd(0.05, 0.8) });

export const MAX_WORDS = 120;

export const makeWord = (text, by) => ({ id: uid(), text, ...spot(), rot: tilt(), ...(by ? { by } : {}) });

export const splitWords = (text) => String(text ?? "").split(/\s+/).filter(Boolean);

export const addWords = (state, texts, by) => ({
  ...state,
  words: [...(state.words ?? []), ...texts.map((t) => makeWord(t, by))].slice(-MAX_WORDS),
});

// Left-to-right, top-to-bottom: tiles within a band of the row's first tile count as one row
export function readLine(words, band = 0.1) {
  const byY = [...words].sort((a, b) => a.y - b.y);
  const rows = [];
  for (const w of byY) {
    const row = rows[rows.length - 1];
    if (row && w.y - row[0].y < band) row.push(w);
    else rows.push([w]);
  }
  return rows.map((r) => r.sort((a, b) => a.x - b.x).map((w) => w.text).join(" ")).join("\n");
}

// Datamuse: free, text only. Cached in memory; offline just gives nothing.
const REL = { rhymes: "rel_rhy", "sounds like": "sl", "means like": "ml" };
const cache = new Map();

export const SUGGEST_KINDS = Object.keys(REL);

export async function suggest(kind, word) {
  const w = word.toLowerCase().replace(/[^\p{L}'-]/gu, "");
  if (!w || !REL[kind]) return [];
  const key = `${kind}|${w}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const r = await fetch(`https://api.datamuse.com/words?${REL[kind]}=${encodeURIComponent(w)}&max=14`);
    if (!r.ok) return [];
    const out = (await r.json()).map((x) => x.word).filter((x) => x && x !== w);
    cache.set(key, out);
    return out;
  } catch {
    return [];
  }
}
