// Heavy files that last and that everyone on a board can open: Cloud Storage, in the folder
// of whoever hosts (owns) the board, not in Firestore. The bucket is private; the `media`
// function (functions/media.js) checks membership and hands out short-lived signed URLs.
//
//   const id = await upload(blob, boardId, { onProgress })   // content hash, or null
//   const url = await mediaUrl(boardId, id)                   // signed GET URL, or null
//   await removeMedia(boardId, id)
//
// Ids are the same content hashes as the local shelf (localMedia.js), so the shelf can sit in
// front of this as a cache. Same catch too: one id is one file per board.
// Every call fails soft: null / false, never a throw into the UI.
//
// Needs spaces (VITE_SPACES=1) and the deployed function; off in the demo. Check `CLOUD`.

import { httpsCallable } from "firebase/functions";
import { fns } from "../firebase";
import { SPACES, readOnlyBoards } from "./data";
import { DEMO } from "./demo";
import { idFor } from "./localMedia";

export const CLOUD = SPACES && !DEMO;

const call = httpsCallable(fns, "media");
const MARGIN = 10 * 60 * 1000; // a cached URL is used only while it has this long left

// `${boardId}/${id}` -> { url, expires }
const cache = new Map();
// boardId -> { ids: Map(id -> [resolve]), timer }: reads asked for in the same tick go in one call
const queued = new Map();

const key = (boardId, id) => `${boardId}/${id}`;

function flush(boardId) {
  const q = queued.get(boardId);
  queued.delete(boardId);
  const ids = [...q.ids.keys()];
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    call({ op: "read", space: boardId, ids: part }).then(
      ({ data }) => {
        for (const id of part) {
          const url = data.urls[id] ?? null;
          if (url) cache.set(key(boardId, id), { url, expires: data.expires });
          q.ids.get(id).forEach((r) => r(url));
        }
      },
      (e) => {
        console.warn("media urls", boardId, e?.code ?? e);
        for (const id of part) q.ids.get(id).forEach((r) => r(null));
      }
    );
  }
}

// A signed URL for one file on a board, good for at least ten minutes
export function mediaUrl(boardId, id) {
  if (!CLOUD || !boardId || !id) return Promise.resolve(null);
  const hit = cache.get(key(boardId, id));
  if (hit && hit.expires - Date.now() > MARGIN) return Promise.resolve(hit.url);
  return new Promise((resolve) => {
    let q = queued.get(boardId);
    if (!q) {
      q = { ids: new Map() };
      queued.set(boardId, q);
      queueMicrotask(() => flush(boardId));
    }
    if (!q.ids.has(id)) q.ids.set(id, []);
    q.ids.get(id).push(resolve);
  });
}

// PUT with progress (fetch can't report upload progress). Resolves true once the bytes are there.
function put(url, headers, blob, onProgress) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    if (onProgress) xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    // 412: someone else's identical upload got there first, which is just as good
    xhr.onload = () => resolve((xhr.status >= 200 && xhr.status < 300) || xhr.status === 412);
    xhr.onerror = xhr.onabort = () => resolve(false);
    xhr.send(blob);
  });
}

// Puts a file in the board host's storage. Resolves its id, or null (look-only, offline, too big...).
// onProgress(0..1) while the bytes go up.
export async function upload(blob, boardId, { onProgress } = {}) {
  if (!CLOUD || !boardId || !blob?.size || readOnlyBoards.has(boardId)) return null;
  try {
    const id = await idFor(blob);
    const { data } = await call({ op: "upload", space: boardId, id, type: blob.type, size: blob.size });
    if (!data.exists && !(await put(data.url, data.headers, blob, onProgress))) return null;
    onProgress?.(1);
    return id;
  } catch (e) {
    console.warn("media upload", boardId, e?.code ?? e);
    return null;
  }
}

export async function removeMedia(boardId, id) {
  if (!CLOUD || !boardId || !id || readOnlyBoards.has(boardId)) return false;
  try {
    await call({ op: "remove", space: boardId, id });
    cache.delete(key(boardId, id));
    return true;
  } catch (e) {
    console.warn("media remove", boardId, e?.code ?? e);
    return false;
  }
}
