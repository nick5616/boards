import { uid } from "../utils/uid";
import { dayKey } from "../utils/date";
import { item, asItems } from "../lib/takein";

// kind:   which shelf of the tray it sits on (see MODULE_KINDS)
// desk:   default size in px on the desktop canvas
// mobile: default size in widget-grid cells (2 columns wide, rows of ROW_H px)
// needs:  browser abilities it can't work without (see lib/caps.js); the tray greys it out without them
// accepts / takeIn: what a paste can become here. accepts is keyed by what was pasted
//         (image | link.shop/watch/page | lines | paragraph | line); rank orders the
//         suggestions for that paste (lowest first) and why is the blurb shown.
//         takeIn(state, paste) returns the state with the paste added.
// receive(state, reading): optional, takes a { value, unit?, at, label? } from elsewhere
//         (see lib/readings.js).
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
    accepts: {
      link: {
        shop: { rank: 2, why: "look into it next" },
        watch: { rank: 2, why: "watch it next" },
        page: { rank: 1, why: "read it next" },
      },
      lines: { rank: 1, why: "a sticky note per line" },
      line: { rank: 0, why: "a sticky note" },
    },
    takeIn: (state, p) => ({ ...state, items: [...state.items, ...asItems(p)] }),
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
    accepts: {
      link: {
        shop: { rank: 0, why: "on the list, to maybe get" },
        page: { rank: 2, why: "on the list" },
      },
      lines: { rank: 2, why: "one item per line" },
      line: { rank: 2, why: "on the list" },
    },
    takeIn: (state, p) => ({ ...state, items: [...state.items, ...asItems(p)] }),
  },
  diary: {
    label: "Diary",
    blurb: "dated entries, PIN optional",
    kind: "keep",
    desk: { w: 200, h: 250 },
    mobile: { w: 1, h: 3 },
    init: () => ({ pinHash: null }),
    accepts: { paragraph: { rank: 1, why: "today's diary page" } },
  },
  notes: {
    label: "Notes",
    blurb: "freeform writing",
    kind: "keep",
    desk: { w: 380, h: 420 },
    mobile: { w: 2, h: 5 },
    init: () => ({ blocks: [] }),
    accepts: {
      image: { rank: 1, why: "drop it into a page of notes" },
      lines: { rank: 0, why: "keep it as a page" },
      paragraph: { rank: 0, why: "keep it as a page" },
      line: { rank: 3, why: "a note" },
    },
    takeIn: (state, p) => {
      const blocks =
        p.kind === "image"
          ? p.imageIds.map((imageId) => ({ id: uid(), type: "image", imageId, value: "" }))
          : [{ id: uid(), type: "text", value: p.kind === "link" ? p.links.map((l) => `${l.title}\n${l.url}`).join("\n\n") : p.text }];
      return { ...state, blocks: [...(state.blocks ?? []), ...blocks] };
    },
  },
  scrapbook: {
    label: "Scrapbook",
    blurb: "photos with captions",
    kind: "keep",
    desk: { w: 360, h: 300 },
    mobile: { w: 2, h: 4 },
    init: () => ({}),
    accepts: { image: { rank: 0, why: "pin it up as a polaroid" } },
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
    accepts: {
      link: { watch: { rank: 1, why: "a track on the mixtape" } },
      lines: { rank: 3, why: "a track per line" },
    },
    takeIn: (state, p) => ({ ...state, items: [...(state.items ?? []), ...asItems(p, { stage: 0 })] }),
  },
  graph: {
    label: "Graph paper",
    blurb: "plot a number over time",
    kind: "track",
    desk: { w: 340, h: 270 },
    mobile: { w: 2, h: 4 },
    init: () => ({ unit: "", goal: null, points: [] }),
    // reading { value, unit?, at, label? }: plotting twice in a day replaces that day's dot
    receive: (state, r) => {
      const day = dayKey(new Date(r.at));
      return { ...state, points: [...(state.points ?? []).filter((p) => p.day !== day), { id: uid(), day, v: r.value }] };
    },
  },
  tally: {
    label: "Tally",
    blurb: "count anything, by the day",
    kind: "track",
    desk: { w: 260, h: 240 },
    mobile: { w: 1, h: 4 },
    init: () => ({ unit: "", counts: {} }),
    // a reading adds to the day it happened
    receive: (state, r) => {
      const day = dayKey(new Date(r.at));
      const counts = { ...(state.counts ?? {}) };
      counts[day] = (counts[day] ?? 0) + r.value;
      return { ...state, counts };
    },
  },
  jar: {
    label: "Jar",
    blurb: "fill it up toward a goal",
    kind: "track",
    desk: { w: 230, h: 320 },
    mobile: { w: 1, h: 5 },
    init: () => ({ label: "", goal: 100, unit: "", drops: [], shelf: [] }),
    // a reading is a drop in the jar (nothing to drop if it isn't positive)
    receive: (state, r) =>
      r.value > 0 ? { ...state, drops: [...(state.drops ?? []), { id: uid(), amt: r.value, at: r.at }] } : state,
  },
  clipping: {
    label: "Clipping",
    blurb: "one link, with its picture, price & all",
    kind: "keep",
    desk: { w: 300, h: 440 },
    mobile: { w: 2, h: 7 },
    init: () => ({ url: null }),
    // A clipping holds one link, so it only takes a single link; a new one starts over
    // (the card looks the rest up). rank -1 puts it ahead of the list-ish modules.
    accepts: {
      link: {
        single: true,
        shop: { rank: -1, why: "the full card: picture, price & all" },
        watch: { rank: -1, why: "the full card, and it plays right there" },
        page: { rank: -1, why: "the full card: picture, title & blurb" },
      },
    },
    takeIn: (state, p) => {
      const [l] = p.links;
      return { url: l.url, title: l.title, domain: l.domain, site: p.site };
    },
  },
  links: {
    label: "Links",
    blurb: "tag pages you want to keep",
    kind: "keep",
    desk: { w: 300, h: 260 },
    mobile: { w: 2, h: 4 },
    init: () => ({ items: [] }),
    accepts: {
      link: {
        shop: { rank: 1, why: "just a tag, with the others you're looking at" },
        watch: { rank: 0, why: "save it to come back to" },
        page: { rank: 0, why: "tie a tag on it" },
      },
    },
    takeIn: (state, p) => ({
      ...state,
      items: [...state.items, ...p.links.map((l) => ({ id: uid(), ...l, createdAt: Date.now() }))],
    }),
  },
  fortune: {
    label: "Fortunes",
    blurb: "advice that comes back to you",
    kind: "keep",
    desk: { w: 270, h: 210 },
    mobile: { w: 2, h: 3 },
    init: () => ({ items: [] }),
    accepts: {
      paragraph: { rank: 2, why: "something worth hearing again" },
      line: { rank: 1, why: "something worth hearing again" },
    },
    takeIn: (state, p) => ({ ...state, items: [...(state.items ?? []), item(p.text)] }),
  },
  tuner: {
    label: "Tuner",
    blurb: "a needle that hears your note",
    kind: "track",
    needs: ["audio", "mic"],
    desk: { w: 260, h: 340 },
    mobile: { w: 2, h: 5 },
    init: () => ({ preset: "chromatic", drone: null }),
  },
  keys: {
    label: "Keys",
    blurb: "a toy piano, keeps your phrases",
    kind: "track",
    needs: ["audio"],
    desk: { w: 380, h: 300 },
    mobile: { w: 2, h: 5 },
    init: () => ({ phrases: [] }),
  },
  metronome: {
    label: "Metronome",
    blurb: "keeps time, logs your practice",
    kind: "track",
    desk: { w: 250, h: 400 },
    mobile: { w: 2, h: 6 },
    needs: ["audio"],
    init: () => ({
      bpm: 90,
      beats: 4,
      accent: true,
      sub: 1,
      trainer: { on: false, step: 4, every: 4, target: 120 },
      startedAt: null,
      sendTo: [],
    }),
  },
  // Takes hold only a name, length and waveform; the sound itself stays on the recording
  // computer's local shelf (lib/localMedia). music = leave the mic unprocessed.
  tape: {
    label: "Tape recorder",
    blurb: "record takes, compare two",
    kind: "keep",
    needs: ["audio", "mic"],
    desk: { w: 320, h: 420 },
    mobile: { w: 2, h: 7 },
    init: () => ({ takes: [], music: true }),
  },
  // notes: [{ id, m (midi, null = rest), d (beats; 1 = quarter), acc?: "#"|"b", ly?, by? }]
  staff: {
    label: "Staff paper",
    blurb: "write music, hear it back",
    kind: "keep",
    needs: ["audio"],
    desk: { w: 440, h: 300 },
    mobile: { w: 2, h: 5 },
    init: () => ({ clef: "treble", time: [4, 4], tempo: 100, notes: [] }),
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
  "tuner", "keys", "metronome", "tape", "staff",
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
