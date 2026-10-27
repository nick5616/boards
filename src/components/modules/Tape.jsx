import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { useLive } from "../../contexts/LiveContext";
import { getBlob, del, saveAsFile, persist } from "../../lib/localMedia";
import SendTo, { WireTag } from "../board/SendTo";
import { startRecording, stopRecording, finishTake, levelOf, deviceId } from "../../lib/tape";

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// A cassette: the two reels turn while it records or plays
function Cassette({ spinning, label }) {
  return (
    <svg className={`tp-cassette${spinning ? " spin" : ""}`} viewBox="0 0 160 100" aria-hidden="true">
      <rect x="3" y="3" width="154" height="94" rx="8" className="tp-shell" />
      <rect x="14" y="10" width="132" height="44" rx="4" className="tp-label" />
      <rect x="14" y="10" width="132" height="9" className="tp-stripe" />
      <text x="80" y="40" textAnchor="middle" className="tp-title">{label}</text>
      <rect x="44" y="58" width="72" height="28" rx="14" className="tp-window" />
      {[56, 104].map((cx) => (
        <g key={cx} className="tp-reel" style={{ transformOrigin: `${cx}px 72px` }}>
          <circle cx={cx} cy="72" r="10" className="tp-hub" />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <path key={a} d={`M${cx} 72 L${cx} 64`} transform={`rotate(${a} ${cx} 72)`} className="tp-spoke" />
          ))}
        </g>
      ))}
      <path d="M30 97 L40 86 H120 L130 97" className="tp-base" />
    </svg>
  );
}

// The loudness shape of a take. Click or drag to scrub.
function Wave({ peaks, frac, onSeek, label }) {
  const seek = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };
  return (
    <svg
      className="tp-wave"
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      role="slider"
      aria-label={label}
      aria-valuenow={Math.round(frac * 100)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        seek(e);
      }}
      onPointerMove={(e) => e.buttons && seek(e)}
    >
      {peaks.map((p, i) => {
        const h = Math.max(1.5, p * 22);
        return <rect key={i} x={i} y={12 - h / 2} width="0.7" height={h} className={i / peaks.length < frac ? "on" : ""} />;
      })}
    </svg>
  );
}

