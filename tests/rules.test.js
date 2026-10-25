// Security rules for spaces. Run with `npm run test:rules` (needs Java and
// firebase-tools; the Firestore emulator runs locally and touches no real data).
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, collectionGroup, query, where } from "firebase/firestore";

let env;
const S = "space1";

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "boards-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(() => env.cleanup());

// One space owned by "owner", with an editor and a viewer, a module, an entry and invites
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "spaces", S), { owner: "owner", kind: "board", title: "Lyrics" });
    await setDoc(doc(db, "spaces", S, "members", "owner"), { uid: "owner", role: "owner" });
    await setDoc(doc(db, "spaces", S, "members", "editor"), { uid: "editor", role: "edit" });
    await setDoc(doc(db, "spaces", S, "members", "viewer"), { uid: "viewer", role: "view" });
    await setDoc(doc(db, "spaces", S, "modules", "m1"), { type: "notes", x: 0, y: 0 });
    await setDoc(doc(db, "spaces", S, "entries", "e1"), { kind: "log", by: "editor", at: 1 });
    await setDoc(doc(db, "invites", "good-edit"), { space: S, role: "edit", revoked: false });
    await setDoc(doc(db, "invites", "good-view"), { space: S, role: "view", revoked: false });
    await setDoc(doc(db, "invites", "revoked"), { space: S, role: "edit", revoked: true });
    await setDoc(doc(db, "invites", "other-space"), { space: "elsewhere", role: "edit", revoked: false });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const stranger = () => as("stranger");

describe("space doc", () => {
  it("members read, strangers and signed-out do not", async () => {
    for (const u of ["owner", "editor", "viewer"]) await assertSucceeds(getDoc(doc(as(u), "spaces", S)));
    await assertFails(getDoc(doc(stranger(), "spaces", S)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "spaces", S)));
  });
  it("owner and editor update, viewer and stranger do not", async () => {
    await assertSucceeds(updateDoc(doc(as("owner"), "spaces", S), { title: "A" }));
    await assertSucceeds(updateDoc(doc(as("editor"), "spaces", S), { title: "B" }));
    await assertFails(updateDoc(doc(as("viewer"), "spaces", S), { title: "C" }));
    await assertFails(updateDoc(doc(stranger(), "spaces", S), { title: "D" }));
  });
  it("nobody can hand the space to someone else", async () => {
    await assertFails(updateDoc(doc(as("editor"), "spaces", S), { owner: "editor" }));
  });
  it("only the owner deletes", async () => {
    await assertFails(deleteDoc(doc(as("editor"), "spaces", S)));
    await assertFails(deleteDoc(doc(as("viewer"), "spaces", S)));
    await assertSucceeds(deleteDoc(doc(as("owner"), "spaces", S)));
  });
  it("anyone signed in can create a space they own, not one owned by someone else", async () => {
    await assertSucceeds(setDoc(doc(stranger(), "spaces", "mine"), { owner: "stranger" }));
    await assertFails(setDoc(doc(stranger(), "spaces", "theirs"), { owner: "owner" }));
  });
  it("owner row can be made in the same batch as the space", async () => {
    const db = as("newbie");
    const { writeBatch } = await import("firebase/firestore");
    const b = writeBatch(db);
    b.set(doc(db, "spaces", "fresh"), { owner: "newbie", kind: "board" });
    b.set(doc(db, "spaces", "fresh", "members", "newbie"), { uid: "newbie", role: "owner", via: null });
    await assertSucceeds(b.commit());
  });
});

describe.each([["modules", "m1"], ["entries", "e1"]])("%s", (sub, id) => {
  const ref = (db) => doc(db, "spaces", S, sub, id);
  it("members read, strangers do not", async () => {
    for (const u of ["owner", "editor", "viewer"]) await assertSucceeds(getDoc(ref(as(u))));
    await assertFails(getDoc(ref(stranger())));
  });
  it("owner and editor write, viewer and stranger do not", async () => {
    await assertSucceeds(setDoc(ref(as("owner")), { x: 1 }));
    await assertSucceeds(setDoc(ref(as("editor")), { x: 2 }));
    await assertFails(setDoc(ref(as("viewer")), { x: 3 }));
    await assertFails(setDoc(ref(stranger()), { x: 4 }));
    await assertFails(deleteDoc(ref(as("viewer"))));
    await assertSucceeds(deleteDoc(ref(as("editor"))));
  });
  it("members can list the collection, strangers cannot", async () => {
    await assertSucceeds(getDocs(collection(as("viewer"), "spaces", S, sub)));
    await assertFails(getDocs(collection(stranger(), "spaces", S, sub)));
  });
});

