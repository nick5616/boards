import { Seg, Empty, Fold, Credit } from "./kit";
import { useState, useEffect, useRef, useMemo } from "react";
import { searchLyrics, parseLrc, lineAt, lineKey, memorized, songQuery } from "../../lib/music";

const SPEEDS = [1, 0.75, 0.5];

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// A liner-notes booklet for one song. Search LRCLIB for the words, tick the lines you
// know by heart, and if the song has timestamps, "sing along" runs a play clock you start
// (slower for practice) that highlights and scrolls the line you should be singing.
// State: song { id, title, artist, album, duration, plain, synced } | null, mem [lineKey],
// speed 1|.75|.5, query (a pasted "Artist – Song" waiting to be looked up).
export default function Lyrics({ mod, setState, onPatch, expanded }) {
  const { song = null, mem = [], speed = 1, query = "" } = mod.state;
  const [q, setQ] = useState(query);
  const [hits, setHits] = useState(null); // null = not searched yet
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [sing, setSing] = useState(false); // karaoke mode
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useState(0); // song seconds on the play clock
  const t0 = useRef({ wall: 0, at: 0 }); // wall clock when we last started, and the song second then
  const box = useRef(null);

  const synced = useMemo(() => (song?.synced ? parseLrc(song.synced) : []), [song]);
  const memSet = useMemo(() => new Set(mem), [mem]);
  const stats = memorized(mod.state);

  const find = async (text) => {
    const want = (text ?? q).trim();
    if (!want) return;
    setStatus("loading");
    try {
      setHits(await searchLyrics(want));
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  // A pasted "Artist – Song" searches itself once
  useEffect(() => {
    if (query && !song) {
      setQ(query);
      find(query);
      setState((s) => ({ ...s, query: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const pick = (h) => {
    setState((s) => ({ ...s, song: h, mem: [], query: "" }));
    if (!mod.named) onPatch?.({ title: `${h.title} — ${h.artist}` });
    setHits(null);
    setSing(false);
    setRunning(false);
    setSec(0);
  };

  // The play clock: ticks ten times a second against the wall clock, scaled by speed
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const s = t0.current.at + ((performance.now() - t0.current.wall) / 1000) * speed;
      setSec(s);
      if (song?.duration && s > song.duration + 3) setRunning(false);
    }, 100);
    return () => clearInterval(id);
  }, [running, speed, song]);

  const start = () => {
    t0.current = { wall: performance.now(), at: sec };
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const seek = (s) => {
    t0.current = { wall: performance.now(), at: s };
    setSec(s);
  };
  const setSpeed = (v) => {
    // keep the song second where it is when the speed changes mid-song
    t0.current = { wall: performance.now(), at: sec };
    setState((s) => ({ ...s, speed: v }));
  };

  const here = sing && synced.length ? lineAt(synced, sec) : -1;
  // keep the sung line in view inside the booklet (not the whole page)
  useEffect(() => {
    if (here < 0 || !running || !box.current) return;
    const el = box.current.querySelector(`[data-i="${here}"]`);
    if (el) box.current.scrollTo({ top: el.offsetTop - box.current.clientHeight / 3, behavior: "smooth" });
  }, [here, running]);

  const toggle = (text) => {
    const k = lineKey(text);
    if (!k) return;
    setState((s) => {
      const have = new Set(s.mem ?? []);
      if (have.has(k)) have.delete(k); else have.add(k);
      return { ...s, mem: [...have] };
    });
  };

  // What to print: timed lines in sing-along, otherwise the plain text with its stanza breaks
  const rows = useMemo(() => {
    if (!song) return [];
    if (sing && synced.length) return synced.map((l, i) => ({ i, text: l.text, t: l.t })).filter((r) => r.text);
    return (song.plain ?? "").split(/\r?\n/).map((text, i) => ({ i, text: text.trim(), gap: !text.trim() }));
  }, [song, sing, synced]);

  const search = (
    <div className="ly-search">
      <input
        className="line-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && find()}
        placeholder="Artist – Song"
        aria-label="Song to look up"
      />
      <button className="mini-btn" onClick={() => find()} disabled={!q.trim() || status === "loading"}>
        {status === "loading" ? "…" : "find"}
      </button>
    </div>
  );

  const results = hits && (
    <div className="ly-hits">
      {hits.length === 0 && <div className="ly-note">no words found for “{songQuery(q)}”. Try just the title.</div>}
      {hits.map((h) => (
        <button key={h.id} className="ly-hit" onClick={() => pick(h)}>
          <b>{h.title}</b>
          <span>{h.artist}{h.album ? ` · ${h.album}` : ""}</span>
          {h.synced && <em title="has timing for sing-along">♪ timed</em>}
        </button>
      ))}
    </div>
  );

  if (!song) {
    return (
      <div className={`ly${expanded ? " big" : ""}`}>
        {results ? (
          <>{search}{results}</>
        ) : (
          <Empty action={search}>{status === "error" ? "couldn't reach the lyric library" : "Which song are you learning?"}</Empty>
        )}
      </div>
    );
  }

  const swap = () => { setState((s) => ({ ...s, song: null })); setHits(null); setRunning(false); setSing(false); };

  return (
    <div className={`ly${expanded ? " big" : ""}`}>
      <div className="ly-head">
        <div className="ly-titles">
          <b title={song.title}>{song.title}</b>
          <span>{song.artist}</span>
        </div>
        <div className="ly-count" title="lines you know by heart">
          <b>{stats.got}</b>/{stats.total} by heart
          <i><u style={{ width: `${stats.total ? (stats.got / stats.total) * 100 : 0}%` }} /></i>
        </div>
      </div>

      {synced.length > 0 && (
        <div className="ly-bar">
          <Seg
            small
            label="Mode"
            options={[{ id: "words", label: "Words" }, { id: "sing", label: "Sing along" }]}
            value={sing ? "sing" : "words"}
            onChange={(v) => { setSing(v === "sing"); setRunning(false); setSec(0); }}
          />
          {sing && (
            <>
              <button className="mini-btn" onClick={running ? pause : start}>{running ? "❚❚" : "▶"} {clock(sec)}</button>
              <button className="x-btn" onClick={() => { setRunning(false); seek(0); }} aria-label="Back to the start">⟲</button>
            </>
          )}
        </div>
      )}

      <div className="ly-page" ref={box}>
        {rows.map((r) =>
          r.gap ? (
            <div key={`g${r.i}`} className="ly-gap" />
          ) : (
            <div
              key={r.i}
              data-i={r.i}
              className={`ly-line${memSet.has(lineKey(r.text)) ? " known" : ""}${sing && r.i === here ? " now" : ""}${sing && here >= 0 && r.i < here ? " past" : ""}`}
            >
              <button
                className="ly-tick"
                onClick={() => toggle(r.text)}
                aria-pressed={memSet.has(lineKey(r.text))}
                aria-label={memSet.has(lineKey(r.text)) ? "Forget this line" : "I know this line"}
              >
                {memSet.has(lineKey(r.text)) ? "✓" : ""}
              </button>
              <span className="ly-text" onClick={() => { if (sing && r.t != null) seek(r.t); }}>
                {r.text}
              </span>
            </div>
          )
        )}
      </div>

      {(sing || expanded) && (
        <Seg small label="Speed" options={SPEEDS.map((v) => ({ id: String(v), label: v === 1 ? "1×" : `${v}×` }))} value={String(speed)} onChange={(v) => setSpeed(Number(v))} />
      )}
      <Fold label="other song" start={false}>
        <button className="mini-btn ghost" onClick={swap}>pick another song</button>
      </Fold>
      <Credit>words from LRCLIB</Credit>
    </div>
  );
}
