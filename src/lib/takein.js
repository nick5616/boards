import { uid } from "../utils/uid";

// Tiny helpers modules use to take a paste in. They live here (not in paste.js)
// so constants/modules.js can use them without importing paste.js back.
export const item = (text, extra = {}) => ({ id: uid(), text, createdAt: Date.now(), ...extra });

// List items: one per link (with its url) or one per line
export const asItems = (p, extra) =>
  p.kind === "link" ? p.links.map((l) => item(l.title, { url: l.url, ...extra })) : p.lines.map((l) => item(l, extra));
