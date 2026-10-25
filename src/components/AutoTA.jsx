import { useRef, useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useData } from "../contexts/DataContext";
import { candidates, toToken, mentionsIn } from "../lib/mentions";
import RichText from "./RichText";

// "@" then a few letters (spaces allowed, titles have them), right before the caret
const TRIGGER = /(?:^|\s)@([^\n@[\]]{0,24})$/;

// Where the caret sits on screen: a hidden copy of the text up to it, measured
function caretPoint(ta, pos) {
  const cs = getComputedStyle(ta);
  const r = ta.getBoundingClientRect();
  const mirror = document.createElement("div");
  for (const p of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "padding", "boxSizing"]) {
    mirror.style[p] = cs[p];
  }
  mirror.style.position = "fixed";
  mirror.style.visibility = "hidden";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.width = `${r.width}px`;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.textContent = ta.value.slice(0, pos);
  const mark = document.createElement("span");
  mark.textContent = "​";
  mirror.appendChild(mark);
  document.body.appendChild(mirror);
  const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
  const out = { x: r.left + mark.offsetLeft, y: r.top + mark.offsetTop + line - ta.scrollTop };
  mirror.remove();
  return out;
}

// The one self-sizing text box. rich = it can @-mention boards and modules,
// and shows them as tags while you're not typing in it.
export default function AutoTA({ value, onChange, placeholder, className, rich }) {
  const ref = useRef(null);
  const { boards } = useData() ?? {};
  const [editing, setEditing] = useState(false);
  const [pop, setPop] = useState(null); // { from, at, x, y, list, sel }
  const all = useMemo(() => (rich ? candidates(boards) : []), [rich, boards]);

  const fit = () => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = ref.current.scrollHeight + "px";
  };
  useEffect(fit, [value, editing]);

  // Handing over from the tags to the textarea puts the cursor at the end
  useEffect(() => {
    if (editing && ref.current && document.activeElement !== ref.current) {
      ref.current.focus();
      const n = ref.current.value.length;
      ref.current.setSelectionRange(n, n);
    }
  }, [editing]);

  const look = (ta) => {
    if (!rich) return;
    const pos = ta.selectionStart;
    const m = TRIGGER.exec(ta.value.slice(0, pos));
    if (!m) return setPop(null);
    const q = m[1].toLowerCase().trim().split(/\s+/).filter(Boolean);
    const list = all
      .filter((c) => q.every((w) => `${c.title} ${c.where}`.toLowerCase().includes(w)))
      .slice(0, 8);
    if (!list.length) return setPop(null);
    const from = pos - m[1].length - 1;
    const pt = caretPoint(ta, pos);
    setPop((p) => ({ from, at: pos, list, sel: p && p.from === from ? Math.min(p.sel, list.length - 1) : 0, ...pt }));
  };

  const pick = (c) => {
    const ta = ref.current;
    const token = toToken(c) + " ";
    onChange(value.slice(0, pop.from) + token + value.slice(pop.at));
    setPop(null);
    const end = pop.from + token.length;
    requestAnimationFrame(() => ta.setSelectionRange(end, end));
  };

  const onKeyDown = (e) => {
    if (!pop) return;
    // stopPropagation keeps Escape from also closing the big sheet behind us
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      stop();
      const d = e.key === "ArrowDown" ? 1 : -1;
      setPop({ ...pop, sel: (pop.sel + d + pop.list.length) % pop.list.length });
    } else if (e.key === "Enter" || e.key === "Tab") {
      stop();
      pick(pop.list[pop.sel]);
    } else if (e.key === "Escape") {
      stop();
      setPop(null);
    }
  };

  if (rich && !editing && mentionsIn(value).length) {
    return <RichText value={value} className={className} placeholder={placeholder} onEdit={() => setEditing(true)} />;
  }

  return (
    <>
      <textarea
        ref={ref}
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); fit(); look(e.target); }}
        onKeyDown={onKeyDown}
        onClick={(e) => look(e.target)}
        onFocus={() => setEditing(true)}
        onBlur={() => { setPop(null); setEditing(false); }}
        rows={1}
      />
      {pop &&
        createPortal(
          <div className="mn-pop" style={{ left: Math.max(8, Math.min(pop.x, window.innerWidth - 268)), top: pop.y + 4 }} role="listbox">
            {pop.list.map((c, i) => (
              <button
                key={`${c.boardId}/${c.modId ?? ""}`}
                role="option"
                aria-selected={i === pop.sel}
                className={i === pop.sel ? "sel" : ""}
                // mousedown would blur the textarea and close us before the click lands
                onMouseDown={(e) => { e.preventDefault(); pick(c); }}
              >
                <b>{c.kind === "board" ? "▤" : "◧"} {c.title}</b>
                <span>{c.kind === "board" ? "board" : `${c.where} · ${c.tray}`}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
