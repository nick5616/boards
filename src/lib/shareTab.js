// Sharing one tab (a board tab, or a tab of a File folders module). See
// docs/plans/sharing-multiplayer.md, M3. Everything here needs VITE_SPACES=1.
//
// Sharing turns the tab into a space of its own (kind "tab") and leaves a *mount* in
// its place: { id, name, mount: sid } in board.tabs, or in the folder's state.tabs.
// The tab keeps its id, so the swap is easy to spot (and to re-run) if it gets interrupted.
//
// Order matters, because any of it can be cut short (closed laptop, dropped wifi):
//   1. the new space, its owner row and my mount             (nothing visible changes)
//   2. its modules, then its entries                         (the original is still whole)
//   3. the tab on the board becomes a mount                  (from here on it reads from the space)
//   4. the originals come off the board                      (only leftovers can remain)
// Stop at any point and nothing is lost: at worst there are hidden duplicates.
// Images stay under the owner's own user doc for now (same as boards), so a picture
// in a shared tab shows for me only until images move into spaces.

import { getDoc, getDocs, query, where, writeBatch, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import {
  spaceDoc, modDoc, modulesCol, membersCol, mountDoc, spaceEntriesCol, inviteDoc, deleteSpace, commitInChunks,
} from "./data";
import { blankBoard } from "./migrate";
import { modulesIn, withContents } from "../components/board/spaces";
import { uid as newId } from "../utils/uid";

// Same tab, same space id: re-running after an interruption lands on the same docs
export const tabSid = (boardId, tabId) => `${boardId}_${tabId}`;

// Changes one tab of a board (parent null) or of a folder; fn gets the tab, returns its replacement
function mapTab(b, parent, tabId, fn) {
  const swap = (tabs) => tabs.map((t) => (t.id === tabId ? fn(t) : t));
  return parent
    ? { ...b, modules: b.modules.map((m) => (m.id === parent ? { ...m, state: { ...m.state, tabs: swap(m.state.tabs) } } : m)) }
    : { ...b, tabs: swap(b.tabs ?? []) };
}

// Same as mapTab, but adds a tab (and opens it)
function addTab(b, parent, tab) {
  if (parent) {
    return {
      ...b,
      modules: b.modules.map((m) => (m.id === parent ? { ...m, state: { ...m.state, tabs: [...m.state.tabs, tab], active: tab.id } } : m)),
    };
  }
  // A board with no tabs yet gets a first one for what's already on it
  const tabs = b.tabs?.length ? b.tabs : b.modules.length ? [{ id: newId(), name: "Main" }] : [];
  return { ...b, tabs: [...tabs, tab], tab: tab.id };
}

// Entries (diary pages, photos, logs) of some modules, in a space; Firestore's "in" takes 10 at a time
async function entriesOf(sid, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 10) {
    const snap = await getDocs(query(spaceEntriesCol(sid), where("moduleId", "in", ids.slice(i, i + 10))));
    snap.forEach((d) => out.push(d));
  }
  return out;
}

const strip = ({ updatedAt, updatedBy, ...m }) => m;

