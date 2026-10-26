// Firestore layout (everything lives under users/{uid}):
//   boards/{boardId}   one doc per board: look, status, module placements and small module state
//   entries/{entryId}  dated things that pile up: practice logs, diary entries, photos
//   images/{imageId}   image data, kept apart so lists of entries stay light
//   meta/app           schema marker, written once migration from the old single doc is done
// The old users/{uid} doc ({ cards: [...] }) is never modified; it stays as a backup.
//
// With VITE_SPACES=1 a board becomes a "space" (see docs/plans/sharing-multiplayer.md):
//   spaces/{sid}                 the board's own fields (no modules)
//   spaces/{sid}/members/{uid}   who can open it, and as what
//   spaces/{sid}/modules/{mid}   one doc per module
//   spaces/{sid}/entries/{eid}   this board's entries, each stamped with by: uid
//   users/{uid}/mounts/{sid}     which spaces are in my world, and in what order
// Boards keep their ids as space ids. Images stay under users/{uid}/images for now.

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { dayKey } from "../utils/date";
import { DEMO, memory } from "./demo";

// Off by default: the new layout needs the new security rules deployed first
export const SPACES = import.meta.env.VITE_SPACES === "1";

export const boardsCol = (uid) => collection(db, "users", uid, "boards");
export const entriesCol = (uid) => collection(db, "users", uid, "entries");
// Images stay owner-only in this first step; sharing moves them to spaces/{sid}/images
// so members can see each other's pictures.
export const imagesCol = (uid) => collection(db, "users", uid, "images");

export const spacesCol = () => collection(db, "spaces");
export const spaceDoc = (sid) => doc(db, "spaces", sid);
export const modulesCol = (sid) => collection(db, "spaces", sid, "modules");
export const modDoc = (sid, mid) => doc(db, "spaces", sid, "modules", mid);
export const mountDoc = (uid, sid) => doc(db, "users", uid, "mounts", sid);
export const spaceEntriesCol = (sid) => collection(db, "spaces", sid, "entries");
export const membersCol = (sid) => collection(db, "spaces", sid, "members");
export const mountsCol = (uid) => collection(db, "users", uid, "mounts");
export const invitesCol = () => collection(db, "invites");
export const inviteDoc = (token) => doc(db, "invites", token);
export const memberDoc = (sid, uid) => doc(db, "spaces", sid, "members", uid);
// Every entries collection at once, for "what did I log lately" across boards
export const entriesGroup = () => collectionGroup(db, "entries");

// Where a board's entries live
export const boardEntriesCol = (uid, boardId) => (SPACES ? spaceEntriesCol(boardId) : entriesCol(uid));

// Writes are fire-and-forget so they work offline (the local cache applies them
// immediately); failures are routed here so the app can surface them.
export const errorSink = { report: (e) => console.error(e) };
const report = (e) => errorSink.report(e);

// Boards where I'm only allowed to look (useSpaces keeps this up to date). Writes for
// them stop here, politely, instead of bouncing off the rules as "couldn't save".
// errorSink.notice = a gentle word for the person, at most once in a while.
export const readOnlyBoards = new Set();
errorSink.notice = () => {};
let lastNote = 0;
export function viewOnlyNote() {
  const now = Date.now();
  if (now - lastNote < 30000) return;
  lastNote = now;
  errorSink.notice("view only: you can look around, but not change things");
}
const looking = (boardId) => SPACES && readOnlyBoards.has(boardId) && (viewOnlyNote(), true);

export const newId = (col) => doc(col).id;

export function addEntry(uid, data) {
  const ref = doc(boardEntriesCol(uid, data.boardId));
  const at = data.at ?? Date.now();
  const entry = { text: "", moduleId: null, ...data, at, day: dayKey(at) };
  if (looking(data.boardId)) return { id: ref.id, at };
  if (SPACES) entry.by = uid; // who logged it, once a board has more than one person
  if (DEMO) memory.setEntry(ref.id, entry);
  else setDoc(ref, entry).catch(report);
  return { id: ref.id, at };
}

// boardId says where the entry lives (it only matters with spaces on)
export const updateEntry = (uid, boardId, id, patch) =>
  looking(boardId) ? undefined : DEMO ? memory.patchEntry(id, patch) : updateDoc(doc(boardEntriesCol(uid, boardId), id), patch).catch(report);

export function deleteEntry(uid, entry) {
  if (DEMO) return memory.deleteEntries((e) => e.id === entry.id);
  if (looking(entry.boardId)) return;
  deleteDoc(doc(boardEntriesCol(uid, entry.boardId), entry.id)).catch(report);
  if (entry.imageId) deleteImage(uid, entry.imageId);
}

export function saveImage(uid, boardId, data) {
  const ref = doc(imagesCol(uid));
  if (looking(boardId)) return ref.id;
  if (DEMO) memory.images.set(ref.id, { boardId, data });
  else setDoc(ref, { boardId, data, at: Date.now() }).catch(report);
  return ref.id;
}

