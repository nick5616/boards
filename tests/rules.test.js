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
    await assertSucceeds(setDoc(doc(as("owner"), "invites", "new"), { space: S, role: "view", by: "owner", title: "Lyrics", fromName: "Nicole", revoked: false }));
    // not in someone else's name
    await assertFails(setDoc(doc(as("owner"), "invites", "new4"), { space: S, role: "view", by: "editor", revoked: false }));
    await assertFails(setDoc(doc(as("editor"), "invites", "new2"), { space: S, role: "view", revoked: false }));
    await assertFails(setDoc(doc(stranger(), "invites", "new3"), { space: S, role: "edit", revoked: false }));
    await assertSucceeds(updateDoc(doc(as("owner"), "invites", "good-view"), { revoked: true }));
    await assertFails(updateDoc(doc(as("editor"), "invites", "good-edit"), { revoked: true }));
  });
  it("a key can't be turned into one for another space or a bigger role", async () => {
    await assertFails(updateDoc(doc(as("owner"), "invites", "good-view"), { role: "edit" }));
    await assertFails(updateDoc(doc(as("owner"), "invites", "good-view"), { space: "elsewhere" }));
  });
});

// The whole M2 trip: a guest with no account opens a look-only link
describe("anonymous guest with a view link", () => {
  const guest = () => env.authenticatedContext("guest1", { firebase: { sign_in_provider: "anonymous" } }).firestore();
  const batchJoin = async (via, role) => {
    const { writeBatch } = await import("firebase/firestore");
    const db = guest();
    const b = writeBatch(db);
    b.set(doc(db, "spaces", S, "members", "guest1"), { uid: "guest1", role, name: "", via, joinedAt: 1 });
    b.set(doc(db, "users", "guest1", "mounts", S), { where: "home", shared: true, role, order: 0 });
    return b.commit();
  };

  it("can read the invite (title and sender), join with it, then read the board", async () => {
    await assertSucceeds(getDoc(doc(guest(), "invites", "good-view")));
    await assertFails(getDoc(doc(guest(), "spaces", S))); // not yet
    await assertSucceeds(batchJoin("good-view", "view"));
    await assertSucceeds(getDoc(doc(guest(), "spaces", S)));
    await assertSucceeds(getDoc(doc(guest(), "spaces", S, "modules", "m1")));
    await assertSucceeds(getDocs(collection(guest(), "spaces", S, "members")));
  });
  it("can't use it to claim edit", async () => {
    await assertFails(batchJoin("good-view", "edit"));
  });
  it("can't use a revoked link", async () => {
    await assertFails(batchJoin("revoked", "edit"));
  });
  it("once in, still can't write modules, entries, the space, or invites", async () => {
    await batchJoin("good-view", "view");
    await assertFails(setDoc(doc(guest(), "spaces", S, "modules", "m1"), { x: 9 }));
    await assertFails(setDoc(doc(guest(), "spaces", S, "modules", "m2"), { type: "notes" }));
    await assertFails(deleteDoc(doc(guest(), "spaces", S, "modules", "m1")));
    await assertFails(setDoc(doc(guest(), "spaces", S, "entries", "e2"), { kind: "log", by: "guest1", at: 1 }));
    await assertFails(updateDoc(doc(guest(), "spaces", S), { title: "mine now" }));
    await assertFails(setDoc(doc(guest(), "invites", "sneaky"), { space: S, role: "edit", by: "guest1", revoked: false }));
  });
  it("can leave on their own", async () => {
    await batchJoin("good-view", "view");
    await assertSucceeds(deleteDoc(doc(guest(), "spaces", S, "members", "guest1")));
    await assertFails(getDoc(doc(guest(), "spaces", S)));
  });
});

describe("revoking and removing", () => {
  it("a link taken back stops working for new joiners, not for people already in", async () => {
    await assertSucceeds(updateDoc(doc(as("owner"), "invites", "good-edit"), { revoked: true }));
    await assertFails(setDoc(doc(as("late"), "spaces", S, "members", "late"), { uid: "late", role: "edit", via: "good-edit", joinedAt: 1 }));
    await assertSucceeds(getDoc(doc(as("editor"), "spaces", S, "modules", "m1")));
  });
  it("the owner removes a member, who then loses the board; nobody else can remove people", async () => {
    await assertFails(deleteDoc(doc(as("viewer"), "spaces", S, "members", "editor")));
    await assertSucceeds(deleteDoc(doc(as("owner"), "spaces", S, "members", "editor")));
    await assertFails(getDoc(doc(as("editor"), "spaces", S)));
    await assertFails(setDoc(doc(as("editor"), "spaces", S, "modules", "m1"), { x: 1 }));
  });
  it("stop sharing: the owner clears everyone else in one batch and revokes both links", async () => {
    const { writeBatch } = await import("firebase/firestore");
    const db = as("owner");
    const b = writeBatch(db);
    b.delete(doc(db, "spaces", S, "members", "editor"));
    b.delete(doc(db, "spaces", S, "members", "viewer"));
    b.update(doc(db, "invites", "good-edit"), { revoked: true });
    b.update(doc(db, "invites", "good-view"), { revoked: true });
    b.update(doc(db, "spaces", S), { shared: false });
    await assertSucceeds(b.commit());
    await assertSucceeds(getDoc(doc(as("owner"), "spaces", S)));
    await assertFails(getDoc(doc(as("viewer"), "spaces", S)));
  });
  it("a member's row has to say who they are", async () => {
    await assertFails(setDoc(doc(as("joiner"), "spaces", S, "members", "joiner"), { uid: "someoneElse", role: "edit", via: "good-edit" }));
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
