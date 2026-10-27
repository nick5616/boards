import { useState, useEffect, useMemo, useRef } from "react";
import { MODULES, MODULE_TYPES } from "../constants/modules";
import { useLive } from "../contexts/LiveContext";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { typing } from "../lib/paste";
import { capHint } from "../lib/caps";
import { keyHint } from "../lib/apis";
import { requestOpen, requestAdd, requestLink } from "../lib/goto";
import { PAIR_EVENT } from "../lib/remote";
import { isShut } from "./board/spaces";

// Ctrl+K (or "/" when you're not typing): the card-catalog drawer. Type a few
// letters of anything, pick a card, and it's done.

// Subsequence match: every letter of the query, in order. Letters that start a
// word or follow each other count extra. -1 = no match.
export function score(query, text) {
  const q = query.toLowerCase().replace(/\s+/g, "");
  const t = text.toLowerCase();
  if (!q) return 0;
  let s = 0, at = -1, run = 0;
  for (const ch of q) {
    const i = t.indexOf(ch, at + 1);
    if (i < 0) return -1;
    run = i === at + 1 ? run + 1 : 0;
    s += 1 + run * 2 + (i === 0 || /[\s\-_/]/.test(t[i - 1]) ? 4 : 0) - Math.min(i - at - 1, 5) * 0.2;
    at = i;
  }
  return s - t.length * 0.02; // shorter names win ties
}

const GROUPS = [
  { id: "boards", label: "Boards" },
  { id: "modules", label: "On your boards" },
  { id: "add", label: "Slap something on" },
  { id: "actions", label: "Actions" },
];

export default function CommandPalette({ boards, openId, onOpenBoard, onNewBoard, onHome, onSettings }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [recent, setRecent] = useLocalStorage("myboards-palette-recent", []);
  const live = useLive();
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !typing()) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      inputRef.current?.focus();
    }
  }, [open]);

  const board = boards?.find((b) => b.id === openId);

  // Everything you could pick right now; each card has a stable key for "recent"
  const cards = useMemo(() => {
    if (!open) return [];
    const out = [];
    for (const b of boards ?? []) {
      out.push({ key: `b:${b.id}`, group: "boards", text: b.title, hint: b.status === "active" ? "" : b.status, run: () => onOpenBoard(b.id) });
      for (const m of b.modules) {
        // what is inside a sealed time capsule stays out of search too
        if (isShut(b.modules.find((p) => p.id === m.parent))) continue;
        out.push({
          key: `m:${m.id}`,
          group: "modules",
          text: m.title || MODULES[m.type]?.label || m.type,
          hint: `${MODULES[m.type]?.label ?? m.type} · ${b.title}`,
          also: b.title,
          run: () => {
            requestOpen(b.id, m.id);
            onOpenBoard(b.id);
          },
        });
      }
    }
    if (board) {
      for (const t of MODULE_TYPES) {
        const cant = capHint(MODULES[t].needs) ?? keyHint(MODULES[t].keys);
        out.push({
          key: `a:${t}`, group: "add", text: `Add ${MODULES[t].label}`, hint: cant ?? MODULES[t].blurb,
          also: t, disabled: !!cant, run: () => requestAdd(t),
        });
      }
    }
    out.push({ key: "x:new", group: "actions", text: "New board", run: onNewBoard });
    out.push({ key: "x:home", group: "actions", text: "Go home", run: onHome });
    out.push({ key: "x:settings", group: "actions", text: "Settings", run: onSettings });
    out.push({ key: "x:pair", group: "actions", text: "📱 Pair a phone", hint: "camera, clicker, second screen", also: "remote", run: () => window.dispatchEvent(new Event(PAIR_EVENT)) });
    if (board) out.push({ key: "x:link", group: "actions", text: "Copy board as link", hint: board.title, run: requestLink });
    for (const s of live?.sessions ?? []) {
      out.push({ key: `x:stop:${s.id}`, group: "actions", text: `Stop ${s.label}`, hint: "running now", run: () => live.stop(s.id) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, boards, board, live?.sessions]);

  // Matches, best first: recent picks get a boost; with nothing typed, just a few of each
  const shown = useMemo(() => {
    const rank = (c) => {
      const s = q ? Math.max(score(q, c.text), c.also ? score(q, c.also) - 3 : -1, c.hint ? score(q, c.hint) - 6 : -1) : 0;
      const r = recent.indexOf(c.key);
      return s < 0 ? -1 : s + (r < 0 ? 0 : 20 - r);
    };
    const out = [];
    for (const g of GROUPS) {
      const items = cards
        .filter((c) => c.group === g.id)
        .map((c) => ({ c, s: rank(c) }))
        .filter((x) => x.s >= 0 && (q || g.id !== "modules" || recent.includes(x.c.key)))
        .sort((a, b) => b.s - a.s)
        .slice(0, q ? 8 : g.id === "add" ? 0 : 6);
      out.push(...items.map((x) => ({ ...x.c, label: g.label })));
    }
    return out;
  }, [cards, q, recent]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(".cmdk-item.sel")?.scrollIntoView({ block: "nearest" });
  }, [sel, shown]);

  if (!open) return null;

  const pick = (c) => {
    if (!c || c.disabled) return;
    setRecent([c.key, ...recent.filter((k) => k !== c.key)].slice(0, 8));
    setOpen(false);
    c.run();
  };

  const onKeyDown = (e) => {
    const n = shown.length;
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => (n ? (i + 1) % n : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => (n ? (i - 1 + n) % n : 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(shown[sel]); }
    else if (e.key === "Tab" && n) {
      // Jump to the first card of the next (or, with Shift, previous) drawer
      e.preventDefault();
      const labels = [...new Set(shown.map((c) => c.label))];
      const now = labels.indexOf(shown[sel].label);
      const to = labels[(now + (e.shiftKey ? -1 : 1) + labels.length) % labels.length];
      setSel(shown.findIndex((c) => c.label === to));
    }
  };

  return (
    <div className="overlay cmdk-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Find anything" onKeyDown={onKeyDown}>
        <div className="cmdk-top">
          <span className="cmdk-ico" aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            className="cmdk-in"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Flip through the drawer…"
            aria-label="Search boards, modules and actions"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="cmdk-key">esc</kbd>
        </div>
        <div className="cmdk-list" ref={listRef} role="listbox">
          {shown.length === 0 && <div className="cmdk-none">no card for “{q}”</div>}
          {shown.map((c, i) => (
            <div key={c.key}>
              {(i === 0 || shown[i - 1].label !== c.label) && <div className="cmdk-group">{c.label}</div>}
              <div
                role="option"
                aria-selected={i === sel}
                aria-disabled={c.disabled || undefined}
                className={`cmdk-item${i === sel ? " sel" : ""}${c.disabled ? " cant" : ""}`}
                onMouseMove={() => i !== sel && setSel(i)}
                onClick={() => pick(c)}
              >
                <span className="cmdk-text">{c.text}</span>
                {c.hint && <span className="cmdk-hint">{c.hint}</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="cmdk-foot">↑↓ pick · ⏎ go · tab next drawer</div>
      </div>
    </div>
  );
}
