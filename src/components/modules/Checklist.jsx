import { useState } from "react";
import { uid } from "../../utils/uid";
import { asChecks } from "../../lib/takein";
import { useBoardContext } from "../board/BoardContext";
import { Fold } from "./kit";

// A clipboard with a ruled sheet of boxes. Ticks stay where they are (it's a list you go down,
// not a queue), so a packing list or a before-you-leave list can be unticked and used again.
// When every box is ticked the sheet gets a stamp.

const SHOW = 8; // rows on the small card before "+ N more"

export default function Checklist({ mod, setState, openBig, expanded }) {
  const { readOnly } = useBoardContext() ?? {};
  const items = mod.state.items ?? [];
  const [draft, setDraft] = useState("");
  const done = items.filter((x) => x.done).length;
  const all = items.length > 0 && done === items.length;

  const setItems = (fn, opts) => setState((s) => ({ ...s, items: fn(s.items ?? []) }), opts);
  const tick = (id) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  const edit = (id, text) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, text } : x)), { debounce: 600 });
  const drop = (id) => setItems((xs) => xs.filter((x) => x.id !== id));
  const add = () => {
    const lines = draft.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setItems((xs) => [...xs, ...lines.map((text) => ({ id: uid(), text, done: false }))]);
    setDraft("");
  };

  const shown = expanded ? items : items.slice(0, SHOW);

  return (
    <div className={`ckl${expanded ? " big" : ""}`}>
      <div className="ckl-board">
        <div className="ckl-clip" aria-hidden="true"><i /></div>
        <div className="ckl-sheet">
          {items.length > 0 && (
            <div className="ckl-count" aria-label={`${done} of ${items.length} done`}>
              {done}/{items.length}
            </div>
          )}
          <ul className="ckl-list">
            {shown.map((x) => (
              <li key={x.id} className={x.done ? "done" : ""}>
                <button className="ckl-box" onClick={() => !readOnly && tick(x.id)} role="checkbox" aria-checked={!!x.done} aria-label={x.text || "item"}>
                  {x.done && (
                    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 10.5l4.5 4.5L17 3.5" /></svg>
                  )}
                </button>
                <input
                  className="ckl-text"
                  value={x.text}
                  readOnly={readOnly}
                  onChange={(e) => edit(x.id, e.target.value)}
                  // erased down to nothing, the row goes
                  onBlur={(e) => !e.target.value.trim() && drop(x.id)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  aria-label="Item"
                />
                {!readOnly && (
                  <button className="x-btn ckl-x" onClick={() => drop(x.id)} aria-label={`Remove ${x.text}`}>✕</button>
                )}
              </li>
            ))}
          </ul>
          {!expanded && items.length > SHOW && (
            <button className="ckl-more" onClick={openBig}>+ {items.length - SHOW} more</button>
          )}
          {!readOnly && (
            <input
              className="line-input ckl-add"
              value={draft}
              placeholder={items.length ? "+ add…" : "+ the first thing to check…"}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              onBlur={add}
              onPaste={(e) => {
                // a pasted list becomes a box per line
                const t = e.clipboardData.getData("text/plain");
                if (!t.includes("\n")) return;
                e.preventDefault();
                setItems((xs) => [...xs, ...asChecks(t)]);
              }}
              aria-label="Add an item"
            />
          )}
          {all && <div className="ckl-stamp" aria-hidden="true">all done</div>}
        </div>
      </div>

      {!readOnly && done > 0 && (
        <Fold>
          <div className="ckl-acts">
            <button className="mini-btn ghost" onClick={() => setItems((xs) => xs.map((x) => ({ ...x, done: false })))}>uncheck all</button>
            <button className="mini-btn ghost" onClick={() => setItems((xs) => xs.filter((x) => !x.done))}>clear the ticked ones</button>
          </div>
        </Fold>
      )}
    </div>
  );
}

