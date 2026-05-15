import { uid } from "../utils/uid";
import { hslStr, inkColor } from "../utils/color";
import { BLOCK_TYPES } from "../constants/blockTypes";
import StampSVG from "./StampSVG";
import Block from "./Block";

export default function DetailView({ card, onBack, onUpdate }) {
  const bg  = hslStr(card.color.h, card.color.s, card.color.l);
  const ink = inkColor(card.color);

  const addBlock    = (type)    => onUpdate({ ...card, blocks: [...card.blocks, { id: uid(), type, value: "" }] });
  const updateBlock = (id, val) => onUpdate({ ...card, blocks: card.blocks.map((b) => (b.id === id ? { ...b, value: val } : b)) });
  const deleteBlock = (id)      => onUpdate({ ...card, blocks: card.blocks.filter((b) => b.id !== id) });

  return (
    <div className="detail">
      <div className="detail-hdr">
        <button className="detail-back" onClick={onBack} aria-label="Back">←</button>
        <div className="detail-icon-chip" style={{ background: bg }}>
          {card.iconData ? (
            <img src={card.iconData} alt="" />
          ) : card.stampId ? (
            <StampSVG stampId={card.stampId} color={ink} />
          ) : (
            <span style={{ fontSize: 14, color: "rgba(42,37,32,.2)" }}>✦</span>
          )}
        </div>
        <span className="detail-hdr-title">{card.title}</span>
      </div>

      <div className="detail-strip" style={{ background: bg }} />

      <div className="detail-canvas">
        {card.blocks.map((b) => (
          <Block
            key={b.id}
            block={b}
            onUpdate={(val) => updateBlock(b.id, val)}
            onDelete={() => deleteBlock(b.id)}
          />
        ))}
        <div className="add-bar">
          {BLOCK_TYPES.map((bt) => (
            <button key={bt.id} className="add-chip" onClick={() => addBlock(bt.id)}>
              {bt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
