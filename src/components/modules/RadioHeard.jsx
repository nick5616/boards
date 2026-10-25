import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { MODULES } from "../../constants/modules";
import { takeIn } from "../../lib/paste";
import { searchLinks, songLine } from "../../lib/nowplaying";

// Where a kept song can go: the list-like shelves on this board that take a line of text
const shelves = (board) => board.modules.filter((m) => MODULES[m.type]?.kind === "list" && MODULES[m.type].accepts?.line);

// "Heard on the radio": a little till receipt of the songs you kept, newest first.
// Each line has search links for the music apps, and can be sent to a list on the board.
export default function RadioHeard({ board, heard, setHeard }) {
  const { uid, updateBoard, toast } = useData();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(null); // id of the song whose picker is open
  if (!heard.length) return null;
  const targets = shelves(board);

  const send = (h, m) => {
    const text = songLine(h);
    updateBoard(board.id, (b) => ({
      ...b,
      modules: b.modules.map((x) => {
        if (x.id !== m.id) return x;
        const next = takeIn(x.type, x.state, { kind: "text", text, lines: [text] });
        // Whatever the paste added is signed by whoever sent it
        const had = x.state.items?.length ?? 0;
        return { ...x, state: next.items ? { ...next, items: next.items.map((it, i) => (i >= had ? { ...it, by: uid } : it)) } : next };
      }),
    }));
    setSending(null);
    toast({ text: `"${text}" is on ${m.title} ✓` });
  };

  return (
    <div className="rad-receipt">
      <button className="mini-btn ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "tear off the receipt" : `🧾 heard on the radio (${heard.length})`}
      </button>
      {open && (
        <ol className="rad-paper">
          <li className="rad-paper-head">★ HEARD ON THE RADIO ★</li>
          {heard.map((h) => (
            <li key={h.id} className="rad-heard">
              <div className="rad-heard-top">
                <span className="rad-heard-song">{songLine(h)}</span>
                <button className="rad-heard-x" onClick={() => setHeard(heard.filter((x) => x.id !== h.id))} aria-label={`Forget ${songLine(h)}`}>✕</button>
              </div>
              <div className="rad-heard-sub">
                {h.station} · {new Date(h.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
              <div className="rad-heard-links">
                {searchLinks(h).map((l) => (
                  <a key={l.name} href={l.url} target="_blank" rel="noreferrer">{l.name}</a>
                ))}
                {targets.length > 0 && (
                  <button className="rad-heard-send" onClick={() => setSending(sending === h.id ? null : h.id)} aria-expanded={sending === h.id}>
                    → send to…
                  </button>
                )}
              </div>
              {sending === h.id && (
                <div className="rad-heard-pick">
                  {targets.map((m) => (
                    <button key={m.id} className="mini-btn" onClick={() => send(h, m)}>{m.title}</button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
