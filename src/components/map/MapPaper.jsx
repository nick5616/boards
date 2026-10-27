import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { project, unproject, boundsOf } from "../../lib/geo";

// A folded paper map. Real OpenStreetMap tiles, drawn sepia, with creases across
// them and a red-pencil route on top. Hand-rolled (no map library): it asks for
// just the tiles on screen, the browser caches them, and nothing is prefetched,
// which is what OSM's tile policy wants (https://operations.osmfoundation.org/policies/tiles/).
//
//   tracks   [{ pts: [[lat, lon]…], color?, dashed?, width? }]
//   pins     [{ pt, kind?: "start" | "end" | "me", label? }]
//   center / zoom   where it opens; fit = points to frame, re-framed whenever fitKey changes
//   onPick(pt)      a click (not a drag) on the paper; handy for drawing routes
//   onView({ center, zoom })   after the user pans or zooms
const MIN_Z = 3;
const MAX_Z = 18;
const clampZ = (z) => Math.max(MIN_Z, Math.min(MAX_Z, z));

export default function MapPaper({ center = [40.7829, -73.9654], zoom = 14, fit, fitKey, tracks = [], pins = [], onPick, onView, className = "", label = "map" }) {
  const box = useRef(null);
  const [size, setSize] = useState({ w: 320, h: 220 });
  const [view, setView] = useState({ c: center, z: zoom });
  const drag = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  // Measure the paper so we know how many tiles to lay
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth || 320, h: el.clientHeight || 220 });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Frame the given points: the biggest zoom where they all fit with a margin
  useEffect(() => {
    const b = fit?.length ? boundsOf(fit) : null;
    if (!b) return;
    const [[s, w], [n, e]] = b;
    let z = MAX_Z - 2;
    for (; z > MIN_Z; z--) {
      const [x0, y0] = project([n, w], z);
      const [x1, y1] = project([s, e], z);
      if (Math.abs(x1 - x0) < size.w * 0.78 && Math.abs(y1 - y0) < size.h * 0.74) break;
    }
    setView({ c: [(s + n) / 2, (w + e) / 2], z });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, size.w > 0]);

  // A new centre from outside (e.g. "find me") moves the paper
  const cKey = center.join(",");
  useEffect(() => {
    if (!fit?.length) setView((v) => ({ ...v, c: center }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cKey]);

  const zoomBy = (d) => {
    const v = viewRef.current;
    const z = clampZ(v.z + d);
    setView({ c: v.c, z });
    onView?.({ center: v.c, zoom: z });
  };

  // Scroll wheel zooms (needs a non-passive listener to keep the page from scrolling)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let last = 0;
    const wheel = (e) => {
      e.preventDefault();
      const t = Date.now();
      if (t - last < 140) return;
      last = t;
      zoomBy(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const z = Math.round(view.z);
  const [cx, cy] = project(view.c, z);
  const left = cx - size.w / 2; // world pixel at the paper's left edge
  const top = cy - size.h / 2;
  const at = (pt) => {
    const [x, y] = project(pt, z);
    return [x - left, y - top];
  };

  // Tiles covering the paper (x wraps around the world; y just stops)
  const n = 2 ** z;
  const tiles = [];
  for (let ty = Math.floor(top / 256); ty <= Math.floor((top + size.h) / 256); ty++) {
    for (let tx = Math.floor(left / 256); tx <= Math.floor((left + size.w) / 256); tx++) {
      if (ty < 0 || ty >= n) continue;
      tiles.push({ key: `${z}/${tx}/${ty}`, src: `https://tile.openstreetmap.org/${z}/${((tx % n) + n) % n}/${ty}.png`, x: tx * 256 - left, y: ty * 256 - top });
    }
  }

  const down = (e) => {
    if (e.target.closest(".mp-zoom")) return;
    box.current.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, c: viewRef.current.c, moved: false };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    const [px, py] = project(d.c, z);
    setView({ c: unproject([px - dx, py - dy], z), z: viewRef.current.z });
  };
  const up = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) return onView?.({ center: viewRef.current.c, zoom: z });
    if (onPick && !e.target.closest(".mp-zoom")) {
      const r = box.current.getBoundingClientRect();
      onPick(unproject([left + (e.clientX - r.left), top + (e.clientY - r.top)], z).map((v) => Math.round(v * 1e6) / 1e6));
    }
  };

  return (
    <div
      ref={box}
      className={`mp${onPick ? " pick" : ""} ${className}`}
      role="img"
      aria-label={label}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => (drag.current = null)}
    >
      <div className="mp-tiles">
        {tiles.map((t) => (
          <img key={t.key} src={t.src} alt="" width="256" height="256" draggable="false" loading="lazy" style={{ left: t.x, top: t.y }} />
        ))}
      </div>
      <svg className="mp-ink" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
        {tracks.map((t, i) =>
          t.pts?.length > 1 ? (
            <g key={i}>
              <polyline className="mp-halo" points={t.pts.map((p) => at(p).join(",")).join(" ")} />
              <polyline className={`mp-line${t.dashed ? " dashed" : ""}`} style={t.color ? { stroke: t.color } : undefined} points={t.pts.map((p) => at(p).join(",")).join(" ")} />
            </g>
          ) : null
        )}
        {pins.map((p, i) => {
          const [x, y] = at(p.pt);
          return (
            <g key={i} className={`mp-pin ${p.kind ?? "end"}`} transform={`translate(${x} ${y})`}>
              {p.kind === "me" ? (
                <>
                  <circle className="pulse" r="12" />
                  <circle r="6" />
                </>
              ) : p.kind === "dot" ? (
                <circle r="4" />
              ) : (
                <>
                  <path d="M0 0 C-9 -12 -8 -24 0 -24 C8 -24 9 -12 0 0Z" />
                  <circle cy="-16" r="3" />
                </>
              )}
              {p.label && <text y="-30" textAnchor="middle">{p.label}</text>}
            </g>
          );
        })}
      </svg>
      <div className="mp-folds" aria-hidden="true" />
      <div className="mp-zoom">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out">−</button>
      </div>
      <a className="mp-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    </div>
  );
}
