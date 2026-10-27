import { useState, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { useImage } from "../../hooks/useEntries";
import { uid as newId } from "../../utils/uid";
import { agoLabel, dayKey, prettyDate } from "../../utils/date";
import { saveImage, deleteImage, compressImage } from "../../lib/data";
import { sendAll } from "../../lib/readings";
import { hydrationOf } from "../../lib/recipe";
import SendTo, { WireTag } from "../board/SendTo";

// A small drawn loaf, filled in when it's earned
function Loaf({ on }) {
  return (
    <svg viewBox="0 0 32 22" className={`bk-loaf${on ? " on" : ""}`} aria-hidden="true">
      <path d="M4 20c-2 0-3-2-3-5 0-6 5-12 15-12s15 6 15 12c0 3-1 5-3 5z" />
      <path className="bk-score" d="M10 9l4-3M16 8l4-3M22 9l4-3" />
    </svg>
  );
}

export function Loaves({ n, onPick }) {
  return (
    <span className="bk-rate" role={onPick ? "radiogroup" : "img"} aria-label={`${n} of 5 loaves`}>
      {[1, 2, 3, 4, 5].map((i) =>
        onPick ? (
          <button key={i} role="radio" aria-checked={n === i} onClick={() => onPick(i === n ? 0 : i)} aria-label={`${i} loaves`}>
            <Loaf on={i <= n} />
          </button>
        ) : (
          <Loaf key={i} on={i <= n} />
        )
      )}
    </span>
  );
}

function Photo({ id }) {
  const { uid } = useData();
  const src = useImage(uid, id);
  return src ? <img className="bk-photo" src={src} alt="" draggable={false} /> : <span className="bk-photo" />;
}

// A little notebook of bakes: when, what, how many loaves out of five, a photo, hydration
// (typed, or pulled from a recipe card on this board). Writing one down puts a sticker on the chart.
export default function Bakes({ board, mod, setState }) {
  const { uid, toast, logPractice, undoLog, updateBoard } = useData();
  const { bakes = [] } = mod.state;
  const recipes = board.modules.filter((m) => m.type === "recipe");
  const blank = { name: "", rating: 0, hyd: "", notes: "", photo: null, from: "" };
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const fileRef = useRef(null);
  const set = (p) => setForm((f) => ({ ...f, ...p }));

  const pickRecipe = (id) => {
    const r = recipes.find((m) => m.id === id);
    const h = r && hydrationOf(r.state.ingredients);
    set({ from: id, ...(r && { name: form.name || r.title }), ...(h != null && { hyd: String(h) }) });
  };

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      set({ photo: await compressImage(file) });
    } catch {
      toast({ text: "couldn't read that picture" });
    }
  };

  const write = () => {
    const hyd = parseFloat(form.hyd);
    const name = form.name.trim() || "a loaf";
    const at = Date.now();
    const imageId = form.photo ? saveImage(uid, board.id, form.photo) : null;
    const bake = {
      id: newId(), at, name, rating: form.rating,
      ...(Number.isFinite(hyd) && { hyd }),
      ...(form.notes.trim() && { notes: form.notes.trim() }),
      ...(imageId && { imageId }),
    };
    setState((s) => ({ ...s, bakes: [bake, ...(s.bakes ?? [])] }));
    const entry = logPractice(board.id, `🍞 baked: ${bake.hyd != null ? `${bake.hyd}% ` : ""}${name}`);
    const sent = form.rating ? sendAll(updateBoard, board.id, mod.state.sendTo, { value: form.rating, unit: "loaves", label: "bake" }) : 0;
    toast({
      text: `bake written down ✓${sent ? " · sent" : ""}`,
      actions: [{
        label: "undo",
        run: () => {
          undoLog(entry);
          if (imageId) deleteImage(uid, imageId);
          setState((s) => ({ ...s, bakes: (s.bakes ?? []).filter((b) => b.id !== bake.id) }));
        },
      }],
    });
    setForm(blank);
    setOpen(false);
  };

  const toss = (b) => {
    if (b.imageId) deleteImage(uid, b.imageId);
    setState((s) => ({ ...s, bakes: (s.bakes ?? []).filter((x) => x.id !== b.id) }));
  };

  const last = bakes[0];
  return (
    <div className="bk">
      <div className="bk-cover">
        <b>Bake log</b>
        <span>{last ? `last bake ${agoLabel(last.at)}` : "no bakes yet"}</span>
      </div>

      {open ? (
        <div className="bk-form">
          <input className="bk-name" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="what did you bake?" aria-label="What you baked" autoFocus />
          <div className="bk-line">
            <Loaves n={form.rating} onPick={(rating) => set({ rating })} />
            <label className="bk-hyd">
              <input type="number" min="0" max="200" value={form.hyd} onChange={(e) => set({ hyd: e.target.value })} placeholder="—" aria-label="Hydration percent" />%
              <small>hydration</small>
            </label>
          </div>
          {recipes.length > 0 && (
            <select value={form.from} onChange={(e) => pickRecipe(e.target.value)} aria-label="Pull from a recipe card">
              <option value="">hydration from a recipe card…</option>
              {recipes.map((m) => {
                const h = hydrationOf(m.state.ingredients);
                return <option key={m.id} value={m.id}>{m.title}{h != null ? ` · ${h}%` : ""}</option>;
              })}
            </select>
          )}
          <textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="crumb, crust, what you'd change…" rows={3} aria-label="Notes" />
          <div className="bk-line">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
            <button className="mini-btn" onClick={() => fileRef.current?.click()}>{form.photo ? "↻ other photo" : "📷 add a photo"}</button>
            {form.photo && <img className="bk-photo sm" src={form.photo} alt="your photo" />}
          </div>
          <div className="bk-line">
            <button className="mini-btn" onClick={write}>write it down</button>
            <button className="mini-btn ghost" onClick={() => (setOpen(false), setForm(blank))}>never mind</button>
          </div>
        </div>
      ) : (
        <button className="mini-btn bk-new" onClick={() => setOpen(true)}>+ new bake</button>
      )}

      <ul className="bk-list">
        {bakes.map((b) => (
          <li key={b.id}>
            {b.imageId && <Photo id={b.imageId} />}
            <div className="bk-what">
              <b>{b.name}</b>
              <span>{prettyDate(dayKey(b.at))}{b.hyd != null && <em> · {b.hyd}%</em>}</span>
              {b.rating > 0 && <Loaves n={b.rating} />}
              {b.notes && <p>{b.notes}</p>}
            </div>
            <button className="x-btn" onClick={() => toss(b)} aria-label={`Remove ${b.name}`}>✕</button>
          </li>
        ))}
      </ul>
      <WireTag board={board} mod={mod} />
      <SendTo fold board={board} mod={mod} setState={setState} note="the loaf rating goes there when you write a bake down" />
    </div>
  );
}
