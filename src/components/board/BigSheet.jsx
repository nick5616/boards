import { useEffect } from "react";
import { MODULE_COMPONENTS } from "../modules";
import { useData } from "../../contexts/DataContext";
import { backlinks } from "../../lib/mentions";
import { useCover } from "../../lib/lockbox";
import { Covered } from "../modules/LockBox";
import ModuleCatch from "./ModuleCatch";

// One module opened up large: full screen on a phone, a wide sheet on desktop
export default function BigSheet({ board, mod, entries, setState, onPatch, onClose }) {
  const Body = MODULE_COMPONENTS[mod.type];
  const { boards, goTo } = useData();
  const links = backlinks(boards, { boardId: board.id, modId: mod.id });
  const covered = !!useCover(board, mod.id); // behind a shut lock box

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
          {covered ? <Covered /> : <ModuleCatch type={mod.type}><Body board={board} mod={mod} entries={entries} setState={setState} onPatch={onPatch} expanded openBig={() => {}} /></ModuleCatch>}
        </div>
        {links.length > 0 && (
          <div className="mn-backlinks">
            <span>↩ mentioned in</span>
            {links.map((l) => (
              <button key={`${l.boardId}/${l.modId}`} onClick={() => goTo(l.boardId, l.modId)}>
                {l.title} · {l.where}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