export const deleteImage = (uid, id) =>
  DEMO ? memory.images.delete(id) : deleteDoc(doc(imagesCol(uid), id)).catch(report);

const imageCache = new Map();
export async function loadImage(uid, id) {
  if (DEMO) return memory.images.get(id)?.data ?? null;
  if (!imageCache.has(id)) {
    imageCache.set(
      id,
      getDoc(doc(imagesCol(uid), id)).then((s) => (s.exists() ? s.data().data : null))
    );
  }
  return imageCache.get(id);
}

// A new image doc holding the same picture, so a copy can be deleted without
// taking the original with it. Returns the new id right away.
export function copyImage(uid, boardId, id) {
  const ref = doc(imagesCol(uid));
  if (DEMO) {
    const src = memory.images.get(id);
    if (src) memory.images.set(ref.id, { ...src, boardId });
    return ref.id;
  }
  const data = loadImage(uid, id);
  imageCache.set(ref.id, data); // readable before the write lands
  data.then((d) => d && setDoc(ref, { boardId, data: d, at: Date.now() })).catch(report);
  return ref.id;
}

// Deletes every entry (and its image) where field == value
export async function deleteEntriesWhere(uid, boardId, field, value) {
  if (DEMO) return memory.deleteEntries((e) => e[field] === value);
  const snap = await getDocs(query(boardEntriesCol(uid, boardId), where(field, "==", value)));
  const refs = [];
  snap.forEach((d) => {
    refs.push(d.ref);
    if (d.data().imageId) refs.push(doc(imagesCol(uid), d.data().imageId));
  });
  await commitInChunks(refs.map((r) => (b) => b.delete(r)));
}

export async function deleteBoardData(uid, boardId) {
  await deleteEntriesWhere(uid, boardId, "boardId", boardId);
  if (DEMO) return;
  const imgs = await getDocs(query(imagesCol(uid), where("boardId", "==", boardId)));
  await commitInChunks(imgs.docs.map((d) => (b) => b.delete(d.ref)));
  if (SPACES) return deleteSpace(uid, boardId);
  await deleteDoc(doc(boardsCol(uid), boardId));
}

// Creates the space, the owner's member row and the mount together (the rules
// check the owner row against the space in the same batch). Modules go in
// right behind, in later batches, since the rules need the member row to exist.
// Nothing is awaited, so it still queues while offline.
export function createSpace(uid, sid, fields, modules, order, who = {}) {
  const now = Date.now();
  const { order: _o, ...space } = fields;
  const first = writeBatch(db);
  first.set(spaceDoc(sid), { ...space, owner: uid, kind: "board" });
  first.set(doc(membersCol(sid), uid), { uid, role: "owner", name: who.name ?? "", photo: who.photo ?? "", via: null, joinedAt: now });
  first.set(doc(mountsCol(uid), sid), { where: "home", order, addedAt: now });
  return Promise.all([
    first.commit(),
    commitQueued(modules.map((m) => (b) => b.set(doc(modulesCol(sid), m.id), { ...m, updatedAt: now, updatedBy: uid }))),
  ]);
}

// Client-side cleanup of a whole space (its entries are the caller's to clear first). The space doc goes before the owner's
// own member row, because the rules need that row to allow the delete.
export async function deleteSpace(uid, sid) {
  const [mods, members] = await Promise.all([getDocs(modulesCol(sid)), getDocs(membersCol(sid))]);
  await commitInChunks(mods.docs.map((d) => (b) => b.delete(d.ref)));
  await commitInChunks(members.docs.filter((d) => d.id !== uid).map((d) => (b) => b.delete(d.ref)));
  await deleteDoc(spaceDoc(sid));
  await commitInChunks([(b) => b.delete(doc(membersCol(sid), uid)), (b) => b.delete(doc(mountsCol(uid), sid))]);
}

export async function commitInChunks(ops, size = 400) {
  for (let i = 0; i < ops.length; i += size) {
    const batch = writeBatch(db);
    ops.slice(i, i + size).forEach((op) => op(batch));
    await batch.commit();
  }
}

// Like commitInChunks, but every batch is sent before any is awaited, so the
// writes queue in order even offline (an awaited commit waits for the server).
export function commitQueued(ops, size = 400) {
  const done = [];
  for (let i = 0; i < ops.length; i += size) {
    const batch = writeBatch(db);
    ops.slice(i, i + size).forEach((op) => op(batch));
    done.push(batch.commit());
  }
  return Promise.all(done);
}

// Downscales a picked photo to a JPEG data URL that fits comfortably in one doc
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const encode = (max, q) => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL("image/jpeg", q);
      };
      let out = encode(1400, 0.82);
      if (out.length > 800_000) out = encode(1000, 0.7);
      if (out.length > 800_000) out = encode(700, 0.6);
      resolve(out);
    };
    img.onerror = reject;
    img.src = url;
  });
}
