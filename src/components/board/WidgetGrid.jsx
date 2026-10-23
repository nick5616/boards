import { useState, useRef } from "react";
import { MODULES, ROW_H } from "../../constants/modules";
import ModuleFrame from "./ModuleFrame";

const GRID_GAP = 12;

// Phone order: whatever was arranged on the phone, otherwise desktop reading order
export function mobileOrder(board) {
  const byDesk = [...board.modules].sort((a, b) => a.y - b.y || a.x - b.x).map((m) => m.id);
  const known = (board.mobileOrder ?? []).filter((id) => byDesk.includes(id));
  return [...known, ...byDesk.filter((id) => !known.includes(id))];
}

const size = (m) => ({ w: m.mw ?? MODULES[m.type].mobile.w, h: m.mh ?? MODULES[m.type].mobile.h });

// Phone: a two-column widget grid. In arrange mode each widget gets a grip
// (drag to reorder) and a corner (drag to resize in whole cells).
export default function WidgetGrid({ board, arranging, frameProps, onArrange }) {
  const gridRef = useRef(null);
  const [drag, setDrag] = useState(null); // { id, kind, sx, sy, dx, dy, target, w0, h0 }
  const order = mobileOrder(board);
  const byId = Object.fromEntries(board.modules.map((m) => [m.id, m]));

  const cell = () => {
    const w = gridRef.current?.clientWidth ?? 360;
    return { cw: (w - GRID_GAP) / 2 + GRID_GAP, ch: ROW_H + GRID_GAP };
  };

  const liveSize = (m) => {
    const s = size(m);
    if (drag?.id !== m.id || drag.kind !== "size") return s;
    const { cw, ch } = cell();
    return {
      w: Math.min(2, Math.max(1, Math.round(s.w + drag.dx / cw))),
      h: Math.min(12, Math.max(2, Math.round(s.h + drag.dy / ch))),
    };
  };

  const pointer = (m, kind) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ id: m.id, kind, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, target: null });
    },
    onPointerMove: (e) => {
      if (drag?.id !== m.id) return;
      let target = drag.target;
      if (kind === "move") {
        const over = document
          .elementsFromPoint(e.clientX, e.clientY)
          .map((el) => el.closest?.("[data-mid]"))
          .find((el) => el && el.dataset.mid !== m.id);
        target = over?.dataset.mid ?? null;
      }
      setDrag({ ...drag, dx: e.clientX - drag.sx, dy: e.clientY - drag.sy, target });
    },
    onPointerUp: () => {
      if (drag?.id !== m.id) return;
      if (kind === "move" && drag.target) {
        const ids = order.filter((id) => id !== m.id);
        const ti = ids.indexOf(drag.target);
        const after = order.indexOf(drag.target) > order.indexOf(m.id);
        ids.splice(after ? ti + 1 : ti, 0, m.id);
        onArrange({ mobileOrder: ids });
      }
      if (kind === "size") {
        const s = liveSize(m);
        onArrange({ mobileOrder: order, sizes: { [m.id]: s } });
      }
      setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
  });

  return (
    <div ref={gridRef} className={`wgrid${arranging ? " arranging" : ""}`} style={{ gridAutoRows: ROW_H, gap: GRID_GAP }}>
      {order.map((id) => {
        const m = byId[id];
        const s = liveSize(m);
        const moving = drag?.id === id && drag.kind === "move";
        return (
          <ModuleFrame
            key={id}
            {...frameProps(m)}
            className={`${moving ? "dragging" : ""}${drag?.target === id ? " drop-target" : ""}`}
            style={{
              gridColumn: `span ${s.w}`,
              gridRow: `span ${s.h}`,
              transform: moving
                ? `translate(${drag.dx}px, ${drag.dy}px) scale(1.03)`
                : `rotate(${(m.rot ?? 0) / 2}deg)`,
              zIndex: moving ? 50 : undefined,
            }}
            resizeProps={arranging ? pointer(m, "size") : undefined}
          >
            {arranging && (
              <button className="wgrid-grip" {...pointer(m, "move")} aria-label={`Move ${m.title}`}>
                ✥
              </button>
            )}
          </ModuleFrame>
        );
      })}
    </div>
  );
}
