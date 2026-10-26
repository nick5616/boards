import { MODULES } from "../../constants/modules";

// A "space" is one blank surface modules sit on: { parent, tab }.
//   parent: null for the board itself, or the id of a File folders module
//   tab:    which of that parent's tabs (board.tabs, or the folder's state.tabs),
//           null when the board has no tabs
// Modules store parent and tab directly. A tab id that no longer matches falls
// back to the first tab, so modules from before tabs existed land on tab one.

export const isControl = (mod) => MODULES[mod.type].kind === "control";

export const tabsOf = (board, folder) => (folder ? folder.state.tabs : board.tabs) ?? [];

export const pickTab = (tabs, id) => (tabs.some((t) => t.id === id) ? id : tabs[0]?.id ?? null);

export function locator(board) {
  const byId = new Map(board.modules.map((m) => [m.id, m]));
  return (mod) => {
    const p = byId.get(mod.parent);
    const folder = p?.type === "folder" ? p : null;
    return { parent: folder?.id ?? null, tab: pickTab(tabsOf(board, folder), mod.tab) };
  };
}

export const sameSpace = (a, b) => a.parent === b.parent && a.tab === b.tab;

export function modulesIn(board, space) {
  const where = locator(board);
  return board.modules.filter((m) => sameSpace(where(m), space));
}

// The ids given plus everything inside them
export function withContents(modules, ids) {
  const out = new Set(ids);
  for (let grew = true; grew; ) {
    grew = false;
    for (const m of modules) {
      if (m.parent && out.has(m.parent) && !out.has(m.id)) {
        out.add(m.id);
        grew = true;
      }
    }
  }
  return [...out];
}

// Every other place this module could go. Folders don't go in folders.
// A mounted (shared) tab isn't one: its things live in another space, so moving in or
// out of it would mean copying between spaces. Use cut and paste, or share the tab as it is.
export function destinations(board, mod) {
  const here = locator(board)(mod);
  const out = board.tabs?.length
    ? board.tabs.filter((t) => !t.mount).map((t) => ({ parent: null, tab: t.id, label: t.name }))
    : [{ parent: null, tab: null, label: "The board" }];
  if (!isControl(mod)) {
    for (const f of board.modules) {
      if (f.type !== "folder") continue;
      f.state.tabs.filter((t) => !t.mount).forEach((t) => out.push({ parent: f.id, tab: t.id, label: `${f.title} › ${t.name}` }));
    }
  }
  return out.filter((d) => !sameSpace(d, here));
}

// How wide new things can spread before wrapping to the next row
export function spaceWidth(board, space) {
  const folder = space.parent && board.modules.find((m) => m.id === space.parent);
  return folder ? Math.max(360, folder.w - 60) : Math.max(960, window.innerWidth - 80);
}