// Tape recorder: record into the cassette, keep takes, compare two of them.
// The sound itself stays on this computer (see lib/localMedia); the board only
// ever holds each take's name, length and waveform.
export default function Tape({ board, mod, setState, expanded }) {
  const data = useData();
  const live = useLive();
  const { uid } = data;
  const { takes = [], music = true } = mod.state;
  const sid = `tape:${mod.id}`;
  const session = live.sessions.find((s) => s.id === sid);
  const recording = !!session;

  const [tick, setTick] = useState(0);
  const [level, setLevel] = useState(0);
  const [cur, setCur] = useState(null); // the take that's loaded in the player
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [ab, setAb] = useState([]); // two take ids to flip between
  const [gone, setGone] = useState(() => new Set()); // takes whose sound isn't on this computer
  const audio = useRef(null);
  const url = useRef(null);
  const token = useRef(0);
  const me = deviceId();

  // Elapsed time and the level meter, only while recording
  useEffect(() => {
    if (!recording) return setLevel(0);
    let raf;
    const t = setInterval(() => setTick((n) => n + 1), 500);
    const loop = () => {
      setLevel((l) => Math.max(levelOf(mod.id), l * 0.85));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      clearInterval(t);
      cancelAnimationFrame(raf);
    };
  }, [recording, mod.id]);

  // Takes made on other computers: see if their sound happens to be here anyway
  useEffect(() => {
    let off = false;
    takes
      .filter((t) => t.dev !== me && !gone.has(t.id))
      .forEach((t) =>
        getBlob(t.id).then((b) => {
          if (!b && !off) setGone((g) => new Set(g).add(t.id));
        })
      );
    return () => {
      off = true;
    };
  }, [takes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // A take just arrived from someone over the peer bus: it's here now
  useEffect(() => {
    const arrived = (e) => setGone((g) => (g.has(e.detail.id) ? new Set([...g].filter((x) => x !== e.detail.id)) : g));
    window.addEventListener("boards:media", arrived);
    return () => window.removeEventListener("boards:media", arrived);
  }, []);

  // One player for the whole card; it's torn down with it
  useEffect(() => {
    const a = new Audio();
    audio.current = a;
    a.onended = () => {
      setPlaying(false);
      setPos(0);
    };
    return () => {
      token.current++; // a load still waiting on the shelf shouldn't start playing after we're gone
      a.pause();
      a.removeAttribute("src");
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setPos(audio.current.currentTime), 80);
    return () => clearInterval(t);
  }, [playing]);

  // Load a take and start from `at` seconds. Used for play, scrub and A/B.
  const load = async (id, at = 0, auto = true) => {
    const me = ++token.current;
    const blob = await getBlob(id);
    if (me !== token.current) return;
    if (!blob) {
      setGone((g) => new Set(g).add(id));
      return data.toast({ text: "that recording isn't on this computer" });
    }
    const a = audio.current;
    a.pause();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = URL.createObjectURL(blob);
    a.src = url.current;
    setCur(id);
    setPos(at);
    const go = () => {
      a.currentTime = at;
      if (auto) a.play().then(() => setPlaying(true), () => setPlaying(false));
      else setPlaying(false);
    };
    a.onloadedmetadata = () => {
      // A recording straight off the mic has no length written in; seeking to the end teaches the player
      if (a.duration === Infinity) {
        a.ontimeupdate = () => {
          a.ontimeupdate = null;
          go();
        };
        a.currentTime = 1e7;
      } else go();
    };
  };

  const toggle = (t) => {
    const a = audio.current;
    if (cur === t.id) {
      if (a.paused) a.play().then(() => setPlaying(true), () => {});
      else {
        a.pause();
        setPlaying(false);
      }
    } else load(t.id);
  };

  const seek = (t, frac) => {
    if (cur === t.id) {
      audio.current.currentTime = frac * t.dur;
      setPos(frac * t.dur);
    } else load(t.id, frac * t.dur, false);
  };

  const flip = () => {
    const to = ab.find((id) => id !== cur) ?? ab[0];
    const t = takes.find((x) => x.id === to);
    if (t) load(to, Math.min(pos, Math.max(0, t.dur - 0.1)), playing);
  };

  const pickAb = (id) => setAb((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));

  const start = async () => {
    persist(); // ask the browser to keep recordings, once
    audio.current?.pause();
    setPlaying(false);
    try {
      await startRecording(mod.id, {
        music,
        onDone: (blob, secs) => {
          live.stop(sid); // the recorder can end on its own (mic unplugged): clear its ticket from the dock
          return finishTake(data, { boardId: board.id, modId: mod.id, blob, secs, sendTo: mod.state.sendTo });
        },
      });
    } catch {
      return data.toast({ text: "couldn't open the microphone" });
    }
    live.start({
      id: sid,
      kind: "tape",
      boardId: board.id,
      modId: mod.id,
      label: "recording",
      icon: "🔴",
      onStop: () => stopRecording(mod.id),
    });
  };
  const stop = () => live.stop(sid);

  const patchTake = (id, patch) =>
    setState((s) => ({ ...s, takes: (s.takes ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)) }));

  const rename = (t) => {
    const name = prompt("Name this take", t.name)?.trim();
    if (name) patchTake(t.id, { name });
  };

  const remove = (t) => {
    if (!confirm(`Delete “${t.name}”?`)) return;
    if (cur === t.id) {
      audio.current.pause();
      setPlaying(false);
      setCur(null);
    }
    setAb((p) => p.filter((x) => x !== t.id));
    // Same bytes can sit in a copied module, so only clear the shelf when nothing else points at them
    const others = board.modules
      .filter((m) => m.type === "tape")
      .flatMap((m) => (m.state.takes ?? []).filter((x) => !(m.id === mod.id && x === t)));
    if (!others.some((x) => x.id === t.id)) del(t.id);
    setState((s) => ({ ...s, takes: (s.takes ?? []).filter((x) => x.id !== t.id) }));
  };

  const elapsed = session ? Math.max(0, Date.now() - session.startedAt) / 1000 : 0;
  void tick;
  const spinning = recording || playing;
  const shown = [...takes].sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || b.at - a.at);
  const ext = (t) => (t.type?.includes("mp4") ? "m4a" : t.type?.includes("ogg") ? "ogg" : "webm");

  return (
    <div className={`tp${expanded ? " big" : ""}`}>
      <Cassette spinning={spinning} label={recording ? "REC" : takes.length ? `${takes.length} take${takes.length === 1 ? "" : "s"}` : mod.title} />

      <div className="tp-deck">
        <button
          className={`tp-rec${recording ? " on" : ""}`}
          onClick={recording ? stop : start}
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          <i />
        </button>
        {recording ? (
          <div className="tp-meter" aria-label="Input level">
            <b style={{ width: `${Math.round(level * 100)}%` }} />
            <span>{clock(elapsed)}</span>
          </div>
        ) : (
          <button
            className={`mini-btn${music ? "" : " ghost"}`}
            aria-pressed={music}
            onClick={() => setState((s) => ({ ...s, music: !music }))}
            title="Music mode leaves the microphone alone (no noise-cancelling), voice cleans it up"
          >
            {music ? "♪ music mode" : "🗣 voice"}
          </button>
        )}
      </div>

      {ab.length === 2 && (
        <div className="tp-ab">
          <button className="mini-btn" onClick={flip}>
            ⇄ A/B
          </button>
          <span>
            now: <b>{cur === ab[0] ? "A" : cur === ab[1] ? "B" : "–"}</b> · same spot, flips mid-play
          </span>
        </div>
      )}

      <ul className="tp-takes">
        {shown.map((t) => {
          const missing = gone.has(t.id);
          const here = cur === t.id;
          const slot = ab.indexOf(t.id);
          return (
            <li
              key={t.id}
              className={`tp-take${here ? " cur" : ""}${missing ? " away" : ""}`}
              // Drag it onto a collaborator's face (board header) to pass it to their shelf
              draggable={!missing}
              onDragStart={(e) => {
                if (missing) return;
                e.dataTransfer.effectAllowed = "copy";
                e.dataTransfer.setData("application/x-boards-take", JSON.stringify({ id: t.id, name: t.name, boardId: board.id, modId: mod.id }));
              }}
            >
              {missing ? (
                <div className="tp-away">
                  <span aria-hidden="true">📼</span>
                  <b>{t.name}</b>
                  <em>{t.by && t.by !== uid ? "on someone else's computer: it comes over when you're both here" : "on another of your computers"}</em>
                  <button className="mini-btn" disabled title="It comes over by itself when you're both online on this board">
                    ▶
                  </button>
                </div>
              ) : (
                <>
                  <button className="tp-play" onClick={() => toggle(t)} aria-label={here && playing ? "Pause" : `Play ${t.name}`}>
                    {here && playing ? "❚❚" : "▶"}
                  </button>
                  <div className="tp-mid">
                    <button className="tp-name" onClick={() => rename(t)} title="Rename">
                      {t.name}
                    </button>
                    <Wave peaks={t.peaks} frac={here && t.dur ? Math.min(1, pos / t.dur) : 0} onSeek={(f) => seek(t, f)} label={`Position in ${t.name}`} />
                  </div>
                  <span className="tp-time">{here ? `${clock(pos)}/` : ""}{clock(t.dur)}</span>
                </>
              )}
              <div className="tp-acts">
                <button className={`tp-fav${t.fav ? " on" : ""}`} onClick={() => patchTake(t.id, { fav: !t.fav })} aria-pressed={!!t.fav} aria-label="Favorite">
                  {t.fav ? "★" : "☆"}
                </button>
                {!missing && (
                  <>
                    <button className={`tp-chip${slot >= 0 ? " on" : ""}`} onClick={() => pickAb(t.id)} title="Pick two takes to compare" aria-pressed={slot >= 0}>
                      {slot >= 0 ? "AB"[slot] : "A/B"}
                    </button>
                    <button className="tp-chip" onClick={() => saveAsFile(t.id, `${t.name}.${ext(t)}`)} title="Save as a file">
                      ⤓
                    </button>
                  </>
                )}
                <button className="x-btn" onClick={() => remove(t)} aria-label={`Delete ${t.name}`}>
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <WireTag board={board} mod={mod} />
      {!recording && <SendTo fold board={board} mod={mod} setState={setState} note="the minutes you record go there" />}
      {!takes.length && !recording && <p className="tp-empty">press the red button. recordings stay on this computer.</p>}
      {takes.length > 0 && <p className="tp-note">sound lives on the computer that recorded it</p>}
    </div>
  );
}
