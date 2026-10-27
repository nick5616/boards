// Headlines for the morning paper: Hacker News, The Guardian and Spaceflight News.
// All three are free and callable from the browser; answers are kept ~30 minutes.
import { cachedJSON, MIN } from "./apis";

export const TTL = 30 * MIN;
const HN = "https://hacker-news.firebaseio.com/v0";

// id, the heading over its column, and whether it needs a key of its own
export const SECTIONS = [
  { id: "hn", name: "Hacker News", head: "Tech & Tinkering" },
  { id: "guardian", name: "The Guardian", head: "World & Culture", key: "guardian" },
  { id: "space", name: "Spaceflight News", head: "Up & Out" },
];

const host = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
};

// → [{ key, title, url, meta, blurb? }]. `force` skips the cache; `guardianKey` is the person's key.
export async function loadSection(id, { force = false, guardianKey } = {}) {
  const opts = { ttl: TTL, force };
  if (id === "hn") {
    const { data: ids } = await cachedJSON(`${HN}/topstories.json`, opts);
    const items = await Promise.all(
      ids.slice(0, 10).map((n) => cachedJSON(`${HN}/item/${n}.json`, opts).then((r) => r.data).catch(() => null)),
    );
    return items
      .filter((s) => s?.title && !s.dead && !s.deleted)
      .map((s) => {
        const url = s.url ?? `https://news.ycombinator.com/item?id=${s.id}`;
        return {
          key: url,
          title: s.title,
          url,
          meta: [host(s.url), `${s.score} points`, s.descendants != null && `${s.descendants} comments`].filter(Boolean).join(" · "),
        };
      });
  }
  if (id === "guardian") {
    const url = `https://content.guardianapis.com/search?api-key=${encodeURIComponent(guardianKey)}&page-size=10&order-by=newest&show-fields=trailText`;
    const { data } = await cachedJSON(url, { ...opts, key: "paper:guardian" });
    return (data.response?.results ?? []).map((r) => ({
      key: r.webUrl,
      title: r.webTitle,
      url: r.webUrl,
      meta: r.sectionName,
      blurb: (r.fields?.trailText ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#?\w+;/g, "").trim(),
    }));
  }
  const { data } = await cachedJSON("https://api.spaceflightnewsapi.net/v4/articles/?limit=8", opts);
  return (data.results ?? []).map((a) => ({
    key: a.url,
    title: a.title,
    url: a.url,
    meta: a.news_site,
    blurb: a.summary,
  }));
}

// "Monday, October 26, 2026"
export const dateline = (d = new Date()) =>
  d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

// Read stories are remembered by url, newest last, so the list can't grow forever
export const markRead = (read, key) => ({ ...read, [key]: Date.now() });
export function pruneRead(read, keep = 300) {
  const keys = Object.keys(read);
  if (keys.length <= keep) return read;
  return Object.fromEntries(Object.entries(read).sort((a, b) => b[1] - a[1]).slice(0, keep));
}
