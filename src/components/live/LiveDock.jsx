import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLive } from "../../contexts/LiveContext";
import { hasGesture } from "../../lib/audio";

const clock = (ms) => {
  const s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${m}:${String(s % 60).padStart(2, "0")}`;
};

// A little shelf of "now playing" tickets for whatever is running, kept on screen
// while you wander off to other boards. Pop it out and it floats over other apps.
export default function LiveDock({ boards }) {
  const { sessions, reminders = [], stop, popOut, poppedOut, pipWindow, openBoard } = useLive();
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!sessions.length) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sessions.length]);

  if (!sessions.length && !reminders.length) return null;

  const dock = (
    <div className={`live-dock${poppedOut ? " popped" : ""}`} role="region" aria-label="Running now">
      {sessions.map((s) => {
        const board = boards?.find((b) => b.id === s.boardId);
        const over = s.endsAt && now >= s.endsAt;
        const time = s.endsAt ? (over ? `+${clock(now - s.endsAt)}` : clock(s.endsAt - now)) : clock(now - s.startedAt);
        return (
          <div key={s.id} className={`live-tick${over ? " ringing" : ""}`}>
            <button
              className="live-go"
              onClick={() => {
                openBoard?.(s.boardId);
                window.opener?.focus?.();
              }}
              title={board ? `Open ${board.title}` : "Open board"}
            >
              <span className="live-icon" aria-hidden="true">{s.icon ?? "●"}</span>
              <span className="live-text">
                <span className="live-time">{time}</span>
                <span className="live-name">
                  {s.needsSound && !hasGesture() ? "tap to resume sound" : s.label}
                  {s.sub ? ` · ${s.sub}` : board ? ` · ${board.title}` : ""}
                </span>
              </span>
              {s.render?.()}
            </button>
            {s.act && <button className="live-act" onClick={s.act.run}>{s.act.label}</button>}
            <button className="live-stop" onClick={() => stop(s.id)} aria-label={`Stop ${s.label} and log`} title="Stop & log">
              ■
            </button>
          </div>
        );
      })}
      {reminders.map((r) => {
        const board = boards?.find((b) => b.id === r.boardId);
        return (
          <div key={r.id} className="live-tick live-due">
            <button
              className="live-go"
              onClick={() => {
                openBoard?.(r.boardId);
                window.opener?.focus?.();
              }}
              title={board ? `Open ${board.title}` : "Open board"}
            >
              <span className="live-icon" aria-hidden="true">{r.icon}</span>
              <span className="live-text">
                <span className="live-time">{r.label}</span>
                <span className="live-name">due since {r.sub}{board ? ` · ${board.title}` : ""}</span>
              </span>
            </button>
            {r.actions.map((a) => (
              <button key={a.label} className="live-act" onClick={a.run}>{a.label}</button>
            ))}
          </div>
        );
      })}
      {popOut && (
        <button className="live-pop" onClick={popOut} aria-label={poppedOut ? "Bring the dock back" : "Pop out"} title={poppedOut ? "Bring back" : "Pop out"}>
          {poppedOut ? "↙" : "↗"}
        </button>
      )}
    </div>
  );

  // Popped out: the dock lives in the floating window; the page keeps nothing
  return pipWindow ? createPortal(dock, pipWindow.document.body) : dock;
}
