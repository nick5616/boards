import { useEffect, useRef, useState } from "react";
import { uid } from "../../utils/uid";
import { useData } from "../../contexts/DataContext";
import { caps } from "../../lib/caps";
import { harmonies, inkOn, nameFor, normHex, toRgb } from "../../lib/paint";

const BLANK = () => ({ id: uid(), name: "My look", chips: [] });

// A paint-store swatch fan. Pick any colour on screen (the eyedropper can even
// grab a clipping's picture), or click into a photo; every chip gets a paint-store name.
// Chips live in "looks" (palettes). Click a chip to copy its hex.
export default function PaintChips({ mod, setState, expanded }) {
  const { uid: me, toast } = useData();
  const [fresh] = useState(BLANK); // stands in until the first edit saves a look
  const looks = mod.state.looks?.length ? mod.state.looks : [fresh];
  const look = looks.find((l) => l.id === mod.state.active) ?? looks[0];
  const [sel, setSel] = useState(null);
  const [src, setSrc] = useState(null); // blob url of the picture being sampled
  const [drag, setDrag] = useState(null); // { id, from } chip being dragged
  const canvas = useRef(null);
  const colorIn = useRef(null);
  const fileIn = useRef(null);
  const chip = look.chips.find((c) => c.id === sel);

  // Nothing saved yet (or the active look vanished): write the first look down
  const edit = (fn) =>
    setState((s) => {
      const ls = s.looks?.length ? s.looks : [fresh];
      const active = ls.some((l) => l.id === s.active) ? s.active : ls[0].id;
      return fn({ ...s, looks: ls, active });
    });
  const editLook = (id, fn) => edit((s) => ({ ...s, looks: s.looks.map((l) => (l.id === id ? fn(l) : l)) }));

  const add = (hex) => {
    const h = normHex(hex);
    if (!h) return;
    const c = { id: uid(), hex: h, name: nameFor(h), by: me, at: Date.now() };
    edit((s) => ({ ...s, looks: s.looks.map((l) => (l.id === s.active ? { ...l, chips: [...l.chips, c] } : l)) }));
    setSel(c.id);
  };

  const pick = async () => {
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      add(sRGBHex);
    } catch {
      // Esc closes the dropper; nothing to add
    }
  };

  const copy = (c) => {
    setSel(c.id);
    navigator.clipboard?.writeText(c.hex).then(
      () => toast?.(`${c.hex} copied`),
      () => toast?.(c.hex),
    );
  };

  const patchChip = (id, patch) =>
    editLook(look.id, (l) => ({ ...l, chips: l.chips.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const removeChip = (id) => {
    editLook(look.id, (l) => ({ ...l, chips: l.chips.filter((c) => c.id !== id) }));
    setSel(null);
  };

  // Move a chip to another look, or (before = chip id) to a spot in this one
  const moveChip = (id, toLook, before = null) =>
    edit((s) => {
      const c = s.looks.flatMap((l) => l.chips).find((x) => x.id === id);
      if (!c || before === id) return s;
      return {
        ...s,
        looks: s.looks.map((l) => {
          const rest = l.chips.filter((x) => x.id !== id);
          if (l.id !== toLook) return { ...l, chips: rest };
          const i = before ? rest.findIndex((x) => x.id === before) : -1;
          return { ...l, chips: i < 0 ? [...rest, c] : [...rest.slice(0, i), c, ...rest.slice(i)] };
        }),
      };
    });

  const addLook = () => {
    const l = { id: uid(), name: `Look ${looks.length + 1}`, chips: [] };
    edit((s) => ({ ...s, looks: [...s.looks, l], active: l.id }));
    setSel(null);
  };
  const dropLook = () => {
    if (looks.length < 2) return;
    edit((s) => {
      const ls = s.looks.filter((l) => l.id !== look.id);
      return { ...s, looks: ls, active: ls[0].id };
    });
    setSel(null);
  };

  // ── Sampling from a picture ──
  const takePicture = (file) => {
    if (!file?.type.startsWith("image/")) return;
    setSrc(URL.createObjectURL(file));
  };
  useEffect(() => () => src && URL.revokeObjectURL(src), [src]);
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      const c = canvas.current;
      if (!c) return;
      const k = Math.min(1, 560 / img.width, 360 / img.height);
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0, c.width, c.height);
    };
    img.src = src;
  }, [src]);
  const sample = (e) => {
    const c = canvas.current;
    const r = c.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * c.width);
    const y = Math.floor(((e.clientY - r.top) / r.height) * c.height);
    const [R, G, B, A] = c.getContext("2d").getImageData(x, y, 1, 1).data;
    if (A) add(`#${[R, G, B].map((v) => v.toString(16).padStart(2, "0")).join("")}`);
  };

  const onPaste = (e) => {
    const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
    if (!f) return;
    e.preventDefault();
    e.stopPropagation();
    takePicture(f);
  };

  return (
    <div
      className="pc"
      tabIndex={-1}
      onPaste={onPaste}
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDrop={(e) => {
        const f = e.dataTransfer.files?.[0];
        if (f) {
          e.preventDefault();
          takePicture(f);
        }
      }}
    >
      <div className="pc-looks" role="tablist">
        {looks.map((l) => (
          <button
            key={l.id}
            role="tab"
            aria-selected={l.id === look.id}
            className={`pc-look${l.id === look.id ? " on" : ""}${drag && drag.from !== l.id ? " target" : ""}`}
            onClick={() => {
              edit((s) => ({ ...s, active: l.id }));
              setSel(null);
            }}
            onDragOver={(e) => drag && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (drag) moveChip(drag.id, l.id);
              setDrag(null);
            }}
          >
            {l.name}
            <i>{l.chips.length}</i>
          </button>
        ))}
        <button className="pc-look pc-plus" onClick={addLook} aria-label="New look">+</button>
      </div>

      <div className="pc-tools">
        {caps.eyedropper && (
          <button className="mini-btn" onClick={pick} title="grab any colour on screen">
            ✎ Pick
          </button>
        )}
        <button className="mini-btn ghost" onClick={() => colorIn.current?.click()} title="choose a colour">
          ◐ Mix
        </button>
        <button className="mini-btn ghost" onClick={() => fileIn.current?.click()} title="click colours out of a picture">
          ▣ From a picture
        </button>
        <input ref={colorIn} type="color" className="pc-hidden" onChange={(e) => add(e.target.value)} />
        <input
          ref={fileIn}
          type="file"
          accept="image/*"
          className="pc-hidden"
          onChange={(e) => {
            takePicture(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {src && (
        <div className="pc-photo">
          <canvas ref={canvas} onClick={sample} aria-label="Click to sample a colour" />
          <button className="x-btn" onClick={() => setSrc(null)} aria-label="Put the picture away">✕</button>
        </div>
      )}

      <div className="pc-fan">
        {look.chips.length === 0 && (
          <div className="pc-empty">
            {caps.eyedropper ? "pick a colour, or paste a picture or a #hex" : "mix a colour, or drop in a picture to sample"}
          </div>
        )}
        {look.chips.map((c, i) => (
          <button
            key={c.id}
            draggable
            className={`pc-chip${c.id === sel ? " on" : ""}${drag?.id === c.id ? " lifted" : ""}`}
            style={{ "--r": `${((i % 9) - 4) * 1.6}deg` }}
            onClick={() => copy(c)}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", c.hex);
              setDrag({ id: c.id, from: look.id });
            }}
            onDragEnd={() => setDrag(null)}
            onDragOver={(e) => drag && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (drag) moveChip(drag.id, look.id, c.id);
              setDrag(null);
            }}
            title={`${c.name} · ${c.hex} · rgb(${toRgb(c.hex).join(", ")})`}
          >
            <span className="pc-swatch" style={{ background: c.hex, color: inkOn(c.hex) }}>
              <small>rgb {toRgb(c.hex).join(" ")}</small>
            </span>
            <span className="pc-label">
              <b>{c.name}</b>
              <em>{c.hex}</em>
            </span>
          </button>
        ))}
      </div>

      {chip && (
        <div className="pc-detail">
          <input
            className="line-input"
            value={chip.name}
            aria-label="Chip name"
            onChange={(e) => patchChip(chip.id, { name: e.target.value })}
          />
          <div className="pc-harm">
            {harmonies(chip.hex).map((h) => (
              <div key={h.id} className="pc-h">
                <span>{h.label}</span>
                {h.hexes.map((hx) => (
                  <button
                    key={hx}
                    className="pc-ghost"
                    style={{ "--c": hx }}
                    onClick={() => add(hx)}
                    title={`add ${hx}`}
                    aria-label={`Add ${hx}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="pc-acts">
            {looks.length > 1 && (
              <select
                value=""
                aria-label="Move to look"
                onChange={(e) => {
                  if (!e.target.value) return;
                  moveChip(chip.id, e.target.value);
                  setSel(null);
                }}
              >
                <option value="">move to…</option>
                {looks.filter((l) => l.id !== look.id).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
            <button className="x-btn" onClick={() => removeChip(chip.id)} aria-label="Tear off this chip">✕</button>
          </div>
        </div>
      )}

      {(expanded || !chip) && (
        <div className="pc-foot">
          <input
            className="line-input"
            value={look.name}
            aria-label="Look name"
            onChange={(e) => editLook(look.id, (l) => ({ ...l, name: e.target.value }))}
          />
          {looks.length > 1 && (
            <button className="x-btn" onClick={dropLook} aria-label="Throw away this look">🗑</button>
          )}
        </div>
      )}
    </div>
  );
}
