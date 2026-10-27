import { useState, useRef, useLayoutEffect, useMemo, Fragment } from "react";
import { useData } from "../../contexts/DataContext";
import { useImage } from "../../hooks/useEntries";
import { useBoardContext } from "../board/BoardContext";
import { saveAsFile } from "../../lib/localMedia";
import { parseLines, inline, plainOf, carryOn, titleOf, isTextFile } from "../../lib/markdown";
import AutoTA from "../AutoTA";
import { Seg } from "./kit";

// A markdown page where you see it as it'll look while you write: every line shows formatted,
// and the line you're on shows its raw markdown, the same size, right where it was. Enter
// carries a list on, Backspace at the start joins lines, ↑ ↓ walk between them. Opened big,
// "source" shows the whole thing raw, and a .md file can come in (drop or open) or go out.

const LIST = ["ul", "ol", "task", "quote"];

function MdImg({ src, alt }) {
  const { uid } = useData();
  const own = src.startsWith("image:") ? src.slice(6) : null;
  const stored = useImage(uid, own);
  const url = own ? stored : /^https?:\/\//.test(src) ? src : null;
  return url ? <img className="md-img" src={url} alt={alt} draggable={false} /> : <span className="md-img-gone">{alt || "picture"}</span>;
}

// Inline tokens (lib/markdown) → elements
function Runs({ tokens }) {
  return tokens.map((k, i) => {
    if (k.t === "text") return <Fragment key={i}>{k.v}</Fragment>;
    if (k.t === "code") return <code key={i}>{k.v}</code>;
    if (k.t === "img") return <MdImg key={i} src={k.href} alt={k.v} />;
    const inner = <Runs tokens={k.v} />;
    if (k.t === "b") return <strong key={i}>{inner}</strong>;
    if (k.t === "i") return <em key={i}>{inner}</em>;
    if (k.t === "s") return <s key={i}>{inner}</s>;
    return (
      <a key={i} href={k.href} target="_blank" rel="noreferrer" onMouseDown={(e) => e.stopPropagation()}>
        {inner}
      </a>
    );
  });
}

// One line as it'll look
function Shown({ line, raw, onTick, placeholder }) {
  const runs = line.body != null ? <Runs tokens={inline(line.body)} /> : null;
  switch (line.kind) {
    case "h": return runs;
    case "ul": return <><span className="md-mark" aria-hidden="true">•</span><span>{runs}</span></>;
    case "ol": return <><span className="md-mark md-n">{line.n}.</span><span>{runs}</span></>;
    case "task":
      return (
        <>
          <input
            type="checkbox"
            className="md-tick"
            checked={line.done}
            onMouseDown={(e) => (e.preventDefault(), e.stopPropagation())}
            onChange={onTick}
            aria-label={line.body || "item"}
          />
          <span className={line.done ? "md-done" : ""}>{runs}</span>
        </>
      );
    case "quote": return runs;
    case "hr": return <hr />;
    case "fence": return <span className="md-lang">{line.lang}</span>;
    case "code": return raw || "​";
    case "img": return <MdImg src={line.src} alt={line.alt} />;
    case "blank": return placeholder ? <span className="md-ph">{placeholder}</span> : "​";
    default: return runs;
  }
}

// Where in the raw line a click on its shown text lands, near enough: the same share of the way through
function caretFor(e, el, line, raw) {
  const at = document.caretRangeFromPoint?.(e.clientX, e.clientY);
  if (!at || !el.contains(at.startContainer)) return raw.length;
  const r = document.createRange();
  r.setStart(el, 0);
  r.setEnd(at.startContainer, at.startOffset);
  const off = r.toString().replace(/​/g, "").length;
  if (line.body == null) return Math.min(off, raw.length);
  const pre = line.pre?.length ?? 0;
  const shown = plainOf(inline(line.body)).length || 1;
  // the bullet / number drawn in front is one more character shown than the body has
  const into = LIST.includes(line.kind) && line.kind !== "quote" ? Math.max(0, off - (line.kind === "ol" ? `${line.n}.`.length : 1)) : off;
  return pre + Math.min(line.body.length, Math.round((into * line.body.length) / shown));
}

