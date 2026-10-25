import { useEffect, useRef } from "react";
import { uid } from "../../utils/uid";
import { imagesIn, pointerTarget } from "../../lib/paste";
import { BLOCK_TYPES } from "../../constants/blockTypes";
import { useData } from "../../contexts/DataContext";
import { compressImage, saveImage, deleteImage } from "../../lib/data";
import Block from "../Block";

// The original block editor, now as one module on a board
export default function Notes({ board, mod, setState }) {
  const { uid: userId, toast } = useData();
  const blocks = mod.state.blocks ?? [];
  const rootRef = useRef(null);

  const setBlocks = (fn, opts) => setState((s) => ({ ...s, blocks: fn(s.blocks ?? []) }), opts);
  const add = (type) => setBlocks((bs) => [...bs, { id: uid(), type, value: "" }]);
  const update = (id, value) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, value } : b)), { debounce: 600 });
  const remove = (b) => {
    setBlocks((bs) => bs.filter((x) => x.id !== b.id));
    if (b.imageId) deleteImage(userId, b.imageId);
  };
  const pickImage = async (id, file) => {
    try {
      const old = blocks.find((b) => b.id === id)?.imageId;
      const imageId = saveImage(userId, board.id, await compressImage(file));
      setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, imageId, value: "" } : b)));
      if (old) deleteImage(userId, old);
    } catch {
      toast({ text: "couldn't read that image" });
    }
  };

  // A pasted picture lands right after the block you're typing in, or at the end
  const pasteImages = async (files, afterId) => {
    try {
      const made = [];
      for (const f of files) made.push({ id: uid(), type: "image", imageId: saveImage(userId, board.id, await compressImage(f)), value: "" });
      setBlocks((bs) => {
        const i = bs.findIndex((b) => b.id === afterId);
        return i < 0 ? [...bs, ...made] : [...bs.slice(0, i + 1), ...made, ...bs.slice(i + 1)];
      });
    } catch {
      toast({ text: "couldn't read that picture" });
    }
  };
  const latest = useRef(pasteImages);
  latest.current = pasteImages;

  useEffect(() => {
    const root = rootRef.current;
    const frame = root?.closest(".mod");
    if (!frame) return;
    const onPaste = (e) => {
      const files = imagesIn(e.clipboardData?.files);
      const typingHere = root.contains(document.activeElement);
      if (!files.length || !(typingHere || frame.contains(pointerTarget()))) return;
      e.preventDefault();
      latest.current(files, typingHere ? document.activeElement.closest("[data-bid]")?.dataset.bid : null);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  return (
    <div className="notes" ref={rootRef}>
      {blocks.map((b) => (
        <div key={b.id} data-bid={b.id} style={{ display: "contents" }}>
          <Block
            block={b}
            onUpdate={(v) => update(b.id, v)}
            onDelete={() => remove(b)}
            onPickImage={(f) => pickImage(b.id, f)}
          />
        </div>
      ))}
      <div className="add-bar notes-add">
        {BLOCK_TYPES.map((bt) => (
          <button key={bt.id} className="add-chip" onClick={() => add(bt.id)}>
            {bt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
