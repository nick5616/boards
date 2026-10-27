// The game backlog. Games can always be added by hand; with a free RAWG key
// (Settings → API keys) the search fills in the cover, release date and Metacritic score.
import { cachedJSON, DAY } from "./apis";

export const PLATFORMS = ["Switch", "PC", "PlayStation 5", "PlayStation 4", "Xbox", "Steam Deck", "3DS", "Game Boy", "SNES", "N64", "iOS", "Android"];

export async function searchGames(q, key) {
  const url = `https://api.rawg.io/api/games?key=${encodeURIComponent(key)}&search=${encodeURIComponent(q)}&page_size=8`;
  const { data } = await cachedJSON(url, { ttl: DAY, key: `rawg:search:${q.toLowerCase()}` });
  return (data?.results ?? []).map((g) => ({
    rawg: g.id,
    title: g.name,
    released: g.released ?? "",
    meta: g.metacritic ?? null,
    cover: g.background_image ?? null,
    platforms: (g.platforms ?? []).map((p) => p.platform?.name).filter(Boolean).slice(0, 4),
  }));
}

export const gamesIn = (state, status) => (state.games ?? []).filter((g) => g.status === status);

// 14 → "14h", 14.5 → "14½h", 0.5 → "½h"
export function hoursLabel(h) {
  const n = Math.round((h ?? 0) * 2) / 2;
  const whole = Math.floor(n);
  const half = n - whole ? "½" : "";
  return !whole && half ? "½h" : `${whole}${half}h`;
}

// The home Glance line: what you're playing, over all backlog modules' states
export function glanceFor(states) {
  const g = states
    .flatMap((s) => gamesIn(s, "playing"))
    .sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0))[0];
  return g ? `🎮 playing ${g.title}${g.hours ? ` · ${hoursLabel(g.hours)}` : ""}` : null;
}
