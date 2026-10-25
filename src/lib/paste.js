// Pasting onto a board: read what's on the clipboard, guess what it is, and
// say which modules could hold it (and how each one takes it in).

import { uid } from "../utils/uid";

export const imagesIn = (files) => [...(files ?? [])].filter((f) => f.type.startsWith("image/"));

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

export const fromEvent = (dt) => ({ images: imagesIn(dt?.files), text: dt?.getData("text/plain") ?? "" });

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
// → { kind: "image", images } | { kind: "link", site, links } | { kind: "text", lines, text }
export function classify({ images, text }) {
  if (images.length) return { kind: "image", images };
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
  return { kind: "text", text: t, lines: t.split(/\n+/).map((l) => l.trim()).filter(Boolean) };
}

export function describe(p) {
  if (p.kind === "image") return p.images.length > 1 ? `${p.images.length} pictures` : "a picture";
  if (p.kind === "link") {
    const what = { shop: "something to buy", watch: "something to watch or listen to", page: "a page" }[p.site];
    return p.links.length > 1 ? `${p.links.length} links — ${what}` : `a link — ${what}, from ${p.links[0].domain}`;
  }
  if (p.lines.length > 1) return `a list of ${p.lines.length} lines`;
  return p.text.length > 120 ? "a paragraph" : "a line of words";
}

// Which modules fit, best first, with why
export function suggestions(p) {
  if (p.kind === "image") {
    return [
      { type: "scrapbook", why: "pin it up as a polaroid" },
      { type: "notes", why: "drop it into a page of notes" },
    ];
  }
  if (p.kind === "link") {
    const card = p.links.length === 1
      ? [{ type: "clipping", why: { shop: "the full card: picture, price & all", watch: "the full card, and it plays right there", page: "the full card: picture, title & blurb" }[p.site] }]
      : [];
    return [...card, ...{
      shop: [
        { type: "wishlist", why: "on the list, to maybe get" },
        { type: "links", why: "just a tag, with the others you're looking at" },
        { type: "nextup", why: "look into it next" },
      ],
      watch: [
        { type: "links", why: "save it to come back to" },
        { type: "setlist", why: "a track on the mixtape" },
        { type: "nextup", why: "watch it next" },
      ],
      page: [
        { type: "links", why: "tie a tag on it" },
        { type: "nextup", why: "read it next" },
        { type: "wishlist", why: "on the list" },
      ],
    }[p.site]];
  }
  if (p.lines.length > 1) {
    return [
      { type: "notes", why: "keep it as a page" },
      { type: "nextup", why: "a sticky note per line" },
      { type: "wishlist", why: "one item per line" },
      { type: "setlist", why: "a track per line" },
    ];
  }
  if (p.text.length > 120) {
    return [
      { type: "notes", why: "keep it as a page" },
      { type: "diary", why: "today's diary page" },
      { type: "fortune", why: "something worth hearing again" },
    ];
  }
  return [
    { type: "nextup", why: "a sticky note" },
    { type: "fortune", why: "something worth hearing again" },
    { type: "wishlist", why: "on the list" },
    { type: "notes", why: "a note" },
  ];
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
  const topic = p.kind === "link"
    ? (p.links[0].title !== p.links[0].domain ? shortName(p.links[0].title) : null)
    : shortName(p.lines[0]);
  if (!topic) return null;
  // A clipping is the thing itself; a list is about it
  return type === "clipping" || type === "notes" || type === "diary" ? topic : `${topic} · ${type === "links" ? "links" : "list"}`;
}

// ── Taking it in ────────────────────────────────────────────────────────────
const item = (text, extra = {}) => ({ id: uid(), text, createdAt: Date.now(), ...extra });

// List items: one per link (with its url) or one per line
const asItems = (p, extra) =>
  p.kind === "link" ? p.links.map((l) => item(l.title, { url: l.url, ...extra })) : p.lines.map((l) => item(l, extra));

// The module's state with the paste added. Images must already be saved
// (p.imageIds); scrapbook photos and diary pages are entries, added by the caller.
export function takeIn(type, state, p) {
  switch (type) {
    case "clipping": {
      // A clipping holds one link; a new one starts over (the card looks the rest up)
      const [l] = p.links;
      return { url: l.url, title: l.title, domain: l.domain, site: p.site };
    }
    case "links":
      return { ...state, items: [...state.items, ...p.links.map((l) => ({ id: uid(), ...l, createdAt: Date.now() }))] };
    case "wishlist":
    case "nextup":
      return { ...state, items: [...state.items, ...asItems(p)] };
    case "setlist":
      return { ...state, items: [...(state.items ?? []), ...asItems(p, { stage: 0 })] };
    case "fortune":
      return { ...state, items: [...(state.items ?? []), item(p.text)] };
    case "notes": {
      const blocks =
        p.kind === "image"
          ? p.imageIds.map((imageId) => ({ id: uid(), type: "image", imageId, value: "" }))
          : [{ id: uid(), type: "text", value: p.kind === "link" ? p.links.map((l) => `${l.title}\n${l.url}`).join("\n\n") : p.text }];
      return { ...state, blocks: [...(state.blocks ?? []), ...blocks] };
    }
    default:
      return state;
  }
}
