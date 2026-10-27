// Passing tape takes between computers, straight browser to browser (docs/plans/peer-to-peer.md P3).
//
//   passTake(room, uid, take, opts)   hand one take to a person: drag it onto their face
//   startShelf(room, opts)            keep takes spreading: whoever has a take offers it to
//                                     members who don't, whenever two of them are online together
//
// A take's id is a hash of its sound (see localMedia), so the receiver can check it got the
// right bytes and the same take is one record on every shelf. The file transfer is peers.js's
// sendFile/onFile; the transfer id is the take's id, so a dropped connection picks up from
// the pieces that already arrived instead of starting over.
import { sendFile, onFile } from "./peers";
import { getBlob, put, del } from "./localMedia";
import { uidOfPeer } from "./presence";

const AUTO_MAX = 40 * 1024 * 1024; // takes bigger than this only go when someone hands them over
const ASK_FOR = 90000; // how long we wait for a take we asked for before asking someone else

const fileId = (takeId) => takeId.slice(0, 8);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const held = new Set(); // take ids known to be on this shelf (a cache; the shelf has the final say)
const has = async (id) => {
  if (held.has(id)) return true;
  if (!(await getBlob(id))) return false;
  held.add(id);
  return true;
};

// Peers of one person currently in the room (they may have two tabs open)
const peersOf = (room, uid) => [...room.peers].filter((p) => uidOfPeer(p) === uid);

// Wait up to `ms` for any of this person's peers to be in the room
function arrives(room, uid, ms) {
  if (peersOf(room, uid).length) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (v) => {
      clearTimeout(timer);
      off();
      resolve(v);
    };
    const timer = setTimeout(() => done(false), ms);
    const off = room.onPeer((id, joined) => joined && uidOfPeer(id) === uid && done(true));
  });
}

async function send(room, to, take, boardId, modId, onProgress) {
  const blob = await getBlob(take.id);
  if (!blob) throw new Error("that take isn't on this computer");
  return sendFile(room, blob, {
    to,
    id: fileId(take.id),
    resume: true,
    onProgress,
    meta: { kind: "take", id: take.id, boardId, modId },
  });
}

// Give a take to a person (all their open tabs in the room). If the connection drops part-way
// it waits for them to come back and carries on from the last piece. Rejects if it can't.
export async function passTake(room, uid, take, { boardId, modId, onProgress } = {}) {
  let err = null;
  for (let go = 0; go < 3; go++) {
    if (!(await arrives(room, uid, 60000))) break;
    try {
      return await send(room, peersOf(room, uid), take, boardId, modId, onProgress);
    } catch (e) {
      err = e;
      await wait(1000);
    }
  }
  throw err ?? new Error("they're not here right now");
}

// opts: getTakes() → [{ take, boardId, modId }] every take the board describes;
// onGot(takeId, fromPeer) a take just arrived.
// Returns { refresh(), stop() }: call refresh when the board's takes change.
export function startShelf(room, { getTakes, onGot }) {
  const asked = new Map(); // take id → { peer, at }: who we asked, so we don't ask everybody
  const sending = new Set(); // "peer/take id"
  let stopped = false;

  // The takes of the board that aren't on this shelf
  async function wanted() {
    const out = [];
    for (const { take } of getTakes()) if (take.size <= AUTO_MAX && !(await has(take.id))) out.push(take.id);
    return out;
  }
  async function ask(to) {
    const ids = await wanted();
    if (!stopped && ids.length) room.send("tape", { k: "want", ids }, to);
  }

  const offs = [
    room.on("tape", async (m, from) => {
      if (stopped || !m) return;
      if (m.k === "want") {
        // Tell them which of those I have
        const mine = [];
        for (const id of m.ids ?? []) if (getTakes().some((x) => x.take.id === id) && (await has(id))) mine.push(id);
        if (mine.length) room.send("tape", { k: "have", ids: mine }, from);
      } else if (m.k === "have") {
        // The first one to say they have it is the one we ask
        const need = new Set(await wanted());
        const pick = (m.ids ?? []).filter((id) => {
          const a = asked.get(id);
          return need.has(id) && (!a || Date.now() - a.at > ASK_FOR || !room.peers.has(a.peer));
        });
        for (const id of pick) asked.set(id, { peer: from, at: Date.now() });
        if (pick.length) room.send("tape", { k: "send", ids: pick }, from);
      } else if (m.k === "send") {
        for (const id of m.ids ?? []) {
          const x = getTakes().find((t) => t.take.id === id);
          const key = `${from}/${id}`;
          if (!x || sending.has(key) || !(await has(id))) continue;
          sending.add(key);
          send(room, from, x.take, x.boardId, x.modId)
            .catch(() => {}) // they'll ask again next time we're both here
            .finally(() => sending.delete(key));
        }
      }
    }),
    // A file arrived: if it's a take, it goes on the shelf
    onFile(room, async (blob, { from, meta }) => {
      if (stopped || meta?.kind !== "take") return;
      const id = await put(blob, { boardId: meta.boardId, modId: meta.modId });
      if (!id) return;
      if (id !== meta.id) return void (await del(id)); // not the sound it said it was
      held.add(id);
      asked.delete(id);
      onGot?.(id, from);
    }),
    // Someone arrived: tell them what I'm missing
    room.onPeer((id, joined) => joined && wait(600).then(() => !stopped && ask(id))),
  ];
  room.ready.then(() => !stopped && room.peers.size && ask());

  return {
    refresh: () => ask(),
    stop() {
      stopped = true;
      offs.forEach((off) => off());
    },
  };
}
