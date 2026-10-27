import { uid } from "../utils/uid";

// Tiny helpers modules use to take a paste in. They live here (not in paste.js)
// so constants/modules.js can use them without importing paste.js back.
export const item = (text, extra = {}) => ({ id: uid(), text, createdAt: Date.now(), ...extra });

// List items: one per link (with its url) or one per line
export const asItems = (p, extra) =>
  p.kind === "link" ? p.links.map((l) => item(l.title, { url: l.url, ...extra })) : p.lines.map((l) => item(l, extra));

// Checklist boxes, one per line. Markdown boxes keep their ticks; bullets and numbers come off.
export const asChecks = (text) =>
  text
    .split("\n")
    .map((l) => /^\s*(?:[-*+]\s+)?(?:\[([ xX])\]\s*)?(?:\d+[.)]\s+)?(.*)$/.exec(l))
    .filter((m) => m[2].trim())
    .map((m) => ({ id: uid(), text: m[2].trim(), done: !!m[1] && m[1] !== " " }));
