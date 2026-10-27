import { useState, useEffect, useCallback } from "react";
import { useData } from "../../contexts/DataContext";
import { useBoardContext } from "../board/BoardContext";
import { useApiKey, KEYS } from "../../lib/apis";
import { MODULES } from "../../constants/modules";
import { SECTIONS, loadSection, dateline, markRead, pruneRead } from "../../lib/paper";
import { Fold, Credit } from "./kit";

const domainOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
};

// A newspaper front page. Each headline links out, fades once you've opened it, and can be saved
// to a Next up (or Links) on the board. The small card is one column; opened big has columns.
export default function Paper({ board, mod, setState, expanded }) {
  const { updateBoard, toast } = useData();
  const ctx = useBoardContext();
  const gkey = useApiKey("guardian");
  const { sections = { hn: true, space: true }, read = {}, saved = {} } = mod.state;
  const [got, setGot] = useState({}); // id → { stories, error, loading, at }
  const [nonce, setNonce] = useState(0);
  const on = SECTIONS.filter((s) => sections[s.id]);
  const onKey = on.map((s) => s.id).join();

  useEffect(() => {
    let live = true;
    for (const s of on) {
      if (s.key && !gkey) continue;
      setGot((g) => ({ ...g, [s.id]: { ...g[s.id], loading: true } }));
      loadSection(s.id, { force: nonce > 0, guardianKey: gkey })
        .then((stories) => live && setGot((g) => ({ ...g, [s.id]: { stories, loading: false, at: Date.now() } })))
        .catch(() => live && setGot((g) => ({ ...g, [s.id]: { ...g[s.id], loading: false, error: true } })));
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onKey, nonce, gkey]);

  // The top unread headline is kept on the module so the home Glance can show it
  const top = on.flatMap((s) => got[s.id]?.stories ?? []).find((s) => !read[s.key]);
  useEffect(() => {
    if (top && top.title !== mod.state.top) setState((s) => ({ ...s, top: top.title }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top?.title]);

  const toggle = (id) => setState((s) => ({ ...s, sections: { hn: true, space: true, ...s.sections, [id]: !(s.sections?.[id] ?? (id !== "guardian")) } }));
  const open = (st) => setState((s) => ({ ...s, read: pruneRead(markRead(s.read ?? {}, st.key)) }));

  // Next up first, then Links; with neither on the board, a new Next up appears beside the paper
  const save = useCallback((st) => {
    const link = { url: st.url, title: st.title, domain: domainOf(st.url) };
    const target = board.modules.find((m) => m.type === "nextup") ?? board.modules.find((m) => m.type === "links");
    if (target) {
      updateBoard(board.id, (b) => ({
        ...b,
        modules: b.modules.map((m) => (m.id === target.id ? { ...m, state: MODULES[m.type].takeIn(m.state, { kind: "link", site: "page", links: [link] }) } : m)),
      }));
      toast({ text: `saved for later → ${target.title ?? MODULES[target.type].label}` });
    } else if (ctx?.createModule) {
      const state = MODULES.nextup.takeIn(MODULES.nextup.init(), { kind: "link", site: "page", links: [link] });
      ctx.createModule("nextup", { near: mod.id, state, title: "Read later" });
      toast({ text: "saved for later → new Next up" });
    } else return;
    setState((s) => ({ ...s, saved: { ...s.saved, [st.key]: true } }));
  }, [board, ctx, mod.id, setState, toast, updateBoard]);

  const per = expanded ? 10 : on.length > 1 ? 2 : 4;
  const loading = on.some((s) => got[s.id]?.loading);
  const failed = on.some((s) => got[s.id]?.error);
  const at = Math.max(0, ...on.map((s) => got[s.id]?.at ?? 0)) || null;

  return (
    <div className={`pap${expanded ? " big" : ""}`}>
      <div className="pap-mast">
        <span className="pap-name">The Morning Paper</span>
        <span className="pap-date">{dateline()}</span>
      </div>

      <div className="pap-page">
        {on.length === 0 && <p className="pap-note">no sections today. open “sections” below.</p>}
        {on.map((s) => {
          const g = got[s.id];
          const needKey = s.key && !gkey;
          return (
            <section key={s.id} className="pap-col">
              <h3>{s.head}</h3>
              {needKey && (
                <p className="pap-note">
                  needs a free Guardian key: <a href={KEYS.guardian.get} target="_blank" rel="noreferrer">get one</a>, paste it in Settings → API keys
                </p>
              )}
              {!needKey && !g?.stories && g?.error && <p className="pap-note">the presses are down.</p>}
              {!needKey && !g?.stories && !g?.error && <p className="pap-note">setting type…</p>}
              {(g?.stories ?? []).slice(0, per).map((st, i) => (
                <article key={st.key} className={`pap-story${read[st.key] ? " done" : ""}${i === 0 && expanded ? " lead" : ""}`}>
                  <a href={st.url} target="_blank" rel="noreferrer" onClick={() => open(st)} title={st.title}>{st.title}</a>
                  {st.blurb && expanded && i === 0 && <p>{st.blurb.length > 160 ? `${st.blurb.slice(0, 157)}…` : st.blurb}</p>}
                  <div className="pap-meta">
                    <span>{st.meta}</span>
                    <button className="x-btn pap-save" disabled={!!saved[st.key]} onClick={() => save(st)} aria-label={`Save “${st.title}” for later`} title="Save for later">
                      {saved[st.key] ? "✓" : "＋"}
                    </button>
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>

      <Fold label="sections">
        <div className="pap-secs" role="group" aria-label="Sections">
          {SECTIONS.map((s) => (
            <button key={s.id} className={`mini-btn${sections[s.id] ? " on" : " ghost"}`} aria-pressed={!!sections[s.id]} onClick={() => toggle(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
      </Fold>
      <Credit at={at} loading={loading && !at} error={failed && !at} reload={() => setNonce((n) => n + 1)}>headlines</Credit>
    </div>
  );
}

// What the home Glance says: the top unread headline, remembered from the last time it was printed
export const paperSays = (mods) => mods.find((m) => m.state.top)?.state.top ?? null;