// Turns tab into its own space and mounts it. Resolves with the new space's id and a
// board-shaped stub of it (enough for the share sheet to open straight away).
export async function shareTab({ uid, who = {}, board, parent = null, tab, updateBoard }) {
  const sid = tabSid(board.id, tab.id);
  const top = modulesIn(board, { parent, tab: tab.id });
  const topIds = new Set(top.map((m) => m.id));
  const ids = withContents(board.modules, [...topIds]);
  const moving = board.modules.filter((m) => ids.includes(m.id));
  const now = Date.now();

  // On the new surface the tab's own things sit at the top level (no folder, no tab)
  const lifted = moving.map((m) => (topIds.has(m.id) ? { ...m, parent: null, tab: null } : m));
  const { modules: _m, order: _o, ...fields } = blankBoard({
    title: tab.name,
    color: board.color,
    stampId: board.stampId ?? null,
    iconData: board.iconData ?? "",
    layout: board.layout ?? "bleed",
    iconOffsetX: board.iconOffsetX ?? 0,
    iconScale: board.iconScale ?? 1,
    snap: !!board.snap,
    mobileOrder: board.mobileOrder ? board.mobileOrder.filter((id) => topIds.has(id)) : null,
  });

  // 1. the space, its owner row and my mount, together (the rules check the owner row against the space)
  const first = writeBatch(db);
  first.set(spaceDoc(sid), { ...fields, owner: uid, kind: "tab", from: board.id });
  first.set(doc(membersCol(sid), uid), { uid, role: "owner", name: who.name ?? "", photo: who.photo ?? "", via: null, joinedAt: now });
  first.set(mountDoc(uid, sid), { where: { board: board.id, parent: parent ?? null, tab: tab.id }, order: 0, addedAt: now });
  await first.commit();

  // 2. what's on it. Awaited, so the originals only go once the copies are really there.
  await commitInChunks(lifted.map((m) => (b) => b.set(modDoc(sid, m.id), { ...m, updatedAt: now, updatedBy: uid })));
  const old = await entriesOf(board.id, ids);
  await commitInChunks(old.map((d) => (b) => b.set(doc(spaceEntriesCol(sid), d.id), { ...d.data(), boardId: sid })));

  // 3. the tab becomes a mount
  updateBoard(board.id, (b) => mapTab(b, parent, tab.id, (t) => ({ id: t.id, name: t.name, ...(t.color != null ? { color: t.color } : {}), mount: sid })));

  // 4. the originals go (modules in one write, their entries in batches)
  updateBoard(board.id, (b) => ({
    ...b,
    modules: b.modules.filter((m) => !ids.includes(m.id)),
    mobileOrder: b.mobileOrder ? b.mobileOrder.filter((id) => !ids.includes(id)) : b.mobileOrder,
  }));
  await commitInChunks(old.map((d) => (b) => b.delete(d.ref)));

  return { sid, stub: { id: sid, kind: "tab", ...fields, owner: uid, role: "owner", modules: lifted } };
}

// The owner takes a shared tab back: its things come home to the board as a plain tab,
// the invites are revoked and the space is deleted. Other people's mounts then point at
// nothing, and their tab says so.
export async function stopSharingTab({ uid, board, parent = null, tab, updateBoard }) {
  const sid = tab.mount;
  const [mods, ents, mine] = await Promise.all([getDocs(modulesCol(sid)), getDocs(spaceEntriesCol(sid)), getDoc(mountDoc(uid, sid))]);
  const all = mods.docs.map((d) => ({ id: d.id, ...d.data() }));
  const top = new Set(modulesIn({ tabs: [], modules: all }, { parent: null, tab: null }).map((m) => m.id));
  const now = Date.now();

  // Copy home first: the board's own module docs and entries, written and confirmed
  const home = all.map((m) => (top.has(m.id) ? { ...strip(m), parent, tab: tab.id } : strip(m)));
  await commitInChunks(home.map((m) => (b) => b.set(modDoc(board.id, m.id), { ...m, updatedAt: now, updatedBy: uid })));
  await commitInChunks(ents.docs.map((d) => (b) => b.set(doc(spaceEntriesCol(board.id), d.id), { ...d.data(), boardId: board.id })));

  // The tab is plain again (the module docs above show up on their own)
  updateBoard(board.id, (b) => mapTab(b, parent, tab.id, (t) => ({ id: t.id, name: t.name, ...(t.color != null ? { color: t.color } : {}) })));

  // Then the space goes. Keys first, so nobody can join a space that's on its way out.
  const keys = Object.values(mine.data()?.invites ?? {}).filter(Boolean);
  if (keys.length) {
    const b = writeBatch(db);
    keys.forEach((t) => b.update(inviteDoc(t), { revoked: true }));
    await b.commit();
  }
  await commitInChunks(ents.docs.map((d) => (b) => b.delete(d.ref)));
  await deleteSpace(uid, sid);
}

// "Tuck into a board…": a shared board or tab on my shelf also becomes a tab of one
// of my boards (parent = a folder in it, or null). The tab goes in first and the
// mount moves off the shelf second, so an interruption leaves it in both places.
export async function tuck({ uid, shared, target, parent = null, updateBoard }) {
  const tab = { id: newId(), name: shared.title || "Shared", mount: shared.id };
  updateBoard(target.id, (b) => addTab(b, parent, tab));
  await updateDoc(mountDoc(uid, shared.id), { where: { board: target.id, parent: parent ?? null, tab: tab.id } });
  return tab;
}

// A mounted tab comes off its board: the space goes back to my shelf (still the same live thing)
export const untuck = (uid, sid) => updateDoc(mountDoc(uid, sid), { where: "home" }).catch(() => {});
