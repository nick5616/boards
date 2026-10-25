import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { dayKey, addDays, untilLabel, agoLabel } from "../../utils/date";

// Days until a card comes back, by box. Getting a card right in the last box retires it.
const STEPS = [0, 1, 3, 7, 14, 30];

export const dueCards = (state, today = dayKey()) =>
  (state.cards ?? [])
    .filter((c) => c.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due) || (a.seen ?? 0) - (b.seen ?? 0));

// "el perro = the dog", "der Hund — dog", "chat - cat"
const splitCard = (s) => {
  const m = s.match(/\s+(?:=|—|–|-)\s+|\s*=\s*/);
  if (!m) return null;
  return { front: s.slice(0, m.index).trim(), back: s.slice(m.index + m[0].length).trim() };
};

// Index cards in a little Leitner box. Tap to flip; "got it" sends the card
// further out, "again" sends it to the back of today's pile. Clearing the
// pile counts as practice.
export default function Flashcards({ board, mod, setState, expanded }) {
  const { logPractice, undoLog, toast } = useData();
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [input, setInput] = useState("");
  const [showLearned, setShowLearned] = useState(false);
  const { cards = [], learned = [] } = mod.state;
  const today = dayKey();
  const due = dueCards(mod.state, today);
  const card = due[0];
  const upcoming = cards.filter((c) => c.due > today).sort((a, b) => a.due.localeCompare(b.due))[0];

  const answer = (got) => {
    if (!card) return;
    setFlipped(false);
    const box = got ? (card.box ?? 0) + 1 : 0;
    const retire = got && box >= STEPS.length;
    setState((s) => ({
      ...s,
      cards: retire
        ? s.cards.filter((c) => c.id !== card.id)
        : s.cards.map((c) =>
            c.id === card.id ? { ...c, box, due: dayKey(addDays(new Date(), STEPS[box])), seen: Date.now() } : c
          ),
      learned: retire ? [{ ...card, learnedAt: Date.now() }, ...(s.learned ?? [])].slice(0, 500) : s.learned ?? [],
    }));
    if (retire) toast({ text: `“${card.front}” is learned for good ★` });
    const n = reviewed + 1;
    setReviewed(n);
    if (got && due.length === 1) {
      const log = logPractice(board.id, `🗂 reviewed ${n} card${n === 1 ? "" : "s"}`);
      toast({ text: "pile cleared, sticker stuck ✓", actions: [{ label: "undo", run: () => undoLog(log) }] });
      setReviewed(0);
    }
  };

  const add = () => {
    const c = splitCard(input);
    if (!c?.front || !c.back) return;
    setState((s) => ({ ...s, cards: [...(s.cards ?? []), { id: uid(), ...c, box: 0, due: today, createdAt: Date.now() }] }));
    setInput("");
  };

  const remove = (id) => setState((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== id) }));
  const unlearn = (c) =>
    setState((s) => {
      const { learnedAt, ...card } = c;
      return { ...s, cards: [...s.cards, { ...card, box: 0, due: today }], learned: s.learned.filter((x) => x.id !== c.id) };
    });

  return (
    <div className="fc">
      <div className="fc-stats">
        <span><b>{due.length}</b> due</span>
        <span>{cards.length} in the box</span>
        {learned.length > 0 && <span>★ {learned.length}</span>}
      </div>

      {card ? (
        <>
          <button
            className={`fc-card${flipped ? " flipped" : ""}`}
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? `Answer: ${card.back}` : `${card.front}. Tap to flip`}
          >
            <span className="fc-face fc-front">
              {card.front}
              <i>box {(card.box ?? 0) + 1}</i>
            </span>
            <span className="fc-face fc-back">{card.back}</span>
          </button>
          {flipped ? (
            <div className="fc-answer">
              <button className="mini-btn ghost" onClick={() => answer(false)}>↺ again</button>
              <button className="mini-btn fc-got" onClick={() => answer(true)}>✓ got it</button>
            </div>
          ) : (
            <div className="fc-tap">tap the card to flip</div>
          )}
        </>
      ) : (
        <div className="fc-clear">
          {cards.length ? (
            <>all caught up ✓<br /><span>{upcoming && `next one ${untilLabel(upcoming.due)}`}</span></>
          ) : (
            "an empty box, add a card below"
          )}
        </div>
      )}

      <input
        className="line-input fc-add"
        placeholder="el perro = the dog"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        aria-label="New card, front = back"
      />

      {expanded && cards.length > 0 && (
        <div className="fc-list">
          {[...cards].sort((a, b) => a.due.localeCompare(b.due)).map((c) => (
            <div key={c.id} className="fc-row">
              <span className="fc-row-box" title={`box ${(c.box ?? 0) + 1}`}>
                {STEPS.slice(1).map((_, i) => <i key={i} className={i < (c.box ?? 0) ? "on" : ""} />)}
              </span>
              <span className="fc-row-text">{c.front} <em>{c.back}</em></span>
              <span className="pile-when">{c.due <= today ? "due" : untilLabel(c.due)}</span>
              <button className="x-btn" onClick={() => remove(c.id)} aria-label="Delete card">✕</button>
            </div>
          ))}
        </div>
      )}

      {learned.length > 0 && (
        <button className="pile-toggle" onClick={() => setShowLearned((v) => !v)}>
          {showLearned ? "▾" : "▸"} learned ({learned.length})
        </button>
      )}
      {showLearned &&
        learned.slice(0, expanded ? 500 : 8).map((c) => (
          <div key={c.id} className="pile-row">
            <span className="pile-text">★ {c.front} · {c.back}</span>
            <span className="pile-when">{agoLabel(c.learnedAt)}</span>
            <button className="x-btn" onClick={() => unlearn(c)} title="Back in the box">↺</button>
          </div>
        ))}
    </div>
  );
}
