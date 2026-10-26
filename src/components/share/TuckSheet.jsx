import { useEffect, useState } from "react";
import { useData } from "../../contexts/DataContext";
import { tuck } from "../../lib/shareTab";
import { hslStr } from "../../utils/color";
import IconChip from "../IconChip";

// Every space that sits (at any depth) inside this one, so a board is never tucked into itself
function inside(space, lookup, seen = new Set()) {
  const tabs = [...(space.tabs ?? []), ...space.modules.filter((m) => m.type === "folder").flatMap((f) => f.state.tabs ?? [])];
  for (const t of tabs) {
    if (!t.mount || seen.has(t.mount)) continue;
    seen.add(t.mount);
    const next = lookup(t.mount);
    if (next) inside(next, lookup, seen);
  }
  return seen;
}

// "Tuck into a board…": pick one of my boards (or a folder on it) and the shared thing
// becomes a tab there, wearing a little "shared" ribbon. It's the same live space, so
// it leaves the shelf (it's in the board now) and comes back if the tab is taken off.
export default function TuckSheet({ shared, onClose }) {
  const { uid, boards, mounted, updateBoard, toast } = useData();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const lookup = (id) => boards.find((b) => b.id === id) ?? mounted?.get(id);
  const nested = inside(shared, lookup);
  // Folders hold tabs, never folders: a shared board with folders in it goes on a board's own tabs only
  const hasFolders = shared.modules.some((m) => m.type === "folder");
  const mine = boards.filter((b) => b.role === "owner" && b.id !== shared.id && !nested.has(b.id));

  const put = async (target, parent) => {
    setBusy(true);
    try {
      await tuck({ uid, shared, target, parent, updateBoard });
      toast({ text: `“${shared.title}” is tucked into ${target.title}` });
      onClose();
    } catch (e) {
      toast({ text: `couldn't tuck that in (${e.code ?? e.message})` });
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal tray share-sheet" role="dialog" aria-modal="true" aria-label="Tuck into a board">
        <div className="modal-topbar">
          <div className="modal-handle" />
          <div className="modal-title">Tuck “{shared.title}” into…</div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="share-body">
          <p className="tuck-note">It becomes a tab with a little “shared” ribbon, and it's still the same live thing for everyone.</p>
          <ul className="tuck-list">
            {mine.map((b) => (
              <li key={b.id}>
                <button className="tuck-row" disabled={busy} onClick={() => put(b, null)} style={{ "--bc": hslStr(b.color.h, b.color.s, b.color.l) }}>
                  <IconChip board={b} size={30} />
                  <span>{b.title}</span>
                </button>
                {!hasFolders &&
                  b.modules
                    .filter((m) => m.type === "folder")
                    .map((f) => (
                      <button key={f.id} className="tuck-row tuck-folder" disabled={busy} onClick={() => put(b, f.id)}>
                        <span>🗂 {f.title}</span>
                      </button>
                    ))}
              </li>
            ))}
            {!mine.length && <li className="share-empty">you don't have a board of your own to put it in yet</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
