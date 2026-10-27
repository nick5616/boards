import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { dayKey } from "../../utils/date";
import { GRADES, JLPT, kanjiList, kanjiInfo, newKanjiFor, streakOf, cardFor } from "../../lib/words";
import { useToFlashcards, ToCards } from "./wordsShared";
import { Fold, Credit } from "./kit";

// One square of genkō-yōshi paper: cross guides, an optional faint model to trace, and
// a pen (pointer events, so mouse, touch and stylus all work). Strokes are not saved.
function Cell({ ch, ghost, model }) {
  const [strokes, setStrokes] = useState([]);
  const drawing = useRef(false);
  const at = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, Math.round(((e.clientY - r.top) / r.height) * 1000) / 10];
  };
  const down = (e) => {
    if (model) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    setStrokes((s) => [...s, [at(e)]]);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const p = at(e);
    setStrokes((s) => s.map((st, i) => (i === s.length - 1 ? [...st, p] : st)));
  };
  const up = () => { drawing.current = false; };
  return (
    <div className={`kj-cell${model ? " model" : ""}`}>
      <svg viewBox="0 0 100 100" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label={model ? `${ch}, the model` : "practice square"}>
        <path d="M50 0V100M0 50H100" className="kj-guide" />
        {(model || ghost) && <text x="50" y="52" textAnchor="middle" dominantBaseline="central" className={model ? "kj-mod" : "kj-ghost"}>{ch}</text>}
        {strokes.map((st, i) => <polyline key={i} points={st.map((p) => p.join(",")).join(" ")} className="kj-pen" />)}
      </svg>
      {!model && strokes.length > 0 && <button className="kj-clr" onClick={() => setStrokes([])} aria-label="Clear square">✕</button>}
    </div>
  );
}

