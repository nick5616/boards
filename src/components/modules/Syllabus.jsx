import { useState, useMemo } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { dayKey, parseDated, prettyDate, untilLabel, dayDiff, keyToDate } from "../../utils/date";
import { candidates, toToken, mentionsIn } from "../../lib/mentions";
import { dueCards } from "./Flashcards";
import AutoTA from "../AutoTA";

export const unitsDone = (state) => {
  const u = state.units ?? [];
  return { done: u.filter((x) => x.done).length, total: u.length };
};

// The next unit still to do that has a date, for the glance
export const nextDue = (state) =>
  (state.units ?? []).filter((u) => !u.done && u.due).sort((a, b) => a.due.localeCompare(b.due))[0] ?? null;

// A syllabus sheet: units to tick off, each with a due date and, if you like, links
// to the book or flashcard deck that goes with it (type @ to link, same as in notes).
export default function Syllabus({ board, mod, setState }) {
  const { boards, goTo, uid: me } = useData();
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState("");
  const [linking, setLinking] = useState(null);
  const units = mod.state.units ?? [];
  const { done, total } = unitsDone(mod.state);
  const frac = total ? done / total : 0;
  const today = dayKey();

  const parsed = parseDated(input);
  const date = parsed.date ?? picked;

  const add = () => {
    const text = (parsed.date ? parsed.text : input).trim();
    if (!text) return;
    setState((s) => ({ ...s, units: [...(s.units ?? []), { id: uid(), text, due: date || null, done: false }] }));
    setInput("");
    setPicked("");
  };
  const patch = (id, p, opts) => setState((s) => ({ ...s, units: s.units.map((u) => (u.id === id ? { ...u, ...p } : u)) }), opts);
  const remove = (id) => setState((s) => ({ ...s, units: s.units.filter((u) => u.id !== id) }));

  // Books and decks anywhere, to link a unit to
  const links = useMemo(() => candidates(boards).filter((c) => c.kind === "mod" && ["Bookshelf", "Flashcards"].includes(c.tray)), [boards]);

  // A linked deck says how many cards are waiting
  const dueFor = (text) => {
    let n = 0;
    for (const m of mentionsIn(text)) {
      const mm = boards?.find((b) => b.id === m.boardId)?.modules.find((x) => x.id === m.modId);
      if (mm?.type === "flashcards") n += dueCards(mm.state, today, me).length;
    }
    return n;
  };

  return (
    <div className="syl">
      <div className="syl-top">
        <b>{done}/{total || 0}</b> done
        <span className="syl-pct">{Math.round(frac * 100)}%</span>
      </div>
      <div className="syl-bar" role="progressbar" aria-valuenow={Math.round(frac * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Percent done">
        <span style={{ width: `${frac * 100}%` }} />
      </div>

      <ol className="syl-list">
        {units.map((u, i) => {
          const late = !u.done && u.due && u.due < today;
          const soon = !u.done && u.due && !late && dayDiff(new Date(), keyToDate(u.due)) <= 3;
          const n = dueFor(u.text);
          return (
            <li key={u.id} className={`syl-unit${u.done ? " done" : ""}`}>
              <button className="syl-box" role="checkbox" aria-checked={u.done} aria-label={`Done: ${u.text}`} onClick={() => patch(u.id, { done: !u.done })}>
                {u.done ? "✓" : ""}
              </button>
              <div className="syl-body">
                <span className="syl-num">{i + 1}.</span>
                <AutoTA rich liveId={u.id} className="syl-text" value={u.text} onChange={(v) => patch(u.id, { text: v }, { debounce: 600 })} placeholder="a chapter, a unit…" />
                {n > 0 && <button className="syl-due" onClick={() => {
                  const m = mentionsIn(u.text).find((x) => x.modId);
                  m && goTo(m.boardId, m.modId);
                }}>🗂 {n} due</button>}
              </div>
              <label className={`syl-when${late ? " late" : soon ? " soon" : ""}${u.due ? " set" : ""}`} title={u.due ? prettyDate(u.due) : "Pick a due date"}>
                {u.due ? (u.done ? prettyDate(u.due) : u.due === today ? "TODAY" : late ? `${untilLabel(u.due)}!` : untilLabel(u.due)) : "📅"}
                <input type="date" value={u.due ?? ""} onChange={(e) => patch(u.id, { due: e.target.value || null })} />
              </label>
              <button className="syl-link" onClick={() => setLinking(linking === u.id ? null : u.id)} aria-label="Link a book or deck" title="Link a book or deck">⚭</button>
              <button className="x-btn" onClick={() => remove(u.id)} aria-label="Delete unit">✕</button>
              {linking === u.id && (
                <div className="syl-pick">
                  {links.length === 0 && <span>add a bookshelf or flashcards somewhere first</span>}
                  {links.map((l) => (
                    <button
                      key={`${l.boardId}/${l.modId}`}
                      className="mini-btn ghost"
                      onClick={() => {
                        patch(u.id, { text: `${u.text} ${toToken(l)}`.trim() });
                        setLinking(null);
                      }}
                    >
                      {l.tray === "Bookshelf" ? "📖" : "🗂"} {l.title} <em>{l.where}</em>
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="syl-add">
        <input
          className="line-input"
          placeholder="“ch 3 photosynthesis, nov 12”"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          aria-label="New unit"
        />
        <label className={`tix-date${date ? " set" : ""}`} title="Pick a date">
          {date ? prettyDate(date) : "📅 due"}
          <input type="date" value={picked} onChange={(e) => setPicked(e.target.value)} />
        </label>
        {input.trim() && <button className="mini-btn" onClick={add}>add</button>}
      </div>
    </div>
  );
}
