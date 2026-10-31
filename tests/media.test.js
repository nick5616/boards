// Who gets signed URLs for which files (functions/media.js). Run with `npm run test:rules`:
// the space and member rows live in the Firestore emulator, the bucket is a stand-in that
// records what was asked of it, and real V4 URLs are signed with a throwaway local key.
import { createRequire } from "node:module";
import { generateKeyPairSync } from "node:crypto";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { read, upload, remove, purge, pathFor, WINDOW } from "../functions/media.js";

const { Storage } = createRequire(new URL("../functions/", import.meta.url))("@google-cloud/storage");

let env;
const S = "space1";
const HOST = "owner";

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "boards-media-test",
    firestore: { rules: "service cloud.firestore { match /{d=**} { allow read, write: if false; } }", host: "127.0.0.1", port: 8080 },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "spaces", S), { owner: HOST, kind: "board" });
    for (const [uid, role] of [["owner", "owner"], ["editor", "edit"], ["viewer", "view"], ["guest", "view"], ["anonEditor", "edit"]]) {
      await setDoc(doc(db, "spaces", S, "members", uid), { uid, role });
    }
  });
});

// Runs a handler with the admin-like (rules off) Firestore, which has the same doc().get() shape as firebase-admin's
const withDb = (fn) => {
  let out;
  return env.withSecurityRulesDisabled(async (ctx) => (out = await fn(ctx.firestore()))).then(() => out);
};

const user = (uid, provider = "google.com") => ({ uid, token: { firebase: { sign_in_provider: provider } } });

// A bucket that remembers what it was asked
function fakeBucket(present = []) {
  const have = new Set(present);
  const log = [];
  return {
    log,
    have,
    file: (path) => ({
      getSignedUrl: async (o) => (log.push({ path, ...o }), [`https://signed/${path}?${o.action}`]),
      exists: async () => [have.has(path)],
      delete: async () => (log.push({ path, action: "delete" }), have.delete(path)),
    }),
    getFiles: async ({ prefix }) => [[...have].filter((p) => p.startsWith(prefix))],
    deleteFiles: async ({ prefix }) => {
      log.push({ prefix, action: "deleteFiles" });
      for (const p of [...have]) if (p.startsWith(prefix)) have.delete(p);
    },
  };
}

const ID = "0123456789abcdef";
const refusal = async (p) => {
  try {
    await p;
  } catch (e) {
    return e.code;
  }
  return "allowed";
};

describe("read", () => {
  it("every member gets URLs, from the host's folder", async () => {
    for (const u of ["owner", "editor", "viewer"]) {
      const b = fakeBucket();
      const { urls } = await withDb((db) => read(db, b, user(u), { space: S, ids: [ID, "fedcba9876543210"] }));
      expect(Object.keys(urls)).toEqual([ID, "fedcba9876543210"]);
      expect(b.log.map((l) => l.path)).toEqual([pathFor(HOST, S, ID), pathFor(HOST, S, "fedcba9876543210")]);
      expect(b.log.every((l) => l.action === "read")).toBe(true);
    }
  });
  it("look-only guests signed in anonymously still see files", async () => {
    const { urls } = await withDb((db) => read(db, fakeBucket(), user("guest", "anonymous"), { space: S, ids: [ID] }));
    expect(urls[ID]).toBeTruthy();
  });
  it("strangers, signed-out callers and missing spaces are refused", async () => {
    expect(await refusal(withDb((db) => read(db, fakeBucket(), user("stranger"), { space: S, ids: [ID] })))).toBe("permission-denied");
    expect(await refusal(withDb((db) => read(db, fakeBucket(), null, { space: S, ids: [ID] })))).toBe("unauthenticated");
    expect(await refusal(withDb((db) => read(db, fakeBucket(), user("owner"), { space: "nope", ids: [ID] })))).toBe("permission-denied");
  });
  it("paths can't be steered out of the host's folder", async () => {
    for (const ids of [["../../other/x"], ["a/b/c/d/e/f"], [""], []]) {
      expect(await refusal(withDb((db) => read(db, fakeBucket(), user("owner"), { space: S, ids })))).toBe("invalid-argument");
    }
    expect(await refusal(withDb((db) => read(db, fakeBucket(), user("owner"), { space: "../x", ids: [ID] })))).toBe("invalid-argument");
  });
  it("everyone in the same hour is handed the same window", async () => {
    const b = fakeBucket();
    const t = Date.UTC(2026, 9, 29, 15, 7);
    await withDb((db) => read(db, b, user("owner"), { space: S, ids: [ID] }, t));
    await withDb((db) => read(db, b, user("viewer"), { space: S, ids: [ID] }, t + 40 * 60 * 1000));
    const [a, c] = b.log;
    expect(a.accessibleAt.getTime()).toBe(Date.UTC(2026, 9, 29, 15));
    expect(c.accessibleAt.getTime()).toBe(a.accessibleAt.getTime());
    expect(a.expires).toBe(c.expires);
    expect(a.expires - t).toBeGreaterThanOrEqual(WINDOW * 1000);
  });
});

