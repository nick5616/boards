import { hslStr, HUE_SWATCHES } from "../utils/color";

export default function ColorPicker({ color, onChange }) {
  const { h, s, l } = color;
  const preview = hslStr(h, s, l);
  const sGrad = `linear-gradient(to right,hsl(${h},0%,${l}%),hsl(${h},100%,${l}%))`;
  const lGrad = `linear-gradient(to right,hsl(${h},${s}%,25%),hsl(${h},${s}%,${l}%),hsl(${h},${s}%,97%))`;

  return (
    <div>
      <div className="hue-scroll">
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
