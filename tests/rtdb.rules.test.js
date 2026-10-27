// Realtime Database rules: who may see faces and cursors, and who may join a phone-remote room.
// Run with `npm run test:rules` (database and firestore emulators).
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { ref, set, get } from "firebase/database";

let env;
const S = "space1";
const SECRET = "a-long-room-secret-0123456789";
const PAIR = "pair_0123456789abcdef0123456789abcdef";

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "boards-rtdb-rules-test",
    database: { rules: readFileSync("database.rules.json", "utf8"), host: "127.0.0.1", port: 9000 },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearDatabase());

const as = (uid) => env.authenticatedContext(uid).database();
const claim = (uid, secret = SECRET) => set(ref(as(uid), `keys/${S}`), { owner: uid, secret });

describe("room secret (keys)", () => {
  it("the first claim wins and nobody can change or read it", async () => {
    await assertSucceeds(claim("owner"));
    await assertFails(claim("stranger", "another-secret-0123456789"));
    await assertFails(claim("owner", "changed-secret-0123456789"));
    await assertFails(get(ref(as("owner"), `keys/${S}`)));
  });
  it("a claim has to name the one making it", async () => {
    await assertFails(set(ref(as("stranger"), `keys/${S}`), { owner: "owner", secret: SECRET }));
  });
});

describe("access rows for a space", () => {
  beforeEach(() => claim("owner"));
  it("need the room secret", async () => {
    await assertSucceeds(set(ref(as("owner"), `access/${S}/owner`), { role: "owner", secret: SECRET }));
    await assertSucceeds(set(ref(as("friend"), `access/${S}/friend`), { role: "view", secret: SECRET }));
    await assertFails(set(ref(as("stranger"), `access/${S}/stranger`), { role: "view", secret: "guessed-0123456789abc" }));
    await assertFails(set(ref(as("stranger"), `access/${S}/stranger`), "view")); // the old bare-role row
  });
  it("are your own, and only yours", async () => {
    await assertFails(set(ref(as("friend"), `access/${S}/owner`), { role: "view", secret: SECRET }));
  });
  it("a space nobody claimed lets nobody in", async () => {
    await assertFails(set(ref(as("friend"), `access/other/friend`), { role: "view", secret: SECRET }));
  });
  it("open the presence list, and strangers don't see it", async () => {
    await set(ref(as("owner"), `access/${S}/owner`), { role: "owner", secret: SECRET });
    await assertSucceeds(get(ref(as("owner"), `presence/${S}`)));
    await assertFails(get(ref(as("stranger"), `presence/${S}`)));
    await assertFails(get(ref(as("stranger"), `rooms/${S}`)));
  });
});

describe("phone-remote rooms", () => {
  it("anyone signed in can join a pair room by its name, and sees only that room", async () => {
    await assertSucceeds(set(ref(as("phone"), `access/${PAIR}/phone`), "pair"));
    await assertSucceeds(set(ref(as("phone"), `rooms/${PAIR}/phone-abc123`), 1));
    await assertFails(get(ref(as("stranger"), `rooms/${PAIR}`)));
    await assertFails(get(ref(as("phone"), `rooms/${PAIR}x`)));
  });
  it("a pair row can't stand in for a space's", async () => {
    await assertFails(set(ref(as("phone"), `access/${S}/phone`), "pair"));
  });
  it("signed-out is out", async () => {
    await assertFails(set(ref(env.unauthenticatedContext().database(), `access/${PAIR}/x`), "pair"));
  });
});