describe("upload", () => {
  const ask = (uid, extra = {}, provider) => (b) =>
    withDb((db) => upload(db, b, user(uid, provider), { space: S, id: ID, type: "audio/ogg", size: 1234, ...extra }));

  it("owners and editors get a PUT URL into the host's folder", async () => {
    for (const u of ["owner", "editor"]) {
      const b = fakeBucket();
      const out = await ask(u)(b);
      expect(out.url).toBeTruthy();
      expect(b.log[0]).toMatchObject({ path: pathFor(HOST, S, ID), action: "write", contentType: "audio/ogg" });
      expect(out.headers["x-goog-if-generation-match"]).toBe("0");
      expect(out.headers["x-goog-content-length-range"]).toBe("1234,1234");
      expect(out.headers["x-goog-meta-by"]).toBe(u);
    }
  });
  it("viewers, anonymous editors and strangers are refused", async () => {
    expect(await refusal(ask("viewer")(fakeBucket()))).toBe("permission-denied");
    expect(await refusal(ask("anonEditor", {}, "anonymous")(fakeBucket()))).toBe("permission-denied");
    expect(await refusal(ask("stranger")(fakeBucket()))).toBe("permission-denied");
  });
  it("a file that's already there needs no upload", async () => {
    const b = fakeBucket([pathFor(HOST, S, ID)]);
    expect(await ask("editor")(b)).toEqual({ exists: true });
    expect(b.log).toEqual([]);
  });
  it("sizes and types are checked", async () => {
    expect(await refusal(ask("owner", { size: 0 })(fakeBucket()))).toBe("invalid-argument");
    expect(await refusal(ask("owner", { size: 3 * 1024 ** 3 })(fakeBucket()))).toBe("out-of-range");
    const out = await ask("owner", { type: "text/html\r\nx-evil: 1" })(fakeBucket());
    expect(out.headers["content-type"]).toBe("application/octet-stream");
  });
});

describe("remove and purge", () => {
  it("editors remove, viewers don't", async () => {
    const b = fakeBucket([pathFor(HOST, S, ID)]);
    expect(await refusal(withDb((db) => remove(db, b, user("viewer"), { space: S, id: ID })))).toBe("permission-denied");
    expect(b.have.size).toBe(1);
    await withDb((db) => remove(db, b, user("editor"), { space: S, id: ID }));
    expect(b.have.size).toBe(0);
  });
  it("a deleted space takes its own folder with it, and nobody else's", async () => {
    const b = fakeBucket([pathFor(HOST, S, ID), pathFor(HOST, S, "fedcba9876543210"), pathFor(HOST, "space10", ID), pathFor("x", S, ID)]);
    expect(await purge(b, S, { owner: HOST })).toBe(2);
    expect([...b.have].sort()).toEqual([pathFor(HOST, "space10", ID), pathFor("x", S, ID)].sort());
    expect(await purge(b, S, {})).toBe(0);
  });
});

describe("real V4 signing (local throwaway key, no network)", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  const bucket = new Storage({ projectId: "t", credentials: { client_email: "t@t.iam.gserviceaccount.com", private_key: privateKey } }).bucket("t-media");

  it("two people in the same window get byte-identical read URLs", async () => {
    const t = Date.UTC(2026, 9, 29, 15, 7);
    const a = await withDb((db) => read(db, bucket, user("owner"), { space: S, ids: [ID] }, t));
    const b = await withDb((db) => read(db, bucket, user("guest", "anonymous"), { space: S, ids: [ID] }, t + 30 * 60 * 1000));
    expect(a.urls[ID]).toBe(b.urls[ID]);
    expect(a.urls[ID]).toContain(`/t-media/users/${HOST}/spaces/${S}/${ID}?`);
    expect(a.urls[ID]).toContain("X-Goog-Date=20261029T150000Z");
    expect(a.urls[ID]).toContain("X-Goog-Expires=7200");
  });
  it("the upload URL binds the no-overwrite, size and type headers", async () => {
    const out = await withDb((db) => upload(db, { file: (p) => Object.assign(bucket.file(p), { exists: async () => [false] }) }, user("editor"), { space: S, id: ID, type: "video/mp4", size: 99 }));
    const signed = decodeURIComponent(new URL(out.url).searchParams.get("X-Goog-SignedHeaders"));
    for (const h of ["content-type", "x-goog-if-generation-match", "x-goog-content-length-range", "cache-control", "x-goog-meta-by"]) expect(signed).toContain(h);
  });
});
