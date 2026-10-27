import { MODULES } from "../constants/modules";
import { uid } from "../utils/uid";
import { modulesIn, withContents } from "../components/board/spaces";

// A board (or one tab of it) squeezed into a link: no server, no account.
//   toLink(board, { tabId?, parent? }) →{ url, size, long } with url "https://…/open#b=<deflate+base64url JSON>"
//   fromLink(hash)            → { v: 1, title, color, …, modules } (throws if it isn't one)
//   importable(snap)          → the fields createBoard wants, with fresh module ids
// The copy holds the layout, titles and states only. Pictures become empty
// slots, diaries and PINs stay home, and entries were never part of the board.
// The board's own drawn or uploaded icon does come along, shrunk to a few KB.

export const LINK_WARN = 30000; // some chat apps cut links off past about here

const KEEP = ["title", "color", "stampId", "layout", "iconOffsetX", "iconScale"];

// Anything that is one person's own: picture ids, inline pictures, PIN hashes
const PRIVATE_KEYS = ["imageId", "pinHash", "iconData"];

function clean(v) {
  if (typeof v === "string") return v.startsWith("data:") ? null : v;
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, PRIVATE_KEYS.includes(k) ? null : clean(x)]));
  }
  return v;
}

// A copy never arrives already running (a metronome ticking, a radio playing)
const RUNNING = ["timer", "metronome", "radio"];

const cleanModule = (m) => {
  const state = m.type === "diary" ? MODULES.diary.init() : clean(m.state);
  // (a routine copy starts from step one, not from wherever the original was)
  const fresh = RUNNING.includes(m.type) && state
    ? { ...state, startedAt: null, ...(m.type === "radio" && { by: null }) }
    : m.type === "routine" && state ? { ...state, run: null }
    : m.type === "flipbook" && state ? { ...state, chat: [] } // the notes are between the people on the board
    : state;
  return { ...clean(m), state: fresh };
};

// parent = the folder whose tab it is (null for one of the board's own tabs)
export function snapshot(board, { tabId, parent = null } = {}) {
  let modules = board.modules ?? [];
  let tabs = board.tabs ?? [];
  const owner = parent ? modules.find((m) => m.id === parent)?.state?.tabs ?? [] : tabs;
  const tabName = owner.find((t) => t.id === tabId)?.name ?? "tab";
  if (tabId) {
    const ids = withContents(modules, modulesIn(board, { parent, tab: tabId }).map((m) => m.id));
    // The tab's own modules become the whole board; folder contents keep their own tabs
    const top = new Set(modulesIn(board, { parent, tab: tabId }).map((m) => m.id));
    modules = modules.filter((m) => ids.includes(m.id)).map((m) => (top.has(m.id) ? { ...m, parent: null, tab: null } : m));
    tabs = [];
  }
  const snap = { v: 1, at: Date.now() };
  for (const k of KEEP) if (board[k] !== undefined) snap[k] = board[k];
  if (tabId) snap.title = `${board.title} › ${tabName}`;
  return { ...snap, tabs, modules: modules.map(cleanModule) };
}

const toB64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64 = (s) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

const ICON_MAX = 96; // px, the longer side: plenty for a card, small enough for a link

// A data-URL picture redrawn at most ICON_MAX across ("" if it won't load)
function shrinkIcon(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, ICON_MAX / Math.max(img.width, img.height, 1));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const webp = c.toDataURL("image/webp", 0.85); // keeps a drawn icon's see-through background
      resolve(webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/png"));
    };
    img.onerror = () => resolve("");
    img.src = src;
  });
}

// → { url, size, long } where long means it may get cut off in some chat apps
export async function toLink(board, opts) {
  const snap = snapshot(board, opts);
  if (board.iconData?.startsWith("data:image")) {
    const icon = await shrinkIcon(board.iconData);
    if (icon) snap.iconData = icon;
  }
  const json = new TextEncoder().encode(JSON.stringify(snap));
  const packed = await pipe(json, new CompressionStream("deflate-raw"));
  const url = `${window.location.origin}/open#b=${toB64(packed)}`;
  return { url, size: url.length, long: url.length > LINK_WARN };
}

export async function fromLink(hash) {
  const m = /(?:^#?|&)b=([\w-]+)/.exec(hash ?? "");
  if (!m) throw new Error("no board in this link");
  const json = await pipe(fromB64(m[1]), new DecompressionStream("deflate-raw"));
  const snap = JSON.parse(new TextDecoder().decode(json));
  if (snap?.v !== 1 || typeof snap.title !== "string" || !Array.isArray(snap.modules)) {
    throw new Error("that link is from a newer or different version");
  }
  // Only modules this app knows; the rest can't be drawn
  snap.modules = snap.modules.filter((m) => m && MODULES[m.type] && typeof m.id === "string");
  return snap;
}

// Fresh ids so a copy never collides with the original, parent references remapped
export function importable(snap) {
  const ids = new Map(snap.modules.map((m) => [m.id, uid()]));
  const fields = Object.fromEntries(KEEP.filter((k) => snap[k] !== undefined).map((k) => [k, snap[k]]));
  // Only a picture, never anything else posing as one
  const icon = typeof snap.iconData === "string" && /^data:image\/(png|webp|jpeg);base64,[\w+/=]+$/.test(snap.iconData) ? snap.iconData : null;
  return {
    ...fields,
    ...(icon && { iconData: icon }),
    status: "active",
    tabs: snap.tabs ?? [],
    modules: snap.modules.map((m) => ({
      ...m,
      id: ids.get(m.id),
      // wires point at module ids, which are all new now
      ...(m.state?.sendTo && { state: { ...m.state, sendTo: m.state.sendTo.map((x) => ids.get(x)).filter(Boolean) } }),
      parent: m.parent ? ids.get(m.parent) ?? null : null,
    })),
  };
}

export const isOpenLink = (base = "") =>
  window.location.pathname.replace(/\/+$/, "") === `${base}/open` && window.location.hash.includes("b=");
