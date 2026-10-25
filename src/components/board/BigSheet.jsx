import { useEffect } from "react";
import { MODULE_COMPONENTS } from "../modules";

// One module opened up large: full screen on a phone, a wide sheet on desktop
export default function BigSheet({ board, mod, entries, setState, onPatch, onClose }) {
  const Body = MODULE_COMPONENTS[mod.type];

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bigsheet mod mod-${mod.type} big`} role="dialog" aria-modal="true" aria-label={mod.title}>
        <div className="mod-bar">
          <span className="mod-title">{mod.title}</span>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="mod-body">
          <Body board={board} mod={mod} entries={entries} setState={setState} onPatch={onPatch} expanded openBig={() => {}} />
        </div>
      </div>
    </div>
  );
}
