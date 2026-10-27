import { useEffect, useMemo, useRef, useState } from "react";
import { uid as newId } from "../../utils/uid";
import { useData } from "../../contexts/DataContext";
import { useImage } from "../../hooks/useEntries";
import { saveImage, deleteImage, loadImage } from "../../lib/data";
import { imagesIn, pointerTarget } from "../../lib/paste";
import { priceLabel } from "../../lib/unfurl";
import { SHAPES, SKINS, bodyPath, money, priceNum } from "../../lib/wardrobe";
import CutOut from "./CutOut";

const readFile = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

// The doll herself: a plain mannequin with no face, on a little wooden stand
function Doll({ doll }) {
  const shape = SHAPES[doll?.shape] ?? SHAPES.curvy;
  const skin = doll?.skin ?? SKINS[2];
  return (
    <svg className="pd-doll" viewBox="0 0 200 330" preserveAspectRatio="none" aria-hidden="true">
      <ellipse cx="100" cy="316" rx="62" ry="8" fill="#a67c52" stroke="#6e4f30" strokeWidth="1.5" />
      <rect x="38" y="306" width="124" height="10" rx="3" fill="#c49a6c" stroke="#6e4f30" strokeWidth="1.5" />
      <path d="M73 296 q-4 8 -2 12 h58 q2 -4 -2 -12" fill="#b78c5e" stroke="#6e4f30" strokeWidth="1.2" />
      {/* arms behind the body */}
      <path d={`M${100 - shape.sh + 4} 78 Q${100 - shape.sh - 14} 120 ${100 - shape.sh - 10} 170`} stroke={skin} strokeWidth="12" strokeLinecap="round" fill="none" />
      <path d={`M${100 + shape.sh - 4} 78 Q${100 + shape.sh + 14} 120 ${100 + shape.sh + 10} 170`} stroke={skin} strokeWidth="12" strokeLinecap="round" fill="none" />
      <path d={bodyPath(shape)} fill={skin} stroke="rgba(42,37,32,0.55)" strokeWidth="1.5" strokeLinejoin="round" />
      <ellipse cx="100" cy="30" rx="15" ry="19" fill={skin} stroke="rgba(42,37,32,0.55)" strokeWidth="1.5" />
      {/* a few sewing guides, like a dress form */}
      <path d={`M${100 - shape.wa} 134 Q100 139 ${100 + shape.wa} 134`} fill="none" stroke="rgba(42,37,32,0.22)" strokeWidth="1" strokeDasharray="3 3" />
      <path d="M100 66 V192" stroke="rgba(42,37,32,0.14)" strokeWidth="1" strokeDasharray="2 4" />
    </svg>
  );
}

