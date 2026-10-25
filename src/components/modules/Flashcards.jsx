import { useState, useEffect, useRef } from "react";
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

// A friendly short list; the picker also offers whatever voices this browser has.
const LANGS = [
  ["es-ES", "Español"], ["fr-FR", "Français"], ["de-DE", "Deutsch"], ["it-IT", "Italiano"],
  ["pt-BR", "Português"], ["ja-JP", "日本語"], ["ko-KR", "한국어"], ["zh-CN", "中文"],
  ["ru-RU", "Русский"], ["en-US", "English"],
];

const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

// Voices load async in Chrome, so listen for them to show up.
const useVoices = () => {
  const [voices, setVoices] = useState(() => synth?.getVoices?.() ?? []);
  useEffect(() => {
    if (!synth) return;
    const load = () => setVoices(synth.getVoices());
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => synth.removeEventListener?.("voiceschanged", load);
  }, []);
  return voices;
};

// Exact lang first, then same language; local and "natural" voices win ties.
const bestVoice = (voices, lang) => {
  const want = lang.toLowerCase();
  const base = want.split("-")[0];
  const score = (v) => {
    const l = v.lang.replace("_", "-").toLowerCase();
    if (l !== want && l.split("-")[0] !== base) return -1;
    return (l === want ? 4 : 0) + (v.localService ? 2 : 0) + (/natural|neural|online/i.test(v.name) ? 1 : 0);
  };
  return voices.map((v) => [score(v), v]).filter(([n]) => n >= 0).sort((a, b) => b[0] - a[0])[0]?.[1];
};

// Lowercase, no accents or punctuation, so "¿Dónde está?" matches "donde esta".
const norm = (t) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();

// Levenshtein, as 1 (same) down to 0 (nothing alike).
const similarity = (a, b) => {
  a = norm(a);
  b = norm(b);
  if (!a && !b) return 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
};

// Index cards in a little Leitner box. Tap to flip; "got it" sends the card
// further out, "again" sends it to the back of today's pile. Clearing the
// pile counts as practice.
export default function Flashcards({ board, mod, setState, expanded }) {
  const { logPractice, undoLog, toast, uid: me } = useData();
  const voices = useVoices();
  const recRef = useRef(null);
  const [heard, setHeard] = useState(null); // { text, score } after a "say it"
  const [listening, setListening] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [input, setInput] = useState("");
  const [showLearned, setShowLearned] = useState(false);
  const { cards = [], learned: allLearned = [], lang = "", speakSide = "front", slow = false, auto = false } = mod.state;
  // Learned is per person: entries tagged `by` show only to that person; older untagged ones show to everyone.
  // TODO: the cards and boxes are still one shared deck, so retiring a card retires it for everyone.
  const learned = allLearned.filter((c) => !c.by || !me || c.by === me);
  const setDeck = (patch) => setState((s) => ({ ...s, ...patch }));
  const today = dayKey();
  const due = dueCards(mod.state, today);
  const card = due[0];
  const upcoming = cards.filter((c) => c.due > today).sort((a, b) => a.due.localeCompare(b.due))[0];

  const target = card ? (speakSide === "back" ? card.back : card.front) : "";
  const cardLang = card?.lang || lang;

  const speak = (text = target) => {
    if (!synth || !cardLang || !text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = cardLang;
    const v = bestVoice(voices, cardLang);
    if (v) u.voice = v;
    u.rate = slow ? 0.6 : 1;
    synth.speak(u);
  };

  const flip = () => {
    setHeard(null);
    if (!flipped && auto) speak();
    setFlipped((f) => !f);
  };

  const sayIt = () => {
    if (!Recognition || !cardLang || !card) return;
    if (listening) return recRef.current?.stop();
    const r = new Recognition();
    recRef.current = r;
    r.lang = cardLang;
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.onresult = (e) => {
      // Judge by whichever alternative sounded closest.
      const alts = [...e.results[0]].map((a) => a.transcript);
      const best = alts.map((t) => [similarity(t, target), t]).sort((a, b) => b[0] - a[0])[0];
      setHeard({ text: best[1], score: best[0] });
      if (best[0] >= 0.85) answer(true, true);
    };
    r.onerror = (e) => e.error !== "aborted" && setHeard({ text: "", score: 0, error: e.error });
    r.onend = () => setListening(false);
    setListening(true);
    try { r.start(); } catch { setListening(false); }
  };
  useEffect(() => () => { recRef.current?.abort?.(); synth?.cancel(); }, []);

  const answer = (got, keepHeard) => {
    if (!card) return;
    if (!keepHeard) setHeard(null);
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
      learned: retire ? [{ ...card, learnedAt: Date.now(), by: me }, ...(s.learned ?? [])].slice(0, 500) : s.learned ?? [],
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
            onClick={flip}
            aria-label={flipped ? `Answer: ${card.back}` : `${card.front}. Tap to flip`}
          >
            <span className="fc-face fc-front">
              {card.front}
              <i>box {(card.box ?? 0) + 1}</i>
            </span>
            <span className="fc-face fc-back">{card.back}</span>
          </button>
          {cardLang && synth && (
            <div className="fc-voice">
              <button className="mini-btn ghost" onClick={() => speak()} aria-label="Read aloud">🔊</button>
              {Recognition && (
                <button className={`mini-btn ghost${listening ? " live" : ""}`} onClick={sayIt} aria-label="Say it">
                  🎤 {listening ? "listening…" : "say it"}
                </button>
              )}
            </div>
          )}
          {heard && (
            <div className={`fc-heard${heard.score >= 0.85 ? " star" : ""}`} role="status">
              {heard.error
                ? "couldn't hear that, try again"
                : heard.score >= 0.85
                ? "⭐ perfect!"
                : heard.score >= 0.6
                ? `close! I heard “${heard.text}”`
                : `try again, I heard “${heard.text || "…"}”`}
            </div>
          )}
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

      {synth && (
        <div className="fc-lang">
          <select value={lang} onChange={(e) => setDeck({ lang: e.target.value })} aria-label="Deck language">
            <option value="">🔇 no voice</option>
            {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            {lang && !LANGS.some(([c]) => c === lang) && <option value={lang}>{lang}</option>}
            {[...new Set(voices.map((v) => v.lang.replace("_", "-")))]
              .filter((c) => !LANGS.some(([l]) => l === c) && c !== lang)
              .sort()
              .map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {lang && (
            <>
              <select value={speakSide} onChange={(e) => setDeck({ speakSide: e.target.value })} aria-label="Which side to speak">
                <option value="front">speak front</option>
                <option value="back">speak back</option>
              </select>
              <label><input type="checkbox" checked={slow} onChange={(e) => setDeck({ slow: e.target.checked })} /> slow</label>
              <label><input type="checkbox" checked={auto} onChange={(e) => setDeck({ auto: e.target.checked })} /> auto</label>
            </>
          )}
        </div>
      )}
      {lang && synth && Recognition && <div className="fc-hint">🎤 Chrome sends your voice to Google to check it.</div>}

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
