import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { useBoardContext } from "../board/BoardContext";
import { MODULES } from "../../constants/modules";
import { addCards } from "../../lib/words";

// Send cards to a Flashcards module on this board (making one if there isn't any).
// → { decks, send(cards) } where send returns how many were new
export function useToFlashcards(board, mod) {
  const { updateBoard, toast } = useData();
  const ctx = useBoardContext();
  const decks = board.modules.filter((m) => m.type === "flashcards");
  const [pick, setPick] = useState("");
  const target = decks.find((d) => d.id === pick) ?? decks[0];

  const send = (cards) => {
    if (!cards.length) return 0;
    if (!target) {
      const made = addCards(MODULES.flashcards.init(), cards);
      ctx?.createModule?.("flashcards", { near: mod.id, state: made.state });
      toast({ text: `new Flashcards with ${made.added} card${made.added === 1 ? "" : "s"}` });
      return made.added;
    }
    const made = addCards(target.state, cards);
    if (made.added) {
      updateBoard(board.id, (b) => ({
        ...b,
        modules: b.modules.map((m) => (m.id === target.id ? { ...m, state: made.state } : m)),
      }));
    }
    toast({ text: made.added ? `${made.added} card${made.added === 1 ? "" : "s"} added to ${target.title}` : "already in the deck" });
    return made.added;
  };
  return { decks, target, pick: target?.id ?? "", setPick, send };
}

// "→ cards" button, with a deck picker when the board has several
export function ToCards({ fc, cards, label = "→ cards", disabled }) {
  return (
    <span className="wd-send">
      {fc.decks.length > 1 && (
        <select className="wd-sel" value={fc.pick} onChange={(e) => fc.setPick(e.target.value)} aria-label="Which Flashcards">
          {fc.decks.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
      )}
      <button className="mini-btn" disabled={disabled || !cards.length} onClick={() => fc.send(cards)} title="Send to Flashcards">{label}</button>
    </span>
  );
}

// Reads a phrase aloud in a language; plays nothing if this browser has no voice
export function speak(text, voice) {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!synth || !text) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice;
  const v = synth.getVoices().find((x) => x.lang.replace("_", "-").toLowerCase() === voice.toLowerCase())
    ?? synth.getVoices().find((x) => x.lang.toLowerCase().startsWith(voice.slice(0, 2).toLowerCase()));
  if (v) u.voice = v;
  synth.speak(u);
}
