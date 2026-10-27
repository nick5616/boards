import { MODULES } from "../../constants/modules";

// A "space" is one blank surface modules sit on: { parent, tab }.
//   parent: null for the board itself, or the id of a File folders module
//   tab:    which of that parent's tabs (board.tabs, or the folder's state.tabs),
//           null when the board has no tabs
// Modules store parent and tab directly. A tab id that no longer matches falls
// back to the first tab, so modules from before tabs existed land on tab one.

export const isControl = (mod) => MODULES[mod.type].kind === "control";

// A container is a control whose state is { tabs: [{ id, name, … }], active }: each tab is a
// surface of its own. File folders were the first; drawers, decks, routines and the rest
// are the same idea in a different body. Containers never go inside containers.
export const isContainer = (mod) => !!mod && MODULES[mod.type]?.container === true;

// Shut = its insides are out of sight and out of reach (a sealed time capsule).
// That's a promise to yourself, not encryption: the data is still in the board.
export const isShut = (mod) => !!mod && !!MODULES[mod.type]?.shut?.(mod.state);

export const tabsOf = (board, folder) => (folder ? folder.state.tabs : board.tabs) ?? [];

export const pickTab = (tabs, id) => (tabs.some((t) => t.id === id) ? id : tabs[0]?.id ?? null);

export function locator(board) {
  const byId = new Map(board.modules.map((m) => [m.id, m]));
  return (mod) => {
    const p = byId.get(mod.parent);
    const folder = isContainer(p) ? p : null;
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

// Every other place this module could go. Containers don't go in containers, and a sealed one takes nothing.
// A mounted (shared) tab isn't one: its things live in another space, so moving in or
// out of it would mean copying between spaces. Use cut and paste, or share the tab as it is.
export function destinations(board, mod) {
  const here = locator(board)(mod);
  const out = board.tabs?.length
    ? board.tabs.filter((t) => !t.mount).map((t) => ({ parent: null, tab: t.id, label: t.name }))
    : [{ parent: null, tab: null, label: "The board" }];
  if (!isControl(mod)) {
    for (const f of board.modules) {
      if (!isContainer(f) || isShut(f)) continue;
      f.state.tabs.filter((t) => !t.mount).forEach((t) => out.push({ parent: f.id, tab: t.id, label: `${f.title} › ${t.name}` }));
    }
  }
  return out.filter((d) => !sameSpace(d, here));
}

// How wide new things can spread before wrapping to the next row
export function spaceWidth(board, space) {
  const folder = space.parent && board.modules.find((m) => m.id === space.parent);
  // a split holds its surfaces side by side, so each only gets a share of the width
  const share = folder ? MODULES[folder.type].panels ?? 1 : 1;
  return folder ? Math.max(260, Math.round((folder.w - 60) / share)) : Math.max(960, window.innerWidth - 80);
}
