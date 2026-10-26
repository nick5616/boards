import { useState, useRef, useEffect } from "react";
import { MODULE_COMPONENTS } from "../modules";
import { useData } from "../../contexts/DataContext";
import { backlinks } from "../../lib/mentions";
import { useFocuser } from "../live/TogetherContext";

// The physical object for one module: a tape strip to grab it by, a ⋯ menu,
// and the module's own contents. Positioning is the caller's job.
export default function ModuleFrame({
  board, mod, entries, setState, onPatch, onRemove, openBig, moveTargets, onMove,
  style, className = "", handleProps, resizeProps, children,
}) {
  const [menu, setMenu] = useState(false);
  const [targets, setTargets] = useState(null); // "Move to…" list, once asked for
  const [naming, setNaming] = useState(false);
  const [showLinks, setShowLinks] = useState(false); // "Mentioned in…" list, once asked for
  const { boards, goTo } = useData();
  const menuRef = useRef(null);
  const Body = MODULE_COMPONENTS[mod.type];
  const withYou = useFocuser(mod.id); // someone else is typing in here: outline it in their color

  useEffect(() => {
    if (!menu) {
      setTargets(null);
      setShowLinks(false);
      return;
    }
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  const act = (fn) => () => { setMenu(false); fn(); };
  const links = menu ? backlinks(boards, { boardId: board.id, modId: mod.id }) : [];

  return (
    <div
      className={`mod mod-${mod.type} ${className}${withYou ? " with-someone" : ""}`}
      style={withYou ? { ...style, "--with": withYou.color } : style}
      data-mid={mod.id}
    >
      {withYou && <span className="tg-with-tag">{withYou.name?.trim().split(/\s+/)[0] || "someone"} is in here</span>}
      <div
        className="mod-bar"
        {...handleProps}
        // On the bar, not the title: the canvas captures the pointer here for dragging
        onDoubleClick={(e) => !e.target.closest("button, input, .mod-menu") && setNaming(true)}
      >
        {naming ? (
          <input
            className="mod-title mod-title-input"
            autoFocus
            defaultValue={mod.title}
            aria-label="Name"
            onFocus={(e) => e.target.select()}
            onBlur={(e) => {
              // named: a name picked by hand, which nothing automatic will change
              if (e.target.value.trim()) onPatch({ title: e.target.value.trim(), named: true });
              setNaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
              if (e.key === "Escape") setNaming(false);
            }}
          />
        ) : (
          <span className="mod-title" title="Double-click to rename">
            {mod.title}
          </span>
        )}
        <div ref={menuRef} className="mod-menu-wrap">
          <button className="mod-dots" onClick={() => setMenu((v) => !v)} aria-label="Module options" aria-expanded={menu}>
            ···
          </button>
          {menu && (
            <div className="card-menu mod-menu" role="menu">
              <button role="menuitem" onClick={act(openBig)}>⤢ Open big</button>
              <button
                role="menuitem"
                onClick={act(() => setNaming(true))}
              >
                ✏️ Rename
              </button>
              <button
                role="menuitem"
                onClick={act(() => onPatch({ rot: mod.rot ? 0 : Math.round((Math.random() * 4 - 2) * 10) / 10 || 1.2 }))}
              >
                {mod.rot ? "📐 Straighten" : "🙃 Tilt"}
              </button>
              {targets ? (
                targets.map((t) => (
                  <button key={`${t.parent}-${t.tab}`} role="menuitem" className="mod-menu-sub" onClick={act(() => onMove(t))}>
                    → {t.label}
                  </button>
                ))
              ) : (
                <button role="menuitem" onClick={() => setTargets(moveTargets())}>📁 Move to…</button>
              )}
              {targets?.length === 0 && <div className="mod-menu-note">nowhere else yet — add a tab or a folder</div>}
              {links.length > 0 &&
                (showLinks ? (
                  links.map((l) => (
                    <button key={`${l.boardId}/${l.modId}`} role="menuitem" className="mod-menu-sub" onClick={act(() => goTo(l.boardId, l.modId))}>
                      ↩ {l.title} · {l.where}
                    </button>
                  ))
                ) : (
                  <button role="menuitem" onClick={() => setShowLinks(true)}>↩ Mentioned in… ({links.length})</button>
                ))}
              <button role="menuitem" className="danger" onClick={act(onRemove)}>🗑 Remove</button>
            </div>
          )}
        </div>
      </div>
      <div className="mod-body">
        <Body board={board} mod={mod} entries={entries} setState={setState} onPatch={onPatch} openBig={openBig} expanded={false} />
      </div>
      {resizeProps && <div className="mod-resize" {...resizeProps} aria-hidden="true" />}
      {children}
    </div>
  );
}
