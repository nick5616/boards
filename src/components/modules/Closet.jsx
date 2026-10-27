import { useMemo, useRef, useState } from "react";
import { useData } from "../../contexts/DataContext";
import { useImage } from "../../hooks/useEntries";
import { compressImage, saveImage, deleteImage, copyImage, loadImage } from "../../lib/data";
import { nameFor, inkOn } from "../../lib/paint";
import { dayKey, dayDiff, keyToDate, prettyDate } from "../../utils/date";
import { CATS, FAMILY_HEX, catFor, colorFamily, dominantHex, lastWorn, money, newPiece, priceNum } from "../../lib/wardrobe";

// Little flat garment shapes, filled with the piece's colour when there's no photo
const SHAPE = {
  tops: "M18 8 L24 12 Q30 17 36 12 L42 8 L56 18 L48 28 L43 24 L43 54 L17 54 L17 24 L12 28 L4 18 Z",
  bottoms: "M14 6 H46 L50 56 H34 L30 24 L26 56 H10 Z",
  dresses: "M22 6 L26 6 Q30 14 34 6 L38 6 L40 26 L52 56 H8 L20 26 Z",
  outer: "M16 6 L24 10 L30 20 L36 10 L44 6 L56 16 L50 32 L44 28 L44 56 H16 L16 28 L10 32 L4 16 Z",
  shoes: "M8 12 H24 L26 34 Q42 36 54 46 V54 H6 Z",
  extras: "M16 26 H44 L48 54 H12 Z M21 26 Q21 10 30 10 Q39 10 39 26",
};

// Tally marks on a laundry tag: four strokes and a slash through, one stroke per wear
function Marks({ n }) {
  const shown = Math.min(n, 40);
  const fives = Math.floor(shown / 5), rest = shown % 5;
  return (
    <svg className="cl-marks" width={Math.max(14, (fives + (rest ? 1 : 0)) * 17)} height="16" viewBox={`0 0 ${Math.max(14, (fives + (rest ? 1 : 0)) * 17)} 16`} aria-label={`${n} wears`}>
      {Array.from({ length: fives }, (_, g) => (
        <g key={g} transform={`translate(${g * 17} 0)`}>
          <path d="M2 2v12M6 2v12M10 2v12M14 2v12" />
          <path d="M0 12L16 4" className="slash" />
        </g>
      ))}
      {rest > 0 && <path transform={`translate(${fives * 17} 0)`} d={Array.from({ length: rest }, (_, i) => `M${2 + i * 4} 2v12`).join("")} />}
    </svg>
  );
}

function Hanger() {
  return (
    <svg className="cl-hanger" viewBox="0 0 64 26" aria-hidden="true">
      <path d="M32 11 L32 8 C32 4 36 3 37 6 C38 9 34 10 32 8" fill="none" />
      <path d="M32 11 L5 23 Q3 24 5 25 H59 Q61 24 59 23 Z" fill="rgba(255,255,255,0.35)" />
    </svg>
  );
}

function Piece({ it, today, onWear, onEdit }) {
  const { uid } = useData();
  const own = useImage(uid, it.imageId);
  const pic = own ?? it.pic;
  const last = lastWorn(it);
  const n = it.wears?.length ?? 0;
  const dusty = dayDiff(keyToDate(last ?? it.bought ?? dayKey(it.at)), keyToDate(today)) >= 90;
  const worn = it.wears?.includes(today);
  const cost = priceNum(it.cost);
  return (
    <div className={`cl-item${dusty ? " dusty" : ""}`}>
      <Hanger />
      <div className="cl-garment">
        {pic ? (
          <img src={pic} alt="" referrerPolicy="no-referrer" />
        ) : (
          <svg viewBox="0 0 60 60" aria-hidden="true">
            <path d={SHAPE[it.cat] ?? SHAPE.tops} fill={it.hex} stroke="rgba(42,37,32,0.55)" strokeWidth="1.4" strokeLinejoin="round" fillRule="evenodd" />
            <path d="M30 16V50" stroke={inkOn(it.hex)} strokeOpacity="0.22" strokeDasharray="2 3" fill="none" />
          </svg>
        )}
      </div>
      <div className="cl-tag">
        <button className="cl-name" onClick={onEdit} title="Edit this piece">{it.name || "unnamed"}</button>
        <div className="cl-sub">
          <i style={{ background: it.hex }} />
          {nameFor(it.hex)}
        </div>
        <div className="cl-wears">
          <Marks n={n} />
          {n > 0 && <b>{n}×</b>}
        </div>
        <div className="cl-cpw">
          {cost == null ? (n ? "no price yet" : "") : n ? `${money(cost / n)}/wear` : `${money(cost)} · not worn yet`}
        </div>
        <button className={`cl-wore${worn ? " on" : ""}`} onClick={onWear}>
          {worn ? "✓ wore it today" : "wore it today"}
        </button>
        {dusty && <div className="cl-dust">{last ? `last worn ${prettyDate(last)}` : "never worn"}</div>}
      </div>
    </div>
  );
}

