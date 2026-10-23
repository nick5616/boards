import { useState, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { dayKey, keyToDate, parseDated, prettyDate, untilLabel, dayDiff } from "../../utils/date";
import { addEntry } from "../../lib/data";

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Dated things. Upcoming tickets count down; the day after, they tear off into
// the stub pile on their own. Recent stubs ask how it went.
export default function Tickets({ board, mod, setState, expanded }) {
  const { uid: userId } = useData();
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState("");
  const [showStubs, setShowStubs] = useState(false);
  const items = mod.state.items ?? [];
  const today = dayKey();

  const parsed = parseDated(input);
  const date = parsed.date ?? picked;

  const add = () => {
    const text = (parsed.date ? parsed.text : input).trim();
    if (!text || !date) return;
    setState((s) => ({ ...s, items: [...(s.items ?? []), { id: uid(), text, date, createdAt: Date.now() }] }));
    setInput("");
    setPicked("");
  };

  const patch = (id, p) => setState((s) => ({ ...s, items: s.items.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
  const remove = (id) => setState((s) => ({ ...s, items: s.items.filter((t) => t.id !== id) }));

  const reflect = (t, note) => {
    const diary = board.modules.find((m) => m.type === "diary");
    addEntry(userId, { kind: "diary", boardId: board.id, moduleId: diary?.id ?? null, text: `${t.text} — ${note}` });
    patch(t.id, { note });
  };

  const upcoming = items.filter((t) => t.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = items.filter((t) => t.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const fresh = past.filter((t) => !t.note && dayDiff(keyToDate(t.date), new Date()) <= 7);
  const stubs = past.filter((t) => !fresh.includes(t));

  return (
    <div className="tix">
      {upcoming.map((t) => (
        <Ticket key={t.id} t={t} today={today} onDate={(d) => patch(t.id, { date: d })} onRemove={() => remove(t.id)} />
      ))}

      {fresh.map((t) => (
        <div key={t.id} className="ticket stub fresh">
          <Stub t={t} onDate={(d) => patch(t.id, { date: d })} />
          <div className="ticket-main">
            <div className="ticket-text">{t.text}</div>
            <ReflectInput onSave={(n) => reflect(t, n)} />
          </div>
          <button className="x-btn" onClick={() => patch(t.id, { note: "—" })} title="Skip" aria-label="Skip">✕</button>
        </div>
      ))}

      <div className="tix-add">
        <input
          className="line-input"
          placeholder="“nov 4 concert”"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <label className={`tix-date${date ? " set" : ""}`} title="Pick a date">
          {date ? prettyDate(date) : "📅 date"}
          <input type="date" value={picked} onChange={(e) => setPicked(e.target.value)} />
        </label>
        {input.trim() && date && <button className="mini-btn" onClick={add}>add</button>}
      </div>

      {stubs.length > 0 && (
        <button className="pile-toggle" onClick={() => setShowStubs((v) => !v)}>
          {showStubs ? "▾" : "▸"} stubs ({stubs.length})
        </button>
      )}
      {showStubs &&
        stubs.slice(0, expanded ? 500 : 10).map((t) => (
          <div key={t.id} className="ticket stub">
            <Stub t={t} />
            <div className="ticket-main">
              <div className="ticket-text">{t.text}</div>
              {t.note && t.note !== "—" && <div className="ticket-note">{t.note}</div>}
            </div>
            <button className="x-btn" onClick={() => remove(t.id)} aria-label="Delete stub">✕</button>
          </div>
        ))}
    </div>
  );
}

function Stub({ t, onDate }) {
  const d = keyToDate(t.date);
  return (
    <label className="ticket-stub" title={onDate ? "Change date" : prettyDate(t.date)}>
      <span className="ticket-mon">{MON[d.getMonth()]}</span>
      <span className="ticket-day">{d.getDate()}</span>
      {onDate && <input type="date" value={t.date} onChange={(e) => e.target.value && onDate(e.target.value)} />}
    </label>
  );
}

function Ticket({ t, today, onDate, onRemove }) {
  return (
    <div className={`ticket${t.date === today ? " today" : ""}`}>
      <Stub t={t} onDate={onDate} />
      <div className="ticket-main">
        <div className="ticket-text">{t.text}</div>
        <div className="ticket-when">{t.date === today ? "TODAY!" : untilLabel(t.date)}</div>
      </div>
      <button className="x-btn" onClick={onRemove} aria-label="Delete ticket">✕</button>
    </div>
  );
}

function ReflectInput({ onSave }) {
  const [v, setV] = useState("");
  const saved = useRef(false);
  const save = () => {
    if (!v.trim() || saved.current) return;
    saved.current = true;
    onSave(v.trim());
  };
  return (
    <input
      className="line-input ticket-reflect"
      placeholder="how was it?"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && save()}
      onBlur={save}
    />
  );
}
