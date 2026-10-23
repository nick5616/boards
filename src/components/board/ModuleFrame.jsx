import { useState, useRef, useEffect } from "react";
import { MODULE_COMPONENTS } from "../modules";

// The physical object for one module: a tape strip to grab it by, a ⋯ menu,
// and the module's own contents. Positioning is the caller's job.
export default function ModuleFrame({
  board, mod, entries, setState, onPatch, onRemove, openBig,
  style, className = "", handleProps, resizeProps, children,
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const Body = MODULE_COMPONENTS[mod.type];

  useEffect(() => {
    if (!menu) return;
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  const act = (fn) => () => { setMenu(false); fn(); };

  return (
    <div className={`mod mod-${mod.type} ${className}`} style={style} data-mid={mod.id}>
      <div className="mod-bar" {...handleProps}>
        <span className="mod-title">{mod.title}</span>
        <div ref={menuRef} className="mod-menu-wrap">
          <button className="mod-dots" onClick={() => setMenu((v) => !v)} aria-label="Module options" aria-expanded={menu}>
            ···
          </button>
          {menu && (
            <div className="card-menu mod-menu" role="menu">
              <button role="menuitem" onClick={act(openBig)}>⤢ Open big</button>
              <button
                role="menuitem"
                onClick={act(() => {
                  const t = prompt("Name this", mod.title);
                  if (t?.trim()) onPatch({ title: t.trim() });
                })}
              >
                ✏️ Rename
              </button>
              <button
                role="menuitem"
                onClick={act(() => onPatch({ rot: mod.rot ? 0 : Math.round((Math.random() * 4 - 2) * 10) / 10 || 1.2 }))}
              >
                {mod.rot ? "📐 Straighten" : "🙃 Tilt"}
              </button>
              <button role="menuitem" className="danger" onClick={act(onRemove)}>🗑 Remove</button>
            </div>
          )}
        </div>
      </div>
      <div className="mod-body">
        <Body board={board} mod={mod} entries={entries} setState={setState} openBig={openBig} expanded={false} />
      </div>
      {resizeProps && <div className="mod-resize" {...resizeProps} aria-hidden="true" />}
      {children}
    </div>
  );
}
