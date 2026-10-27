import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { dayKey, prettyDate } from "../../utils/date";
import { useApiKey, KEYS } from "../../lib/apis";
import { Seg, Empty, Fold, Credit } from "./kit";
import { searchGames, gamesIn, hoursLabel, PLATFORMS } from "../../lib/backlog";

const SHELLS = ["#8a8d91", "#c9c2a8", "#6d7f8f", "#a08f7a", "#7f8a74", "#9a7f8f"];
const LABELS = ["#ff5d8f", "#ffc933", "#41c7c0", "#4d9bff", "#a875ee", "#8ac926", "#ff9a3c"];
const shell = (g) => SHELLS[Math.abs(hash(g.id)) % SHELLS.length];
const label = (g) => LABELS[Math.abs(hash(g.title)) % LABELS.length];
function hash(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

// A shelf of game cartridges: the ones waiting, the one in the console, and a done pile
// (beaten or dropped, with the date). Add games by hand, or search RAWG for the cover,
// release date and Metacritic score when you've pasted a free RAWG key in Settings → API keys.
// State: games [{ id, title, platform, status: backlog|playing|beaten|dropped, hours,
// cover?, released?, meta?, rawg?, addedAt, lastAt?, startedAt?, endedAt? (day keys) }].
export default function Backlog({ board, mod, setState, onPatch, expanded }) {
  const { logPractice, undoLog, toast } = useData();
  const games = mod.state.games ?? [];
  const rawgKey = useApiKey("rawg");
  const [tab, setTab] = useState(gamesIn(mod.state, "playing").length ? "playing" : "backlog");
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("");
  const [hits, setHits] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pick, setPick] = useState(null); // backlog cartridge pulled off the shelf

  const patch = (id, f) => setState((s) => ({ ...s, games: (s.games ?? []).map((g) => (g.id === id ? { ...g, ...f } : g)) }));
  const remove = (id) => { setState((s) => ({ ...s, games: (s.games ?? []).filter((g) => g.id !== id) })); setPick(null); };

  const add = (g) => {
    setState((s) => ({ ...s, games: [...(s.games ?? []), { id: uid(), status: "backlog", hours: 0, addedAt: Date.now(), ...g }] }));
    if (!mod.named && games.length === 0) onPatch?.({ title: `${g.title} & co.` });
    setTitle("");
    setHits(null);
    setMsg("");
  };

  const find = async () => {
    const t = title.trim();
    if (!t || !rawgKey) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await searchGames(t, rawgKey);
      setHits(r);
      if (!r.length) setMsg(`RAWG doesn't know “${t}”; add it by hand`);
    } catch {
      setMsg("couldn't reach RAWG (is the key right?). adding by hand still works");
    } finally {
      setBusy(false);
    }
  };

  const addHand = () => {
    const t = title.trim();
    if (t && !games.some((g) => g.title.toLowerCase() === t.toLowerCase() && g.platform === platform)) add({ title: t, platform });
    else if (t) setMsg("that one's already on the shelf");
  };

  const start = (g) => { patch(g.id, { status: "playing", startedAt: g.startedAt ?? dayKey(), lastAt: Date.now() }); setPick(null); setTab("playing"); };

  // Time played also goes on the board as practice
  const play = (g, h) => {
    const next = Math.max(0, Math.round(((g.hours ?? 0) + h) * 2) / 2);
    patch(g.id, { hours: next, lastAt: Date.now() });
    if (h > 0) {
      const entry = logPractice(board.id, `🎮 ${hoursLabel(h)} of ${g.title}`, { mins: Math.round(h * 60) });
      toast({ text: `${hoursLabel(next)} on ${g.title}`, actions: [{ label: "undo", run: () => { undoLog(entry); patch(g.id, { hours: g.hours ?? 0 }); } }] });
    }
  };

  const finish = (g, status) => { patch(g.id, { status, endedAt: dayKey(), lastAt: Date.now() }); setTab("done"); };

  const waiting = gamesIn(mod.state, "backlog");
  const playing = gamesIn(mod.state, "playing");
  const done = games.filter((g) => g.status === "beaten" || g.status === "dropped").sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""));
  const totalHours = games.reduce((t, g) => t + (g.hours ?? 0), 0);

  return (
    <div className={`bl${expanded ? " big" : ""}`}>
      <div className="bl-add">
        <input className="line-input" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (rawgKey ? find() : addHand())} placeholder="add a game…" aria-label="Game title" />
        <button className="mini-btn" onClick={rawgKey ? find : addHand} disabled={busy || !title.trim()}>{busy ? "…" : rawgKey ? "search" : "add"}</button>
      </div>
      <Fold label="options">
        <input className="line-input" list="bl-platforms" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="platform (Switch, PC…)" aria-label="Platform" />
        <datalist id="bl-platforms">{PLATFORMS.map((p) => <option key={p} value={p} />)}</datalist>
        {rawgKey && <button className="mini-btn ghost" onClick={addHand} disabled={!title.trim()}>add without searching</button>}
        {!rawgKey && <span className="bl-note">needs a free RAWG key for covers and dates: Settings → API keys.</span>}
      </Fold>
      {msg && <div className="bl-msg" role="status">{msg}</div>}
      {hits && (
        <div className="bl-hits">
          {hits.map((h) => (
            <button key={h.rawg} className="bl-hit" onClick={() => add({ title: h.title, platform: platform || h.platforms[0] || "", cover: h.cover, released: h.released, meta: h.meta, rawg: h.rawg })}>
              {h.cover ? <img src={h.cover} alt="" loading="lazy" /> : <span className="bl-nopic">🎮</span>}
              <span><b>{h.title}</b><em>{[h.released?.slice(0, 4), h.platforms.join(", "), h.meta ? `metacritic ${h.meta}` : ""].filter(Boolean).join(" · ")}</em></span>
              <u>+ add</u>
            </button>
          ))}
          <button className="tg-link" onClick={() => setHits(null)}>close</button>
        </div>
      )}

      <Seg label="Games" value={tab} onChange={setTab} options={[{ id: "backlog", label: `backlog · ${waiting.length}` }, { id: "playing", label: `playing · ${playing.length}` }, { id: "done", label: `done · ${done.length}` }]} />

      {tab === "backlog" && (
        <>
          {waiting.length === 0 && <Empty>Nothing waiting. Add a game above.</Empty>}
          <div className="bl-shelf" hidden={waiting.length === 0}>
            {waiting.map((g) => (
              <button key={g.id} className={`bl-cart${pick === g.id ? " up" : ""}`} onClick={() => setPick(pick === g.id ? null : g.id)} style={{ "--shell": shell(g), "--lab": label(g) }} aria-expanded={pick === g.id} aria-label={`${g.title}${g.platform ? ` on ${g.platform}` : ""}`}>
                <span className="bl-lab"><b>{g.title}</b>{g.platform && <i>{g.platform}</i>}</span>
              </button>
            ))}
          </div>
          {waiting.filter((g) => g.id === pick).map((g) => (
            <div key={g.id} className="bl-detail">
              {g.cover && <img src={g.cover} alt="" loading="lazy" />}
              <div>
                <b>{g.title}</b>
                <em>{[g.platform, g.released && `released ${g.released.slice(0, 4)}`, g.meta && `metacritic ${g.meta}`].filter(Boolean).join(" · ")}</em>
                <div className="bl-acts">
                  <button className="mini-btn" onClick={() => start(g)}>▶ start playing</button>
                  <button className="mini-btn ghost" onClick={() => remove(g.id)}>remove</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === "playing" && (
        <>
          {playing.length === 0 && <Empty>Nothing in the console. Pull a cartridge off the shelf.</Empty>}
          {playing.map((g) => (
            <div key={g.id} className="bl-case" style={{ "--lab": label(g) }}>
              <div className="bl-box">
                {g.cover ? <img src={g.cover} alt="" loading="lazy" /> : <span>{g.title}</span>}
              </div>
              <div className="bl-play">
                <b>{g.title}</b>
                <em>{[g.platform, g.startedAt && `since ${prettyDate(g.startedAt)}`].filter(Boolean).join(" · ")}</em>
                <div className="bl-hours">
                  <button className="bl-step" onClick={() => play(g, -0.5)} aria-label="Half an hour less" disabled={!g.hours}>−</button>
                  <b aria-live="polite">{hoursLabel(g.hours)}</b>
                  <button className="bl-step" onClick={() => play(g, 0.5)} aria-label="Add half an hour">+½</button>
                  <button className="bl-step" onClick={() => play(g, 1)} aria-label="Add an hour">+1h</button>
                </div>
                <div className="bl-acts">
                  <button className="mini-btn" onClick={() => finish(g, "beaten")}>beaten ✓</button>
                  <button className="mini-btn ghost" onClick={() => finish(g, "dropped")}>dropped</button>
                  <button className="mini-btn ghost" onClick={() => patch(g.id, { status: "backlog" })}>back on the shelf</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === "done" && (
        <div className="bl-done">
          {done.length === 0 && <Empty>No finished games yet.</Empty>}
          {done.map((g) => (
            <div key={g.id} className={`bl-row ${g.status}`}>
              <span className="bl-stamp">{g.status === "beaten" ? "BEATEN" : "DROPPED"}</span>
              <span className="bl-rt"><b>{g.title}</b><em>{[g.platform, g.hours ? hoursLabel(g.hours) : "", g.endedAt && prettyDate(g.endedAt)].filter(Boolean).join(" · ")}</em></span>
              <button className="tg-link" onClick={() => patch(g.id, { status: "playing", endedAt: null })}>play again</button>
              <button className="x-btn" onClick={() => remove(g.id)} aria-label={`Remove ${g.title}`}>✕</button>
            </div>
          ))}
        </div>
      )}

      <Credit>{totalHours > 0 ? `${hoursLabel(totalHours)} played` : ""}{rawgKey ? `${totalHours > 0 ? " · " : ""}RAWG` : ""}</Credit>
    </div>
  );
}
