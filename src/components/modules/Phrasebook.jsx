import { useState, useEffect } from "react";
import { uid } from "../../utils/uid";
import { caps } from "../../lib/caps";
import { LANGS, langOf, translate, TOPICS, cardFor } from "../../lib/words";
import { useToFlashcards, ToCards, speak } from "./wordsShared";
import { ChipRow, Empty, Fold, Credit } from "./kit";

// A pocket phrasebook for one language pair. Type a phrase, MyMemory (free, no key, about
// 5000 characters a day) translates it, and you keep it under a topic tab. The 🔊 button
// reads the translation aloud with the browser's own voice.
// State: from / to (language codes), topic, topics [string], phrases [{ id, topic, src, dst, at }].
export default function Phrasebook({ board, mod, setState, onPatch, expanded, openBig }) {
  const { from = "en", to = "es", topic = "greetings", phrases = [], topics = TOPICS } = mod.state;
  const fc = useToFlashcards(board, mod);
  const [src, setSrc] = useState("");
  const [dst, setDst] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const learn = langOf(to);
  const mine = phrases.filter((p) => p.topic === topic);

  // "Spanish phrasebook": named for what's in it, until you rename it yourself
  useEffect(() => {
    if (!mod.named) onPatch?.({ title: `${learn.name} phrasebook` });
  }, [learn.name, mod.named]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => setState((s) => ({ ...s, ...patch }));

  const ask = async (e) => {
    e?.preventDefault();
    if (!src.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await translate(src, from, to);
      setDst(r.text);
      if (!r.text) setMsg("no translation came back; write your own below");
    } catch (err) {
      setMsg(err.message === "limit" ? "today's free translations are used up. write it yourself, or try tomorrow" : "couldn't reach the translator; write it yourself");
    }
    setBusy(false);
  };

  const keep = () => {
    if (!src.trim() || !dst.trim()) return;
    setState((s) => ({ ...s, phrases: [{ id: uid(), topic, from, to, src: src.trim(), dst: dst.trim(), at: Date.now() }, ...(s.phrases ?? [])] }));
    setSrc("");
    setDst("");
    setMsg("");
  };

  const swap = () => set({ from: to, to: from });
  const addTopic = () => {
    const t = newTopic.trim().toLowerCase();
    if (!t || topics.includes(t)) return;
    set({ topics: [...topics, t], topic: t });
    setNewTopic("");
  };
  const cards = (list) => list.map((p) => cardFor(p.dst, p.src, langOf(p.to ?? to).name));

  const langs = (
    <div className="pb-langs">
      <select className="wd-sel" value={from} onChange={(e) => set({ from: e.target.value })} aria-label="From language">
        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
      <button className="x-btn" onClick={swap} aria-label="Swap languages">⇄</button>
      <select className="wd-sel" value={to} onChange={(e) => set({ to: e.target.value })} aria-label="To language">
        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
    </div>
  );
  const shown = mine.slice(0, expanded ? 200 : 4);

  return (
    <div className="pb">
      <form className="pb-ask" onSubmit={ask}>
        <input className="line-input" value={src} onChange={(e) => setSrc(e.target.value)} placeholder={`in ${langOf(from).name}…`} aria-label="Phrase to translate" maxLength={300} />
        <button className="mini-btn" disabled={busy || !src.trim()}>{busy ? "…" : "translate"}</button>
      </form>
      {(dst || msg) && (
        <div className="pb-out">
          {msg && <div className="wd-dim">{msg}</div>}
          <input className="line-input" value={dst} onChange={(e) => setDst(e.target.value)} placeholder={`in ${learn.name}`} aria-label="Translation" />
          <div className="wd-acts">
            <button className="mini-btn" disabled={!src.trim() || !dst.trim()} onClick={keep}>keep in {topic}</button>
            {caps.speech && <button className="x-btn" disabled={!dst} onClick={() => speak(dst, learn.voice)} aria-label="Say it">🔊</button>}
          </div>
        </div>
      )}

      <ChipRow label="Topics">
        {topics.map((t) => (
          <button key={t} className={`pb-chip${t === topic ? " on" : ""}`} aria-pressed={t === topic} onClick={() => set({ topic: t })}>
            {t}{phrases.some((p) => p.topic === t) ? ` ${phrases.filter((p) => p.topic === t).length}` : ""}
          </button>
        ))}
      </ChipRow>

      <div className="phb-page">
        {mine.length === 0 && <Empty>Nothing under “{topic}” yet.</Empty>}
        {shown.map((p) => (
          <div key={p.id} className="pb-row">
            <span><b>{p.dst}</b><small>{p.src}</small></span>
            {caps.speech && <button className="x-btn" onClick={() => speak(p.dst, langOf(p.to ?? to).voice)} aria-label={`Say ${p.dst}`}>🔊</button>}
            {expanded && <button className="x-btn" aria-label="Remove phrase" onClick={() => setState((s) => ({ ...s, phrases: s.phrases.filter((x) => x.id !== p.id) }))}>✕</button>}
          </div>
        ))}
        {!expanded && mine.length > shown.length && <button className="wd-more" onClick={openBig}>+ {mine.length - shown.length} more</button>}
      </div>

      {expanded ? (
        <div className="wd-acts">
          {langs}
          {mine.length > 0 && <ToCards fc={fc} cards={cards(mine)} label={`${topic} → cards`} />}
          <span className="pb-newtab">
            <input className="line-input" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTopic()} placeholder="+ new tab" aria-label="New topic tab" size={8} />
          </span>
        </div>
      ) : (
        <Fold label="languages & tabs">
          {langs}
          {mine.length > 0 && <ToCards fc={fc} cards={cards(mine)} label={`${topic} → cards`} />}
          <input className="line-input" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTopic()} placeholder="+ new tab" aria-label="New topic tab" />
        </Fold>
      )}
      <Credit>MyMemory · free daily limit</Credit>
    </div>
  );
}
