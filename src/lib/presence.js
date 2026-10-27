// Who is looking at a shared board right now: the faces. Lives in the Realtime Database
// because it needs to vanish by itself when a tab closes (onDisconnect), which Firestore can't do.
// See docs/plans/sharing-multiplayer.md M4, and database.rules.json for what's allowed.
//
//   access/{sid}/{uid}    my role, mirrored by my own client, because RTDB rules can't read
//                         Firestore and need some way to know I'm a member
//   presence/{sid}/{uid}  { name, color, photo, tab, at }  gone when I close the tab
//
// Everything here is loaded on demand; a private board never touches it.

import { auth } from "../firebase";
import { rtdb } from "./rtdb";
import { updateDoc } from "firebase/firestore";
import { spaceDoc } from "./data";
import { faceColor, newToken } from "./share";

// A peer id is "{uid}-{random}" (see rtdbPeers.js); this is the person inside it
export const uidOfPeer = (peer) => peer.slice(0, peer.lastIndexOf("-"));

export function myFace() {
  const u = auth.currentUser;
  return { uid: u.uid, name: u.displayName ?? "", photo: u.photoURL ?? "", color: faceColor(u.uid) };
}

// The space's room secret lives on its Firestore doc, which only members can read. The owner
// makes it the first time it's needed (freshInvite does too); everyone else waits for it.
export async function ensureSecret(sid, role, secret) {
  if (secret || role !== "owner") return secret || null;
  const made = newToken();
  await updateDoc(spaceDoc(sid), { roomSecret: made });
  return made;
}

// Writes my access row. The rules check it before they let me see or add anything else,
// so the live room waits for this to land before it starts listening. The row carries the
// room secret: a stranger who only knows the space id can't write a row that passes.
// The owner also claims the secret in the database (first writer wins, so a later claim just fails).
export async function allow(sid, role, secret) {
  const { db, ref, set } = await rtdb();
  const me = auth.currentUser.uid;
  if (role === "owner") await set(ref(db, `keys/${sid}`), { owner: me, secret }).catch(() => {});
  await set(ref(db, `access/${sid}/${me}`), { role, secret });
}

// Joins the board's presence (after allow). tab() says which tab I'm on when a row is written.
// onPeople gets everyone else here, as [{ uid, name, color, photo, tab }].
// Resolves to { touch, leave }; touch() re-writes my row (the tab changed).
export async function joinPresence(sid, tab, onPeople) {
  const me = myFace();
  const { db, ref, set, remove, onValue, onDisconnect, serverTimestamp } = await rtdb();
  let left = false;

  const mine = ref(db, `presence/${sid}/${me.uid}`);
  await onDisconnect(mine).remove();
  const touch = () =>
    !left &&
    set(mine, { name: me.name, color: me.color, photo: me.photo, tab: tab() ?? "", at: serverTimestamp() }).catch(() => {});
  touch();

  const off = onValue(
    ref(db, `presence/${sid}`),
    (snap) => {
      const rows = snap.val() ?? {};
      onPeople(
        Object.entries(rows)
          .filter(([uid]) => uid !== me.uid)
          .map(([uid, r]) => ({ uid, name: r.name, color: r.color || faceColor(uid), photo: r.photo, tab: r.tab }))
      );
    },
    () => onPeople([])
  );

  return {
    touch,
    leave() {
      if (left) return;
      left = true;
      off();
      remove(mine).catch(() => {});
    },
  };
}
