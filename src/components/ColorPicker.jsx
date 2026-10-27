import { useEffect, useRef } from "react";
import { hslStr, HUE_SWATCHES } from "../utils/color";

// The hue row scrolls sideways with no bar: a mouse wheel turns into sideways scroll,
// and it can be dragged like a phone list. A drag never counts as picking a swatch.
function useSideScroll() {
  const ref = useRef(null);
  const drag = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelector(".sel")?.scrollIntoView({ block: "nearest", inline: "center" });
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  return {
    ref,
    onPointerDown: (e) => {
      if (e.pointerType !== "mouse" || e.button) return;
      drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d) return;
      if (Math.abs(e.clientX - d.x) > 4) d.moved = true;
      if (d.moved) ref.current.scrollLeft = d.left - (e.clientX - d.x);
    },
    onPointerUp: () => {
      // Leave `moved` up until the click that follows has been swallowed
      setTimeout(() => (drag.current = null));
    },
    onClickCapture: (e) => {
      if (drag.current?.moved) e.stopPropagation();
    },
  };
}

export default function ColorPicker({ color, onChange }) {
  const { h, s, l } = color;
  const side = useSideScroll();
  const preview = hslStr(h, s, l);
  const sGrad = `linear-gradient(to right,hsl(${h},0%,${l}%),hsl(${h},100%,${l}%))`;
  const lGrad = `linear-gradient(to right,hsl(${h},${s}%,25%),hsl(${h},${s}%,${l}%),hsl(${h},${s}%,97%))`;

  return (
    <div>
      <div className="hue-scroll" {...side}>
        {HUE_SWATCHES.map((hv) => (
          <div
            key={hv}
            className={`hue-swatch${h === hv ? " sel" : ""}`}
            style={{ background: hslStr(hv, s, l) }}
            onClick={() => onChange({ ...color, h: hv })}
            role="button"
            aria-label={`Hue ${hv}`}
          />
        ))}
      </div>
      <div className="sl-group">
        {[
          { key: "s", label: "S", min: 0,  max: 100, val: s, grad: sGrad },
          { key: "l", label: "L", min: 28, max: 96,  val: l, grad: lGrad },
        ].map((row) => (
          <div className="sl-row" key={row.key}>
            <label htmlFor={`slider-${row.key}`}>{row.label}</label>
            <input
              id={`slider-${row.key}`}
              type="range"
              className="sl-slider"
              min={row.min}
              max={row.max}
              value={row.val}
              style={{ background: row.grad }}
              onChange={(e) => onChange({ ...color, [row.key]: Number(e.target.value) })}
            />
            <div className="sl-preview" style={{ background: preview }} />
          </div>
        ))}
      </div>
    </div>
  );
}
