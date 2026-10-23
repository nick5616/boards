import { useEffect } from "react";
import { MODULES, MODULE_TYPES } from "../../constants/modules";

// The sheet of things you can slap onto a board
export default function ModuleTray({ onPick, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal tray" role="dialog" aria-modal="true" aria-label="Add to board">
        <div className="modal-topbar">
          <div className="modal-handle" />
          <div className="modal-title">Slap something on</div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="tray-grid">
          {MODULE_TYPES.map((t) => (
            <button key={t} className="tray-item" onClick={() => onPick(t)}>
              <div className={`tray-art tray-art-${t}`} aria-hidden="true">
                <TrayArt type={t} />
              </div>
              <div className="tray-label">{MODULES[t].label}</div>
              <div className="tray-blurb">{MODULES[t].blurb}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrayArt({ type }) {
  switch (type) {
    case "tracker":
      return <div className="ta-grid">{Array.from({ length: 12 }, (_, i) => <i key={i} className={[1, 2, 5, 8, 9].includes(i) ? "on" : ""} />)}</div>;
    case "nextup":
      return <div className="ta-sticky">next:<br />#7</div>;
    case "tickets":
      return <div className="ta-ticket"><b>NOV<br />4</b><span>concert</span></div>;
    case "wishlist":
      return <div className="ta-receipt">☐ strings<br />☐ tuner<br />☑ case</div>;
    case "diary":
      return <div className="ta-diary"><span /></div>;
    case "notes":
      return <div className="ta-notes">~~~~<br />~~~<br />~~~~~</div>;
    case "scrapbook":
      return <div className="ta-polaroid"><i /><i /></div>;
    default:
      return null;
  }
}
