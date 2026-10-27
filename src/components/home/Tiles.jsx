import { STATUSES } from "../../constants/modules";
import { hslStr, inkColor, textOn, softTextOn } from "../../utils/color";
import { agoLabel } from "../../utils/date";
import StampSVG from "../StampSVG";

// Small cards: every board's look and full title, many to a row
export default function Tiles({ boards, onOpen }) {
  return STATUSES.map((s) => {
    const group = boards.filter((b) => (b.status ?? "someday") === s.id);
    if (!group.length) return null;
    return (
      <section key={s.id}>
        <div className="section-label">{s.label}</div>
        <div className="tiles">
          {group.map((b) => (
            <button
              key={b.id}
              className={`tile st-${b.status}`}
              style={{ background: hslStr(b.color.h, b.color.s, b.color.l), "--card-text": textOn(b.color), "--card-soft": softTextOn(b.color) }}
              onClick={() => onOpen(b)}
            >
              <div className="tile-icon">
                {b.iconData ? (
                  <img src={b.iconData} alt="" />
                ) : b.stampId ? (
                  <StampSVG stampId={b.stampId} color={inkColor(b.color)} />
                ) : null}
              </div>
              <div className="tile-title">{b.title}</div>
              {b.lastLoggedAt && <div className="tile-ago">{agoLabel(b.lastLoggedAt)}</div>}
            </button>
          ))}
        </div>
      </section>
    );
  });
}
