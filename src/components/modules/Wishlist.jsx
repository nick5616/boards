import { useState } from "react";
import { uid } from "../../utils/uid";
import { agoLabel } from "../../utils/date";
import RichText from "../RichText";
import LinkOut from "./LinkOut";

// A receipt. Check something off and it's "got"; ✕ drops it. Both land in
// the pile at the bottom, where they can be put back.
export default function Wishlist({ mod, setState, expanded }) {
  const [input, setInput] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState(null); // the item being typed in; others with @-tags show as tags
  const { items = [], done = [] } = mod.state;

  const add = () => {
    if (!input.trim()) return;
    setState((s) => ({ ...s, items: [...s.items, { id: uid(), text: input.trim(), createdAt: Date.now() }] }));
    setInput("");
  };
  const close = (item, how) =>
    setState((s) => ({
      ...s,
      items: s.items.filter((i) => i.id !== item.id),
      done: [{ ...item, how, closedAt: Date.now() }, ...s.done].slice(0, 300),
    }));
  const restore = (d) =>
    setState((s) => {
      const { how, closedAt, ...item } = d;
      return { ...s, items: [...s.items, item], done: s.done.filter((x) => x.id !== d.id) };
    });
  const edit = (id, text) =>
    setState((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, text } : i)) }), { debounce: 600 });

  const got = done.filter((d) => d.how === "got").length;

  return (
    <div className="rcpt">
      {items.map((it) => (
        <div key={it.id} className="rcpt-row">
          <button className="rcpt-box" onClick={() => close(it, "got")} aria-label={`Got ${it.text}`} />
          {editing !== it.id && it.text.includes("@[") ? (
            <RichText className="rcpt-text" value={it.text} onEdit={() => setEditing(it.id)} />
          ) : (
            <input
              className="rcpt-text"
              value={it.text}
              autoFocus={editing === it.id}
              onBlur={() => setEditing(null)}
              onChange={(e) => edit(it.id, e.target.value)}
            />
          )}
          <LinkOut url={it.url} />
          <button className="x-btn" onClick={() => close(it, "dropped")} aria-label="Drop">✕</button>
        </div>
      ))}
      <input
        className="rcpt-add"
        placeholder="+ add…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        onBlur={add}
      />
      <div className="rcpt-total">
        <span>ITEMS {items.length}</span>
        <span>GOT {got}</span>
      </div>
      {done.length > 0 && (
        <button className="pile-toggle" onClick={() => setShowDone((v) => !v)}>
          {showDone ? "▾" : "▸"} got &amp; dropped ({done.length})
        </button>
      )}
      {showDone &&
        done.slice(0, expanded ? 300 : 10).map((d) => (
          <div key={d.id} className={`pile-row ${d.how}`}>
            <span className="pile-text">{d.how === "got" ? "✓ " : ""}<RichText value={d.text} /></span>
            <span className="pile-when">{agoLabel(d.closedAt)}</span>
            <button className="x-btn" onClick={() => restore(d)} title="Put back">↺</button>
          </div>
        ))}
    </div>
  );
}
