import { MODULES } from "../constants/modules";
import { keyToDate } from "../utils/date";

// What can go in the shuffle bag, and how likely each thing is to come out.
// Controls and containers aren't things to *do*, so they stay out.
const NOT_DOABLE = new Set(["folder", "window", "patchbay", "gauges", "shuffle", "spotlight", "lockbox", "diary"]);

export const doable = (m) => !NOT_DOABLE.has(m.type) && !!MODULES[m.type];

// When a module was last used, where its own state remembers (ms), else null
export function touchedAt(m) {
  const s = m.state ?? {};
  const days = (map) => Object.keys(map ?? {}).filter((d) => map[d] > 0).sort().pop();
  switch (m.type) {
    case "graph": {
      const d = (s.points ?? []).map((p) => p.day).sort().pop();
      return d ? keyToDate(d).getTime() : null;
    }
    case "tally": {
      const d = days(s.counts);
      return d ? keyToDate(d).getTime() : null;
    }
    case "jar":
      return Math.max(0, ...(s.drops ?? []).map((d) => d.at)) || null;
    case "tape":
      return Math.max(0, ...(s.takes ?? []).map((t) => t.at ?? 0)) || null;
    default:
      return null;
  }
}

// Weight: a base of 1, plus a point for each day since last practiced (a month at most).
// A module that has no time of its own borrows its board's last log.
export function weightOf(board, m, pulled = {}, now = Date.now()) {
  const last = Math.max(touchedAt(m) ?? board.lastLoggedAt ?? 0, pulled[m.id] ?? 0);
  const days = last ? (now - last) / 86400000 : 30;
  return 1 + Math.min(30, Math.max(0, days));
}

// Everything that could come out: { board, mod, w }
export function bagContents(boards, here, state) {
  const out = [];
  const use = state.everywhere ? (boards ?? []).filter((b) => b.id === here.id || b.status === "active") : [here];
  for (const b of use)
    for (const m of b.modules) {
      if (!doable(m) || (b.id === here.id && m.id === state.selfId)) continue;
      out.push({ board: b, mod: m, w: weightOf(b, m, state.pulled) });
    }
  return out;
}

export function pull(items, skip = []) {
  const pool = items.filter((i) => !skip.includes(i.mod.id));
  const total = pool.reduce((t, i) => t + i.w, 0);
  if (!pool.length) return null;
  let r = Math.random() * total;
  for (const i of pool) if ((r -= i.w) <= 0) return i;
  return pool[pool.length - 1];
}

