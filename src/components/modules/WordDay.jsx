import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { dayKey } from "../../utils/date";
import {
  LANGS, lookupWord, wordOfDay, isTorn, gloss, cardFor,
} from "../../lib/words";
import { useToFlashcards, ToCards } from "./wordsShared";
import { Seg, Empty, Credit } from "./kit";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// One looked-up word, as printed on a page
function Entry({ r, full }) {
  const audio = useRef(null);
  if (!r) return null;
  return (
    <div className="wd-entry">
      <div className="wd-phon">
        {r.phon && <span>{r.phon}</span>}
        {r.audio && (
          <button className="wd-ear" onClick={() => { audio.current ??= new Audio(r.audio); audio.current.currentTime = 0; audio.current.play().catch(() => {}); }} aria-label={`Hear ${r.word}`}>🔊</button>
        )}
      </div>
      {(full ? r.entries : r.entries.slice(0, 1)).map((e, i) => (
        <div key={i} className="wd-sense">
          <i>{e.pos}</i>
          <ol>{(full ? e.defs : e.defs.slice(0, 2)).map((d, j) => <li key={j}>{d}</li>)}</ol>
          {full && e.example && <q>{e.example}</q>}
        </div>
      ))}
    </div>
  );
}

// A tear-off desk calendar: today's page shows a word of the day (from your own stack, or a
// small built-in shelf). Look up any word (English via dictionaryapi.dev, other languages via
// Wiktionary), keep it, and tear off the page when you've read it.
// State: lang (language name for lookups), stack [{ id, word, lang, gloss, at }],
// torn [{ day, word, lang }] (the pile of used pages), salt (reshuffles today's pick).
export default function WordDay({ board, mod, setState, expanded, openBig }) {
  const { logPractice, undoLog, toast } = useData();
  const fc = useToFlashcards(board, mod);
  const { lang = "English", stack = [], torn = [] } = mod.state;
  const today = dayKey();
  const now = new Date();
  const wod = wordOfDay(mod.state, today);
  const done = isTorn(mod.state, today);
  const [tab, setTab] = useState("page"); // page | look | stack | torn (the last three only when opened big)
  const [q, setQ] = useState("");
  const [found, setFound] = useState(null); // a lookup result for what you typed
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pageDef, setPageDef] = useState(null);

  useEffect(() => {
    let live = true;
    setPageDef(null);
    lookupWord(wod.word, wod.lang).then((r) => live && setPageDef(r)).catch(() => {});
    return () => { live = false; };
  }, [wod.word, wod.lang]);

  const look = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await lookupWord(q, lang);
      setFound(r);
      if (!r) setMsg(`no "${q.trim()}" in ${lang}; check the language`);
    } catch {
      setMsg("couldn't reach the dictionary");
    }
    setBusy(false);
  };

  const keep = (r) => {
    if (!r || stack.some((s) => s.word === r.word && s.lang === r.lang)) return;
    setState((s) => ({ ...s, stack: [{ id: uid(), word: r.word, lang: r.lang, gloss: gloss(r), at: Date.now() }, ...(s.stack ?? [])] }));
    toast({ text: `${r.word} kept in your stack` });
  };

  const tear = () => {
    setState((s) => ({ ...s, torn: [{ day: today, word: wod.word, lang: wod.lang }, ...(s.torn ?? [])].slice(0, 200) }));
    const log = logPractice(board.id, `📖 word of the day: ${wod.word}`, { moduleId: mod.id });
    toast({ text: `tore off: ${wod.word}`, actions: [{ label: "undo", run: () => { undoLog?.(log); setState((s) => ({ ...s, torn: (s.torn ?? []).filter((t) => t.day !== today) })); } }] });
  };

  const inStack = (r) => stack.some((s) => s.word === r?.word && s.lang === r?.lang);
  const cardsOf = (r) => (r ? [cardFor(r.word, gloss(r), r.lang)] : []);

  const view = expanded ? tab : "page";

  return (
    <div className="wd">
      {expanded && (
        <Seg label="Calendar sections" value={tab} onChange={setTab}
          options={[{ id: "page", label: "today" }, { id: "look", label: "look up" }, { id: "stack", label: `stack${stack.length ? ` ${stack.length}` : ""}` }, { id: "torn", label: `torn${torn.length ? ` ${torn.length}` : ""}` }]} />
      )}

      {view === "page" && (
        <div className={`wd-cal${done ? " torn" : ""}`}>
          <div className="wd-rings" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="wd-date">
            <span>{MONTHS[now.getMonth()]} {now.getDate()}</span>
            <em>{now.toLocaleDateString([], { weekday: "long" })}</em>
          </div>
          {done ? (
            <div className="wd-gone">
              <b>{wod.word}</b>
              <small>torn off · a new word tomorrow</small>
            </div>
          ) : (
            <>
              <div className="wd-word">
                <small>{wod.own ? "from your stack" : "word of the day"} · {wod.lang}</small>
                <b>{wod.word}</b>
              </div>
              {pageDef ? <Entry r={pageDef} full={expanded} /> : <p className="wd-dim">looking it up…</p>}
              <div className="wd-acts">
                <button className="mini-btn" onClick={tear}>✂ tear off</button>
                <ToCards fc={fc} cards={cardsOf(pageDef)} />
                {expanded && pageDef && !inStack(pageDef) && !wod.saved && <button className="mini-btn ghost" onClick={() => keep(pageDef)}>keep</button>}
                {expanded && <button className="x-btn" onClick={() => setState((s) => ({ ...s, salt: (s.salt ?? 0) + 1 }))} aria-label="A different word today" title="a different word today">↻</button>}
              </div>
            </>
          )}
        </div>
      )}
      {view === "page" && !expanded && (stack.length > 0 || torn.length > 0) && (
        <button className="wd-more" onClick={openBig}>{stack.length} kept · {torn.length} torn · look up a word ›</button>
      )}
      {view === "page" && !expanded && stack.length === 0 && torn.length === 0 && (
        <button className="wd-more" onClick={openBig}>look up a word ›</button>
      )}

      {view === "look" && (
        <>
          <form className="wd-look" onSubmit={look}>
            <select className="wd-sel" value={lang} onChange={(e) => { setState((s) => ({ ...s, lang: e.target.value })); setFound(null); }} aria-label="Language">
              {LANGS.map((l) => <option key={l.code}>{l.name}</option>)}
            </select>
            <input className="line-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="a word…" aria-label="Word to look up" />
            <button className="mini-btn" disabled={busy || !q.trim()}>{busy ? "…" : "look up"}</button>
          </form>
          {msg && <div className="wd-dim">{msg}</div>}
          {found && (
            <div className="wd-found">
              <b>{found.word}</b>
              <Entry r={found} full />
              <div className="wd-acts">
                <button className="mini-btn" disabled={inStack(found)} onClick={() => keep(found)}>{inStack(found) ? "kept" : "keep"}</button>
                <ToCards fc={fc} cards={cardsOf(found)} />
              </div>
            </div>
          )}
          {!found && !msg && <Empty>Look up a word to keep it.</Empty>}
        </>
      )}

      {view === "stack" && (
        <div className="wd-list">
          {stack.length === 0 && <Empty>No kept words yet.</Empty>}
          {stack.map((s) => (
            <div key={s.id} className="wd-row">
              <span><b>{s.word}</b> <em>{s.lang !== "English" ? s.lang : ""}</em><small>{s.gloss}</small></span>
              <ToCards fc={fc} cards={[cardFor(s.word, s.gloss, s.lang)]} label="→" />
              <button className="x-btn" aria-label={`Remove ${s.word}`} onClick={() => setState((m) => ({ ...m, stack: m.stack.filter((x) => x.id !== s.id) }))}>✕</button>
            </div>
          ))}
          {stack.length > 1 && <ToCards fc={fc} cards={stack.map((s) => cardFor(s.word, s.gloss, s.lang))} label="all → cards" />}
        </div>
      )}

      {view === "torn" && (
        <div className="wd-list">
          {torn.length === 0 && <Empty>Torn pages land here.</Empty>}
          {torn.slice(0, 200).map((t) => (
            <div key={t.day} className="wd-row"><span><b>{t.word}</b> <em>{t.lang}</em></span><small>{t.day}</small></div>
          ))}
        </div>
      )}

      <Credit>{lang === "English" && view !== "page" ? "dictionaryapi.dev" : "dictionaryapi.dev · Wiktionary"}</Credit>
    </div>
  );
}
