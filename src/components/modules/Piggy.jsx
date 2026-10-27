import { useState, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { agoLabel } from "../../utils/date";
import { hash } from "../Sticker";
import { coin } from "../../lib/homeSounds";

// China pig colours
const CHINA = ["#ffc4d0", "#ffe08a", "#bfe3ff", "#c9eaa8", "#dcc8f7", "#ffd0a8"];

// Money is kept in whole cents so adding it up never goes odd
export const money = (c, cur = "$") => {
  const neg = c < 0;
  const v = Math.abs(c) / 100;
  return `${neg ? "−" : ""}${cur}${Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
export const balanceOf = (pig) => (pig.ledger ?? []).reduce((t, e) => t + e.c, 0);
const toCents = (text) => {
  const v = parseFloat(String(text).replace(/[^0-9.]/g, ""));
  return Number.isFinite(v) ? Math.round(v * 100) : 0;
};

const BODY = "M42 80 C42 50 70 34 102 34 C138 34 162 54 162 82 C162 108 142 124 120 124 L72 124 C54 124 42 104 42 80Z";

// A china piggy bank with a window onto the coins: they pile up to show how close the goal is.
function PigSvg({ frac, color, id, mini = false, party = false }) {
  const rows = Math.ceil(frac * 12);
  const top = 124 - frac * 92;
  return (
    <svg className="pg-svg" viewBox="0 0 200 150" aria-hidden="true">
      <defs>
        <clipPath id={`pg-${id}${mini ? "m" : ""}`}><path d={BODY} /></clipPath>
      </defs>
      {/* legs, tail, ear sit behind the body */}
      <path className="pg-line" fill={color} d="M60 118 h18 v16 q0 4 -4 4 h-10 q-4 0 -4 -4z M118 118 h18 v16 q0 4 -4 4 h-10 q-4 0 -4 -4z" />
      <path className="pg-tail" d="M44 72 q-16 -4 -14 -16 q2 -8 10 -4" />
      <path className="pg-line" fill={color} d="M118 44 L130 16 L148 52z" />
      <path className="pg-glass" fill={color} d={BODY} />
      <g clipPath={`url(#pg-${id}${mini ? "m" : ""})`}>
        {frac > 0 &&
          Array.from({ length: rows }, (_, r) =>
            Array.from({ length: 11 }, (_, i) => {
              const h = hash(`${id}${r}${i}`);
              const y = 119 - r * 7.4 + ((h >>> 4) % 3) - 1;
              if (y < top - 4) return null;
              return <ellipse key={`${r}-${i}`} className="pg-coin" cx={36 + i * 12.6 + (r % 2) * 6 + ((h >>> 2) % 4)} cy={y} rx="7.2" ry="4.4" />;
            })
          )}
      </g>
      <path className="pg-outline" d={BODY} />
      <path className="pg-shine" d="M56 62 q6 -16 26 -20" />
      <path className="pg-slot" d="M78 36 h26" />
      {/* the snout and face */}
      <ellipse className="pg-line" fill={color} cx="162" cy="84" rx="14" ry="17" />
      <ellipse cx="166" cy="78" rx="2.2" ry="3.2" fill="#2a2520" />
      <ellipse cx="166" cy="91" rx="2.2" ry="3.2" fill="#2a2520" />
      <circle cx="142" cy="64" r="3.6" fill="#2a2520" />
      <path className="pg-cheek" d="M138 78 q6 5 12 0" />
      {party && (
        <g>
          <path d="M114 22 L128 -2 L140 24z" fill="#ff5d8f" stroke="#2a2520" strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="128" cy="-2" r="3.4" fill="#ffd23f" stroke="#2a2520" strokeWidth="1.6" />
        </g>
      )}
    </svg>
  );
}

// A piggy bank (or a whole shelf of them, one per kid) with a ledger of coins in and out.
export default function Piggy({ mod, setState, expanded }) {
  const { uid: me, toast } = useData();
  const { pigs = [], active = null, cur = "$" } = mod.state;
  const pig = pigs.find((p) => p.id === active) ?? pigs[0];
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [fall, setFall] = useState(null); // { k, out }: a coin on its way in or out
  const [oink, setOink] = useState(0);
  const [edit, setEdit] = useState(false);
  const k = useRef(0);

  const patch = (p) => setState((s) => ({ ...s, ...p }));
  const editPig = (id, p) => setState((s) => ({ ...s, pigs: s.pigs.map((x) => (x.id === id ? { ...x, ...p } : x)) }), { debounce: 500 });

  const addPig = () => {
    const id = uid();
    setState((s) => ({
      ...s,
      active: id,
      pigs: [...(s.pigs ?? []), { id, name: "New pig", goal: 5000, label: "", color: CHINA[(s.pigs ?? []).length % CHINA.length], ledger: [], by: me }],
    }));
    setEdit(true);
  };

  const move = (cents) => {
    if (!pig || !cents) return;
    const bal = balanceOf(pig);
    if (cents < 0 && -cents > bal) {
      toast({ text: `only ${money(bal, cur)} in ${pig.name}` });
      return;
    }
    const e = { id: uid(), c: cents, note: note.trim(), at: Date.now(), by: me };
    setState((s) => ({ ...s, pigs: s.pigs.map((x) => (x.id === pig.id ? { ...x, ledger: [e, ...(x.ledger ?? [])].slice(0, 400) } : x)) }));
    setAmt("");
    setNote("");
    setFall({ k: ++k.current, out: cents < 0 });
    setOink((n) => n + 1);
    coin(cents < 0);
  };
  const undo = (e) => setState((s) => ({ ...s, pigs: s.pigs.map((x) => (x.id === pig.id ? { ...x, ledger: x.ledger.filter((l) => l.id !== e.id) } : x)) }));

  if (!pig) {
    return (
      <div className="pg">
        <div className="pg-none">no piggy banks yet</div>
        <button className="mini-btn" onClick={addPig}>+ get a pig</button>
      </div>
    );
  }

  const bal = balanceOf(pig);
  const goal = Math.max(1, pig.goal ?? 5000);
  const frac = Math.max(0, Math.min(1, bal / goal));
  const reached = bal >= goal;

  return (
    <div className="pg">
      {(pigs.length > 1 || expanded) && (
        <div className="pg-shelf" role="tablist" aria-label="Piggy banks">
          {pigs.map((p) => (
            <button key={p.id} role="tab" aria-selected={p.id === pig.id} className={`pg-mini${p.id === pig.id ? " sel" : ""}`} onClick={() => patch({ active: p.id })}>
              <PigSvg frac={Math.min(1, balanceOf(p) / Math.max(1, p.goal ?? 5000))} color={p.color} id={p.id} mini />
              <span>{p.name}</span>
              <b>{money(balanceOf(p), cur)}</b>
            </button>
          ))}
          <button className="pg-mini add" onClick={addPig} aria-label="Another pig">+</button>
        </div>
      )}

      <div className="pg-stage">
        <div className={`pg-hop${oink ? " go" : ""}`} key={`hop${oink}`}>
          <PigSvg frac={frac} color={pig.color} id={pig.id} party={reached} />
        </div>
        {fall && <i key={`fall${fall.k}`} className={`pg-fall${fall.out ? " out" : ""}`} aria-hidden="true" />}
      </div>

      <div className="pg-tag">
        <div className="pg-name">{pig.name}{pig.label ? <> · <em>{pig.label}</em></> : null}</div>
        <div className="pg-bal"><b>{money(bal, cur)}</b> <span>of {money(goal, cur)}</span> <small>{Math.round(frac * 100)}%</small></div>
      </div>

      {reached && (
        <button
          className="mini-btn pg-bought"
          onClick={() => {
            const e = { id: uid(), c: -goal, note: `bought ${pig.label || "the goal"}`, at: Date.now(), by: me };
            setState((s) => ({ ...s, pigs: s.pigs.map((x) => (x.id === pig.id ? { ...x, label: "", ledger: [e, ...x.ledger] } : x)) }));
            setFall({ k: ++k.current, out: true });
            coin(true);
          }}
        >
          🎉 got it! spend it
        </button>
      )}

      <div className="pg-form">
        <input className="line-input pg-amt" inputMode="decimal" placeholder={`${cur} amount`} value={amt} onChange={(e) => setAmt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && move(toCents(amt))} aria-label="Amount" />
        <input className="line-input pg-note" placeholder="for…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && move(toCents(amt))} aria-label="What for" />
      </div>
      <div className="pg-btns">
        <button className="mini-btn pg-in" onClick={() => move(toCents(amt))} disabled={!toCents(amt)}>drop it in</button>
        <button className="mini-btn" onClick={() => move(-toCents(amt))} disabled={!toCents(amt)}>take it out</button>
        {[1, 5, 10].map((n) => (
          <button key={n} className="mini-btn ghost" onClick={() => move(n * 100)}>+{cur}{n}</button>
        ))}
      </div>

      <div className="pg-ledger">
        {(pig.ledger ?? []).slice(0, expanded ? 100 : 4).map((e) => (
          <div key={e.id} className={`pile-row pg-l ${e.c < 0 ? "pg-minus" : "pg-plus"}`}>
            <b>{e.c < 0 ? "−" : "+"}{money(Math.abs(e.c), cur)}</b>
            <span className="pile-text">{e.note}</span>
            <span className="pile-when">{agoLabel(e.at)}</span>
            <button className="x-btn" onClick={() => undo(e)} aria-label="Take that line out of the ledger">✕</button>
          </div>
        ))}
        {!expanded && (pig.ledger?.length ?? 0) > 4 && <div className="nx-more">+{pig.ledger.length - 4} older in the ledger</div>}
      </div>

      <button className="pile-toggle" onClick={() => setEdit((v) => !v)}>{edit ? "▾" : "▸"} about this pig</button>
      {edit && (
        <div key={pig.id} className="gr-settings pg-set">
          <label>name<input className="line-input" defaultValue={pig.name} onChange={(e) => editPig(pig.id, { name: e.target.value })} /></label>
          <label>saving for<input className="line-input" defaultValue={pig.label} placeholder="new skates" onChange={(e) => editPig(pig.id, { label: e.target.value })} /></label>
          <label>goal<input className="line-input" inputMode="decimal" defaultValue={pig.goal / 100} onChange={(e) => editPig(pig.id, { goal: Math.max(100, toCents(e.target.value)) })} /></label>
          <label>money sign<input className="line-input" defaultValue={cur} onChange={(e) => patch({ cur: e.target.value.slice(0, 3) || "$" })} /></label>
          <div className="pg-colors">
            {CHINA.map((c) => <button key={c} className={`pg-sw${c === pig.color ? " sel" : ""}`} style={{ background: c }} onClick={() => editPig(pig.id, { color: c })} aria-label="Colour" />)}
          </div>
          {pigs.length > 1 && (
            <button
              className="mini-btn ghost"
              onClick={() => {
                if (!confirm(`Remove ${pig.name} and its ledger?`)) return;
                setState((s) => ({ ...s, pigs: s.pigs.filter((x) => x.id !== pig.id), active: null }));
                setEdit(false);
              }}
            >
              remove this pig
            </button>
          )}
        </div>
      )}
    </div>
  );
}
