// Pasting onto a board: read what's on the clipboard, guess what it is, and
// say which modules could hold it (and how each one takes it in).

import { MODULES, MODULE_TYPES } from "../constants/modules";
import { looksLikeMarkdown, isTextFile, titleOf } from "./markdown";

export const imagesIn = (files) => [...(files ?? [])].filter((f) => f.type.startsWith("image/"));
export const audiosIn = (files) => [...(files ?? [])].filter((f) => f.type.startsWith("audio/") || /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i.test(f.name ?? ""));
// Markdown and plain-text files, read in as words (see withDocs)
export const docsIn = (files) => [...(files ?? [])].filter((f) => !f.type.startsWith("image/") && isTextFile(f));

// What the pointer is over, so a Ctrl+V goes to the thing you're looking at
let under = null;
document.addEventListener("pointerover", (e) => (under = e.target), true);
document.addEventListener("pointerout", (e) => !e.relatedTarget && (under = null), true);
export const pointerTarget = () => under;

// Typing somewhere? Then a paste belongs to that field.
export const typing = () => {
  const el = document.activeElement;
  return !!el && (el.matches("input, textarea, select") || el.isContentEditable);
};

// files = how many files came at all, so files nothing here can hold get a word instead of silence
export const fromEvent = (dt) => ({
  images: imagesIn(dt?.files),
  audios: audiosIn(dt?.files),
  docs: docsIn(dt?.files),
  files: dt?.files?.length ?? 0,
  text: dt?.getData("text/plain") ?? "",
});

// Text files handed over become the words of the paste; the first one's name comes along to name things by
export async function withDocs(clip) {
  if (!clip.docs?.length) return clip;
  const texts = await Promise.all(clip.docs.map((f) => f.text()));
  return { ...clip, text: texts.map((t) => t.replace(/\r\n/g, "\n")).join("\n\n"), fileName: clip.docs[0].name };
}

export async function readClipboard() {
  if (!navigator.clipboard?.read) return { images: [], text: await navigator.clipboard.readText() };
  const images = [];
  let text = "";
  for (const item of await navigator.clipboard.read()) {
    const img = item.types.find((t) => t.startsWith("image/"));
    if (img) images.push(await item.getType(img));
    else if (item.types.includes("text/plain")) text += await (await item.getType("text/plain")).text();
  }
  return { images, text };
}

// ── Links ───────────────────────────────────────────────────────────────────
const isUrl = (s) => /^https?:\/\/\S+$/i.test(s);

const SHOPS = /(^|\.)(amazon|etsy|ebay|shein|asos|depop|poshmark|vinted|zara|uniqlo|target|walmart|aliexpress|temu|grailed|ssense|nordstrom|hm|urbanoutfitters|freepeople|dollskill|killstar|revolve|farfetch|thredup|mercari|bestbuy|ikea)\./i;
const WATCH = /(^|\.)(youtube|youtu|vimeo|tiktok|spotify|soundcloud|bandcamp|twitch)\.|music\.apple\./i;
const TRACKING = /^(utm_|fbclid$|gclid$|igshid$|igsh$|si$|dib|qid$|sr$|keywords$|crid$|sprefix$|ref$|ref_$|pd_rd|pf_rd|_encoding$|th$|psc$|spm$|mc_)/;

// Amazon links shrink to just the product; elsewhere, tracking params go
export function cleanUrl(raw) {
  const u = new URL(raw);
  const asin = /amazon\./.test(u.hostname) && u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
  if (asin) return `${u.origin}/dp/${asin[1]}`;
  [...u.searchParams.keys()].forEach((k) => TRACKING.test(k) && u.searchParams.delete(k));
  return u.toString();
}

export const domainOf = (url) => new URL(url).hostname.replace(/^www\./, "");

// The wordiest part of the path is usually the product or article name
// ("SZIVYSHI-Yellow-Corset-Top-Women"); otherwise just the site
export function titleFrom(url) {
  const u = new URL(url);
  const best = u.pathname
    .split("/")
    .map((s) => { try { return decodeURIComponent(s); } catch { return s; } })
    .filter((s) => /[-_+ ]/.test(s) && /[a-z]{2}/i.test(s))
    .sort((a, b) => b.split(/[-_+ ]/).length - a.split(/[-_+ ]/).length)[0];
  if (!best) return domainOf(url);
  return best.replace(/\.\w{2,5}$/, "").replace(/[-_+]+/g, " ").trim();
}

const linkOf = (raw) => ({ url: cleanUrl(raw), title: titleFrom(raw), domain: domainOf(raw) });

