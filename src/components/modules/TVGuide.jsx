import { useState, useEffect, useRef } from "react";
import { uid } from "../../utils/uid";
import { dayKey } from "../../utils/date";
import { Empty, Fold, Credit } from "./kit";
import { useApiKey, HOUR } from "../../lib/apis";
import {
  showRefOf, searchShows, showByImdb, loadShow, loadEpisodes, searchMovies, movieProviders,
  isMovie, isFinished, counts, epsLeft, onEpisode, seasonBar, toggleEp, setSeason, whenLabel, movieWhen, ep,
} from "../../lib/screen";

const sortKey = (x, now) => {
  if (isMovie(x)) return 2e15 + (x.date ? Date.parse(x.date) : 9e14);
  const hot = x.seasons?.length && epsLeft(x) > 0;
  const at = x.next?.at ?? 9e14;
  return hot ? at - 1e15 : at;
};

// A TV Guide page: what's on this week among the shows you follow, which episode you're
// on, and a shelf of VHS tapes for the ones you've finished. Show times come from TVMaze
// and are shown in your own time zone. Movies come from TMDB when you've pasted a key
// in Settings → API keys, and can always be added by hand.
// State: items [{ id, kind: "show"|"movie", title, ... }] (see lib/screen.js).
export default function TVGuide({ mod, setState, onPatch, expanded, openBig }) {
  const items = mod.state.items ?? [];
  const tmdb = useApiKey("tmdb");
  const [now, setNow] = useState(Date.now());
  const [q, setQ] = useState("");
  const [found, setFound] = useState(null); // { shows, movies } | null
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(null); // id of the show whose episodes are showing
  const [adding, setAdding] = useState(false); // the add box, on the small card
  const [handForm, setHandForm] = useState({ title: "", date: "" });
  const loading = useRef(new Set());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const patch = (id, f) =>
    setState((s) => ({ ...s, items: (s.items ?? []).map((x) => (x.id === id ? (typeof f === "function" ? f(x) : { ...x, ...f }) : x)) }));

  // Bring shows up to date: new ones (pasted in, so just an id) and ones last checked hours ago
  useEffect(() => {
    items.forEach((x) => {
      if (isMovie(x) || loading.current.has(x.id)) return;
      const stale = !x.checkedAt || now - x.checkedAt > 6 * HOUR || (x.next && x.next.at <= now && x.checkedAt < x.next.at);
      if (!stale) return;
      loading.current.add(x.id);
      (async () => {
        try {
          const id = x.tvmaze ?? (x.imdb ? await showByImdb(x.imdb) : null);
          if (!id) return patch(x.id, { checkedAt: Date.now(), failed: true });
          const fresh = await loadShow(id);
          patch(x.id, (cur) => ({ ...cur, ...fresh, failed: false }));
          if (!mod.named && items.length === 1) {
            onPatch?.({ title: fresh.seasons?.length ? `${fresh.title} — S${(onEpisode({ ...x, ...fresh }) ?? { s: fresh.seasons[fresh.seasons.length - 1][0] }).s}` : fresh.title });
          }
        } catch {
          // offline: try again next time it opens; mark so we don't loop right now
          patch(x.id, { checkedAt: Date.now() - 5.5 * HOUR });
        } finally {
          loading.current.delete(x.id);
        }
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((x) => x.id + (x.checkedAt ?? 0)).join(), Math.floor(now / 60000)]);

  // Movie providers, once, when we have the key and the movie has an id
  useEffect(() => {
    if (!tmdb) return;
    items.filter((x) => isMovie(x) && x.tmdb && !x.providers).forEach((x) => {
      movieProviders(x.tmdb, tmdb).then((providers) => patch(x.id, { providers })).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdb, items.length]);

  const add = (x) => {
    setState((s) => ({ ...s, items: [...(s.items ?? []), { id: uid(), addedAt: Date.now(), ...x }] }));
    setFound(null);
    setQ("");
    setMsg("");
    setAdding(false);
  };

  const look = async () => {
    const text = q.trim();
    if (!text) return;
    setBusy(true);
    setMsg("");
    try {
      const ref = showRefOf(text);
      if (ref) {
        if ([...items].some((x) => (ref.tvmaze && x.tvmaze === ref.tvmaze) || (ref.imdb && x.imdb === ref.imdb))) {
          setMsg("already on the guide");
        } else add({ kind: "show", title: "a show…", ...ref });
        return;
      }
      const [shows, movies] = await Promise.all([
        searchShows(text),
        tmdb ? searchMovies(text, tmdb).catch(() => []) : [],
      ]);
      setFound({ shows, movies });
      if (!shows.length && !movies.length) setMsg(`nothing called “${text}”`);
    } catch {
      setMsg("couldn't reach TVMaze; are you online?");
    } finally {
      setBusy(false);
    }
  };

  const addShow = (r) => {
    if (items.some((x) => x.tvmaze === r.tvmaze)) return setMsg(`${r.title} is already on the guide`);
    add({ kind: "show", tvmaze: r.tvmaze, title: r.title, img: r.img, status: r.status, network: r.network });
  };

  const addMovie = (m) => add({ kind: "movie", title: m.title, date: m.date, tmdb: m.tmdb ?? null, img: m.img ?? null });

  const watched = (x) => {
    const n = onEpisode(x);
    if (n) patch(x.id, (cur) => toggleEp(cur, n.s, n.e));
  };

  const remove = (id) => {
    setState((s) => ({ ...s, items: (s.items ?? []).filter((x) => x.id !== id) }));
    if (open === id) setOpen(null);
  };

  const active = items.filter((x) => !isFinished(x)).sort((a, b) => sortKey(a, now) - sortKey(b, now));
  const finished = items.filter(isFinished);
  const today = dayKey();
  const shown = expanded ? active : active.slice(0, 3);
  const adder = adding || expanded;

  return (
    <div className={`tg${expanded ? " big" : ""}`}>
      {adder && (
        <div className="tg-addbox">
          <div className="tg-add">
            <input
              className="line-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && look()}
              placeholder="a show, or paste a tvmaze / imdb link"
              aria-label="Find a show"
            />
            <button className="mini-btn" onClick={look} disabled={busy || !q.trim()}>{busy ? "…" : "find"}</button>
          </div>
          {msg && <div className="tg-msg" role="status">{msg}</div>}
          {found && (
            <div className="tg-found">
              {found.shows.map((r) => (
                <button key={`s${r.tvmaze}`} className="tg-hit" onClick={() => addShow(r)}>
                  {r.img ? <img src={r.img} alt="" loading="lazy" /> : <span className="tg-nopic">📺</span>}
                  <span><b>{r.title}</b><em>{[r.year, r.network, r.status].filter(Boolean).join(" · ")}</em></span>
                  <u>+</u>
                </button>
              ))}
              {found.movies.map((m) => (
                <button key={`m${m.tmdb}`} className="tg-hit" onClick={() => addMovie(m)}>
                  {m.img ? <img src={m.img} alt="" loading="lazy" /> : <span className="tg-nopic">🎬</span>}
                  <span><b>{m.title}</b><em>movie · {m.date || "no date yet"}</em></span>
                  <u>+</u>
                </button>
              ))}
            </div>
          )}
          <Fold label="movies">
            {!tmdb && (
              <span className="tvg-note">
                searching movies needs a free TMDB key in Settings → API keys, or add one by hand.
              </span>
            )}
            <div className="tg-hand">
              <input className="line-input" value={handForm.title} onChange={(e) => setHandForm({ ...handForm, title: e.target.value })} placeholder="movie title" aria-label="Movie title" />
              <input type="date" className="line-input" value={handForm.date} onChange={(e) => setHandForm({ ...handForm, date: e.target.value })} aria-label="Release date" />
              <button
                className="mini-btn"
                disabled={!handForm.title.trim()}
                onClick={() => { addMovie({ title: handForm.title.trim(), date: handForm.date }); setHandForm({ title: "", date: "" }); }}
              >add</button>
            </div>
          </Fold>
        </div>
      )}

      {active.length === 0 && !adder && (
        <Empty action={<button className="mini-btn" onClick={() => setAdding(true)}>+ follow a show</button>}>
          Follow a show and its next episode shows up here.
        </Empty>
      )}
      <div className="tg-list">
        {shown.map((x) => (
          isMovie(x) ? (
            <MovieRow key={x.id} m={x} now={now} onSeen={() => patch(x.id, { seenAt: dayKey() })} onRemove={() => remove(x.id)} />
          ) : (
            <ShowRow
              key={x.id}
              x={x}
              now={now}
              open={open === x.id}
              onOpen={() => setOpen(open === x.id ? null : x.id)}
              onTick={() => watched(x)}
              onPatch={(f) => patch(x.id, f)}
              onRemove={() => remove(x.id)}
            />
          )
        ))}
      </div>
      {active.length > shown.length && (
        <button className="tg-link" onClick={() => openBig?.()}>+ {active.length - shown.length} more</button>
      )}
      {!expanded && active.length > 0 && !adding && (
        <button className="mini-btn ghost tg-follow" onClick={() => setAdding(true)}>+ follow</button>
      )}

      {finished.length > 0 && !expanded && (
        <button className="tg-link" onClick={() => openBig?.()}>{finished.length} finished ›</button>
      )}
      {finished.length > 0 && expanded && (
        <div className="tg-shelf">
          <div className="tg-tapes">
            {finished.map((x) => (
              <button key={x.id} className="tg-tape" onClick={() => setOpen(open === x.id ? null : x.id)} aria-label={x.title} aria-expanded={open === x.id}>
                <span className="tg-label">{x.title}</span>
              </button>
            ))}
          </div>
          {finished.filter((x) => x.id === open).map((x) => (
            <div key={x.id} className="tg-tapeinfo">
              <b>{x.title}</b>
              <button className="mini-btn ghost" onClick={() => patch(x.id, isMovie(x) ? { seenAt: null } : { done: false, seen: {} })}>
                {isMovie(x) ? "watch again" : "rewatch"}
              </button>
              <button className="mini-btn ghost" onClick={() => remove(x.id)}>remove</button>
            </div>
          ))}
        </div>
      )}

      <Credit>TVMaze{tmdb ? " · TMDB (not endorsed by TMDB)" : ""}</Credit>
    </div>
  );
}

function ShowRow({ x, now, open, onOpen, onTick, onPatch, onRemove }) {
  const here = onEpisode(x);
  const left = x.seasons?.length ? epsLeft(x) : null;
  const bar = seasonBar(x);
  const hot = left > 0;
  return (
    <div className={`tg-item${hot ? " hot" : ""}`}>
      <div className="tg-row">
        <button className="tg-poster" onClick={onOpen} aria-label={`${x.title}: ${open ? "hide" : "show"} episodes`} aria-expanded={open}>
          {x.img ? <img src={x.img} alt="" loading="lazy" /> : <span>{(x.title || "?").slice(0, 1)}</span>}
        </button>
        <div className="tg-info" onClick={onOpen}>
          <b>{x.title}</b>
          {x.network && <span className="tg-net">{x.network}</span>}
          {x.failed && <span className="tg-sub">couldn't find that show</span>}
          {!x.failed && !x.seasons && <span className="tg-sub">looking it up…</span>}
          {x.next ? (
            <span className="tg-next">
              <i>{ep(x.next.s, x.next.e)}</i> {whenLabel(x.next.at, now)}
            </span>
          ) : x.seasons ? (
            <span className="tg-sub">{x.status === "Ended" ? "ended" : x.status === "Running" ? "no new episode scheduled" : "waiting on a new season"}</span>
          ) : null}
          {x.seasons?.length > 0 && (
            <span className="tg-on">
              {here ? <>on <b>{ep(here.s, here.e)}</b>{left > 1 ? ` · ${left} left` : ""}</> : "all caught up"}
            </span>
          )}
          {bar && bar.total > 0 && (
            <span className="tvg-bar" title={`Season ${bar.s}: ${bar.seen} of ${bar.total}`}>
              <u style={{ width: `${(bar.seen / bar.total) * 100}%` }} />
            </span>
          )}
        </div>
        {here && (
          <button className="tg-tick" onClick={onTick} aria-label={`Watched ${ep(here.s, here.e)} of ${x.title}`} title={`watched ${ep(here.s, here.e)}`}>✓</button>
        )}
      </div>
      {open && <Episodes x={x} onPatch={onPatch} onRemove={onRemove} />}
    </div>
  );
}

function Episodes({ x, onPatch, onRemove }) {
  const [eps, setEps] = useState(null);
  useEffect(() => {
    let live = true;
    if (x.tvmaze) loadEpisodes(x.tvmaze).then((e) => live && setEps(e)).catch(() => live && setEps([]));
    return () => { live = false; };
  }, [x.tvmaze]);
  const upd = (fn) => onPatch((cur) => fn(cur));
  const bySeason = {};
  (eps ?? []).forEach((e) => (bySeason[e.s] ??= []).push(e));
  const now = Date.now();
  return (
    <div className="tg-eps">
      {eps === null && <div className="tg-sub">loading episodes…</div>}
      {Object.keys(bySeason).map(Number).map((s) => {
        const list = bySeason[s];
        const got = new Set(x.seen?.[s] ?? []);
        const aired = list.filter((e) => e.at != null && e.at <= now).length;
        return (
          <div key={s} className="tg-season">
            <div className="tg-seh">
              <b>Season {s}</b> <em>{[...got].filter((n) => n <= aired).length}/{list.length}</em>
              <button className="tg-link" onClick={() => upd((cur) => setSeason(cur, s, got.size < aired))}>
                {got.size < aired ? "tick all aired" : "clear"}
              </button>
            </div>
            <div className="tg-grid">
              {list.map((e) => {
                const out = e.at != null && e.at <= now;
                return (
                  <button
                    key={e.e}
                    className={`tg-ep${got.has(e.e) ? " seen" : ""}${out ? "" : " soon"}`}
                    disabled={!out}
                    onClick={() => upd((cur) => toggleEp(cur, s, e.e))}
                    title={`${ep(s, e.e)} ${e.name}${out ? "" : ` · ${whenLabel(e.at)}`}`}
                    aria-label={`${ep(s, e.e)} ${e.name}${got.has(e.e) ? ", watched" : ""}`}
                    aria-pressed={got.has(e.e)}
                  >{e.e}</button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="tg-acts">
        {x.url && <a className="mini-btn ghost" href={x.url} target="_blank" rel="noreferrer">on TVMaze ↗</a>}
        <button className="mini-btn ghost" onClick={() => onPatch({ done: true })}>shelve it</button>
        <button className="mini-btn ghost" onClick={onRemove}>remove</button>
      </div>
      <div className="tg-sub">{counts(x).seen} of {counts(x).aired} aired episodes watched</div>
    </div>
  );
}

function MovieRow({ m, now, onSeen, onRemove }) {
  const out = m.date && Date.parse(`${m.date}T12:00:00`) <= now;
  return (
    <div className="tg-item movie">
      <div className="tg-row">
        <div className="tg-poster static">{m.img ? <img src={m.img} alt="" loading="lazy" /> : <span>🎬</span>}</div>
        <div className="tg-info">
          <b>{m.title}</b>
          <span className="tg-net">movie</span>
          {m.date && <span className="tg-next"><i>{out ? "out" : "coming"}</i> {movieWhen(m.date, now)}</span>}
          {m.providers?.length > 0 && <span className="tg-sub">stream on {m.providers.join(", ")}</span>}
          <button className="tg-link" onClick={onRemove}>remove</button>
        </div>
        <button className="tg-tick" onClick={onSeen} aria-label={`Watched ${m.title}`} title="watched it">✓</button>
      </div>
    </div>
  );
}
