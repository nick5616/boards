import { useEffect, useState } from "react";
import { MODULES } from "../../constants/modules";
import { describe, suggestions } from "../../lib/paste";
import { TrayArt } from "./ModuleTray";
import ModuleBadges from "./ModuleBadges";

// After a paste: what it looks like, and what it could become. Things already
// on this surface that can take it come first, then new modules that suit it.
export default function PasteSheet({ paste, here, onPick, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ideas = suggestions(paste);
  // A clipping holds just one link, so it's never something to add to
  const existing = here.filter((m) => m.type !== "clipping" && ideas.some((s) => s.type === m.type));
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (paste.kind !== "image") return;
    const url = URL.createObjectURL(paste.images[0]);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [paste]);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal tray paste-sheet" role="dialog" aria-modal="true" aria-label="Pasted">
        <div className="modal-topbar">
          <div className="modal-handle" />
          <div className="modal-title">What's this?</div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="paste-what">
          <div className="paste-guess">looks like {describe(paste)}</div>
          {preview && <img className="paste-img" src={preview} alt="" />}
          {paste.kind === "link" &&
            paste.links.slice(0, 3).map((l) => (
              <div key={l.url} className="paste-link">
                <b>{l.title}</b>
                <span>{l.url}</span>
              </div>
            ))}
          {paste.kind === "text" && <blockquote className="paste-text">{paste.text}</blockquote>}
        </div>
        <div className="tray-grid">
          {existing.length > 0 && <div className="tray-kind">Add it to</div>}
          {existing.map((m) => (
            <button key={m.id} className="tray-item paste-into" onClick={() => onPick(m.type, m.id)}>
              <div className={`tray-art tray-art-${m.type}`} aria-hidden="true"><TrayArt type={m.type} /></div>
              <div className="tray-label">→ {m.title}</div>
              <div className="tray-blurb">{ideas.find((s) => s.type === m.type).why}</div>
            </button>
          ))}
          <div className="tray-kind">{existing.length ? "Or start a new" : "Make it into"}</div>
          {ideas.map((s) => (
            <button key={s.type} className="tray-item" onClick={() => onPick(s.type)}>
              <div className={`tray-art tray-art-${s.type}`} aria-hidden="true"><TrayArt type={s.type} /></div>
              <div className="tray-label">
                {MODULES[s.type].label}
                <ModuleBadges type={s.type} />
              </div>
              <div className="tray-blurb">{s.why}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
