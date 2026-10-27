import { useState, useEffect, useRef } from "react";
import { uid } from "../../utils/uid";
import { Seg, Empty, Fold, ChipRow, Credit } from "./kit";
import {
  LANGS, RTL, parseWikiUrl, summary, randomCard, linksOf, pickLinks, searchTitle, inLang,
} from "../../lib/wiki";

const TILT = [-1.4, 0.9, -0.5, 1.3, -0.9, 0.5];

// A trail of index cards through Wikipedia: one card per page, pick a link to go deeper.
// State: lang (edition for new starts), trail [{ id, lang, title, key, desc, extract, thumb, url, fav? }]
// (last = where you are), dead [{ id, lang, title }] pages you backed out of, favs [card],
// past [{ id, at, cards }] finished trails.
export default function RabbitHole({ mod, setState, onPatch, expanded }) {
  const { lang = "en", trail = [], dead = [], favs = [], past = [] } = mod.state ?? {};
  const [view, setView] = useState(Math.max(0, trail.length - 1)); // which card is on top
  const [text, setText] = useState("");
  const [links, setLinks] = useState({ for: null, all: [], shown: [] });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [replay, setReplay] = useState(null); // index while replaying, else null
  const [shelf, setShelf] = useState(null); // null | "favs" | "dead" | "past"
  const [other, setOther] = useState(null); // { code, title } the page in the picked language
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const top = trail[Math.min(view, trail.length - 1)] ?? null;
  const shownIdx = replay ?? Math.min(view, trail.length - 1);
  const card = trail[shownIdx] ?? null;
  const dir = card && RTL.has(card.lang) ? "rtl" : "ltr";

  // Keep the view on the newest card when the trail grows from elsewhere (another tab)
  const len = useRef(trail.length);
  useEffect(() => {
    if (trail.length !== len.current) { len.current = trail.length; setView(Math.max(0, trail.length - 1)); }
  }, [trail.length]);

  // Links out of the card on top
  useEffect(() => {
    if (!top || replay != null) return;
    let live = true;
    linksOf(top.lang, top.key.replace(/_/g, " "))
      .then((all) => live && setLinks({ for: top.id, all, shown: pickLinks(all, trail.map((c) => c.title)) }))
      .catch(() => live && setLinks({ for: top.id, all: [], shown: [] }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top?.id, replay]);

  // The page in the picked language, for learners
  useEffect(() => {
    setOther(null);
    if (!top || top.lang === lang) return;
    let live = true;
    inLang(top.lang, top.key.replace(/_/g, " "), lang).then((t) => live && t && setOther({ code: lang, title: t })).catch(() => {});
    return () => { live = false; };
  }, [top?.id, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Replay walks the trail one card at a time
  useEffect(() => {
    if (replay == null) return;
    if (replay >= trail.length - 1) { const t = setTimeout(() => setReplay(null), 2500); return () => clearTimeout(t); }
    const t = setTimeout(() => setReplay(replay + 1), 2400);
    return () => clearTimeout(t);
  }, [replay, trail.length]);

  const patch = (p) => setState((s) => ({ ...s, ...p }));

  // Add a card after the one on top (or begin the trail). Going back and picking a different
  // link branches from there.
  const push = (c) => {
    const first = trail.length === 0;
    const base = trail.slice(0, Math.min(view, trail.length - 1) + 1);
    const mine = { ...c, id: uid(), at: Date.now() };
    setState((s) => ({ ...s, trail: [...base, mine] }));
    setView(base.length);
    setShelf(null); setReplay(null);
    if (first && !mod.named) onPatch?.({ title: `Rabbit hole: ${mine.title}` });
  };

  const go = async (fn) => {
    setBusy(true); setMsg("");
    try { const c = await fn(); if (alive.current && c) push(c); }
    catch { alive.current && setMsg("couldn't find that page"); }
    finally { alive.current && setBusy(false); }
  };
  const open = (title, l = top?.lang ?? lang) => go(() => summary(l, title));
  const begin = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    const w = parseWikiUrl(t);
    if (w) return go(() => summary(w.lang, w.title));
    return go(async () => {
      const found = await searchTitle(lang, t);
      return summary(lang, found ?? t);
    });
  };

  // A pasted Wikipedia link leaves a pending start (see takeIn); open it once
  const pending = mod.state?.start;
  useEffect(() => {
    if (!pending) return;
    setState((s) => ({ ...s, start: null }));
    go(() => summary(lang, pending));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const restart = () => {
    if (trail.length > 1) patch({ past: [{ id: uid(), at: Date.now(), cards: trail }, ...past].slice(0, 20), trail: [] });
    else patch({ trail: [] });
    setView(0); setShelf(null); setReplay(null);
  };
  const deadEnd = () => {
    if (!top) return;
    const gone = { id: uid(), lang: top.lang, title: top.title };
    const keep = trail.filter((c) => c.id !== top.id);
    patch({ trail: keep, dead: [gone, ...dead].slice(0, 80) });
    setView(Math.max(0, Math.min(view, keep.length) - 1));
  };
  const isFav = (c) => favs.some((f) => f.lang === c.lang && f.key === c.key);
  const toggleFav = (c) => patch({
    favs: isFav(c) ? favs.filter((f) => !(f.lang === c.lang && f.key === c.key)) : [{ ...c, id: uid() }, ...favs],
  });

  // Phone and desktop get a shorter list when small; the shuffle button draws a new handful
  const reshuffle = () => setLinks((l) => ({ ...l, shown: pickLinks(l.all, trail.map((c) => c.title)) }));

  const picker = (
    <select className="rh-lang" value={lang} onChange={(e) => patch({ lang: e.target.value })} aria-label="Wikipedia language">
      {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
    </select>
  );

  const shelfOpts = [
    { id: "favs", label: `★ ${favs.length}` },
    { id: "dead", label: `dead ends ${dead.length}` },
    { id: "past", label: `old trails ${past.length}` },
  ];
  const shelves = (
    <div className="rh-shelves">
      <Seg options={shelfOpts} value={shelf} onChange={(v) => setShelf(shelf === v ? null : v)} label="Kept" small />
      {shelf && (
        <div className="rh-shelf">
          {shelf === "favs" && (favs.length ? favs.map((f) => (
            <div key={f.id} className="rh-row">
              <button className="rh-link" onClick={() => push(f)}>{f.title}</button>
              <small>{f.lang}{f.desc ? ` · ${f.desc}` : ""}</small>
              <button className="x-btn" onClick={() => toggleFav(f)} aria-label={`Unstar ${f.title}`}>✕</button>
            </div>
          )) : <i className="rh-none">tap ☆ on a card to keep it</i>)}
          {shelf === "dead" && (dead.length ? dead.map((d) => (
            <div key={d.id} className="rh-row">
              <span className="rh-struck">{d.title}</span><small>{d.lang}</small>
              <button className="x-btn" onClick={() => patch({ dead: dead.filter((x) => x.id !== d.id) })} aria-label={`Forget ${d.title}`}>✕</button>
            </div>
          )) : <i className="rh-none">pages you back out of land here</i>)}
          {shelf === "past" && (past.length ? past.map((p) => (
            <div key={p.id} className="rh-row">
              <button
                className="rh-link"
                onClick={() => { patch({ trail: p.cards, past: past.filter((x) => x.id !== p.id) }); setView(p.cards.length - 1); setShelf(null); }}
              >
                {p.cards[0].title} → {p.cards[p.cards.length - 1].title}
              </button>
              <small>{p.cards.length} cards</small>
            </div>
          )) : <i className="rh-none">finished trails are kept here</i>)}
        </div>
      )}
    </div>
  );

  const credit = <Credit>Wikipedia · CC BY-SA</Credit>;
  const keptCount = favs.length + dead.length + past.length;

  if (!trail.length) {
    const startForm = (
      <div className="rh-start">
        <div className="rh-row1">
          <input
            className="line-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && begin()}
            placeholder="a topic or wikipedia link"
            aria-label="Topic or Wikipedia link"
            dir="auto"
          />
          <button className="mini-btn" onClick={begin} disabled={busy || !text.trim()}>go</button>
        </div>
        <button className="mini-btn ghost" onClick={() => go(() => randomCard(lang))} disabled={busy}>🎲 somewhere random</button>
        {msg && <div className="rh-msg">{msg}</div>}
      </div>
    );
    return (
      <div className="rh">
        <Empty action={startForm}>Pick a page and follow its links down.</Empty>
        {(expanded || keptCount > 0) && shelves}
        {expanded ? <div className="rh-langrow">language {picker}</div> : <Fold label="language">{picker}</Fold>}
        {credit}
      </div>
    );
  }

  const tilt = TILT[shownIdx % TILT.length];
  const more = (
    <div className="rh-more">
      <div className="rh-btns">
        <button className="mini-btn ghost" onClick={() => go(() => randomCard(top.lang))} disabled={busy}>🎲 jump</button>
        <button className="mini-btn ghost" onClick={deadEnd}>dead end</button>
        <button className="mini-btn ghost" onClick={restart}>new trail</button>
        <button className="mini-btn ghost" onClick={() => setReplay(replay == null ? 0 : null)} disabled={trail.length < 2}>{replay == null ? "▶ replay" : "■ stop"}</button>
      </div>
      <div className="rh-langrow">language {picker}</div>
      {shelves}
    </div>
  );
  return (
    <div className="rh">
      <ChipRow label="The trail so far">
        <span className="rh-depth">{trail.length} deep</span>
        {trail.map((c, n) => (
          <button key={c.id} className={`rh-dot${n === shownIdx ? " on" : ""}`} onClick={() => { setReplay(null); setView(n); }} title={c.title} aria-label={`Card ${n + 1}: ${c.title}`}>
            {n + 1}
          </button>
        ))}
      </ChipRow>

      {card && (
        <div className="rh-card" dir={dir} style={{ transform: `rotate(${tilt}deg)` }} key={card.id}>
          {card.thumb && <img className="rh-pic" src={card.thumb} alt="" loading="lazy" />}
          <div className="rh-cardbody">
            <h4>{card.title}</h4>
            {card.desc && <em>{card.desc}</em>}
            <p>{card.extract}</p>
          </div>
          <div className="rh-cardfoot">
            <button className={`rh-star${isFav(card) ? " on" : ""}`} onClick={() => toggleFav(card)} aria-pressed={isFav(card)} aria-label="Favourite">{isFav(card) ? "★" : "☆"}</button>
            <a href={card.url} target="_blank" rel="noreferrer">Wikipedia ↗</a>
          </div>
        </div>
      )}

      {replay == null && top && (
        <>
          {other && (
            <button className="rh-other" onClick={() => open(other.title, other.code)}>
              in {LANGS.find((l) => l.code === other.code)?.name}: <b dir="auto">{other.title}</b>
            </button>
          )}
          <div className="rh-h">
            <span>go deeper</span>
            <button className="x-btn" onClick={reshuffle} disabled={links.all.length < 9} aria-label="Different links">↻</button>
          </div>
          {links.for !== top.id ? <i className="rh-none">looking for links…</i>
            : links.shown.length ? (
              expanded ? (
                <div className="rh-chips wrap" dir={RTL.has(top.lang) ? "rtl" : "ltr"}>
                  {links.shown.map((t) => <button key={t} className="rh-chip" onClick={() => open(t)} disabled={busy}>{t}</button>)}
                </div>
              ) : (
                <ChipRow label="Links">
                  {links.shown.map((t) => <button key={t} className="rh-chip" onClick={() => open(t)} disabled={busy}>{t}</button>)}
                </ChipRow>
              )
            ) : <i className="rh-none">no links from here. a dead end?</i>}
          {msg && <div className="rh-msg">{msg}</div>}
        </>
      )}
      {expanded ? more : <Fold label="more">{more}</Fold>}
      {credit}
    </div>
  );
}
