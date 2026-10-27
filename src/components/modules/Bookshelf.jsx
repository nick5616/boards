import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { dayKey, prettyDate } from "../../utils/date";
import { searchBooks, bookByIsbn, asIsbn, canScan, coverUrl, spineSize, pct, SPINES } from "../../lib/books";
import { sendAll } from "../../lib/readings";
import SendTo, { WireTag } from "../board/SendTo";

const STATUS = [
  ["want", "want to read"],
  ["reading", "reading"],
  ["read", "read"],
];
const pick = (n) => SPINES[Math.abs(n) % SPINES.length];

// Shelf rows by how wide the spines are, so each row gets its own plank
function rows(books, room) {
  const out = [[]];
  let used = 0;
  for (const b of books) {
    const w = spineSize(b).w + 3;
    if (used + w > room && out.at(-1).length) {
      out.push([]);
      used = 0;
    }
    out.at(-1).push(b);
    used += w;
  }
  return out;
}

// A wooden shelf of book spines. Fatter books have more pages; a ribbon in the
// open one marks how far you are. Moving the bookmark logs the pages you read.
export default function Bookshelf({ board, mod, setState, expanded }) {
  const { logPractice, undoLog, toast, updateBoard } = useData();
  const books = mod.state.books ?? [];
  const [openId, setOpenId] = useState(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState(null); // null = not searched, [] = nothing
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const open = books.find((b) => b.id === openId);

  const patch = (id, p) => setState((s) => ({ ...s, books: s.books.map((b) => (b.id === id ? { ...b, ...p } : b)) }));

  const add = (info, extra = {}) => {
    const b = {
      id: uid(),
      title: info.title,
      author: info.author ?? "",
      pages: info.pages ?? null,
      page: 0,
      status: "want",
      color: pick((info.title?.length ?? 0) * 7 + (info.pages ?? 0)),
      coverId: info.coverId ?? null,
      isbn: info.isbn ?? null,
      at: Date.now(),
      ...extra,
    };
    setState((s) => ({ ...s, books: [...(s.books ?? []), b] }));
    setQ("");
    setFound(null);
    setOpenId(b.id);
  };

  const search = async () => {
    const text = q.trim();
    if (!text) return;
    setBusy(true);
    try {
      const isbn = asIsbn(text);
      if (isbn) {
        const b = await bookByIsbn(isbn);
        b ? add(b) : setFound([]);
      } else setFound(await searchBooks(text));
    } catch {
      setFound([]);
      toast({ text: "couldn't reach the library, add it by hand?" });
    }
    setBusy(false);
  };

  const byHand = () => {
    if (q.trim()) add({ title: q.trim() });
  };

  // Moving the bookmark: the pages read since last time are the practice
  const bookmark = (b, page) => {
    page = Math.max(0, b.pages ? Math.min(b.pages, page) : page);
    const delta = page - (b.page ?? 0);
    const p = { page };
    if (page > 0 && b.status === "want") Object.assign(p, { status: "reading", startedAt: dayKey() });
    if (b.pages && page >= b.pages) Object.assign(p, { status: "read", finishedAt: dayKey(), startedAt: b.startedAt ?? dayKey() });
    patch(b.id, p);
    if (delta <= 0) return;
    const entry = logPractice(board.id, `📖 read ${delta} page${delta === 1 ? "" : "s"} of ${b.title}`, { pages: delta });
    const sent = sendAll(updateBoard, board.id, mod.state.sendTo, { value: delta, unit: "pages", label: b.title });
    toast({
      text: p.status === "read" && b.status !== "read" ? `finished ${b.title} ★` : `+${delta} page${delta === 1 ? "" : "s"}${sent ? " · sent" : ""}`,
      actions: [{ label: "undo", run: () => { undoLog(entry); patch(b.id, { page: b.page ?? 0, status: b.status, finishedAt: b.finishedAt ?? null }); } }],
    });
  };

  const remove = (id) => {
    setState((s) => ({ ...s, books: s.books.filter((b) => b.id !== id) }));
    setOpenId(null);
  };

  const shelves = rows(books, expanded ? 520 : 262);
  const reading = books.filter((b) => b.status === "reading").length;

  return (
    <div className="bks">
      <div className="bks-add">
        <input
          className="line-input"
          placeholder="title, author or ISBN"
          value={q}
          onChange={(e) => (setQ(e.target.value), setFound(null))}
          onKeyDown={(e) => e.key === "Enter" && search()}
          aria-label="Find a book"
        />
        {q.trim() && <button className="mini-btn" onClick={search} disabled={busy}>{busy ? "…" : "find"}</button>}
        {canScan() && (
          <button className="mini-btn bks-scan" onClick={() => setScanning(true)} title="Scan a barcode with the camera" aria-label="Scan a barcode">
            ▮▯▮ scan
          </button>
        )}
      </div>

      {found && (
        <div className="bks-found">
          {found.map((f, i) => (
            <button key={i} className="bks-hit" onClick={() => add(f)}>
              <Cover info={f} />
              <span>
                <b>{f.title}</b>
                <i>{[f.author, f.pages && `${f.pages}p`, f.year].filter(Boolean).join(" · ")}</i>
              </span>
            </button>
          ))}
          <button className="bks-hit hand" onClick={byHand}>
            <span><b>+ add “{q.trim()}” by hand</b><i>{found.length ? "none of these" : "nothing came up"}</i></span>
          </button>
        </div>
      )}

      {scanning && <Scanner onClose={() => setScanning(false)} onCode={async (code) => {
        setScanning(false);
        setBusy(true);
        try {
          const b = await bookByIsbn(code);
          b ? add(b) : (setQ(code), toast({ text: "that barcode isn't in the library, try the title?" }));
        } catch {
          setQ(code);
          toast({ text: "couldn't reach the library" });
        }
        setBusy(false);
      }} />}

      <div className="bks-case" aria-label="Bookshelf">
        {books.length === 0 && <div className="bks-empty">an empty shelf. what are you reading?</div>}
        {shelves.map((row, i) => (
          <div key={i} className="bks-row">
            {row.map((b) => {
              const { w, h } = spineSize(b);
              return (
                <button
                  key={b.id}
                  className={`bks-spine st-${b.status}${b.id === openId ? " out" : ""}`}
                  style={{ width: w, height: h, "--c": b.color }}
                  onClick={() => setOpenId(b.id === openId ? null : b.id)}
                  title={`${b.title}${b.author ? ` · ${b.author}` : ""}`}
                  aria-label={`${b.title}, ${b.status}`}
                >
                  <span className="bks-title">{b.title}</span>
                  {b.status === "reading" && <span className="bks-ribbon" style={{ height: 14 + pct(b) * 0.18 }} />}
                  {b.status === "read" && <span className="bks-star">★</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {open && <Detail book={open} patch={(p) => patch(open.id, p)} bookmark={(pg) => bookmark(open, pg)} remove={() => remove(open.id)} />}

      {books.length > 0 && !open && (
        <div className="bks-count">
          {books.length} book{books.length === 1 ? "" : "s"}{reading ? ` · ${reading} on the go` : ""}
        </div>
      )}
      <WireTag board={board} mod={mod} />
      <SendTo fold board={board} mod={mod} setState={setState} note="the pages you read go there" />
    </div>
  );
}

// A small cover if Open Library has one; if it doesn't (or we're offline) nothing shows
function Cover({ info }) {
  const [bad, setBad] = useState(false);
  const url = coverUrl(info.coverId);
  if (!url || bad) return <span className="bks-nocover" aria-hidden="true" />;
  return <img className="bks-cover" src={url} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBad(true)} />;
}

function Detail({ book: b, patch, bookmark, remove }) {
  const [draft, setDraft] = useState(String(b.page ?? 0));
  useEffect(() => setDraft(String(b.page ?? 0)), [b.id, b.page]);
  const left = b.pages ? b.pages - (b.page ?? 0) : null;
  const go = (n) => Number.isFinite(n) && bookmark(Math.round(n));

  return (
    <div className="bks-open" style={{ "--c": b.color }}>
      <div className="bks-head">
        <Cover info={b} />
        <div className="bks-who">
          <b>{b.title}</b>
          <i>{b.author || "unknown author"}</i>
        </div>
        <button className="x-btn" onClick={remove} aria-label="Take it off the shelf" title="Take it off the shelf">✕</button>
      </div>

      <div className="bks-status" role="radiogroup" aria-label="Status">
        {STATUS.map(([id, label]) => (
          <button
            key={id}
            role="radio"
            aria-checked={b.status === id}
            className={`bks-st${b.status === id ? " sel" : ""}`}
            onClick={() => {
              const p = { status: id };
              if (id === "reading" && !b.startedAt) p.startedAt = dayKey();
              if (id === "read") Object.assign(p, { finishedAt: dayKey(), startedAt: b.startedAt ?? dayKey() });
              patch(p);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bks-pages">
        <div className="bks-bar" aria-hidden="true">
          <span style={{ width: `${pct(b)}%` }} />
          <i style={{ left: `${pct(b)}%` }} />
        </div>
        <div className="bks-pg">
          p.
          <input
            type="number"
            min="0"
            value={draft}
            aria-label="Current page"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go(Number(draft))}
          />
          <span>/</span>
          <input
            type="number"
            min="0"
            value={b.pages ?? ""}
            placeholder="?"
            aria-label="Total pages"
            onChange={(e) => patch({ pages: Number(e.target.value) || null })}
          />
          <button className="mini-btn" onClick={() => go(Number(draft))} disabled={Number(draft) === (b.page ?? 0)}>bookmark</button>
        </div>
        <div className="bks-quick">
          {[10, 25, 50].map((n) => (
            <button key={n} className="mini-btn ghost" onClick={() => go((b.page ?? 0) + n)}>+{n}</button>
          ))}
          {left > 0 && <span>{left} to go · {pct(b)}%</span>}
        </div>
      </div>

      <div className="bks-dates">
        <label>
          started
          <input type="date" value={b.startedAt ?? ""} onChange={(e) => patch({ startedAt: e.target.value || null })} />
        </label>
        <label>
          finished
          <input type="date" value={b.finishedAt ?? ""} onChange={(e) => patch({ finishedAt: e.target.value || null })} />
        </label>
      </div>
      {b.finishedAt && b.startedAt && <div className="bks-took">{prettyDate(b.startedAt)} → {prettyDate(b.finishedAt)}</div>}

      <div className="bks-stars" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={b.rating === n} className={n <= (b.rating ?? 0) ? "on" : ""} onClick={() => patch({ rating: b.rating === n ? null : n })} aria-label={`${n} star${n === 1 ? "" : "s"}`}>
            ★
          </button>
        ))}
        <span className="bks-swatch" aria-label="Spine colour">
          {SPINES.slice(0, 8).map((c) => (
            <button key={c} className={c === b.color ? "on" : ""} style={{ background: c }} onClick={() => patch({ color: c })} aria-label={`Spine colour ${c}`} />
          ))}
        </span>
      </div>
    </div>
  );
}

// The camera, looking for an ISBN barcode. Only shown where BarcodeDetector exists.
function Scanner({ onCode, onClose }) {
  const video = useRef(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let stream;
    let timer;
    let gone = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (gone) return stream.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream;
        await video.current.play();
        const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a"] });
        timer = setInterval(async () => {
          try {
            const [hit] = await det.detect(video.current);
            const code = hit && asIsbn(hit.rawValue);
            if (code && !gone) {
              gone = true;
              onCode(code);
            }
          } catch {
            /* a frame that wouldn't read: try the next */
          }
        }, 350);
      } catch {
        setErr("no camera here. type the title or ISBN instead.");
      }
    })();
    return () => {
      gone = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bks-scanner">
      {err ? <div className="bks-err">{err}</div> : <video ref={video} muted playsInline />}
      <span className="bks-laser" aria-hidden="true" />
      <div className="bks-hint">hold the back-cover barcode in the red line</div>
      <button className="mini-btn" onClick={onClose}>never mind</button>
    </div>
  );
}
