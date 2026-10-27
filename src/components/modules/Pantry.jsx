import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { uid as newId } from "../../utils/uid";
import { prettyDate } from "../../utils/date";
import { addLine } from "../../lib/groceries";
import { Empty, Fold, Credit, ChipRow } from "./kit";
import {
  SHELVES, statusOf, shelfItems, donePile, useUpList, expiryWords, inDays,
  cleanCode, lookupBarcode, canScan, readBarcode, readBarcodeFromFile,
} from "../../lib/pantry";

// A jar or a can on a shelf, tinted by how soon it needs using
function Tin({ item, open, onTap }) {
  const st = statusOf(item);
  const jar = /jar|sauce|jam|honey|pickle|spread|salsa/i.test(item.name);
  return (
    <button
      className={`pn-tin ${jar ? "jar" : "can"} ${st}${item.low ? " low" : ""}${open ? " open" : ""}`}
      onClick={onTap}
      aria-expanded={open}
      aria-label={`${item.name}, ${expiryWords(item)}${item.low ? ", running low" : ""}`}
    >
      <span className="pn-lid" />
      <span className="pn-label">{item.name.length > 22 ? `${item.name.slice(0, 21)}…` : item.name}</span>
      <span className="pn-when">{st === "nodate" ? "" : expiryWords(item)}</span>
      {item.low && <span className="pn-lowtag">low</span>}
    </button>
  );
}

// The scanner: camera frames go through BarcodeDetector until a code is read
function Scanner({ onCode, onClose }) {
  const videoRef = useRef(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let stream;
    let live = true;
    let timer;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!live) return stream.getTracks().forEach((t) => t.stop());
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play();
        const tick = async () => {
          if (!live) return;
          const code = v.readyState >= 2 ? await readBarcode(v) : null;
          if (code && live) return onCode(code);
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch {
        setErr("couldn't open the camera; type the digits instead");
      }
    })();
    return () => {
      live = false;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // onCode is stable enough for one scan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="pn-scan">
      <video ref={videoRef} playsInline muted />
      <div className="pn-scanline" aria-hidden="true" />
      <div className="pn-scanmsg">{err || "hold a barcode in the frame"}</div>
      <button className="mini-btn ghost" onClick={onClose}>close camera</button>
    </div>
  );
}

