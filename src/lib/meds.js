// The medicine cabinet's rules, shared by the cabinet on the board, the live dock and
// the home glance. This only records what the person types in and when they took it:
// it never works out a dose, and a missed dose is just "skipped" or "nothing".
//
// A med lives in the module's state ({ meds: [...], notify, hideNames }); every dose
// is also an entry (kind "dose") so the history can grow without bloating the board doc.
// The module keeps a small `slots` map per med (today and a few days back) so "what's
// due" can be worked out without loading any entries.
import { uid } from "../utils/uid";
import { addEntry, deleteEntry } from "./data";
import { dayKey, addDays, keyToDate, dayDiff } from "../utils/date";

export const CONTAINERS = [
  { id: "bottle", label: "Rx bottle" },
  { id: "vial", label: "Glass vial" },
  { id: "syringe", label: "Syringe" },
  { id: "pen", label: "Pen injector" },
  { id: "blister", label: "Blister pack" },
  { id: "organizer", label: "Week organizer" },
  { id: "inhaler", label: "Inhaler" },
  { id: "dropper", label: "Dropper bottle" },
  { id: "tube", label: "Cream tube" },
  { id: "jar", label: "Vitamin jar" },
];

// Colours a container can come in. The first is the default.
export const TINTS = {
  bottle: ["#e8892b", "#d9b36a", "#4f9a62", "#4a7fc1", "#c9c4bb"],
  vial: ["#bfe3f2", "#f6e7a0", "#f4b6c8", "#cfe8b8"],
  syringe: ["#bfe3f2", "#f6e7a0", "#f4b6c8"],
  pen: ["#4a7fc1", "#7b5ea7", "#d9534f", "#4f9a62", "#2a2520"],
  blister: ["#d7dbe0", "#e9d9a8", "#f0c9d4"],
  organizer: ["#cfe8f4", "#f4cfdc", "#d9efc9", "#f6e7a0", "#e3d6f2"],
  inhaler: ["#4a7fc1", "#e8892b", "#7b5ea7", "#4f9a62", "#d9534f"],
  dropper: ["#e8892b", "#4a7fc1", "#c9c4bb", "#4f9a62"],
  tube: ["#4a9aa8", "#e8892b", "#d9534f", "#7b5ea7", "#f4f0e6"],
  jar: ["#f3b73c", "#4f9a62", "#d9534f", "#4a7fc1", "#7b5ea7"],
};

export const PILL_SHAPES = [
  { id: "round", label: "round" },
  { id: "oval", label: "oval" },
  { id: "capsule", label: "capsule" },
];
export const PILL_COLORS = ["#fbfaf5", "#ffb3c6", "#ffb35c", "#ffe27a", "#9fd88a", "#8ec5f2", "#e86a5e", "#c99a6b"];
export const NOTE_COLORS = ["#ffd84d", "#ff9f43", "#ff6b6b", "#6bb6ff", "#8fd48a"];
export const UNITS = ["pills", "doses", "mL", "puffs", "tablets"];

export const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

// Where an injection can go: x/y on a 100x200 front-facing body (see Meds.jsx)
export const SITES = [
  { id: "arm-r", label: "right arm", x: 22, y: 62 },
  { id: "arm-l", label: "left arm", x: 78, y: 62 },
  { id: "belly-ur", label: "belly, upper right", x: 42, y: 84 },
  { id: "belly-ul", label: "belly, upper left", x: 58, y: 84 },
  { id: "belly-lr", label: "belly, lower right", x: 42, y: 102 },
  { id: "belly-ll", label: "belly, lower left", x: 58, y: 102 },
  { id: "thigh-r", label: "right thigh", x: 40, y: 142 },
  { id: "thigh-l", label: "left thigh", x: 60, y: 142 },
];
export const siteLabel = (id) => SITES.find((s) => s.id === id)?.label ?? "";
export const injectable = (med) => med.container === "syringe" || med.container === "pen";
// Only these show a pill you pick the look of
export const usesPill = (med) => ["bottle", "blister", "organizer", "jar"].includes(med.container);
export const unitOf = (unit, n) => (n === 1 ? unit.replace(/s$/, "") : unit);

