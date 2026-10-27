import { useState, useEffect } from "react";
import { useData } from "../../contexts/DataContext";
import { useBoardContext } from "../board/BoardContext";
import { MODULES } from "../../constants/modules";
import { addWords, splitWords } from "../../lib/magnets";
import { Fold, Empty, Credit } from "./kit";
import { poemOfDay, poemSearch, randomPoem } from "../../lib/words";

// A small clothbound anthology. PoetryDB gives a poem of the day (random, the same all day),
// and you can search by author or title. Hearts keep a poem; the ribbon marks the one you're
// on. Tap lines to pick them, then send the words to Fridge magnets.
// State: favs [{ id, title, author, lines }], ribbon (id of the bookmarked fav).
export default function Poems({ board, mod, setState, expanded }) {
  const { updateBoard, toast } = useData();
  const ctx = useBoardContext();
  const { favs = [], ribbon = null } = mod.state;
  const [poem, setPoem] = useState(null);
  const [results, setResults] = useState(null);
  const [kind, setKind] = useState("author");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [picked, setPicked] = useState([]); // line indexes
  const [shelf, setShelf] = useState(false);

  useEffect(() => {
    let live = true;
    poemOfDay().then((p) => live && setPoem((cur) => cur ?? p)).catch(() => live && setMsg("couldn't reach PoetryDB"));
    return () => { live = false; };
  }, []);

  const show = (p) => { setPoem(p); setPicked([]); setResults(null); setShelf(false); };
  const isFav = (p) => favs.some((f) => f.id === p?.id);
  const toggleFav = (p) =>
    setState((s) => ({
      ...s,
      favs: isFav(p) ? s.favs.filter((f) => f.id !== p.id) : [{ id: p.id, title: p.title, author: p.author, lines: p.lines }, ...(s.favs ?? [])],
      ribbon: isFav(p) && s.ribbon === p.id ? null : s.ribbon,
    }));

  const search = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await poemSearch(kind, q);
      setResults(r);
      if (!r.length) setMsg(`no ${kind} like "${q.trim()}"`);
    } catch { setMsg("couldn't reach PoetryDB"); }
    setBusy(false);
  };

  const another = async () => {
    setBusy(true);
    try { show(await randomPoem()); } catch { setMsg("couldn't reach PoetryDB"); }
    setBusy(false);
  };

  const togglePick = (i) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort((a, b) => a - b)));
  const toMagnets = () => {
    const lines = poem.lines.filter((_, i) => picked.includes(i));
    const words = splitWords(lines.join(" ")).map((w) => w.replace(/^["“(]+|[”)"]+$/g, "")).filter(Boolean);
    if (!words.length) return;
    const fridge = board.modules.find((m) => m.type === "magnets");
    if (fridge) {
      updateBoard(board.id, (b) => ({
        ...b,
        modules: b.modules.map((m) => (m.id === fridge.id ? { ...m, state: addWords(m.state, words) } : m)),
      }));
      toast({ text: `${words.length} words on the fridge` });
    } else {
      ctx?.createModule?.("magnets", { near: mod.id, state: addWords(MODULES.magnets.init(), words) });
      toast({ text: "new Fridge magnets with those words" });
    }
    setPicked([]);
  };

  const finder = (
    <>
      <form className="po-find" onSubmit={search}>
        <select className="wd-sel" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Search by">
          <option value="author">author</option>
          <option value="title">title</option>
        </select>
        <input className="line-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={kind === "author" ? "Blake, Dickinson…" : "Ozymandias…"} aria-label="Search poems" />
        <button className="mini-btn" disabled={busy || !q.trim()}>{busy ? "…" : "find"}</button>
      </form>
      {msg && !results && <div className="wd-dim">{msg}</div>}
    </>
  );

  const marked = favs.find((f) => f.id === ribbon);

  return (
    <div className="po">
      <div className="po-book">
        {marked && (
          <button className="po-ribbon" onClick={() => show(marked)} title={`Bookmark: ${marked.title}`} aria-label={`Open bookmarked poem ${marked.title}`} />
        )}
        <button className={`po-shelf${shelf ? " on" : ""}`} onClick={() => setShelf(!shelf)} aria-label={shelf ? "Back to the poem" : `Favorites, ${favs.length}`}>{shelf ? "✕" : `♥ ${favs.length}`}</button>

        {shelf ? (
          <div className="po-list">
            {favs.length === 0 && <Empty>No favorites yet.</Empty>}
            {favs.map((f) => (
              <div key={f.id} className="po-item">
                <button onClick={() => show(f)}><b>{f.title}</b><small>{f.author}</small></button>
                <button className={`po-mark${ribbon === f.id ? " on" : ""}`} aria-label={ribbon === f.id ? "Remove ribbon" : "Put the ribbon here"} onClick={() => setState((s) => ({ ...s, ribbon: s.ribbon === f.id ? null : f.id }))}>🔖</button>
              </div>
            ))}
          </div>
        ) : results ? (
          <div className="po-list">
            {results.map((r) => (
              <div key={r.id} className="po-item"><button onClick={() => show(r)}><b>{r.title}</b><small>{r.author}</small></button></div>
            ))}
            {!results.length && <p className="wd-dim">{msg}</p>}
            <button className="mini-btn ghost" onClick={() => setResults(null)}>back to the poem</button>
          </div>
        ) : poem ? (
          <article className="po-page">
            <h3>{poem.title}</h3>
            <p className="po-by">{poem.author}</p>
            <div className="po-lines">
              {poem.lines.map((l, i) => (
                l.trim() === ""
                  ? <br key={i} />
                  : <button key={i} className={picked.includes(i) ? "on" : ""} onClick={() => togglePick(i)} aria-pressed={picked.includes(i)}>{l}</button>
              ))}
            </div>
          </article>
        ) : (
          <p className="wd-dim">{msg || "opening the book…"}</p>
        )}
      </div>

      {!shelf && !results && poem && (
        <div className="wd-acts">
          <button className="mini-btn" onClick={() => toggleFav(poem)}>{isFav(poem) ? "♥ kept" : "♡ keep"}</button>
          {isFav(poem) && <button className="mini-btn ghost" onClick={() => setState((s) => ({ ...s, ribbon: s.ribbon === poem.id ? null : poem.id }))}>{ribbon === poem.id ? "lift ribbon" : "🔖 ribbon"}</button>}
          <button className="mini-btn ghost" onClick={another} disabled={busy}>another</button>
          {picked.length > 0 && <button className="mini-btn" onClick={toMagnets}>{picked.length} line{picked.length === 1 ? "" : "s"} → magnets</button>}
        </div>
      )}

      {expanded ? finder : <Fold label="search">{finder}</Fold>}
      <Credit>PoetryDB · public domain</Credit>
    </div>
  );
}
