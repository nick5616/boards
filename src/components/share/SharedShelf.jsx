import { hslStr } from "../../utils/color";
import IconChip from "../IconChip";

// Boards other people shared with me, on their own shelf under mine
export default function SharedShelf({ boards, onOpen }) {
  if (!boards.length) return null;
  return (
    <section className="shared-shelf">
      <div className="section-label">Shared with me <span className="gl-n">{boards.length}</span></div>
      <div className="shared-cards">
        {boards.map((b) => (
          <button
            key={b.id}
            className="shared-card"
            style={{ "--bc": hslStr(b.color.h, b.color.s, b.color.l) }}
            onClick={() => onOpen(b)}
          >
            <IconChip board={b} size={42} />
            <span className="shared-card-title">{b.title}</span>
            <span className="shared-ribbon">shared by {b.sharedBy}{b.role === "view" ? " · look only" : ""}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
