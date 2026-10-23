import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { agoLabel } from "../../utils/date";
import AutoTA from "../AutoTA";

// A stack of sticky notes. The top note is the current step: type straight
// onto it, ✓ peels it off (and logs practice), the next note moves up.
export default function NextUp({ board, mod, setState, expanded }) {
  const { logPractice, undoLog, toast } = useData();
  const [peeling, setPeeling] = useState(null);
  const [then, setThen] = useState("");
  const [showDone, setShowDone] = useState(false);
  const { items = [], done = [] } = mod.state;
  const top = items[0];

  const editTop = (text) =>
    setState(
      (s) =>
        s.items.length
          ? { ...s, items: [{ ...s.items[0], text }, ...s.items.slice(1)] }
          : { ...s, items: [{ id: uid(), text, createdAt: Date.now() }] },
      { debounce: 600 }
    );

  const close = (how) => {
    if (!top || peeling) return;
    const item = top;
    setPeeling(how);
    setTimeout(() => {
      setPeeling(null);
      setState((s) => ({
        ...s,
        items: s.items.filter((i) => i.id !== item.id),
        done: [{ ...item, closedAt: Date.now(), how }, ...s.done].slice(0, 300),
      }));
      const log = how === "done" ? logPractice(board.id, `✓ ${item.text}`) : null;
      toast({
        text: how === "done" ? `peeled off “${item.text}”` : `dropped “${item.text}”`,
        actions: [{
          label: "undo",
          run: () => {
            setState((s) => ({ ...s, items: [item, ...s.items], done: s.done.filter((d) => d.id !== item.id) }));
            if (log) undoLog(log);
          },
        }],
      });
    }, 380);
  };

  const addThen = () => {
    const text = then.trim();
    if (!text) return;
    setState((s) => ({ ...s, items: [...s.items, { id: uid(), text, createdAt: Date.now() }] }));
    setThen("");
  };

  const removeQueued = (id) => setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }));
  const restore = (d) =>
    setState((s) => {
      const { closedAt, how, ...item } = d;
      return { ...s, items: [item, ...s.items], done: s.done.filter((x) => x.id !== d.id) };
    });

  const queued = items.slice(1);

  return (
    <div className="nx">
      <div className="nx-stack" data-depth={Math.min(queued.length, 3)}>
        <div
          className={`nx-note${peeling ? ` peel-${peeling}` : ""}${top ? "" : " empty"}`}
          // A note erased down to nothing just goes away
          onBlur={() => top && !top.text.trim() && removeQueued(top.id)}
        >
          <AutoTA
            className="nx-text"
            value={top?.text ?? ""}
            placeholder="what's next?"
            onChange={editTop}
          />
          {top && (
            <div className="nx-actions">
              <button className="nx-done" onClick={() => close("done")} title="Done — peel it off">✓</button>
              <button className="nx-drop" onClick={() => close("dropped")} title="Not doing this">✕</button>
            </div>
          )}
        </div>
      </div>

      {(expanded ? queued : queued.slice(0, 2)).map((q, i) => (
        <div key={q.id} className="nx-queued">
          <span className="nx-queued-n">{i + 2}</span>
          <span className="nx-queued-text">{q.text}</span>
          <button className="x-btn" onClick={() => removeQueued(q.id)} aria-label="Remove">✕</button>
        </div>
      ))}
      {!expanded && queued.length > 2 && <div className="nx-more">+{queued.length - 2} more underneath</div>}

      {top && (
        <input
          className="line-input nx-then"
          placeholder="+ then…"
          value={then}
          onChange={(e) => setThen(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addThen()}
          onBlur={addThen}
        />
      )}

      {done.length > 0 && (
        <button className="pile-toggle" onClick={() => setShowDone((v) => !v)}>
          {showDone ? "▾" : "▸"} done pile ({done.length})
        </button>
      )}
      {showDone && (
        <div className="pile">
          {done.slice(0, expanded ? 300 : 8).map((d) => (
            <div key={d.id} className={`pile-row ${d.how}`}>
              <span className="pile-text">{d.text}</span>
              <span className="pile-when">{agoLabel(d.closedAt)}</span>
              <button className="x-btn" onClick={() => restore(d)} title="Put back on top">↺</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
