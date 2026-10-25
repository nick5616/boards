import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { classify, takeIn } from "../../lib/paste";
import { hash } from "../Sticker";

const TAG_COLORS = ["#fff6d6", "#ffe3d6", "#e3f2dc", "#dde9f7", "#efe2f7", "#fbe7ef"];

// Paper tags on a string, one per link. The name is a guess from the address;
// type over it to fix it. ↗ opens the page.
export default function Links({ mod, setState }) {
  const { toast } = useData();
  const [input, setInput] = useState("");
  const items = mod.state.items ?? [];

  const add = () => {
    const raw = input.trim();
    if (!raw) return;
    const p = classify({ images: [], text: /^https?:\/\//i.test(raw) ? raw : `https://${raw}` });
    if (p?.kind !== "link") return toast({ text: "that doesn't look like a link" });
    setState((s) => takeIn("links", s, p));
    setInput("");
  };
  const edit = (id, title) =>
    setState((s) => ({ ...s, items: s.items.map((l) => (l.id === id ? { ...l, title } : l)) }), { debounce: 600 });
  const remove = (l) => {
    setState((s) => ({ ...s, items: s.items.filter((x) => x.id !== l.id) }));
    toast({ text: `untied “${l.title}”`, actions: [{ label: "undo", run: () => setState((s) => ({ ...s, items: [...s.items, l] })) }] });
  };

  return (
    <div className="lk">
      {items.map((l) => (
        <div key={l.id} className="lk-tag" style={{ "--tag": TAG_COLORS[hash(l.domain) % TAG_COLORS.length] }}>
          <span className="lk-hole" aria-hidden="true" />
          <div className="lk-words">
            <input className="lk-title" value={l.title} onChange={(e) => edit(l.id, e.target.value)} aria-label="Name" />
            <span className="lk-domain">{l.domain}</span>
          </div>
          <a className="lk-open" href={l.url} target="_blank" rel="noopener noreferrer" title={l.url} aria-label={`Open ${l.title}`}>
            ↗
          </a>
          <button className="x-btn" onClick={() => remove(l)} aria-label="Remove">✕</button>
        </div>
      ))}
      <input
        className="line-input lk-add"
        placeholder={items.length ? "+ paste a link…" : "+ paste a link — or paste one onto the board"}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        onBlur={add}
      />
    </div>
  );
}
