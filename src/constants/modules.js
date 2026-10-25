import { uid } from "../utils/uid";

// kind:   which shelf of the tray it sits on (see MODULE_KINDS)
// desk:   default size in px on the desktop canvas
// mobile: default size in widget-grid cells (2 columns wide, rows of ROW_H px)
export const MODULES = {
  folder: {
    label: "File folders",
    blurb: "named tabs, a clean slate in each",
    kind: "control",
    desk: { w: 640, h: 480 },
    mobile: { w: 2, h: 9 },
    init: () => {
      const id = uid();
      return { tabs: [{ id, name: "Tab 1" }], active: id };
    },
  },
  tracker: {
    label: "Sticker chart",
    blurb: "tap to log practice",
    kind: "track",
    desk: { w: 330, h: 290 },
    mobile: { w: 2, h: 4 },
    init: () => ({}),
  },
  nextup: {
    label: "Next up",
    blurb: "a stack of sticky notes",
    kind: "list",
    desk: { w: 220, h: 230 },
    mobile: { w: 1, h: 4 },
    init: () => ({ items: [], done: [] }),
  },
  tickets: {
    label: "Tickets",
    blurb: "dated things that expire",
    kind: "list",
    desk: { w: 310, h: 250 },
    mobile: { w: 2, h: 3 },
    init: () => ({ items: [] }),
  },
  wishlist: {
    label: "Wishlist",
    blurb: "gear, lessons, books",
    kind: "list",
    desk: { w: 250, h: 300 },
    mobile: { w: 1, h: 4 },
    init: () => ({ items: [], done: [] }),
  },
  diary: {
    label: "Diary",
    blurb: "dated entries, PIN optional",
    kind: "keep",
    desk: { w: 200, h: 250 },
    mobile: { w: 1, h: 3 },
    init: () => ({ pinHash: null }),
  },
  notes: {
    label: "Notes",
    blurb: "freeform writing",
    kind: "keep",
    desk: { w: 380, h: 420 },
    mobile: { w: 2, h: 5 },
    init: () => ({ blocks: [] }),
  },
  scrapbook: {
    label: "Scrapbook",
    blurb: "photos with captions",
    kind: "keep",
    desk: { w: 360, h: 300 },
    mobile: { w: 2, h: 4 },
    init: () => ({}),
  },
  timer: {
    label: "Kitchen timer",
    blurb: "time a session, it logs itself",
    kind: "track",
    desk: { w: 220, h: 290 },
    mobile: { w: 1, h: 4 },
    init: () => ({ preset: 20, startedAt: null }),
  },
  punchcard: {
    label: "Punch card",
    blurb: "a punch a day, then a treat",
    kind: "track",
    desk: { w: 320, h: 230 },
    mobile: { w: 2, h: 3 },
    init: () => ({ size: 10, reward: "", startedAt: Date.now(), cards: [] }),
  },
  flashcards: {
    label: "Flashcards",
    blurb: "flip, review, remember",
    kind: "list",
    desk: { w: 320, h: 300 },
    mobile: { w: 2, h: 4 },
    init: () => ({ cards: [], learned: [] }),
  },
  setlist: {
    label: "Mixtape",
    blurb: "pieces & how far along",
    kind: "list",
    desk: { w: 300, h: 330 },
    mobile: { w: 2, h: 5 },
    init: () => ({ items: [] }),
  },
  graph: {
    label: "Graph paper",
    blurb: "plot a number over time",
    kind: "track",
    desk: { w: 340, h: 270 },
    mobile: { w: 2, h: 4 },
    init: () => ({ unit: "", goal: null, points: [] }),
  },
  tally: {
    label: "Tally",
    blurb: "count anything, by the day",
    kind: "track",
    desk: { w: 260, h: 240 },
    mobile: { w: 1, h: 4 },
    init: () => ({ unit: "", counts: {} }),
  },
  jar: {
    label: "Jar",
    blurb: "fill it up toward a goal",
    kind: "track",
    desk: { w: 230, h: 320 },
    mobile: { w: 1, h: 5 },
    init: () => ({ label: "", goal: 100, unit: "", drops: [], shelf: [] }),
  },
  clipping: {
    label: "Clipping",
    blurb: "one link, with its picture, price & all",
    kind: "keep",
    desk: { w: 300, h: 440 },
    mobile: { w: 2, h: 7 },
    init: () => ({ url: null }),
  },
  links: {
    label: "Links",
    blurb: "tag pages you want to keep",
    kind: "keep",
    desk: { w: 300, h: 260 },
    mobile: { w: 2, h: 4 },
    init: () => ({ items: [] }),
  },
  fortune: {
    label: "Fortunes",
    blurb: "advice that comes back to you",
    kind: "keep",
    desk: { w: 270, h: 210 },
    mobile: { w: 2, h: 3 },
    init: () => ({ items: [] }),
  },
};

// Controls don't hold a thing of their own; they hold other modules
export const MODULE_KINDS = [
  { id: "control", label: "Controls" },
  { id: "track", label: "Keep track" },
  { id: "list", label: "Lists" },
  { id: "keep", label: "Write & keep" },
];

export const MODULE_TYPES = [
  "folder", "tracker", "nextup", "tickets", "wishlist", "diary", "notes", "scrapbook",
  "timer", "punchcard", "flashcards", "setlist", "graph", "tally", "jar", "clipping", "links", "fortune",
];

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
    rot: def.kind === "control" ? 0 : tilt(),
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
