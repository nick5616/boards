import { useEffect } from "react";
import { MODULES, MODULE_KINDS, MODULE_TYPES } from "../../constants/modules";
import ModuleBadges from "./ModuleBadges";
import { capHint } from "../../lib/caps";

// The sheet of things you can slap onto a board, shelved by kind.
// nested = adding inside a folder, where controls don't go.
export default function ModuleTray({ onPick, onClose, nested = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const kinds = MODULE_KINDS.filter((k) => !(nested && k.id === "control"));

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal tray" role="dialog" aria-modal="true" aria-label="Add to board">
        <div className="modal-topbar">
          <div className="modal-handle" />
          <div className="modal-title">Slap something on</div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="tray-grid">
          {kinds.map((k) => [
            <div key={k.id} className="tray-kind">{k.label}</div>,
            ...MODULE_TYPES.filter((t) => MODULES[t].kind === k.id).map((t) => {
              // Still shown when this browser can't do it, so you know it exists
              const hint = capHint(MODULES[t].needs);
              return (
              <button key={t} className={`tray-item${hint ? " cant" : ""}`} disabled={!!hint} title={hint ?? undefined} onClick={() => onPick(t)}>
                <div className={`tray-art tray-art-${t}`} aria-hidden="true">
                  <TrayArt type={t} />
                </div>
                <div className="tray-label">
                  {MODULES[t].label}
                  <ModuleBadges type={t} />
                </div>
                <div className="tray-blurb">{hint ?? MODULES[t].blurb}</div>
              </button>
              );
            }),
          ])}
        </div>
      </div>
    </div>
  );
}

export function TrayArt({ type }) {
  switch (type) {
    case "clipping":
      return <div className="ta-clip"><i /><b>corset top</b><span>$22.99</span></div>;
    case "links":
      return <div className="ta-links"><i>corset top</i><i>hurt (video)</i></div>;
    case "folder":
      return <div className="ta-folder"><i>Maya</i><i>Jo</i><i>Sam</i><b /></div>;
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
    case "timer":
      return <div className="ta-tomato"><span>20:00</span></div>;
    case "punchcard":
      return <div className="ta-punch">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < 6 ? "on" : ""} />)}</div>;
    case "flashcards":
      return <div className="ta-cards"><i /><i>el perro</i></div>;
    case "setlist":
      return <div className="ta-tape"><b /><span>A1 minuet ●●○</span></div>;
    case "graph":
      return (
        <div className="ta-graph">
          <svg viewBox="0 0 60 40"><polyline points="4,34 16,28 26,30 38,16 50,12 56,6" /></svg>
        </div>
      );
    case "tally":
      return (
        <div className="ta-chalk">
          <svg viewBox="0 0 60 30"><path d="M6 4v22M12 4v22M18 4v22M24 4v22M2 22L28 8M40 4v22M46 4v22" /></svg>
        </div>
      );
    case "jar":
      return <div className="ta-jar"><i /><i /><i /><i /><i /></div>;
    case "fortune":
      return <div className="ta-fortune">slow is smooth</div>;
    case "tuner":
      return <div className="ta-tuner"><i /><b /></div>;
    case "keys":
      return <div className="ta-keys">{Array.from({ length: 7 }, (_, i) => <i key={i} />)}<b style={{ left: 8 }} /><b style={{ left: 20 }} /><b style={{ left: 44 }} /><b style={{ left: 56 }} /><b style={{ left: 68 }} /></div>;
    case "metronome":
      return <div className="ta-metro"><i /><b /></div>;
    case "tape":
      return <div className="ta-reels"><i /><i /></div>;
    case "staff":
      return (
        <div className="ta-staff">
          <svg viewBox="0 0 60 36">
            <path d="M3 10h54M3 15h54M3 20h54M3 25h54M3 30h54" />
            <ellipse cx="18" cy="25" rx="3.4" ry="2.5" />
            <ellipse cx="34" cy="15" rx="3.4" ry="2.5" />
            <ellipse cx="48" cy="20" rx="3.4" ry="2.5" />
            <path d="M21 25V7M37 15V0M51 20V3" />
          </svg>
        </div>
      );
    default:
      return null;
  }
}
