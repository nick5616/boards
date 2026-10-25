// Firestore layout (everything lives under users/{uid}):
//   boards/{boardId}   one doc per board: look, status, module placements and small module state
//   entries/{entryId}  dated things that pile up: practice logs, diary entries, photos
//   images/{imageId}   image data, kept apart so lists of entries stay light
//   meta/app           schema marker, written once migration from the old single doc is done
// The old users/{uid} doc ({ cards: [...] }) is never modified; it stays as a backup.

import {
  collection,
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

export const boardsCol = (uid) => collection(db, "users", uid, "boards");
export const entriesCol = (uid) => collection(db, "users", uid, "entries");
export const imagesCol = (uid) => collection(db, "users", uid, "images");

// Writes are fire-and-forget so they work offline (the local cache applies them
// immediately); failures are routed here so the app can surface them.
export const errorSink = { report: (e) => console.error(e) };
const report = (e) => errorSink.report(e);

export const newId = (col) => doc(col).id;

export function addEntry(uid, data) {
  const ref = doc(entriesCol(uid));
  const at = data.at ?? Date.now();
  const entry = { text: "", moduleId: null, ...data, at, day: dayKey(at) };
  if (DEMO) memory.setEntry(ref.id, entry);
  else setDoc(ref, entry).catch(report);
  return { id: ref.id, at };
}

export const updateEntry = (uid, id, patch) =>
  DEMO ? memory.patchEntry(id, patch) : updateDoc(doc(entriesCol(uid), id), patch).catch(report);

export function deleteEntry(uid, entry) {
  if (DEMO) return memory.deleteEntries((e) => e.id === entry.id);
  deleteDoc(doc(entriesCol(uid), entry.id)).catch(report);
  if (entry.imageId) deleteImage(uid, entry.imageId);
}

export function saveImage(uid, boardId, data) {
  const ref = doc(imagesCol(uid));
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
export async function deleteEntriesWhere(uid, field, value) {
  if (DEMO) return memory.deleteEntries((e) => e[field] === value);
  const snap = await getDocs(query(entriesCol(uid), where(field, "==", value)));
  const refs = [];
  snap.forEach((d) => {
    refs.push(d.ref);
    if (d.data().imageId) refs.push(doc(imagesCol(uid), d.data().imageId));
  });
  await commitInChunks(refs.map((r) => (b) => b.delete(r)));
}

export async function deleteBoardData(uid, boardId) {
  await deleteEntriesWhere(uid, "boardId", boardId);
  if (DEMO) return;
  const imgs = await getDocs(query(imagesCol(uid), where("boardId", "==", boardId)));
  await commitInChunks(imgs.docs.map((d) => (b) => b.delete(d.ref)));
  await deleteDoc(doc(boardsCol(uid), boardId));
}

export async function commitInChunks(ops, size = 400) {
  for (let i = 0; i < ops.length; i += size) {
    const batch = writeBatch(db);
    ops.slice(i, i + size).forEach((op) => op(batch));
    await batch.commit();
  }
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
