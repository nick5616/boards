import { useState } from "react";
import { uid } from "../../utils/uid";
import { useBoardContext } from "../board/BoardContext";

// A whiteboard of tickets. The columns are whatever states you say (tape strips across the
// top: click one to rename it), and tickets are sticky notes that move along them: drag one
// over, or nudge it with ◀ ▶. The last column reads as "done", so its notes go quiet.

const TICKET = "application/x-boards-ticket";

function Ticket({ t, first, last, onMove, onEdit, onDrop, readOnly, expanded }) {
  const [editing, setEditing] = useState(!t.title);
  return (
    <li
      className="kb-ticket"
      draggable={!readOnly && !editing}
      onDragStart={(e) => {
        e.dataTransfer.setData(TICKET, t.id);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      {editing && !readOnly ? (
        <textarea
          className="kb-edit"
          autoFocus
          rows={2}
          defaultValue={t.title}
          placeholder="what's the ticket?"
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) (e.preventDefault(), e.currentTarget.blur());
            if (e.key === "Escape") (e.stopPropagation(), e.currentTarget.blur());
          }}
          onBlur={(e) => {
            setEditing(false);
            const v = e.target.value.trim();
            v ? v !== t.title && onEdit(v) : onDrop();
          }}
          aria-label="Ticket"
        />
      ) : (
        <button className="kb-title" onClick={() => !readOnly && setEditing(true)} title={t.title}>
          {t.title}
        </button>
      )}
      {!readOnly && !editing && (
        <div className="kb-nudge">
          <button onClick={() => onMove(-1)} disabled={first} aria-label="Move back a column">◀</button>
          {expanded && <button onClick={onDrop} aria-label={`Remove ${t.title}`}>✕</button>}
          <button onClick={() => onMove(1)} disabled={last} aria-label="Move on a column">▶</button>
        </div>
      )}
    </li>
  );
}

export default function Kanban({ mod, setState, expanded }) {
  const { readOnly } = useBoardContext() ?? {};
  const cols = mod.state.columns ?? [];
  const tickets = mod.state.tickets ?? [];
  const [over, setOver] = useState(null); // the column a ticket is being dragged over

  const setTickets = (fn) => setState((s) => ({ ...s, tickets: fn(s.tickets ?? []) }));
  const setCols = (fn) => setState((s) => ({ ...s, columns: fn(s.columns ?? []) }));

  const add = (col) => setTickets((ts) => [...ts, { id: uid(), col, title: "", at: Date.now() }]);
  const place = (id, col) => setTickets((ts) => [...ts.filter((t) => t.id !== id), { ...ts.find((t) => t.id === id), col, moved: Date.now() }]);
  const nudge = (t, d) => {
    const i = cols.findIndex((c) => c.id === t.col) + d;
    if (cols[i]) place(t.id, cols[i].id);
  };
  const rename = (c) => {
    const name = prompt("Call this column", c.name)?.trim();
    if (name) setCols((cs) => cs.map((x) => (x.id === c.id ? { ...x, name } : x)));
  };
  const addCol = () => {
    const name = prompt("A new column (a state a ticket can be in)", "")?.trim();
    if (name) setCols((cs) => [...cs.slice(0, -1), { id: uid(), name }, ...cs.slice(-1)]);
  };
  const dropCol = (c) => {
    const n = tickets.filter((t) => t.col === c.id).length;
    const to = cols.find((x) => x.id !== c.id);
    if (!to) return;
    if (n && !confirm(`Take away “${c.name}”? Its ${n} ticket${n === 1 ? "" : "s"} go to “${to.name}”.`)) return;
    setState((s) => ({
      ...s,
      columns: (s.columns ?? []).filter((x) => x.id !== c.id),
      tickets: (s.tickets ?? []).map((t) => (t.col === c.id ? { ...t, col: to.id } : t)),
    }));
  };
  const shift = (c, d) =>
    setCols((cs) => {
      const i = cs.indexOf(cs.find((x) => x.id === c.id));
      const j = i + d;
      if (j < 0 || j >= cs.length) return cs;
      const out = cs.slice();
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });

  return (
    <div className={`kb${expanded ? " big" : ""}`}>
      <div className="kb-board" style={{ "--n": cols.length }}>
        {cols.map((c, ci) => {
          const here = tickets.filter((t) => t.col === c.id);
          const done = ci === cols.length - 1 && cols.length > 1;
          return (
            <section
              key={c.id}
              className={`kb-col${done ? " done" : ""}${over === c.id ? " over" : ""}`}
              onDragOver={(e) => {
                if (readOnly || !e.dataTransfer.types.includes(TICKET)) return;
                e.preventDefault();
                e.stopPropagation();
                setOver(c.id);
              }}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setOver(null)}
              onDrop={(e) => {
                setOver(null);
                const id = e.dataTransfer.getData(TICKET);
                if (!id) return;
                e.preventDefault();
                e.stopPropagation();
                place(id, c.id);
              }}
              aria-label={c.name}
            >
              <header className="kb-head">
                <button className="kb-tape" onClick={() => !readOnly && rename(c)} title={readOnly ? c.name : "Rename"}>
                  {c.name}
                </button>
                <span className="kb-n">{here.length}</span>
              </header>
              {expanded && !readOnly && (
                <div className="kb-colacts">
                  <button onClick={() => shift(c, -1)} disabled={ci === 0} aria-label={`Move ${c.name} left`}>◀</button>
                  <button onClick={() => dropCol(c)} disabled={cols.length < 2} aria-label={`Remove ${c.name}`}>✕</button>
                  <button onClick={() => shift(c, 1)} disabled={ci === cols.length - 1} aria-label={`Move ${c.name} right`}>▶</button>
                </div>
              )}
              <ul className="kb-list">
                {here.map((t) => (
                  <Ticket
                    key={t.id}
                    t={t}
                    first={ci === 0}
                    last={ci === cols.length - 1}
                    readOnly={readOnly}
                    expanded={expanded}
                    onMove={(d) => nudge(t, d)}
                    onEdit={(title) => setTickets((ts) => ts.map((x) => (x.id === t.id ? { ...x, title } : x)))}
                    onDrop={() => setTickets((ts) => ts.filter((x) => x.id !== t.id))}
                  />
                ))}
              </ul>
              {!readOnly && (
                <button className="kb-add" onClick={() => add(c.id)} aria-label={`New ticket in ${c.name}`}>+</button>
              )}
            </section>
          );
        })}
        {expanded && !readOnly && (
          <button className="kb-addcol" onClick={addCol}>+ column</button>
        )}
      </div>
    </div>
  );
}
