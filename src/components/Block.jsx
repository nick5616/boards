import { useRef } from "react";
import AutoTA from "./AutoTA";

export default function Block({ block, onUpdate, onDelete }) {
  const imgRef = useRef(null);

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
        {block.value ? (
          <img src={block.value} alt="" onClick={() => imgRef.current?.click()} style={{ cursor: "pointer" }} />
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
            if (!f) return;
            const r = new FileReader();
            r.onload = (ev) => onUpdate(ev.target.result);
            r.readAsDataURL(f);
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
        value={block.value}
        onChange={onUpdate}
        placeholder={block.type === "bigtitle" ? "Title…" : "Write here…"}
      />
    </div>
  );
}
