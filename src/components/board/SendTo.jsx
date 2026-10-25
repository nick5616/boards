import { useState } from "react";
import { MODULES } from "../../constants/modules";

// The wires a module has: modules on this board that take its readings.
// Ones that have since been removed are ignored.
export const wiredTo = (board, mod) =>
  (mod.state.sendTo ?? []).map((id) => board.modules.find((m) => m.id === id)).filter(Boolean);

// "Send readings to…": tick the graphs, tallies and jars on this board that should
// get a reading when a session is logged. fold = hide the list behind a small button.
export default function SendTo({ board, mod, setState, fold = false, note }) {
  const [open, setOpen] = useState(!fold);
  const wired = wiredTo(board, mod).map((m) => m.id);
  const targets = board.modules.filter((m) => MODULES[m.type]?.receive);
  const set = (sendTo) => setState((s) => ({ ...s, sendTo }));

  return (
    <div className="met-send">
      {fold && (
        <button className="mini-btn ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "put the wires away" : wired.length ? "rewire…" : "→ send readings…"}
        </button>
      )}
      {open && (
        <>
          <b>Send readings to…</b>
          {targets.length === 0 && <span className="met-none">add a graph, tally or jar to this board</span>}
          {targets.map((m) => (
            <label key={m.id} className="met-row">
              <input
                type="checkbox"
                checked={wired.includes(m.id)}
                onChange={(e) => set(e.target.checked ? [...wired, m.id] : wired.filter((x) => x !== m.id))}
              />
              {m.title}
            </label>
          ))}
          {wired.length > 0 && note && <span className="met-none">{note}</span>}
        </>
      )}
    </div>
  );
}

// A tiny tag on the card showing where it sends: "→ Graph paper"
export function WireTag({ board, mod }) {
  const to = wiredTo(board, mod);
  if (!to.length) return null;
  return (
    <div className="wire-tag" title="Sends a reading here whenever a session is logged">
      {to.map((m) => (
        <span key={m.id}>→ {m.title}</span>
      ))}
    </div>
  );
}
