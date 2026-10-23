import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { newModule } from "../constants/modules";
import { seedBoards } from "../constants/seeds";
import { boardsCol, imagesCol, commitInChunks } from "./data";

export const SCHEMA = 2;

export function blankBoard(fields, order = 0) {
  const now = Date.now();
  return {
    title: "",
    color: { h: 340, s: 55, l: 82 },
    stampId: null,
    iconData: "",
    layout: "bleed",
    iconOffsetX: 0,
    iconScale: 1,
    status: "active",
    order,
    createdAt: now,
    updatedAt: now,
    lastLoggedAt: null,
    snap: false,
    mobileOrder: null,
    modules: [],
    ...fields,
  };
}

// Old card → new board. Its blocks become a Notes module, and every board gets
// a sticker chart and a Next-up stack so the glance view has something to show.
export function cardToBoard(card, order, saveImg) {
  let blocks = (card.blocks ?? []).map((b) => {
    if (b.type === "image" && b.value) {
      return { id: b.id, type: "image", imageId: saveImg(b.value, `${card.id}-${b.id}`, card.id) };
    }
    return b;
  });
  // New boards used to start with a title block that just repeated the card name
  if (blocks[0]?.type === "bigtitle" && blocks[0].value.trim() === card.title.trim()) {
    blocks = blocks.slice(1);
  }

  const tracker = newModule("tracker", { x: 0, y: 0 });
  const nextup = newModule("nextup", { x: 360, y: 20 });
  const modules = [tracker, nextup];
  if (blocks.length) {
    modules.push(newModule("notes", { x: 610, y: 0 }, { w: 400, h: 460, state: { blocks } }));
  }

  return blankBoard(
    {
      title: card.title,
      color: card.color,
      stampId: card.stampId ?? null,
      iconData: card.iconData ?? "",
      layout: card.layout ?? "bleed",
      iconOffsetX: card.iconOffsetX ?? 0,
      iconScale: card.iconScale ?? 1,
      status: "someday",
      modules,
      mobileOrder: modules.map((m) => m.id),
    },
    order
  );
}

// Runs once per account. Ids are derived from the old data, so if two devices
// migrate at the same time they write the same docs instead of duplicates.
export async function ensureMigrated(uid) {
  const metaRef = doc(db, "users", uid, "meta", "app");
  const meta = await getDoc(metaRef);
  if (meta.exists() && meta.data().schema >= SCHEMA) return;

  const legacy = await getDoc(doc(db, "users", uid));
  const cards = legacy.exists() ? legacy.data().cards ?? [] : null;
  const ops = [];

  const saveImg = (data, id, boardId) => {
    ops.push((b) => b.set(doc(imagesCol(uid), id), { boardId, data, at: Date.now() }));
    return id;
  };

  const boards = cards
    ? cards.map((c, i) => ({ id: c.id, ...cardToBoard(c, i, saveImg) }))
    : seedBoards().map((b, i) => ({ id: `seed-${i}`, ...blankBoard(b, i) }));

  for (const { id, ...board } of boards) {
    ops.push((b) => b.set(doc(boardsCol(uid), id), board));
  }
  await commitInChunks(ops);
  // Marker goes last: if anything above failed, the next load simply retries
  await commitInChunks([(b) => b.set(metaRef, { schema: SCHEMA, migratedAt: Date.now(), from: cards ? "cards" : "seed" })]);
}
