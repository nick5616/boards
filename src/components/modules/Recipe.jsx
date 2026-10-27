import { useState, useEffect } from "react";
import { useData } from "../../contexts/DataContext";
import { useLive } from "../../contexts/LiveContext";
import {
  parseRecipe, recipeText, show, toGrams, clockLeft, bakersPct, totalGrams, hydrationOf, clockMins, fmtNum, isFlour,
} from "../../lib/recipe";
import HandsFree from "./HandsFree";

const SCALES = [0.5, 1, 2, 3];
const scaleLabel = (n) => (n === 0.5 ? "½×" : `${n}×`);
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// An index card for a recipe: lined, a little stained. Ingredients scale (×½, ×2, or to
// a number of servings), flip to baker's percentages (flour = 100%), and read in grams or
// cups. A step with a time in it ("bulk ferment 4 hours") can start a countdown that rides
// in the live dock. "Hands-free" opens a big-type, talk-to-it version for messy hands.
export default function Recipe({ board, mod, setState }) {
  const live = useLive();
  const { toast } = useData();
  const { ingredients = [], steps = [], scale = 1, serves = 4, mode = "scale", system = "g" } = mod.state;
  const [editing, setEditing] = useState(!ingredients.length && !steps.length);
  const [draft, setDraft] = useState("");
  const [hands, setHands] = useState(false);
  const [now, setNow] = useState(Date.now);

  const mine = live.sessions.filter((s) => s.kind === "recipe" && s.modId === mod.id);
  useEffect(() => {
    if (!mine.length) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [mine.length]);

  const sid = (i) => `recipe:${mod.id}:${i}`;
  const timerFor = (i) => mine.find((s) => s.id === sid(i)) ?? null;
  const startTimer = (i) => {
    const m = steps[i]?.mins;
    if (!m) return;
    live.start({
      id: sid(i),
      kind: "recipe",
      boardId: board.id,
      modId: mod.id,
      icon: "🍞",
      label: `${mod.title || "recipe"} · step ${i + 1}`,
      endsAt: Date.now() + m * 60000,
    });
    toast({ text: `${clockMins(m)} timer started — it keeps going if you leave` });
  };
  const stopTimer = (i) => live.stop(sid(i));

  const patch = (p) => setState((s) => ({ ...s, ...p }));
  const bp = mode === "baker" ? bakersPct(ingredients, scale) : null;
  const hyd = hydrationOf(ingredients);
  const total = totalGrams(ingredients) * scale;
  const flourG = ingredients.filter((i) => isFlour(i.name)).reduce((t, i) => t + (toGrams(i) ?? 0), 0) * scale;

  const edit = () => {
    setDraft(recipeText({ ingredients, steps }));
    setEditing(true);
  };
  const save = () => {
    const r = parseRecipe(draft);
    setState((s) => ({ ...s, ingredients: r.ingredients, steps: r.steps }));
    setEditing(false);
    if (!r.ingredients.length && !r.steps.length) toast({ text: "nothing in there to keep" });
  };

  if (editing) {
    return (
      <div className="rc">
        <div className="rc-card">
          <textarea
            className="rc-paste"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={"Paste a recipe, or type one.\nLines that start with an amount become ingredients:\n\n500 g bread flour\n375 g water\n10 g salt\n\n1. Mix and rest 30 min\n2. Bulk ferment 4 hours"}
            autoFocus
            aria-label="Recipe text"
          />
        </div>
        <div className="rc-bar">
          <button className="mini-btn" onClick={save}>keep it</button>
          {(ingredients.length > 0 || steps.length > 0) && <button className="mini-btn ghost" onClick={() => setEditing(false)}>never mind</button>}
        </div>
      </div>
    );
  }

  const base = Math.max(1, serves);
  const nowServes = Math.round(base * scale * 100) / 100;

  return (
    <div className="rc">
      <div className="rc-card">
        <div className="rc-top">
          <div className="rc-chips" role="radiogroup" aria-label="Scale the recipe">
            {SCALES.map((n) => (
              <button key={n} role="radio" aria-checked={n === scale} className={`rc-chip${n === scale ? " sel" : ""}`} onClick={() => patch({ scale: n })}>
                {scaleLabel(n)}
              </button>
            ))}
            <label className={`rc-chip rc-x${SCALES.includes(scale) ? "" : " sel"}`} title="any amount">
              ×
              <input
                type="number"
                min="0.1"
                step="0.25"
                value={SCALES.includes(scale) ? "" : fmtNum(scale)}
                placeholder="?"
                onChange={(e) => num(e.target.value) && patch({ scale: num(e.target.value) })}
                aria-label="Custom multiplier"
              />
            </label>
          </div>
          <div className="rc-serves">
            serves
            <input type="number" min="1" value={base} onChange={(e) => num(e.target.value) && patch({ serves: Math.round(num(e.target.value)) })} aria-label="Servings the recipe is written for" />
            <span>→</span>
            <input
              type="number"
              min="0.5"
              step="1"
              value={nowServes}
              onChange={(e) => num(e.target.value) && patch({ scale: num(e.target.value) / base })}
              aria-label="Servings you want"
            />
          </div>
          <div className="rc-modes">
            <div className="rc-seg" role="radiogroup" aria-label="How to show amounts">
              <button role="radio" aria-checked={mode === "scale"} className={mode === "scale" ? "on" : ""} onClick={() => patch({ mode: "scale" })}>amounts</button>
              <button role="radio" aria-checked={mode === "baker"} className={mode === "baker" ? "on" : ""} onClick={() => patch({ mode: "baker" })}>baker's %</button>
            </div>
            <div className="rc-seg" role="radiogroup" aria-label="Units">
              <button role="radio" aria-checked={system === "g"} className={system === "g" ? "on" : ""} onClick={() => patch({ system: "g" })}>g</button>
              <button role="radio" aria-checked={system === "cups"} className={system === "cups" ? "on" : ""} onClick={() => patch({ system: "cups" })}>cups</button>
            </div>
          </div>
          {mode === "baker" && (
            <div className="rc-baker">
              {bp ? (
                <>
                  <label>dough <input type="number" min="1" value={Math.round(total)} onChange={(e) => num(e.target.value) && total > 0 && patch({ scale: (num(e.target.value) / (total / scale)) })} aria-label="Total dough in grams" /> g</label>
                  <label>flour <input type="number" min="1" value={Math.round(flourG)} onChange={(e) => num(e.target.value) && flourG > 0 && patch({ scale: (num(e.target.value) / (flourG / scale)) })} aria-label="Flour in grams" /> g</label>
                </>
              ) : (
                <span>no flour in the list, so there's nothing to be 100%</span>
              )}
            </div>
          )}
        </div>

        <ul className="rc-ings">
          {ingredients.map((i) => {
            const a = show(i, scale, system);
            const pct = bp?.of(i);
            return (
              <li key={i.id}>
                <b className="rc-amt">{a.approx && "~"}{a.text}</b>
                <span className="rc-name">{i.name}</span>
                {pct != null && <em className="rc-pct">{Math.round(pct * 10) / 10}%</em>}
              </li>
            );
          })}
          {!ingredients.length && <li className="rc-none">no ingredients yet</li>}
        </ul>
        {system === "cups" && <small className="rc-note">~ cups are a guess: flour packs differently every scoop. Weigh when it matters.</small>}
        {hyd != null && <div className="rc-hyd">hydration <b>{hyd}%</b></div>}

        <ol className="rc-steps">
          {steps.map((s, i) => {
            const t = timerFor(i);
            const left = t?.endsAt ? t.endsAt - now : null;
            return (
              <li key={i}>
                <span>{s.text}</span>
                {s.mins ? (
                  <button className={`rc-timer${t ? " going" : ""}${left != null && left <= 0 ? " ring" : ""}`} onClick={() => (t ? stopTimer(i) : startTimer(i))} title={t ? "Stop this timer" : "Start a timer for this step"}>
                    ⏱ {t && left != null ? (left <= 0 ? "ding!" : clockLeft(left)) : clockMins(s.mins)}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="rc-bar">
        <button className="mini-btn" onClick={() => setHands(true)} disabled={!ingredients.length && !steps.length}>🙌 hands-free</button>
        <button className="mini-btn ghost" onClick={edit}>✎ edit / paste</button>
      </div>
      {hands && (
        <HandsFree
          title={mod.title}
          ingredients={ingredients.map((i) => ({ ...i, shown: show(i, scale, system).text }))}
          steps={steps}
          timerFor={(i) => {
            const t = timerFor(i);
            return t?.endsAt ? t.endsAt - now : null;
          }}
          startTimer={startTimer}
          onClose={() => setHands(false)}
        />
      )}
    </div>
  );
}
