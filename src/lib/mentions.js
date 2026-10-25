import { MODULES } from "../constants/modules";

// An @-mention is written into the text as a token, so it travels with the
// words and needs no schema of its own:
//   @[Title](mod:<boardId>/<modId>)   a module on some board
//   @[Title](board:<boardId>)         a whole board
// The title is only a memory: chips show the live name while the thing exists.
const TOKEN = /@\[([^\]]*)\]\((mod|board):([^)/\s]+)(?:\/([^)\s]+))?\)/g;

const clean = (t) => String(t ?? "").replace(/[[\]()]/g, "").trim() || "untitled";

export const toToken = ({ kind, boardId, modId, title }) =>
  kind === "board" ? `@[${clean(title)}](board:${boardId})` : `@[${clean(title)}](mod:${boardId}/${modId})`;

// text → [{ type: "text", value } | { type: "mention", kind, boardId, modId?, title }]
export function parse(text) {
  text = String(text ?? "");
  const out = [];
  let at = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > at) out.push({ type: "text", value: text.slice(at, m.index) });
    out.push(
      m[2] === "board"
        ? { type: "mention", kind: "board", boardId: m[3], title: m[1] }
        : { type: "mention", kind: "mod", boardId: m[3], modId: m[4], title: m[1] }
    );
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ type: "text", value: text.slice(at) });
  return out;
}

export const mentionsIn = (text) => parse(text).filter((p) => p.type === "mention");

// What a mention points at right now: { ok, title, where } (ok false = gone, or not ours to open)
export function resolve(boards, m) {
  const b = (boards ?? []).find((x) => x.id === m.boardId);
  if (!b) return { ok: false, title: m.title };
  if (m.kind === "board") return { ok: true, title: b.title, where: "" };
  const mod = b.modules?.find((x) => x.id === m.modId);
  return mod ? { ok: true, title: mod.title, where: b.title } : { ok: false, title: m.title };
}

// Everything that can be picked after an "@": boards, then their modules
export function candidates(boards) {
  const out = [];
  for (const b of boards ?? []) out.push({ kind: "board", boardId: b.id, title: b.title, where: "board", tray: "" });
  for (const b of boards ?? []) {
    for (const m of b.modules ?? []) {
      out.push({ kind: "mod", boardId: b.id, modId: m.id, title: m.title, where: b.title, tray: MODULES[m.type]?.label ?? "" });
    }
  }
  return out;
}

// Every string anywhere in a module's state, so new modules are covered without a list
function strings(v, out) {
  if (typeof v === "string") v.length < 20000 && v.includes("@[") && out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
  return out;
}

// Modules (in memory) whose text mentions target = { boardId, modId? }.
// Diary pages live in Firestore entries, not in the boards, so they aren't searched.
export function backlinks(boards, target) {
  const out = [];
  for (const b of boards ?? []) {
    for (const m of b.modules ?? []) {
      if (b.id === target.boardId && m.id === target.modId) continue;
      const hit = strings(m.state, []).some((s) =>
        mentionsIn(s).some((x) =>
          target.modId
            ? x.kind === "mod" && x.boardId === target.boardId && x.modId === target.modId
            : x.kind === "board" && x.boardId === target.boardId
        )
      );
      if (hit) out.push({ boardId: b.id, modId: m.id, title: m.title, where: b.title });
    }
  }
  return out;
}
