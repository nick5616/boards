// Heavy files (recordings, video, full-size photos, anything a creative drops on a board) live in
// one private Cloud Storage bucket, never in Firestore. Each file sits under the space's host
// (its owner), whoever uploaded it:
//
//   users/{owner}/spaces/{sid}/{id}      id = the file's content hash (see src/lib/localMedia.js)
//
// so a host's whole footprint is one prefix, and deleting a space is one prefix delete.
// Nobody touches the bucket directly. These handlers check the caller against the same
// member rows the Firestore rules use, then hand out short-lived signed URLs:
//   read    any member (viewers too)     GET URLs, many files per call
//   upload  owner / edit, not anonymous  one PUT URL, which only works if the file isn't there yet
//   remove  owner / edit                 deletes one file
//
// Read URLs are cut on a fixed clock (WINDOW), so everyone asking in the same window gets the
// very same URL and the browser cache keeps working across people and reloads.

export const WINDOW = 60 * 60; // seconds; read URLs start at the top of this window...
export const READ_TTL = 2 * WINDOW; // ...and last this long, so a fresh one always has an hour left
export const WRITE_TTL = 15 * 60;
export const MAX_BYTES = 2 * 1024 ** 3; // 2 GB a file
export const MAX_READS = 100; // files per read call

const SAFE = /^[A-Za-z0-9_-]{1,128}$/; // uids, space ids
const FILE_ID = /^[A-Za-z0-9_-]{8,64}$/;

export class Refused extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // an HttpsError code: "unauthenticated", "permission-denied", ...
  }
}

export const pathFor = (owner, sid, id) => `users/${owner}/spaces/${sid}/${id}`;
export const prefixFor = (owner, sid) => `users/${owner}/spaces/${sid}/`;

// The caller's role in a space and who hosts it, or a refusal (same test as isMember in firestore.rules)
export async function access(db, auth, sid) {
  if (!auth?.uid) throw new Refused("unauthenticated", "sign in first");
  if (typeof sid !== "string" || !SAFE.test(sid)) throw new Refused("invalid-argument", "bad space id");
  const [space, member] = await Promise.all([db.doc(`spaces/${sid}`).get(), db.doc(`spaces/${sid}/members/${auth.uid}`).get()]);
  const owner = space.get("owner");
  if (!space.exists || !member.exists || typeof owner !== "string" || !SAFE.test(owner)) {
    throw new Refused("permission-denied", "not a member of this space");
  }
  return { owner, role: member.get("role"), anonymous: auth.token?.firebase?.sign_in_provider === "anonymous" };
}

const canEdit = (a) => a.role === "owner" || a.role === "edit";

const fileId = (id) => {
  if (typeof id !== "string" || !FILE_ID.test(id)) throw new Refused("invalid-argument", "bad file id");
  return id;
};

export async function read(db, bucket, auth, { space, ids }, now = Date.now()) {
  if (!Array.isArray(ids) || !ids.length || ids.length > MAX_READS) throw new Refused("invalid-argument", `1 to ${MAX_READS} ids`);
  const a = await access(db, auth, space);
  const start = Math.floor(now / 1000 / WINDOW) * WINDOW;
  const expires = (start + READ_TTL) * 1000;
  const urls = {};
  await Promise.all(
    [...new Set(ids.map(fileId))].map(async (id) => {
      [urls[id]] = await bucket.file(pathFor(a.owner, space, id)).getSignedUrl({
        version: "v4",
        action: "read",
        accessibleAt: new Date(start * 1000),
        expires,
      });
    })
  );
  return { urls, expires };
}

// Content-addressed, so a file that's already there is already right: no URL, nothing to send.
// The signed PUT also carries if-generation-match: 0, so it can never overwrite one either.
export async function upload(db, bucket, auth, { space, id, type, size }, now = Date.now()) {
  fileId(id);
  if (!Number.isSafeInteger(size) || size < 1) throw new Refused("invalid-argument", "bad size");
  if (size > MAX_BYTES) throw new Refused("out-of-range", `files can be up to ${MAX_BYTES / 1024 ** 3} GB`);
  const contentType = typeof type === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(type) ? type : "application/octet-stream";
  const a = await access(db, auth, space);
  if (!canEdit(a)) throw new Refused("permission-denied", "this space is look-only for you");
  // Look-only links sign in a nameless guest, who could otherwise make spaces of their own to fill
  if (a.anonymous) throw new Refused("permission-denied", "sign in to add files");
  const file = bucket.file(pathFor(a.owner, space, id));
  const [there] = await file.exists();
  if (there) return { exists: true };
  const headers = {
    "content-type": contentType,
    "cache-control": "private, max-age=31536000, immutable",
    "x-goog-content-length-range": `${size},${size}`,
    "x-goog-if-generation-match": "0",
    "x-goog-meta-by": auth.uid,
  };
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: now + WRITE_TTL * 1000,
    contentType,
    extensionHeaders: Object.fromEntries(Object.entries(headers).filter(([k]) => k !== "content-type")),
  });
  return { url, headers };
}

// Same catch as the local shelf: one id is one file per space, so every module there using it loses it
export async function remove(db, bucket, auth, { space, id }) {
  fileId(id);
  const a = await access(db, auth, space);
  if (!canEdit(a)) throw new Refused("permission-denied", "this space is look-only for you");
  await bucket.file(pathFor(a.owner, space, id)).delete({ ignoreNotFound: true });
  return { ok: true };
}

// After a space doc is gone (its data is the trigger's snapshot)
export async function purge(bucket, sid, data) {
  const owner = data?.owner;
  if (typeof owner !== "string" || !SAFE.test(owner) || !SAFE.test(sid)) return 0;
  const prefix = prefixFor(owner, sid);
  const [files] = await bucket.getFiles({ prefix });
  if (files.length) await bucket.deleteFiles({ prefix, force: true });
  return files.length;
}
