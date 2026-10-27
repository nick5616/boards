import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { AISLES, keyWord, addLine } from "../../lib/groceries";


// A long receipt of things to buy, grouped by aisle in walking order. Tick one and a pencil
// strikes it out, then it drops to the bottom ("in the cart") until you clear it.
export default function Groceries({ mod, setState, expanded }) {
  const { uid: me } = useData();
  const { items = [], learn = {} } = mod.state;
  const [text, setText] = useState("");
  const [striking, setStriking] = useState({}); // id -> true while the pencil is still going

  const add = () => {
    const t = text.trim();
    if (!t) return;
    setState((s) => {
      const n = addLine(s, t);
      // stamp who wrote it
      const fresh = n.items.find((i) => !(s.items ?? []).some((o) => o.id === i.id));
      return fresh ? { ...n, items: n.items.map((i) => (i === fresh ? { ...i, by: me } : i)) } : n;
    });
    setText("");
  };

  const buy = (it) => {
    if (it.done) return setState((s) => ({ ...s, items: s.items.map((i) => (i.id === it.id ? { ...i, done: false, doneAt: null } : i)) }));
    setStriking((m) => ({ ...m, [it.id]: true }));
    setTimeout(() => {
      setState((s) => ({ ...s, items: s.items.map((i) => (i.id === it.id ? { ...i, done: true, doneAt: Date.now() } : i)) }));
      setStriking((m) => {
        const { [it.id]: _gone, ...rest } = m;
        return rest;
      });
    }, 520);
  };
  const qty = (id, by) => setState((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, qty: Math.max(1, (i.qty ?? 1) + by) } : i)) }));
  const move = (it, aisle) =>
    setState((s) => ({
      ...s,
      items: s.items.map((i) => (i.id === it.id ? { ...i, aisle } : i)),
      learn: { ...(s.learn ?? {}), [keyWord(it.text)]: aisle }, // next time, that word goes there
    }));
  const remove = (id) => setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }));

  const open = items.filter((i) => !i.done);
  let shown = 0;
  const cart = items.filter((i) => i.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));

  const row = (it) => (
    <div key={it.id} className={`gr-row${it.done ? " done" : ""}${striking[it.id] ? " striking" : ""}`}>
      <button className="gr-box" onClick={() => buy(it)} aria-label={it.done ? `Put ${it.text} back` : `Got ${it.text}`} aria-pressed={it.done}>
        {(it.done || striking[it.id]) && <svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.3L13 4" /></svg>}
      </button>
      <span className="gr-text">
        {(it.qty ?? 1) > 1 && <b className="gr-qty">{it.qty}×</b>}
        <span className="gr-name">{it.text}</span>
      </span>
      {!it.done && (
        <span className="gr-tools">
          <button onClick={() => qty(it.id, -1)} aria-label={`Fewer ${it.text}`} disabled={(it.qty ?? 1) < 2}>−</button>
          <button onClick={() => qty(it.id, 1)} aria-label={`More ${it.text}`}>+</button>
          <select value={it.aisle} onChange={(e) => move(it, e.target.value)} aria-label={`Aisle for ${it.text}`}>
            {AISLES.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
          </select>
        </span>
      )}
      <button className="gr-x" onClick={() => remove(it.id)} aria-label={`Remove ${it.text}`}>✕</button>
    </div>
  );

  return (
    <div className="gr">
      <div className="gr-paper">
        <div className="gr-head">
          <b>CORNER MARKET</b>
          <small>— the list, in walking order —</small>
        </div>

        {AISLES.map((a) => {
          const mine = open.filter((i) => i.aisle === a.id || (!AISLES.some((x) => x.id === i.aisle) && a.id === "other"));
          if (!mine.length) return null;
          const num = ++shown; // numbered as you'd walk them, skipping empty aisles
          return (
            <section key={a.id} className="gr-aisle">
              <h4>{a.icon} AISLE {num} · {a.label.toUpperCase()}</h4>
              {mine.map(row)}
            </section>
          );
        })}
        {open.length === 0 && <div className="gr-none">{cart.length ? "all done! ✨" : "nothing yet. what's running low?"}</div>}

        {cart.length > 0 && (
          <section className="gr-aisle gr-cart">
            <h4>🛒 IN THE CART ({cart.length})</h4>
            {(expanded ? cart : cart.slice(0, 6)).map(row)}
            {!expanded && cart.length > 6 && <div className="gr-more">+{cart.length - 6} more</div>}
            <button className="gr-clear" onClick={() => setState((s) => ({ ...s, items: s.items.filter((i) => !i.done) }))}>clear the cart</button>
          </section>
        )}

        <div className="gr-total">
          <span>ITEMS TO GET</span>
          <i />
          <b>{open.reduce((t, i) => t + (i.qty ?? 1), 0)}</b>
        </div>
        <input
          className="gr-add"
          placeholder="+ add (2 eggs, milk…)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          aria-label="Add to the list"
        />
        <div className="gr-thanks">THANK YOU · PASTE A LIST TO ADD MANY</div>
      </div>
    </div>
  );
}