describe("joining with an invite", () => {
  const join = (uid, via, role) =>
    setDoc(doc(as(uid), "spaces", S, "members", uid), { uid, role, via, joinedAt: 1 });

  it("a live invite with the same role works", async () => {
    await assertSucceeds(join("joiner1", "good-edit", "edit"));
    await assertSucceeds(join("joiner2", "good-view", "view"));
  });
  it("a revoked invite fails", async () => {
    await assertFails(join("joiner", "revoked", "edit"));
  });
  it("asking for a bigger role than the invite gives fails", async () => {
    await assertFails(join("joiner", "good-view", "edit"));
    await assertFails(join("joiner", "good-edit", "owner"));
  });
  it("an invite for another space fails", async () => {
    await assertFails(join("joiner", "other-space", "edit"));
  });
  it("no invite at all fails", async () => {
    await assertFails(setDoc(doc(as("joiner"), "spaces", S, "members", "joiner"), { uid: "joiner", role: "edit" }));
  });
  it("you can only add your own row", async () => {
    await assertFails(setDoc(doc(as("joiner"), "spaces", S, "members", "someoneElse"), { uid: "someoneElse", role: "edit", via: "good-edit" }));
  });
  it("members leave on their own; the owner removes anyone; others cannot", async () => {
    await assertSucceeds(deleteDoc(doc(as("viewer"), "spaces", S, "members", "viewer")));
    await assertFails(deleteDoc(doc(as("editor"), "spaces", S, "members", "owner")));
    await assertSucceeds(deleteDoc(doc(as("owner"), "spaces", S, "members", "editor")));
  });
  it("a member can't change their own role", async () => {
    await assertFails(updateDoc(doc(as("viewer"), "spaces", S, "members", "viewer"), { role: "edit" }));
  });
});

describe("invites", () => {
  it("a signed-in person can open one by token", async () => {
    await assertSucceeds(getDoc(doc(stranger(), "invites", "good-view")));
  });
  it("nobody can list them", async () => {
    await assertFails(getDocs(collection(stranger(), "invites")));
    await assertFails(getDocs(collection(as("owner"), "invites")));
  });
  it("signed-out can't open one", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "invites", "good-view")));
  });
  it("only the owner makes, changes and revokes them", async () => {
    await assertSucceeds(setDoc(doc(as("owner"), "invites", "new"), { space: S, role: "view", revoked: false }));
    await assertFails(setDoc(doc(as("editor"), "invites", "new2"), { space: S, role: "view", revoked: false }));
    await assertFails(setDoc(doc(stranger(), "invites", "new3"), { space: S, role: "edit", revoked: false }));
    await assertSucceeds(updateDoc(doc(as("owner"), "invites", "good-view"), { revoked: true }));
    await assertFails(updateDoc(doc(as("editor"), "invites", "good-edit"), { revoked: true }));
  });
});

describe("my own corner and my entries", () => {
  it("users/{uid} is private to that person", async () => {
    await assertSucceeds(setDoc(doc(as("owner"), "users", "owner", "mounts", S), { where: "home", order: 0 }));
    await assertFails(getDoc(doc(stranger(), "users", "owner", "mounts", S)));
  });
  it("the collection-group query returns only my own entries", async () => {
    const mine = query(collectionGroup(as("editor"), "entries"), where("by", "==", "editor"), where("at", ">=", 0));
    await assertSucceeds(getDocs(mine));
    const theirs = query(collectionGroup(as("stranger"), "entries"), where("by", "==", "editor"));
    await assertFails(getDocs(theirs));
    await assertFails(getDocs(collectionGroup(as("editor"), "entries")));
  });
});