export function newMed(container = "bottle") {
  return {
    id: uid(),
    name: "",
    strength: "",
    directions: "",
    rx: "",
    refills: "",
    note: "",
    noteColor: NOTE_COLORS[0],
    container,
    tint: TINTS[container][0],
    pill: { shape: "round", color: PILL_COLORS[0], color2: PILL_COLORS[2] },
    asNeeded: false,
    minHours: "",
    times: ["08:00"],
    days: { mode: "every", dow: [1, 2, 3, 4, 5], n: 2 },
    start: "",
    end: "",
    supply: { left: "", full: "", unit: "pills", per: 1 },
    slots: {},
    lastAt: null,
    snoozeUntil: null,
    createdAt: Date.now(),
  };
}

// 8:00 pm style, from "20:00"
export function clockLabel(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}
export const atLabel = (ts) => {
  const d = new Date(ts);
  return clockLabel(`${d.getHours()}:${d.getMinutes()}`);
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDate = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

// Is the med on its schedule that day (start/end dates and the day pattern)?
export function onDay(med, date) {
  const key = dayKey(date);
  if (med.start && key < med.start) return false;
  if (med.end && key > med.end) return false;
  const { mode = "every", dow = [], n = 2 } = med.days ?? {};
  const wd = date.getDay();
  if (mode === "weekdays") return wd >= 1 && wd <= 5;
  if (mode === "custom") return dow.includes(wd);
  if (mode === "every-n") {
    const anchor = keyToDate(med.start || dayKey(med.createdAt ?? date));
    const diff = dayDiff(anchor, date);
    return diff >= 0 && diff % Math.max(1, n) === 0;
  }
  return true;
}

// The scheduled doses on one calendar day: [{ key, at }]. As-needed meds have none.
export function slotsOn(med, date) {
  if (med.asNeeded || !onDay(med, date)) return [];
  const day = dayKey(date);
  return [...(med.times ?? [])]
    .sort()
    .map((t) => {
      const [h, m] = t.split(":").map(Number);
      return { key: `${day}@${t}`, at: new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m).getTime() };
    });
}

// Doses that have come due today and haven't been taken or skipped (and aren't snoozed)
export function openSlots(med, now = Date.now()) {
  if (med.snoozeUntil && med.snoozeUntil > now) return [];
  return slotsOn(med, new Date(now)).filter((s) => s.at <= now && !med.slots?.[s.key]);
}

// The one to show: a dose that's due now, else the next one coming up
export function nextSlot(med, now = Date.now()) {
  if (med.asNeeded) return null;
  const open = openSlots(med, now)[0];
  if (open) return { ...open, due: true };
  const today = new Date(now);
  for (let i = 0; i < 60; i++) {
    const hit = slotsOn(med, addDays(today, i)).find((s) => s.at > now && !med.slots?.[s.key]);
    if (hit) return { ...hit, due: false };
  }
  return null;
}

// When an as-needed med can go again, if the person set a gap. Just a countdown.
export const notAgainUntil = (med, now = Date.now()) => {
  const h = parseFloat(med.minHours);
  return med.asNeeded && h > 0 && med.lastAt && med.lastAt + h * 3600000 > now ? med.lastAt + h * 3600000 : null;
};

export function leftLabel(ms) {
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m} min`;
}

// "in 2h", "tomorrow 8:00am" for the line under a med's name
export function whenLabel(slot, now = Date.now()) {
  if (!slot) return null;
  const d = new Date(slot.at);
  const t = atLabel(slot.at);
  const diff = dayDiff(new Date(now), d);
  if (diff === 0) return slot.due ? `since ${t}` : t;
  if (diff === 1) return `tomorrow ${t}`;
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} ${t}`;
}

