import { useState } from "react";
import { uid } from "../../utils/uid";
import { dayKey, keyToDate, dayDiff, prettyDate } from "../../utils/date";

const W = 300;
const H = 130;
const PAD = { l: 26, r: 10, t: 12, b: 18 };

const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

// Graph paper with a pencil line: one number a day (tempo, distance, loaf
// height…). Plotting twice in a day replaces that day's dot.
export default function Graph({ mod, setState, expanded }) {
  const [input, setInput] = useState("");
  const { unit = "", goal = null, points = [] } = mod.state;
  const pts = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const first = pts[0];
  const last = pts[pts.length - 1];

  const plot = () => {
    const v = parseFloat(input);
    if (!Number.isFinite(v)) return;
    const day = dayKey();
    setState((s) => ({
      ...s,
      points: [...(s.points ?? []).filter((p) => p.day !== day), { id: uid(), day, v }],
    }));
    setInput("");
  };

  const remove = (id) => setState((s) => ({ ...s, points: s.points.filter((p) => p.id !== id) }));
  const setGoal = (g) => setState((s) => ({ ...s, goal: g === "" ? null : parseFloat(g) }), { debounce: 600 });

  let chart = null;
  if (pts.length >= 2) {
    const span = Math.max(1, dayDiff(keyToDate(first.day), keyToDate(last.day)));
    const vals = pts.map((p) => p.v).concat(goal != null ? [goal] : []);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = (hi - lo) * 0.12 || 1;
    const y0 = lo - pad;
    const y1 = hi + pad;
    const x = (p) => PAD.l + (dayDiff(keyToDate(first.day), keyToDate(p.day)) / span) * (W - PAD.l - PAD.r);
    const y = (v) => PAD.t + (1 - (v - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
    chart = (
      <svg className="gr-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${pts.length} points from ${fmt(first.v)} to ${fmt(last.v)} ${unit}`}>
        {goal != null && (
          <g className="gr-goal">
            <line x1={PAD.l} x2={W - PAD.r} y1={y(goal)} y2={y(goal)} />
            <text x={W - PAD.r} y={y(goal) - 4} textAnchor="end">goal {fmt(goal)}</text>
          </g>
        )}
        <text className="gr-axis" x={PAD.l - 4} y={y(hi) + 4} textAnchor="end">{fmt(hi)}</text>
        <text className="gr-axis" x={PAD.l - 4} y={y(lo) + 4} textAnchor="end">{fmt(lo)}</text>
        <text className="gr-axis" x={PAD.l} y={H - 3}>{prettyDate(first.day).slice(4)}</text>
        <text className="gr-axis" x={W - PAD.r} y={H - 3} textAnchor="end">{prettyDate(last.day).slice(4)}</text>
        <polyline className="gr-line" points={pts.map((p) => `${x(p)},${y(p.v)}`).join(" ")} />
        {pts.map((p) => <circle key={p.id} className="gr-dot" cx={x(p)} cy={y(p.v)} r={p === last ? 4.5 : 3} />)}
      </svg>
    );
  }

  const delta = last && first && last !== first ? last.v - first.v : null;

  return (
    <div className="gr">
      <div className="gr-top">
        {last ? (
          <>
            <span className="gr-big">{fmt(last.v)}</span>
            <span className="gr-unit">{unit}</span>
            {delta != null && (
              <span className="gr-delta">
                {delta >= 0 ? "▲" : "▼"} {fmt(Math.abs(delta))} since {prettyDate(first.day).slice(4)}
              </span>
            )}
          </>
        ) : (
          <span className="gr-empty">nothing plotted yet</span>
        )}
      </div>
      {chart ?? (pts.length === 1 && <div className="gr-empty">one more dot and there's a line</div>)}
      <div className="gr-add">
        <input
          className="line-input"
          inputMode="decimal"
          placeholder={`today's ${unit || "number"}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && plot()}
        />
        {input && <button className="mini-btn" onClick={plot}>plot</button>}
      </div>

      {expanded && (
        <>
          <div className="gr-settings">
            <label>
              unit
              <input
                className="line-input"
                defaultValue={unit}
                placeholder="bpm, km, cm…"
                onChange={(e) => setState((s) => ({ ...s, unit: e.target.value }), { debounce: 600 })}
              />
            </label>
            <label>
              goal
              <input
                className="line-input"
                inputMode="decimal"
                defaultValue={goal ?? ""}
                placeholder="optional"
                onChange={(e) => setGoal(e.target.value)}
              />
            </label>
          </div>
          {[...pts].reverse().map((p) => (
            <div key={p.id} className="pile-row">
              <span className="pile-text">{prettyDate(p.day)}</span>
              <span className="gr-row-v">{fmt(p.v)} {unit}</span>
              <button className="x-btn" onClick={() => remove(p.id)} aria-label="Remove point">✕</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
