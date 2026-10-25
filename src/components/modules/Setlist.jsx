import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import LinkOut from "./LinkOut";

export const STAGES = ["learning", "getting there", "polishing", "nailed it"];
const NAILED = STAGES.length - 1;

// A mixtape J-card. Each track climbs through the stages with a tap; side A
// is what's in progress, side B is what you can play.
export default function Setlist({ mod, setState, expanded }) {
  const { toast } = useData();
  const [input, setInput] = useState("");
  const items = mod.state.items ?? [];
  const sideA = items.filter((t) => (t.stage ?? 0) < NAILED);
  const sideB = items.filter((t) => t.stage === NAILED);

  const patch = (id, p) => setState((s) => ({ ...s, items: s.items.map((t) => (t.id === id ? { ...t, ...p } : t)) }));

  const advance = (t) => {
    const stage = ((t.stage ?? 0) + 1) % STAGES.length;
    patch(t.id, { stage, ...(stage === NAILED ? { nailedAt: Date.now() } : {}) });
    if (stage === NAILED) {
      toast({ text: `★ nailed “${t.text}”`, actions: [{ label: "undo", run: () => patch(t.id, { stage: t.stage }) }] });
    }
  };

  const add = () => {
    if (!input.trim()) return;
    setState((s) => ({ ...s, items: [...(s.items ?? []), { id: uid(), text: input.trim(), stage: 0, createdAt: Date.now() }] }));
    setInput("");
  };

  const remove = (t) => {
    setState((s) => ({ ...s, items: s.items.filter((x) => x.id !== t.id) }));
    toast({ text: `took “${t.text}” off the tape`, actions: [{ label: "undo", run: () => setState((s) => ({ ...s, items: [...s.items, t] })) }] });
  };

  const track = (t, i, side) => (
    <div key={t.id} className={`mx-track${side === "B" ? " nailed" : ""}`}>
      <span className="mx-n">{side}{i + 1}</span>
      {expanded ? (
        <input
          className="mx-text"
          value={t.text}
          onChange={(e) => patch(t.id, { text: e.target.value })}
          aria-label="Track name"
        />
      ) : (
        <span className="mx-text">{t.text}</span>
      )}
      <LinkOut url={t.url} />
      <button
        className="mx-stage"
        onClick={() => advance(t)}
        title={`${STAGES[t.stage ?? 0]} (tap to move along)`}
        aria-label={`${t.text}: ${STAGES[t.stage ?? 0]}. Tap to move along`}
      >
        {t.stage === NAILED ? "★" : STAGES.slice(1).map((_, k) => <i key={k} className={k < (t.stage ?? 0) ? "on" : ""} />)}
      </button>
      {expanded && <button className="x-btn" onClick={() => remove(t)} aria-label="Remove track">✕</button>}
    </div>
  );

  return (
    <div className="mx">
      <div className="mx-tape" aria-hidden="true">
        <span className="mx-label">{mod.title}</span>
        <span className="mx-reels"><i /><i /></span>
      </div>
      <div className="mx-side">side A · in progress</div>
      {sideA.map((t, i) => track(t, i, "A"))}
      <input
        className="mx-add"
        placeholder="+ add a track…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        onBlur={add}
      />
      {sideB.length > 0 && (
        <>
          <div className="mx-side">side B · nailed it</div>
          {sideB.map((t, i) => track(t, i, "B"))}
        </>
      )}
      {!expanded && items.length > 0 && <div className="mx-legend">tap the dots to move a track along</div>}
    </div>
  );
}
