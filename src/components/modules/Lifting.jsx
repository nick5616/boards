import { useState, useEffect, useMemo } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { dayKey } from "../../utils/date";
import { sendAll } from "../../lib/readings";
import {
  STARTERS, loadExercises, findExercises, recordOf, isRecord, records, weeklyVolume,
  volume, oneRep, fmtVol, fmtW,
} from "../../lib/lifting";
import SendTo, { WireTag } from "../board/SendTo";
import { Seg, ChipRow, Credit } from "./kit";

// A clipboard for the gym: pick lifts (names and muscles from wger), log sets of weight × reps,
// see the record. Opened big adds the weekly volume chart, every PR and the wires.
// A new record can go down a wire to a Graph.
export default function Lifting({ board, mod, setState, expanded }) {
  const { logPractice, undoLog, toast, updateBoard } = useData();
  const { unit = "lb", lifts = [], cur = null, log = [] } = mod.state;
  const today = dayKey();
  const lift = lifts.find((l) => l.name === cur) ?? lifts[0] ?? null;

  const [q, setQ] = useState("");
  const [index, setIndex] = useState(null); // null = not asked yet, "wait", "fail", or the list
  const [reps, setReps] = useState("");
  const [w, setW] = useState("");
  const [adding, setAdding] = useState(false);

  // Prefill with what you did last on this lift
  const last = lift && log.find((s) => s.ex === lift.name);
  useEffect(() => {
    setReps(last ? String(last.reps) : "5");
    setW(last ? fmtW(last.w) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lift?.name]);

  const ask = () => {
    if (index) return;
    setIndex("wait");
    loadExercises().then(setIndex).catch(() => setIndex("fail"));
  };

  const list = Array.isArray(index) ? index : STARTERS;
  const hits = useMemo(() => (q.trim() ? findExercises(list, q) : []), [list, q]);
  const nothing = q.trim() && !hits.length;
  const finding = adding || expanded || !lift;

  const pick = (e) => {
    setState((s) => ({
      ...s,
      lifts: (s.lifts ?? []).some((l) => l.name === e.name) ? s.lifts : [...(s.lifts ?? []), { name: e.name, muscles: e.muscles ?? [], equip: e.equip ?? [] }],
      cur: e.name,
    }));
    setQ("");
    setAdding(false);
  };

  const n = (v) => Number(String(v).replace(",", "."));
  const ready = lift && n(reps) > 0 && n(w) >= 0 && w !== "";

  const logSet = () => {
    if (!ready) return;
    const set = { id: uid(), day: today, at: Date.now(), ex: lift.name, reps: Math.round(n(reps)), w: n(w) };
    const pr = isRecord(log, set);
    setState((s) => ({ ...s, log: [set, ...(s.log ?? [])] }));
    const entry = logPractice(board.id, `🏋 ${lift.name} ${set.reps} × ${fmtW(set.w)} ${unit}`, { sets: 1 });
    const sent = pr ? sendAll(updateBoard, board.id, mod.state.sendTo, { value: set.w, unit, label: `${lift.name} PR` }) : 0;
    toast({
      text: pr ? `new PR: ${lift.name} ${fmtW(set.w)} ${unit} ★${sent ? " · sent" : ""}` : `${set.reps} × ${fmtW(set.w)} ${unit}`,
      actions: [{ label: "undo", run: () => { undoLog(entry); setState((s) => ({ ...s, log: s.log.filter((x) => x.id !== set.id) })); } }],
    });
  };

  const unset = (id) => setState((s) => ({ ...s, log: s.log.filter((x) => x.id !== id) }));
  const drop = (name) => setState((s) => ({ ...s, lifts: s.lifts.filter((l) => l.name !== name), cur: s.cur === name ? null : s.cur }));
  const step = (set, v, d) => set(String(Math.max(0, Math.round((n(v) + d) * 10) / 10)));
  const jump = unit === "kg" ? 2.5 : 5;

  const mine = lift ? log.filter((s) => s.ex === lift.name && s.day === today) : [];
  const rec = lift ? recordOf(log, lift.name) : null;
  const prs = records(log);
  const weeks = weeklyVolume(log);
  const weekVol = weeks.at(-1).vol;

  return (
    <div className="lft">
      {finding && (
        <div className="lft-find">
          <input
            className="line-input"
            placeholder={lift ? "add a lift: squat, curl, rows…" : "what are you lifting?"}
            value={q}
            onFocus={ask}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Find an exercise"
          />
          {index === "wait" && <span className="lft-hint">loading wger’s exercise list…</span>}
          {index === "fail" && <span className="lft-hint">offline: type your own, or pick a classic</span>}
          {q.trim() ? (
            <div className="lft-hits">
              {hits.map((e) => (
                <button key={e.name} className="lft-hit" onClick={() => pick(e)}>
                  <b>{e.name}</b>
                  <i>{[...e.muscles.slice(0, 2), ...e.equip.slice(0, 1)].join(" · ")}</i>
                </button>
              ))}
              {nothing && (
                <button className="lft-hit" onClick={() => pick({ name: q.trim().replace(/^./, (c) => c.toUpperCase()), muscles: [], equip: [] })}>
                  <b>+ add “{q.trim()}”</b>
                  <i>my own</i>
                </button>
              )}
            </div>
          ) : (
            !lift && (
              <ChipRow label="Classic lifts">
                {STARTERS.map((e) => <button key={e.name} className="mini-btn ghost" onClick={() => pick(e)}>{e.name}</button>)}
              </ChipRow>
            )
          )}
        </div>
      )}

      {lifts.length > 0 && (
        <ChipRow label="Your lifts">
          {lifts.map((l) => (
            <button key={l.name} className={`mini-btn${l.name === lift?.name ? " on" : " ghost"}`} aria-pressed={l.name === lift?.name} onClick={() => setState((s) => ({ ...s, cur: l.name }))}>
              {l.name}
            </button>
          ))}
          {!finding && <button className="mini-btn ghost" onClick={() => setAdding(true)} aria-label="Add a lift">+</button>}
        </ChipRow>
      )}

      {lift && (
        <div className="lft-set">
          <div className="lft-entry">
            <label>
              <span>{unit}</span>
              <div>
                <button className="lft-step" onClick={() => step(setW, w, -jump)} aria-label={`Minus ${jump}`}>−</button>
                <input type="number" inputMode="decimal" min="0" step="any" value={w} onChange={(e) => setW(e.target.value)} aria-label={`Weight in ${unit}`} />
                <button className="lft-step" onClick={() => step(setW, w, jump)} aria-label={`Plus ${jump}`}>+</button>
              </div>
            </label>
            <label>
              <span>reps</span>
              <div>
                <button className="lft-step" onClick={() => step(setReps, reps, -1)} aria-label="Minus 1">−</button>
                <input type="number" inputMode="numeric" min="1" value={reps} onChange={(e) => setReps(e.target.value)} onKeyDown={(e) => e.key === "Enter" && logSet()} aria-label="Reps" />
                <button className="lft-step" onClick={() => step(setReps, reps, 1)} aria-label="Plus 1">+</button>
              </div>
            </label>
          </div>
          <button className="mini-btn lft-go" onClick={logSet} disabled={!ready}>log set</button>

          {mine.length > 0 && (
            <ol className="lft-sets" aria-label="Today's sets">
              {[...mine].reverse().map((s) => {
                const pr = rec && s.id === rec.id;
                return (
                  <li key={s.id} className={pr ? "pr" : ""}>
                    {s.reps} × {fmtW(s.w)}
                    {pr && <em title="your record">PR</em>}
                    <button className="x-btn" onClick={() => unset(s.id)} aria-label="Delete this set">✕</button>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="lft-rec">
            {rec ? `PR ${fmtW(rec.w)} ${unit} × ${rec.reps}` : "no record yet"}
            {weekVol > 0 && ` · week ${fmtVol(weekVol)} ${unit}`}
          </div>
        </div>
      )}

      {expanded && (
        <>
          {lift && (
            <div className="lft-ex">
              <span>{[...lift.muscles, ...lift.equip].join(" · ") || lift.name}</span>
              {rec && <span>est. 1RM {fmtW(Math.round(oneRep(rec)))} {unit}</span>}
              <button className="x-btn" onClick={() => drop(lift.name)} aria-label={`Take ${lift.name} off the clipboard`} title="Take it off the clipboard">✕</button>
            </div>
          )}
          <Volume weeks={weeks} unit={unit} />
          {prs.length > 0 && (
            <div className="lft-prs">
              {prs.slice(0, 12).map((r) => (
                <div key={r.ex}>
                  <span>{r.ex}</span>
                  <em>{fmtW(r.w)} {unit} × {r.reps}</em>
                </div>
              ))}
            </div>
          )}
          <Seg small label="Weight unit" value={unit} onChange={(u) => setState((s) => ({ ...s, unit: u }))} options={["lb", "kg"]} />
          <WireTag board={board} mod={mod} />
          <SendTo fold board={board} mod={mod} setState={setState} note="a new record goes there" />
          <Credit>exercises from wger.de (CC-BY-SA)</Credit>
        </>
      )}
    </div>
  );
}

// Eight weeks of total volume (sets × reps × weight) as bars; this week is the filled one
function Volume({ weeks, unit }) {
  const max = Math.max(1, ...weeks.map((w) => w.vol));
  const W = 280;
  const H = 84;
  const bw = W / weeks.length;
  return (
    <figure className="lft-chart">
      <figcaption>weekly volume ({unit})</figcaption>
      <svg viewBox={`0 0 ${W} ${H + 16}`} role="img" aria-label={`Weekly volume for the last ${weeks.length} weeks`}>
        <line x1="0" x2={W} y1={H} y2={H} stroke="#2a2520" strokeWidth="1.5" />
        {weeks.map((w, i) => {
          const h = w.vol ? Math.max(3, (w.vol / max) * (H - 14)) : 0;
          const here = i === weeks.length - 1;
          const [, m, d] = w.start.split("-");
          return (
            <g key={w.start}>
              <rect x={i * bw + 6} y={H - h} width={bw - 12} height={h} rx="2" fill={here ? "#ff5d8f" : "#ffc4d0"} stroke="#2a2520" strokeWidth={h ? 1.5 : 0}>
                <title>{`week of ${Number(m)}/${Number(d)}: ${Math.round(w.vol).toLocaleString()} ${unit} in ${w.sets} set${w.sets === 1 ? "" : "s"}`}</title>
              </rect>
              {w.vol > 0 && <text x={i * bw + bw / 2} y={H - h - 3} textAnchor="middle" fontSize="10" fill="#2a2520">{fmtVol(w.vol)}</text>}
              <text x={i * bw + bw / 2} y={H + 12} textAnchor="middle" fontSize="10" fill="#6a6260">{Number(m)}/{Number(d)}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
