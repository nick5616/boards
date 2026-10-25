import { DEMO } from "./demo";

// Every board has an address made from its name: /fashion (or /demo/fashion
// in the demo). Boards that share a name get -2, -3… in board order.
export const BASE = DEMO ? "/demo" : "";

export const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// board id → its address name
export function slugs(boards) {
  const seen = {};
  const out = new Map();
  for (const b of boards) {
    const base = slugify(b.title) || b.id;
    seen[base] = (seen[base] ?? 0) + 1;
    out.set(b.id, seen[base] === 1 ? base : `${base}-${seen[base]}`);
  }
  return out;
}

export const pathFor = (slug) => (slug ? `${BASE}/${slug}` : BASE || "/");

export const slugInPath = () =>
  decodeURIComponent(window.location.pathname.slice(BASE.length).replace(/^\/+|\/+$/g, "")) || null;
