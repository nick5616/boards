import { useState } from "react";
import { SNAP } from "../../constants/modules";
import ModuleFrame from "./ModuleFrame";
import { useBoardContext } from "./BoardContext";

const MIN_W = 160;
const MIN_H = 120;

// Desktop: a free canvas. Drag by the tape strip, resize from the corner.
// With snap on, everything lands on a 20px grid. modules = the ones on this
// surface (the board, a board tab, or a folder tab).
export default function Canvas({ board, modules, frameProps, onModules }) {
  const [drag, setDrag] = useState(null);
  const { readOnly } = useBoardContext() ?? {}; // a viewer can't pick things up

  const geom = (m) => {
    if (drag?.id !== m.id) return m;
    const s = (v) => (board.snap ? Math.round(v / SNAP) * SNAP : Math.round(v));
    if (drag.kind === "move") {
      return { ...m, x: Math.max(0, s(m.x + drag.dx)), y: Math.max(0, s(m.y + drag.dy)) };
    }
    return { ...m, w: Math.max(MIN_W, s(m.w + drag.dx)), h: Math.max(MIN_H, s(m.h + drag.dy)) };
  };

  const grab = (m, kind) => ({
    onPointerDown: (e) => {
      if (readOnly || e.button !== 0 || e.target.closest("button, input, textarea, .mod-menu")) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ id: m.id, kind, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 });
    },
    onPointerMove: (e) => {
      if (drag?.id !== m.id) return;
      setDrag({ ...drag, dx: e.clientX - drag.sx, dy: e.clientY - drag.sy });
    },
    onPointerUp: () => {
      if (drag?.id !== m.id) return;
      const g = geom(m);
      const top = Math.max(0, ...modules.map((x) => x.z ?? 1)) + 1;
      setDrag(null);
      if (drag.dx || drag.dy) {
        onModules((ms) => ms.map((x) => (x.id === m.id ? { ...x, x: g.x, y: g.y, w: g.w, h: g.h, z: top } : x)));
      }
    },
    onPointerCancel: () => setDrag(null),
  });

  const placed = modules.map(geom);
  const width = Math.max(...placed.map((m) => m.x + m.w), 0) + 80;
  const height = Math.max(...placed.map((m) => m.y + m.h), 0) + 240;

  return (
    <div className="canvas-scroll">
      <div className={`canvas${board.snap ? " snap" : ""}`} style={{ minWidth: width, height }}>
        {modules.map((orig, i) => {
          // orig = stored position (drag math starts here); m = where it's drawn mid-drag
          const m = placed[i];
          const dragging = drag?.id === m.id;
          return (
            <ModuleFrame
              key={m.id}
              {...frameProps(orig)}
              className={dragging ? "dragging" : ""}
              style={{
                left: m.x,
                top: m.y,
                width: m.w,
                height: m.h,
                zIndex: dragging ? 999 : m.z ?? 1,
                transform: `rotate(${dragging ? 0 : m.rot ?? 0}deg)`,
              }}
              handleProps={grab(orig, "move")}
              resizeProps={grab(orig, "size")}
            />
          );
        })}
      </div>
    </div>
  );
}
