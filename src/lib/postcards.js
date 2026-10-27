// Museum postcards: three open-access museum APIs, all asked straight from the browser.
//   Art Institute of Chicago  api.artic.edu       CORS on; pictures via IIIF (CORS on, so they can be saved)
//   The Met                   collectionapi...    CORS on; pictures from images.metmuseum.org (no CORS: show only)
//   Cleveland Museum of Art   openaccess-api...   CORS on only when `fields` is given; pictures show-only
// A postcard keeps the title, artist, date, a link and a picture URL. Never the picture itself.
import { cachedJSON, DAY, HOUR } from "./apis";
import { dayKey } from "../utils/date";

export const MUSEUMS = {
  artic: { label: "Art Institute of Chicago", short: "Chicago", site: "https://www.artic.edu", credit: "Art Institute of Chicago, CC0", canSave: true },
  met: { label: "The Metropolitan Museum of Art", short: "The Met", site: "https://www.metmuseum.org", credit: "The Met, Open Access", canSave: false },
  cleveland: { label: "Cleveland Museum of Art", short: "Cleveland", site: "https://www.clevelandart.org", credit: "Cleveland Museum of Art, CC0", canSave: false },
};
export const MUSEUM_IDS = Object.keys(MUSEUMS);

const ARTIC = "https://api.artic.edu/api/v1/artworks";
const articImg = (imageId, w = 400) => `https://www.artic.edu/iiif/2/${imageId}/full/${w},/0/default.jpg`;
const MET = "https://collectionapi.metmuseum.org/public/collection/v1";

const trim = (s, n = 90) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || "");

// ── Art Institute of Chicago ────────────────────────────────────────────────
async function articSearch(q, page = 1, limit = 12) {
  const params = new URLSearchParams({
    q: q || "painting",
    fields: "id,title,artist_display,date_display,image_id,is_public_domain",
    limit: String(limit),
    page: String(page),
  });
  // no Referer: api.artic.edu answers a request that carries a localhost Referer with a 403 that has no CORS headers
  const { data } = await cachedJSON(`${ARTIC}/search?${params}`, { ttl: 6 * HOUR, init: { referrerPolicy: "no-referrer" } });
  return (data?.data ?? [])
    // the public-domain filter is done here: asking for it in the query (query[term]) gets a response without CORS headers
    .filter((a) => a.image_id && a.is_public_domain !== false)
    .map((a) => ({
      museum: "artic",
      id: String(a.id),
      title: a.title,
      artist: (a.artist_display ?? "").split("\n")[0],
      date: a.date_display ?? "",
      img: articImg(a.image_id),
      full: articImg(a.image_id, 843),
      url: `https://www.artic.edu/artworks/${a.id}`,
    }));
}

// ── The Met ─────────────────────────────────────────────────────────────────
// v1.1 search is paginated (the old /search that listed every id was retired 2026-10-01)
async function metSearch(q, page = 1, limit = 12) {
  const params = new URLSearchParams({ hasImages: "true", isPublicDomain: "true", q: q || "painting", limit: String(limit), offset: String((page - 1) * limit) });
  const { data } = await cachedJSON(`${MET}.1/search?${params}`, { ttl: 6 * HOUR });
  const ids = (data?.objectIDs ?? []).slice(0, limit);
  const objs = await Promise.all(ids.map((id) => metObject(id).catch(() => null)));
  return objs.filter(Boolean);
}

async function metObject(id) {
  const { data: o } = await cachedJSON(`${MET}/objects/${id}`, { ttl: 7 * DAY });
  if (!o?.primaryImageSmall) return null;
  return {
    museum: "met",
    id: String(o.objectID),
    title: o.title,
    artist: o.artistDisplayName || o.culture || "",
    date: o.objectDate ?? "",
    img: o.primaryImageSmall,
    full: o.primaryImageSmall,
    url: o.objectURL || `https://www.metmuseum.org/art/collection/search/${o.objectID}`,
  };
}

// ── Cleveland ───────────────────────────────────────────────────────────────
async function clevelandSearch(q, page = 1, limit = 12) {
  const params = new URLSearchParams({
    q: q || "painting",
    has_image: "1",
    cc0: "1",
    limit: String(limit),
    skip: String((page - 1) * limit),
    fields: "id,title,creation_date,creators,images,url",
  });
  const { data } = await cachedJSON(`https://openaccess-api.clevelandart.org/api/artworks/?${params}`, { ttl: 6 * HOUR });
  return (data?.data ?? [])
    .filter((a) => a.images?.web?.url)
    .map((a) => ({
      museum: "cleveland",
      id: String(a.id),
      title: a.title,
      artist: (a.creators?.[0]?.description ?? "").replace(/\s*\(.*$/, ""),
      date: a.creation_date ?? "",
      img: a.images.web.url,
      full: a.images.web.url,
      url: a.url,
    }));
}

const SEARCH = { artic: articSearch, met: metSearch, cleveland: clevelandSearch };

// One museum's matches, [] when it can't be reached
export const searchMuseum = (museum, q, page = 1, limit = 12) => SEARCH[museum](q, page, limit).catch(() => []);

// All the chosen museums at once, interleaved so no single museum fills the rack
export async function searchRack(q, museums = MUSEUM_IDS, page = 1) {
  const lists = await Promise.all(museums.map((m) => searchMuseum(m, q, page, 8)));
  const out = [];
  for (let i = 0; i < 8; i++) lists.forEach((l) => l[i] && out.push(l[i]));
  return out;
}

// Warm, well-known subjects to feed the postcard of the day
const SUBJECTS = ["landscape", "still life", "portrait", "flowers", "river", "garden", "harbor", "mountain", "cat", "horse", "bridge", "winter", "sunset", "ship", "bird", "dancer", "village", "forest", "sea", "tea"];

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// The same card all day, on every device: the day picks a subject, a museum and a spot in the results
export async function postcardOfTheDay(museums = MUSEUM_IDS, day = dayKey()) {
  const h = hash(day);
  const order = [...museums];
  const first = order.splice(h % order.length, 1)[0];
  for (const m of [first, ...order]) {
    const subject = SUBJECTS[(h >> 3) % SUBJECTS.length];
    const list = await searchMuseum(m, subject, 1 + ((h >> 6) % 3), 12);
    if (list.length) return list[(h >> 9) % list.length];
  }
  return null;
}

// What a kept postcard stores (a link and facts, never the picture)
export const keepOf = (c) => ({
  key: `${c.museum}:${c.id}`,
  museum: c.museum,
  id: c.id,
  title: trim(c.title, 140),
  artist: c.artist,
  date: c.date,
  img: c.img,
  url: c.url,
  at: Date.now(),
});

export const creditOf = (c) => `${MUSEUMS[c.museum]?.credit ?? c.museum}`;
export const lineOf = (c) => [c.artist, c.date].filter(Boolean).join(", ");

// A picture URL → a File, for saving into a Value check / Gesture timer the way a paste does.
// Only museums whose pictures allow it (Chicago) can; others throw.
export async function fetchPictureFile(c) {
  if (!MUSEUMS[c.museum]?.canSave) throw new Error("that museum's pictures can't be copied from here");
  const res = await fetch(c.full || c.img);
  if (!res.ok) throw new Error(`${res.status}`);
  const blob = await res.blob();
  return new File([blob], `${c.title || "postcard"}.jpg`, { type: blob.type || "image/jpeg" });
}
