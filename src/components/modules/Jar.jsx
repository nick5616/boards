import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { agoLabel } from "../../utils/date";
import { hash, STICKER_COLORS } from "../Sticker";

const MARBLES = 40; // a full jar
const PER_ROW = 5;

export const jarAmount = (n, unit) => {
  const num = Math.round(n * 100) / 100;
  const s = num.toLocaleString();
  if (unit === "$" || unit === "€" || unit === "£") return `${unit}${s}`;
  return unit ? `${s} ${unit}` : s;
};

const stepsFor = (goal) => (goal <= 30 ? [1] : goal <= 300 ? [1, 5, 10] : [10, 50, 100]);

// A jar you drop marbles into. When it's full, put a lid on it: it goes on
// the shelf and a fresh jar with the same goal takes its place.
export default function Jar({ mod, setState, expanded }) {
  const { toast } = useData();
  const [custom, setCustom] = useState("");
  const [showShelf, setShowShelf] = useState(false);
  const { label = "", goal = 100, unit = "", drops = [], shelf = [] } = mod.state;
  const total = drops.reduce((t, d) => t + d.amt, 0);
  const frac = Math.min(1, goal > 0 ? total / goal : 0);
  const full = total >= goal;
  const marbles = Math.round(frac * MARBLES);

  const drop = (amt) => {
    if (!(amt > 0)) return;
    const d = { id: uid(), amt, at: Date.now() };
    setState((s) => ({ ...s, drops: [...(s.drops ?? []), d] }));
    toast({
      text: `+${jarAmount(amt, unit)} in the jar`,
      actions: [{ label: "undo", run: () => setState((s) => ({ ...s, drops: s.drops.filter((x) => x.id !== d.id) })) }],
    });
  };

  const lid = () =>
    setState((s) => ({
      ...s,
      drops: [],
      shelf: [
        { id: uid(), label: s.label, goal: s.goal, unit: s.unit, total, startedAt: s.drops[0]?.at ?? Date.now(), filledAt: Date.now() },
        ...(s.shelf ?? []),
      ].slice(0, 50),
    }));

  const field = (key, parse = (v) => v) => (e) =>
    setState((s) => ({ ...s, [key]: parse(e.target.value) }), { debounce: 600 });

  return (
    <div className="jar">
      <svg className={`jar-svg${full ? " full" : ""}`} viewBox="0 0 100 124" role="img" aria-label={`${jarAmount(total, unit)} of ${jarAmount(goal, unit)}`}>
        <defs>
          <clipPath id={`jar-${mod.id}`}>
            <path d="M22 26 h56 q8 0 8 10 v70 q0 14 -14 14 h-44 q-14 0 -14 -14 v-70 q0 -10 8 -10z" />
          </clipPath>
        </defs>
        <g clipPath={`url(#jar-${mod.id})`}>
          {Array.from({ length: marbles }, (_, i) => {
            const row = Math.floor(i / PER_ROW);
            const col = i % PER_ROW;
            const h = hash(`${mod.id}${i}`);
            return (
              <circle
                key={i}
                cx={24 + col * 13 + (row % 2) * 6 + ((h % 5) - 2)}
                cy={112 - row * 10.5 + ((h >>> 3) % 3) - 1}
                r={6}
                fill={STICKER_COLORS[(h >>> 5) % STICKER_COLORS.length]}
                stroke="#2a2520"
                strokeWidth="1.2"
              />
            );
          })}
        </g>
        <path className="jar-glass" d="M22 26 h56 q8 0 8 10 v70 q0 14 -14 14 h-44 q-14 0 -14 -14 v-70 q0 -10 8 -10z" />
        <path className="jar-shine" d="M24 44 v52" />
        <rect className={`jar-lid${full ? " on" : ""}`} x="18" y="12" width="64" height="14" rx="4" />
        {label && (
          <g className="jar-tag">
            <rect x="26" y="48" width="48" height="20" rx="2" />
            <text x="50" y="62" textAnchor="middle">{label.length > 11 ? `${label.slice(0, 10)}…` : label}</text>
          </g>
        )}
      </svg>

      <div className="jar-total">
        <b>{jarAmount(total, unit)}</b> / {jarAmount(goal, unit)}
      </div>

      {full ? (
        <button className="mini-btn jar-lid-btn" onClick={lid}>🎉 full! put a lid on it</button>
      ) : (
        <div className="jar-drops">
          {stepsFor(goal).map((n) => (
            <button key={n} className="mini-btn" onClick={() => drop(n)}>+{n}</button>
          ))}
          <input
            className="line-input jar-custom"
            inputMode="decimal"
            placeholder="+ other"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              drop(parseFloat(custom));
              setCustom("");
            }}
            aria-label="Add another amount"
          />
        </div>
      )}

      {expanded && (
        <div className="gr-settings">
          <label>label<input className="line-input" defaultValue={label} placeholder="what's it for?" onChange={field("label")} /></label>
          <label>goal<input className="line-input" inputMode="decimal" defaultValue={goal} onChange={field("goal", (v) => Math.max(1, parseFloat(v) || 1))} /></label>
          <label>unit<input className="line-input" defaultValue={unit} placeholder="$, books, hours…" onChange={field("unit")} /></label>
        </div>
      )}
      {expanded &&
        [...drops].reverse().map((d) => (
          <div key={d.id} className="pile-row">
            <span className="pile-text">+{jarAmount(d.amt, unit)}</span>
            <span className="pile-when">{agoLabel(d.at)}</span>
            <button className="x-btn" onClick={() => setState((s) => ({ ...s, drops: s.drops.filter((x) => x.id !== d.id) }))} aria-label="Take it back out">✕</button>
          </div>
        ))}

      {shelf.length > 0 && (
        <button className="pile-toggle" onClick={() => setShowShelf((v) => !v)}>
          {showShelf ? "▾" : "▸"} on the shelf ({shelf.length})
        </button>
      )}
      {showShelf &&
        shelf.map((j) => (
          <div key={j.id} className="pile-row">
            <span className="pile-text">🫙 {j.label || "a jar"} · {jarAmount(j.total, j.unit)}</span>
            <span className="pile-when">{agoLabel(j.filledAt)}</span>
          </div>
        ))}
    </div>
  );
}
