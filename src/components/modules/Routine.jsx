import { useEffect, useRef, useState } from "react";
import { useData } from "../../contexts/DataContext";
import { modulesIn } from "../board/spaces";
import { agoLabel } from "../../utils/date";
import { useContainer, Page } from "./containerKit";

// A practice routine on a clipboard: the steps are the tabs, in order.
// "Start routine" opens step one. A step ticks itself off when a practice log lands
// from any module inside it (the timer, the metronome…), or when you tap its box;
// then the next step opens. Finishing them all puts one line on the sticker chart.
// "🧾 routine: step 2 of 3" on the home glance while one is under way
export const routineSays = (mods) => {
  const m = mods.find((x) => x.state.run);
  if (!m) return null;
  const done = m.state.tabs.filter((t) => m.state.run.done?.[t.id]).length;
  return `🧾 routine: step ${Math.min(done + 1, m.state.tabs.length)} of ${m.state.tabs.length}`;
};

export default function Routine({ board, mod, entries, setState }) {
  const { logPractice, undoLog, toast } = useData();
  const c = useContainer(mod, setState);
  const { run, lastDone } = mod.state;
  const steps = c.tabs;
  const doneOf = (id) => run?.done?.[id];
  const cur = run ? steps.find((s) => !doneOf(s.id)) : null;
  const doneN = run ? steps.filter((s) => doneOf(s.id)).length : 0;
  const [stamp, setStamp] = useState(false); // the "DONE" stamp, for the moment after finishing here
  const finishing = useRef(null);

  // Ticks a step off and opens the next one. Safe to call twice: a step only completes once.
  const finishStep = (step, mins, how) =>
    setState((s) => {
      if (!s.run || s.run.done[step.id]) return s;
      const done = { ...s.run.done, [step.id]: { at: Date.now(), mins, how } };
      const next = s.tabs.find((t) => !done[t.id]);
      return { ...s, run: { ...s.run, done, stepAt: Date.now() }, active: next?.id ?? s.active };
    });

  // Practice logged from something inside the current step counts as doing the step
  const logged = (stepId, since) => {
    const mine = new Set(modulesIn(board, { parent: mod.id, tab: stepId }).map((m) => m.id));
    return (entries ?? []).filter((e) => e.kind === "log" && mine.has(e.moduleId) && e.at >= since);
  };
  const hits = run && cur ? logged(cur.id, run.stepAt) : [];
  const hitMins = hits.reduce((t, e) => t + (e.mins ?? 0), 0);
  useEffect(() => {
    if (cur && hits.length) finishStep(cur, hitMins, "log");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits.length, cur?.id, run?.stepAt]);

  // Every step done: one line for the whole routine, and the clipboard clears for next time
  useEffect(() => {
    if (!run || cur || !steps.length || finishing.current === run.startedAt) return;
    finishing.current = run.startedAt;
    const mins = steps.reduce((t, s) => t + (doneOf(s.id)?.mins ?? 0), 0);
    const entry = logPractice(board.id, mins ? `🧾 routine done — ${mins} min` : `🧾 routine done — ${steps.length} steps`, { moduleId: mod.id });
    setState((s) => (s.run ? { ...s, run: null, lastDone: { at: Date.now(), mins } } : s));
    setStamp(true);
    setTimeout(() => setStamp(false), 6000);
    toast({ text: `routine done${mins ? ` — ${mins} min` : ""} ✓`, actions: [{ label: "undo", run: () => undoLog(entry) }] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, cur]);

  const start = () => {
    if (!steps.length) return;
    const now = Date.now();
    setState((s) => ({ ...s, run: { startedAt: now, stepAt: now, done: {} }, active: s.tabs[0].id }));
  };
  const tick = (step) => {
    if (!run) return;
    if (doneOf(step.id)) {
      // un-tick: put the step back in play
      setState((s) => {
        const { [step.id]: _gone, ...done } = s.run.done;
        return { ...s, run: { ...s.run, done, stepAt: Date.now() }, active: step.id };
      });
    } else finishStep(step, logged(step.id, run.stepAt).reduce((t, e) => t + (e.mins ?? 0), 0), "tap");
  };

  const open = steps.find((s) => s.id === c.active) ?? steps[0];
  const pct = run ? Math.round((doneN / steps.length) * 100) : lastDone ? 100 : 0;

  return (
    <div className="rt">
      <div className="rt-clip" aria-hidden="true"><i /></div>
      <div className="rt-paper">
        <div className="rt-head">
          <b>{run ? `Step ${Math.min(doneN + 1, steps.length)} of ${steps.length}` : "Today's routine"}</b>
          <span className="rt-pct">{run ? `${doneN} done` : lastDone ? `last: ${lastDone.mins ? `${lastDone.mins} min` : "done"} · ${agoLabel(lastDone.at)}` : `${steps.length} steps`}</span>
        </div>
        <div className="rt-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <ol className="rt-steps">
          {steps.map((s, i) => {
            const d = doneOf(s.id);
            const now = cur?.id === s.id;
            return (
              <li key={s.id} className={`${d ? "done" : ""}${now ? " now" : ""}${s.id === open?.id ? " open" : ""}`} onContextMenu={(e) => c.openMenu(s, e)}>
                <button
                  className="rt-box"
                  onClick={() => tick(s)}
                  disabled={!run}
                  aria-label={d ? `${s.name}: done (tap to undo)` : `Mark ${s.name} done`}
                  title={run ? (d ? "Done — tap to undo" : "Tap when it's done") : "Start the routine to tick things off"}
                >
                  {d ? "✓" : ""}
                </button>
                <button className="rt-name" onClick={() => c.select(s.id)} title="Look at this step">
                  <em>{i + 1} ·</em> {s.name}
                </button>
                <span className="rt-note">{d ? (d.mins ? `${d.mins} min` : d.how === "tap" ? "ticked" : "") : now ? "← you are here" : ""}</span>
                <button className="rt-more" onClick={(e) => c.openMenu(s, e)} aria-label={`${s.name} options`}>⋯</button>
              </li>
            );
          })}
        </ol>
        <div className="rt-acts">
          {!run ? (
            <button className="rt-go" onClick={start}>▶ Start routine</button>
          ) : (
            <>
              <button className="rt-go" onClick={() => cur && finishStep(cur, hitMins, "tap")} disabled={!cur}>✓ Done with this step</button>
              <button className="rt-quiet" onClick={() => confirm("Put the routine away? What you ticked is forgotten.") && setState((s) => ({ ...s, run: null }))}>stop</button>
            </>
          )}
          <button className="rt-quiet" onClick={() => c.add(`Step ${steps.length + 1}`)}>＋ step</button>
        </div>
        {stamp && <div className="rt-stamp" aria-hidden="true">DONE</div>}
        {open && (
          <div className="rt-sheet">
            <div className="rt-sheet-bar">
              <span>{open.name}</span>
              {c.count(open) !== null && <button onClick={() => c.addHere(open.id)}>+ add</button>}
            </div>
            <Page mod={mod} tab={open.id} />
          </div>
        )}
      </div>
      {c.menuNode}
    </div>
  );
}
