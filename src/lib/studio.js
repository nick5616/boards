// Little helpers shared by the studio pack (gesture timer, value check, sketchbook,
// typewriter, corkboard): taking pictures in, counting words, reading brightness.
import { useRef, useState, useEffect } from "react";
import { imagesIn, pointerTarget } from "./paste";
import { compressImage, saveImage } from "./data";

// Saves picked/pasted/dropped files as images of this board; returns their ids.
// Anything that can't be read is skipped (and said so), the rest still go in.
export async function savePhotos(uid, boardId, files, toast) {
  const ids = [];
  for (const f of files) {
    try {
      ids.push(saveImage(uid, boardId, await compressImage(f)));
    } catch {
      toast?.({ text: `couldn't read ${f.name ?? "that picture"}` });
    }
  }
  return ids;
}

// Pictures into a module three ways: Ctrl+V with the pointer over it, dragging files
// onto it, and the hidden file input it opens (ref.current.click()).
// Returns { rootRef, drop, dropping } - spread `drop` on the module's root.
export function useImageIntake(onFiles) {
  const rootRef = useRef(null);
  const [dropping, setDropping] = useState(false);
  const latest = useRef(onFiles);
  latest.current = onFiles;

  useEffect(() => {
    const frame = rootRef.current?.closest(".mod, .bigsheet");
    if (!frame) return;
    const onPaste = (e) => {
      const files = imagesIn(e.clipboardData?.files);
      if (!frame.contains(pointerTarget()) || !files.length) return;
      e.preventDefault();
      latest.current(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const drop = {
    onDragOver: (e) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setDropping(true);
    },
    onDragLeave: (e) => !e.currentTarget.contains(e.relatedTarget) && setDropping(false),
    onDrop: (e) => {
      setDropping(false);
      const files = imagesIn(e.dataTransfer.files);
      if (!files.length) return;
      e.preventDefault();
      latest.current(files);
    },
  };
  return { rootRef, drop, dropping };
}

// ── Words ───────────────────────────────────────────────────────────────────
export const wordCount = (text) => (String(text ?? "").match(/[^\s]+/g) ?? []).length;

// Text inside a mention token ("@[Title](mod:...)") shouldn't count as words
const noTokens = (t) => t.replace(/@\[[^\]]*\]\([^)]*\)/g, " ");

// Every word in the Notes modules of a board. Image blocks hold a picture, not words.
export function notesWords(board) {
  let n = 0;
  for (const m of board?.modules ?? []) {
    if (m.type !== "notes") continue;
    for (const b of m.state?.blocks ?? []) {
      if (b.type !== "image" && typeof b.value === "string") n += wordCount(noTokens(b.value));
    }
  }
  return n;
}

// ── Brightness ──────────────────────────────────────────────────────────────
export const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
