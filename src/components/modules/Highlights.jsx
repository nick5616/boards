import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { dayKey } from "../../utils/date";

// Today's slip: picked the same way every time you look today
export const slipOfTheDay = (slips = [], day = dayKey()) => {
  if (!slips.length) return null;
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return slips[h % slips.length];
};

// The books on this board's shelves, so a slip can say where it came from
const shelfBooks = (board) =>
  board.modules.filter((m) => m.type === "books").flatMap((m) => (m.state.books ?? []).map((b) => ({ ...b, shelfId: m.id })));

const words = (text) => text.split(/(\s+)/);
const bare = (w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

// Torn-out quote slips in a little stack. Each can name its book and page, and
// become a flashcard: a word blanked out, or "which book is this from?".
export default function Highlights({ board, mod, setState, expanded }) {
  const { updateBoard, toast } = useData();
  const slips = mod.state.slips ?? [];
  const books = shelfBooks(board);
  const decks = board.modules.filter((m) => m.type === "flashcards");
  const [text, setText] = useState("");
  const [bookKey, setBookKey] = useState(""); // "shelfId/bookId"
  const [page, setPage] = useState("");
  const [making, setMaking] = useState(null); // slip id with the card-maker open
  const [deck, setDeck] = useState(decks[0]?.id ?? "");

  const add = () => {
    const t = text.trim();
    if (!t) return;
    const [shelfId, bookId] = bookKey.split("/");
    const b = books.find((x) => x.shelfId === shelfId && x.id === bookId);
    const slip = {
      id: uid(),
      text: t,
      ...(b && { shelfId, bookId, title: b.title, author: b.author }),
      ...(page && { page: Number(page) }),
      at: Date.now(),
    };
    setState((s) => ({ ...s, slips: [slip, ...(s.slips ?? [])] }));
    setText("");
    setPage("");
  };

  const remove = (id) => setState((s) => ({ ...s, slips: s.slips.filter((x) => x.id !== id) }));

  // Hand a card to a Flashcards module here, in its own card shape
  const makeCard = (slip, front, back) => {
    const target = decks.find((d) => d.id === deck) ?? decks[0];
    if (!target) return;
    const card = { id: uid(), front, back, box: 0, due: dayKey(), createdAt: Date.now() };
    updateBoard(board.id, (b) => ({
      ...b,
      modules: b.modules.map((m) => (m.id === target.id ? { ...m, state: { ...m.state, cards: [...(m.state.cards ?? []), card] } } : m)),
    }));
    setState((s) => ({ ...s, slips: s.slips.map((x) => (x.id === slip.id ? { ...x, carded: (x.carded ?? 0) + 1 } : x)) }));
    setMaking(null);
    toast({
      text: `a card for “${back.slice(0, 24)}” is in ${target.title}`,
      actions: [
        {
          label: "undo",
          run: () =>
            updateBoard(board.id, (b) => ({
              ...b,
              modules: b.modules.map((m) => (m.id === target.id ? { ...m, state: { ...m.state, cards: m.state.cards.filter((c) => c.id !== card.id) } } : m)),
            })),
        },
      ],
    });
  };

  return (
    <div className="hl">
      <div className="hl-add">
        <textarea
          className="hl-text"
          rows={2}
          placeholder="paste a line worth keeping…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && add()}
          aria-label="Quote"
        />
        <div className="hl-where">
          <select value={bookKey} onChange={(e) => setBookKey(e.target.value)} aria-label="Which book">
            <option value="">{books.length ? "from…" : "(no bookshelf here)"}</option>
            {books.map((b) => (
              <option key={`${b.shelfId}/${b.id}`} value={`${b.shelfId}/${b.id}`}>{b.title}</option>
            ))}
          </select>
          <input type="number" min="0" placeholder="p." value={page} onChange={(e) => setPage(e.target.value)} aria-label="Page" />
          <button className="mini-btn" onClick={add} disabled={!text.trim()}>tear out</button>
        </div>
      </div>

      {slips.length === 0 && <div className="hl-empty">no slips yet. paste a passage and tear it out.</div>}
      <div className="hl-stack">
        {slips.slice(0, expanded ? 400 : 30).map((s, i) => (
          <div key={s.id} className="hl-slip" style={{ "--r": `${((i * 37) % 7) - 3}deg`, "--seam": `${(i * 53) % 9}px` }}>
            <blockquote>{s.text}</blockquote>
            <div className="hl-cite">
              {s.title ? <>— {s.title}{s.page ? `, p.${s.page}` : ""}</> : s.page ? <>p.{s.page}</> : null}
              {s.carded > 0 && <span className="hl-carded" title="made into a flashcard">🗂</span>}
            </div>
            <div className="hl-acts">
              {decks.length > 0 && (
                <button className="mini-btn ghost" onClick={() => setMaking(making === s.id ? null : s.id)} aria-expanded={making === s.id}>
                  🗂 make a flashcard
                </button>
              )}
              <button className="x-btn" onClick={() => remove(s.id)} aria-label="Throw it away">✕</button>
            </div>
            {making === s.id && (
              <div className="hl-maker">
                {decks.length > 1 && (
                  <select value={deck} onChange={(e) => setDeck(e.target.value)} aria-label="Which deck">
                    {decks.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                )}
                <div className="hl-how">tap a word to blank it out:</div>
                <div className="hl-words">
                  {words(s.text).map((w, j) =>
                    /^\s+$/.test(w) ? (
                      w
                    ) : bare(w).length < 3 ? (
                      <span key={j}>{w}</span>
                    ) : (
                      <button
                        key={j}
                        onClick={() => makeCard(s, words(s.text).map((x, k) => (k === j ? x.replace(bare(x), "_____") : x)).join(""), bare(w))}
                      >
                        {w}
                      </button>
                    )
                  )}
                </div>
                {s.title && (
                  <button
                    className="mini-btn"
                    onClick={() => makeCard(s, `“${s.text.length > 160 ? s.text.slice(0, 157) + "…" : s.text}” — which book?`, `${s.title}${s.author ? `, ${s.author}` : ""}`)}
                  >
                    or: quote → “which book?”
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
