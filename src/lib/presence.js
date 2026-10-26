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
import { faceColor } from "./share";

// A peer id is "{uid}-{random}" (see rtdbPeers.js); this is the person inside it
export const uidOfPeer = (peer) => peer.slice(0, peer.lastIndexOf("-"));

export function myFace() {
  const u = auth.currentUser;
  return { uid: u.uid, name: u.displayName ?? "", photo: u.photoURL ?? "", color: faceColor(u.uid) };
}

// Writes my access row. The rules check it before they let me see or add anything else,
// so the live room waits for this to land before it starts listening.
export async function allow(sid, role) {
  const { db, ref, set } = await rtdb();
  await set(ref(db, `access/${sid}/${auth.currentUser.uid}`), role);
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
