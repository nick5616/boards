import { useState } from "react";
import { uid } from "../../utils/uid";
import { dayKey } from "../../utils/date";
import { hash } from "../Sticker";

// Fortune cookies: things a teacher said, or that you keep needing to hear.
// One comes up each day; crack another if it doesn't land.
export default function Fortune({ mod, setState, expanded }) {
  const [extra, setExtra] = useState(0);
  const [cracking, setCracking] = useState(false);
  const [input, setInput] = useState("");
  const items = mod.state.items ?? [];
  const seed = `${dayKey()}${mod.id}`;
  const pick = items.length ? items[(hash(seed) + extra) % items.length] : null;
  const lucky = Array.from({ length: 6 }, (_, i) => (hash(`${seed}${extra}${i}`) % 49) + 1);

  const crack = () => {
    if (items.length < 2 || cracking) return;
    setCracking(true);
    setTimeout(() => {
      setExtra((n) => n + 1);
      setCracking(false);
    }, 260);
  };

  const add = () => {
    if (!input.trim()) return;
    setState((s) => ({ ...s, items: [...(s.items ?? []), { id: uid(), text: input.trim(), createdAt: Date.now() }] }));
    setInput("");
  };

  return (
    <div className="ft">
      {pick ? (
        <div className={`ft-slip${cracking ? " cracking" : ""}`}>
          <div className="ft-text">{pick.text}</div>
          <div className="ft-lucky">lucky numbers {lucky.join(" ")}</div>
        </div>
      ) : (
        <div className="ft-slip empty">
          <div className="ft-text">add something worth hearing again</div>
        </div>
      )}
      {items.length > 1 && (
        <button className="ft-crack" onClick={crack}>🥠 crack another</button>
      )}
      <input
        className="line-input ft-add"
        placeholder="+ “slow is smooth, smooth is fast”"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        onBlur={add}
      />
      {expanded &&
        items.map((f) => (
          <div key={f.id} className="pile-row ft-row">
            <span className="pile-text">{f.text}</span>
            <button
              className="x-btn"
              onClick={() => setState((s) => ({ ...s, items: s.items.filter((x) => x.id !== f.id) }))}
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))}
    </div>
  );
}
