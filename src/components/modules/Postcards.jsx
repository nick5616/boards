import { useState, useEffect } from "react";
import { useData } from "../../contexts/DataContext";
import { deleteImage } from "../../lib/data";
import { savePhotos } from "../../lib/studio";
import { Seg, Empty, Fold, ChipRow, Credit } from "./kit";
import {
  MUSEUMS, MUSEUM_IDS, postcardOfTheDay, searchRack, keepOf, creditOf, lineOf, fetchPictureFile,
} from "../../lib/postcards";

// The back of a postcard: stamp, who made it, and where it hangs
function Card({ c, onTap, size = "big" }) {
  const [back, setBack] = useState(false);
  const m = MUSEUMS[c.museum];
  if (size === "small") {
    return (
      <button className="pc-mini" onClick={onTap} aria-label={`${c.title}${c.artist ? `, ${c.artist}` : ""}`}>
        <img referrerPolicy="no-referrer" src={c.img} alt="" loading="lazy" draggable={false} />
      </button>
    );
  }
  return (
    <div className={`pcd-card${back ? " back" : ""}`}>
      {!back ? (
        <button className="pc-front" onClick={() => setBack(true)} aria-label="Turn the postcard over">
          <img referrerPolicy="no-referrer" src={c.img} alt={c.title} draggable={false} />
        </button>
      ) : (
        <button className="pc-back" onClick={() => setBack(false)} aria-label="Turn the postcard over">
          <span className="pc-stamp" aria-hidden="true">{m?.short}</span>
          <b>{c.title}</b>
          <span>{lineOf(c)}</span>
          <em>{creditOf(c)}</em>
        </button>
      )}
      <div className="pc-credit">
        <b>{c.title}</b>
        <span>{lineOf(c) || "unknown artist"} · {m?.short}</span>
      </div>
    </div>
  );
}

