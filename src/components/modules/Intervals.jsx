import { useState, useEffect, useSyncExternalStore } from "react";
import { useData } from "../../contexts/DataContext";
import { useLive } from "../../contexts/LiveContext";
import { fmtClock } from "../../lib/geo";
import { caps } from "../../lib/caps";
import { planState, PRESETS, parseTime, stepsOf, totalSecs, stepAt, subscribe, coachSnap, startCoach, endCoach, logCoach, summary } from "../../lib/intervals";
import SendTo, { WireTag } from "../board/SendTo";

// What the dock shows beside the clock: the move you're on and how many are left
export function DockStep({ modId }) {
  const r = useSyncExternalStore(subscribe, coachSnap)[modId];
  const now = useNow(!!r);
  if (!r) return null;
  const at = stepAt(r.steps, (now - r.startedAt) / 1000);
  const step = r.steps[at.idx];
  return step ? <span className={`iv-dock ${step.kind}`}>{step.name} {fmtClock(Math.ceil(at.left))}</span> : null;
}

const presetOf = ({ label, ...rest }) => rest; // a preset minus its button name

const useNow = (on) => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [on]);
  return now;
};

// A time you type as 1:30, kept when you click away
function TimeField({ value, onSet, label }) {
  const [txt, setTxt] = useState(fmtClock(value));
  useEffect(() => {
    setTxt(fmtClock(value));
  }, [value]);
  return (
    <input
      className="line-input iv-time"
      value={txt}
      aria-label={label}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => {
        const s = parseTime(txt);
        if (s != null) onSet(Math.max(0, Math.min(5999, s)));
        else setTxt(fmtClock(value));
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

// A coach's clipboard. Write the plan on the paper, press the stopwatch. It speaks and beeps
// from the live dock ("walk now. 3 more to go!"), so you can leave the board and just run.
export default function Intervals({ board, mod, setState }) {
  const data = useData();
  const live = useLive();
  const plan = planState(mod.state);
  const steps = stepsOf(plan);
  const total = totalSecs(steps);
  const run = useSyncExternalStore(subscribe, coachSnap)[mod.id];
  const now = useNow(!!run);
  const [edit, setEdit] = useState(false);
  const id = `intervals:${mod.id}`;

  const set = (patch) => setState((s) => ({ ...s, ...patch }));

  const finish = () => logCoach(data, board.id, endCoach(mod.id));
  const start = () => {
    const r = startCoach(mod.id, board.id, plan, mod.state.sendTo, () => live.stop(id));
    if (!r) return;
    setEdit(false);
    live.start({
      id,
      kind: "intervals",
      boardId: board.id,
      modId: mod.id,
      icon: "📋",
      label: summary(plan),
      startedAt: r.startedAt,
      endsAt: r.startedAt + r.total * 1000,
      onStop: finish,
      render: () => <DockStep modId={mod.id} />,
    });
  };
  const cancel = () => {
    endCoach(mod.id);
    live.stop(id);
  };

  const elapsed = run ? (now - run.startedAt) / 1000 : 0;
  const at = run ? stepAt(run.steps, elapsed) : null;
  const cur = run ? run.steps[at.idx] : null;

  return (
    <div className="iv">
      <div className="iv-board">
        <span className="iv-clip" aria-hidden="true" />
        <div className="iv-paper">
          {run && cur ? (
            <div className={`iv-now ${cur.kind}`}>
              <div className="iv-what">{cur.name}</div>
              <div className="iv-count">{fmtClock(Math.ceil(at.left))}</div>
              <div className="iv-rep">
                {cur.rep ? `${cur.name} ${cur.rep} of ${cur.reps}` : cur.kind === "warm" ? "easy does it" : "wind it down"}
                {" · "}{fmtClock(Math.max(0, Math.ceil(run.total - elapsed)))} left
              </div>
            </div>
          ) : (
            <>
              <div className="iv-title">today's plan</div>
              <div className="iv-line">
                <span>warm-up</span>
                {edit ? <TimeField value={plan.warm} onSet={(v) => set({ warm: v })} label="Warm-up length" /> : <b>{fmtClock(plan.warm)}</b>}
              </div>
              <div className="iv-line">
                <span className="iv-reps">
                  {edit ? (
                    <input key={plan.reps} className="line-input iv-n" inputMode="numeric" defaultValue={plan.reps} aria-label="Repeats" onBlur={(e) => set({ reps: Math.max(1, Math.min(60, parseInt(e.target.value) || 1)) })} />
                  ) : (
                    plan.reps
                  )}
                  ×
                </span>
                <div className="iv-pair">
                  {edit ? <input key={plan.hardName} className="line-input iv-name" defaultValue={plan.hardName} aria-label="Hard move" onBlur={(e) => set({ hardName: e.target.value.trim() || "run" })} /> : <i className="hard">{plan.hardName}</i>}
                  {edit ? <TimeField value={plan.hardSecs} onSet={(v) => set({ hardSecs: Math.max(5, v) })} label="Hard length" /> : <b>{fmtClock(plan.hardSecs)}</b>}
                </div>
              </div>
              <div className="iv-line sub">
                <span>then</span>
                <div className="iv-pair">
                  {edit ? <input key={plan.easyName} className="line-input iv-name" defaultValue={plan.easyName} aria-label="Easy move" onBlur={(e) => set({ easyName: e.target.value.trim() || "walk" })} /> : <i className="easy">{plan.easyName}</i>}
                  {edit ? <TimeField value={plan.easySecs} onSet={(v) => set({ easySecs: v })} label="Easy length" /> : <b>{fmtClock(plan.easySecs)}</b>}
                </div>
              </div>
              <div className="iv-line">
                <span>cool-down</span>
                {edit ? <TimeField value={plan.cool} onSet={(v) => set({ cool: v })} label="Cool-down length" /> : <b>{fmtClock(plan.cool)}</b>}
              </div>
              <div className="iv-total">about {Math.round(total / 60)} min all told</div>
            </>
          )}
          <div className="iv-bar" aria-hidden="true">
            {(run?.steps ?? steps).map((s, i) => (
              <i key={i} className={`${s.kind}${run && i < at.idx ? " done" : ""}${run && i === at.idx ? " cur" : ""}`} style={{ flex: s.secs }} />
            ))}
          </div>
        </div>
      </div>

      <div className="iv-btns">
        <button className={`iv-watch${run ? " running" : ""}`} onClick={run ? () => live.stop(id) : start} aria-label={run ? "Stop and log" : "Start the plan"}>
          <span className="iv-crown" aria-hidden="true" />
          <span className="iv-face">{run ? "■" : "▶"}</span>
        </button>
        <div className="iv-side">
          {run ? (
            <button className="mini-btn ghost" onClick={cancel}>cancel, don't log</button>
          ) : (
            <>
              <button className="mini-btn" onClick={() => setEdit((v) => !v)}>{edit ? "done" : "✎ edit plan"}</button>
              {caps.speech && (
                <label className="iv-voice">
                  <input type="checkbox" checked={plan.voice} onChange={(e) => set({ voice: e.target.checked })} /> talk to me
                </label>
              )}
            </>
          )}
        </div>
      </div>

      {!run && edit && (
        <div className="iv-presets" role="group" aria-label="Plans to start from">
          {PRESETS.map((p) => (
            <button key={p.label} className="mini-btn ghost" onClick={() => set(presetOf(p))}>{p.label}</button>
          ))}
        </div>
      )}
      <WireTag board={board} mod={mod} />
      {!run && <SendTo fold board={board} mod={mod} setState={setState} note="the minutes go there when you finish" />}
    </div>
  );
}
