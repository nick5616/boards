import { useState, useEffect } from "react";
import { useData } from "../../contexts/DataContext";
import { dayKey, addDays } from "../../utils/date";

const PRESETS = [5, 10, 20, 30, 45];
// Left running long past the bell, it logs what you set rather than the hours
const FORGOT_MS = 30 * 60000;

const clock = (ms) => {
  const s = Math.floor(Math.abs(ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// A tomato kitchen timer. Wind it up; stopping it puts the session on the
// sticker chart with its minutes. The start time lives in the module, so a
// running timer survives closing the tab.
export default function Timer({ board, mod, setState, entries }) {
  const { logPractice, undoLog, toast } = useData();
  const { preset = 20, startedAt = null } = mod.state;
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const elapsed = startedAt ? Math.max(0, now - startedAt) : 0;
  const left = preset * 60000 - elapsed;
  const ringing = !!startedAt && left <= 0;
  const frac = startedAt ? Math.max(0, left) / (preset * 60000) : 1;

  const start = () => setState((s) => ({ ...s, startedAt: Date.now() }));

  const stop = (log) => {
    setState((s) => ({ ...s, startedAt: null }));
    if (!log) return;
    const mins = -left > FORGOT_MS ? preset : Math.round(elapsed / 60000);
    if (mins < 1) {
      toast({ text: "under a minute, not logged" });
      return;
    }
    const entry = logPractice(board.id, `⏱ ${mins} min`, { mins });
    toast({
      text: -left > FORGOT_MS ? `forgot me? logged the ${mins} you set` : `${mins} min on the chart ✓`,
      actions: [{ label: "undo", run: () => undoLog(entry) }],
    });
  };

  const today = new Date();
  const monday = dayKey(addDays(today, -((today.getDay() + 6) % 7)));
  const weekMins = entries
    .filter((e) => e.kind === "log" && e.mins && e.day >= monday)
    .reduce((n, e) => n + e.mins, 0);

  return (
    <div className="tmr">
      <button
        className={`tmr-tomato${startedAt ? " running" : ""}${ringing ? " ringing" : ""}`}
        onClick={() => (startedAt ? stop(true) : start())}
        aria-label={startedAt ? "Stop and log" : `Start a ${preset} minute session`}
      >
        <span className="tmr-leaf" aria-hidden="true" />
        <span className="tmr-face" style={{ "--frac": frac }}>
          <span className="tmr-time">
            {startedAt ? (ringing ? `+${clock(left)}` : clock(left)) : `${preset}:00`}
          </span>
        </span>
        <span className="tmr-hint">
          {startedAt ? (ringing ? "ding! tap to log" : "tap to stop & log") : "tap to start"}
        </span>
      </button>

      {startedAt ? (
        <button className="mini-btn ghost tmr-cancel" onClick={() => stop(false)}>
          cancel, don't log
        </button>
      ) : (
        <div className="tmr-presets" role="radiogroup" aria-label="Minutes">
          {PRESETS.map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={p === preset}
              className={`tmr-preset${p === preset ? " sel" : ""}`}
              onClick={() => setState((s) => ({ ...s, preset: p }))}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <div className="tmr-week">
        <b>{weekMins}</b> min this week
      </div>
    </div>
  );
}
