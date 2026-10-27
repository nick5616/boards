import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { MODULES } from "../../constants/modules";
import { uid } from "../../utils/uid";
import { readable, readOf, rangeOf } from "../../lib/gauges";

const MAX_DIALS = 4;
const SWEEP = 120; // degrees either side of straight up
const CX = 60;
const CY = 64;

// Point on a circle, angle measured from straight up (clockwise)
const polar = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};
const arc = (r, a0, a1) => {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

const short = (v) => {
  if (!Number.isFinite(v)) return "–";
  const n = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return n.toLocaleString();
};

// A car dashboard of dials. Each one mirrors a number from another module (here or on
// another board), live: the module is read, never changed. Click a dial to go there.
export default function Gauges({ mod, setState }) {
  const { boards, goTo } = useData();
  const dials = mod.state.dials ?? [];
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(null); // dial id

  const patch = (id, p) => setState((s) => ({ ...s, dials: s.dials.map((d) => (d.id === id ? { ...d, ...p } : d)) }));
  const num = (v) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

  const find = (src) => {
    const board = boards?.find((b) => b.id === src.boardId);
    const m = board?.modules.find((x) => x.id === src.modId);
    return { board, m };
  };

  const add = (board, m) => {
    setState((s) => ({ ...s, dials: [...(s.dials ?? []), { id: uid(), src: { boardId: board.id, modId: m.id }, min: null, max: null, goal: null }] }));
    setPicking(false);
  };

  if (picking) {
    const groups = (boards ?? []).map((b) => ({ b, ms: b.modules.filter((m) => m.id !== mod.id && readable(m)) })).filter((g) => g.ms.length);
    return (
      <div className="gg gg-pick">
        <div className="gg-pick-head">
          which number?
          <button className="mini-btn ghost" onClick={() => setPicking(false)}>never mind</button>
        </div>
        <div className="gg-pick-list">
          {groups.map(({ b, ms }) => (
            <div key={b.id}>
              <div className="gg-pick-board">{b.title}</div>
              {ms.map((m) => {
                const r = readOf(m);
                return (
                  <button key={m.id} className="gg-pick-row" onClick={() => add(b, m)}>
                    <span>{m.title}</span>
                    <i>{r ? `${short(r.value)} ${r.unit ?? ""}` : "nothing yet"}</i>
                  </button>
                );
              })}
            </div>
          ))}
          {!groups.length && <div className="gg-none">no graphs, tallies, jars or metronomes to read yet</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="gg">
      <div className="gg-panel">
        <span className="gg-trim" aria-hidden="true" />
        <div className="gg-grid">
          {dials.map((d) => {
            const { board, m } = find(d.src);
            const read = m ? readOf(m) : null;
            const rg = read ? rangeOf(read, d) : null;
            const frac = read ? Math.min(1, Math.max(0, (read.value - rg.min) / (rg.max - rg.min))) : 0;
            const gfrac = rg?.goal != null ? Math.min(1, Math.max(0, (rg.goal - rg.min) / (rg.max - rg.min))) : null;
            const deg = -SWEEP + 2 * SWEEP * frac;
            const reached = read && rg.goal != null && read.value >= rg.goal;
            return (
              <div key={d.id} className="gg-cell">
                <button
                  className="gg-dial"
                  onClick={() => m && goTo(board.id, m.id)}
                  disabled={!m}
                  title={m ? `Open ${m.title} on ${board.title}` : "that module was taken down"}
                  aria-label={m ? `${m.title}: ${short(read?.value)} ${read?.unit ?? ""}` : "gone"}
                >
                  <svg viewBox="0 0 120 120">
                    <defs>
                      <radialGradient id={`gf-${d.id}`} cx="50%" cy="40%" r="70%">
                        <stop offset="0" stopColor="#34302c" />
                        <stop offset="1" stopColor="#0d0c0b" />
                      </radialGradient>
                      <linearGradient id={`gb-${d.id}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#d8d4cc" />
                        <stop offset="0.5" stopColor="#6d6862" />
                        <stop offset="1" stopColor="#2a2724" />
                      </linearGradient>
                    </defs>
                    <circle cx={CX} cy={CY} r="57" fill={`url(#gb-${d.id})`} />
                    <circle cx={CX} cy={CY} r="52" fill={`url(#gf-${d.id})`} />
                    {/* the sweep from min to max, with the part you've covered lit */}
                    <path d={arc(44, -SWEEP, SWEEP)} className="gg-track" />
                    {read && frac > 0.002 && <path d={arc(44, -SWEEP, deg)} className={`gg-fill${reached ? " done" : ""}`} />}
                    {Array.from({ length: 21 }, (_, i) => {
                      const a = -SWEEP + (i * 2 * SWEEP) / 20;
                      const big = i % 5 === 0;
                      const [x0, y0] = polar(big ? 36 : 39, a);
                      const [x1, y1] = polar(47, a);
                      return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className={big ? "gg-tick big" : "gg-tick"} />;
                    })}
                    {gfrac != null && (() => {
                      const a = -SWEEP + 2 * SWEEP * gfrac;
                      const [x0, y0] = polar(33, a);
                      const [x1, y1] = polar(50, a);
                      return <line x1={x0} y1={y0} x2={x1} y2={y1} className="gg-goal" />;
                    })()}
                    {read && (
                      <>
                        <text x={polar(30, -SWEEP)[0] + 2} y={polar(30, -SWEEP)[1] + 14} className="gg-end">{short(rg.min)}</text>
                        <text x={polar(30, SWEEP)[0] - 2} y={polar(30, SWEEP)[1] + 14} className="gg-end" textAnchor="end">{short(rg.max)}</text>
                      </>
                    )}
                    <text x={CX} y={CY + 24} textAnchor="middle" className="gg-num">{read ? short(read.value) : "–"}</text>
                    <text x={CX} y={CY + 34} textAnchor="middle" className="gg-unit">{read ? read.unit ?? "" : ""}</text>
                    {/* the needle swings (the transition is in the css) */}
                    <g className="gg-needle" style={{ transform: `rotate(${deg}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
                      <path d={`M${CX - 2.6} ${CY + 6} L${CX - 1} ${CY - 41} L${CX} ${CY - 45} L${CX + 1} ${CY - 41} L${CX + 2.6} ${CY + 6}Z`} />
                    </g>
                    <circle cx={CX} cy={CY} r="6" className="gg-hub" />
                    <circle cx={CX - 1.5} cy={CY - 1.5} r="1.8" fill="#fff" opacity="0.5" />
                    {/* a little glass glare */}
                    <path d="M16 46 A48 48 0 0 1 64 14 A62 50 0 0 0 16 46Z" className="gg-glare" />
                  </svg>
                </button>
                <div className="gg-name">
                  <span>{m ? m.title : "taken down"}</span>
                  <button className="gg-gear" onClick={() => setEditing(editing === d.id ? null : d.id)} aria-label="Dial settings" aria-expanded={editing === d.id}>⚙</button>
                </div>
                {m && <div className="gg-src">{MODULES[m.type].label} · {board.title}</div>}
                {editing === d.id && (
                  <div className="gg-edit">
                    {[["min", "from"], ["max", "to"], ["goal", "goal"]].map(([k, label]) => (
                      <label key={k}>
                        {label}
                        <input
                          inputMode="decimal"
                          placeholder="auto"
                          defaultValue={d[k] ?? ""}
                          onChange={(e) => patch(d.id, { [k]: num(e.target.value) })}
                        />
                      </label>
                    ))}
                    <button
                      className="mini-btn ghost"
                      onClick={() => {
                        setState((s) => ({ ...s, dials: s.dials.filter((x) => x.id !== d.id) }));
                        setEditing(null);
                      }}
                    >
                      take it out
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {dials.length < MAX_DIALS && (
            <button className="gg-slot" onClick={() => setPicking(true)}>
              <span>+</span>
              <i>add a dial</i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
