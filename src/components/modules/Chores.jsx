import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { SPIN_EVENT } from "../../lib/remote";
import { uid } from "../../utils/uid";
import { ratchet, landed } from "../../lib/homeSounds";
import { rollDie } from "../../lib/dice";
import Sticker from "../Sticker";

// Slice colours, soft carnival
const SLICE = ["#ffd6e0", "#ffe9a8", "#cfe8ff", "#d8f0b8", "#e6d4fa", "#ffd9b0", "#bff0ec", "#f9c9e6"];
const PEOPLE = ["#ff5d8f", "#3a86ff", "#8ac926", "#ffb703", "#9b5de5", "#ff7f11", "#00bbf9", "#f15bb5"];
export const personColor = (i) => PEOPLE[i % PEOPLE.length];

const MS_DAY = 86400000;
// Weeks are counted from a fixed Monday, so every device agrees which week it is
export const weekNo = (d = new Date()) => {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const monday = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return Math.floor((monday - Date.UTC(2024, 0, 1)) / (7 * MS_DAY));
};

const mondayLabel = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const polar = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [100 + r * Math.sin(a), 100 - r * Math.cos(a)];
};
const wedge = (a0, a1, r) => {
  const [x0, y0] = polar(a0, r);
  const [x1, y1] = polar(a1, r);
  return `M100 100 L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`;
};
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function openChores(state) {
  return (state.log ?? []).filter((e) => !e.doneAt && !e.rot).length;
}