// A wardrobe rail of things you own. Hangers carry laundry-style tags: tap "wore it
// today" and the tally grows while cost-per-wear shrinks. Paste a link or a line to add a piece.
export default function Closet({ board, mod, setState, expanded }) {
  const { uid, updateBoard, toast } = useData();
  const items = mod.state.items ?? [];
  const today = dayKey();
  const [cat, setCat] = useState(null);
  const [fam, setFam] = useState(null);
  const [menu, setMenu] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showDusty, setShowDusty] = useState(false);
  const fileIn = useRef(null);

  const wishlists = board.modules.filter((m) => m.type === "wishlist");
  const wishes = wishlists.flatMap((m) => (m.state.items ?? []).map((w) => ({ w, m })));
  const clips = board.modules.filter((m) => m.type === "clipping" && m.state.url);

  const patch = (id, fn, opts) =>
    setState((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...fn(i) } : i)) }), opts);
  const add = (fields) => {
    const p = newPiece(fields);
    setState((s) => ({ ...s, items: [p, ...(s.items ?? [])] }));
    setEditId(p.id);
    setMenu(false);
    return p;
  };
  const wear = (it) => patch(it.id, (i) => ({ wears: i.wears.includes(today) ? i.wears.filter((d) => d !== today) : [...i.wears, today].sort() }));

  // Bought it: the wishlist line becomes a hanger and goes into the "got" pile over there
  const boughtWish = ({ w, m }) => {
    add({ name: w.text, cat: catFor(w.text), bought: today, url: w.url });
    updateBoard(board.id, (b) => ({
      ...b,
      modules: b.modules.map((x) =>
        x.id === m.id
          ? { ...x, state: { ...x.state, items: x.state.items.filter((i) => i.id !== w.id), done: [{ ...w, how: "got", closedAt: Date.now() }, ...(x.state.done ?? [])].slice(0, 300) } }
          : x
      ),
    }));
    toast?.({ text: `“${w.text}” is in the closet` });
  };
  const boughtClip = (m) => {
    const c = m.state;
    const name = c.title || m.title;
    // Their own picture is copied (so the closet can delete it alone); a page's picture is just pointed at
    const imageId = c.imageId ? copyImage(uid, board.id, c.imageId) : null;
    const p = add({ name, cat: catFor(name ?? ""), cost: priceNum(c.price), bought: today, url: c.url, pic: imageId ? null : c.image ?? null, imageId });
    const shot = imageId ? loadImage(uid, c.imageId) : c.image ? Promise.resolve(c.image) : null;
    shot?.then((src) => src && dominantHex(src)).then((hex) => hex && patch(p.id, () => ({ hex })));
  };

  const setPhoto = async (it, file) => {
    try {
      const data = await compressImage(file);
      const imageId = saveImage(uid, board.id, data);
      if (it.imageId) deleteImage(uid, it.imageId);
      patch(it.id, () => ({ imageId, pic: null }));
      dominantHex(data).then((hex) => hex && patch(it.id, () => ({ hex })));
    } catch {
      toast?.({ text: "couldn't read that picture" });
    }
  };
  const drop = (it) => {
    if (!confirm(`Take “${it.name || "this piece"}” out of the closet?`)) return;
    if (it.imageId) deleteImage(uid, it.imageId);
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== it.id) }));
    setEditId(null);
  };

  const cats = CATS.filter((c) => items.some((i) => i.cat === c.id));
  const fams = useMemo(() => [...new Set(items.map((i) => colorFamily(i.hex)))], [items]);
  const shown = items.filter((i) => (!cat || i.cat === cat) && (!fam || colorFamily(i.hex) === fam));
  const stale = items
    .filter((i) => dayDiff(keyToDate(lastWorn(i) ?? i.bought ?? dayKey(i.at)), keyToDate(today)) >= 90)
    .sort((a, b) => (lastWorn(a) ?? "").localeCompare(lastWorn(b) ?? ""));
  const spent = items.reduce((t, i) => t + (i.wears?.length ? priceNum(i.cost) ?? 0 : 0), 0); // only what's been worn has a per-wear cost
  const wearsAll = items.reduce((t, i) => t + (i.wears?.length ?? 0), 0);
  const editing = items.find((i) => i.id === editId);

  return (
    <div className={`cl${expanded ? " big" : ""}`}>
      <div className="cl-top">
        <div className="cl-filters">
          {cats.length > 1 && (
            <>
              <button className={`pc-look${!cat ? " on" : ""}`} onClick={() => setCat(null)}>all<i>{items.length}</i></button>
              {cats.map((c) => (
                <button key={c.id} className={`pc-look${cat === c.id ? " on" : ""}`} onClick={() => setCat(cat === c.id ? null : c.id)}>
                  {c.label}
                </button>
              ))}
            </>
          )}
          {fams.length > 1 && (
            <span className="cl-dots" role="group" aria-label="Colour">
              {fams.map((f) => (
                <button key={f} className={fam === f ? "on" : ""} style={{ background: FAMILY_HEX[f] }} title={f} aria-label={f} onClick={() => setFam(fam === f ? null : f)} />
              ))}
            </span>
          )}
        </div>
        <div className="cl-addwrap">
          <button className="mini-btn" onClick={() => setMenu((v) => !v)} aria-expanded={menu}>+ add</button>
          {menu && (
            <div className="card-menu cl-menu" role="menu">
              <button role="menuitem" onClick={() => add({})}>✎ a new piece</button>
              {wishes.length > 0 && <div className="cl-menu-h">bought it → closet</div>}
              {wishes.slice(0, 12).map((x) => (
                <button key={x.w.id} role="menuitem" onClick={() => { boughtWish(x); }}>☐ {x.w.text}</button>
              ))}
              {clips.length > 0 && <div className="cl-menu-h">from a clipping</div>}
              {clips.slice(0, 8).map((m) => (
                <button key={m.id} role="menuitem" onClick={() => { boughtClip(m); }}>
                  ✂ {m.title}{m.state.price ? ` · ${m.state.price}` : ""}
                </button>
              ))}
              {!wishes.length && !clips.length && <div className="cl-menu-h">paste a link or a line to add one</div>}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="cl-edit">
          <input className="line-input" autoFocus placeholder="what is it?" value={editing.name} onChange={(e) => patch(editing.id, () => ({ name: e.target.value }), { debounce: 400 })} />
          <div className="cl-edit-row">
            <select value={editing.cat} onChange={(e) => patch(editing.id, () => ({ cat: e.target.value }))} aria-label="Category">
              {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <label className="cl-color" title={nameFor(editing.hex)}>
              <input type="color" value={editing.hex} onChange={(e) => patch(editing.id, () => ({ hex: e.target.value }), { debounce: 300 })} />
              <span>{nameFor(editing.hex)}</span>
            </label>
          </div>
          <div className="cl-edit-row">
            <label>$ <input type="number" min="0" step="0.01" placeholder="cost" value={editing.cost ?? ""} onChange={(e) => patch(editing.id, () => ({ cost: e.target.value === "" ? null : Number(e.target.value) }), { debounce: 400 })} /></label>
            <label>bought <input type="date" value={editing.bought ?? ""} onChange={(e) => patch(editing.id, () => ({ bought: e.target.value || null }))} /></label>
          </div>
          <div className="cl-edit-row">
            <button className="mini-btn ghost" onClick={() => fileIn.current?.click()}>▣ photo</button>
            {editing.url && <a className="mini-btn ghost" href={editing.url} target="_blank" rel="noopener noreferrer">↗ shop</a>}
            <input ref={fileIn} type="file" accept="image/*" className="pc-hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; f && setPhoto(editing, f); }} />
            <button className="mini-btn ghost" onClick={() => drop(editing)}>🗑</button>
            <button className="mini-btn" onClick={() => setEditId(null)}>done</button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="cl-empty">An empty rail. Paste a link or a line to hang something up, or + add.</div>
      ) : (
        <div className="cl-rail">
          {shown.map((it) => (
            <Piece key={it.id} it={it} today={today} onWear={() => wear(it)} onEdit={() => setEditId(it.id)} />
          ))}
          {!shown.length && <div className="cl-empty">nothing like that in here</div>}
        </div>
      )}

      {items.length > 0 && (
        <div className="cl-foot">
          <span>{items.length} piece{items.length === 1 ? "" : "s"}{spent > 0 && wearsAll > 0 ? ` · ${money(spent / wearsAll)} a wear overall` : ""}</span>
        </div>
      )}
      {stale.length > 0 && (
        <>
          <button className="pile-toggle" onClick={() => setShowDusty((v) => !v)}>
            {showDusty ? "▾" : "▸"} haven't worn in 90 days ({stale.length})
          </button>
          {showDusty &&
            stale.map((i) => (
              <div key={i.id} className="pile-row cl-stale">
                <span className="pile-text">{i.name || "unnamed"}</span>
                <span className="pile-when">{lastWorn(i) ? prettyDate(lastWorn(i)) : "never worn"}</span>
                <button className="x-btn" onClick={() => wear(i)} title="Wore it today">👚</button>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