// Genkō-yōshi practice paper for kanji (kanjiapi.dev): browse by school grade or JLPT level
// or look up one kanji, trace it, mark the ones you know. A new kanji each day keeps a streak.
// State: mode "grade"|"jlpt", level, known [char], sel (char being studied),
// daily { day, char }, days [dayKey] practiced.
export default function Kanji({ board, mod, setState, expanded }) {
  const { logPractice, toast } = useData();
  const fc = useToFlashcards(board, mod);
  const { mode = "grade", level = 1, known = [], sel = null, daily = null, days = [] } = mod.state;
  const today = dayKey();
  const [list, setList] = useState([]);
  const [info, setInfo] = useState(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const streak = streakOf(days, today);

  // Today's new kanji, picked once a day
  useEffect(() => {
    if (daily?.day === today) return;
    let live = true;
    newKanjiFor(known, today)
      .then((c) => live && c && setState((s) => ({ ...s, daily: { day: today, char: c }, sel: s.sel ?? c })))
      .catch(() => {});
    return () => { live = false; };
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true;
    setMsg("");
    kanjiList(mode, level).then((l) => live && setList(l)).catch(() => live && setMsg("couldn't reach kanjiapi.dev"));
    return () => { live = false; };
  }, [mode, level]);

  const cur = sel ?? daily?.char ?? null;
  useEffect(() => {
    if (!cur) { setInfo(null); return; }
    let live = true;
    kanjiInfo(cur).then((i) => live && setInfo(i)).catch(() => {});
    return () => { live = false; };
  }, [cur]);

  const set = (patch) => setState((s) => ({ ...s, ...patch }));
  const choose = (c) => set({ sel: c });
  const toggleKnown = (c) => set({ known: known.includes(c) ? known.filter((k) => k !== c) : [...known, c] });

  const find = async (e) => {
    e.preventDefault();
    const c = [...q.trim()][0];
    if (!c) return;
    try {
      if (await kanjiInfo(c)) { choose(c); setQ(""); setMsg(""); } else setMsg(`${c} isn't in the kanji list`);
    } catch { setMsg("couldn't reach kanjiapi.dev"); }
  };

  const practiced = () => {
    if (!cur) return;
    setState((s) => ({
      ...s,
      days: s.days?.includes(today) ? s.days : [...(s.days ?? []), today].slice(-400),
      known: s.known?.includes(cur) ? s.known : [...(s.known ?? []), cur],
    }));
    logPractice(board.id, `🈶 kanji: ${cur}${info?.meanings?.[0] ? ` (${info.meanings[0]})` : ""}`, { moduleId: mod.id });
    toast({ text: `${cur} practiced${streak ? ` · ${streak + (days.includes(today) ? 0 : 1)}-day streak` : ""}` });
  };

  const cardOf = info && cardFor(info.kanji, `${info.meanings.slice(0, 3).join(", ")} · ${[...info.on, ...info.kun].slice(0, 3).join("、")}`, "Japanese");
  const shown = expanded ? list : list.slice(0, 60);

  const tools = (
    <>
      <div className="kj-pick">
        <select className="wd-sel" value={`${mode}-${level}`} onChange={(e) => { const [m, l] = e.target.value.split("-"); set({ mode: m, level: Number(l) }); }} aria-label="Level">
          <optgroup label="school grade">{GRADES.map((g) => <option key={g} value={`grade-${g}`}>grade {g}</option>)}</optgroup>
          <optgroup label="JLPT">{JLPT.map((n) => <option key={n} value={`jlpt-${n}`}>N{n}</option>)}</optgroup>
        </select>
        <span className="wd-dim">{list.filter((c) => known.includes(c)).length}/{list.length} known</span>
      </div>
      <div className="kj-grid">
        {list.map((c) => (
          <button key={c} className={`kj-k${known.includes(c) ? " known" : ""}${c === cur ? " sel" : ""}`} onClick={() => choose(c)}>{c}</button>
        ))}
      </div>
      <form className="kj-find" onSubmit={find}>
        <input className="line-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="one kanji, e.g. 日" aria-label="Kanji to look up" />
        <button className="mini-btn ghost" disabled={!q.trim()}>find</button>
      </form>
      {msg && <div className="wd-dim">{msg}</div>}
    </>
  );

  return (
    <div className="kj">
      {cur && (
        <div className="kj-sheet">
          <Cell ch={cur} model />
          <Cell ch={cur} ghost />
          <Cell ch={cur} />
          <Cell ch={cur} />
        </div>
      )}
      {!cur && <p className="wd-dim">picking today's kanji…</p>}
      {cur && !info && <p className="wd-dim">looking it up…</p>}
      {info && (
        <div className="kj-info">
          <b>{info.meanings.slice(0, expanded ? 6 : 3).join(", ")}</b>
          <div className="kj-read">
            {info.on.length > 0 && <span><i>on</i> {info.on.slice(0, expanded ? 9 : 3).join("、")}</span>}
            {info.kun.length > 0 && <span><i>kun</i> {info.kun.slice(0, expanded ? 9 : 3).join("、")}</span>}
          </div>
          <small>
            {daily?.char === cur && daily.day === today ? "today's new kanji · " : ""}{info.strokes} strokes{info.grade ? ` · grade ${info.grade}` : ""}{info.jlpt ? ` · N${info.jlpt}` : ""}
          </small>
        </div>
      )}
      {cur && (
        <div className="wd-acts">
          <button className="mini-btn" onClick={practiced}>✓ practiced</button>
          {cardOf && <ToCards fc={fc} cards={[cardOf]} label="→ card" />}
          <button className="x-btn kj-star" onClick={() => toggleKnown(cur)} aria-pressed={known.includes(cur)} aria-label={known.includes(cur) ? "Unmark known" : "Mark known"}>{known.includes(cur) ? "★" : "☆"}</button>
        </div>
      )}
      {expanded ? tools : <Fold label="browse & find">{tools}</Fold>}
      <Credit>kanjiapi.dev{streak ? ` · 🈶 ${streak}-day streak` : ""}</Credit>
    </div>
  );
}
