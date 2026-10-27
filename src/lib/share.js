// Sharing a board: invites (the keys), joining with one, taking people off.
// See docs/plans/sharing-multiplayer.md. Everything here needs VITE_SPACES=1.
//
//   invites/{token}   { space, role, by, title, fromName, createdAt, revoked }
//                     the token is the key: long, random, never listed.
//                     title / fromName ride along so the join screen can say
//                     "Nicole shared Lyrics with you" before you're a member.
//   my mount          the owner's own mounts/{sid} also remembers { invites: { edit, view } },
//                     because the rules don't let anyone list invites (and an editor
//                     reading the space doc shouldn't find the edit key lying there).

import { getDoc, getDocs, writeBatch, deleteField } from "firebase/firestore";
import { linkWithPopup } from "firebase/auth";
import { db, auth, googleProvider } from "../firebase";
import { inviteDoc, memberDoc, membersCol, mountDoc, spaceDoc } from "./data";

// ~22 chars of base64url from 16 random bytes (128 bits)
export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const linkFor = (token) => `${window.location.origin}/s/${token}`;

// A colour for someone's face, steady for the same person
export function faceColor(uid = "") {
  let h = 0;
  for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 62%)`;
}

export const firstName = (name) => (name || "").trim().split(/\s+/)[0] || "Someone";

// Makes a fresh link for one role. The old one for that role, if any, is revoked
// in the same write, so there is never a moment with two live keys for one role.
// invites = the owner's current { edit, view } tokens (from their mount).
export async function freshInvite(board, uid, role, invites = {}) {
  const token = newToken();
  const who = auth.currentUser;
  const batch = writeBatch(db);
  if (invites[role]) batch.update(inviteDoc(invites[role]), { revoked: true });
  batch.set(inviteDoc(token), {
    space: board.id,
    role,
    by: uid,
    title: board.title ?? "",
    fromName: who?.displayName ?? "",
    createdAt: Date.now(),
    revoked: false,
  });
  batch.update(mountDoc(uid, board.id), { [`invites.${role}`]: token });
  // From the first invite on, edits go through transactions (see useSpaces)
  // (and the room secret for faces and cursors, made once; see presence.js)
  batch.update(spaceDoc(board.id), { shared: true, roomSecret: board.roomSecret ?? newToken() });
  await batch.commit();
  return token;
}

// Takes a link back without making a new one
export async function revokeInvite(board, uid, role, invites = {}) {
  const batch = writeBatch(db);
  if (invites[role]) batch.update(inviteDoc(invites[role]), { revoked: true });
  batch.update(mountDoc(uid, board.id), { [`invites.${role}`]: deleteField() });
  await batch.commit();
}

// Sends one person away. (Their own shelf notices on its next look and tidies itself.)
export const removeMember = (sid, uid) => writeBatch(db).delete(memberDoc(sid, uid)).commit();

// Everyone else out, both links revoked, the board plain again
export async function stopSharing(board, uid, invites = {}) {
  const members = await getDocs(membersCol(board.id));
  const batch = writeBatch(db);
  members.docs.forEach((d) => d.id !== uid && batch.delete(d.ref));
  Object.values(invites).forEach((t) => t && batch.update(inviteDoc(t), { revoked: true }));
  batch.update(mountDoc(uid, board.id), { invites: deleteField() });
  batch.update(spaceDoc(board.id), { shared: false });
  await batch.commit();
}

// Leaving a board someone shared with me: my member row and my shelf spot
export function leaveSpace(sid, uid) {
  const batch = writeBatch(db);
  batch.delete(memberDoc(sid, uid));
  batch.delete(mountDoc(uid, sid));
  return batch.commit();
}

// What the join screen shows. Null when the key is gone or taken back.
export async function lookUpInvite(token) {
  const snap = await getDoc(inviteDoc(token));
  if (!snap.exists() || snap.data().revoked) return null;
  return snap.data();
}

// In one batch: my member row in their space, and the board on my shelf.
// Already in? Then there is nothing to do but open it.
export async function joinSpace(token, invite, uid, order) {
  const sid = invite.space;
  if ((await getDoc(mountDoc(uid, sid))).exists()) return sid;
  const who = auth.currentUser;
  const now = Date.now();
  const batch = writeBatch(db);
  batch.set(memberDoc(sid, uid), {
    uid,
    role: invite.role,
    name: who?.displayName ?? "",
    photo: who?.photoURL ?? "",
    color: faceColor(uid),
    via: token,
    joinedAt: now,
  });
  batch.set(mountDoc(uid, sid), {
    where: "home",
    shared: true,
    role: invite.role,
    fromName: invite.fromName ?? "",
    order,
    addedAt: now,
  });
  await batch.commit();
  return sid;
}

// "Sign in to keep this": the same person, now with a Google account behind them
export const upgradeToGoogle = () => linkWithPopup(auth.currentUser, googleProvider);