// A carnival prize wheel of chores. Flick it (or hit spin), the flapper ticks over each peg, and
// whatever it stops on goes to whoever's turn it is. Or let the rota hand them out week by week.
export default function Chores({ mod, setState, expanded }) {
  const { uid: me, toast } = useData();
  const { people = [], chores = [], log = [], face = "chores", mode = "wheel" } = mod.state;
  const [who, setWho] = useState(null); // whose turn on the wheel
  const [which, setWhich] = useState(null); // in "people" faces: which chore is up for grabs
  const [landedOn, setLanded] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [editing, setEditing] = useState(() => !mod.state.people?.length); // a fresh wheel starts with setup open
  const [newChore, setNewChore] = useState("");
  const [newPerson, setNewPerson] = useState("");

  const items = face === "people" ? people.map((p, i) => ({ id: p.id, text: p.name, color: personColor(i) })) : chores.map((c) => ({ id: c.id, text: c.text }));
  const n = items.length;
  const slice = n ? 360 / n : 360;

  // The turn defaults to whoever has the fewest chores waiting
  const open = log.filter((e) => !e.doneAt && !e.rot);
  const fewest = [...people].sort((a, b) => open.filter((e) => e.pid === a.id).length - open.filter((e) => e.pid === b.id).length)[0];
  const spinner = people.find((p) => p.id === who) ?? fewest;
  const upFor = chores.find((c) => c.id === which) ?? chores[0];

  // Everything the animation loop needs, so a frame never waits on a re-render
  const wheelEl = useRef(null);
  const flapEl = useRef(null);
  const svgEl = useRef(null);
  const live = useRef({});
  live.current = { n, slice, items, spinner, upFor, face, people, chores, setState, toast, me };
  const w = useRef({ a: 0, v: 0, raf: 0, last: 0, tick: 0, drag: null, clickAt: 0 });

  const paint = () => {
    const { a } = w.current;
    wheelEl.current?.setAttribute("transform", `rotate(${a.toFixed(2)} 100 100)`);
  };

  // Where the flapper is pointing: the slice under the top of the wheel
  const under = () => {
    const { n, slice } = live.current;
    if (!n) return -1;
    const at = (((-w.current.a % 360) + 360) % 360) / slice;
    return Math.min(n - 1, Math.floor(at));
  };

  const settle = () => {
    const L = live.current;
    setSpinning(false);
    const i = under();
    if (i < 0) return;
    const it = L.items[i];
    let pid;
    let text;
    if (L.face === "people") {
      if (!L.upFor) return;
      pid = it.id;
      text = L.upFor.text;
    } else {
      if (!L.spinner) {
        setLanded({ text: it.text, name: null });
        return;
      }
      pid = L.spinner.id;
      text = it.text;
    }
    const who = L.people.find((p) => p.id === pid);
    const entry = { id: uid(), chore: text, pid, name: who?.name ?? "", at: Date.now(), doneAt: null, by: L.me };
    L.setState((s) => ({ ...s, log: [entry, ...(s.log ?? [])].slice(0, 300) }));
    setLanded({ text, name: who?.name, color: personColor(L.people.findIndex((p) => p.id === pid)) });
    landed();
    L.toast({
      text: `${who?.name}: ${text}`,
      actions: [{ label: "undo", run: () => L.setState((s) => ({ ...s, log: s.log.filter((e) => e.id !== entry.id) })) }],
    });
  };

  const frame = (t) => {
    const S = w.current;
    const dt = Math.min(0.05, (t - S.last) / 1000);
    S.last = t;
    if (!S.drag) {
      // friction: a steady drag plus a drag that grows with speed, so it coasts then settles
      const sign = Math.sign(S.v);
      S.v -= sign * (45 + 0.55 * Math.abs(S.v)) * dt;
      if (Math.sign(S.v) !== sign) S.v = 0;
      S.a += S.v * dt;
    }
    paint();

    // The flapper rides over one peg per slice; it flicks and clicks as each goes by
    const { slice, n } = live.current;
    if (n) {
      const idx = Math.floor(S.a / slice);
      const into = (((S.a % slice) + slice) % slice) / slice; // 0 just after a peg
      const dir = S.v >= 0 ? 1 : -1;
      const bend = Math.max(0, 1 - (dir > 0 ? into : 1 - into) / 0.3) * 26 * dir;
      flapEl.current?.setAttribute("transform", `rotate(${bend.toFixed(1)} 100 8)`);
      if (idx !== S.tick) {
        S.tick = idx;
        if (t - S.clickAt > 24) {
          S.clickAt = t;
          ratchet(0.85 + Math.min(Math.abs(S.v), 1200) / 2400);
        }
      }
    }

    if (!S.drag && Math.abs(S.v) < 3) {
      S.v = 0;
      S.raf = 0;
      flapEl.current?.setAttribute("transform", "rotate(0 100 8)");
      if (S.fresh) {
        S.fresh = false;
        settle();
      }
      return;
    }
    S.raf = requestAnimationFrame(frame);
  };
  const run = () => {
    const S = w.current;
    if (S.raf) return;
    S.last = performance.now();
    S.raf = requestAnimationFrame(frame);
  };
  useEffect(() => () => cancelAnimationFrame(w.current.raf), []);

  const spin = () => {
    const S = w.current;
    if (!n || S.drag || Math.abs(S.v) > 20) return;
    // crypto for the strength of the throw, so the wheel is as fair as the dice
    const u = rollDie(1000) / 1000;
    S.v = 760 + u * 780;
    S.fresh = true;
    setLanded(null);
    setSpinning(true);
    run();
  };

  // A shake on the phone remote spins it too
  const again = useRef(spin);
  again.current = spin;
  useEffect(() => {
    const on = (e) => e.detail.modId === mod.id && again.current();
    window.addEventListener(SPIN_EVENT, on);
    return () => window.removeEventListener(SPIN_EVENT, on);
  }, [mod.id]);

  // Grab the wheel and fling it
  const angleOf = (e) => {
    const r = svgEl.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + (r.height * 100) / 214;
    return (Math.atan2(e.clientX - cx, cy - e.clientY) * 180) / Math.PI;
  };
  const down = (e) => {
    if (!n) return;
    const S = w.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    S.drag = { last: angleOf(e), samples: [], moved: 0 };
    S.v = 0;
    run();
  };
  const move = (e) => {
    const S = w.current;
    if (!S.drag) return;
    const a = angleOf(e);
    let d = a - S.drag.last;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    S.drag.last = a;
    S.drag.moved += Math.abs(d);
    S.a += d;
    S.drag.samples.push({ t: performance.now(), d });
    S.drag.samples = S.drag.samples.filter((s) => performance.now() - s.t < 90);
  };
  const up = () => {
    const S = w.current;
    if (!S.drag) return;
    const { samples, moved } = S.drag;
    S.drag = null;
    const span = samples.length ? Math.max(30, performance.now() - samples[0].t) : 1;
    const v = (samples.reduce((t, s) => t + s.d, 0) / span) * 1000;
    if (moved < 4) return spin(); // a tap on the wheel is a spin
    S.v = Math.max(-1500, Math.min(1500, v));
    if (Math.abs(S.v) > 90) {
      S.fresh = true;
      setLanded(null);
      setSpinning(true);
    } else S.v = 0;
    run();
  };

  // ---- people, chores, the log ----
  const patch = (p) => setState((s) => ({ ...s, ...p }));
  const addChore = () => {
    const t = newChore.trim();
    if (!t) return;
    setState((s) => ({ ...s, chores: [...(s.chores ?? []), { id: uid(), text: t, by: me }] }));
    setNewChore("");
  };
  const addPerson = () => {
    const t = newPerson.trim();
    if (!t) return;
    setState((s) => ({ ...s, people: [...(s.people ?? []), { id: uid(), name: t, by: me }] }));
    setNewPerson("");
  };
  const tick = (id) => setState((s) => ({ ...s, log: s.log.map((e) => (e.id === id ? { ...e, doneAt: e.doneAt ? null : Date.now() } : e)) }));
  const drop = (id) => setState((s) => ({ ...s, log: s.log.filter((e) => e.id !== id) }));

  const wk = weekNo();
  const doneCount = (pid) => log.filter((e) => e.pid === pid && e.doneAt).length;
  const rota = chores.map((c, i) => {
    const p = people.length ? people[(i + wk) % people.length] : null;
    const e = log.find((x) => x.rot === c.id && x.wk === wk);
    return { c, p, e };
  });
  const tickRota = (r) => {
    if (!r.p) return;
    if (r.e) return drop(r.e.id);
    const e = { id: uid(), chore: r.c.text, pid: r.p.id, name: r.p.name, at: Date.now(), doneAt: Date.now(), rot: r.c.id, wk, by: me };
    setState((s) => ({ ...s, log: [e, ...(s.log ?? [])].slice(0, 300) }));
  };

  const mine = open.slice(0, expanded ? 40 : 4);
  const empty = !people.length || !chores.length;

  return (
    <div className="ch">
      <div className="ch-modes" role="radiogroup" aria-label="How chores get handed out">
        {[["wheel", "🎡 spin the wheel"], ["rotate", "🔁 weekly rota"]].map(([k, l]) => (
          <button key={k} role="radio" aria-checked={mode === k} className={`dc-chip${mode === k ? " sel" : ""}`} onClick={() => patch({ mode: k })}>{l}</button>
        ))}
      </div>

      {mode === "wheel" && (
        <>
          <svg ref={svgEl} className={`ch-wheel${spinning ? " going" : ""}`} viewBox="0 0 200 214" role="img" aria-label={n ? `A wheel of ${n} things` : "An empty wheel"}>
            <path className="ch-stand" d="M52 208 L100 100 L148 208 Z" />
            <path className="ch-stand2" d="M34 210 H166" />
            <circle className="ch-rim" cx="100" cy="100" r="98" />
            <g className="ch-bulbs">
              {Array.from({ length: 20 }, (_, i) => {
                const [x, y] = polar(i * 18, 93);
                return <circle key={i} cx={x} cy={y} r="2.6" className={i % 2 ? "b" : "a"} />;
              })}
            </g>
            <g
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              style={{ cursor: n ? "grab" : "default", touchAction: "none" }}
            >
              <g ref={wheelEl}>
                {n === 0 && <circle cx="100" cy="100" r="86" fill="#f4eee4" />}
                {n === 1 && <circle cx="100" cy="100" r="86" fill={SLICE[0]} />}
                {items.map((it, i) =>
                  n === 1 ? null : (
                    <path key={it.id} d={wedge(i * slice, (i + 1) * slice, 86)} fill={it.color ? `${it.color}55` : SLICE[i % SLICE.length]} className="ch-slice" />
                  )
                )}
                {items.map((it, i) => {
                  const mid = i * slice + slice / 2;
                  const max = n <= 5 ? 10 : n <= 8 ? 9 : 7;
                  return (
                    <text key={it.id} transform={`rotate(${mid - 90} 100 100)`} x="171" y="100" textAnchor="end" dominantBaseline="middle" className="ch-label" style={{ fontSize: n > 8 ? 11 : n > 5 ? 13 : 15 }}>
                      {clip(it.text, max)}
                    </text>
                  );
                })}
                {n > 1 && items.map((it, i) => {
                  const [x, y] = polar(i * slice, 86);
                  return <circle key={it.id} cx={x} cy={y} r="2.8" className="ch-peg" />;
                })}
              </g>
              <circle className="ch-hub" cx="100" cy="100" r="15" />
              <text x="100" y="100.5" textAnchor="middle" dominantBaseline="middle" className="ch-hubtext">SPIN</text>
            </g>
            {n === 0 && <text x="100" y="104" textAnchor="middle" className="ch-none">add chores below</text>}
            {/* the flapper: a leather flick hung from a nail at the top */}
            <g ref={flapEl} className="ch-flap" transform="rotate(0 100 8)">
              <path d="M95.5 4 L104.5 4 L100.8 30 L99.2 30 Z" />
            </g>
            <circle className="ch-nail" cx="100" cy="8" r="3.4" />
          </svg>

          <div className="ch-spinbar">
            <button className="mini-btn ch-spin" onClick={spin} disabled={!n || spinning}>
              {spinning ? "round and round…" : face === "people" ? "who gets it?" : "spin!"}
            </button>
            {face === "chores" && people.length > 0 && (
              <span className="ch-for">for <b style={{ color: personColor(people.indexOf(spinner)) }}>{spinner?.name}</b></span>
            )}
            {face === "people" && chores.length > 0 && (
              <select className="ch-which" value={upFor?.id ?? ""} onChange={(e) => setWhich(e.target.value)} aria-label="Which chore is up for grabs">
                {chores.map((c) => <option key={c.id} value={c.id}>{c.text}</option>)}
              </select>
            )}
          </div>

          {landedOn && !spinning && (
            <div className="ch-landed" role="status">
              <span>{landedOn.name ? <b style={{ color: landedOn.color }}>{landedOn.name}</b> : "someone"}</span> gets <em>{landedOn.text}</em>
            </div>
          )}
        </>
      )}

      {mode === "rotate" && (
        <div className="ch-rota">
          <div className="ch-rota-note">hands round every Monday · week of {mondayLabel()}</div>
          {rota.length === 0 && <div className="ch-none-txt">add some chores, then some people</div>}
          {rota.map((r) => (
            <label key={r.c.id} className={`ch-row${r.e ? " done" : ""}`}>
              <input type="checkbox" checked={!!r.e} onChange={() => tickRota(r)} disabled={!r.p} />
              <span className="ch-chore">{r.c.text}</span>
              {r.p && <span className="ch-who" style={{ background: personColor(people.indexOf(r.p)) }}>{r.p.name}</span>}
              {r.e && <Sticker seed={r.e.id} size={20} />}
            </label>
          ))}
        </div>
      )}

      {mode === "wheel" && (
        <div className="ch-open">
          {mine.map((e) => (
            <label key={e.id} className="ch-row">
              <input type="checkbox" checked={false} onChange={() => tick(e.id)} />
              <span className="ch-chore">{e.chore}</span>
              <span className="ch-who" style={{ background: personColor(Math.max(0, people.findIndex((p) => p.id === e.pid))) }}>{e.name}</span>
              <button type="button" className="x-btn" onClick={(ev) => { ev.preventDefault(); drop(e.id); }} aria-label="Take it off the list">✕</button>
            </label>
          ))}
          {open.length > mine.length && <div className="nx-more">+{open.length - mine.length} more waiting</div>}
          {open.length === 0 && !empty && <div className="ch-none-txt">nothing waiting. spin for something!</div>}
        </div>
      )}

      {people.length > 0 && (
        <div className="ch-board" aria-label="Who's done what">
          {people.map((p, i) => {
            const done = log.filter((e) => e.pid === p.id && e.doneAt);
            return (
              <button
                key={p.id}
                className={`ch-person${spinner?.id === p.id && mode === "wheel" && face === "chores" ? " sel" : ""}`}
                onClick={() => setWho(p.id)}
                title={face === "chores" ? `Spin for ${p.name}` : p.name}
              >
                <span className="ch-pname" style={{ borderColor: personColor(i) }}>{p.name}</span>
                <span className="ch-stickers">
                  {done.slice(0, expanded ? 18 : 6).map((e) => <Sticker key={e.id} seed={e.id} size={16} />)}
                  {done.length > (expanded ? 18 : 6) && <small>+{done.length - (expanded ? 18 : 6)}</small>}
                </span>
                <b className="ch-count">{doneCount(p.id)}</b>
              </button>
            );
          })}
        </div>
      )}

      <button className="pile-toggle" onClick={() => setEditing((v) => !v)}>{editing ? "▾" : "▸"} set up the wheel</button>
      {editing && (
        <div className="ch-setup">
          <div className="ch-modes" role="radiogroup" aria-label="What's on the wheel">
            {[["chores", "chores on the wheel"], ["people", "people on the wheel"]].map(([k, l]) => (
              <button key={k} role="radio" aria-checked={face === k} className={`dc-chip${face === k ? " sel" : ""}`} onClick={() => patch({ face: k })}>{l}</button>
            ))}
          </div>
          <div className="ch-chips">
            {chores.map((c) => (
              <span key={c.id} className="ch-chip">{c.text}<button className="x-btn" onClick={() => setState((s) => ({ ...s, chores: s.chores.filter((x) => x.id !== c.id) }))} aria-label={`Remove ${c.text}`}>✕</button></span>
            ))}
          </div>
          <input className="line-input" placeholder="+ a chore" value={newChore} onChange={(e) => setNewChore(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addChore()} onBlur={addChore} aria-label="Add a chore" />
          <div className="ch-chips">
            {people.map((p, i) => (
              <span key={p.id} className="ch-chip" style={{ borderColor: personColor(i) }}>{p.name}<button className="x-btn" onClick={() => setState((s) => ({ ...s, people: s.people.filter((x) => x.id !== p.id) }))} aria-label={`Remove ${p.name}`}>✕</button></span>
            ))}
          </div>
          <input className="line-input" placeholder="+ a person" value={newPerson} onChange={(e) => setNewPerson(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPerson()} onBlur={addPerson} aria-label="Add a person" />
        </div>
      )}
    </div>
  );
}
