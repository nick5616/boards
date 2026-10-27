import { useState } from "react";
import { Seg, Empty, ChipRow, Credit } from "./kit";
import {
  BOTTLES, GROUPS, drinksWith, mocktailList, searchDrinks, randomDrink, lookupDrink, haveIt, missingFor,
} from "../../lib/barcart";

// A little brass bar cart. Tick the bottles you have on its shelves and it works out what
// you can mix (TheCocktailDB, asked from this browser). Random drink, a mocktail switch, and
// favourites that stay on the cart. State: have ["Gin", …] (API names), mocktails, favs [{ id, name, thumb }]
export default function BarCart({ mod, setState, expanded, openBig }) {
  const { have = [], mocktails = false, favs = [] } = mod.state;
  const [results, setResults] = useState(null);
  const [title, setTitle] = useState("");
  const [drink, setDrink] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = async (fn) => {
    setBusy(true);
    setErr("");
    try {
      return await fn();
    } catch {
      setErr("couldn't reach the cocktail book; try again in a bit");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const tick = (name) =>
    setState((s) => {
      const cur = s.have ?? [];
      return { ...s, have: cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name] };
    });

  const mix = async () => {
    if (!have.length && !mocktails) {
      setResults([]);
      setTitle("");
      return;
    }
    const out = await run(() => (have.length ? drinksWith(have, mocktails) : mocktailList()));
    if (out) {
      setResults(out);
      setTitle(have.length ? `${out.length} ${mocktails ? "mocktails" : "drinks"} from your cart` : "alcohol-free drinks");
    }
  };

  const find = async () => {
    const q = text.trim();
    if (!q) return;
    const out = await run(() => searchDrinks(q));
    if (out) {
      setResults(out); // a name search ignores the mocktail switch: you asked for it by name
      setTitle(out.length ? `“${q}”` : `nothing called “${q}”`);
    }
  };

  const show = async (d) => {
    const full = await run(() => lookupDrink(d.id));
    if (full) setDrink(full);
  };

  const surprise = async () => {
    const d = await run(() => randomDrink(mocktails));
    if (d) show(d);
  };

  const isFav = (id) => favs.some((f) => f.id === id);
  const toggleFav = (d) =>
    setState((s) => {
      const cur = s.favs ?? [];
      return { ...s, favs: cur.some((f) => f.id === d.id) ? cur.filter((f) => f.id !== d.id) : [{ id: d.id, name: d.name, thumb: d.thumb }, ...cur] };
    });

  const miss = drink ? missingFor(drink, have) : [];
  const LIMIT = expanded ? 60 : 4;

  const hit = (d, extra) => (
    <li key={d.id}>
      <button className="bc-hit" onClick={() => show(d)}>
        {d.thumb && <img referrerPolicy="no-referrer" src={`${d.thumb}/preview`} alt="" loading="lazy" draggable={false} />}
        <span>{d.name}</span>
        {extra}
      </button>
    </li>
  );

  return (
    <div className="bc">
      {drink ? (
        <div className="bc-card">
          <div className="bc-cardtop">
            {drink.thumb && <img referrerPolicy="no-referrer" src={`${drink.thumb}/preview`} alt="" draggable={false} />}
            <div>
              <b>{drink.name}</b>
              <span>{[drink.alcoholic, drink.glass].filter(Boolean).join(" · ")}</span>
            </div>
            <button className="x-btn" onClick={() => setDrink(null)} aria-label="Close">✕</button>
          </div>
          <ul className="bc-ings">
            {drink.ingredients.map((i, n) => (
              <li key={n} className={haveIt(i.name, have) ? "have" : "need"}>
                {haveIt(i.name, have) ? "✓" : "○"} {i.measure ? <em>{i.measure}</em> : null} {i.name}
              </li>
            ))}
          </ul>
          <div className="bc-miss">{miss.length === 0 ? "you have everything" : `still need: ${miss.map((i) => i.name).join(", ")}`}</div>
          {expanded && drink.method && <p className="bc-method">{drink.method}</p>}
          <div className="bc-btns">
            <button className={`mini-btn${isFav(drink.id) ? " on" : ""}`} onClick={() => toggleFav(drink)} aria-pressed={isFav(drink.id)}>
              {isFav(drink.id) ? "♥ favourite" : "♡ favourite"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="bc-cart">
            {GROUPS.map((g) => (
              <div key={g.id} className="bc-tier">
                <ChipRow label={g.label}>
                  {BOTTLES.filter((b) => b[2] === g.id).map(([api, label]) => (
                    <button key={api} className={`bc-bottle ${g.id}${have.includes(api) ? " on" : ""}`} onClick={() => tick(api)} aria-pressed={have.includes(api)}>
                      {label}
                    </button>
                  ))}
                </ChipRow>
              </div>
            ))}
          </div>

          <div className="bc-bar">
            <button className="mini-btn" onClick={mix} disabled={busy}>🍸 what can I mix{have.length ? ` (${have.length})` : ""}</button>
            <button className="x-btn" onClick={surprise} disabled={busy} aria-label="Surprise me" title="a random drink">🎲</button>
            <Seg small label="Kind of drink" value={mocktails ? "mock" : "all"} onChange={(v) => setState((s) => ({ ...s, mocktails: v === "mock" }))} options={[{ id: "all", label: "all" }, { id: "mock", label: "mocktails" }]} />
          </div>

          {results && (
            <div className="bc-results">
              <div className="bc-rtitle">{results.length === 0 && !title.startsWith("nothing") ? "tick some bottles first" : title}</div>
              <ul>{results.slice(0, LIMIT).map((d) => hit(d, d.hits != null ? <em>{d.missing ? `${d.missing} more` : "all yours"}</em> : null))}</ul>
              {!expanded && results.length > LIMIT && <button className="mini-btn ghost" onClick={openBig}>+ {results.length - LIMIT} more</button>}
            </div>
          )}

          {!results && favs.length === 0 && !busy && !err && (
            <Empty>tick your bottles</Empty>
          )}

          {favs.length > 0 && (
            <ChipRow label="Favourites">
              {favs.map((f) => (
                <button key={f.id} className="mini-btn ghost" onClick={() => show(f)}>♥ {f.name}</button>
              ))}
            </ChipRow>
          )}

          {expanded && (
            <div className="bc-ask">
              <input className="line-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find()} placeholder="look up a drink by name…" aria-label="Drink name" />
              <button className="mini-btn ghost" onClick={find} disabled={busy || !text.trim()}>find</button>
            </div>
          )}
        </>
      )}
      <Credit loading={busy} error={!!err}>TheCocktailDB{expanded ? " · please drink responsibly" : ""}</Credit>
    </div>
  );
}
