import { useState } from "react";
import ContextMenu from "../ContextMenu";

// Manila tabs across the top of a surface. Tap a tab to open it; right-click
// any tab, or tap the open one, for its menu. Drag one to move it along. + for a new one.
export const TAB_COLORS = ["#f6e3b4", "#fbd3c4", "#cfe6cf", "#cddff3", "#e6d6f2", "#f9edab"];

// A tab keeps its color once it's been moved; until then it goes by position
export const tabColor = (t, i) => TAB_COLORS[(t.color ?? i) % TAB_COLORS.length];

export default function TabStrip({
  tabs, active, onSelect, onAdd, onRename, onDuplicate, onRemove, onReorder, removeLabel, className = "", style,
}) {
  const [menu, setMenu] = useState(null); // { tab, x, y }
  const [drag, setDrag] = useState(null); // { id, over, after }

  const rename = (t) => {
    const name = prompt("Name this tab", t.name);
    if (name?.trim()) onRename(t.id, name.trim());
  };
  const add = () => {
    const name = prompt("Name the new tab", `Tab ${tabs.length + 1}`);
    if (name?.trim()) onAdd(name.trim());
  };
  const openMenu = (t, x, y) => setMenu({ tab: t, x, y });
  const below = (t) => (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    openMenu(t, r.left, r.bottom + 4);
  };

  const drop = () => {
    if (!drag?.over || drag.over === drag.id) return;
    const pinned = tabs.map((t, i) => ({ ...t, color: t.color ?? i }));
    const moving = pinned.find((t) => t.id === drag.id);
    const rest = pinned.filter((t) => t.id !== drag.id);
    const at = rest.findIndex((t) => t.id === drag.over) + (drag.after ? 1 : 0);
    onReorder([...rest.slice(0, at), moving, ...rest.slice(at)]);
  };

  const items = (t) => [
    { label: "✏️ Rename", run: () => rename(t) },
    ...(onDuplicate
      ? [
          { label: "⧉ Duplicate with contents", run: () => onDuplicate(t, true) },
          { label: "⬚ Duplicate empty (same layout)", run: () => onDuplicate(t, false) },
        ]
      : []),
    ...(onRemove ? [{ label: `🗑 ${removeLabel ?? "Remove tab"}`, run: () => onRemove(t), danger: true }] : []),
  ];

  return (
    <div className={`tabs ${className}`} style={style} role="tablist">
      {tabs.map((t, i) => {
        const on = t.id === active;
        const target = drag?.over === t.id && drag.over !== drag.id;
        return (
          <div
            key={t.id}
            className={`tab${on ? " on" : ""}${drag?.id === t.id ? " dragging" : ""}${target ? (drag.after ? " drop-after" : " drop-before") : ""}`}
            style={{ "--tab": tabColor(t, i) }}
            draggable={!!onReorder}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", t.name);
              e.dataTransfer.effectAllowed = "move";
              setDrag({ id: t.id });
            }}
            onDragOver={(e) => {
              if (!drag) return; // only tabs from this strip
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              const after = e.clientX > r.left + r.width / 2;
              if (drag.over !== t.id || drag.after !== after) setDrag({ ...drag, over: t.id, after });
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop();
            }}
            onDragEnd={() => setDrag(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(t, e.clientX, e.clientY);
            }}
          >
            <button
              role="tab"
              aria-selected={on}
              aria-haspopup={on ? "menu" : undefined}
              className="tab-name"
              onClick={on ? below(t) : () => onSelect(t.id)}
              title={on ? "Tab options" : t.name}
            >
              {t.name}
              {on && <span className="tab-caret" aria-hidden="true">▾</span>}
            </button>
          </div>
        );
      })}
      <button className="tab-add" onClick={add} aria-label="New tab" title="New tab">+</button>
      {menu && <ContextMenu at={menu} items={items(menu.tab)} onClose={() => setMenu(null)} />}
    </div>
  );
}
