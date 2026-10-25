import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { useLive } from "../../contexts/LiveContext";
import { useData } from "../../contexts/DataContext";
import RadioHeard from "./RadioHeard";
import { songLine } from "../../lib/nowplaying";
import { uid } from "../../utils/uid";
import {
  MAX_FAVS,
  MAX_HEARD,
  radioState,
  findStations,
  staticBurst,
  playStation,
  setRadioVolume,
  subscribe,
  radioSnap,
} from "../../lib/radio";

const LANGS = ["spanish", "french", "german", "italian", "portuguese", "japanese", "korean", "mandarin", "arabic", "russian"];

// A pocket transistor radio. The sound itself belongs to lib/radio (so it carries on
// across boards, with a ticket in the live dock); this card is the face: a dial
// with the found stations as tick marks, a knob, and six preset buttons.
export default function Radio({ board, mod, setState, expanded }) {
  const live = useLive();
  const { toast, uid: me } = useData();
  const s = radioState(mod.state);
  const running = !!s.startedAt;
  const id = `radio:${mod.id}`;
  const snap = useSyncExternalStore(subscribe, radioSnap);
  const mine = snap.modId === mod.id;
  const status = mine ? snap.status : "idle";

  const patch = (p) => setState((st) => ({ ...st, ...p }));

  // The directory: re-search a moment after you stop typing
  const [found, setFound] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let gone = false;
    setLoading(true);
    const t = setTimeout(() => {
      findStations({ lang: s.lang, query: s.query }).then(
        (r) => !gone && (setFound(r), setFailed(false), setLoading(false)),
        () => !gone && (setFound([]), setFailed(true), setLoading(false))
      );
    }, 400);
    return () => {
      gone = true;
      clearTimeout(t);
    };
  }, [s.lang, s.query]);

  // What the dial can reach: the search, plus wherever you're already tuned
  const dial = !s.station || found.some((f) => f.id === s.station.id) ? found : [s.station, ...found];
  const at = Math.max(0, dial.findIndex((d) => d.id === s.station?.id));

  // The needle runs ahead of the sound while you're turning the knob
  const [pos, setPos] = useState(at);
  useEffect(() => setPos(at), [at, dial.length]);
  const tuneTimer = useRef(null);
  useEffect(() => () => clearTimeout(tuneTimer.current), []);

  const tune = (st) => {
    patch({ station: st });
    if (running) playStation(mod.id, st, s.volume);
  };

  const turnTo = (i) => {
    if (!dial.length) return;
    const n = Math.max(0, Math.min(dial.length - 1, i));
    if (n === pos) return;
    setPos(n);
    staticBurst(0.14);
    clearTimeout(tuneTimer.current);
    tuneTimer.current = setTimeout(() => tune(dial[n]), 350);
  };

  const dialRef = useRef(null);
  const drag = (e) => {
    const r = dialRef.current.getBoundingClientRect();
    turnTo(Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (dial.length - 1)));
  };

  const power = () => {
    if (running) return live.stop(id, { log: true });
    const st = s.station ?? dial[0];
    if (!st) return;
    patch({ station: st });
    live.start({ kind: "radio", boardId: board.id, modId: mod.id });
    staticBurst();
    playStation(mod.id, st, s.volume);
  };

  // Dead air: say so, skip along the dial, and give up if the whole dial is static
  const misses = useRef(0);
  useEffect(() => {
    if (status === "on") misses.current = 0;
    if (status !== "dead" || !running) return;
    misses.current++;
    staticBurst(0.4);
    if (misses.current >= Math.min(5, dial.length)) {
      toast({ text: "nothing but static tonight, try another language" });
      live.stop(id, { log: false });
      return;
    }
    toast({ text: "only static on this one" });
    if (dial.length > 1) tune(dial[(at + 1) % dial.length]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Reloaded mid-listen: the switch says on, but the sound needs a fresh touch
  const resume = () => s.station && playStation(mod.id, s.station, s.volume);
  const silent = running && (!mine || snap.status === "idle");

  const isFav = !!s.station && s.favorites.some((f) => f.id === s.station.id);
  const toggleFav = () => {
    if (!s.station) return;
    if (isFav) return patch({ favorites: s.favorites.filter((f) => f.id !== s.station.id) });
    if (s.favorites.length >= MAX_FAVS) return toast({ text: "six presets only; tap one to let it go" });
    patch({ favorites: [...s.favorites, s.station] });
  };

  const station = s.station;

  // The song on now, and keeping it: the receipt holds the latest 50
  const song = mine ? snap.song : null;
  const line = song ? songLine(song) : "";
  const kept = !!song && s.heard.some((h) => h.title === song.title && h.artist === song.artist);
  const keep = () => {
    if (!song || kept) return;
    const h = { id: uid(), artist: song.artist, title: song.title, station: station?.name ?? "the radio", at: Date.now(), by: me };
    if (song.album) h.album = song.album;
    patch({ heard: [h, ...s.heard].slice(0, MAX_HEARD) });
  };

  const shown = dial[pos];
  const readout = loading
    ? "scanning…"
    : failed
      ? "can't reach the airwaves"
      : !dial.length
        ? "no stations here"
        : (shown?.name ?? "—");

  return (
    <div className={`rad${expanded ? " big" : ""}${running ? " on" : ""}`}>
      <div className="rad-case">
        <div className="rad-grille" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => <i key={i} />)}
        </div>

        <div
          ref={dialRef}
          className="rad-dial"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag(e);
          }}
          onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && drag(e)}
          title="Drag to tune"
        >
          {dial.map((d, i) => (
            <i
              key={d.id}
              className={`rad-tick${i === pos ? " sel" : ""}`}
              style={{ left: `${dial.length > 1 ? (i / (dial.length - 1)) * 100 : 50}%` }}
            />
          ))}
          <b
            className="rad-needle"
            style={{ left: `${dial.length > 1 ? (pos / (dial.length - 1)) * 100 : 50}%` }}
            aria-hidden="true"
          />
        </div>

        <div className="rad-read" aria-live="polite">
          {shown?.favicon && (
            <img src={shown.favicon} alt="" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
          )}
          <span>{readout}</span>
        </div>
        {mine && status === "on" && song && (
          <div className="rad-song">
            <div className="rad-marq" title={line} aria-label={`Now playing: ${line}`}>
              <span className="rad-marq-t" aria-hidden="true">
                <span>♪ {line}</span>
                <span>♪ {line}</span>
              </span>
            </div>
            <button className="mini-btn" onClick={keep} disabled={kept} aria-pressed={kept} title="Keep this song on the receipt">
              {kept ? "♥ kept" : "♡ keep"}
            </button>
          </div>
        )}
        {mine && status === "on" && !song && snap.asked && (
          <div className="rad-nosong">
            this station doesn't say what's playing
            {station?.homepage && (
              <>
                {" · "}
                <a href={station.homepage} target="_blank" rel="noreferrer">their website</a>
              </>
            )}
          </div>
        )}
        {shown && <div className="rad-sub">{[shown.country, status === "tuning" && mine && shown.id === station?.id ? "tuning…" : ""].filter(Boolean).join(" · ")}</div>}

        <div className="rad-controls">
          <button className="mini-btn" onClick={() => turnTo(pos - 1)} aria-label="Tune down" disabled={!dial.length}>◀</button>
          <div
            className="rad-knob"
            style={{ transform: `rotate(${pos * 24}deg)` }}
            role="slider"
            tabIndex={0}
            aria-label="Tuning"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, dial.length - 1)}
            aria-valuenow={pos}
            aria-valuetext={shown?.name}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowUp") (e.preventDefault(), turnTo(pos + 1));
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") (e.preventDefault(), turnTo(pos - 1));
            }}
          >
            <i />
          </div>
          <button className="mini-btn" onClick={() => turnTo(pos + 1)} aria-label="Tune up" disabled={!dial.length}>▶</button>
        </div>

        <div className="rad-go">
          <button className={`mini-btn rad-power${running ? " on" : ""}`} onClick={power} disabled={!running && !dial.length && !station}>
            {running ? "■ off & log" : "▶ switch on"}
          </button>
          <button className="mini-btn" onClick={toggleFav} disabled={!station} aria-pressed={isFav} title={isFav ? "Drop this preset" : "Keep as a preset"}>
            {isFav ? "★" : "☆"}
          </button>
        </div>
        {silent && (
          <button className="mini-btn rad-hint" onClick={resume}>tap to tune back in</button>
        )}

        <div className="rad-presets" role="group" aria-label="Presets">
          {Array.from({ length: MAX_FAVS }, (_, i) => {
            const f = s.favorites[i];
            return f ? (
              <button
                key={f.id}
                className={`rad-pre${f.id === station?.id ? " sel" : ""}`}
                onClick={() => (staticBurst(0.14), tune(f))}
                title={f.name}
              >
                {i + 1}
              </button>
            ) : (
              <span key={i} className="rad-pre empty" aria-hidden="true">{i + 1}</span>
            );
          })}
        </div>

        <input
          className="rad-vol"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={s.volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            setRadioVolume(v);
            patch({ volume: v });
          }}
          aria-label="Volume"
        />
      </div>

      <div className="rad-find">
        <select value={LANGS.includes(s.lang) ? s.lang : ""} onChange={(e) => patch({ lang: e.target.value })} aria-label="Language">
          {!LANGS.includes(s.lang) && <option value="">{s.lang || "any language"}</option>}
          {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <input
          value={s.query}
          onChange={(e) => patch({ query: e.target.value })}
          placeholder="search name…"
          aria-label="Search stations by name"
        />
      </div>

      <RadioHeard board={board} heard={s.heard} setHeard={(heard) => patch({ heard })} />

      {running && !expanded && (
        <button className="mini-btn ghost tmr-cancel" onClick={() => live.stop(id, { log: false })}>
          off, don't log
        </button>
      )}
    </div>
  );
}
