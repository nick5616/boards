// Wikipedia, from the browser (no key; CORS is open on the REST and action APIs).
// Used by the Rabbit hole and the Almanac. Every language edition has the same API at
// <lang>.wikipedia.org, which is what makes the language picker cheap.
import { cachedJSON, DAY, HOUR } from "./apis";

export const LANGS = [
  { code: "en", name: "English" }, { code: "es", name: "Español" }, { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" }, { code: "it", name: "Italiano" }, { code: "pt", name: "Português" },
  { code: "nl", name: "Nederlands" }, { code: "pl", name: "Polski" }, { code: "sv", name: "Svenska" },
  { code: "ru", name: "Русский" }, { code: "uk", name: "Українська" }, { code: "tr", name: "Türkçe" },
  { code: "ar", name: "العربية" }, { code: "he", name: "עברית" }, { code: "hi", name: "हिन्दी" },
  { code: "zh", name: "中文" }, { code: "ja", name: "日本語" }, { code: "ko", name: "한국어" },
  { code: "la", name: "Latina" }, { code: "simple", name: "Simple English" },
];
export const RTL = new Set(["ar", "he", "fa", "ur"]);

const host = (lang) => `https://${lang}.wikipedia.org`;

// "https://es.wikipedia.org/wiki/Gato_dom%C3%A9stico#Historia" → { lang: "es", title: "Gato doméstico" }
export function parseWikiUrl(text) {
  const m = /(?:^|\/\/)(?:([a-z-]{2,12})\.)?(?:m\.)?wikipedia\.org\/wiki\/([^?#\s]+)/i.exec((text ?? "").trim());
  if (!m) return null;
  let title;
  try { title = decodeURIComponent(m[2]); } catch { title = m[2]; }
  return { lang: (m[1] || "en").toLowerCase(), title: title.replace(/_/g, " ") };
}

// A summary answer → the small card we keep
function toCard(lang, j) {
  if (!j || j.type === "https://mediawiki.org/wiki/HyperSwitch/errors/not_found") return null;
  return {
    lang,
    title: j.titles?.normalized ?? j.title,
    key: j.titles?.canonical ?? (j.title ?? "").replace(/ /g, "_"),
    desc: j.description ?? "",
    extract: j.extract ?? "",
    thumb: j.thumbnail?.source ?? null,
    disambig: j.type === "disambiguation",
    url: j.content_urls?.desktop?.page ?? `${host(lang)}/wiki/${encodeURIComponent(j.title ?? "")}`,
  };
}

export async function summary(lang, title) {
  const url = `${host(lang)}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`;
  const r = await cachedJSON(url, { ttl: DAY });
  const card = toCard(lang, r.data);
  if (!card) throw new Error("no such page");
  return card;
}

// A random article (never cached, or it wouldn't be random)
export async function randomCard(lang) {
  const res = await fetch(`${host(lang)}/api/rest_v1/page/random/summary`);
  if (!res.ok) throw new Error("random");
  const card = toCard(lang, await res.json());
  if (!card) throw new Error("random");
  return card;
}

// The articles a page links to (main namespace only), up to ~500, cached for a day
export async function linksOf(lang, title) {
  const url = `${host(lang)}/w/api.php?action=query&prop=links&titles=${encodeURIComponent(title)}` +
    "&pllimit=max&plnamespace=0&redirects=1&format=json&origin=*";
  const r = await cachedJSON(url, { ttl: DAY });
  const pages = Object.values(r.data?.query?.pages ?? {});
  return (pages[0]?.links ?? []).map((l) => l.title).filter((t) => !/^(List|Lists|Index|Outline) of /i.test(t));
}

// A handful of links to offer next, skipping what the trail has already visited
export function pickLinks(all, seen = [], n = 8) {
  const gone = new Set(seen.map((s) => s.toLowerCase()));
  const pool = all.filter((t) => !gone.has(t.toLowerCase()));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

// ── On this day ──
// The feed has selected / events / births / deaths / holidays, each [{ text, year?, pages: [...] }]
export async function onThisDay(date = new Date(), lang = "en") {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const url = `https://api.wikimedia.org/feed/v1/wikipedia/${lang}/onthisday/all/${mm}/${dd}`;
  const r = await cachedJSON(url, { ttl: 6 * HOUR });
  return r.data;
}

// Best-matching article title for what someone typed
export async function searchTitle(lang, text) {
  const url = `${host(lang)}/w/api.php?action=opensearch&search=${encodeURIComponent(text)}&limit=1&namespace=0&format=json&origin=*`;
  const r = await cachedJSON(url, { ttl: DAY });
  return r.data?.[1]?.[0] ?? null;
}

// The same article in another language edition, or null
export async function inLang(lang, title, to) {
  const url = `${host(lang)}/w/api.php?action=query&prop=langlinks&titles=${encodeURIComponent(title)}` +
    `&lllang=${to}&redirects=1&format=json&origin=*`;
  const r = await cachedJSON(url, { ttl: DAY });
  const p = Object.values(r.data?.query?.pages ?? {})[0];
  return p?.langlinks?.[0]?.["*"] ?? null;
}
