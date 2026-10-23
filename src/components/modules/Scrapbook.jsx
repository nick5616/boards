import { useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { useImage } from "../../hooks/useEntries";
import { addEntry, deleteEntry, compressImage, saveImage } from "../../lib/data";
import { prettyDate } from "../../utils/date";
import { hash } from "../Sticker";
import EntryText from "./EntryText";

export default function Scrapbook({ board, mod, entries }) {
  const { uid, toast } = useData();
  const fileRef = useRef(null);
  const photos = entries.filter((e) => e.kind === "photo" && e.moduleId === mod.id);

  const addPhotos = async (files) => {
    for (const f of files) {
      try {
        const imageId = saveImage(uid, board.id, await compressImage(f));
        addEntry(uid, { kind: "photo", boardId: board.id, moduleId: mod.id, imageId, text: "" });
      } catch {
        toast({ text: `couldn't read ${f.name}` });
      }
    }
  };

  return (
    <div className="scrap">
      <div className="scrap-grid">
        {photos.map((p) => <Polaroid key={p.id} entry={p} />)}
        <button className="scrap-add" onClick={() => fileRef.current?.click()}>
          <span>+</span>photo
        </button>
      </div>
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

function Polaroid({ entry }) {
  const { uid } = useData();
  const src = useImage(uid, entry.imageId);
  const rot = (hash(entry.id) % 7) - 3;
  return (
    <figure className="polaroid" style={{ transform: `rotate(${rot}deg)` }}>
      <button
        className="x-btn polaroid-del"
        onClick={() => confirm("Remove this photo?") && deleteEntry(uid, entry)}
        aria-label="Remove photo"
      >
        ✕
      </button>
      <div className="polaroid-img">{src ? <img src={src} alt={entry.text || ""} /> : null}</div>
      <EntryText entry={entry} className="polaroid-cap" placeholder={prettyDate(entry.day)} />
    </figure>
  );
}
