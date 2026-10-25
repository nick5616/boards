import { useEffect, useRef, useState } from "react";
import { useBoardContext } from "./BoardContext";
import { modulesIn } from "./spaces";
import { fromEvent, readClipboard, pointerTarget, typing } from "../../lib/paste";
import ContextMenu from "../ContextMenu";
import Canvas from "./Canvas";
import WidgetGrid from "./WidgetGrid";

// One blank surface: the board (or one of its tabs), or one tab of a folder.
// Free canvas on desktop, widget grid on a phone. Paste onto it (Ctrl+V while
// pointing at it, or right-click) and it asks what the pasted thing should become.
export default function Space({ parent = null, tab = null }) {
  const { board, desktop, arranging, frameProps, onModules, onArrange, openTray, onPasted, toast } = useBoardContext();
  const ref = useRef(null);
  const [menu, setMenu] = useState(null);
  const space = { parent, tab };
  const modules = modulesIn(board, space);

  // The innermost surface under the pointer, not a module sitting on it
  const mine = (el) => el?.closest(".mod, .space") === ref.current;

  const latest = useRef();
  latest.current = (clip) => onPasted(space, clip);

  useEffect(() => {
    const onPaste = (e) => {
      if (typing() || !mine(pointerTarget())) return;
      const clip = fromEvent(e.clipboardData);
      if (!clip.images.length && !clip.text.trim()) return;
      e.preventDefault();
      latest.current(clip);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const pasteFromClipboard = async () => {
    try {
      latest.current(await readClipboard());
    } catch {
      toast({ text: "couldn't open the clipboard — try ctrl+V" });
    }
  };

  return (
    <div
      ref={ref}
      className="space"
      onContextMenu={(e) => {
        if (!mine(e.target) || e.target.closest("input, textarea")) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {!modules.length ? (
        <div className={`board-empty${parent ? " space-empty" : ""}`}>
          <button className="slate-add" onClick={() => openTray(space)}>
            {parent || board.tabs?.length ? "a clean slate — tap to slap something on it" : "an empty board — tap to slap something on it"}
          </button>
          <button className="slate-paste" onClick={pasteFromClipboard}>
            📋 or paste a link, picture or words <small>(ctrl+V · right-click)</small>
          </button>
        </div>
      ) : desktop ? (
        <Canvas board={board} modules={modules} frameProps={frameProps} onModules={onModules} />
      ) : (
        <WidgetGrid board={board} modules={modules} arranging={arranging} frameProps={frameProps} onArrange={onArrange} />
      )}
      {menu && (
        <ContextMenu
          at={menu}
          onClose={() => setMenu(null)}
          items={[
            { label: "📋 Paste here", run: pasteFromClipboard },
            { label: "＋ Add something…", run: () => openTray(space) },
          ]}
        />
      )}
    </div>
  );
}
