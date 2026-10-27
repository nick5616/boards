import { useMemo } from "react";
import { MODULES, MODULE_KINDS } from "../../constants/modules";
import { hslStr } from "../../utils/color";
import { requestOpen } from "../../lib/goto";
import { isShut } from "../board/spaces";
import { TrayArt } from "../board/ModuleTray";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { Seg } from "../modules/kit";

// Every module on every board in one list, to look something up and go to it. The search
// box above matches a module's name, its kind, its board, and the words written inside it.

// Words someone wrote in a module's state, for finding it by what's in it. Skips ids,
// pictures and anything long and machine-made.
const SKIP = new Set(["id", "imageId", "px", "frames", "chat", "peaks", "textId", "url", "src", "by", "color"]);
export function wordsIn(state, out = [], depth = 0) {
  if (!state || depth > 4 || out.length > 60) return out;
  if (typeof state === "string") {
    if (state.length > 1 && state.length < 2000 && !/^[A-Za-z0-9+/=_-]{24,}$/.test(state)) out.push(state);
  } else if (Array.isArray(state)) state.slice(0, 80).forEach((v) => wordsIn(v, out, depth + 1));
  else if (typeof state === "object") for (const [k, v] of Object.entries(state)) if (!SKIP.has(k)) wordsIn(v, out, depth + 1);
  return out;
}

// A few words either side of where the search turned up inside a module
function snippet(text, q) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return null;
  const from = Math.max(0, i - 24);
  return `${from ? "…" : ""}${text.slice(from, i + q.length + 40).replace(/\s+/g, " ").trim()}…`;
}

export default function AllModules({ boards, search, onOpenBoard }) {
  const [by, setBy] = useLocalStorage("myboards-modules-by", "kind");
  const q = search.trim().toLowerCase();

  const rows = useMemo(() => {
    const out = [];
    for (const b of boards) {
      for (const m of b.modules) {
        if (!MODULES[m.type] || isShut(b.modules.find((p) => p.id === m.parent))) continue;
        const label = MODULES[m.type].label;
        const name = m.title || label;
        let match = null;
        if (q) {
          const head = `${name} ${label} ${b.title}`.toLowerCase();
          if (!head.includes(q)) {
            const hit = wordsIn(m.state).find((t) => t.toLowerCase().includes(q));
            if (!hit) continue;
            match = snippet(hit, q);
          }
        }
        out.push({ m, b, name, label, match, kind: MODULES[m.type].kind });
      }
    }
    return out;
  }, [boards, q]);

  const groups = useMemo(() => {
    const map = new Map();
    const keyOf = (r) => (by === "board" ? r.b.id : r.kind);
    for (const r of rows) {
      const k = keyOf(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    }
    const label = (k) =>
      by === "board" ? boards.find((b) => b.id === k)?.title : MODULE_KINDS.find((x) => x.id === k)?.label ?? "Other";
    const order = by === "board" ? boards.map((b) => b.id) : MODULE_KINDS.map((x) => x.id);
    return [...map.entries()]
      .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
      .map(([k, list]) => ({
        k,
        label: label(k),
        list: list.sort((x, y) => x.label.localeCompare(y.label) || x.name.localeCompare(y.name)),
      }));
  }, [rows, by, boards]);

  const go = (r) => {
    requestOpen(r.b.id, r.m.id);
    onOpenBoard(r.b.id);
  };

  return (
    <main className="allmods">
      <div className="allmods-top">
        <span className="allmods-count">
          {rows.length} module{rows.length === 1 ? "" : "s"}{q ? ` with “${search.trim()}”` : ""}
        </span>
        <Seg small label="Group by" value={by} onChange={setBy} options={[{ id: "kind", label: "by kind" }, { id: "board", label: "by board" }]} />
      </div>
      {!rows.length && <div className="empty">{q ? "no module has that in it" : "no modules on your boards yet"}</div>}
      {groups.map((g) => (
        <section key={g.k} className="allmods-group">
          <div className="section-label">{g.label}</div>
          <ul className="allmods-list">
            {g.list.map((r) => (
              <li key={`${r.b.id}/${r.m.id}`}>
                <button className="allmods-row" onClick={() => go(r)}>
                  <span className={`allmods-art tray-art tray-art-${r.m.type}`} aria-hidden="true">
                    <TrayArt type={r.m.type} />
                  </span>
                  <span className="allmods-mid">
                    <b>{r.name}</b>
                    <span>{r.match ?? (r.name === r.label ? MODULES[r.m.type].blurb : r.label)}</span>
                  </span>
                  {by !== "board" && (
                    <span className="allmods-board" style={r.b.color ? { "--bc": hslStr(r.b.color.h, r.b.color.s, r.b.color.l) } : undefined}>
                      {r.b.title}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