// A spinning rack of museum postcards (Art Institute of Chicago, the Met, Cleveland).
// The card of the day is the same on every device. Search the rack, keep favourites (just
// the title, artist, date, link and picture address), and send a card to a Value check or
// Gesture timer on the board as a reference (Chicago's pictures allow copying).
// State: museums [ids shown], favs [{ key, museum, id, title, artist, date, img, url, at }]
export default function Postcards({ board, mod, setState, expanded }) {
  const { uid, updateBoard, toast } = useData();
  const { museums = MUSEUM_IDS, favs = [] } = mod.state;
  const [today, setToday] = useState(null);
  const [rack, setRack] = useState([]);
  const [shown, setShown] = useState(null); // the card on the table
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState("rack"); // rack | keep
  const [spin, setSpin] = useState(0);
  const key = museums.join(",");

  useEffect(() => {
    let live = true;
    setErr(false);
    postcardOfTheDay(museums.length ? museums : MUSEUM_IDS)
      .then((c) => live && (setToday(c), setShown((s) => s ?? c), !c && setErr(true)))
      .catch(() => live && setErr(true));
    return () => { live = false; };
    // museums only matters by its contents
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const search = async (term = q, page = 1) => {
    const t = term.trim();
    if (!t) return;
    setBusy(true);
    setErr(false);
    const out = await searchRack(t, museums.length ? museums : MUSEUM_IDS, page).catch(() => []);
    setBusy(false);
    setRack(out);
    if (!out.length) setErr(true);
    else setShown(out[0]);
  };

  const spinIt = async () => {
    // a random subject and page, so the rack gives something new each time
    const WORDS = ["garden", "boat", "woman", "mountain", "flowers", "city", "animal", "night", "sea", "snow", "tree", "dance"];
    const w = WORDS[Math.floor(Math.random() * WORDS.length)];
    setSpin((n) => n + 1);
    setQ(w);
    setTab("rack");
    await search(w, 1 + Math.floor(Math.random() * 3));
  };

  const isFav = (c) => favs.some((f) => f.key === `${c.museum}:${c.id}`);
  const toggleFav = (c) =>
    setState((s) => {
      const cur = s.favs ?? [];
      const k = `${c.museum}:${c.id}`;
      return { ...s, favs: cur.some((f) => f.key === k) ? cur.filter((f) => f.key !== k) : [keepOf(c), ...cur] };
    });

  const toggleMuseum = (id) =>
    setState((s) => {
      const cur = s.museums ?? MUSEUM_IDS;
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...s, museums: next.length ? next : cur };
    });

  // Send a card to a Value check (its one reference) or a Gesture timer (adds a reference)
  const values = board.modules.filter((m) => m.type === "values");
  const gestures = board.modules.filter((m) => m.type === "gesture");
  const send = async (c, target) => {
    try {
      const [id] = await savePhotos(uid, board.id, [await fetchPictureFile(c)], toast);
      if (!id) throw new Error("not saved");
      updateBoard(board.id, (b) => ({
        ...b,
        modules: b.modules.map((m) => {
          if (m.id !== target.id) return m;
          if (m.type === "values") {
            if (m.state.imageId) deleteImage(uid, m.state.imageId);
            return { ...m, state: { ...m.state, imageId: id } };
          }
          return { ...m, state: { ...m.state, images: [...(m.state.images ?? []), id] } };
        }),
      }));
      toast({ text: `“${c.title}” is on ${target.title} ✓` });
    } catch (e) {
      toast({ text: MUSEUMS[c.museum]?.canSave ? "couldn't copy that picture" : `${MUSEUMS[c.museum]?.short}'s pictures can't be copied here; Chicago's can` });
    }
  };

  const [pick, setPick] = useState(false); // the "send to" menu is open
  const canSend = values.length > 0 || gestures.length > 0;

  return (
    <div className="pc">
      {shown ? (
        <>
          <Card key={`${shown.museum}:${shown.id}`} c={shown} />
          <div className="pc-btns">
            <button className="mini-btn" onClick={spinIt} disabled={busy}>
              <span style={{ display: "inline-block", transform: `rotate(${spin * 180}deg)`, transition: "transform .5s" }}>🎡</span> spin the rack
            </button>
            <button className={`x-btn${isFav(shown) ? " on" : ""}`} onClick={() => toggleFav(shown)} aria-pressed={isFav(shown)} aria-label={isFav(shown) ? "Let go of this postcard" : "Keep this postcard"}>
              {isFav(shown) ? "♥" : "♡"}
            </button>
            <a className="x-btn" href={shown.url} target="_blank" rel="noreferrer" aria-label="See it at the museum">↗</a>
          </div>
          {today && shown.id === today.id && shown.museum === today.museum && <div className="pc-today">★ postcard of the day</div>}
        </>
      ) : (
        <Empty>{err ? "couldn't reach the museums just now" : "picking today's card…"}</Empty>
      )}

      {expanded && (
        <>
          <Seg small label="Postcards" value={tab} onChange={setTab} options={[{ id: "rack", label: "rack" }, { id: "keep", label: `kept (${favs.length})` }]} />
          {tab === "rack" && (
            <>
              <div className="pc-ask">
                <input className="line-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="search the museums…" aria-label="Search the museums" />
                <button className="mini-btn ghost" onClick={() => search()} disabled={busy || !q.trim()}>find</button>
              </div>
              <ChipRow label="Museums">
                {MUSEUM_IDS.map((id) => (
                  <button key={id} className={`mini-btn${museums.includes(id) ? "" : " ghost"}`} onClick={() => toggleMuseum(id)} aria-pressed={museums.includes(id)}>{MUSEUMS[id].short}</button>
                ))}
              </ChipRow>
              {rack.length > 0 && (
                <div className="pc-rack">
                  {rack.slice(0, 24).map((c) => <Card key={`${c.museum}:${c.id}`} c={c} size="small" onTap={() => setShown(c)} />)}
                </div>
              )}
              {!busy && err && rack.length === 0 && q && <div className="pc-hint">nothing on the rack for that</div>}
            </>
          )}
          {tab === "keep" && (
            favs.length === 0 ? (
              <Empty>tap ♡ on a postcard you love</Empty>
            ) : (
              <div className="pc-rack keep">
                {favs.map((f) => (
                  <div key={f.key} className="pc-kept">
                    <Card c={f} size="small" onTap={() => setShown(f)} />
                    <span>{f.title}</span>
                    <button className="x-btn" onClick={() => toggleFav(f)} aria-label={`Let go of ${f.title}`}>✕</button>
                  </div>
                ))}
              </div>
            )
          )}
          {canSend && shown && (
            <Fold label="send as a reference">
              <div className="pc-send">
                {values.map((m) => <button key={m.id} className="mini-btn ghost" onClick={() => (send(shown, m), setPick(false))}>→ {m.title}</button>)}
                {gestures.map((m) => <button key={m.id} className="mini-btn ghost" onClick={() => (send(shown, m), setPick(false))}>→ {m.title}</button>)}
                {!MUSEUMS[shown.museum].canSave && <div className="pc-hint">only Chicago&apos;s pictures can be copied</div>}
              </div>
            </Fold>
          )}
        </>
      )}
      {busy && <div className="pc-hint">turning the rack…</div>}
      <Credit>{shown ? MUSEUMS[shown.museum]?.credit : "open-access museums"}</Credit>
    </div>
  );
}