// ── What is it? ─────────────────────────────────────────────────────────────
// → { kind: "image", images } | { kind: "audio", audios } | { kind: "link", site, links }
//   | { kind: "text", lines, text, md, fileName? }  (md = it reads like markdown)
export function classify({ images, audios = [], text, fileName }) {
  if (images.length) return { kind: "image", images };
  if (audios.length) return { kind: "audio", audios };
  const t = text.trim();
  if (!t) return null;
  const words = t.split(/\s+/);
  if (words.every(isUrl)) {
    const links = words.map(linkOf);
    const site = links.every((l) => SHOPS.test(`.${l.domain}`) || /\/(dp|products?|item|listing)\//.test(l.url))
      ? "shop"
      : links.every((l) => WATCH.test(`.${l.domain}`))
        ? "watch"
        : "page";
    return { kind: "link", site, links };
  }
  const md = looksLikeMarkdown(t) || /\.(md|markdown|mdown)$/i.test(fileName ?? "");
  return { kind: "text", text: t, md, fileName, lines: t.split(/\n+/).map((l) => l.trim()).filter(Boolean) };
}

export function describe(p) {
  if (p.kind === "image") return p.images.length > 1 ? `${p.images.length} pictures` : "a picture";
  if (p.kind === "audio") return p.audios.length > 1 ? `${p.audios.length} sound files` : "a sound file";
  if (p.fileName) return `${p.md ? "a markdown file" : "a text file"}, “${p.fileName}”`;
  if (p.md) return "some markdown";
  if (p.kind === "link") {
    const what = { shop: "something to buy", watch: "something to watch or listen to", page: "a page" }[p.site];
    return p.links.length > 1 ? `${p.links.length} links — ${what}` : `a link — ${what}, from ${p.links[0].domain}`;
  }
  if (p.lines.length > 1) return `a list of ${p.lines.length} lines`;
  return p.text.length > 120 ? "a paragraph" : "a line of words";
}

// Which of a module's `accepts` slots a paste lands in
const slotOf = (p) => {
  if (p.kind === "image") return ["image"];
  if (p.kind === "audio") return ["audio"];
  if (p.kind === "link") return ["link", p.site];
  if (p.lines.length > 1) return ["lines"];
  return [p.text.length > 120 ? "paragraph" : "line"];
};

// Which modules fit, best first, with why: each module says what it accepts
// (constants/modules.js), the rank on each says where it sits in the list
export function suggestions(p) {
  const [slot, site] = slotOf(p);
  return MODULE_TYPES.flatMap((type) => {
    const a = MODULES[type].accepts?.[slot];
    const hit = site ? a?.[site] : a;
    if (!hit || (a.single && p.links.length > 1) || hit.when?.(p) === false) return [];
    return [{ type, why: hit.why, rank: hit.rank }];
  })
    .sort((x, y) => x.rank - y.rank)
    .map(({ type, why }) => ({ type, why }));
}

// ── Naming ──────────────────────────────────────────────────────────────────
const SITES = /^(wikipedia|youtube|pinterest|amazon(\.com)?|etsy|reddit|ebay|tiktok|instagram|spotify|soundcloud|vimeo)$/i;

// A page title boiled down to what it's about: no site name, no
// (Official Video), no BRAND or model numbers, five words at most.
// "SZIVYSHI 14-Bone Overbust Corset Top" → "Overbust Corset Top"
export function shortName(title, siteName) {
  if (!title) return null;
  const parts = title
    .replace(/^amazon\.com\s*:\s*/i, "")
    .replace(/[([][^)\]]*[)\]]/g, "")
    .split(/\s+[-|–—:•]\s+/)
    .map((s) => s.trim())
    .filter((s) => s && !SITES.test(s) && s.toLowerCase() !== siteName?.toLowerCase());
  const best = parts.sort((a, b) => b.length - a.length)[0] ?? title;
  const words = best.split(/\s+/).filter((w) => !/\d/.test(w) && !/^[A-Z]{4,}$/.test(w));
  return (words.length ? words : best.split(/\s+/)).slice(0, 5).join(" ").replace(/[,;:.]+$/, "") || null;
}

// What to call a module made from a paste
export function nameFor(type, p) {
  if (p.kind === "image") return null;
  if (p.kind === "audio") return p.audios.length > 1 ? null : p.audios[0].name.replace(/\.\w+$/, "");
  if (type === "markdown") return p.fileName?.replace(/\.\w+$/, "") || titleOf(p.text);
  const topic = p.kind === "link"
    ? (p.links[0].title !== p.links[0].domain ? shortName(p.links[0].title) : null)
    : shortName(p.lines[0]);
  if (!topic) return null;
  // A clipping is the thing itself; a list is about it
  return type === "clipping" || type === "notes" || type === "diary" ? topic : `${topic} · ${type === "links" ? "links" : "list"}`;
}

// ── Taking it in ────────────────────────────────────────────────────────────
// The module's state with the paste added. Images must already be saved
// (p.imageIds); scrapbook photos and diary pages are entries, added by the caller.
export const takeIn = (type, state, p) => MODULES[type]?.takeIn?.(state, p) ?? state;
