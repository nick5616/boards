import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { dayKey, addDays, keyToDate, prettyDate, agoLabel } from "../../utils/date";

const SIZES = [5, 8, 10, 12, 15, 20];

// A coffee-shop loyalty card. Every day you practice punches a hole on its
// own; a full card gets cashed in for the treat written on it, and a fresh
// card starts the next day.
export default function PunchCard({ board, mod, setState, entries, expanded }) {
  const { quickLog } = useData();
  const [showOld, setShowOld] = useState(false);
  const { size = 10, reward = "", startedAt = 0, cards = [] } = mod.state;
  const today = dayKey();

  const days = [...new Set(entries.filter((e) => e.kind === "log" && e.at >= startedAt).map((e) => e.day))]
    .sort()
    .slice(0, size);
  const full = days.length >= size;
  const punchedToday = days.includes(today);

  const cashIn = () =>
    setState((s) => ({
      ...s,
      // Days punched past this card's last hole count toward the next one
      startedAt: addDays(keyToDate(days[days.length - 1]), 1).getTime(),
      cards: [
        { id: uid(), reward: s.reward, size: s.size, startedAt: s.startedAt, doneAt: Date.now() },
        ...(s.cards ?? []),
      ].slice(0, 100),
    }));

  return (
    <div className="pc">
      <div className={`pc-card${full ? " full" : ""}`}>
        <div className="pc-head">
          <span className="pc-club">{board.title} club</span>
          <span className="pc-count">{days.length}/{size}</span>
        </div>
        <div className="pc-holes" style={{ "--cols": size <= 10 ? 5 : Math.ceil(size / 2) }}>
          {Array.from({ length: size }, (_, i) => {
            const day = days[i];
            const next = i === days.length && !punchedToday && !full;
            return (
              <button
                key={i}
                className={`pc-hole${day ? " punched" : ""}${next ? " next" : ""}`}
                onClick={() => next && quickLog(board.id)}
                tabIndex={next ? 0 : -1}
                title={day ? prettyDate(day) : next ? "Practiced today? Punch it" : ""}
                aria-label={day ? `Punched ${prettyDate(day)}` : next ? "Punch for today" : "Empty"}
              />
            );
          })}
        </div>
        <div className="pc-dates" aria-hidden="true">
          {days.length > 0 && <span>since {prettyDate(days[0]).slice(4)}</span>}
          {punchedToday && <span>today ✓</span>}
        </div>
        <input
          className="pc-reward"
          placeholder="full card gets me…"
          value={reward}
          onChange={(e) => setState((s) => ({ ...s, reward: e.target.value }), { debounce: 600 })}
          aria-label="Reward"
        />
      </div>

      {full && (
        <button className="mini-btn pc-cash" onClick={cashIn}>
          🎉 cash it in{reward ? `: ${reward}` : ""}
        </button>
      )}

      {expanded && (
        <div className="pc-sizes">
          <span>holes</span>
          {SIZES.map((n) => (
            <button
              key={n}
              className={`tmr-preset${n === size ? " sel" : ""}`}
              onClick={() => setState((s) => ({ ...s, size: n }))}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {cards.length > 0 && (
        <button className="pile-toggle" onClick={() => setShowOld((v) => !v)}>
          {showOld ? "▾" : "▸"} cashed in ({cards.length})
        </button>
      )}
      {showOld &&
        cards.slice(0, expanded ? 100 : 6).map((c) => (
          <div key={c.id} className="pile-row">
            <span className="pile-text">✓ {c.reward || `${c.size} days`}</span>
            <span className="pile-when">{agoLabel(c.doneAt)}</span>
          </div>
        ))}
    </div>
  );
}
