import { useEffect, useRef, useState } from "react";
import { useBoardContext } from "./BoardContext";
import { modulesIn } from "./spaces";
import { fromEvent, readClipboard, pointerTarget, typing } from "../../lib/paste";
import ContextMenu from "../ContextMenu";
import Canvas from "./Canvas";
import WidgetGrid from "./WidgetGrid";

// One blank surface: the board (or one of its tabs), or one tab of a folder.
// Free canvas on desktop, widget grid on a phone. Paste onto it (Ctrl+V while
// pointing at it, or right-click) or drop something on a bare patch of it, and
// it asks what the thing should become.

// Drags that start inside the app (tab reorder, photos moving between
// scrapbooks) are never ours to catch, even if they carry plain text
let inside = false;
document.addEventListener("dragstart", () => (inside = true), true);
document.addEventListener("dragend", () => (inside = false), true);

// Something from outside: picture files, or a link / words / a web picture from another tab
function fromDrop(dt) {
  const clip = fromEvent(dt);
  if (clip.images.length) return clip;
  const html = dt.getData("text/html");
  const img = html && new DOMParser().parseFromString(html, "text/html").querySelector("img[src^='http']");
  const uri = dt.getData("text/uri-list").split(/\r?\n/).find((l) => l && !l.startsWith("#"));
  return { images: [], text: (uri || img?.src || clip.text).trim() };
}

export default function Space({ parent = null, tab = null }) {
  const { board, desktop, arranging, frameProps, onModules, onArrange, openTray, onPasted, toast } = useBoardContext();
  const ref = useRef(null);
  const [menu, setMenu] = useState(null);
  const [dropping, setDropping] = useState(false);
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

  // Only outside things landing on bare space; modules and inner spaces keep their own drops
  const wants = (e) =>
    !inside && mine(e.target) && ["Files", "text/uri-list", "text/plain", "text/html"].some((t) => e.dataTransfer.types.includes(t));

  const drop = {
    onDragOver: (e) => {
      if (!wants(e)) return dropping && setDropping(false);
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDropping(true);
    },
    onDragLeave: (e) => !e.currentTarget.contains(e.relatedTarget) && setDropping(false),
    onDrop: (e) => {
      setDropping(false);
      if (!wants(e)) return;
      e.preventDefault();
      const clip = fromDrop(e.dataTransfer);
      // Remember where it landed (on the canvas, if there is one) so the new thing goes there
      const canvas = ref.current.querySelector(".canvas")?.getBoundingClientRect();
      onPasted(canvas ? { ...space, at: { x: e.clientX - canvas.left, y: e.clientY - canvas.top } } : space, clip);
    },
  };

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
      className={`space${dropping ? " dropping" : ""}`}
      {...drop}
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
      {dropping && <div className="drop-hint">drop it here — I'll catch it</div>}
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
