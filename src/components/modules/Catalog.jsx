import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { dayKey, prettyDate } from "../../utils/date";
import { lookUp, byDoi, byArxiv, apa, bibtex, byline } from "../../lib/catalog";
import { Seg, Empty, Credit } from "./kit";

const TABS = [
  ["toread", "to read"],
  ["reading", "reading"],
  ["read", "read"],
];
const SHOWN = 3; // rows on the small card

// The fields a card keeps from a lookup
const keep = (p) => ({
  title: p.title,
  authors: p.authors ?? [],
  year: p.year ?? null,
  abstract: p.abstract ?? "",
  doi: p.doi ?? null,
  arxiv: p.arxiv ?? null,
  url: p.url ?? null,
  venue: p.venue ?? "",
  pdf: p.pdf ?? null,
  cites: p.cites ?? null,
});

// Index cards for papers to read. Paste a DOI, an arXiv link or a title; each paper becomes a
// card that goes to read → reading → read, with notes.
export default function Catalog({ mod, setState, expanded, openBig }) {
  const { toast } = useData();
  const cards = mod.state.cards ?? [];
  const [tab, setTab] = useState("toread");
  const [q, setQ] = useState("");
  const [found, setFound] = useState(null); // null = not searched, [] = nothing
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState(null);
  const working = useRef(new Set());

  const patch = (id, p) => setState((s) => ({ ...s, cards: (s.cards ?? []).map((c) => (c.id === id ? { ...c, ...p } : c)) }));

  // Cards that arrived as a pasted DOI or arXiv id have only the id; fill them in
  useEffect(() => {
    for (const c of cards) {
      if (!c.pending || working.current.has(c.id)) continue;
      working.current.add(c.id);
      (c.pending.doi ? byDoi(c.pending.doi) : byArxiv(c.pending.arxiv))
        .then((p) => patch(c.id, { ...keep(p), pending: null }))
        .catch(() => patch(c.id, { pending: null, title: c.title + " (couldn't look it up)" }))
        .finally(() => working.current.delete(c.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.map((c) => c.pending && c.id).join()]);

  const add = (p) => {
    const dupe = cards.find((c) => (p.doi && c.doi === p.doi) || (p.arxiv && c.arxiv === p.arxiv));
    if (dupe) {
      setTab(dupe.status);
      setOpenId(dupe.id);
      toast({ text: "that one's already in the drawer" });
    } else {
      const card = { id: uid(), ...keep(p), status: "toread", notes: "", addedAt: Date.now() };
      setState((s) => ({ ...s, cards: [card, ...(s.cards ?? [])] }));
      setTab("toread");
    }
    setQ("");
    setFound(null);
    setAdding(false);
  };

  const search = async () => {
    const text = q.trim();
    if (!text) return;
    setBusy(true);
    try {
      const hits = await lookUp(text);
      if (hits.length === 1 && /^(10\.|\d{4}\.|arxiv|https?:)/i.test(text)) add(hits[0]);
      else setFound(hits);
    } catch {
      setFound([]);
      toast({ text: "couldn't reach the library, add it by hand?" });
    }
    setBusy(false);
  };

  const byHand = () => q.trim() && add({ title: q.trim() });

  const move = (c, status) => {
    const p = { status };
    if (status === "read") p.readAt = dayKey();
    else if (c.readAt) p.readAt = null;
    patch(c.id, p);
    if (status !== c.status) setTab(status);
  };

  const remove = (c) => {
    setState((s) => ({ ...s, cards: s.cards.filter((x) => x.id !== c.id) }));
    setOpenId(null);
    toast({
      text: `took “${c.title.slice(0, 32)}” out`,
      actions: [{ label: "undo", run: () => setState((s) => ({ ...s, cards: [c, ...(s.cards ?? [])] })) }],
    });
  };

  const count = (st) => cards.filter((c) => c.status === st).length;
  const all = cards.filter((c) => c.status === tab);
  const shown = expanded ? all : all.slice(0, SHOWN);
  const askRow = expanded || adding;

  const form = (
    <>
      <div className="cat-add">
        <input
          className="line-input"
          placeholder="DOI, arXiv link or a title"
          value={q}
          autoFocus={!expanded}
          onChange={(e) => (setQ(e.target.value), setFound(null))}
          onKeyDown={(e) => e.key === "Enter" && search()}
          aria-label="Find a paper"
        />
        <button className="mini-btn" onClick={search} disabled={busy || !q.trim()}>{busy ? "…" : "find"}</button>
      </div>
      {found && (
        <div className="cat-found">
          {found.map((f, i) => (
            <button key={i} className="cat-hit" onClick={() => add(f)}>
              <b>{f.title}</b>
              <i>{[byline(f), f.year, f.venue].filter(Boolean).join(" · ")}</i>
            </button>
          ))}
          <button className="cat-hit hand" onClick={byHand}>
            <b>+ file “{q.trim()}” by hand</b>
            <i>{found.length ? "none of these" : "nothing came up"}</i>
          </button>
        </div>
      )}
    </>
  );

  if (!cards.length && !askRow) {
    return (
      <div className="cat">
        <Empty action={<button className="mini-btn" onClick={() => setAdding(true)}>+ file a paper</button>}>an empty drawer</Empty>
      </div>
    );
  }

  return (
    <div className="cat">
      {askRow && form}
      <Seg label="Drawer sections" value={tab} onChange={(t) => (setTab(t), setOpenId(null))} options={TABS.map(([id, label]) => ({ id, label: count(id) ? `${label} ${count(id)}` : label }))} />

      <div className="cat-cards">
        {shown.length === 0 && <div className="cat-none">nothing {tab === "toread" ? "waiting" : tab === "reading" ? "in hand" : "finished"} yet</div>}
        {shown.map((c) => (
          <Card key={c.id} c={c} expanded={expanded} open={c.id === openId} onOpen={() => setOpenId(c.id === openId ? null : c.id)} patch={(p) => patch(c.id, p)} move={(st) => move(c, st)} remove={() => remove(c)} toast={toast} />
        ))}
      </div>

      {!expanded && (
        <div className="cat-foot">
          {all.length > SHOWN && <button className="mini-btn ghost" onClick={openBig}>+ {all.length - SHOWN} more</button>}
          {!adding && <button className="mini-btn" onClick={() => setAdding(true)}>+ file a paper</button>}
        </div>
      )}
      {expanded && <Credit>Crossref · DataCite · Semantic Scholar</Credit>}
    </div>
  );
}

function Card({ c, expanded, open, onOpen, patch, move, remove, toast }) {
  const copy = async (what) => {
    try {
      await navigator.clipboard.writeText(what === "apa" ? apa(c) : bibtex(c));
      toast({ text: what === "apa" ? "APA citation copied" : "BibTeX copied" });
    } catch {
      toast({ text: "couldn't copy, select it by hand" });
    }
  };

  return (
    <div className={`cat-card st-${c.status}${open ? " open" : ""}${c.pending ? " wait" : ""}`}>
      <button className="cat-head" onClick={onOpen} aria-expanded={open} title={c.title}>
        <b>{c.pending ? (c.pending.doi ?? c.pending.arxiv) : c.title}</b>
        <i>{c.pending ? "looking it up…" : [byline(c), c.year].filter(Boolean).join(" · ") || "unknown authors"}</i>
      </button>
      {open && !c.pending && (
        <div className="cat-body">
          {c.venue && <div className="cat-venue">{c.venue}{c.cites != null ? ` · cited ${c.cites.toLocaleString()}×` : ""}</div>}
          {c.abstract && <p className="cat-abs">{c.abstract}</p>}
          <div className="cat-links">
            {c.pdf && <a href={c.pdf} target="_blank" rel="noreferrer">PDF</a>}
            {c.url && <a href={c.url} target="_blank" rel="noreferrer">page</a>}
            {expanded && <button className="mini-btn ghost" onClick={() => copy("apa")}>APA</button>}
            {expanded && <button className="mini-btn ghost" onClick={() => copy("bib")}>BibTeX</button>}
            <button className="x-btn" onClick={remove} aria-label="Take it out of the drawer" title="Take it out">✕</button>
          </div>
          <Seg small label="Status" value={c.status} onChange={move} options={TABS.map(([id, label]) => ({ id, label }))} />
          {c.status === "read" && (
            <label className="cat-date">
              read on
              <input type="date" value={c.readAt ?? ""} onChange={(e) => patch({ readAt: e.target.value || null })} />
              {c.readAt && <span>{prettyDate(c.readAt)}</span>}
            </label>
          )}
          <textarea className="cat-notes" rows={2} placeholder="notes…" value={c.notes ?? ""} onChange={(e) => patch({ notes: e.target.value })} aria-label="Notes" />
        </div>
      )}
    </div>
  );
}
