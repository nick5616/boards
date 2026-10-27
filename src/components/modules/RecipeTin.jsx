import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { useBoardContext } from "../board/BoardContext";
import {
  mealsWith, searchMeals, randomMeal, lookupMeal, recipeStateFor, cardOf, pantryWords,
} from "../../lib/recipetin";
import { shelfItems } from "../../lib/pantry";
import { Seg, Empty, ChipRow, Credit } from "./kit";

// A tin box of index cards. Ask what you can make from what's in the cupboard, pull a
// random dinner idea, keep the ones you like, and "make it" copies one onto a Recipe card
// of its own (scaling, timers). Recipes come from TheMealDB straight to this browser.
// State: cards [{ id, mealId, name, thumb, area, category, at }], ings: ["chicken", …] (the last ask), tonight: "" (a card name)
export default function RecipeTin({ board, mod, setState, expanded, openBig }) {
  const { toast } = useData();
  const ctx = useBoardContext();
  const { cards = [], ings = [], tonight = "" } = mod.state;
  const pantryItems = board.modules.filter((m) => m.type === "pantry").flatMap((m) => shelfItems(m.state));
  const fromPantry = pantryWords(pantryItems);
  const [text, setText] = useState("");
  const [results, setResults] = useState(null); // null = not asked yet
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [meal, setMeal] = useState(null); // the card pulled out of the tin
  const [tab, setTab] = useState("find"); // find | tin

  const run = async (fn) => {
    setBusy(true);
    setErr("");
    try {
      return await fn();
    } catch {
      setErr("couldn't reach the recipe box; try again in a bit");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const ask = async (list, q) => {
    const out = await run(async () => {
      const hits = list.length ? await mealsWith(list) : [];
      // a lone word that isn't an ingredient may still be a dish ("lasagne")
      return hits.length || !q ? hits : searchMeals(q);
    });
    if (out) setResults(out);
  };

  const addIng = (w) => {
    const word = w.trim().toLowerCase();
    if (!word || ings.includes(word)) return;
    const next = [...ings, word];
    setState((s) => ({ ...s, ings: next }));
    setText("");
    ask(next, "");
  };
  const dropIng = (w) => {
    const next = ings.filter((x) => x !== w);
    setState((s) => ({ ...s, ings: next }));
    if (next.length) ask(next, "");
    else setResults(null);
  };

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    // "chicken, rice" or one word = ingredients; a phrase like "beef stew" = a dish name
    const list = t.split(/[,+]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (list.length > 1 || !t.includes(" ")) {
      const next = [...new Set([...ings, ...list])];
      setState((s) => ({ ...s, ings: next }));
      setText("");
      ask(next, t);
    } else {
      setText("");
      ask([], t);
    }
  };

  const open = async (m) => {
    const full = await run(() => lookupMeal(m.id));
    if (full) setMeal(full);
  };

  const dinner = async () => {
    const m = await run(randomMeal);
    if (m) open(m);
  };

  const saved = (id) => cards.some((c) => c.mealId === id);
  const keep = (m) => {
    if (saved(m.id)) return;
    setState((s) => ({ ...s, cards: [cardOf(m), ...(s.cards ?? [])] }));
    toast({ text: `${m.name} is in the tin` });
  };
  const toss = (id) => setState((s) => ({ ...s, cards: (s.cards ?? []).filter((c) => c.id !== id) }));

  const makeIt = (m) => {
    if (!ctx?.createModule) return toast({ text: "can't make a recipe card here" });
    ctx.createModule("recipe", { near: mod.id, state: recipeStateFor(m), title: m.name });
    toast({ text: `${m.name} is on a Recipe card 🍳` });
  };

  const toggleTonight = (m) => setState((s) => ({ ...s, tonight: s.tonight === m.name ? "" : m.name }));

  const hitRow = (m, extra, onX) => (
    <li key={m.id ?? m.mealId} className={`rt-hit${tonight === m.name ? " tonight" : ""}`}>
      <button className="rt-hitbtn" onClick={() => open({ id: m.mealId ?? m.id })}>
        {m.thumb ? <img referrerPolicy="no-referrer" src={`${m.thumb}/preview`} alt="" loading="lazy" draggable={false} /> : <span className="rt-nothumb" />}
        <span className="rt-hitname">{m.name}</span>
        {extra}
      </button>
      {onX && <button className="x-btn" onClick={onX} aria-label={`Take ${m.name} out of the tin`}>✕</button>}
    </li>
  );

  const LIMIT = expanded ? 40 : 4;
  const free = fromPantry.filter((w) => !ings.includes(w));

  return (
    <div className="rt">
      <Seg small label="Recipe tin" value={tab} onChange={setTab} options={[{ id: "find", label: "find" }, { id: "tin", label: `the tin${cards.length ? ` (${cards.length})` : ""}` }]} />

      {meal && (
        <div className="rt-card">
          <div className="rt-cardtop">
            {meal.thumb && <img referrerPolicy="no-referrer" src={`${meal.thumb}/preview`} alt="" draggable={false} />}
            <div>
              <b>{meal.name}</b>
              <span>{[meal.category, meal.area].filter(Boolean).join(" · ")}</span>
            </div>
            <button className="x-btn" onClick={() => setMeal(null)} aria-label="Close card">✕</button>
          </div>
          <ul className="rt-ings">
            {meal.ingredients.slice(0, expanded ? 40 : 6).map((i, n) => (
              <li key={n}>{i.measure ? <em>{i.measure}</em> : null} {i.name}</li>
            ))}
          </ul>
          {expanded && (
            <ol className="rtin-steps">
              {meal.steps.map((s, n) => <li key={n}>{s}</li>)}
            </ol>
          )}
          <div className="rtin-btns">
            <button className="mini-btn" onClick={() => makeIt(meal)}>🍳 make it</button>
            <button className="mini-btn ghost" onClick={() => keep(meal)} disabled={saved(meal.id)}>{saved(meal.id) ? "in the tin ✓" : "keep"}</button>
            <button className={`mini-btn ghost${tonight === meal.name ? " on" : ""}`} onClick={() => toggleTonight(meal)} aria-pressed={tonight === meal.name}>tonight</button>
          </div>
          {(meal.youtube || meal.source) && expanded && (
            <div className="rt-links">
              {meal.youtube && <a href={meal.youtube} target="_blank" rel="noreferrer">video ↗</a>}
              {meal.source && <a href={meal.source} target="_blank" rel="noreferrer">source ↗</a>}
            </div>
          )}
        </div>
      )}

      {tab === "find" && !meal && (
        <>
          <div className="rt-ask">
            <input
              className="line-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="what's in the fridge?"
              aria-label="Ingredients or a dish name"
            />
            <button className="mini-btn" onClick={submit} disabled={busy || !text.trim()}>find</button>
            <button className="x-btn" onClick={dinner} disabled={busy} aria-label="A random dinner idea" title="a random dinner idea">🎲</button>
          </div>
          {(ings.length > 0 || free.length > 0) && (
            <ChipRow label="Ingredients">
              {ings.map((w) => (
                <button key={w} className="mini-btn on" onClick={() => dropIng(w)} aria-label={`Drop ${w}`}>{w} ✕</button>
              ))}
              {free.map((w) => (
                <button key={w} className="mini-btn ghost" onClick={() => addIng(w)} title="from your pantry">+ {w}</button>
              ))}
            </ChipRow>
          )}
          {results && results.length > 0 && (
            <>
              <ul className="rt-hits">
                {results.slice(0, LIMIT).map((m) => hitRow(m, m.hits > 1 ? <span className="rt-hits-n">{m.hits}/{ings.length}</span> : null))}
              </ul>
              {!expanded && results.length > LIMIT && <button className="mini-btn ghost" onClick={openBig}>+ {results.length - LIMIT} more</button>}
            </>
          )}
          {!results && !busy && !err && (
            <Empty action={<button className="mini-btn" onClick={dinner}>🎲 dinner idea</button>}>what can I make?</Empty>
          )}
          {results && !busy && results.length === 0 && <div className="rtin-hint">nothing in the box for that</div>}
        </>
      )}

      {tab === "tin" && !meal && (
        cards.length === 0 ? (
          <Empty>keep a card and it lives here</Empty>
        ) : (
          <>
            <ul className="rt-hits">
              {cards.slice(0, LIMIT + 2).map((c) => hitRow(c, tonight === c.name ? <span className="rt-hits-n">tonight</span> : null, () => toss(c.id)))}
            </ul>
            {!expanded && cards.length > LIMIT + 2 && <button className="mini-btn ghost" onClick={openBig}>+ {cards.length - LIMIT - 2} more</button>}
          </>
        )
      )}
      <Credit reload={undefined} loading={busy} error={!!err}>TheMealDB</Credit>
    </div>
  );
}
