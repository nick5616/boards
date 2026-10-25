import { useRef, useState, useEffect } from "react";
import { useData } from "../../contexts/DataContext";
import { useImage } from "../../hooks/useEntries";
import { compressImage, saveImage, deleteImage } from "../../lib/data";
import { stripsFrom, withStrips, stripBlob, FRAMES } from "../../lib/photostrip";
import { imagesIn, readClipboard, pointerTarget } from "../../lib/paste";
import { hash } from "../Sticker";

const dated = (at) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function Frame({ id }) {
  const { uid } = useData();
  const src = useImage(uid, id);
  return <span className="pst-frame">{src ? <img src={src} alt="" draggable={false} /> : null}</span>;
}

// One booth strip on the line: two clothespins, four frames, the date in pen
function Strip({ strip, onOpen, onDownload, onToss }) {
  const rot = ((hash(strip.id) % 9) - 4) * 0.9;
  return (
    <div className="pst-hang" style={{ transform: `rotate(${rot}deg)` }}>
      <div className="pst-pins" aria-hidden="true"><i /><i /></div>
      <button className="pst-strip" onClick={onOpen} aria-label={`Photo strip from ${dated(strip.at)}`} title={new Date(strip.at).toLocaleDateString()}>
        {strip.frames.map((f, i) => <Frame key={i} id={f.imageId} />)}
        <span className="pst-date">{dated(strip.at)}</span>
      </button>
      <div className="pst-tools">
        <button onClick={onDownload} title="Download as one picture" aria-label="Download this strip">⬇</button>
        <button onClick={onToss} title="Toss this strip" aria-label="Toss this strip">✕</button>
      </div>
    </div>
  );
}

// A clothesline of photo strips. Strips come from a Vanity mirror's booth, from pictures you
// choose, or from 2+ pasted pictures. The frames are saved pictures of their own, so they stay
// crisp however big the strip is shown; the one-piece picture is only drawn when you download.
export default function PhotoStrips({ board, mod, setState, openBig, expanded }) {
  const { uid, toast } = useData();
  const strips = mod.state.strips ?? [];
  const fileRef = useRef(null);
  const rootRef = useRef(null);
  const [dropping, setDropping] = useState(false);

  const addFrom = async (files) => {
    if (files.length < 2) return toast({ text: "a strip needs at least two pictures" });
    try {
      const ids = [];
      for (const f of files) ids.push(saveImage(uid, board.id, await compressImage(f)));
      setState((s) => withStrips(s, stripsFrom(ids, "none")));
    } catch {
      toast({ text: "couldn't read those pictures" });
    }
  };
  const add = useRef(addFrom);
  add.current = addFrom;

  // Ctrl/⌘+V with the pointer over the line pins up two or more copied pictures
  useEffect(() => {
    const frame = rootRef.current?.closest(".mod");
    if (!frame) return;
    const onPaste = (e) => {
      const files = imagesIn(e.clipboardData?.files);
      if (!frame.contains(pointerTarget()) || files.length < 2) return;
      e.preventDefault();
      add.current(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  // A strip is as tall as the module is, minus the line it hangs from and its little tools
  useEffect(() => {
    const body = rootRef.current?.closest(".mod-body");
    if (!body) return;
    const ro = new ResizeObserver(() =>
      rootRef.current?.style.setProperty("--strip-h", `${Math.max(150, body.clientHeight - 74)}px`)
    );
    ro.observe(body);
    return () => ro.disconnect();
  }, []);

  const toss = (s) => {
    if (!confirm("Toss this strip?")) return;
    s.frames.forEach((f) => deleteImage(uid, f.imageId));
    setState((st) => ({ ...st, strips: (st.strips ?? []).filter((x) => x.id !== s.id) }));
  };

  const download = async (s) => {
    try {
      const blob = await stripBlob(uid, s);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `photo-strip-${new Date(s.at).toISOString().slice(0, 10)}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      toast({ text: "couldn't put that strip together" });
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const { images } = await readClipboard();
      addFrom(images);
    } catch {
      toast({ text: "couldn't open the clipboard — try ctrl+V" });
    }
  };

  return (
    <div
      ref={rootRef}
      className={`pst${dropping ? " dropping" : ""}${expanded ? " big" : ""}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setDropping(false)}
      onDrop={(e) => {
        setDropping(false);
        const files = imagesIn(e.dataTransfer.files);
        if (!files.length) return;
        e.preventDefault();
        addFrom(files);
      }}
    >
      <div className="pst-line" aria-hidden="true" />
      <div className="pst-row">
        {strips.map((s) => (
          <Strip key={s.id} strip={s} onOpen={() => !expanded && openBig?.()} onDownload={() => download(s)} onToss={() => toss(s)} />
        ))}
        <div className="pst-new">
          {!strips.length && (
            <p>
              No strips yet.
              <br />
              Take one in a vanity mirror, or hang up two to {FRAMES} pictures.
            </p>
          )}
          <button onClick={() => fileRef.current?.click()}>+ pictures</button>
          <button onClick={pasteFromClipboard}>📋 paste</button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          addFrom([...e.target.files]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
