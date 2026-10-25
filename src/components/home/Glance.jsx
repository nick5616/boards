import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { STATUSES } from "../../constants/modules";
import { lastDays, dayKey, agoLabel, dayDiff } from "../../utils/date";
import { hslStr, inkColor } from "../../utils/color";
import IconChip from "../IconChip";
import Sticker from "../Sticker";
import { boardFacts } from "./boardFacts";

const STALE_DAYS = 7;

// Rows grouped by status: what you're doing now, with the last two weeks as dots
export default function Glance({ boards, logs, onOpen, onStatus, onNew, searching }) {
  const [open, setOpen] = useLocalStorage("myboards-glance-open", { paused: true });
  const days = lastDays(14);
  const logDays = {};
  logs.forEach((e) => e.kind === "log" && ((logDays[e.boardId] ??= new Set()).add(e.day)));

  return (
    <div className="glance">
      {STATUSES.map((s) => {
        const group = boards.filter((b) => (b.status ?? "someday") === s.id);
        const isNow = s.id === "active";
        if (!isNow && group.length === 0) return null;
        const shown = isNow || open[s.id] || searching;
        return (
          <section key={s.id} className={`gl-sec gl-${s.id}`}>
            {isNow ? (
              <div className="section-label gl-label">{s.label}</div>
            ) : (
              <button className="section-label gl-label gl-toggle" onClick={() => setOpen({ ...open, [s.id]: !open[s.id] })}>
                {shown ? "▾" : "▸"} {s.label} <span className="gl-n">{group.length}</span>
              </button>
            )}

            {isNow && group.length === 0 && !searching && (
              <div className="gl-empty">
                <div className="gl-empty-q">What are you working on?</div>
                <div className="gl-chips">
                  {boards.filter((b) => b.status !== "done").map((b) => (
                    <button key={b.id} className="gl-chip" onClick={() => onStatus(b.id, "active")}>
                      + {b.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {shown && group.map((b) => (
              <Row
                key={b.id}
                board={b}
                days={days}
                logged={logDays[b.id]}
                onOpen={() => onOpen(b)}
                onNow={isNow ? null : () => onStatus(b.id, "active")}
              />
            ))}

            {isNow && group.length > 0 && !searching && (
              <OpenSpot boards={boards} onStatus={onStatus} onNew={onNew} />
            )}
          </section>
        );
      })}
    </div>
  );
}

// The empty spot after what you're doing now: pull a paused or someday board
// in, or start a new one
function OpenSpot({ boards, onStatus, onNew }) {
  const [open, setOpen] = useState(false);
  const waiting = boards.filter((b) => b.status === "paused" || b.status === "someday");

  if (!open) {
    return (
      <button className="gl-spot" onClick={() => (waiting.length ? setOpen(true) : onNew())}>
        + something else going on?
      </button>
    );
  }
  return (
    <div className="gl-spot open">
      <div className="gl-chips">
        {waiting.map((b) => (
          <button key={b.id} className="gl-chip" onClick={() => { onStatus(b.id, "active"); setOpen(false); }}>
            + {b.title}
          </button>
        ))}
        <button className="gl-chip gl-chip-new" onClick={onNew}>✦ new board</button>
      </div>
      <button className="x-btn" onClick={() => setOpen(false)} aria-label="Close">✕</button>
    </div>
  );
}

function Row({ board, days, logged, onOpen, onNow }) {
  const { quickLog } = useData();
  const { next, ticket, status } = boardFacts(board);
  const today = dayKey();
  const doneToday = logged?.has(today);
  const ink = inkColor(board.color);
  const stale = !onNow && (!board.lastLoggedAt || dayDiff(board.lastLoggedAt, new Date()) >= STALE_DAYS);

  return (
    <div
      className={`gl-row${stale ? " stale" : ""}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      style={{ "--bc": hslStr(board.color.h, board.color.s, board.color.l), "--ink": ink }}
    >
      <IconChip board={board} size={42} />
      <div className="gl-main">
        <div className="gl-title">{board.title}</div>
        <div className="gl-dots" aria-label={`${logged?.size ?? 0} of the last 14 days`}>
          {days.map((d) => (
            <i key={d} className={`${logged?.has(d) ? "on" : ""}${d === today ? " today" : ""}`} />
          ))}
        </div>
        {next && <div className="gl-next"><span>next</span> {next}</div>}
        {ticket && <div className="gl-ticket">{ticket}</div>}
        {status && <div className="gl-ticket">{status}</div>}
      </div>
      <div className="gl-side">
        <div className="gl-ago">{agoLabel(board.lastLoggedAt) ?? "—"}</div>
        {onNow ? (
          <button className="mini-btn gl-now" onClick={(e) => { e.stopPropagation(); onNow(); }}>→ now</button>
        ) : (
          <button
            className={`gl-log${doneToday ? " done" : ""}`}
            onClick={(e) => { e.stopPropagation(); quickLog(board.id); }}
            aria-label={`Log practice for ${board.title}`}
            title="I practiced!"
          >
            {doneToday ? <Sticker seed={today + board.id} size={26} /> : "✓"}
          </button>
        )}
      </div>
    </div>
  );
}
