// Paperback: find a public-domain book on Project Gutenberg (via Gutendex: free, no key,
// CORS) and read it a few pages a day.
//
// Gutenberg's own text files don't send a CORS header, so the browser can't fetch the
// book itself. So the book text comes from a .txt file the person saves from Gutenberg
// (or pastes), is kept in this browser's IndexedDB (never uploaded), and the state keeps
// only the bookmark. Without the text a book is still tracked by hand with a page counter.
import { cachedJSON, DAY } from "./apis";
import { dayKey, addDays } from "../utils/date";

export const PAGE_CHARS = 1300; // about a paperback page at the module's type size

export async function searchGutenberg(q) {
  const { data } = await cachedJSON(`https://gutendex.com/books/?search=${encodeURIComponent(q)}`, { ttl: DAY });
  return (data?.results ?? []).slice(0, 8).map((b) => ({
    gid: b.id,
    title: b.title,
    author: (b.authors?.[0]?.name ?? "").replace(/^([^,]+),\s*(.+)$/, "$2 $1"),
    downloads: b.download_count ?? 0,
    read: b.formats?.["text/html"] ?? `https://www.gutenberg.org/ebooks/${b.id}`,
    txt: `https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.txt`,
    cover: b.formats?.["image/jpeg"] ?? null,
  }));
}

// Drop Gutenberg's licence header and footer, tidy line breaks into paragraphs
export function cleanText(raw) {
  let t = String(raw ?? "").replace(/\r\n?/g, "\n");
  const a = /\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\n/i.exec(t);
  if (a) t = t.slice(a.index + a[0].length);
  const z = /\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG/i.exec(t);
  if (z) t = t.slice(0, z.index);
  return t.trim();
}

// Cut the text into pages of about `size` characters, breaking at paragraph ends
// (or a space, for a monster paragraph) so a page never ends mid-word.
export function paginate(text, size = PAGE_CHARS) {
  const paras = text.split(/\n{2,}/).map((p) => p.replace(/\n(?!\n)/g, " ").replace(/ {2,}/g, " ").trim()).filter(Boolean);
  const pages = [];
  let cur = "";
  const flush = () => { if (cur) pages.push(cur); cur = ""; };
  for (let p of paras) {
    while (p.length > size) {
      let cut = p.lastIndexOf(" ", size);
      if (cut < size / 2) cut = size;
      if (cur) flush();
      pages.push(p.slice(0, cut));
      p = p.slice(cut).trim();
    }
    if (cur && cur.length + p.length + 2 > size) flush();
    cur = cur ? `${cur}\n\n${p}` : p;
  }
  flush();
  return pages;
}

// ── Days & streak ───────────────────────────────────────────────────────────
// days: { "YYYY-MM-DD": pages read that day }
export const todayPages = (days, today = dayKey()) => days?.[today] ?? 0;

// Consecutive days with at least a page read, counting back from today (or yesterday,
// so the streak doesn't read 0 first thing in the morning)
export function streakOf(days, now = new Date()) {
  let d = now;
  if (!days?.[dayKey(d)]) d = addDays(d, -1);
  let n = 0;
  while (days?.[dayKey(d)] > 0) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// Keep only the last ~100 days so the state stays small
export function trimDays(days, keep = 100, now = new Date()) {
  const oldest = dayKey(addDays(now, -keep));
  return Object.fromEntries(Object.entries(days ?? {}).filter(([k]) => k >= oldest));
}

export const addToday = (days, n, today = dayKey()) =>
  trimDays({ ...(days ?? {}), [today]: Math.max(0, (days?.[today] ?? 0) + n) });

// Estimated days left at the daily goal: null if we don't know the length
export function daysToFinish(book, goal) {
  if (!book.pages || !goal) return null;
  return Math.max(0, Math.ceil((book.pages - (book.page ?? 0)) / goal));
}

export const currentBook = (state) =>
  (state.books ?? []).find((b) => b.id === state.cur && b.status !== "read") ??
  (state.books ?? []).filter((b) => b.status !== "read").sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0))[0] ??
  null;

// The home Glance line over all paperback modules' states
export function glanceFor(states) {
  const b = states
    .map(currentBook)
    .filter((x) => x && (x.page ?? 0) > 0)
    .sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0))[0];
  return b ? `📕 p. ${b.page} of ${b.title}` : null;
}
