// Heavy media (recordings, big files) that lives "on this computer": stored in
// this browser's IndexedDB, never uploaded, never synced. Clear site data or
// switch browsers and it's gone, so callers should say so. Later this becomes
// a cache in front of Cloud Storage, and peers can hand files to each other,
// which is why ids are content hashes: the same bytes get the same id anywhere.
//
// Every call fails soft (private windows, blocked storage, full disk):
// null / [] / false, never a throw into the UI.
//
// Record: { id, blob, type, size, createdAt, boardId?, modId?, meta? }

import { uid } from "../utils/uid";

const DB = "boards-media";
const STORE = "blobs";

let opening = null;
const open = () =>
  (opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
  }).catch((e) => {
    opening = null; // allow a retry later
    throw e;
  }));

// One request in one transaction → its result
const run = async (mode, fn) => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
};

// Content-addressed: first 16 hex chars (64 bits) of SHA-256. Short enough to
// read, plenty to avoid collisions in one person's shelf. The catch: the same
// file put twice is one record, so del() removes it for every module using it.
// Without crypto.subtle (insecure context) it falls back to a random id.
async function idFor(blob) {
  try {
    const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return [...new Uint8Array(hash).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return uid() + uid();
  }
}

export async function put(blob, { boardId, modId, meta } = {}) {
  try {
    const id = await idFor(blob);
    const record = { id, blob, type: blob.type, size: blob.size, createdAt: Date.now() };
    if (boardId) record.boardId = boardId;
    if (modId) record.modId = modId;
    if (meta) record.meta = meta;
    await run("readwrite", (s) => s.put(record));
    return id;
  } catch {
    return null;
  }
}

export async function get(id) {
  try {
    return (await run("readonly", (s) => s.get(id))) ?? null;
  } catch {
    return null;
  }
}

export const getBlob = async (id) => (await get(id))?.blob ?? null;

export async function del(id) {
  try {
    await run("readwrite", (s) => s.delete(id));
    return true;
  } catch {
    return false;
  }
}

// Records (blobs included) matching boardId and/or modId, newest first
export async function list({ boardId, modId } = {}) {
  try {
    const all = await run("readonly", (s) => s.getAll());
    return all
      .filter((r) => (!boardId || r.boardId === boardId) && (!modId || r.modId === modId))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

// { used, quota } in bytes, or null if the browser won't say
export async function usage() {
  try {
    const { usage: used, quota } = await navigator.storage.estimate();
    return { used, quota };
  } catch {
    return null;
  }
}

// Asks the browser not to evict our files. Only asks once per browser.
export async function persist() {
  try {
    if (localStorage.getItem("boards-media-persist")) return await navigator.storage.persisted();
    localStorage.setItem("boards-media-persist", "1");
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// Hands a file to the person: a "save as" dialog where there is one, else a download.
// Takes a stored id or a Blob. Resolves true if saved, false if cancelled/missing.
export async function saveAsFile(idOrBlob, suggestedName = "recording") {
  try {
    const blob = typeof idOrBlob === "string" ? await getBlob(idOrBlob) : idOrBlob;
    if (!blob) return false;
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName });
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        return true;
      } catch (e) {
        if (e?.name === "AbortError") return false;
        // anything else: fall through to the plain download
      }
    }
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: suggestedName });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
  } catch {
    return false;
  }
}
