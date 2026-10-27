import { useRef, useState, useEffect } from "react";
import { useData } from "../../contexts/DataContext";
import { useImage } from "../../hooks/useEntries";
import { deleteImage } from "../../lib/data";
import { savePhotos, useImageIntake } from "../../lib/studio";
import { uid as newId } from "../../utils/uid";
import { dayKey, addDays, keyToDate } from "../../utils/date";

const FLIP_MS = 520;
const stamp = (day) => keyToDate(day).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase();

// Days in a row with a page, counting back from today (a missing today doesn't break
// it until the day is over, so the streak you had this morning is still there)
export function streakOf(pages, today = new Date()) {
  const days = new Set(pages.map((p) => p.day));
  let d = days.has(dayKey(today)) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// One sheet of the pad: the photo of your drawing, stamped with the day
function Leaf({ page, onNote, flipClass }) {
  const { uid } = useData();
  const src = useImage(uid, page?.imageId);
  return (
    <div className={`skb-leaf ${flipClass ?? ""}`}>
      <div className="skb-photo">
        {src ? <img src={src} alt={page.note || "a sketchbook page"} draggable={false} /> : null}
        {page && <span className="skb-stamp">{stamp(page.day)}</span>}
      </div>
      {onNote && (
        <input
          className="skb-note"
          placeholder="what's on this page?"
          defaultValue={page.note ?? ""}
          key={page.id}
          onChange={(e) => onNote(e.target.value)}
        />
      )}
    </div>
  );
}

function Thumb({ page, on, onGo }) {
  const { uid } = useData();
  const src = useImage(uid, page.imageId);
  return (
    <button className={`skb-thumb${on ? " on" : ""}`} onClick={onGo} title={stamp(page.day)}>
      {src ? <img src={src} alt="" draggable={false} /> : null}
    </button>
  );
}

// A spiral-bound sketchbook of photographed pages. Draw on paper, photograph it, add the
// page; each new page is a day of practice, and the streak counts the days in a row.
export default function Sketchbook({ board, mod, setState, expanded }) {
  const { uid, logPractice, undoLog, toast } = useData();
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const pages = mod.state.pages ?? [];
  const [cur, setCur] = useState(Math.max(0, pages.length - 1));
  const [flip, setFlip] = useState(null); // { from, to } while a page is turning
  const shown = Math.min(cur, Math.max(0, pages.length - 1));

  const add = async (files) => {
    const ids = await savePhotos(uid, board.id, files, toast);
    if (!ids.length) return;
    const made = ids.map((imageId) => ({ id: newId(), imageId, at: Date.now(), day: dayKey(), note: "" }));
    setState((s) => ({ ...s, pages: [...(s.pages ?? []), ...made] }));
    goto(pages.length + made.length - 1, pages.length);
    const entries = made.map(() => logPractice(board.id, "📓 a sketchbook page"));
    toast({
      text: `page ${pages.length + made.length} is in the book ✓`,
      actions: [
        {
          label: "undo",
          run: () => {
            entries.forEach(undoLog);
            ids.forEach((id) => deleteImage(uid, id));
            setState((s) => ({ ...s, pages: (s.pages ?? []).filter((p) => !ids.includes(p.imageId)) }));
            setCur(Math.max(0, pages.length - 1));
          },
        },
      ],
    });
  };
  const { rootRef, drop, dropping } = useImageIntake(add);

  // Turn to a page; going forward the old sheet lifts away over the spiral, going back
  // the sheet you want drops down onto the pad
  const goto = (to, from = shown) => {
    if (to === from) return setCur(to);
    setCur(to);
    setFlip({ from, to });
  };
  useEffect(() => {
    if (!flip) return;
    const t = setTimeout(() => setFlip(null), FLIP_MS);
    return () => clearTimeout(t);
  }, [flip]);

  const toss = () => {
    const p = pages[shown];
    if (!p || !confirm("Tear this page out?")) return;
    deleteImage(uid, p.imageId);
    setState((s) => ({ ...s, pages: (s.pages ?? []).filter((x) => x.id !== p.id) }));
    setCur(Math.max(0, shown - 1));
  };

  const note = (text) =>
    setState((s) => ({ ...s, pages: (s.pages ?? []).map((p) => (p.id === pages[shown]?.id ? { ...p, note: text } : p)) }), { debounce: 600 });

  const streak = streakOf(pages);
  const week = Array.from({ length: 7 }, (_, i) => dayKey(addDays(new Date(), i - 6)));
  const haveDay = new Set(pages.map((p) => p.day));
  const fwd = flip && flip.to > flip.from;
  // what sits under the turning sheet, and the sheet itself
  const base = flip ? (fwd ? pages[flip.to] : pages[flip.from]) : pages[shown];
  const leaf = flip ? (fwd ? pages[flip.from] : pages[flip.to]) : null;
  const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

  return (
    <div ref={rootRef} className={`skb${dropping ? " dropping" : ""}${expanded ? " big" : ""}`} {...drop}>
      <div className="skb-book">
        <div className="skb-spiral" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => <i key={i} />)}
        </div>
        <div className="skb-stack">
          {pages.length ? (
            <>
              <Leaf key={`b${base?.id}`} page={base} onNote={!flip ? note : undefined} />
              {leaf && <Leaf key={`l${leaf.id}`} page={leaf} flipClass={fwd ? "away" : "back"} />}
            </>
          ) : (
            <button className="skb-empty" onClick={() => fileRef.current?.click()}>
              <span>+</span>the first page
              <small>photograph a sketch, or paste one</small>
            </button>
          )}
        </div>
      </div>

      <div className="skb-nav">
        <button className="skb-turn" disabled={shown <= 0} onClick={() => goto(shown - 1)} aria-label="Previous page">‹</button>
        <span className="skb-pg">{pages.length ? `page ${shown + 1} of ${pages.length}` : "blank"}</span>
        <button className="skb-turn" disabled={shown >= pages.length - 1} onClick={() => goto(shown + 1)} aria-label="Next page">›</button>
      </div>

      <div className="skb-streak" title="days in a row with a page">
        <span className="skb-days">
          {week.map((d) => <i key={d} className={haveDay.has(d) ? "on" : ""} />)}
        </span>
        <b>{streak}</b> day{streak === 1 ? "" : "s"} in a row
      </div>
      <div className="skb-tools">
        <button className="mini-btn" onClick={() => fileRef.current?.click()}>+ page</button>
        {coarse && <button className="mini-btn" onClick={() => camRef.current?.click()}>📷</button>}
        {pages.length > 0 && <button className="mini-btn ghost" onClick={toss}>tear out</button>}
      </div>

      {expanded && pages.length > 1 && (
        <div className="skb-thumbs">
          {pages.map((p, i) => <Thumb key={p.id} page={p} on={i === shown} onGo={() => goto(i)} />)}
        </div>
      )}
      {[fileRef, camRef].map((r, i) => (
        <input
          key={i}
          ref={r}
          type="file"
          accept="image/*"
          {...(i ? { capture: "environment" } : { multiple: true })}
          style={{ display: "none" }}
          onChange={(e) => {
            add([...e.target.files]);
            e.target.value = "";
          }}
        />
      ))}
    </div>
  );
}
