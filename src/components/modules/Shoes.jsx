import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { agoLabel } from "../../utils/date";

export const shoeState = (s = {}) => ({ name: "my trusty pair", miles: 0, retireAt: 400, since: Date.now(), retired: [], ...s });
export const wearOf = (s) => Math.max(0, Math.min(1.25, s.miles / (s.retireAt || 400)));

// One reel of the odometer: digits 0-9 stacked, slid up so the right one shows
function Wheel({ digit, tenth }) {
  return (
    <span className={`sh-wheel${tenth ? " tenth" : ""}`}>
      <span className="sh-reel" style={{ transform: `translateY(${-digit * 10}%)` }}>
        {Array.from({ length: 10 }, (_, i) => <i key={i}>{i}</i>)}
      </span>
    </span>
  );
}

// Brown, creased, worn: the sole goes from box-fresh cream to grubby as the miles pile up
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b - v) * t));
const grime = (w) => `rgb(${lerp([255, 250, 238], [168, 150, 118], Math.min(1, w)).join(",")})`;

function Sneaker({ wear, shade }) {
  const w = Math.min(1, wear);
  const ridge = (x) => 38 + (x - 96) * 0.22; // the line the laces cross
  return (
    <g>
      {/* upper */}
      <path className="sh-upper" style={{ fill: shade }} d="M14 76 L12 34 Q12 14 30 12 L46 14 Q54 16 56 26 Q58 34 66 36 L72 22 Q76 14 84 18 L96 38 Q130 42 162 56 Q192 64 192 76 Z" />
      <path className="sh-cap" d="M146 49 Q186 58 192 72 L192 76 L152 76 Q158 60 146 49 Z" />
      <path className="sh-tab" d="M12 40 Q12 22 26 17 L26 62 L12 62 Z" />
      <path className="sh-stripe" d="M32 68 Q60 50 98 58" />
      {/* laces */}
      {[104, 115, 126, 137].map((x) => (
        <path key={x} className="sh-lace" d={`M${x} ${ridge(x) - 1} l-5 11`} />
      ))}
      <path className="sh-collar" d="M30 12 L46 14 Q54 16 56 26" />
      {/* the scuffs and the hole come with the miles */}
      <g className="sh-scuff" style={{ opacity: Math.max(0, (w - 0.35) / 0.4) }}>
        <path d="M168 62 l9 3M172 68 l10 1M160 72 l8 -1M40 74 l8 0" />
      </g>
      {wear > 0.9 && <path className="sh-hole" d="M174 64 l6 -3 5 4 -1 6 -6 1 -4 -3z" />}
      {/* sole: midsole goes grubby, tread wears off the rubber */}
      <path className="sh-mid" style={{ fill: grime(w) }} d="M8 76 H196 Q198 90 184 90 H22 Q8 90 8 76 Z" />
      <rect className="sh-rubber" x="14" y="90" width="176" height="6" rx="3" />
      <g className="sh-tread" style={{ opacity: Math.max(0.08, 1 - w * 1.05) }}>
        {Array.from({ length: 11 }, (_, i) => <path key={i} d={`M${28 + i * 15} 91.5 v3`} />)}
      </g>
    </g>
  );
}

// A pair of sneakers with a mechanical odometer. Miles arrive down the wire from a run
// (or type them in); as the sole wears out the shoes get scruffier, until it's time to retire them.
export default function Shoes({ mod, setState, expanded }) {
  const { toast } = useData();
  const s = shoeState(mod.state);
  const [add, setAdd] = useState("");
  const wear = wearOf(s);
  const shown = Math.floor(s.miles * 10) % 10000;
  const digits = String(shown).padStart(4, "0").split("").map(Number);
  const pct = Math.round(wear * 100);
  const state = wear >= 1 ? "time to retire!" : wear >= 0.8 ? "getting tired" : wear >= 0.5 ? "well loved" : wear > 0.1 ? "broken in" : "box fresh";

  const addMiles = (v) => {
    if (!(v > 0)) return;
    setState((st) => ({ ...st, miles: Math.round(((st.miles ?? 0) + v) * 100) / 100 }));
    toast({
      text: `+${v} mi on the shoes`,
      actions: [{ label: "undo", run: () => setState((st) => ({ ...st, miles: Math.max(0, Math.round(((st.miles ?? 0) - v) * 100) / 100) })) }],
    });
  };
  const retire = () =>
    setState((st) => {
      const cur = shoeState(st);
      return { ...st, name: "a fresh pair", miles: 0, since: Date.now(), retired: [{ id: uid(), name: cur.name, miles: cur.miles, from: cur.since, at: Date.now() }, ...cur.retired].slice(0, 30) };
    });
  const field = (key, parse = (v) => v) => (e) => setState((st) => ({ ...st, [key]: parse(e.target.value) }), { debounce: 600 });

  return (
    <div className={`sh${wear >= 1 ? " tired" : ""}`}>
      <svg className="sh-svg" viewBox="0 0 236 124" role="img" aria-label={`${Math.round(s.miles)} of ${s.retireAt} miles: ${state}`}>
        <ellipse className="sh-shadow" cx="122" cy="116" rx="108" ry="6" />
        <g transform="translate(44 2) scale(0.82)">
          <Sneaker wear={wear} shade="#d8e4f0" />
        </g>
        <g transform="translate(6 18)">
          <Sneaker wear={wear} shade="#f4a99b" />
        </g>
      </svg>

      <div className="sh-odo" role="img" aria-label={`${s.miles.toFixed(1)} miles`}>
        <div className="sh-reels">
          {digits.map((d, i) => <Wheel key={i} digit={d} tenth={i === 3} />)}
        </div>
        <span className="sh-unit">miles</span>
      </div>

      <input
        className="line-input sh-name"
        defaultValue={s.name}
        aria-label="Name of this pair"
        onChange={field("name")}
        placeholder="name this pair"
      />

      <div className="sh-life" aria-label={`${pct} percent worn`}>
        <i style={{ width: `${Math.min(100, pct)}%` }} className={wear >= 1 ? "over" : wear >= 0.8 ? "warn" : ""} />
      </div>
      <div className="sh-say">
        <b>{Math.round(s.miles)}</b> / {s.retireAt} mi · {state}
      </div>

      <div className="sh-add">
        <input
          className="line-input"
          inputMode="decimal"
          placeholder="+ miles"
          value={add}
          onChange={(e) => setAdd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            addMiles(parseFloat(add));
            setAdd("");
          }}
          aria-label="Add miles by hand"
        />
        {wear >= 0.8 && <button className="mini-btn" onClick={retire}>retire them →</button>}
      </div>

      {expanded && (
        <div className="gr-settings">
          <label>retire at<input className="line-input" inputMode="numeric" defaultValue={s.retireAt} onChange={field("retireAt", (v) => Math.max(10, parseInt(v) || 400))} /> miles</label>
          {wear < 0.8 && <button className="mini-btn ghost" onClick={retire}>retire this pair early</button>}
        </div>
      )}
      {s.retired.length > 0 && (
        <div className="sh-shelf">
          {s.retired.slice(0, expanded ? 30 : 2).map((r) => (
            <div key={r.id} className="pile-row">
              <span className="pile-text">👟 {r.name} · {Math.round(r.miles)} mi</span>
              <span className="pile-when">{agoLabel(r.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
