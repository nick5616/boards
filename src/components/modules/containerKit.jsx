import { useState } from "react";
import { uid } from "../../utils/uid";
import { MODULES } from "../../constants/modules";
import { useBoardContext } from "../board/BoardContext";
import { modulesIn, pickTab } from "../board/spaces";
import Space from "../board/Space";
import { tabColor } from "../board/TabStrip";
import ContextMenu from "../ContextMenu";
import { useTabShare } from "../share/useTabShare";

// What every container body (drawers, deck, routine, clock, capsule, split) shares with
// File folders: the tabs in the module's state, "+ add" into the open surface, and a
// right-click / ⋯ menu per tab (rename, share, copy, move along, remove) so each body
// only has to draw itself. shown = a tab id to treat as the open one (the clock decides
// that from the time of day).
export function useContainer(mod, setState, { shown } = {}) {
  const { board, openTray, removeTab, duplicateTab, reorderTabs, copyLink } = useBoardContext();
  const share = useTabShare(board, mod.id);
  const [menu, setMenu] = useState(null); // { tab, x, y }
  const tabs = mod.state.tabs;
  const active = pickTab(tabs, shown ?? mod.state.active);
  const i = Math.max(0, tabs.findIndex((t) => t.id === active));
  const fixed = !!MODULES[mod.type].fixedTabs;

  const patchTab = (id, patch) => setState((s) => ({ ...s, tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const rename = (t) => {
    const name = prompt("Name this one", t.name);
    if (name?.trim()) patchTab(t.id, { name: name.trim() });
  };
  const select = (id) => setState((s) => ({ ...s, active: id }));
  const add = (def = `Tab ${tabs.length + 1}`, extra = {}) => {
    const name = prompt("Name the new one", def);
    if (!name?.trim()) return null;
    const id = uid();
    setState((s) => ({ ...s, tabs: [...s.tabs, { id, name: name.trim(), ...extra }], active: id }));
    return id;
  };
  // Slides a tab one place along (the tabs' order is the drawer / card / step order)
  const nudge = (t, d) => {
    const at = tabs.findIndex((x) => x.id === t.id);
    const to = at + d;
    if (to < 0 || to >= tabs.length) return;
    const next = tabs.map((x, k) => ({ ...x, color: x.color ?? k }));
    next.splice(to, 0, next.splice(at, 1)[0]);
    reorderTabs(mod.id, next);
  };

  const items = (t) => {
    const at = tabs.findIndex((x) => x.id === t.id);
    return [
      { label: "✏️ Rename", run: () => rename(t) },
      ...(fixed ? [] : share.items(t)),
      ...(!fixed && at > 0 ? [{ label: "↑ Move earlier", run: () => nudge(t, -1) }] : []),
      ...(!fixed && at < tabs.length - 1 ? [{ label: "↓ Move later", run: () => nudge(t, 1) }] : []),
      ...(!fixed && !t.mount
        ? [
            { label: "⧉ Duplicate with contents", run: () => duplicateTab(mod.id, t, true) },
            { label: "⬚ Duplicate empty (same layout)", run: () => duplicateTab(mod.id, t, false) },
          ]
        : []),
      ...(copyLink && !t.mount ? [{ label: "🔗 Send a copy (won't sync)", run: () => copyLink(t.id, mod.id) }] : []),
      ...(!fixed && tabs.length > 1 ? [{ label: "🗑 Remove", run: () => removeTab(mod.id, t), danger: true }] : []),
    ];
  };

  return {
    board, tabs, active, i, tab: tabs[i], fixed, share, select, add, rename, patchTab, nudge,
    color: (t) => tabColor(t, Math.max(0, tabs.findIndex((x) => x.id === t.id))),
    // how many things sit on a tab (null: it's a shared tab, whose things live elsewhere)
    count: (t) => (t.mount ? null : modulesIn(board, { parent: mod.id, tab: t.id }).length),
    addHere: (id = active) => openTray({ parent: mod.id, tab: id }),
    // open a tab's menu at a click, or just under the element if there was no pointer
    openMenu: (t, e) => {
      e.preventDefault?.();
      const r = e.currentTarget?.getBoundingClientRect?.();
      const click = e.clientX || e.clientY;
      setMenu({ tab: t, x: click ? e.clientX : r?.left ?? 0, y: click ? e.clientY : (r?.bottom ?? 0) + 4 });
    },
    menuNode: (
      <>
        {menu && <ContextMenu at={menu} items={items(menu.tab)} onClose={() => setMenu(null)} />}
        {share.sheet}
      </>
    ),
  };
}

// The surface of one tab: a free canvas (or a phone's widget grid), or a shared tab
export function Page({ mod, tab, className = "" }) {
  return (
    <div className={`cx-page ${className}`}>
      <Space parent={mod.id} tab={tab} />
    </div>
  );
}

// "3 inside" / "empty" / "shared"
export const countLabel = (n) => (n === null ? "shared" : n === 0 ? "empty" : `${n} inside`);
