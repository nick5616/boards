import { useRef, useState } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { STICKER_COLORS, hash } from "../Sticker";
import { addWords, makeWord, readLine, spot, splitWords, suggest, tilt, SUGGEST_KINDS } from "../../lib/magnets";

const clamp = (v) => Math.min(0.92, Math.max(0, v));

// A fridge door with word magnets. Drag them around, drop one in the box to put it away,
// double-click to make another. Pick one and ask for rhymes; they show up as ghost magnets.
export default function Magnets({ board, mod, setState, expanded }) {
  const { uid: me, updateBoard, toast } = useData();
  const { words = [], box = [] } = mod.state;
  const [text, setText] = useState("");
  const [sel, setSel] = useState(null);
  const [drag, setDrag] = useState(null); // { id, x, y } while a magnet is in hand
  const [ghosts, setGhosts] = useState({ kind: null, list: [], busy: false });
  const [line, setLine] = useState(null);
  const [showBox, setShowBox] = useState(false);
  const door = useRef(null);
  const boxEl = useRef(null);
  const hold = useRef(null);

  const notes = board.modules.filter((m) => m.type === "notes");
  const selected = words.find((w) => w.id === sel);

  const add = () => {
    const ws = splitWords(text);
    if (!ws.length) return;
    setState((s) => addWords(s, ws, me));
    setText("");
  };

  // Words from every Notes module here, skipping ones already on the door
  const pull = () => {
    const ws = notes.flatMap((n) => (n.state.blocks ?? []).filter((b) => b.type === "text").flatMap((b) => splitWords(b.value)));
    const had = new Set(words.map((w) => w.text.toLowerCase()));
    const fresh = [...new Set(ws)].filter((w) => !had.has(w.toLowerCase())).slice(0, 40);
    if (!fresh.length) return toast({ text: "no new words in the notes here" });
    setState((s) => addWords(s, fresh, me));
    toast({ text: `${fresh.length} magnets from your notes` });
  };

  const shuffle = () => setState((s) => ({ ...s, words: (s.words ?? []).map((w) => ({ ...w, ...spot(), rot: tilt() })) }));

  const down = (e, w) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    hold.current = { id: w.id, sx: e.clientX, sy: e.clientY, ox: w.x, oy: w.y, moved: false };
  };
  const move = (e) => {
    const h = hold.current;
    if (!h || !door.current) return;
    // a little wobble is still a tap
    if (!h.moved && Math.hypot(e.clientX - h.sx, e.clientY - h.sy) < 4) return;
    h.moved = true;
    const r = door.current.getBoundingClientRect();
    h.at = { id: h.id, x: clamp(h.ox + (e.clientX - h.sx) / r.width), y: clamp(h.oy + (e.clientY - h.sy) / r.height) };
    setDrag(h.at);
  };
  const up = (e) => {
    const h = hold.current;
    hold.current = null;
    setDrag(null);
    if (!h) return;
    if (!h.moved) return setSel(h.id);
    const b = boxEl.current?.getBoundingClientRect();
    const inBox = b && e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
    if (inBox) {
      setState((s) => {
        const w = s.words.find((x) => x.id === h.id);
        return w ? { ...s, words: s.words.filter((x) => x.id !== h.id), box: [...(s.box ?? []), w] } : s;
      });
      setSel(null);
    } else if (h.at) {
      setState((s) => ({ ...s, words: s.words.map((w) => (w.id === h.id ? { ...w, x: h.at.x, y: h.at.y } : w)) }), { debounce: 400 });
    }
  };

  const dupe = (w) =>
    setState((s) => ({ ...s, words: [...s.words, { ...w, id: uid(), x: clamp(w.x + 0.04), y: clamp(w.y + 0.06), rot: -w.rot, by: me }] }));

  const ask = async (kind) => {
    if (!selected) return;
    setGhosts({ kind, list: [], busy: true });
    const list = await suggest(kind, selected.text);
    setGhosts({ kind, list, busy: false });
  };

  // lands near the one it came from
  const stick = (t) => {
    const w = { ...makeWord(t, me), ...(selected ? { x: clamp(selected.x + 0.08), y: clamp(selected.y + 0.12) } : {}) };
    setState((s) => ({ ...s, words: [...s.words, w] }));
    setGhosts((g) => ({ ...g, list: g.list.filter((x) => x !== t) }));
  };

  const unbox = (w) => setState((s) => ({ ...s, box: s.box.filter((x) => x.id !== w.id), words: [...s.words, { ...w, ...spot() }] }));

  const sendToNotes = (n) => {
    updateBoard(board.id, (b) => ({
      ...b,
      modules: b.modules.map((m) =>
        m.id === n.id ? { ...m, state: { ...m.state, blocks: [...(m.state.blocks ?? []), { id: uid(), type: "text", value: line }] } } : m
      ),
    }));
    toast({ text: "sent to your notes" });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(line);
      toast({ text: "copied" });
    } catch {
      toast({ text: "couldn't copy, select it by hand" });
    }
  };

  return (
    <div className="mag">
      <div className="mag-door" ref={door} onClick={(e) => e.target === e.currentTarget && setSel(null)}>
        {words.length === 0 && <div className="mag-empty">a bare fridge. add some words</div>}
        {words.map((w) => {
          const p = drag?.id === w.id ? drag : w;
          return (
            <div
              key={w.id}
              className={`mag-tile${sel === w.id ? " sel" : ""}${drag?.id === w.id ? " held" : ""}`}
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                transform: `rotate(${w.rot}deg)`,
                background: STICKER_COLORS[hash(w.id) % STICKER_COLORS.length],
              }}
              onPointerDown={(e) => down(e, w)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onDoubleClick={() => dupe(w)}
            >
              {w.text}
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="mag-row">
          <b className="mag-sel">{selected.text}</b>
          {SUGGEST_KINDS.map((k) => (
            <button key={k} className="mini-btn" onClick={() => ask(k)}>{k}</button>
          ))}
        </div>
      )}
      {ghosts.kind && (
        <div className="mag-row">
          {ghosts.busy && <span className="mag-note">looking…</span>}
          {!ghosts.busy && ghosts.list.length === 0 && <span className="mag-note">nothing came back (offline?)</span>}
          {ghosts.list.map((g) => (
            <button key={g} className="mag-ghost" onClick={() => stick(g)} title="stick it on the door">{g}</button>
          ))}
        </div>
      )}

      <div className="mag-row">
        <input
          className="line-input mag-input"
          placeholder="+ words"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          aria-label="Add words"
        />
        <button className="mini-btn" onClick={shuffle} disabled={!words.length}>shuffle</button>
        <button className="mini-btn" onClick={() => setLine(readLine(words))} disabled={!words.length}>read it</button>
        {notes.length > 0 && <button className="mini-btn" onClick={pull}>pull words from notes</button>}
      </div>

      {line != null && (
        <div className="mag-read">
          <div className="mag-line">{line}</div>
          <div className="mag-row">
            <button className="mini-btn" onClick={copy}>copy</button>
            {notes.map((n, i) => (
              <button key={n.id} className="mini-btn" onClick={() => sendToNotes(n)}>
                to {notes.length > 1 ? n.title || `notes ${i + 1}` : "notes"}
              </button>
            ))}
            <button className="mini-btn" onClick={() => setLine(null)}>close</button>
          </div>
        </div>
      )}

      <div className="mag-box" ref={boxEl}>
        <button className="pile-toggle" onClick={() => setShowBox((v) => !v)}>
          {showBox ? "▾" : "▸"} the box ({box.length}) <span className="mag-note">drop magnets here</span>
        </button>
        {(showBox || expanded) &&
          box.map((w) => (
            <button key={w.id} className="mag-ghost" onClick={() => unbox(w)} title="put it back on the door">{w.text}</button>
          ))}
      </div>
    </div>
  );
}
