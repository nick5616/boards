import { hslStr, inkColor } from "../utils/color";
import StampSVG from "./StampSVG";

export default function IconChip({ board, size = 36 }) {
  return (
    <div
      className="detail-icon-chip"
      style={{ background: hslStr(board.color.h, board.color.s, board.color.l), width: size, height: size }}
    >
      {board.iconData ? (
        <img src={board.iconData} alt="" />
      ) : board.stampId ? (
        <StampSVG stampId={board.stampId} color={inkColor(board.color)} />
      ) : (
        <span style={{ fontSize: size * 0.4, color: "rgba(42,37,32,.3)" }}>✦</span>
      )}
    </div>
  );
}
