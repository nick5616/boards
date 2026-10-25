import { dayKey, lastDays, prettyDate } from "../../utils/date";
import { hash } from "../Sticker";

const MAX_GROUPS = 8;

// Five chalk strokes, the fifth across the other four. Each mark wobbles a
// little, the same way every time.
function Gate({ n, seed }) {
  const j = (i, k) => ((hash(`${seed}:${i}:${k}`) % 7) - 3) * 0.5;
  return (
    <svg className="tl-gate" viewBox="0 0 40 40" aria-hidden="true">
      {Array.from({ length: Math.min(n, 4) }, (_, i) => (
        <line key={i} x1={6 + i * 8 + j(i, 0)} y1={5 + j(i, 1)} x2={6 + i * 8 + j(i, 2)} y2={35 + j(i, 3)} />
      ))}
      {n === 5 && <line x1={1} y1={30 + j(5, 0)} x2={36} y2={10 + j(5, 1)} />}
    </svg>
  );
}

// A chalkboard for counting things that aren't practice sessions: words
// learned, waterings, conversations had. Tap the board to add a mark today.
export default function Tally({ mod, setState, expanded }) {
  const { unit = "", counts = {} } = mod.state;
  const today = dayKey();
  const n = counts[today] ?? 0;
  const days = lastDays(expanded ? 28 : 14);
  const peak = Math.max(1, ...days.map((d) => counts[d] ?? 0));
  const week = lastDays(7).reduce((t, d) => t + (counts[d] ?? 0), 0);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const bump = (by) =>
    setState((s) => {
      const c = { ...(s.counts ?? {}) };
      const v = Math.max(0, (c[today] ?? 0) + by);
      if (v) c[today] = v;
      else delete c[today];
      return { ...s, counts: c };
    });

  const groups = Math.ceil(n / 5);
  const shown = Math.min(groups, MAX_GROUPS);

  return (
    <div className="tl">
      <button className="tl-board" onClick={() => bump(1)} aria-label={`Add one ${unit}. ${n} today`}>
        {n === 0 ? (
          <span className="tl-hint">tap to make a mark</span>
        ) : (
          <span className="tl-gates">
            {Array.from({ length: shown }, (_, g) => (
              <Gate key={g} seed={`${today}${mod.id}${g}`} n={g === groups - 1 ? n - g * 5 : 5} />
            ))}
            {groups > MAX_GROUPS && <span className="tl-more">+{n - MAX_GROUPS * 5}</span>}
          </span>
        )}
      </button>
      <div className="tl-row">
        <span className="tl-today">
          <b>{n}</b> {unit || "today"}{unit && " today"}
        </span>
        {n > 0 && (
          <button className="x-btn tl-minus" onClick={() => bump(-1)} aria-label="Rub one out">
            −1
          </button>
        )}
      </div>
      <div className="tl-bars" aria-label="Last few days">
        {days.map((d) => (
          <i
            key={d}
            title={`${prettyDate(d)}: ${counts[d] ?? 0}`}
            style={{ height: `${((counts[d] ?? 0) / peak) * 100}%` }}
            className={d === today ? "today" : ""}
          />
        ))}
      </div>
      <div className="tl-sums">
        <span>{week} this week</span>
        <span>{total} all time</span>
      </div>
      {expanded && (
        <label className="tl-unit">
          counting
          <input
            className="line-input"
            defaultValue={unit}
            placeholder="words, glasses, convos…"
            onChange={(e) => setState((s) => ({ ...s, unit: e.target.value }), { debounce: 600 })}
          />
        </label>
      )}
    </div>
  );
}
