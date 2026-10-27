import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import AutoTA from "../AutoTA";
import { CARD_W, CARD_COLORS, STRING_COLORS, newCard } from "../../lib/cork";

const PIN_DY = 9; // where a card's pin sits below its top edge

// Pinned between two pins: a thread that hangs a little loose
const sagPath = (a, b) => {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 + Math.min(60, Math.hypot(a.x - b.x, a.y - b.y) * 0.16 + 10);
  return `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`;
};

// A cork board of index cards. Drag them by the pin strip, write on them (@-mentions
// work), and tie a coloured string between two to say how scenes and ideas connect.
export default function Corkboard({ mod, setState }) {
  const { toast } = useData();
  const { cards = [], threads = [] } = mod.state;
  const [drag, setDrag] = useState(null); // { id, x, y, dx, dy } while a card is in the air
  const [tying, setTying] = useState(false);
  const [from, setFrom] = useState(null); // the first card picked for a string
  const [ink, setInk] = useState(0); // which string colour

  const patchCard = (id, patch, opts) =>
    setState((s) => ({ ...s, cards: (s.cards ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)) }), opts);

  const at = (c) => (drag?.id === c.id ? { x: drag.x, y: drag.y } : c);
  const pin = (c) => ({ x: at(c).x + CARD_W / 2, y: at(c).y + PIN_DY });

  const grab = (e, c) => {
    if (e.button > 0 || e.target.closest("button")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id: c.id, x: c.x, y: c.y, dx: e.clientX - c.x, dy: e.clientY - c.y });
  };
  const move = (e) => drag && setDrag({ ...drag, x: Math.max(0, e.clientX - drag.dx), y: Math.max(0, e.clientY - drag.dy) });
  const drop = () => {
    if (drag) patchCard(drag.id, { x: Math.round(drag.x), y: Math.round(drag.y) });
    setDrag(null);
  };

  const add = () => setState((s) => ({ ...s, cards: [...(s.cards ?? []), newCard(s.cards ?? [])] }));

  const remove = (c) => {
    const had = threads.filter((t) => t.a === c.id || t.b === c.id);
    setState((s) => ({
      ...s,
      cards: (s.cards ?? []).filter((x) => x.id !== c.id),
      threads: (s.threads ?? []).filter((t) => t.a !== c.id && t.b !== c.id),
    }));
    if (c.text.trim() || had.length) {
      toast({
        text: "card taken down",
        actions: [{ label: "undo", run: () => setState((s) => ({ ...s, cards: [...(s.cards ?? []), c], threads: [...(s.threads ?? []), ...had] })) }],
      });
    }
  };

  // In tying mode a click picks a card; the second one ties (or, if they're already tied, snips)
  const pick = (c) => {
    if (!from) return setFrom(c.id);
    if (from === c.id) return setFrom(null);
    const a = from;
    setFrom(null);
    setState((s) => {
      const have = (s.threads ?? []).find((t) => (t.a === a && t.b === c.id) || (t.a === c.id && t.b === a));
      return {
        ...s,
        threads: have ? s.threads.filter((t) => t !== have) : [...(s.threads ?? []), { a, b: c.id, c: STRING_COLORS[ink] }],
      };
    });
  };

  const snip = (t) => {
    setState((s) => ({ ...s, threads: (s.threads ?? []).filter((x) => x !== t) }));
    toast({ text: "snipped", actions: [{ label: "undo", run: () => setState((s) => ({ ...s, threads: [...(s.threads ?? []), t] })) }] });
  };

  const byId = new Map(cards.map((c) => [c.id, c]));
  const live = threads.filter((t) => byId.has(t.a) && byId.has(t.b));
  const wide = Math.max(0, ...cards.map((c) => at(c).x)) + CARD_W + 24;
  const tall = Math.max(0, ...cards.map((c) => at(c).y)) + 150;

  return (
    <div className={`cb${tying ? " tying" : ""}`}>
      <div className="cb-cork" onPointerMove={move} onPointerUp={drop} onPointerCancel={() => setDrag(null)}>
        <div className="cb-sheet" style={{ minWidth: wide, minHeight: tall }}>
          {cards.map((c, i) => (
            <div
              key={c.id}
              className={`cb-card${drag?.id === c.id ? " lifted" : ""}${from === c.id ? " picked" : ""}`}
              style={{ left: at(c).x, top: at(c).y, backgroundColor: c.color, "--tilt": `${((i * 37) % 7) - 3}deg` }}
            >
              <div className="cb-strip" onPointerDown={(e) => grab(e, c)} title="Drag to move">
                <button className="cb-dot" style={{ background: c.color }} aria-label="Change the card colour"
                  onClick={() => patchCard(c.id, { color: CARD_COLORS[(CARD_COLORS.indexOf(c.color) + 1) % CARD_COLORS.length] })} />
                <i className="cb-pin" />
                <button className="cb-x" onClick={() => remove(c)} aria-label="Take this card down">✕</button>
              </div>
              <AutoTA
                className="cb-text"
                rich
                liveId={c.id}
                value={c.text}
                placeholder="a scene, an idea…"
                onChange={(v) => patchCard(c.id, { text: v }, { debounce: 600 })}
              />
              {tying && <button className="cb-hit" onClick={() => pick(c)} aria-label="Tie a string to this card" />}
            </div>
          ))}
          <svg className="cb-threads" width="100%" height="100%" aria-hidden="true">
            {live.map((t) => {
              const d = sagPath(pin(byId.get(t.a)), pin(byId.get(t.b)));
              return (
                <g key={`${t.a}-${t.b}`}>
                  <path className="cb-string" d={d} stroke={t.c ?? STRING_COLORS[0]} />
                  <path className="cb-snip" d={d} onClick={() => snip(t)}><title>click to snip</title></path>
                </g>
              );
            })}
          </svg>
          {!cards.length && (
            <div className="cb-hint">
              <b>an empty board</b>
              pin up a card, then tie some together
            </div>
          )}
        </div>
      </div>
      <div className="cb-bar">
        <button className="mini-btn" onClick={add}>+ card</button>
        <button className={`mini-btn${tying ? " on" : ""}`} onClick={() => { setTying((v) => !v); setFrom(null); }} aria-pressed={tying}>
          🧵 {tying ? (from ? "now the other card" : "pick a card") : "tie"}
        </button>
        {tying && STRING_COLORS.map((c, i) => (
          <button key={c} className={`cb-spool${i === ink ? " sel" : ""}`} style={{ background: c }} onClick={() => setInk(i)} aria-label={`String colour ${i + 1}`} />
        ))}
        {!tying && live.length > 0 && <span className="cb-count">{live.length} string{live.length === 1 ? "" : "s"}</span>}
      </div>
    </div>
  );
}
