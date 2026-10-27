import { useState } from "react";
import { findTown, hereNow } from "../../lib/garden";
import { setHomePlace } from "../../lib/place";

// Small shared pieces so every module reads the same way (see docs/plans/ui-kit.md).
// Styles are in src/styles/kit.css.

// A row of choices where one is on: tabs inside a module, units, filters.
// options: [{ id, label }] or plain strings. Scrolls sideways if it runs out of room.
export function Seg({ options, value, onChange, label, small = false }) {
  return (
    <div className={`seg${small ? " seg-sm" : ""}`} role="tablist" aria-label={label}>
      {options.map((o) => {
        const id = typeof o === "string" ? o : o.id;
        const text = typeof o === "string" ? o : o.label;
        return (
          <button key={id} role="tab" aria-selected={value === id} className={value === id ? "on" : ""} onClick={() => onChange(id)}>
            {text}
          </button>
        );
      })}
    </div>
  );
}

// What an empty module says: one line, and the one thing to do about it
export function Empty({ children, action }) {
  return (
    <div className="mod-empty">
      <p>{children}</p>
      {action}
    </div>
  );
}

// Secondary controls tucked away until asked for
export function Fold({ label = "more", children, start = false }) {
  const [open, setOpen] = useState(start);
  return (
    <div className={`fold${open ? " open" : ""}`}>
      <button className="fold-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "less" : label} <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && <div className="fold-body">{children}</div>}
    </div>
  );
}

// Chips that scroll sideways instead of wrapping into a wall
export function ChipRow({ children, label }) {
  return <div className="chip-row" role="group" aria-label={label}>{children}</div>;
}

// The one-line foot: where the data came from, when, and refresh. Never more than a line.
export function Credit({ children, at, loading, error, stale, reload }) {
  const state = error ? "couldn't reach it" : loading ? "checking…" : stale ? "offline · last look" : at ? `updated ${new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : null;
  return (
    <div className={`mod-credit${error ? " bad" : ""}`}>
      {children && <span className="mod-credit-src">{children}</span>}
      {state && <span>{state}</span>}
      {reload && <button onClick={reload} aria-label="Refresh">↻</button>}
    </div>
  );
}

// Asks where "here" is, once for every module. Compact: a button and a town box on one line.
// onPlace(place) also gets the answer if the module wants its own copy.
export function PlaceAsk({ why = "for this, boards needs to know roughly where you are", onPlace, home = true }) {
  const [town, setTown] = useState("");
  const [msg, setMsg] = useState("");
  const pick = (p) => {
    if (home) setHomePlace(p);
    onPlace?.(p);
  };
  const here = async () => {
    setMsg("");
    try { pick(await hereNow()); } catch { setMsg("couldn't find you, so type a town"); }
  };
  const find = async () => {
    const q = town.trim();
    if (!q) return;
    try {
      const p = await findTown(q);
      if (p) pick(p); else setMsg(`no town called "${q}"`);
    } catch { setMsg("couldn't reach the town finder"); }
  };
  return (
    <div className="place-ask">
      <p>{why}</p>
      <div className="place-ask-row">
        <button className="mini-btn" onClick={here}>📍 here</button>
        <input className="line-input" value={town} onChange={(e) => setTown(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find()} placeholder="or a town…" aria-label="Town" />
        <button className="mini-btn ghost" onClick={find} disabled={!town.trim()}>go</button>
      </div>
      {msg && <div className="place-ask-msg">{msg}</div>}
    </div>
  );
}