// One cut-out lying on the doll. Positions are fractions of the stage so it scales to any size.
function Layer({ layer, cut, me, selected, live, onPick, onDrag, onKnob, small }) {
  const src = useImage(me, cut?.imageId);
  if (!cut) return null;
  const l = live ? { ...layer, ...live } : layer;
  return (
    <div
      className={`pd-layer${selected ? " sel" : ""}`}
      style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.s * 100}%`, transform: `translate(-50%, -50%) rotate(${l.r}deg)` }}
      onPointerDown={small ? undefined : (e) => { onPick(); onDrag(e); }}
    >
      {src && <img src={src} alt={cut.name} draggable={false} style={{ aspectRatio: cut.ar || undefined }} />}
      {selected && !small && <span className="pd-knob" onPointerDown={onKnob} title="Drag to resize and turn" />}
    </div>
  );
}

function Stage({ doll, look, cuts, me, small, selId, live, onPick, onDrag, onKnob, stageRef }) {
  return (
    <div className={`pd-stage${small ? " small" : ""}`} ref={stageRef} onPointerDown={small ? undefined : (e) => e.target === e.currentTarget && onPick(null)}>
      <Doll doll={doll} />
      {(look?.layers ?? []).map((l) => (
        <Layer
          key={l.id}
          layer={l}
          cut={cuts.find((c) => c.id === l.cid)}
          me={me}
          small={small}
          selected={selId === l.id}
          live={live?.id === l.id ? live : null}
          onPick={() => onPick(l.id)}
          onDrag={(e) => onDrag(e, l)}
          onKnob={(e) => onKnob(e, l)}
        />
      ))}
    </div>
  );
}

function Thumb({ me, cut, onClick, onDelete, mark }) {
  const src = useImage(me, cut.imageId);
  return (
    <div className="pd-cut">
      <button className="pd-cut-pic" onClick={onClick} title={`Put “${cut.name}” on the doll`}>
        {src && <img src={src} alt={cut.name} />}
        {mark && <i className="pd-used">on</i>}
      </button>
      <button className="x-btn" onClick={onDelete} aria-label={`Throw away ${cut.name}`}>✕</button>
    </div>
  );
}

// A doll to dress. Cut garments out of your clippings (or any photo) with scissors
// and a wand, lay them on the doll, and keep each outfit as a card.
export default function PaperDoll({ board, mod, setState, expanded }) {
  const { uid: me, boards, toast } = useData();
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const fileIn = useRef(null);
  const s = mod.state;
  const cuts = s.cuts ?? [];
  const looks = s.looks?.length ? s.looks : [{ id: "first", name: "Look 1", layers: [] }];
  const look = looks.find((l) => l.id === s.active) ?? looks[0];
  const doll = s.doll ?? {};
  const [selId, setSelId] = useState(null);
  const [live, setLive] = useState(null); // the layer being dragged: { id, x, y, s, r }
  const [picking, setPicking] = useState(false);
  const [cutting, setCutting] = useState(null); // { src, name, from }
  const sel = look.layers.find((l) => l.id === selId);

  // Every clipping in every board that has a picture to cut from
  const clippings = useMemo(
    () =>
      (boards ?? []).flatMap((b) =>
        b.modules
          .filter((m) => m.type === "clipping" && m.state.url && (m.state.imageId || m.state.image || m.state.gallery?.length))
          .map((m) => ({ b, m }))
      ).sort((a, c) => (c.b.id === board.id) - (a.b.id === board.id)),
    [boards, board.id]
  );
  const sourceOf = (cut) => {
    const live = cut.from && boards?.find((b) => b.id === cut.from.boardId)?.modules.find((m) => m.id === cut.from.modId);
    const st = live?.state ?? cut.from;
    return st?.url ? { url: st.url, price: priceLabel(st.price, st.currency), n: priceNum(st.price), title: live?.title ?? cut.from?.title } : null;
  };

  // The state may not hold a first look yet: write it down on the first edit
  const edit = (fn, opts) =>
    setState((st) => {
      const ls = st.looks?.length ? st.looks : looks;
      const active = ls.some((l) => l.id === st.active) ? st.active : ls[0].id;
      return fn({ ...st, looks: ls, active });
    }, opts);
  const editLook = (fn, opts) => edit((st) => ({ ...st, looks: st.looks.map((l) => (l.id === st.active ? { ...l, layers: fn(l.layers) } : l)) }), opts);

  const putOn = (cut) => {
    const layer = { id: newId(), cid: cut.id, x: 0.5, y: 0.42, s: Math.min(0.62, 0.34 + (cut.ar || 1) * 0.1), r: 0 };
    editLook((ls) => [...ls, layer]);
    setSelId(layer.id);
  };

  // ── Moving, resizing and turning a layer ──
  const stageBox = () => stageRef.current.getBoundingClientRect();
  const startDrag = (e, l) => {
    e.stopPropagation();
    const r = stageBox();
    const from = { px: e.clientX, py: e.clientY, x: l.x, y: l.y };
    let last = null;
    const mv = (ev) => {
      last = { id: l.id, x: from.x + (ev.clientX - from.px) / r.width, y: from.y + (ev.clientY - from.py) / r.height };
      setLive(last);
    };
    finishOn(mv, () => last && commit(l.id, last));
  };
  const startKnob = (e, l) => {
    e.stopPropagation();
    e.preventDefault();
    const r = stageBox();
    const cx = r.left + l.x * r.width, cy = r.top + l.y * r.height;
    const v0 = [e.clientX - cx, e.clientY - cy];
    const d0 = Math.hypot(...v0) || 1, a0 = Math.atan2(v0[1], v0[0]);
    let last = null;
    const mv = (ev) => {
      const v = [ev.clientX - cx, ev.clientY - cy];
      last = {
        id: l.id,
        s: Math.min(1.4, Math.max(0.08, (l.s * Math.hypot(...v)) / d0)),
        r: Math.round(l.r + ((Math.atan2(v[1], v[0]) - a0) * 180) / Math.PI),
      };
      setLive(last);
    };
    finishOn(mv, () => last && commit(l.id, last));
  };
  const finishOn = (mv, done) => {
    const up = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      done();
      setLive(null);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const commit = (id, patch) => {
    const { id: _id, ...rest } = patch;
    editLook((ls) => ls.map((l) => (l.id === id ? { ...l, ...rest } : l)));
  };
  const nudge = (patch) => sel && commit(sel.id, patch(sel));
  const order = (d) =>
    editLook((ls) => {
      const i = ls.findIndex((l) => l.id === selId);
      const j = Math.min(ls.length - 1, Math.max(0, i + d));
      if (i < 0 || i === j) return ls;
      const out = [...ls];
      out.splice(j, 0, out.splice(i, 1)[0]);
      return out;
    });
  const takeOff = () => {
    editLook((ls) => ls.filter((l) => l.id !== selId));
    setSelId(null);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (!selId || !rootRef.current?.contains(document.activeElement) || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        takeOff();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── Looks ──
  const addLook = (copy) => {
    const l = { id: newId(), name: copy ? `${look.name} (copy)` : `Look ${looks.length + 1}`, layers: copy ? look.layers.map((x) => ({ ...x, id: newId() })) : [] };
    edit((st) => ({ ...st, looks: [...st.looks, l], active: l.id }));
    setSelId(null);
  };
  const renameLook = (l) => {
    const name = prompt("Name this look", l.name);
    if (name?.trim()) edit((st) => ({ ...st, looks: st.looks.map((x) => (x.id === l.id ? { ...x, name: name.trim() } : x)) }));
  };
  const dropLook = () => {
    if (looks.length < 2 || !confirm(`Put away “${look.name}”?`)) return;
    edit((st) => {
      const rest = st.looks.filter((l) => l.id !== look.id);
      return { ...st, looks: rest, active: rest[0].id };
    });
    setSelId(null);
  };

  // ── Cut-outs ──
  const startCut = async (clip) => {
    setPicking(false);
    const st = clip.m.state;
    const own = st.imageId ? await loadImage(me, st.imageId) : null;
    const url = own ?? st.image ?? st.gallery?.[0]?.image;
    setCutting({
      src: url,
      name: clip.m.title,
      from: { boardId: clip.b.id, modId: clip.m.id, title: clip.m.title, url: st.url, price: st.price, currency: st.currency },
    });
  };
  const startFile = async (file, inboxId = null) => {
    if (!file) return;
    try {
      setPicking(false);
      setCutting({ src: await readFile(file), name: file.name.replace(/\.\w+$/, ""), from: null, inboxId });
    } catch {
      toast?.({ text: "couldn't read that picture" });
    }
  };
  const startInbox = async (item) => {
    const src = await loadImage(me, item.imageId);
    if (src) setCutting({ src, name: "a photo", from: null, inboxId: item.id, inboxImage: item.imageId });
  };
  const saved = (png, ar) => {
    const imageId = saveImage(me, board.id, png);
    const c = { id: newId(), name: cutting.name || "garment", imageId, ar: Math.round(ar * 1000) / 1000, from: cutting.from ?? null };
    if (cutting.inboxImage) deleteImage(me, cutting.inboxImage);
    edit((st) => ({ ...st, cuts: [...(st.cuts ?? []), c], inbox: (st.inbox ?? []).filter((i) => i.id !== cutting.inboxId) }));
    setCutting(null);
    putOn(c);
  };
  const dropCut = (cut) => {
    if (!confirm(`Throw away the “${cut.name}” cut-out? It comes off every look.`)) return;
    deleteImage(me, cut.imageId);
    edit((st) => ({
      ...st,
      cuts: st.cuts.filter((c) => c.id !== cut.id),
      looks: st.looks.map((l) => ({ ...l, layers: l.layers.filter((x) => x.cid !== cut.id) })),
    }));
  };

  // A picture dropped or pasted on the doll goes straight to the cutting table
  useEffect(() => {
    const frame = rootRef.current?.closest(".mod");
    if (!frame) return;
    const onPaste = (e) => {
      const [file] = imagesIn(e.clipboardData?.files);
      if (!file || !frame.contains(pointerTarget())) return;
      e.preventDefault();
      startFile(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const wearing = look.layers.map((l) => cuts.find((c) => c.id === l.cid)).filter(Boolean);
  const total = [...new Set(wearing)].reduce((t, c) => t + (sourceOf(c)?.n ?? 0), 0);
  const selCut = sel && cuts.find((c) => c.id === sel.cid);
  const selSrc = selCut && sourceOf(selCut);
  const inbox = s.inbox ?? [];

  return (
    <div
      className={`pd${expanded ? " big" : ""}`}
      ref={rootRef}
      tabIndex={-1}
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDrop={(e) => {
        const [file] = imagesIn(e.dataTransfer.files);
        if (!file) return;
        e.preventDefault();
        startFile(file);
      }}
    >
      <div className="pd-top">
        <div className="pd-stagewrap">
          <Stage doll={doll} look={look} cuts={cuts} me={me} selId={selId} live={live} onPick={setSelId} onDrag={startDrag} onKnob={startKnob} stageRef={stageRef} />
        </div>
        <div className="pd-side">
          <div className="pd-opt" role="group" aria-label="Body shape">
            {Object.entries(SHAPES).map(([id, sh]) => (
              <button key={id} className={`pc-look${(doll.shape ?? "curvy") === id ? " on" : ""}`} onClick={() => edit((st) => ({ ...st, doll: { ...(st.doll ?? {}), shape: id } }))}>
                {sh.label}
              </button>
            ))}
          </div>
          <div className="pd-skins" role="group" aria-label="Skin tone">
            {SKINS.map((c) => (
              <button key={c} className={(doll.skin ?? SKINS[2]) === c ? "on" : ""} style={{ background: c }} aria-label={`Skin ${c}`} onClick={() => edit((st) => ({ ...st, doll: { ...(st.doll ?? {}), skin: c } }))} />
            ))}
          </div>

          <div className="pd-h">Cut-outs</div>
          <div className="pd-cuts">
            {cuts.map((c) => (
              <Thumb key={c.id} me={me} cut={c} mark={look.layers.some((l) => l.cid === c.id)} onClick={() => putOn(c)} onDelete={() => dropCut(c)} />
            ))}
            {inbox.map((i) => (
              <button key={i.id} className="pd-cut-new inbox" onClick={() => startInbox(i)} title="A photo waiting to be cut out">✂ cut this</button>
            ))}
            <button className="pd-cut-new" onClick={() => setPicking(true)}>
              <b>✂</b>
              cut one out
            </button>
          </div>

          {sel && selCut ? (
            <div className="pd-tools">
              <div className="pd-tools-row">
                <button className="mini-btn ghost" onClick={() => nudge((l) => ({ r: l.r - 8 }))} title="Turn left">⟲</button>
                <button className="mini-btn ghost" onClick={() => nudge((l) => ({ r: l.r + 8 }))} title="Turn right">⟳</button>
                <button className="mini-btn ghost" onClick={() => nudge((l) => ({ s: Math.max(0.08, l.s * 0.9) }))} title="Smaller">−</button>
                <button className="mini-btn ghost" onClick={() => nudge((l) => ({ s: Math.min(1.4, l.s * 1.1) }))} title="Bigger">+</button>
                <button className="mini-btn ghost" onClick={() => order(1)} title="Bring forward">⇡</button>
                <button className="mini-btn ghost" onClick={() => order(-1)} title="Send back">⇣</button>
                <button className="mini-btn ghost" onClick={takeOff} title="Take it off the doll">✕</button>
              </div>
              <div className="pd-src">
                <b>{selCut.name}</b>
                {selSrc ? (
                  <>
                    {selSrc.price && <span className="pd-price">{selSrc.price}</span>}
                    <a href={selSrc.url} target="_blank" rel="noopener noreferrer">↗ shop</a>
                  </>
                ) : (
                  <span className="pd-nosrc">from a photo</span>
                )}
              </div>
            </div>
          ) : (
            <div className="pd-tip">{cuts.length ? "Tap a cut-out to put it on. Drag it into place; pull the corner dot to resize and turn." : "Cut a garment out of a clipping or a photo and dress her."}</div>
          )}
        </div>
      </div>

      <div className="pd-looks">
        <div className="pd-h">
          Outfits
          {wearing.length > 0 && <span className="pd-total">{wearing.length} piece{wearing.length === 1 ? "" : "s"}{total > 0 ? ` · ${money(total)}` : ""}</span>}
        </div>
        <div className="pd-cards">
          {looks.map((l) => (
            <div key={l.id} className={`pd-card${l.id === look.id ? " on" : ""}`}>
              <button className="pd-card-pic" onClick={() => { edit((st) => ({ ...st, active: l.id })); setSelId(null); }} aria-label={`Open ${l.name}`}>
                <Stage doll={doll} look={l} cuts={cuts} me={me} small />
              </button>
              <button className="pd-card-name" onClick={() => (l.id === look.id ? renameLook(l) : edit((st) => ({ ...st, active: l.id })))} title="Tap to open; tap again to rename">
                {l.name}
              </button>
            </div>
          ))}
          <div className="pd-card-acts">
            <button className="mini-btn ghost" onClick={() => addLook(false)}>+ new look</button>
            <button className="mini-btn ghost" onClick={() => addLook(true)} disabled={!look.layers.length}>⎘ keep as new</button>
            {looks.length > 1 && <button className="mini-btn ghost" onClick={dropLook}>🗑 this look</button>}
          </div>
        </div>
      </div>

      {picking && (
        <div className="pd-pick">
          <div className="pd-pick-head">
            <b>What are we cutting out?</b>
            <button className="x-btn" onClick={() => setPicking(false)} aria-label="Close">✕</button>
          </div>
          <div className="pd-pick-grid">
            <button className="pd-pick-file" onClick={() => fileIn.current?.click()}>
              <b>▣</b>a photo from this computer
              <i>or drop or paste one on the doll</i>
            </button>
            {clippings.map((c) => (
              <ClipPick key={c.m.id} c={c} me={me} here={c.b.id === board.id} onPick={() => startCut(c)} />
            ))}
          </div>
          {!clippings.length && <div className="pd-tip">No clippings with pictures yet. Clip a shop page and it'll show up here.</div>}
        </div>
      )}
      <input ref={fileIn} type="file" accept="image/*" className="pc-hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; startFile(f); }} />

      {cutting && (
        <CutOut
          src={cutting.src}
          name={cutting.name}
          onDone={saved}
          onClose={() => setCutting(null)}
          onFail={() => {
            setCutting(null);
            toast?.({ text: "that shop won't let me cut its picture. Save it and drop it on the doll." });
          }}
        />
      )}
    </div>
  );
}

function ClipPick({ c, me, here, onPick }) {
  const own = useImage(me, c.m.state.imageId);
  const pic = own ?? c.m.state.image ?? c.m.state.gallery?.[0]?.image;
  const price = priceLabel(c.m.state.price, c.m.state.currency);
  return (
    <button className="pd-pick-clip" onClick={onPick} title={`${c.m.title} · ${c.b.title}`}>
      {pic && <img src={pic} alt="" referrerPolicy="no-referrer" />}
      <span>{c.m.title}</span>
      <i>{price ?? ""}{!here ? ` · ${c.b.title}` : ""}</i>
    </button>
  );
}
