import { uid } from "../../utils/uid";
import { BLOCK_TYPES } from "../../constants/blockTypes";
import { useData } from "../../contexts/DataContext";
import { compressImage, saveImage, deleteImage } from "../../lib/data";
import Block from "../Block";

// The original block editor, now as one module on a board
export default function Notes({ board, mod, setState }) {
  const { uid: userId, toast } = useData();
  const blocks = mod.state.blocks ?? [];

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

  return (
    <div className="notes">
      {blocks.map((b) => (
        <Block
          key={b.id}
          block={b}
          onUpdate={(v) => update(b.id, v)}
          onDelete={() => remove(b)}
          onPickImage={(f) => pickImage(b.id, f)}
        />
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
