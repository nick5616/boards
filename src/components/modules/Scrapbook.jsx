import { useRef, useState, useEffect } from "react";
import { useData } from "../../contexts/DataContext";
import { useImage } from "../../hooks/useEntries";
import { addEntry, updateEntry, deleteEntry, compressImage, saveImage } from "../../lib/data";
import { prettyDate } from "../../utils/date";
import { hash } from "../Sticker";
import EntryText from "./EntryText";
import ContextMenu from "../ContextMenu";
import { imagesIn, readClipboard, pointerTarget } from "../../lib/paste";

const PHOTO = "application/x-boards-photo";

export default function Scrapbook({ board, mod, entries }) {
  const { uid, toast } = useData();
  const fileRef = useRef(null);
  const rootRef = useRef(null);
  const [menu, setMenu] = useState(null); // right-click menu position
  const photos = entries.filter((e) => e.kind === "photo" && e.moduleId === mod.id);

  const addPhotos = async (files) => {
    for (const f of files) {
      try {
        const imageId = saveImage(uid, board.id, await compressImage(f));
        addEntry(uid, { kind: "photo", boardId: board.id, moduleId: mod.id, imageId, text: "" });
      } catch {
        toast({ text: `couldn't read ${f.name ?? "that picture"}` });
      }
    }
  };
  const add = useRef(addPhotos);
  add.current = addPhotos;

  // Ctrl/⌘+V with the pointer over this scrapbook drops a copied picture in.
  // Text pastes go wherever they were going.
  useEffect(() => {
    const frame = rootRef.current?.closest(".mod");
    if (!frame) return;
    const onPaste = (e) => {
      const files = imagesIn(e.clipboardData?.files);
      if (!frame.contains(pointerTarget()) || !files.length) return;
      e.preventDefault();
      add.current(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  // A full-height photo is as tall as the scrapbook is, minus room for its caption
  useEffect(() => {
    const body = rootRef.current?.closest(".mod-body");
    if (!body) return;
    const ro = new ResizeObserver(() =>
      rootRef.current?.style.setProperty("--photo-h", `${Math.max(140, body.clientHeight - 70)}px`)
    );
    ro.observe(body);
    return () => ro.disconnect();
  }, []);

  // The browser's own menu only offers Paste on text fields, so right-click gets ours
  const pasteFromClipboard = async () => {
    try {
      const { images } = await readClipboard();
      if (images.length) addPhotos(images);
      else toast({ text: "no picture on the clipboard" });
    } catch {
      toast({ text: "couldn't open the clipboard — try ctrl+V" });
    }
  };

  // Photos dragged in from another scrapbook move here; picture files from the computer get added
  const [dropping, setDropping] = useState(false);
  const wants = (e) => e.dataTransfer.types.includes(PHOTO) || e.dataTransfer.types.includes("Files");
  const drop = {
    onDragOver: (e) => {
      if (!wants(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = e.dataTransfer.types.includes(PHOTO) ? "move" : "copy";
      setDropping(true);
    },
    onDragLeave: (e) => !e.currentTarget.contains(e.relatedTarget) && setDropping(false),
    onDrop: (e) => {
      setDropping(false);
      const id = e.dataTransfer.getData(PHOTO);
      if (id) {
        e.preventDefault();
        if (photos.some((p) => p.id === id)) return;
        updateEntry(uid, board.id, id, { moduleId: mod.id });
        toast({ text: `moved the photo to “${mod.title}”` });
        return;
      }
      const files = imagesIn(e.dataTransfer.files);
      if (files.length) {
        e.preventDefault();
        addPhotos(files);
      }
    },
  };

  return (
    <div
      ref={rootRef}
      className={`scrap${dropping ? " dropping" : ""}`}
      {...drop}
      onContextMenu={(e) => {
        // Photos and captions keep the browser's menu (copy image, spellcheck…)
        if (e.target.closest("img, input, textarea")) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="scrap-grid">
        {photos.map((p) => <Polaroid key={p.id} entry={p} />)}
        <button className="scrap-add" onClick={() => fileRef.current?.click()}>
          <span>+</span>photo
          <small>or paste one</small>
        </button>
      </div>
      {menu && (
        <ContextMenu
          at={menu}
          onClose={() => setMenu(null)}
          items={[
            { label: "📋 Paste photo", run: pasteFromClipboard },
            { label: "🖼 Choose a photo…", run: () => fileRef.current?.click() },
          ]}
        />
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          addPhotos([...e.target.files]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// Which way the corner has been pulled: right past the edge = full width,
// down = full height, both = both; pushing back in undoes it
function sizeFor(dx, dy, from) {
  const wasWide = from === "wide" || from === "full";
  const wasTall = from === "tall" || from === "full";
  const wide = wasWide ? dx > -40 : dx > 40;
  const tall = wasTall ? dy > -40 : dy > 40;
  return wide && tall ? "full" : wide ? "wide" : tall ? "tall" : "tile";
}

function Polaroid({ entry }) {
  const { uid } = useData();
  const src = useImage(uid, entry.imageId);
  const [drag, setDrag] = useState(null); // { sx, sy, from, size }
  const size = drag?.size ?? entry.size ?? "tile";
  const rot = ((hash(entry.id) % 7) - 3) / (size === "tile" ? 1 : 3);

  const corner = {
    onPointerDown: (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const from = entry.size ?? "tile";
      setDrag({ sx: e.clientX, sy: e.clientY, from, size: from });
    },
    onPointerMove: (e) => drag && setDrag({ ...drag, size: sizeFor(e.clientX - drag.sx, e.clientY - drag.sy, drag.from) }),
    onPointerUp: () => {
      if (drag && drag.size !== drag.from) updateEntry(uid, board.id, entry.id, { size: drag.size === "tile" ? null : drag.size });
      setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
  };

  return (
    <figure className={`polaroid ${size}${drag ? " sizing" : ""}`} style={{ transform: `rotate(${rot}deg)` }}>
      <button
        className="x-btn polaroid-del"
        onClick={() => confirm("Remove this photo?") && deleteEntry(uid, entry)}
        aria-label="Remove photo"
      >
        ✕
      </button>
      <div
        className="polaroid-img"
        draggable
        title="Drag onto another scrapbook to move it"
        onDragStart={(e) => {
          e.dataTransfer.setData(PHOTO, entry.id);
          e.dataTransfer.effectAllowed = "move";
        }}
      >
        {src ? <img src={src} alt={entry.text || ""} draggable={false} /> : null}
      </div>
      <EntryText entry={entry} className="polaroid-cap" placeholder={prettyDate(entry.day)} />
      <span
        className="polaroid-size"
        {...corner}
        title="Drag out for full width or height"
        aria-hidden="true"
      />
    </figure>
  );
}
