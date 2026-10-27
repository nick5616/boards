import { useRef } from "react";
import { useData } from "../contexts/DataContext";
import { useImage } from "../hooks/useEntries";
import AutoTA from "./AutoTA";

export default function Block({ block, onUpdate, onDelete, onPickImage }) {
  const imgRef = useRef(null);
  const { uid } = useData();
  // Images live in their own docs; old inline data URLs still display
  const stored = useImage(uid, block.imageId);
  const src = block.imageId ? stored : block.value;

  if (block.type === "divider") return (
    <div className="block">
      <button className="block-del" onClick={onDelete} aria-label="Delete block">✕</button>
      <hr className="block-hr" />
    </div>
  );

  if (block.type === "image") return (
    <div className="block">
      <button className="block-del" onClick={onDelete} aria-label="Delete block">✕</button>
      <div className="block-image">
        {src ? (
          <img src={src} alt="" onClick={() => imgRef.current?.click()} style={{ cursor: "pointer" }} />
        ) : block.imageId ? (
          <div className="block-image-drop">loading…</div>
        ) : (
          <div className="block-image-drop" onClick={() => imgRef.current?.click()}>
            tap to add image
          </div>
        )}
        <input
          ref={imgRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files[0];
            if (f) onPickImage(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );

  const cls = block.type === "bigtitle" ? "block-bigtitle" : "block-text";
  return (
    <div className={`block ${cls}`}>
      <button className="block-del" onClick={onDelete} aria-label="Delete block">✕</button>
      <AutoTA
        liveId={block.id}
        value={block.value}
        onChange={onUpdate}
        placeholder={block.type === "bigtitle" ? "Title…" : "Write here…"}
        rich={block.type !== "bigtitle"}
      />
    </div>
  );
}
