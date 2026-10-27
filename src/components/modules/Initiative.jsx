import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { rollDie } from "../../lib/dice";
import { clack } from "../../lib/homeSounds";

export const CONDITIONS = [
  "blinded", "charmed", "concentrating", "deafened", "frightened", "grappled", "hasted",
  "incapacitated", "invisible", "paralyzed", "poisoned", "prone", "restrained", "slowed", "stunned", "unconscious",
];

const alive = (c) => c.hp == null || c.hp > 0;
const byInit = (crew) => [...crew].sort((a, b) => (b.init ?? -999) - (a.init ?? -999));
const sgn = (n) => (n >= 0 ? `+${n}` : `${n}`);

// Who's up right now, for the home glance
export function initiativeNow(state) {
  const order = byInit(state.crew ?? []);
  const c = order.find((x) => x.id === state.turn);
  return state.started && c ? { round: state.round ?? 1, name: c.name } : null;
}

// A stack of turn tokens for a tabletop fight: highest initiative on top, an arrow marking whose
// go it is, HP you can nudge, and little condition tags. "Next turn" walks down the stack.
export default function Initiative({ mod, setState, expanded }) {
  const { uid: me } = useData();
  const { crew = [], round = 1, turn = null, started = false } = mod.state;
  const order = byInit(crew);
  const [name, setName] = useState("");
  const [bonus, setBonus] = useState("");
  const [hp, setHp] = useState("");
  const [foe, setFoe] = useState(false);
  const [tagFor, setTagFor] = useState(null);

  const edit = (id, patch) => setState((s) => ({ ...s, crew: s.crew.map((c) => (c.id === id ? { ...c, ...(typeof patch === "function" ? patch(c) : patch) } : c)) }));

  const add = () => {
    const nm = name.trim();
    if (!nm) return;
    const max = parseInt(hp, 10);
    const c = { id: uid(), name: nm, init: null, bonus: parseInt(bonus, 10) || 0, hp: max > 0 ? max : null, max: max > 0 ? max : null, conds: [], foe, by: me };
    setState((s) => ({ ...s, crew: [...(s.crew ?? []), c] }));
    setName("");
    setHp("");
    setBonus("");
  };

  // d20 plus their bonus, for one or for everybody
  const rollOne = (c) => ({ init: rollDie(20) + (c.bonus ?? 0) });
  const rollAll = () => {
    clack();
    setState((s) => ({ ...s, crew: s.crew.map((c) => ({ ...c, ...rollOne(c) })) }));
  };

  const start = () => {
    const first = order.find(alive);
    if (first) setState((s) => ({ ...s, started: true, round: 1, turn: first.id }));
  };
  const next = () => {
    const i = order.findIndex((c) => c.id === turn);
    let wrapped = false;
    // whoever's turn it was got removed: begin again at the top
    if (i < 0) return start();
    for (let step = 1; step <= order.length; step++) {
      const j = (i + step) % order.length;
      if (i + step >= order.length) wrapped = true;
      if (alive(order[j])) {
        setState((s) => ({ ...s, turn: order[j].id, round: (s.round ?? 1) + (wrapped ? 1 : 0) }));
        return;
      }
    }
  };
  const end = () => setState((s) => ({ ...s, started: false, turn: null, round: 1 }));

  const hurt = (c, by) => edit(c.id, (x) => ({ hp: Math.max(0, Math.min(x.max ?? 9999, (x.hp ?? 0) + by)) }));

  return (
    <div className="in">
      <div className="in-top">
        {started ? (
          <>
            <span className="in-round">round <b>{round}</b></span>
            <button className="mini-btn in-next" onClick={next}>next turn ▸</button>
            <button className="mini-btn ghost" onClick={end}>end fight</button>
          </>
        ) : (
          <>
            <button className="mini-btn in-next" onClick={start} disabled={!order.some(alive)}>▶ start the fight</button>
            {crew.length > 0 && <button className="mini-btn" onClick={rollAll}>🎲 roll all</button>}
          </>
        )}
      </div>

      <div className="in-stack">
        {order.length === 0 && <div className="in-empty">no one at the table yet</div>}
        {order.map((c) => {
          const here = started && c.id === turn;
          const frac = c.max ? Math.max(0, Math.min(1, (c.hp ?? 0) / c.max)) : null;
          return (
            <div key={c.id} className={`in-token${here ? " here" : ""}${c.foe ? " foe" : ""}${alive(c) ? "" : " down"}`}>
              <span className="in-arrow" aria-hidden="true">▶</span>
              <div className="in-disc" title="Initiative">
                <input
                  type="number"
                  value={c.init ?? ""}
                  placeholder="–"
                  onChange={(e) => edit(c.id, { init: e.target.value === "" ? null : parseInt(e.target.value, 10) })}
                  aria-label={`${c.name} initiative`}
                />
                <button className="in-die" onClick={() => { clack(true); edit(c.id, rollOne(c)); }} aria-label={`Roll initiative for ${c.name}`} title={`d20 ${sgn(c.bonus ?? 0)}`}>🎲</button>
              </div>
              <div className="in-who">
                <div className="in-name">
                  <button className="in-kind" onClick={() => edit(c.id, { foe: !c.foe })} title={c.foe ? "A foe — tap to make a friend" : "A friend — tap to make a foe"} aria-label="Toggle friend or foe" />
                  <span>{c.name}</span>
                  {!!c.bonus && <small>{sgn(c.bonus)}</small>}
                </div>
                <div className="in-tags">
                  {(c.conds ?? []).map((t) => (
                    <button key={t} className="in-tag" onClick={() => edit(c.id, (x) => ({ conds: x.conds.filter((y) => y !== t) }))} title="Tap to clear">{t}</button>
                  ))}
                  {tagFor === c.id ? (
                    <input
                      className="in-taginput"
                      list="in-conds"
                      autoFocus
                      placeholder="condition"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setTagFor(null);
                        if (e.key !== "Enter") return;
                        const v = e.currentTarget.value.trim().toLowerCase();
                        if (v) edit(c.id, (x) => ({ conds: [...new Set([...(x.conds ?? []), v])] }));
                        setTagFor(null);
                      }}
                      onBlur={() => setTagFor(null)}
                    />
                  ) : (
                    <button className="in-tag plus" onClick={() => setTagFor(c.id)} aria-label={`Add a condition to ${c.name}`}>+</button>
                  )}
                </div>
              </div>
              {c.max != null ? (
                <div className="in-hp">
                  <div className="in-hpnum">
                    <button className="in-step" onClick={(e) => hurt(c, e.shiftKey ? -5 : -1)} aria-label={`Hurt ${c.name}`}>−</button>
                    <span><b>{c.hp}</b>/{c.max}</span>
                    <button className="in-step" onClick={(e) => hurt(c, e.shiftKey ? 5 : 1)} aria-label={`Heal ${c.name}`}>+</button>
                  </div>
                  <i className="in-bar"><u style={{ width: `${(frac ?? 0) * 100}%`, background: frac > 0.5 ? "#6bb36b" : frac > 0.25 ? "#e0a43a" : "#d9534f" }} /></i>
                </div>
              ) : (
                <button className="in-tag plus in-hp0" onClick={() => edit(c.id, { hp: 10, max: 10 })} title="Give them hit points">+ hp</button>
              )}
              <button className="x-btn in-x" onClick={() => setState((s) => ({ ...s, crew: s.crew.filter((x) => x.id !== c.id), turn: s.turn === c.id ? null : s.turn }))} aria-label={`Remove ${c.name}`}>✕</button>
            </div>
          );
        })}
      </div>
      <datalist id="in-conds">{CONDITIONS.map((t) => <option key={t} value={t} />)}</datalist>

      <div className="in-add">
        <button className={`in-kind big${foe ? " foe" : ""}`} onClick={() => setFoe((v) => !v)} aria-label={foe ? "Adding a foe" : "Adding a friend"} title={foe ? "a foe" : "a friend"} />
        <input className="line-input" placeholder="+ name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} aria-label="Name" />
        <input className="line-input in-small" placeholder="±init" inputMode="numeric" value={bonus} onChange={(e) => setBonus(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} aria-label="Initiative bonus" />
        <input className="line-input in-small" placeholder="hp" inputMode="numeric" value={hp} onChange={(e) => setHp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} aria-label="Hit points" />
        <button className="mini-btn" onClick={add}>add</button>
      </div>
      {expanded && <div className="in-help">tap the dot to flip friend / foe · shift-click ± moves hp by 5 · a token at 0 hp gets skipped</div>}
    </div>
  );
}
