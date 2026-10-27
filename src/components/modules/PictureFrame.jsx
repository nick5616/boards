import { useRef, useState } from "react";
import { useData } from "../../contexts/DataContext";
import { useImage } from "../../hooks/useEntries";
import { useBoardContext } from "../board/BoardContext";
import { compressImage, saveImage, deleteImage } from "../../lib/data";
import { imagesIn } from "../../lib/paste";
import { ChipRow } from "./kit";

// One picture, hung in a frame. A thin black frame to start; opened big, the frame can be a
// white gallery one, gilded, wood or an oval, with or without a mat, and the picture can
// fill the frame or sit whole inside it. Drop a picture on it (or pick one) to hang it.

export const FRAMES = [
  { id: "black", label: "black" },
  { id: "gallery", label: "gallery" },
  { id: "gilded", label: "gilded" },
  { id: "wood", label: "wood" },
  { id: "oval", label: "oval" },
];

export default function PictureFrame({ board, mod, setState, expanded }) {
  const { uid, toast } = useData();
  const { readOnly } = useBoardContext() ?? {};
  const { imageId = null, frame = "black", mat = false, fit = "cover" } = mod.state;
  const src = useImage(uid, imageId);
  const file = useRef(null);
  const [dropping, setDropping] = useState(false);

  const hang = async (f) => {
    if (!f) return;
    try {
      const id = saveImage(uid, board.id, await compressImage(f));
      setState((s) => ({ ...s, imageId: id }));
      if (imageId) deleteImage(uid, imageId, board.id);
    } catch {
      toast({ text: "couldn't read that picture" });
    }
  };
  const take = () => {
    if (!imageId || !confirm("Take the picture out of the frame?")) return;
    deleteImage(uid, imageId, board.id);
    setState((s) => ({ ...s, imageId: null }));
  };

  const drop = readOnly
    ? {}
    : {
        onDragOver: (e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          e.stopPropagation();
          setDropping(true);
        },
        onDragLeave: (e) => !e.currentTarget.contains(e.relatedTarget) && setDropping(false),
        onDrop: (e) => {
          setDropping(false);
          const [f] = imagesIn(e.dataTransfer.files);
          if (!f) return;
          e.preventDefault();
          e.stopPropagation();
          hang(f);
        },
      };

  const set = (patch) => setState((s) => ({ ...s, ...patch }));

  return (
    <div className={`pf${expanded ? " big" : ""}`}>
      <div className={`pf-frame pf-${frame}${mat ? " matted" : ""}${dropping ? " dropping" : ""}`} {...drop}>
        <div className="pf-mat">
          <div className={`pf-pic fit-${fit}`}>
            {src ? (
              <img src={src} alt={mod.title} draggable={false} />
            ) : imageId ? null : (
              !readOnly && (
                <button className="pf-empty" onClick={() => file.current.click()}>
                  drop a picture here
                  <span>or pick one</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="pf-more">
          <ChipRow label="Frame">
            {FRAMES.map((f) => (
              <button
                key={f.id}
                className={`pf-chip pfc-${f.id}${frame === f.id ? " on" : ""}`}
                onClick={() => set({ frame: f.id })}
                aria-pressed={frame === f.id}
                disabled={readOnly}
              >
                <i aria-hidden="true" />
                {f.label}
              </button>
            ))}
          </ChipRow>
          <div className="pf-row">
            <label className="pf-check">
              <input type="checkbox" checked={mat} disabled={readOnly} onChange={(e) => set({ mat: e.target.checked })} /> mat
            </label>
            <label className="pf-check">
              <input type="checkbox" checked={fit === "contain"} disabled={readOnly} onChange={(e) => set({ fit: e.target.checked ? "contain" : "cover" })} /> show the whole picture
            </label>
          </div>
          {!readOnly && (
            <div className="pf-row">
              <button className="mini-btn ghost" onClick={() => file.current.click()}>{imageId ? "change picture" : "pick a picture"}</button>
              {imageId && <button className="mini-btn ghost" onClick={take}>take it out</button>}
            </div>
          )}
        </div>
      )}
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          hang(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
