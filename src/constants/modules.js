import { uid } from "../utils/uid";

// desk:   default size in px on the desktop canvas
// mobile: default size in widget-grid cells (2 columns wide, rows of ROW_H px)
export const MODULES = {
  tracker: {
    label: "Sticker chart",
    blurb: "tap to log practice",
    desk: { w: 330, h: 290 },
    mobile: { w: 2, h: 4 },
    init: () => ({}),
  },
  nextup: {
    label: "Next up",
    blurb: "a stack of sticky notes",
    desk: { w: 220, h: 230 },
    mobile: { w: 1, h: 4 },
    init: () => ({ items: [], done: [] }),
  },
  tickets: {
    label: "Tickets",
    blurb: "dated things that expire",
    desk: { w: 310, h: 250 },
    mobile: { w: 2, h: 3 },
    init: () => ({ items: [] }),
  },
  wishlist: {
    label: "Wishlist",
    blurb: "gear, lessons, books",
    desk: { w: 250, h: 300 },
    mobile: { w: 1, h: 4 },
    init: () => ({ items: [], done: [] }),
  },
  diary: {
    label: "Diary",
    blurb: "dated entries, PIN optional",
    desk: { w: 200, h: 250 },
    mobile: { w: 1, h: 3 },
    init: () => ({ pinHash: null }),
  },
  notes: {
    label: "Notes",
    blurb: "freeform writing",
    desk: { w: 380, h: 420 },
    mobile: { w: 2, h: 5 },
    init: () => ({ blocks: [] }),
  },
  scrapbook: {
    label: "Scrapbook",
    blurb: "photos with captions",
    desk: { w: 360, h: 300 },
    mobile: { w: 2, h: 4 },
    init: () => ({}),
  },
};

export const MODULE_TYPES = ["tracker", "nextup", "tickets", "wishlist", "diary", "notes", "scrapbook"];

export const ROW_H = 64;
export const SNAP = 20;
export const GAP = 24;

const tilt = () => Math.round((Math.random() * 3 - 1.5) * 10) / 10;

export function newModule(type, pos = { x: 0, y: 0 }, extra = {}) {
  const def = MODULES[type];
  return {
    id: uid(),
    type,
    title: def.label,
    x: pos.x,
    y: pos.y,
    w: def.desk.w,
    h: def.desk.h,
    rot: tilt(),
    z: 1,
    mw: null,
    mh: null,
    state: def.init(),
    ...extra,
  };
}

const overlaps = (a, b) =>
  a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;

// First open spot on the canvas, scanning row by row
export function findSpot(modules, w, h, width = 1000) {
  for (let y = 0; y < 4000; y += SNAP) {
    for (let x = 0; x + w <= Math.max(width, w); x += SNAP) {
      const r = { x, y, w, h };
      if (!modules.some((m) => overlaps(r, m))) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

export const STATUSES = [
  { id: "active", label: "Now" },
  { id: "paused", label: "Paused" },
  { id: "someday", label: "Someday" },
  { id: "done", label: "Done" },
];
