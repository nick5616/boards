import { useState, useEffect } from "react";
import { firstName } from "../../lib/share";

// A note somebody passed you: a folded bit of paper lands, pops open, and once you've had time
// to read it (or you click it) it burns up. Never stored anywhere; if you weren't looking, it's gone.

const BURN = 1400;
const readTime = (text) => Math.min(15000, Math.max(4500, 2500 + text.length * 70));

export default function PassNote({ room, who }) {
  const [notes, setNotes] = useState([]); // waiting their turn; the first one is on screen
  const [burning, setBurning] = useState(false);
  const note = notes[0];

  useEffect(() => {
    return room.on("note", (m, from) => {
      if (typeof m.text !== "string" || !m.text.trim()) return;
      const id = Math.random().toString(36).slice(2);
      setNotes((l) => [...l, { id, text: m.text.slice(0, 280), by: who(from) }]);
    });
  }, [room, who]);

  // Read it, then it burns, then the next one
  useEffect(() => {
    if (!note) return;
    setBurning(false);
    const burn = setTimeout(() => setBurning(true), readTime(note.text));
    return () => clearTimeout(burn);
  }, [note?.id]);
  useEffect(() => {
    if (!burning) return;
    const gone = setTimeout(() => setNotes((l) => l.slice(1)), BURN);
    return () => clearTimeout(gone);
  }, [burning]);

  if (!note) return null;
  return (
    <div className="tg-note-wrap" key={note.id}>
      <button
        className={`tg-note${burning ? " burning" : ""}`}
        style={{ "--who": note.by.color }}
        onClick={() => setBurning(true)}
        title="click to burn it"
      >
        <span className="tg-note-from">a note from {firstName(note.by.name)}</span>
        <span className="tg-note-text">{note.text}</span>
        <span className="tg-note-hint">(it burns after you read it)</span>
      </button>
    </div>
  );
}