export default function Markdown({ mod, setState, onPatch, expanded }) {
  const { toast } = useData();
  const { readOnly } = useBoardContext() ?? {};
  const text = mod.state.text ?? "";
  const lines = text.split("\n");
  const parsed = useMemo(() => parseLines(text), [text]);
  const [mode, setMode] = useState("live");
  const [active, setActive] = useState(null); // { i, at, k }: the line being written and where the caret goes
  const [dropping, setDropping] = useState(false);
  const ta = useRef(null);
  const file = useRef(null);
  const n = useRef(0);

  const go = (i, at) => setActive({ i: Math.max(0, Math.min(i, lines.length)), at, k: ++n.current });
  const write = (ls, caret) => {
    setState((s) => ({ ...s, text: ls.join("\n") }), { debounce: 600 });
    if (caret) go(caret.i, caret.at);
  };

  // A fresh line in the editor gets the focus and the caret where it was asked for
  useLayoutEffect(() => {
    const el = ta.current;
    if (!active || !el) return;
    el.focus();
    const at = Math.min(active.at ?? el.value.length, el.value.length);
    el.setSelectionRange(at, at);
  }, [active?.k]); // eslint-disable-line react-hooks/exhaustive-deps

  const fit = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(() => fit(ta.current));

  const i = active && Math.min(active.i, lines.length - 1);

  // Typing (or pasting lines) into the open line
  const typed = (value) => {
    const ls = lines.slice();
    const parts = value.split(/\r?\n/);
    ls.splice(i, 1, ...parts);
    if (parts.length > 1) return write(ls, { i: i + parts.length - 1, at: parts.at(-1).length });
    write(ls);
  };

  const keys = (e) => {
    const el = e.currentTarget;
    const pos = el.selectionStart;
    const end = el.selectionEnd;
    const cur = lines[i];
    const line = parsed[i];
    const ls = lines.slice();
    const collapsed = pos === end;

    if (e.key === "Escape") {
      e.stopPropagation(); // not the big sheet behind us
      setActive(null);
      el.blur();
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const carry = line.kind === "code" ? (/^\s*/.exec(cur)[0]) : carryOn(line);
      // Enter on an empty list item ends the list
      if (carry != null && line.body != null && !line.body.trim() && pos >= cur.length) {
        ls[i] = "";
        return write(ls, { i, at: 0 });
      }
      const head = carry != null && pos >= (line.pre?.length ?? 0) ? carry : "";
      ls.splice(i, 1, cur.slice(0, pos), head + cur.slice(end));
      write(ls, { i: i + 1, at: head.length });
    } else if (e.key === "Backspace" && collapsed && LIST.includes(line.kind) && line.pre && pos === line.pre.length && !line.indent) {
      // Backspace right after a bullet takes the bullet off
      e.preventDefault();
      ls[i] = cur.slice(pos);
      write(ls, { i, at: 0 });
    } else if (e.key === "Backspace" && collapsed && pos === 0 && i > 0) {
      e.preventDefault();
      const prev = ls[i - 1];
      ls.splice(i - 1, 2, prev + cur);
      write(ls, { i: i - 1, at: prev.length });
    } else if (e.key === "Delete" && collapsed && pos === cur.length && i < lines.length - 1) {
      e.preventDefault();
      ls.splice(i, 2, cur + ls[i + 1]);
      write(ls, { i, at: cur.length });
    } else if (e.key === "Tab" && LIST.includes(line.kind)) {
      e.preventDefault();
      if (e.shiftKey) {
        const cut = Math.min(2, /^ */.exec(cur)[0].length);
        ls[i] = cur.slice(cut);
        write(ls, { i, at: Math.max(0, pos - cut) });
      } else {
        ls[i] = `  ${cur}`;
        write(ls, { i, at: pos + 2 });
      }
    } else if (e.key === "ArrowLeft" && collapsed && pos === 0 && i > 0 && !e.shiftKey) {
      e.preventDefault();
      go(i - 1, lines[i - 1].length);
    } else if (e.key === "ArrowRight" && collapsed && pos === cur.length && i < lines.length - 1 && !e.shiftKey) {
      e.preventDefault();
      go(i + 1, 0);
    } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.shiftKey) {
      // Let the box move the caret first; if it hit the top (or bottom) row, step to the next line
      const up = e.key === "ArrowUp";
      requestAnimationFrame(() => {
        const now = el.selectionStart;
        if (up && now === 0 && i > 0) go(i - 1, Math.min(pos, lines[i - 1].length));
        if (!up && now === el.value.length && i < lines.length - 1) go(i + 1, Math.min(pos, lines[i + 1].length));
      });
    }
  };

  const tick = (k) => {
    const ls = lines.slice();
    ls[k] = ls[k].replace(/\[([ xX])\]/, (_, c) => (c === " " ? "[x]" : "[ ]"));
    setState((s) => ({ ...s, text: ls.join("\n") }));
  };

  // A .md or .txt file: it fills an empty page, or goes on the end of one with words on it
  const take = async (f) => {
    if (!f || !isTextFile(f)) return toast({ text: "that isn't a markdown or text file" });
    const got = (await f.text()).replace(/\r\n/g, "\n");
    setState((s) => ({ ...s, text: s.text?.trim() ? `${s.text.replace(/\n+$/, "")}\n\n${got}` : got }));
    if (!mod.named) onPatch?.({ title: f.name.replace(/\.\w+$/, "") });
    if (text.trim()) toast({ text: `added “${f.name}” at the end` });
  };
  const save = () => {
    const name = `${(mod.title || titleOf(text) || "page").replace(/[\\/:*?"<>|]+/g, " ").trim()}.md`;
    saveAsFile(new Blob([text], { type: "text/markdown" }), name);
  };

  const drop = readOnly
    ? {}
    : {
        onDragOver: (e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          e.stopPropagation();
          setDropping(true);
        },
        onDragLeave: (e) => !e.currentTarget.contains(e.relatedTarget) && setDropping(false),
        onDrop: (e) => {
          setDropping(false);
          if (!e.dataTransfer.files?.length) return;
          e.preventDefault();
          e.stopPropagation();
          take(e.dataTransfer.files[0]);
        },
      };

  const empty = !text.trim();

  return (
    <div className={`md${expanded ? " big" : ""}${dropping ? " dropping" : ""}`} {...drop}>
      {expanded && (
        <div className="md-top">
          <Seg small label="View" value={mode} onChange={(m) => (setMode(m), setActive(null))} options={[{ id: "live", label: "live" }, { id: "source", label: "source" }]} />
          <span className="md-gap" />
          {!readOnly && <button className="mini-btn ghost" onClick={() => file.current.click()}>open .md</button>}
          <button className="mini-btn ghost" onClick={save} disabled={empty}>save .md</button>
        </div>
      )}

      {mode === "source" ? (
        <AutoTA className="md-source" value={text} liveId="md-source" onChange={(v) => setState((s) => ({ ...s, text: v }), { debounce: 600 })} placeholder="# write markdown here" />
      ) : (
        <div
          className="md-page"
          // A click under the last line carries on writing there
          onMouseDown={(e) => {
            if (readOnly || e.target !== e.currentTarget) return;
            e.preventDefault();
            const last = lines.length - 1;
            if (lines[last].trim() && !empty) write([...lines, ""], { i: last + 1, at: 0 });
            else go(last, lines[last].length);
          }}
        >
          {parsed.map((line, k) => {
            const raw = lines[k];
            const cls = `md-l md-${line.kind}${line.level ? ` md-h${line.level}` : ""}`;
            const style = line.indent ? { "--ind": `${line.indent * 0.6}em` } : undefined;
            if (k === i && !readOnly) {
              return (
                <textarea
                  key={`edit-${k}`}
                  ref={ta}
                  className={`${cls} md-edit`}
                  style={style}
                  value={raw}
                  rows={1}
                  spellCheck={line.kind !== "code"}
                  onChange={(e) => (typed(e.target.value), fit(e.target))}
                  onKeyDown={keys}
                  // Leaving the page altogether puts every line back to how it looks
                  onBlur={() => setTimeout(() => document.activeElement !== ta.current && setActive((a) => (a?.k === active.k ? null : a)))}
                  aria-label={`Line ${k + 1}`}
                />
              );
            }
            return (
              <div
                key={k}
                className={cls}
                style={style}
                onMouseDown={(e) => {
                  if (readOnly || e.button) return;
                  e.preventDefault();
                  go(k, caretFor(e, e.currentTarget, line, raw));
                }}
              >
                <Shown line={line} raw={raw} onTick={() => !readOnly && tick(k)} placeholder={empty && k === 0 ? "# a title, - a list, **bold**… or drop a .md file here" : null} />
              </div>
            );
          })}
        </div>
      )}

      {!expanded && empty && !active && !readOnly && (
        <button className="mini-btn ghost md-open" onClick={() => file.current.click()}>open a .md file</button>
      )}
      <input
        ref={file}
        type="file"
        accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain"
        hidden
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