const num = (v) => (v === "" || v == null || isNaN(parseFloat(v)) ? null : parseFloat(v));

// What's left, and an estimate of when it runs out from the schedule the person typed.
export function supplyInfo(med) {
  const left = num(med.supply?.left);
  if (left == null) return null;
  const per = num(med.supply?.per) ?? 1;
  const full = num(med.supply?.full);
  const { mode = "every", dow = [], n = 2 } = med.days ?? {};
  const share = mode === "weekdays" ? 5 / 7 : mode === "custom" ? dow.length / 7 : mode === "every-n" ? 1 / Math.max(1, n) : 1;
  const perDay = med.asNeeded ? 0 : (med.times?.length ?? 0) * per * share;
  const days = perDay > 0 ? left / perDay : null;
  const runOut = days == null ? null : addDays(new Date(), Math.floor(days));
  // "Low" is about a week of a scheduled med, or a few left of an as-needed one
  const low = days != null ? days <= 7 : left <= Math.max(3, (full ?? 0) * 0.15);
  return { left, full, per, unit: med.supply?.unit ?? "pills", days, runOut, low };
}
export const refillSoon = (med) => !!supplyInfo(med)?.low;

// Wraps typed text to fit a label: [lines] (no more than max, last one trimmed)
export function wrap(text = "", width, max) {
  const out = [];
  let line = "";
  for (const w of text.trim().split(/\s+/).filter(Boolean)) {
    if ((line + " " + w).trim().length <= width) line = (line + " " + w).trim();
    else {
      if (line) out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  if (out.length > max) {
    out.length = max;
    out[max - 1] = out[max - 1].slice(0, width - 1).replace(/\s+$/, "") + "…";
  }
  return out.map((l) => (l.length > width ? l.slice(0, width - 1) + "…" : l));
}

const patchMed = (updateBoard, boardId, modId, medId, fn) =>
  updateBoard(boardId, (b) => ({
    ...b,
    modules: b.modules.map((m) =>
      m.id === modId ? { ...m, state: { ...m.state, meds: (m.state.meds ?? []).map((x) => (x.id === medId ? fn(x) : x)) } } : m
    ),
  }));

// Only the last few days of slots matter for "is it due"; older ones live in the entries
const prune = (slots) => {
  const cut = dayKey(addDays(new Date(), -4));
  return Object.fromEntries(Object.entries(slots ?? {}).filter(([k]) => k.slice(0, 10) >= cut));
};

// Records one dose (taken or skipped) as an entry and in the med's small state.
// slot = the scheduled { key } it answers, or null for an extra / as-needed one.
// Returns an undo function.
export function recordDose(data, boardId, modId, med, { slot = null, status = "taken", site = null, at = Date.now() } = {}) {
  const { uid: me, updateBoard, toast } = data;
  const entry = addEntry(me, {
    kind: "dose",
    boardId,
    moduleId: modId,
    medId: med.id,
    scheduledFor: slot ? slot.at : null,
    status,
    site,
    at,
  });
  const used = status === "taken" ? num(med.supply?.per) ?? 1 : 0;
  const before = { lastAt: med.lastAt ?? null, snoozeUntil: med.snoozeUntil ?? null, left: med.supply?.left };
  patchMed(updateBoard, boardId, modId, med.id, (x) => {
    const left = num(x.supply?.left);
    return {
      ...x,
      slots: prune(slot ? { ...x.slots, [slot.key]: { status, at } } : x.slots),
      lastAt: status === "taken" ? at : x.lastAt ?? null,
      snoozeUntil: null,
      supply: used && left != null ? { ...x.supply, left: Math.max(0, Math.round((left - used) * 100) / 100) } : x.supply,
    };
  });
  const undo = () => {
    deleteEntry(me, { id: entry.id, boardId });
    patchMed(updateBoard, boardId, modId, med.id, (x) => {
      const slots = { ...x.slots };
      if (slot) delete slots[slot.key];
      return { ...x, slots, lastAt: before.lastAt, snoozeUntil: before.snoozeUntil, supply: { ...x.supply, left: before.left ?? "" } };
    });
  };
  const name = med.name || "your med";
  toast({
    text: status === "taken" ? `${name} logged at ${atLabel(at)}${site ? ` · ${siteLabel(site)}` : ""} ✓` : `${name} skipped`,
    actions: [{ label: "undo", run: undo }],
  });
  return undo;
}

export const snoozeDose = ({ updateBoard, toast }, boardId, modId, med, mins = 15) => {
  patchMed(updateBoard, boardId, modId, med.id, (x) => ({ ...x, snoozeUntil: Date.now() + mins * 60000 }));
  toast({ text: `${med.name || "it"} will ask again in ${mins} min` });
};

// Every dose that's due right now, across all boards: what the dock and the
// notifications show. hide = the cabinet is set to keep names off screens.
export function dueNow(boards, now = Date.now()) {
  return (boards ?? []).flatMap((b) =>
    b.modules
      .filter((m) => m.type === "meds")
      .flatMap((m) =>
        (m.state.meds ?? [])
          .map((med) => ({ med, slot: openSlots(med, now)[0] }))
          .filter((x) => x.slot)
          .map(({ med, slot }) => ({
            id: `meds:${m.id}:${med.id}`,
            boardId: b.id,
            modId: m.id,
            med,
            slot,
            hide: !!m.state.hideNames,
            notify: !!m.state.notify,
          }))
      )
  );
}

// The home glance: the next dose across a board's cabinets, or a refill nudge
export function glanceLine(mods, now = Date.now()) {
  const meds = mods.flatMap((m) => (m.state.meds ?? []).map((med) => ({ med, hide: !!m.state.hideNames })));
  const slots = meds.map((x) => ({ ...x, slot: nextSlot(x.med, now) })).filter((x) => x.slot).sort((a, b) => a.slot.at - b.slot.at);
  const due = slots.filter((x) => x.slot.due);
  const hide = meds.some((x) => x.hide);
  if (due.length) return hide ? `💊 ${due.length} due now` : `💊 ${due[0].med.name || "a med"} due now`;
  const next = slots[0];
  if (next) {
    const tonight = dayDiff(new Date(now), new Date(next.slot.at)) === 0;
    if (hide) {
      const n = slots.filter((x) => dayDiff(new Date(now), new Date(x.slot.at)) === 0).length;
      return tonight ? `💊 ${n} more today` : "💊 all caught up";
    }
    return `💊 next: ${next.med.name || "a med"} ${whenLabel(next.slot, now)}`;
  }
  return null;
}
export const needsRefill = (mods) => mods.some((m) => (m.state.meds ?? []).some(refillSoon));

// A pharmacy punch card for the last n days: each cell is how that day went
export function punchDays(med, entries, n = 28) {
  const mine = entries.filter((e) => e.kind === "dose" && e.medId === med.id);
  const by = {};
  mine.forEach((e) => ((by[e.day] ??= { taken: 0, skipped: 0 })[e.status === "taken" ? "taken" : "skipped"]++));
  const today = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(today, i - n + 1);
    const key = dayKey(d);
    const got = by[key] ?? { taken: 0, skipped: 0 };
    const want = slotsOn(med, d).length;
    const live = !med.start || key >= med.start;
    const state = got.taken && (want === 0 || got.taken >= want) ? "taken" : got.taken ? "part" : got.skipped ? "skipped" : want || med.asNeeded ? "none" : "off";
    return { key, state: !live ? "off" : state, date: d, today: i === n - 1, taken: got.taken };
  });
}

// Last few injection sites used, newest first
export const recentSites = (med, entries, n = 4) =>
  entries.filter((e) => e.kind === "dose" && e.medId === med.id && e.site && e.status === "taken").slice(0, n).map((e) => e.site);
