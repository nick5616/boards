import { Seg, Empty, Fold, Credit } from "./kit";
import { useState, useEffect, useRef } from "react";
import { uid } from "../../utils/uid";
import { searchAlbums, coverUrl, findPreview } from "../../lib/music";

const hue = (s) => [...(s || "?")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

// One album sleeve. The cover comes from the Cover Art Archive; when there isn't one
// (or offline) the sleeve is plain card with the title typed on it.
export function Sleeve({ rec, size = 120 }) {
  const [bad, setBad] = useState(false);
  return (
    <div className="cr-sleeve" style={{ width: size, height: size, "--h": hue(rec.title) }}>
      {!bad && rec.mbid ? (
        <img src={coverUrl(rec.mbid)} alt={`${rec.title} cover`} loading="lazy" onError={() => setBad(true)} />
      ) : (
        <span className="cr-blank"><b>{rec.title}</b><i>{rec.artist}</i></span>
      )}
    </div>
  );
}

const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
const day = (at) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// A wooden crate of records you mean to hear. Flip through the sleeves, play a 30-second
// taste, and when you've actually listened: mark it played, give it stars, and it moves
// to the played pile with the date.
// State: crate [{ id, mbid, title, artist, year }], played [{ ...record, at, stars }], idx (which sleeve is up front).
export default function Crate({ mod, setState, expanded }) {
  const { crate = [], played = [], idx = 0 } = mod.state;
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  const [status, setStatus] = useState("idle");
  const [pile, setPile] = useState(false); // showing the played pile
  const [rating, setRating] = useState(false); // choosing stars for the front record
  const [pv, setPv] = useState({ id: null, state: "idle" }); // preview: idle | loading | playing | none
  const audio = useRef(null);

  const at = Math.min(idx, Math.max(0, crate.length - 1));
  const front = crate[at];

  useEffect(() => () => audio.current?.pause(), []);
  // flipping to another record stops the sample
  useEffect(() => {
    audio.current?.pause();
    setPv({ id: null, state: "idle" });
    setRating(false);
  }, [front?.id]);

  const find = async () => {
    if (!q.trim()) return;
    setStatus("loading");
    try {
      setHits(await searchAlbums(q));
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  const add = (h) => {
    if (crate.some((c) => c.mbid === h.mbid)) return;
    setState((s) => ({ ...s, crate: [{ id: uid(), ...h }, ...(s.crate ?? [])], idx: 0 }));
    setHits(null);
    setQ("");
  };

  const flip = (d) => setState((s) => ({ ...s, idx: Math.max(0, Math.min((s.crate?.length ?? 1) - 1, (s.idx ?? 0) + d)) }));

  const done = (n) => {
    if (!front) return;
    setState((s) => {
      const rest = (s.crate ?? []).filter((c) => c.id !== front.id);
      return { ...s, crate: rest, idx: Math.min(s.idx ?? 0, Math.max(0, rest.length - 1)), played: [{ ...front, at: Date.now(), stars: n }, ...(s.played ?? [])] };
    });
    setRating(false);
  };
  const putBack = (rec) =>
    setState((s) => {
      const { at: _at, stars: _s, ...bare } = rec;
      return { ...s, played: (s.played ?? []).filter((p) => p.id !== rec.id), crate: [...(s.crate ?? []), bare] };
    });
  const restar = (rec, n) =>
    setState((s) => ({ ...s, played: (s.played ?? []).map((p) => (p.id === rec.id ? { ...p, stars: n } : p)) }));

  const taste = async () => {
    if (!front) return;
    if (pv.state === "playing") { audio.current?.pause(); setPv({ id: front.id, state: "idle" }); return; }
    setPv({ id: front.id, state: "loading" });
    try {
      const p = await findPreview(front.artist, front.title);
      if (!p) { setPv({ id: front.id, state: "none" }); return; }
      audio.current?.pause();
      audio.current = new Audio(p.url);
      audio.current.onended = () => setPv({ id: front.id, state: "idle", track: p.track });
      await audio.current.play();
      setPv({ id: front.id, state: "playing", track: p.track });
    } catch {
      setPv({ id: front.id, state: "none" });
    }
  };
  const pvNow = pv.id === front?.id ? pv : { state: "idle" };

  const search = (
    <div className="cr-search">
      <input
        className="line-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && find()}
        placeholder="album or artist…"
        aria-label="Find an album"
      />
      <button className="mini-btn" onClick={find} disabled={!q.trim() || status === "loading"}>{status === "loading" ? "…" : "dig"}</button>
    </div>
  );

  const results = hits && (
    <div className="cr-hits">
      {hits.length === 0 && <div className="cr-note">no records found for that.</div>}
      {hits.map((h) => (
        <button key={h.mbid} className="cr-hit" onClick={() => add(h)} disabled={crate.some((c) => c.mbid === h.mbid)}>
          <Sleeve rec={h} size={40} />
          <span><b>{h.title}</b><i>{h.artist}{h.year ? ` · ${h.year}` : ""}</i></span>
          <em>{crate.some((c) => c.mbid === h.mbid) ? "in crate" : "+ crate"}</em>
        </button>
      ))}
    </div>
  );

  return (
    <div className={`cr${expanded ? " big" : ""}`}>
      {(played.length > 0 || pile) && (
        <Seg
          small
          label="Crate or played"
          options={[{ id: "crate", label: `Crate ${crate.length}` }, { id: "played", label: `Played ${played.length}` }]}
          value={pile ? "played" : "crate"}
          onChange={(v) => setPile(v === "played")}
        />
      )}

      {!pile && hits && <>{search}{results}</>}

      {!pile && !hits && (
        front ? (
          <div className="cr-box">
            <div className="cr-front">
              <button className="cr-flip" onClick={() => flip(-1)} disabled={at === 0} aria-label="Previous record">‹</button>
              <div className="cr-up"><Sleeve rec={front} size={expanded ? 190 : 140} /></div>
              <button className="cr-flip" onClick={() => flip(1)} disabled={at >= crate.length - 1} aria-label="Next record">›</button>
            </div>
            <div className="cr-label">
              <b title={front.title}>{front.title}</b>
              <span>{front.artist}{front.year ? ` · ${front.year}` : ""}{crate.length > 1 ? ` · ${at + 1} of ${crate.length}` : ""}</span>
            </div>
            {rating ? (
              <div className="cr-rate" role="group" aria-label="How was it?">
                {[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => done(n)} aria-label={`${n} stars`}>★</button>)}
                <button className="mini-btn ghost" onClick={() => done(0)}>no stars</button>
              </div>
            ) : (
              <div className="cr-acts">
                <button className="mini-btn ghost" onClick={taste} disabled={pvNow.state === "loading"}>
                  {pvNow.state === "playing" ? "❚❚ stop" : pvNow.state === "loading" ? "…" : "▶ 30s"}
                </button>
                <button className="mini-btn" onClick={() => setRating(true)}>✓ listened</button>
              </div>
            )}
            {pvNow.state === "none" && <div className="cr-note">no preview for this one</div>}
            {pvNow.state === "playing" && pvNow.track && <div className="cr-note">♪ {pvNow.track}</div>}
            <Fold label="dig for more" start={false}>
              {search}
              {status === "error" && <div className="cr-note">couldn't reach MusicBrainz, try again soon</div>}
              <button className="mini-btn ghost" onClick={() => setState((s) => ({ ...s, crate: (s.crate ?? []).filter((c) => c.id !== front.id) }))}>take this one out</button>
            </Fold>
          </div>
        ) : (
          <Empty action={search}>{status === "error" ? "couldn't reach MusicBrainz" : "Dig up an album to hear."}</Empty>
        )
      )}

      {pile && (
        <div className="cr-played">
          {played.length === 0 && <Empty>Nothing played yet.</Empty>}
          {played.map((r) => (
            <div key={r.id} className="cr-row">
              <Sleeve rec={r} size={40} />
              <span className="cr-rt"><b>{r.title}</b><i>{r.artist}</i></span>
              <span className="cr-when">
                {day(r.at)}
                <button className="cr-stars" onClick={() => restar(r, ((r.stars ?? 0) % 5) + 1)} aria-label={`${r.stars || "no"} stars; tap to change`}>
                  {r.stars ? stars(r.stars) : "☆☆☆☆☆"}
                </button>
              </span>
              <button className="x-btn" onClick={() => putBack(r)} aria-label="Put it back in the crate" title="back in the crate">↺</button>
            </div>
          ))}
        </div>
      )}

      <Credit>MusicBrainz · Cover Art Archive</Credit>
    </div>
  );
}
