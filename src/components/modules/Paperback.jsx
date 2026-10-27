import { useState, useEffect, useMemo, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { dayKey } from "../../utils/date";
import { put, get as getLocal, del as delLocal } from "../../lib/localMedia";
import { sendAll } from "../../lib/readings";
import SendTo from "../board/SendTo";
import { Seg, Empty, Fold, Credit } from "./kit";
import {
  searchGutenberg, cleanText, paginate, todayPages, streakOf, addToday, daysToFinish, currentBook,
} from "../../lib/paperback";

const COVERS = ["#7a2e3b", "#2f5d62", "#b5651d", "#3d405b", "#5b7b3a", "#8c4a6b", "#264653", "#9c3d2e"];

// A public-domain paperback to read a few pages a day. The bookmark, the daily goal and
// the reading streak live in the module; the book's text, when you load it, stays in this
// browser (IndexedDB) and is never uploaded. Without the text you still track the book by
// hand with a page counter and a link to read it on Project Gutenberg.
// State: books [{ id, gid, title, author, cover (hex), page (pages finished), pages (total|null),
// textId?, read (url), status: reading|read, lastAt, startedAt?, finishedAt? }], cur (book id),
// goal (pages/day), days { day: pages }, logged { day: pages already logged }, sendTo.
export default function Paperback({ board, mod, setState, onPatch, expanded }) {
  const { logPractice, undoLog, toast, updateBoard } = useData();
  const { books = [], goal = 5, days = {}, logged = {} } = mod.state;
  const book = currentBook(mod.state);
  const [tab, setTab] = useState(books.length ? "read" : "find");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pages, setPages] = useState(null); // paginated text for the open book: string[] | null
  const [view, setView] = useState(1);
  const [paste, setPaste] = useState("");
  const fileRef = useRef(null);

  // Bring the open book's text out of IndexedDB and cut it into pages
  const textId = book?.textId;
  useEffect(() => {
    let live = true;
    setPages(null);
    if (!textId) return;
    getLocal(textId).then(async (r) => {
      if (!live) return;
      if (!r?.blob) return setPages([]);
      const p = paginate(cleanText(await r.blob.text()));
      if (live) setPages(p);
    });
    return () => { live = false; };
  }, [textId]);

  // Open on the first page not yet read
  useEffect(() => {
    if (book) setView(Math.max(1, Math.min((book.page ?? 0) + 1, pages?.length || Infinity)));
    // only when the book (or its text) changes, not on every page turn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id, pages?.length]);

  const patchBook = (id, f, extra) =>
    setState((s) => ({ ...s, ...extra, books: (s.books ?? []).map((b) => (b.id === id ? { ...b, ...f } : b)) }));

  const today = dayKey();
  const todays = todayPages(days, today);
  const unlogged = Math.max(0, todays - (logged[today] ?? 0));
  const streak = streakOf(days);

  // Writes today's unlogged pages to the board (and down any wires), with an undo
  const logNow = (b, n = unlogged) => {
    if (!b || n <= 0) return;
    const entry = logPractice(board.id, `📕 read ${n} page${n === 1 ? "" : "s"} of ${b.title}`, { pages: n });
    const sent = sendAll(updateBoard, board.id, mod.state.sendTo, { value: n, unit: "pages", label: b.title });
    setState((s) => ({ ...s, logged: { [today]: (s.logged?.[today] ?? 0) + n } }));
    toast({
      text: `+${n} page${n === 1 ? "" : "s"} logged${sent ? " · sent" : ""}`,
      actions: [{ label: "undo", run: () => { undoLog(entry); setState((s) => ({ ...s, logged: { [today]: Math.max(0, (s.logged?.[today] ?? 0) - n) } })); } }],
    });
  };

  // Move the bookmark to `page` pages finished. Going forward earns the day's pages.
  const bookmark = (b, page, earn = true) => {
    const total = b.pages || pages?.length || null;
    page = Math.max(0, total ? Math.min(total, page) : page);
    const delta = page - (b.page ?? 0);
    if (!delta) return;
    const f = { page, lastAt: Date.now() };
    if (page > 0 && !b.startedAt) f.startedAt = today;
    if (total && page >= total) Object.assign(f, { status: "read", finishedAt: today, pages: total });
    else if (b.status === "read") Object.assign(f, { status: "reading", finishedAt: null });
    if (total && !b.pages) f.pages = total;
    const nextDays = delta > 0 && earn ? addToday(days, delta, today) : days;
    patchBook(b.id, f, { days: nextDays });
    if (f.status === "read") {
      toast({ text: `finished ${b.title} ★` });
      // a finished book logs whatever's left to log
      setTimeout(() => logNow(b, Math.max(0, (nextDays[today] ?? 0) - (logged[today] ?? 0))), 0);
    } else if (delta > 0 && earn && todays < goal && (nextDays[today] ?? 0) >= goal) {
      setTimeout(() => logNow(b, (nextDays[today] ?? 0) - (logged[today] ?? 0)), 0);
    }
  };

  const turn = (dir) => {
    if (!book || !pages?.length) return;
    const to = Math.max(1, Math.min(pages.length, view + dir));
    // turning past a page finishes it
    if (dir > 0) bookmark(book, Math.max(book.page ?? 0, view));
    if (to === view && dir > 0 && view === pages.length) return;
    setView(to);
  };

  const find = async () => {
    const t = q.trim();
    if (!t) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await searchGutenberg(t);
      setHits(r);
      if (!r.length) setMsg(`no public-domain book called “${t}”`);
    } catch {
      setMsg("couldn't reach the Gutenberg catalogue; you can add a book by hand below");
    } finally {
      setBusy(false);
    }
  };

  const addBook = (h) => {
    const b = {
      id: uid(), gid: h.gid ?? null, title: h.title, author: h.author ?? "", read: h.read ?? "",
      cover: COVERS[(h.gid ?? books.length) % COVERS.length], page: 0, pages: null, status: "reading", lastAt: Date.now(),
    };
    setState((s) => ({ ...s, books: [...(s.books ?? []), b], cur: b.id }));
    if (!mod.named && !books.length) onPatch?.({ title: b.title });
    setHits(null);
    setQ("");
    setTab("read");
  };

  const loadText = async (raw) => {
    if (!book) return;
    const text = cleanText(raw);
    const p = paginate(text);
    if (p.length < 2) return setMsg("that doesn't look like a book (too short)");
    const id = await put(new Blob([text], { type: "text/plain" }), { boardId: board.id, modId: mod.id, meta: { gid: book.gid } });
    if (!id) return setMsg("couldn't save it in this browser (is storage full or blocked?)");
    if (book.textId && book.textId !== id) delLocal(book.textId);
    patchBook(book.id, { textId: id, pages: p.length });
    setPaste("");
    setMsg("");
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) loadText(await f.text());
  };

  const removeBook = (b) => {
    if (b.textId) delLocal(b.textId);
    setState((s) => ({ ...s, books: (s.books ?? []).filter((x) => x.id !== b.id), cur: s.cur === b.id ? null : s.cur }));
  };

  const goalBar = Math.min(1, todays / Math.max(1, goal));
  const left = book ? daysToFinish(book, goal) : null;
  const total = book?.pages || pages?.length || null;
  const mark = book ? Math.min((book.page ?? 0) + 1, total || Infinity) : 1;

  return (
    <div className={`pb${expanded ? " big" : ""}`}>
      {books.length > 0 && (
        <Seg label="Paperback" value={tab} onChange={setTab} options={[{ id: "read", label: "read" }, { id: "shelf", label: `shelf · ${books.length}` }, { id: "find", label: "find" }]} />
      )}

      {tab === "find" && (
        <div className="pb-find">
          <div className="pb-add">
            <input className="line-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find()} placeholder="a title or author, e.g. Frankenstein" aria-label="Find a book" />
            <button className="mini-btn" onClick={find} disabled={busy || !q.trim()}>{busy ? "…" : "find"}</button>
          </div>
          {msg && <div className="pb-msg" role="status">{msg}</div>}
          {hits?.map((h) => (
            <button key={h.gid} className="pb-hit" onClick={() => addBook(h)}>
              <span className="pb-spine" style={{ background: COVERS[h.gid % COVERS.length] }} />
              <span><b>{h.title}</b><em>{h.author || "unknown author"}</em></span>
              <u>+ read</u>
            </button>
          ))}
          <Fold label="by hand"><ByHand onAdd={addBook} /></Fold>
        </div>
      )}

      {tab === "shelf" && (
        <div className="pb-shelf">
          
          {books.map((b) => (
            <div key={b.id} className={`pb-book${book?.id === b.id ? " cur" : ""}`}>
              <button className="pb-cover" style={{ background: b.cover }} onClick={() => { setState((s) => ({ ...s, cur: b.id })); setTab("read"); }} aria-label={`Open ${b.title}`}>
                <span>{b.title}</span>
              </button>
              <div className="pb-binfo">
                <b>{b.title}</b>
                <em>{b.author}</em>
                <span>{b.status === "read" ? `finished ${b.finishedAt ?? ""}` : `p. ${b.page ?? 0}${b.pages ? ` of ${b.pages}` : ""}`}</span>
                <div className="pb-acts">
                  {b.status === "read"
                    ? <button className="tg-link" onClick={() => patchBook(b.id, { status: "reading", page: 0, finishedAt: null })}>read again</button>
                    : <button className="tg-link" onClick={() => patchBook(b.id, { status: "read", finishedAt: dayKey() })}>mark read</button>}
                  <button className="tg-link" onClick={() => removeBook(b)}>remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "read" && (
        <>
          {!book && <Empty action={<button className="mini-btn" onClick={() => setTab("find")}>find a book</button>}>Nothing on the nightstand.</Empty>}
          {book && (
            <>
              <div className="pb-title"><b>{book.title}</b><em>{book.author}</em></div>
              {textId && pages === null && <div className="pb-sub">opening the book…</div>}
              {pages?.length > 0 ? (
                <div className="pb-book-open" style={{ "--cover": book.cover }}>
                  <button className="pb-ribbon" onClick={() => setView(mark)} title={view === mark ? "your bookmark" : `jump to your bookmark (p. ${mark})`} aria-label={`Bookmark at page ${mark}`}>
                    <svg viewBox="0 0 18 60" aria-hidden="true"><path d="M2 0h14v58l-7-9-7 9z" fill={view === mark ? "#d6453d" : "#e9928c"} stroke="#2a2520" strokeWidth="1.6" strokeLinejoin="round" /></svg>
                  </button>
                  <div className="pb-page" tabIndex={0} onKeyDown={(e) => { if (e.key === "ArrowRight") turn(1); if (e.key === "ArrowLeft") turn(-1); }}>
                    <div className="pb-text">{pages[view - 1]}</div>
                    <div className="pb-num">{view} / {pages.length}</div>
                    <button className="pb-tap l" onClick={() => turn(-1)} aria-label="Previous page" disabled={view <= 1} />
                    <button className="pb-tap r" onClick={() => turn(1)} aria-label={view === pages.length ? "Finish the book" : "Next page"} />
                  </div>
                  <div className="pb-turn">
                    <button className="mini-btn ghost" onClick={() => turn(-1)} disabled={view <= 1}>‹ back</button>
                    <button className="mini-btn" onClick={() => turn(1)}>{view === pages.length ? "finish ★" : "turn the page ›"}</button>
                  </div>
                </div>
              ) : (
                <Manual
                  book={book}
                  hasText={!!textId}
                  onSet={(p, earn) => bookmark(book, p, earn)}
                  onTotal={(n) => patchBook(book.id, { pages: n })}
                  onFile={() => fileRef.current?.click()}
                  paste={paste}
                  setPaste={setPaste}
                  onPaste={() => loadText(paste)}
                  msg={msg}
                />
              )}
              <input ref={fileRef} type="file" accept=".txt,text/plain" hidden onChange={onFile} />

              <div className="pb-goal">
                <div className="pb-gline">
                  <span><b>{todays}</b> / {goal} pages today</span>
                  <span className="pb-streak" title="days in a row with at least a page">{streak > 0 ? `🔥 ${streak}` : ""}</span>
                  {unlogged > 0 && <button className="mini-btn" onClick={() => logNow(book)}>log {unlogged}</button>}
                </div>
                <div className="pb-meter"><u style={{ width: `${goalBar * 100}%` }} /></div>
                <Fold label="goal">
                  <div className="pb-gline small">
                    <span>
                      pages a day
                      <button className="pb-step" onClick={() => setState((s) => ({ ...s, goal: Math.max(1, goal - 1) }))} aria-label="Fewer pages a day">−</button>
                      {goal}
                      <button className="pb-step" onClick={() => setState((s) => ({ ...s, goal: goal + 1 }))} aria-label="More pages a day">+</button>
                    </span>
                    {left != null && <span>{left === 0 ? "last page!" : `about ${left} day${left === 1 ? "" : "s"} to finish`}</span>}
                  </div>
                  <SendTo board={board} mod={mod} setState={setState} note="pages you log go there" />
                </Fold>
              </div>
            </>
          )}
        </>
      )}
      <Credit>Project Gutenberg · Gutendex</Credit>
    </div>
  );
}

function ByHand({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", author: "" });
  if (!open) return <button className="mini-btn ghost" onClick={() => setOpen(true)}>+ add a book by hand</button>;
  return (
    <div className="pb-hand">
      <input className="line-input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="title" aria-label="Book title" />
      <input className="line-input" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} placeholder="author" aria-label="Author" />
      <button className="mini-btn" disabled={!f.title.trim()} onClick={() => { onAdd({ title: f.title.trim(), author: f.author.trim() }); setOpen(false); setF({ title: "", author: "" }); }}>add</button>
    </div>
  );
}

// No text loaded: a page counter, plus ways to get the text in
function Manual({ book, hasText, onSet, onTotal, onFile, paste, setPaste, onPaste, msg }) {
  const [showPaste, setShowPaste] = useState(false);
  const page = book.page ?? 0;
  const read = book.read || (book.gid ? `https://www.gutenberg.org/ebooks/${book.gid}` : "");
  const txt = book.gid ? `https://www.gutenberg.org/ebooks/${book.gid}.txt.utf-8` : "";
  return (
    <div className="pb-manual">
      <div className="pb-count">
        <button className="pb-step big" onClick={() => onSet(page - 1)} aria-label="Back a page">−</button>
        <label>
          <span>page</span>
          <input className="line-input" inputMode="numeric" value={page} onChange={(e) => onSet(Number(e.target.value.replace(/\D/g, "")) || 0, false)} aria-label="Page you're on" />
          <span>of</span>
          <input className="line-input" inputMode="numeric" value={book.pages ?? ""} placeholder="?" onChange={(e) => onTotal(Number(e.target.value.replace(/\D/g, "")) || null)} aria-label="Total pages" />
        </label>
        <button className="pb-step big" onClick={() => onSet(page + 1)} aria-label="Forward a page">+</button>
      </div>
      <div className="pb-quick">
        {[5, 10, 20].map((n) => <button key={n} className="mini-btn ghost" onClick={() => onSet(page + n)}>+{n}</button>)}
      </div>
      {!hasText && (
        <div className="pb-how">
          <span className="pb-hrow">
            <button className="mini-btn" onClick={onFile}>load the text</button>
            <button className="mini-btn ghost" onClick={() => setShowPaste(!showPaste)}>paste it</button>
            {read && <a href={read} target="_blank" rel="noreferrer">read on Gutenberg ↗</a>}
          </span>
          {showPaste && (
            <>
              <textarea className="pb-paste" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="paste the whole book here" aria-label="Book text" rows={4} />
              <button className="mini-btn" disabled={paste.length < 500} onClick={onPaste}>use this text</button>
            </>
          )}
          <Fold label="how">
            Gutenberg won't let a web page fetch its books, so save the plain text{txt && <> (<a href={txt} target="_blank" rel="noreferrer">get it ↗</a>)</>} and load it here. It stays on this computer; you get paged text with a ribbon bookmark.
          </Fold>
          {msg && <div className="pb-msg">{msg}</div>}
        </div>
      )}
      {hasText && <div className="pb-how">the saved text couldn't be opened; choose the file again. <button className="mini-btn" onClick={onFile}>choose the .txt file</button></div>}
    </div>
  );
}