// A shelf of jars and cans with dates on them. Add one by barcode (camera, a photo, or typed
// digits: Open Food Facts names it), set when it expires, and it turns "use soon" then
// "expired" on its own. Used up or tossed, it moves to the done pile. State: items [{ id, name,
// brand?, qty?, code?, shelf, expires ("YYYY-MM-DD" | ""), low, grade?, at, doneAt?, how? ("used" | "tossed"), by? }]
export default function Pantry({ board, mod, setState, expanded, openBig }) {
  const { uid, updateBoard, toast } = useData();
  const items = shelfItems(mod.state);
  const done = donePile(mod.state);
  const soon = useUpList(mod.state);
  const groceries = board.modules.find((m) => m.type === "groceries");
  const [code, setCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(null); // { name, brand, qty, shelf, expires, code, grade }
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [openId, setOpenId] = useState(null);
  const fileRef = useRef(null);
  const set = (fn) => setState((s) => ({ ...s, items: fn(s.items ?? []) }));
  const patch = (id, f, opts) => setState((s) => ({ ...s, items: (s.items ?? []).map((i) => (i.id === id ? { ...i, ...f } : i)) }), opts);

  const look = async (raw) => {
    const c = cleanCode(raw);
    if (!c) return toast({ text: "a barcode is 8 to 14 digits" });
    setBusy(true);
    setScanning(false);
    try {
      const got = await lookupBarcode(c);
      setDraft(got ? { ...got, expires: "" } : { code: c, name: "", brand: "", qty: "", shelf: "pantry", grade: "", expires: "", unknown: true });
    } catch {
      setDraft({ code: c, name: "", brand: "", qty: "", shelf: "pantry", grade: "", expires: "", offline: true });
    }
    setBusy(false);
    setCode("");
  };

  const photo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    const c = canScan() ? await readBarcodeFromFile(f) : null;
    setBusy(false);
    if (c) look(c);
    else toast({ text: canScan() ? "couldn't read a barcode in that photo" : "this browser can't read barcodes from photos; type the digits" });
  };

  const stock = (d) => {
    const name = (d.name || "").trim();
    if (!name) return toast({ text: "what is it? give it a name" });
    set((all) => [
      ...all,
      { id: newId(), name, brand: d.brand || undefined, qty: d.qty || undefined, code: d.code || undefined, shelf: d.shelf || "pantry", expires: d.expires || "", low: false, grade: d.grade || undefined, at: Date.now(), by: uid },
    ]);
    setDraft(null);
  };

  const finish = (item, how) => {
    patch(item.id, { doneAt: Date.now(), how, low: false });
    toast({
      text: `${item.name} ${how === "used" ? "used up" : "tossed"}`,
      actions: [{ label: "undo", run: () => patch(item.id, { doneAt: null, how: null }) }],
    });
  };

  const toGrocery = (item) => {
    if (!groceries) return;
    updateBoard(board.id, (b) => ({
      ...b,
      modules: b.modules.map((m) => (m.id === groceries.id ? { ...m, state: addLine(m.state, item.name) } : m)),
    }));
    toast({ text: `${item.name} is on ${groceries.title} 🛒` });
  };

  const open = items.find((i) => i.id === openId);
  const addPanel = adding || draft || scanning;
  const SHOWN = 8; // tins on the board before "+ N more"
  let left = expanded ? Infinity : SHOWN;

  const addRow = (
    <>
      <div className="pn-add">
        <input
          className="line-input"
          inputMode="numeric"
          placeholder="barcode digits…"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && look(code)}
          aria-label="Barcode digits"
        />
        <button className="mini-btn" onClick={() => look(code)} disabled={busy || !code.trim()}>look up</button>
      </div>
      <div className="pn-add">
        {canScan() && !!navigator.mediaDevices?.getUserMedia && (
          <button className="mini-btn ghost" onClick={() => setScanning(!scanning)} aria-pressed={scanning} aria-label="Scan with the camera">📷 scan</button>
        )}
        {canScan() && (
          <>
            <button className="mini-btn ghost" onClick={() => fileRef.current?.click()} aria-label="Read a barcode from a photo">🖼 photo</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={photo} />
          </>
        )}
        <button className="mini-btn ghost" onClick={() => setDraft({ name: "", brand: "", qty: "", shelf: "pantry", grade: "", expires: "" })}>by hand</button>
        {adding && !scanning && <button className="x-btn" onClick={() => setAdding(false)} aria-label="Close">✕</button>}
      </div>
    </>
  );

  return (
    <div className="pn">
      {addPanel && !draft && (
        <div className="pn-panel">
          {addRow}
          {scanning && <Scanner onCode={look} onClose={() => setScanning(false)} />}
          {busy && <div className="pn-hint">looking it up…</div>}
        </div>
      )}

      {draft && (
        <div className="pn-panel">
          {draft.unknown && <div className="pn-hint">Open Food Facts doesn&apos;t know {draft.code}; name it yourself.</div>}
          {draft.offline && <div className="pn-hint">couldn&apos;t reach Open Food Facts; name it yourself.</div>}
          <input className="line-input" placeholder="what is it?" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="Name" />
          {(draft.brand || draft.qty || draft.grade) && (
            <div className="pn-hint">{[draft.brand, draft.qty, draft.grade && `nutri-score ${draft.grade.toUpperCase()}`].filter(Boolean).join(" · ")}</div>
          )}
          <div className="pn-row">
            <label>expires <input type="date" value={draft.expires} onChange={(e) => setDraft({ ...draft, expires: e.target.value })} /></label>
            <select value={draft.shelf} onChange={(e) => setDraft({ ...draft, shelf: e.target.value })} aria-label="Shelf">
              {SHELVES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <ChipRow label="Set the date">
            {[["+3d", 3], ["+1w", 7], ["+1mo", 30], ["+6mo", 180]].map(([l, n]) => (
              <button key={l} className="mini-btn ghost" onClick={() => setDraft({ ...draft, expires: inDays(n) })}>{l}</button>
            ))}
          </ChipRow>
          <div className="pn-row">
            <button className="mini-btn" onClick={() => (stock(draft), setAdding(false))}>put it on the shelf</button>
            <button className="mini-btn ghost" onClick={() => (setDraft(null), setAdding(false))}>never mind</button>
          </div>
        </div>
      )}

      {items.length === 0 && !addPanel && (
        <Empty action={<button className="mini-btn" onClick={() => setAdding(true)}>+ add something</button>}>an empty shelf</Empty>
      )}

      {items.length > 0 && !draft && (
        <>
          {soon.length > 0 && (
            <div className="pn-useup" role="status">
              use up: {soon.slice(0, 3).map((i) => i.name).join(", ")}{soon.length > 3 ? ` +${soon.length - 3}` : ""}
            </div>
          )}
          {SHELVES.map((sh) => {
            const here = items.filter((i) => (i.shelf || "pantry") === sh.id);
            if (!here.length || left <= 0) return null;
            const show = here.slice(0, left);
            left -= show.length;
            return (
              <div key={sh.id} className="pn-shelf">
                <div className="pn-shelfname">{sh.icon} {sh.label}</div>
                <div className="pn-board">
                  {show.map((i) => <Tin key={i.id} item={i} open={openId === i.id} onTap={() => setOpenId(openId === i.id ? null : i.id)} />)}
                </div>
              </div>
            );
          })}
          {!expanded && items.length > SHOWN && <button className="mini-btn ghost" onClick={openBig}>+ {items.length - SHOWN} more</button>}
          {!addPanel && <button className="mini-btn" onClick={() => setAdding(true)}>+ add</button>}
        </>
      )}

      {open && !draft && (
        <div className="pn-detail">
          <div className="pn-dname"><b>{open.name}</b>{[open.brand, open.qty].filter(Boolean).length ? <span> · {[open.brand, open.qty].filter(Boolean).join(" · ")}</span> : null}</div>
          <div className="pn-say">{open.expires ? `${prettyDate(open.expires)} · ${expiryWords(open)}` : "no date yet"}</div>
          <div className="pn-row">
            <button className="mini-btn" onClick={() => finish(open, "used")}>used it up ✓</button>
            <button className="mini-btn ghost" onClick={() => finish(open, "tossed")}>toss</button>
          </div>
          <Fold label="date, shelf, low">
            <div className="pn-row">
              <label>
                expires <input type="date" value={open.expires} onChange={(e) => patch(open.id, { expires: e.target.value })} />
              </label>
              <select value={open.shelf || "pantry"} onChange={(e) => patch(open.id, { shelf: e.target.value })} aria-label="Shelf">
                {SHELVES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="pn-row">
              <button className={`mini-btn ghost${open.low ? " on" : ""}`} onClick={() => patch(open.id, { low: !open.low })} aria-pressed={!!open.low}>running low</button>
              {open.low && groceries && <button className="mini-btn" onClick={() => toGrocery(open)}>🛒 add to {groceries.title}</button>}
              {open.low && !groceries && <span className="pn-hint">add a Grocery list to send it there</span>}
            </div>
          </Fold>
        </div>
      )}

      {done.length > 0 && expanded && (
        <div className="pn-done">
          <div className="pn-shelfname">done pile ({done.length})</div>
          <ul>
            {done.slice(0, 30).map((i) => (
              <li key={i.id}>
                <span>{i.how === "tossed" ? "🗑" : "✓"} {i.name}</span>
                <button className="mini-btn ghost" onClick={() => patch(i.id, { doneAt: null, how: null })}>put back</button>
                <button className="x-btn" onClick={() => set((all) => all.filter((x) => x.id !== i.id))} aria-label={`Forget ${i.name}`}>✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Credit>Open Food Facts</Credit>
    </div>
  );
}
