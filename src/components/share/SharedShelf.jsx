import { useState } from "react";
import { hslStr } from "../../utils/color";
import IconChip from "../IconChip";
import TuckSheet from "./TuckSheet";

// Boards other people shared with me, on their own shelf under mine
export default function SharedShelf({ boards, onOpen }) {
  const [tucking, setTucking] = useState(null);
  if (!boards.length) return null;
  return (
    <section className="shared-shelf">
      <div className="section-label">Shared with me <span className="gl-n">{boards.length}</span></div>
      <div className="shared-cards">
        {boards.map((b) => (
          <div key={b.id} className="shared-card-wrap">
            <button
              className="shared-card"
              style={{ "--bc": hslStr(b.color.h, b.color.s, b.color.l) }}
              onClick={() => onOpen(b)}
            >
              <IconChip board={b} size={42} />
              <span className="shared-card-title">{b.title}</span>
              <span className="shared-ribbon">
                {b.kind === "tab" ? "a tab " : ""}shared by {b.sharedBy}{b.role === "view" ? " · look only" : ""}
              </span>
            </button>
            <button className="shared-tuck" onClick={() => setTucking(b)} title="Also put it in one of your boards, as a tab">
              tuck into a board…
            </button>
          </div>
        ))}
      </div>
      {tucking && <TuckSheet shared={tucking} onClose={() => setTucking(null)} />}
    </section>
  );
}
