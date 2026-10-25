import { useState, useEffect } from "react";
import { useLive } from "../../contexts/LiveContext";
import { dayKey, addDays } from "../../utils/date";
import SendTo, { WireTag } from "../board/SendTo";

const PRESETS = [5, 10, 20, 30, 45];
const clock = (ms) => {
  const s = Math.floor(Math.abs(ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// A tomato kitchen timer. Wind it up; stopping it puts the session on the
// sticker chart with its minutes. The start time lives in the module, so a
// running timer survives closing the tab (and rings from the dock if you leave).
export default function Timer({ board, mod, setState, entries }) {
  const live = useLive();
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

  // Start and stop go through the dock so a running timer follows you around
  const start = () => live.start({ kind: "timer", boardId: board.id, modId: mod.id });
  const stop = (log) => live.stop(`timer:${mod.id}`, { log });

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
      <WireTag board={board} mod={mod} />
      {!startedAt && <SendTo fold board={board} mod={mod} setState={setState} note="the minutes go there when you log" />}
    </div>
  );
}
