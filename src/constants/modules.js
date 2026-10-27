import { uid } from "../utils/uid";
import { dayKey } from "../utils/date";
import { item, asItems, asChecks } from "../lib/takein";
import { showRefOf } from "../lib/screen";
import { addWords, splitWords } from "../lib/magnets";
import { hexesIn, nameFor } from "../lib/paint";
import { stripsFrom, withStrips } from "../lib/photostrip";
import { parseRecipe } from "../lib/recipe";
import { looksLikeChart, parseChart, piecesFrom } from "../lib/wardrobe";
import { withCards } from "../lib/cork";
import { addLine } from "../lib/groceries";
import { refOf, refsIn } from "../lib/catalog";
import { chordLine } from "../lib/music";

// kind:   which shelf of the tray it sits on (see MODULE_KINDS)
// desk:   default size in px on the desktop canvas
// mobile: default size in widget-grid cells (2 columns wide, rows of ROW_H px)
// needs:  browser abilities it can't work without (see lib/caps.js); the tray greys it out without them
// keys:   API keys it can't work without (see lib/apis.js KEYS); greyed out the same way until pasted
// accepts / takeIn: what a paste can become here. accepts is keyed by what was pasted
//         (image | link.shop/watch/page | lines | paragraph | line); rank orders the
//         suggestions for that paste (lowest first) and why is the blurb shown.
//         takeIn(state, paste) returns the state with the paste added.
// when(paste): optional on a slot, so a module only claims the pastes it can really use.
// receive(state, reading): optional, takes a { value, unit?, at, label? } from elsewhere
//         (see lib/readings.js).
export const MODULES = {
  folder: {
    label: "File folders",
    blurb: "named tabs, a clean slate in each",
    kind: "control",
    container: true, // state is { tabs, active }; each tab is a surface (see isContainer)
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
      line: { rank: 3, why: "a track on the mixtape" },
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
  // words: [{ id, text, x, y (fractions of the door), rot, by? }]; box holds ones put away
  magnets: {
    label: "Fridge magnets",
    blurb: "word magnets for lyrics & play",
    kind: "keep",
    desk: { w: 380, h: 420 },
    mobile: { w: 2, h: 6 },
    init: () => ({ words: [], box: [] }),
    accepts: {
      lines: { rank: 2, why: "a magnet for every word" },
      paragraph: { rank: 2, why: "a magnet for every word" },
      line: { rank: 2, why: "a magnet for every word" },
    },
    takeIn: (state, p) => addWords(state, splitWords(p.text)),
  },
  // favorites / station: { id (stationuuid), name, url, favicon, country, language, homepage }
  // heard: songs kept from the radio, newest first: [{ id, artist, title, album?, station, at, by }]
  // startedAt / by: switched on when, by whom (uid). Volume is each screen's own (lib/radio).
  radio: {
    label: "Radio",
    blurb: "live stations in your language",
    kind: "track",
    needs: ["audio"],
    desk: { w: 280, h: 440 },
    mobile: { w: 2, h: 7 },
    init: () => ({ lang: "spanish", query: "", favorites: [], station: null, heard: [], startedAt: null, by: null }),
  },
  // mode: photo | strip | clip; sendTo: where the last review went; snaps: imageIds kept in the mirror (it owns them); reels: [{ id (local shelf), secs, at }]
  mirror: {
    label: "Vanity mirror",
    blurb: "photo booth with bulbs",
    kind: "keep",
    needs: ["camera"],
    desk: { w: 340, h: 600 },
    mobile: { w: 2, h: 9 },
    init: () => ({ filter: "none", mode: "photo", snaps: [], reels: [] }),
  },
  // looks: [{ id, name, chips: [{ id, hex, name, by?, at }] }]. Only claims pastes with a #hex in them.
  paintchips: {
    label: "Paint chips",
    blurb: "pick colours, name them, mix looks",
    kind: "keep",
    desk: { w: 360, h: 380 },
    mobile: { w: 2, h: 6 },
    init: () => {
      const id = uid();
      return { looks: [{ id, name: "My look", chips: [] }], active: id };
    },
    accepts: {
      lines: { rank: 0, why: "chips for the colours in it", when: (p) => hexesIn(p.text).length > 0 },
      paragraph: { rank: 0, why: "chips for the colours in it", when: (p) => hexesIn(p.text).length > 0 },
      line: { rank: 0, why: "a chip for that colour", when: (p) => hexesIn(p.text).length > 0 },
    },
    takeIn: (state, p) => {
      const looks = state.looks?.length ? state.looks : [{ id: uid(), name: "My look", chips: [] }];
      const active = looks.some((l) => l.id === state.active) ? state.active : looks[0].id;
      const have = new Set(looks.find((l) => l.id === active).chips.map((c) => c.hex));
      const chips = hexesIn(p.text).filter((h) => !have.has(h)).map((hex) => ({ id: uid(), hex, name: nameFor(hex), at: Date.now() }));
      return { ...state, active, looks: looks.map((l) => (l.id === active ? { ...l, chips: [...l.chips, ...chips] } : l)) };
    },
  },
  // src: { boardId, modId } of the module it looks at. "keep", not "control", so it
  // can sit in a folder tab (controls can't); it never holds modules itself.
  window: {
    label: "Window",
    blurb: "a live view of a module from anywhere",
    kind: "keep",
    desk: { w: 320, h: 340 },
    mobile: { w: 2, h: 5 },
    init: () => ({ src: null }),
  },
  // Five controls. None holds modules, so they are "keep" (like Window) and can sit in a folder tab.
  // patchbay: nothing of its own (the wires live in each sender's state.sendTo).
  // gauges: dials: [{ id, src: { boardId, modId }, min, max, goal }] (up to 4; blank min/max = automatic)
  // shuffle: skip: [modId] left out of the bag; everywhere: also pull from other Now boards; pulled: { modId: at }; last: { boardId, modId, at }
  // spotlight: order: [modId] on this board, in running order
  // lockbox: ids: [modId] hidden behind it; pinHash (see lib/lockbox: privacy from a glance, not encryption)
  patchbay: {
    label: "Patch bay",
    blurb: "see the wires, plug them in",
    kind: "keep",
    desk: { w: 400, h: 340 },
    mobile: { w: 2, h: 6 },
    init: () => ({}),
  },
  gauges: {
    label: "Gauges",
    blurb: "dials that mirror your numbers",
    kind: "keep",
    desk: { w: 400, h: 360 },
    mobile: { w: 2, h: 6 },
    init: () => ({ dials: [] }),
  },
  shuffle: {
    label: "Shuffle bag",
    blurb: "pulls out what to do now",
    kind: "keep",
    desk: { w: 280, h: 420 },
    mobile: { w: 2, h: 7 },
    init: () => ({ skip: [], everywhere: false, pulled: {}, last: null }),
  },
  spotlight: {
    label: "Spotlight",
    blurb: "raise the curtain on one thing at a time",
    kind: "keep",
    desk: { w: 320, h: 360 },
    mobile: { w: 2, h: 6 },
    init: () => ({ order: [] }),
  },
  lockbox: {
    label: "Lock box",
    blurb: "a padlock over other modules",
    kind: "keep",
    desk: { w: 300, h: 420 },
    mobile: { w: 2, h: 7 },
    init: () => ({ ids: [], pinHash: null }),
  },
  // strips: [{ id, frames: [{ imageId }], filter, at }], newest first. It owns the frame pictures.
  // Only claims a paste of two or more pictures (one picture is a scrapbook's job).
  photostrip: {
    label: "Photo strips",
    blurb: "booth strips pinned on a line",
    kind: "keep",
    desk: { w: 380, h: 340 },
    mobile: { w: 2, h: 5 },
    init: () => ({ strips: [] }),
    accepts: { image: { rank: 0, why: "pin them up as a photo strip", when: (p) => p.images.length > 1 } },
    takeIn: (state, p) => withStrips(state, stripsFrom(p.imageIds, "none")),
  },
  // books: [{ id, title, author, pages, page, status: want|reading|read, color, coverId?, isbn?, startedAt?, finishedAt? (day keys), rating? }]; sendTo: wires for pages read
  books: {
    label: "Bookshelf",
    blurb: "spines, bookmarks, pages read",
    kind: "list",
    needs: [],
    desk: { w: 360, h: 420 },
    mobile: { w: 2, h: 6 },
    init: () => ({ books: [] }),
  },
  // slips: [{ id, text, shelfId?, bookId?, title?, author?, page?, carded?, at }]
  highlights: {
    label: "Highlights",
    blurb: "quote slips from your books",
    kind: "keep",
    desk: { w: 320, h: 400 },
    mobile: { w: 2, h: 6 },
    init: () => ({ slips: [] }),
    accepts: {
      lines: { rank: 3, why: "a quote slip per line" },
      paragraph: { rank: 2, why: "tear it out as a quote slip" },
      line: { rank: 4, why: "a quote slip" },
    },
    takeIn: (state, p) => {
      const texts = p.kind === "paragraph" ? [p.text] : p.lines ?? [p.text];
      return { ...state, slips: [...texts.filter(Boolean).map((text) => ({ id: uid(), text, at: Date.now() })), ...(state.slips ?? [])] };
    },
  },
  // focus, short, long (minutes), every (rounds per cycle), phase, round, startedAt, marks: [{ at, mins }], mix: { brown, pink, white, rain, cafe: 0..1 }; sendTo: wires for focus minutes
  focus: {
    label: "Focus booth",
    blurb: "pomodoro + rain, café & hush",
    kind: "track",
    desk: { w: 280, h: 560 },
    mobile: { w: 2, h: 9 },
    init: () => ({ focus: 25, short: 5, long: 15, every: 4, phase: "focus", round: 0, startedAt: null, marks: [], mix: { rain: 0.5 } }),
  },
  // units: [{ id, text (may hold @-mention tokens), due?: day key, done }]
  syllabus: {
    label: "Study plan",
    blurb: "units, due dates, percent done",
    kind: "list",
    desk: { w: 340, h: 380 },
    mobile: { w: 2, h: 6 },
    init: () => ({ units: [] }),
  },
  // frames: [{ id (local shelf), at }], oldest first: the pictures stay on this computer. rise: the dough's start line (0..1 down the picture) or null.
  timelapse: {
    label: "Time-lapse",
    blurb: "a camera on a tripod, a frame every so often",
    kind: "keep",
    needs: ["camera"],
    desk: { w: 340, h: 600 },
    mobile: { w: 2, h: 10 },
    init: () => ({ deviceId: "", every: 60, mins: 240, frames: [], rise: null, fps: 8 }),
  },
  // ingredients: [{ id, q, u, name }]; steps: [{ text, mins }]; scale multiplies amounts; serves is what it was written for
  recipe: {
    label: "Recipe card",
    blurb: "scales, baker's %, talks you through it",
    kind: "keep",
    desk: { w: 340, h: 600 },
    mobile: { w: 2, h: 8 },
    init: () => ({ ingredients: [], steps: [], scale: 1, serves: 4, mode: "scale", system: "g" }),
    accepts: {
      lines: { rank: 0, why: "an index card: ingredients, steps & timers", when: (p) => parseRecipe(p.text).ingredients.length > 1 },
      paragraph: { rank: 0, why: "an index card: ingredients, steps & timers", when: (p) => parseRecipe(p.text).ingredients.length > 1 },
    },
    takeIn: (state, p) => {
      const r = parseRecipe(p.text);
      return { ...state, ingredients: [...(state.ingredients ?? []), ...r.ingredients], steps: [...(state.steps ?? []), ...r.steps] };
    },
  },
  // bakes: [{ id, at, name, rating (1-5), hyd?, notes?, imageId? }], newest first. It owns the photos. sendTo: where the rating goes.
  bakes: {
    label: "Bake log",
    blurb: "a notebook of bakes, rated in loaves",
    kind: "track",
    desk: { w: 320, h: 460 },
    mobile: { w: 2, h: 7 },
    init: () => ({ bakes: [], sendTo: [] }),
  },
  // doll: { shape, skin }; cuts: [{ id, name, imageId (transparent PNG it owns), ar, from?: { boardId, modId, title, url, price, currency } }];
  // inbox: [{ id, imageId }] pasted photos waiting to be cut; looks: [{ id, name, layers: [{ id, cid, x, y (0-1 of the stage), s (width, 0-1), r (deg) }] }] bottom layer first
  paperdoll: {
    label: "Paper doll",
    blurb: "cut out garments, dress the doll",
    kind: "keep",
    desk: { w: 500, h: 640 },
    mobile: { w: 2, h: 11 },
    init: () => {
      const id = uid();
      return { doll: { shape: "curvy", skin: "#c98f63" }, cuts: [], inbox: [], looks: [{ id, name: "Look 1", layers: [] }], active: id };
    },
    accepts: { image: { rank: 3, why: "keep it to cut a garment out of", when: (p) => p.images.length === 1 } },
    takeIn: (state, p) => ({ ...state, inbox: [...(state.inbox ?? []), ...p.imageIds.map((imageId) => ({ id: uid(), imageId }))] }),
  },
  // items: [{ id, name, cat, hex, cost, bought (day key), imageId?, pic?, url?, wears: [day keys], at }]. It owns the photos.
  closet: {
    label: "Closet",
    blurb: "hangers, wear counts, cost per wear",
    kind: "track",
    desk: { w: 440, h: 560 },
    mobile: { w: 2, h: 9 },
    init: () => ({ items: [] }),
    accepts: {
      image: { rank: 4, why: "hang it up as a piece you own" },
      link: { shop: { rank: 3, why: "a piece you bought" } },
      lines: { rank: 4, why: "a hanger per line" },
      line: { rank: 4, why: "hang it up" },
    },
    takeIn: (state, p) => ({ ...state, items: [...piecesFrom(p), ...(state.items ?? [])] }),
  },
  // unit: in | cm; on: day key; vals: { bust, waist, ... }; charts: [{ id, name, text }] (the shop's rows, as pasted); glance: opt-in
  measure: {
    label: "Tape measure",
    blurb: "your measurements + size charts",
    kind: "keep",
    desk: { w: 380, h: 640 },
    mobile: { w: 2, h: 10 },
    init: () => ({ unit: "in", on: null, vals: {}, charts: [], active: null, glance: false }),
    accepts: {
      lines: { rank: 0, why: "read it as a size chart", when: (p) => looksLikeChart(p.text) },
      paragraph: { rank: 0, why: "read it as a size chart", when: (p) => looksLikeChart(p.text) },
    },
    takeIn: (state, p) => {
      const c = { id: uid(), name: `Chart ${(state.charts?.length ?? 0) + 1}`, text: p.text };
      return parseChart(p.text) ? { ...state, charts: [...(state.charts ?? []), c], active: c.id } : state;
    },
  },
  // Runner pack ────────────────────────────────────────────────────────────
  // runs: [{ id, at, miles, secs, entryId }] newest first (the squashed line itself lives in a kind "run" entry
  // as an encoded polyline); shown: id of the run on the map; sendTo: wires. It owns its run entries.
  route: {
    label: "Route map",
    blurb: "run with GPS, or draw a route",
    kind: "track",
    desk: { w: 360, h: 480 },
    mobile: { w: 2, h: 8 },
    init: () => ({ runs: [], shown: null }),
  },
  // plan: warm / reps / hardName+hardSecs / easyName+easySecs / cool (seconds), voice: speak the cues
  intervals: {
    label: "Interval coach",
    blurb: "a clipboard that calls the moves",
    kind: "track",
    desk: { w: 270, h: 450 },
    mobile: { w: 2, h: 6 },
    init: () => ({ warm: 300, reps: 6, hardName: "run", hardSecs: 60, easyName: "walk", easySecs: 90, cool: 300, voice: true }),
  },
  // miles on the odometer; retired: [{ id, name, miles, from, at }]
  shoes: {
    label: "Shoe odometer",
    blurb: "miles on your sneakers, 'til they're done",
    kind: "track",
    desk: { w: 260, h: 360 },
    mobile: { w: 2, h: 6 },
    init: () => ({ name: "my trusty pair", miles: 0, retireAt: 400, since: Date.now(), retired: [] }),
    // a run's miles wear them down; minutes and beats from other places aren't theirs to count
    receive: (state, r) =>
      r.unit === "mi" && r.value > 0 ? { ...state, miles: Math.round(((state.miles ?? 0) + r.value) * 100) / 100 } : state,
  },
  // maxHr: for the zone ring. The strap connection itself isn't saved (Bluetooth can't be).
  heartrate: {
    label: "Heart-rate strap",
    blurb: "a beating heart from your chest strap",
    kind: "track",
    needs: ["bluetooth"],
    desk: { w: 250, h: 420 },
    mobile: { w: 2, h: 6 },
    init: () => ({ maxHr: 190 }),
  },
  // ── More controls: other bodies for the same idea as File folders ────────────
  // Each is a container: state { tabs: [{ id, name }], active }, a surface per tab.
  //   fixedTabs: the tab list is part of the object (no + tab, nothing to share into it)
  //   panels:    how many surfaces show side by side (so new things don't spread past one)
  //   shut(state): true while its insides are out of reach (see isShut)
  //   pinsOnGoto: opening something inside it by search stays put instead of following the clock
  // drawers: one drawer slides open at a time; the others stay shut and show a count.
  drawers: {
    label: "Drawers",
    blurb: "a little chest, one drawer open at a time",
    kind: "control",
    container: true,
    desk: { w: 460, h: 540 },
    mobile: { w: 2, h: 9 },
    init: () => {
      const ids = [uid(), uid(), uid()];
      return { tabs: ["Top drawer", "Middle drawer", "Bottom drawer"].map((name, i) => ({ id: ids[i], name })), active: ids[0] };
    },
  },
  // deck: a stack of cards, one on top; ‹ › or swipe to cycle.
  deck: {
    label: "Deck",
    blurb: "a stack of cards, swipe through them",
    kind: "control",
    container: true,
    desk: { w: 420, h: 520 },
    mobile: { w: 2, h: 8 },
    init: () => {
      const ids = [uid(), uid(), uid()];
      return { tabs: ids.map((id, i) => ({ id, name: `Card ${i + 1}` })), active: ids[0] };
    },
  },
  // routine: steps are tabs in order. run: null | { startedAt, stepAt, done: { [stepId]: { at, mins, how } } }
  // lastDone: { at, mins } of the last finished run
  routine: {
    label: "Routine",
    blurb: "a practice checklist; steps tick off as you work",
    kind: "control",
    container: true,
    desk: { w: 480, h: 560 },
    mobile: { w: 2, h: 9 },
    init: () => {
      const ids = [uid(), uid(), uid()];
      return { tabs: ["Warm up", "The main thing", "Wind down"].map((name, i) => ({ id: ids[i], name })), active: ids[0], run: null, lastDone: null };
    },
  },
  // dayparts: each tab has hours (from → to, wrapping past midnight) and days (0 = Sunday … 6).
  // pin: true shows `active` and ignores the clock.
  dayparts: {
    label: "Clock",
    blurb: "shows the right tab for the time of day",
    kind: "control",
    container: true,
    pinsOnGoto: true,
    desk: { w: 520, h: 500 },
    mobile: { w: 2, h: 8 },
    init: () => {
      const ids = [uid(), uid(), uid(), uid()];
      const all = [0, 1, 2, 3, 4, 5, 6];
      return {
        tabs: [
          { id: ids[0], name: "Morning", from: 5, to: 12, days: all },
          { id: ids[1], name: "Afternoon", from: 12, to: 18, days: all },
          { id: ids[2], name: "Evening", from: 18, to: 5, days: all },
          { id: ids[3], name: "Weekend", from: 0, to: 24, days: [0, 6] },
        ],
        active: ids[0],
        pin: false,
      };
    },
  },
  // capsule: one surface to fill, then seal until sealedUntil (ms). While sealed its insides
  // are hidden here (not encrypted: it's a promise to yourself). celebrated = the opening party happened.
  capsule: {
    label: "Time capsule",
    blurb: "fill it, seal it, open it on a date",
    kind: "control",
    container: true,
    fixedTabs: true,
    desk: { w: 420, h: 440 },
    mobile: { w: 2, h: 7 },
    shut: (s) => !!s.sealedUntil && Date.now() < s.sealedUntil,
    init: () => {
      const id = uid();
      return { tabs: [{ id, name: "Inside" }], active: id, sealedUntil: null, sealedAt: null, celebrated: false };
    },
  },
  // split: exactly two surfaces side by side with a draggable divider (stacked on a phone)
  split: {
    label: "Split",
    blurb: "two surfaces side by side, to compare",
    kind: "control",
    container: true,
    fixedTabs: true,
    panels: 2,
    desk: { w: 760, h: 460 },
    mobile: { w: 2, h: 10 },
    init: () => {
      const ids = [uid(), uid()];
      return { tabs: [{ id: ids[0], name: "Before" }, { id: ids[1], name: "After" }], active: ids[0], ratio: 0.5 };
    },
  },
  // plants: [{ id, name, kind, every (days), light, watered (ms), feedEvery (weeks), fed, notes,
  //   photos: [{ imageId, at }], history }]. It owns its progress photos.
  plants: {
    label: "Plant tags",
    blurb: "a windowsill that droops when thirsty",
    kind: "track",
    desk: { w: 440, h: 540 },
    mobile: { w: 2, h: 7 },
    init: () => ({ plants: [] }),
  },
  // place {name,lat,lon}, units "F"|"C", lastFrost / firstFrost "MM-DD", seeds [{ id, name, indoors, sow, done }]
  garden: {
    label: "Frost & sow",
    blurb: "forecast, last frost, what to sow now",
    kind: "track",
    desk: { w: 440, h: 620 },
    mobile: { w: 2, h: 10 },
    init: () => ({ place: null, units: "F", lastFrost: "", firstFrost: "", seeds: [] }),
  },
  // cuttings: [{ id, name, kind, start (ms), roots (cm), waterAt (ms) }]
  propagate: {
    label: "Propagation station",
    blurb: "jars of cuttings, growing roots",
    kind: "track",
    desk: { w: 400, h: 380 },
    mobile: { w: 2, h: 7 },
    init: () => ({ cuttings: [] }),
  },
  // ── Studio pack ──
  // images: reference photo ids it owns; secs/count/klass: how long and how many (klass = the "class" mix)
  gesture: {
    label: "Gesture timer",
    blurb: "an easel that flips your reference photos",
    kind: "track",
    desk: { w: 330, h: 560 },
    mobile: { w: 2, h: 8 },
    init: () => ({ images: [], secs: 60, count: 10, klass: false, sendTo: [] }),
  },
  // imageId: the one reference it owns; gray / levels (0|3|5) / flip / grid (none|thirds|4x4) / squint are just how it's shown
  values: {
    label: "Value check",
    blurb: "grey, posterize, flip & squint a reference",
    kind: "keep",
    desk: { w: 340, h: 460 },
    mobile: { w: 2, h: 7 },
    init: () => ({ imageId: null, gray: false, levels: 0, flip: false, grid: "none", squint: false }),
  },
  // pages: [{ id, imageId, at, day, note }] oldest first. It owns the page pictures.
  sketchbook: {
    label: "Sketchbook",
    blurb: "photographed pages, a streak of days",
    kind: "keep",
    desk: { w: 340, h: 470 },
    mobile: { w: 2, h: 7 },
    init: () => ({ pages: [] }),
    accepts: { image: { rank: 2, why: "new pages in the sketchbook" } },
    takeIn: (state, p) => ({
      ...state,
      pages: [...(state.pages ?? []), ...p.imageIds.map((imageId) => ({ id: uid(), imageId, at: Date.now(), day: dayKey(), note: "" }))],
    }),
  },
  // goal; day/base/sbase/banked: today's baselines (see components/modules/Typewriter);
  // sheet: the page in the roller; n/nday: today's count for the glance; loggedDay: goal already logged
  typewriter: {
    label: "Typewriter",
    blurb: "a daily word goal, on a real sheet",
    kind: "track",
    desk: { w: 340, h: 500 },
    mobile: { w: 2, h: 8 },
    init: () => ({ goal: 500, day: null, base: 0, sbase: 0, banked: 0, sheet: "", clack: true, hard: false, loggedDay: null, n: 0, nday: null, sendTo: [] }),
  },
  // cards: [{ id, text, x, y, color }], threads: [{ a, b (card ids), c (string colour) }]
  corkboard: {
    label: "Corkboard",
    blurb: "index cards & string for scenes and ideas",
    kind: "keep",
    desk: { w: 440, h: 380 },
    mobile: { w: 2, h: 6 },
    init: () => ({ cards: [], threads: [] }),
    accepts: {
      lines: { rank: 3, why: "a card pinned up for every line" },
      paragraph: { rank: 4, why: "pinned up as a card" },
      line: { rank: 4, why: "pinned up as a card" },
    },
    takeIn: (state, p) => withCards(state, p.kind === "text" && p.lines.length > 1 ? p.lines : [p.text]),
  },
  // ── Home & table ──
  // people: [{ id, name, by? }]; chores: [{ id, text, by? }]; face: "chores" | "people" (what's on the wheel);
  // mode: "wheel" | "rotate"; log: [{ id, chore, pid, name, at, doneAt, rot?, wk?, by? }], newest first
  chores: {
    label: "Chore wheel",
    blurb: "spin for who does what",
    kind: "track",
    desk: { w: 340, h: 600 },
    mobile: { w: 2, h: 9 },
    init: () => ({
      people: [],
      chores: ["Dishes", "Trash", "Vacuum", "Laundry", "Feed the pets", "Tidy up"].map((text) => ({ id: uid(), text })),
      face: "chores",
      mode: "wheel",
      log: [],
    }),
    accepts: { lines: { rank: 3, why: "a chore on the wheel per line" } },
    takeIn: (state, p) => ({ ...state, chores: [...(state.chores ?? []), ...p.lines.map((text) => ({ id: uid(), text }))] }),
  },
  // items: [{ id, text, qty, aisle, done, doneAt?, at, by? }]; learn: { word: aisle } from aisles you moved things to
  groceries: {
    label: "Grocery list",
    blurb: "a receipt, by aisle",
    kind: "list",
    desk: { w: 280, h: 480 },
    mobile: { w: 2, h: 8 },
    init: () => ({ items: [], learn: {} }),
    accepts: {
      lines: { rank: 0, why: "onto the receipt, sorted by aisle", when: (p) => p.lines.length > 1 },
      line: { rank: 3, why: "onto the grocery receipt" },
    },
    takeIn: (state, p) => (p.lines ?? [p.text]).reduce(addLine, state),
  },
  // pigs: [{ id, name, goal (cents), label, color, ledger: [{ id, c (cents, + in / - out), note, at, by? }], by? }]
  piggy: {
    label: "Piggy bank",
    blurb: "coins toward a goal, with a ledger",
    kind: "track",
    desk: { w: 280, h: 520 },
    mobile: { w: 2, h: 8 },
    init: () => {
      const id = uid();
      return { pigs: [{ id, name: "Piggy", goal: 6000, label: "", color: "#ffc4d0", ledger: [] }], active: id, cur: "$" };
    },
  },
  // tray: { d6: 2 } dice on the tray; mod: plus/minus; adv: null | "adv" | "dis"; history: [{ id, at, label, rolls: [{ s, v, drop? }], mod, total, by? }]
  dice: {
    label: "Dice tray",
    blurb: "roll d4 to d100, keep the rolls",
    kind: "track",
    desk: { w: 320, h: 560 },
    mobile: { w: 2, h: 9 },
    init: () => ({ tray: { d6: 2 }, mod: 0, adv: null, history: [] }),
  },
  // crew: [{ id, name, init, bonus, hp, max, conds: [], foe, by? }]; turn = id of whose go; started; round
  initiative: {
    label: "Turn order",
    blurb: "initiative, HP & conditions",
    kind: "track",
    desk: { w: 340, h: 480 },
    mobile: { w: 2, h: 8 },
    init: () => ({ crew: [], round: 1, turn: null, started: false }),
  },
  // Doses are entries (kind "dose"); the module keeps the meds and a few days of slots
  meds: {
    label: "Medicine cabinet",
    blurb: "bottles, vials & pens that remind you",
    kind: "track",
    desk: { w: 360, h: 450 },
    mobile: { w: 2, h: 7 },
    init: () => ({ meds: [], notify: false, hideNames: false }),
  },
  // lang: language name for lookups; stack: [{ id, word, lang, gloss, at }] words you kept; torn: [{ day, word, lang }] used pages; salt: reshuffles today's word
  wordday: {
    label: "Word-a-day calendar",
    blurb: "look up words, tear off a page a day",
    kind: "web",
    desk: { w: 300, h: 330 },
    mobile: { w: 2, h: 5 },
    init: () => ({ lang: "English", stack: [], torn: [] }),
    accepts: {
      line: { rank: 4, why: "a word for the stack" },
      lines: { rank: 4, why: "a word per line for the stack" },
    },
    takeIn: (state, p) => ({
      ...state,
      stack: [
        ...String(p.text ?? "").split("\n").map((w) => w.trim()).filter(Boolean).slice(0, 30)
          .map((word) => ({ id: uid(), word, lang: state.lang ?? "English", gloss: "", at: Date.now() })),
        ...(state.stack ?? []),
      ],
    }),
  },
  // from / to: language codes; topic: open tab; topics: [string]; phrases: [{ id, topic, from, to, src, dst, at }]. Titled "<Language> phrasebook" until renamed
  phrasebook: {
    label: "Phrasebook",
    blurb: "translate & keep phrases by topic",
    kind: "web",
    desk: { w: 300, h: 350 },
    mobile: { w: 2, h: 5 },
    init: () => ({ from: "en", to: "es", topic: "greetings", topics: ["greetings", "food", "travel", "feelings", "numbers", "other"], phrases: [] }),
  },
  // mode: "grade" | "jlpt"; level; known: [char]; sel: char being studied; daily: { day, char }; days: [dayKey] practiced
  kanji: {
    label: "Character sheet",
    blurb: "kanji practice paper & a daily new one",
    kind: "web",
    desk: { w: 300, h: 410 },
    mobile: { w: 2, h: 6 },
    init: () => ({ mode: "grade", level: 1, known: [], sel: null, daily: null, days: [] }),
  },
  // favs: [{ id, title, author, lines }]; ribbon: id of the bookmarked favorite
  poems: {
    label: "Poetry anthology",
    blurb: "a poem a day, favorites & a ribbon",
    kind: "web",
    desk: { w: 300, h: 400 },
    mobile: { w: 2, h: 6 },
    init: () => ({ favs: [], ribbon: null }),
  },
  // @pack:words
  // Lyric sheet: song { id, title, artist, album, duration, plain, synced } | null, mem [normalised lines known by heart], speed 1|.75|.5, query (pasted, waiting)
  lyrics: {
    label: "Lyric sheet",
    blurb: "words to learn, sing-along clock",
    kind: "web",
    desk: { w: 300, h: 400 },
    mobile: { w: 2, h: 7 },
    init: () => ({ song: null, mem: [], speed: 1, query: "" }),
    accepts: {
      line: { rank: 3, why: "look up the words", when: (p) => /\s[–—-]\s|\sby\s/i.test(p.lines[0] ?? "") && !chordLine(p.lines[0]) },
    },
    takeIn: (state, p) => ({ ...state, query: p.lines[0] }),
  },
  // Record crate: crate [{ id, mbid, title, artist, year }] to hear, played [{ ...record, at, stars }], idx (sleeve up front)
  crate: {
    label: "Record crate",
    blurb: "albums to hear, then played",
    kind: "web",
    desk: { w: 300, h: 420 },
    mobile: { w: 2, h: 7 },
    init: () => ({ crate: [], played: [], idx: 0 }),
  },
  // Now listening: user (Last.fm name), onRepeat { artist, plays } kept for the Glance. Needs a Last.fm key.
  scrobbles: {
    label: "Now listening",
    blurb: "a turntable of your Last.fm plays",
    kind: "web",
    keys: ["lastfm"],
    desk: { w: 300, h: 380 },
    mobile: { w: 2, h: 6 },
    init: () => ({ user: "", onRepeat: null }),
  },
  // Chord chart: inst "guitar"|"ukulele", prog "C G Am F", bpm, beats per chord. Shapes are worked out locally.
  chords: {
    label: "Chord chart",
    blurb: "diagrams, strum & practise changes",
    kind: "keep",
    desk: { w: 320, h: 420 },
    mobile: { w: 2, h: 7 },
    init: () => ({ inst: "guitar", prog: "C G Am F", bpm: 80, beats: 4 }),
    accepts: {
      line: { rank: 2, why: "chord diagrams", when: (p) => chordLine(p.lines[0]) },
    },
    takeIn: (state, p) => ({ ...state, prog: p.lines[0].trim() }),
  },
  // @pack:music
  // items: [{ id, kind: "show"|"movie", title, tvmaze?, imdb?, status, network, img, seasons: [[season, total, aired]], next: {s,e,name,at}, seen: {season: [ep numbers]}, checkedAt, done?, date?, tmdb?, providers?, seenAt? }]
  tvguide: {
    label: "TV guide",
    blurb: "next episodes, where you are, finished shelf",
    kind: "web",
    desk: { w: 340, h: 400 },
    mobile: { w: 2, h: 6 },
    init: () => ({ items: [] }),
    accepts: {
      link: {
        watch: { rank: 0, why: "follow it in the TV guide", when: (p) => p.links.some((l) => showRefOf(l.url)) },
        page: { rank: 0, why: "follow it in the TV guide", when: (p) => p.links.some((l) => showRefOf(l.url)) },
      },
    },
    takeIn: (state, p) => ({
      ...state,
      items: [
        ...(state.items ?? []),
        ...p.links.filter((l) => showRefOf(l.url)).map((l) => ({ id: uid(), kind: "show", title: l.title, addedAt: Date.now(), ...showRefOf(l.url) })),
      ],
    }),
  },
  // books: [{ id, gid, title, author, cover, page (pages finished), pages, textId? (local text), read (url), status: reading|read, lastAt, startedAt?, finishedAt? }]; cur; goal (pages/day); days {day: pages}; logged {day: pages}; sendTo
  paperback: {
    label: "Paperback",
    blurb: "a public-domain book, a few pages a day",
    kind: "web",
    needs: [],
    desk: { w: 340, h: 460 },
    mobile: { w: 2, h: 8 },
    init: () => ({ books: [], cur: null, goal: 5, days: {}, logged: {} }),
  },
  // games: [{ id, title, platform, status: backlog|playing|beaten|dropped, hours, cover?, released?, meta?, rawg?, addedAt, lastAt?, startedAt?, endedAt? }]
  backlog: {
    label: "Game backlog",
    blurb: "cartridges waiting, playing, beaten",
    kind: "track",
    desk: { w: 340, h: 360 },
    mobile: { w: 2, h: 6 },
    init: () => ({ games: [] }),
  },
  // @pack:screen
  // The puzzle itself is fetched (Lichess daily) and cached; state keeps the progress:
  // streak / best (days in a row), lastSolved (day key), total solved, dailyId + dailyResult ("solved" | "failed")
  chesspuzzle: {
    label: "Chess puzzle",
    blurb: "today's Lichess puzzle on a wooden board",
    kind: "web",
    desk: { w: 320, h: 440 },
    mobile: { w: 2, h: 7 },
    init: () => ({ streak: 0, best: 0, lastSolved: null, total: 0 }),
  },
  // cat: last category id (0 = anything); rounds: [{ id, at, cat, score, of }] newest last, max 60
  trivia: {
    label: "Trivia night",
    blurb: "a buzzer, ten questions, a scoreboard",
    kind: "web",
    desk: { w: 320, h: 400 },
    mobile: { w: 2, h: 6 },
    init: () => ({ cat: 0, rounds: [] }),
  },
  // lang: edition for new starts; trail: [card] (last = where you are); dead: [{ id, lang, title }];
  // favs: [card]; past: [{ id, at, cards }]. card = { id, at, lang, title, key, desc, extract, thumb, url }
  rabbithole: {
    label: "Rabbit hole",
    blurb: "index cards down Wikipedia's links",
    kind: "web",
    desk: { w: 320, h: 440 },
    mobile: { w: 2, h: 7 },
    init: () => ({ lang: "en", trail: [], dead: [], favs: [], past: [] }),
    accepts: {
      link: { page: { rank: -1, why: "start a rabbit hole here", when: (p) => /wikipedia\.org\/wiki\//i.test(p.links?.[0]?.url ?? "") } },
    },
    takeIn: (state, p) => {
      const m = /\/\/(?:([a-z-]{2,12})\.)?(?:m\.)?wikipedia\.org\/wiki\/([^?#\s]+)/i.exec(p.links[0].url);
      if (!m) return state;
      let title = m[2];
      try { title = decodeURIComponent(title); } catch { /* keep as is */ }
      // the card opens itself: a pending start the module resolves on mount
      return { ...state, lang: (m[1] || "en").toLowerCase(), start: title.replace(/_/g, " ") };
    },
  },
  // place: { name, lat, lon } | null (for sunrise & sunset); favs: [{ id, text, year, md, title, url }];
  // today: { day, line } the glance line, saved when today's page loads
  almanac: {
    label: "Almanac",
    blurb: "tear-off page: on this day, sun & moon",
    kind: "web",
    desk: { w: 320, h: 400 },
    mobile: { w: 2, h: 6 },
    init: () => ({ place: null, favs: [] }),
  },
  // @pack:games
  // place {name,lat,lon}, units "F"|"C"
  barometer: {
    label: "Barometer",
    blurb: "pressure trend, rain, air quality, a run hour",
    kind: "web",
    desk: { w: 300, h: 360 },
    mobile: { w: 2, h: 5 },
    init: () => ({ place: null, units: "F" }),
  },
  // place {name,lat,lon}, seen [{ id, kind: "iss"|"launch"|"moon"|"other", label, at }]
  stargazer: {
    label: "Star wheel",
    blurb: "tonight's sky, the ISS, launches, moon",
    kind: "web",
    desk: { w: 320, h: 470 },
    mobile: { w: 2, h: 6 },
    init: () => ({ place: null, seen: [] }),
  },
  // place {name,lat,lon}, life [{ id, taxonId, name, sci, photo, group, at, note, place }]
  fieldguide: {
    label: "Field guide",
    blurb: "what's seen near you, and your life list",
    kind: "web",
    desk: { w: 320, h: 380 },
    mobile: { w: 2, h: 8 },
    init: () => ({ place: null, life: [] }),
    accepts: { line: { rank: 6, why: "add it to your life list" } },
    takeIn: (state, p) => ({
      ...state,
      life: [{ id: uid(), taxonId: null, name: p.text.trim(), sci: "", photo: null, group: "other", at: Date.now(), note: "", place: state.place?.name ?? "" }, ...(state.life ?? [])],
    }),
  },
  // place {name,lat,lon}, station {id,name,lat,lon}|null (NOAA, US only), units "ft"|"m", noStation (place the person opted out of a station for)
  tides: {
    label: "Tide clock",
    blurb: "next high & low tide, waves",
    kind: "web",
    desk: { w: 300, h: 380 },
    mobile: { w: 2, h: 5 },
    init: () => ({ place: null, station: null, units: "ft", noStation: "" }),
  },
  // stamps: [{ id, cc, date, note }]; want: [{ id, cc, note }] (country list is built in)
  passport: {
    label: "Passport",
    blurb: "ink stamps for places you've been",
    kind: "web",
    desk: { w: 300, h: 290 },
    mobile: { w: 2, h: 4 },
    init: () => ({ stamps: [], want: [] }),
  },
  // home / trip: currency codes; budget in the trip currency; spends: [{ id, day, label, amt, cur, rate }]
  wallet: {
    label: "Travel wallet",
    blurb: "foreign money, a budget & today's rate",
    kind: "web",
    desk: { w: 290, h: 340 },
    mobile: { w: 2, h: 5 },
    init: () => ({ home: "USD", trip: "EUR", budget: 0, start: "", end: "", spends: [] }),
  },
  // country: ISO code for the holidays; days: [{ id, date, end?, label }] your own days off and trips
  daysoff: {
    label: "Days off",
    blurb: "holidays, trips & long weekends",
    kind: "web",
    desk: { w: 290, h: 380 },
    mobile: { w: 2, h: 6 },
    init: () => ({ country: "", days: [] }),
  },
  // place {name,lat,lon}|null; kind: a PLACE_KINDS id; pins: [{ id, name, lat, lon, kind, addr, done, note }]
  errands: {
    label: "Errand map",
    blurb: "pin nearby shops & parks, check them off",
    kind: "web",
    desk: { w: 300, h: 420 },
    mobile: { w: 2, h: 7 },
    init: () => ({ place: null, kind: "thrift", pins: [] }),
  },
  // @pack:travel
  // items: [{ id, name, brand?, qty?, code?, shelf: "pantry"|"fridge"|"freezer", expires ("YYYY-MM-DD" | ""), low, grade?, at, doneAt?, how?: "used"|"tossed", by? }]
  pantry: {
    label: "Pantry shelf",
    blurb: "jars & cans that know when they expire",
    kind: "web",
    desk: { w: 340, h: 280 },
    mobile: { w: 2, h: 4 },
    init: () => ({ items: [] }),
  },
  // cards: [{ id, mealId, name, thumb, area, category, at }]; ings: last "what can I make with" words; tonight: a card name
  recipetin: {
    label: "Recipe tin",
    blurb: "what can I make? plus index cards to keep",
    kind: "web",
    desk: { w: 320, h: 300 },
    mobile: { w: 2, h: 4 },
    init: () => ({ cards: [], ings: [], tonight: "" }),
  },
  // have: bottle names the cart holds (TheCocktailDB ingredient names); mocktails: alcohol-free only; favs: [{ id, name, thumb }]
  barcart: {
    label: "Bar cart",
    blurb: "tick your bottles, see what you can mix",
    kind: "web",
    desk: { w: 330, h: 370 },
    mobile: { w: 2, h: 5 },
    init: () => ({ have: [], mocktails: false, favs: [] }),
  },
  // museums: which collections are on the rack (artic | met | cleveland); favs: [{ key, museum, id, title, artist, date, img (a URL), url, at }]
  postcards: {
    label: "Museum postcards",
    blurb: "a spinning rack of real artworks",
    kind: "web",
    desk: { w: 320, h: 400 },
    mobile: { w: 2, h: 6 },
    init: () => ({ museums: ["artic", "met", "cleveland"], favs: [] }),
  },
  // @pack:kitchen
  // catalog: cards: [{ id, title, authors: [{ given, family }], year, abstract, doi, arxiv, url, venue, pdf, cites,
  //   status: "toread" | "reading" | "read", notes, readAt (day key), addedAt, pending?: { doi } | { arxiv } (a pasted id still being looked up) }]
  catalog: {
    label: "Card catalog",
    blurb: "papers to read, in a library drawer",
    kind: "web",
    desk: { w: 300, h: 340 },
    mobile: { w: 2, h: 5 },
    init: () => ({ cards: [] }),
    accepts: {
      link: { page: { rank: 0, why: "file the paper in the catalog", when: (p) => p.links.some((l) => refOf(l.url)) } },
      line: { rank: 0, why: "file the paper in the catalog", when: (p) => refsIn(p.text).length > 0 },
      lines: { rank: 0, why: "file the papers in the catalog", when: (p) => refsIn(p.text).length > 0 },
    },
    takeIn: (state, p) => {
      const refs = p.kind === "link" ? p.links.map((l) => refOf(l.url)).filter(Boolean) : refsIn(p.text);
      const have = new Set((state.cards ?? []).flatMap((c) => [c.doi, c.arxiv, c.pending?.doi, c.pending?.arxiv].filter(Boolean)));
      const cards = refs
        .filter((r) => !have.has(r.doi ?? r.arxiv))
        .map((r) => ({ id: uid(), title: r.doi ?? r.arxiv, authors: [], status: "toread", notes: "", addedAt: Date.now(), pending: r }));
      return { ...state, cards: [...cards, ...(state.cards ?? [])] };
    },
  },
  // sections: { hn, guardian, space } which are printed; read: { [story url]: ts } (faded); saved: { [story url]: true };
  // top: the top unread headline last printed (what the Glance shows)
  paper: {
    label: "Morning paper",
    blurb: "a folded front page of headlines",
    kind: "web",
    desk: { w: 320, h: 500 },
    mobile: { w: 2, h: 7 },
    init: () => ({ sections: { hn: true, space: true }, read: {}, saved: {}, top: null }),
  },
  // unit: "lb" | "kg"; lifts: [{ name, muscles, equip }] on the clipboard; cur: name of the lift shown;
  // log: [{ id, day, at, ex, reps, w }] newest first; sendTo: wires (a new record goes down them)
  lifting: {
    label: "Lifting log",
    blurb: "a gym clipboard: sets, PRs, weekly volume",
    kind: "track",
    desk: { w: 300, h: 360 },
    mobile: { w: 2, h: 6 },
    init: () => ({ unit: "lb", lifts: [], cur: null, log: [], sendTo: [] }),
  },
  // people: [{ id, name, city, tz (IANA), wake, sleep (hours 0-23) }]; me: { wake, sleep } for this person's own hours
  worldclock: {
    label: "World clocks",
    blurb: "little clocks & a time that works",
    kind: "keep",
    desk: { w: 340, h: 360 },
    mobile: { w: 2, h: 6 },
    init: () => ({ people: [], me: {} }),
  },
  // @pack:desk
  // A call for a shared board, up to 8 people, straight between browsers and never recorded. Holds nothing.
  practiceroom: {
    label: "Practice room",
    blurb: "a call with your people, never recorded",
    kind: "track",
    needs: ["mic"],
    desk: { w: 340, h: 220 },
    mobile: { w: 2, h: 4 },
    init: () => ({}),
  },
  // strokes: [{ id, c (colour), w (width), p: [x, y, …] }] in a 1000 x 750 space; games: [{ id, at, text, rows }] results of Draw it, newest first
  drawit: {
    label: "Chalkboard",
    blurb: "doodle, or play draw-it with friends",
    kind: "keep",
    desk: { w: 340, h: 360 },
    mobile: { w: 2, h: 6 },
    init: () => ({ strokes: [] }),
  },
  // frames: [string] pixel pictures, oldest first (lib/flipbook); speed: 1-8
  flipbook: {
    label: "Flipbook",
    blurb: "frame-by-frame doodles on two little screens",
    kind: "keep",
    desk: { w: 300, h: 540 },
    mobile: { w: 2, h: 7 },
    init: () => ({ frames: [], speed: 5 }),
  },
  // chat: the latest notes, [{ id, by (uid), name, color, at, px }] oldest first (lib/flipbook)
  pictochat: {
    label: "Picto chat",
    blurb: "draw little notes to everyone on the board",
    kind: "keep",
    desk: { w: 300, h: 560 },
    mobile: { w: 2, h: 7 },
    init: () => ({ chat: [] }),
  },
  // @pack:live
  // text: the page, as markdown (lib/markdown). Pictures of the board's own are ![](image:<id>).
  markdown: {
    label: "Markdown",
    blurb: "a page of markdown that shows as it'll look while you write",
    kind: "keep",
    desk: { w: 400, h: 440 },
    mobile: { w: 2, h: 5 },
    init: () => ({ text: "" }),
    accepts: {
      lines: { rank: -1, why: "a markdown page, shown as it'll look", when: (p) => p.md },
      paragraph: { rank: -1, why: "a markdown page, shown as it'll look", when: (p) => p.md },
    },
    takeIn: (state, p) => ({ ...state, text: state.text?.trim() ? `${state.text.replace(/\n+$/, "")}\n\n${p.text}` : p.text }),
  },
  // sounds: [{ id (local shelf), name, type, size, dur?, at, by }] played in order. The sound itself
  // stays on the computer it was added from (lib/localMedia); volume is each screen's own.
  soundbox: {
    label: "Sound box",
    blurb: "plays sound files, drawing them in a little round window",
    kind: "keep",
    needs: ["audio"],
    desk: { w: 260, h: 430 },
    mobile: { w: 1, h: 6 },
    init: () => ({ sounds: [] }),
    accepts: { audio: { rank: 0, why: "play it on a little wireless set" } },
    takeIn: (state, p) => ({ ...state, sounds: [...(state.sounds ?? []), ...(p.sounds ?? [])] }),
  },
  // items: [{ id, text, done }] in the order you go down them; ticks stay put until "uncheck all"
  checklist: {
    label: "Checklist",
    blurb: "boxes to tick, untick and use again",
    kind: "list",
    desk: { w: 260, h: 260 },
    mobile: { w: 2, h: 4 },
    init: () => ({ items: [] }),
    accepts: {
      lines: { rank: 0, why: "a box to tick per line", when: (p) => !p.md || /\[[ xX]\]/.test(p.text) },
      line: { rank: 4, why: "a box to tick" },
    },
    takeIn: (state, p) => ({ ...state, items: [...(state.items ?? []), ...asChecks(p.kind === "link" ? p.links.map((l) => l.title).join("\n") : p.text)] }),
  },
  // columns: [{ id, name }] left to right, the last one reading as done;
  // tickets: [{ id, col, title, at, moved? }] in the order they arrived in their column
  kanban: {
    label: "Ticket board",
    blurb: "name your own columns; tickets move across them",
    kind: "list",
    desk: { w: 520, h: 380 },
    mobile: { w: 2, h: 6 },
    init: () => {
      const ids = [uid(), uid(), uid()];
      return { columns: ["To do", "Doing", "Done"].map((name, i) => ({ id: ids[i], name })), tickets: [] };
    },
    accepts: {
      lines: { rank: 2, why: "a ticket per line, in the first column" },
      line: { rank: 5, why: "a ticket" },
    },
    takeIn: (state, p) => ({
      ...state,
      tickets: [...(state.tickets ?? []), ...(p.lines ?? [p.text]).map((title) => ({ id: uid(), col: state.columns[0]?.id, title, at: Date.now() }))],
    }),
  },
  // imageId: the picture (the frame owns it); frame: black | gallery | gilded | wood | oval;
  // mat: a white mat round it; fit: cover (fills the frame) | contain (the whole picture)
  frame: {
    label: "Picture frame",
    blurb: "one picture, hung in a frame you choose",
    kind: "keep",
    desk: { w: 260, h: 320 },
    mobile: { w: 1, h: 4 },
    init: () => ({ imageId: null, frame: "black", mat: false, fit: "cover" }),
    accepts: { image: { rank: 1, why: "hang it in a frame", when: (p) => p.images.length === 1 } },
    takeIn: (state, p) => ({ ...state, imageId: p.imageIds[0] }),
  },
  // @pack:media
};

// Controls don't hold a thing of their own; they hold other modules
export const MODULE_KINDS = [
  { id: "control", label: "Controls" },
  { id: "track", label: "Keep track" },
  { id: "list", label: "Lists" },
  { id: "keep", label: "Write & keep" },
  { id: "web", label: "From the web" },
];

export const MODULE_TYPES = [
  "folder", "tracker", "nextup", "tickets", "wishlist", "diary", "notes", "scrapbook",
  "timer", "punchcard", "flashcards", "setlist", "graph", "tally", "jar", "clipping", "links", "fortune",
  "tuner", "keys", "metronome", "tape", "staff", "magnets", "radio", "mirror", "paintchips",
  "window", "photostrip", "timelapse", "recipe", "bakes", "patchbay", "gauges", "shuffle", "spotlight", "lockbox", "meds",
  "books", "highlights", "focus", "syllabus",
  "paperdoll", "closet", "measure",
  "route", "intervals", "shoes", "heartrate",
  "drawers", "deck", "routine", "dayparts", "capsule", "split",
  "plants", "garden", "propagate",
  "gesture", "values", "sketchbook", "typewriter", "corkboard",
  "chores", "groceries", "piggy", "dice", "initiative",
  "wordday", "phrasebook", "kanji", "poems",
  // @pack:words
  "lyrics", "crate", "scrobbles", "chords",
  // @pack:music
  "tvguide", "paperback", "backlog",
  // @pack:screen
  "chesspuzzle", "trivia", "rabbithole", "almanac",
  // @pack:games
  "barometer", "stargazer", "fieldguide", "tides",
  // @pack:sky
  "passport", "wallet", "daysoff", "errands",
  // @pack:travel
  "pantry", "recipetin", "barcart", "postcards",
  // @pack:kitchen
  "catalog", "paper", "lifting", "worldclock",
  // @pack:desk
  "practiceroom",
  "drawit",
  "flipbook",
  "pictochat",
  // @pack:live
  "markdown",
  "soundbox",
  "checklist",
  "kanban",
  "frame",
  // @pack:media
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
