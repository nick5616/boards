import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { useBoardContext } from "../board/BoardContext";
import { getAudio } from "../../lib/audio";
import { getBlob, put, del, persist, saveAsFile } from "../../lib/localMedia";
import { audiosIn } from "../../lib/paste";

// A little wireless set for sound files: a lit round porthole where the sound draws itself as a
// ring while it plays, a nameplate, a row of speaker slots, one key to play or pause and a
// slider for the volume. Files dropped on a board come here by default (see lib/paste).
// The sound itself stays on this computer (lib/localMedia); the board keeps names and lengths.
// Volume is each screen's own.

const clock = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, "0")}`;
const volKey = (id) => `boards:snd-vol:${id}`;
const SIZE = 150; // the porthole's drawing, in css px
const SLOTS = 9;

// The porthole: the sound's shape bent round into a ring, the last few rings fading behind it,
// and (on a layer of its own) how far along it is, as a brass arc round the rim
function Scope({ analyser, playing, frac }) {
  const cv = useRef(null);
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.height = SIZE * dpr;
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mid = SIZE / 2;
    const R = SIZE * 0.3;
    const buf = analyser ? new Float32Array(analyser.fftSize) : null;
    const N = 128;
    let raf;

    const ring = (amp) => {
      g.beginPath();
      for (let k = 0; k <= N; k++) {
        const a = (k / N) * Math.PI * 2 - Math.PI / 2;
        // a little smoothing so the ring is a line, not a scribble
        const at = (j) => (buf ? buf[Math.floor((((k + j + N) % N) / N) * (buf.length - 1))] : 0);
        const v = (at(-1) + at(0) * 2 + at(1)) / 4;
        const r = R + v * amp;
        const x = mid + Math.cos(a) * r;
        const y = mid + Math.sin(a) * r;
        k ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.strokeStyle = "rgba(59, 36, 20, 0.88)";
      g.lineWidth = 2;
      g.lineJoin = "round";
      g.stroke();
    };
    const frame = () => {
      // fade what was there, so the rings before this one linger faintly
      g.globalCompositeOperation = "destination-out";
      g.fillStyle = "rgba(0, 0, 0, 0.32)";
      g.fillRect(0, 0, SIZE, SIZE);
      g.globalCompositeOperation = "source-over";
      analyser.getFloatTimeDomainData(buf);
      ring(SIZE * 0.24);
      raf = requestAnimationFrame(frame);
    };

    if (playing && analyser) frame();
    else {
      g.clearRect(0, 0, SIZE, SIZE);
      ring(0);
    }
    return () => cancelAnimationFrame(raf);
  }, [analyser, playing]);

  // The rim keeps up with the time while playing, on its own layer
  const rimCv = useRef(null);
  useEffect(() => {
    const c = rimCv.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.height = SIZE * dpr;
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, SIZE, SIZE);
    if (!frac) return;
    g.beginPath();
    g.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, frac));
    g.strokeStyle = "#b8893a";
    g.lineWidth = 3;
    g.lineCap = "round";
    g.stroke();
  }, [frac]);

  return (
    <>
      <canvas ref={cv} className="sb-scope" aria-hidden="true" />
      <canvas ref={rimCv} className="sb-scope" aria-hidden="true" />
    </>
  );
}

export default function SoundBox({ board, mod, setState, onPatch, expanded }) {
  const { uid, toast } = useData();
  const { readOnly } = useBoardContext() ?? {};
  const sounds = mod.state.sounds ?? [];
  const [cur, setCur] = useState(0);
  const sound = sounds[Math.min(cur, sounds.length - 1)] ?? null;

  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [gone, setGone] = useState(false); // this sound isn't on this computer
  const [analyser, setAnalyser] = useState(null);
  const [vol, setVol] = useState(() => {
    try {
      const v = Number(localStorage.getItem(volKey(mod.id)));
      return Number.isFinite(v) && localStorage.getItem(volKey(mod.id)) !== null ? v : 0.8;
    } catch {
      return 0.8;
    }
  });
  const [dropping, setDropping] = useState(false);
  const audio = useRef(null);
  const graph = useRef(null);
  const url = useRef(null);
  const file = useRef(null);
  const after = useRef(null); // what to do once the sound ends (the latest closure)

  // One player for the whole set; torn down with it
  useEffect(() => {
    const a = new Audio();
    audio.current = a;
    a.onended = () => after.current?.();
    a.onloadedmetadata = () => setDur(Number.isFinite(a.duration) ? a.duration : 0);
    return () => {
      a.pause();
      a.removeAttribute("src");
      if (url.current) URL.revokeObjectURL(url.current);
      try {
        graph.current?.src.disconnect();
        graph.current?.gain.disconnect();
      } catch {
        /* already gone */
      }
    };
  }, []);

  // Put the chosen sound in the player (playing on if it was)
  const want = useRef(false);
  useEffect(() => {
    const a = audio.current;
    setPos(0);
    setDur(sound?.dur ?? 0);
    setGone(false);
    if (!sound) {
      a.pause();
      a.removeAttribute("src");
      return setPlaying(false);
    }
    let live = true;
    getBlob(sound.id).then((blob) => {
      if (!live) return;
      if (!blob) {
        setGone(true);
        setPlaying(false);
        return;
      }
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(blob);
      a.src = url.current;
      if (want.current) a.play().then(() => setPlaying(true), () => setPlaying(false));
    });
    return () => {
      live = false;
    };
  }, [sound?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remember how long a sound is, the first time anyone hears it
  useEffect(() => {
    if (!dur || !sound || sound.dur || readOnly) return;
    setState((s) => ({ ...s, sounds: (s.sounds ?? []).map((x) => (x.id === sound.id ? { ...x, dur: Math.round(dur * 10) / 10 } : x)) }));
  }, [dur, sound?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setPos(audio.current.currentTime), 200);
    return () => clearInterval(t);
  }, [playing]);

  // Volume: through the set's own knob once the sound runs through it, else the player's
  useEffect(() => {
    if (graph.current) {
      graph.current.gain.gain.value = vol;
      audio.current.volume = 1;
    } else if (audio.current) audio.current.volume = vol;
    try {
      localStorage.setItem(volKey(mod.id), String(vol));
    } catch {
      /* it just starts at the usual loudness next time */
    }
  }, [vol, mod.id]);

  // The sound runs through the shared sound-maker so the porthole can see it. Only after a
  // touch (browsers' rule), and only once per player.
  const wire = () => {
    if (graph.current) return;
    const ctx = getAudio();
    if (!ctx) return;
    try {
      const src = ctx.createMediaElementSource(audio.current);
      const gain = ctx.createGain();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      gain.gain.value = vol;
      audio.current.volume = 1;
      src.connect(gain).connect(an).connect(ctx.destination);
      graph.current = { src, gain };
      setAnalyser(an);
    } catch {
      /* it still plays, just without the picture */
    }
  };

  after.current = () => {
    if (cur < sounds.length - 1) {
      want.current = true;
      setCur(cur + 1);
    } else {
      want.current = false;
      setPlaying(false);
      setPos(0);
    }
  };

  const toggle = () => {
    const a = audio.current;
    if (!sound || gone) return;
    if (playing) {
      a.pause();
      want.current = false;
      return setPlaying(false);
    }
    wire();
    want.current = true;
    a.play().then(() => setPlaying(true), () => setPlaying(false));
  };

  const seek = (s) => {
    audio.current.currentTime = s;
    setPos(s);
  };

  const pick = (k) => {
    want.current = playing;
    setCur(k);
  };

  // Sound files in: onto this computer's shelf, names onto the board
  const take = async (files) => {
    const got = audiosIn(files);
    if (!got.length) return toast({ text: "that isn't a sound file" });
    persist();
    const added = [];
    for (const f of got) {
      const id = await put(f, { boardId: board.id, modId: mod.id, meta: { name: f.name } });
      if (id) added.push({ id, name: f.name.replace(/\.\w+$/, ""), type: f.type, size: f.size, at: Date.now(), by: uid });
    }
    if (!added.length) return toast({ text: "couldn't keep that sound on this computer" });
    setState((s) => ({ ...s, sounds: [...(s.sounds ?? []), ...added] }));
    if (!sounds.length) {
      setCur(0);
      if (!mod.named && added.length === 1) onPatch?.({ title: added[0].name });
    }
  };

  const remove = (x) => {
    if (!confirm(`Take “${x.name}” out of the set?`)) return;
    const k = sounds.indexOf(x);
    if (k === cur) {
      audio.current.pause();
      setPlaying(false);
      want.current = false;
    }
    if (k < cur) setCur(cur - 1);
    // the same bytes may be in another set on this board; only clear the shelf if not
    const elsewhere = board.modules.some((m) => m.type === "soundbox" && m.id !== mod.id && (m.state.sounds ?? []).some((y) => y.id === x.id));
    if (!elsewhere) del(x.id);
    setState((s) => ({ ...s, sounds: (s.sounds ?? []).filter((y) => y.id !== x.id) }));
  };

  const drop = readOnly
    ? {}
    : {
        onDragOver: (e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          e.stopPropagation();
          setDropping(true);
        },
        onDragLeave: (e) => !e.currentTarget.contains(e.relatedTarget) && setDropping(false),
        onDrop: (e) => {
          setDropping(false);
          if (!e.dataTransfer.files?.length) return;
          e.preventDefault();
          e.stopPropagation();
          take(e.dataTransfer.files);
        },
      };

  const length = dur || sound?.dur || 0;
  const frac = length ? pos / length : 0;
  const plate = !sound ? "no sound in it yet" : gone ? "on the computer it came from" : sound.name;

  return (
    <div className={`sb${expanded ? " big" : ""}${dropping ? " dropping" : ""}`} {...drop}>
      <div className={`sb-set${playing ? " on" : ""}`}>
        <div className="sb-port">
          <Scope analyser={analyser} playing={playing} frac={frac} />
        </div>
        <div className="sb-plate" title={sound?.name}>
          <b>{plate}</b>
          {sound && !gone && <span>{clock(pos)} / {clock(length)}</span>}
        </div>
        <div className="sb-grille" aria-hidden="true">
          {Array.from({ length: SLOTS }, (_, k) => <i key={k} />)}
        </div>
        <div className="sb-keys">
          <button className="sb-play" onClick={toggle} disabled={!sound || gone} aria-label={playing ? "Pause" : "Play"}>
            {playing ? (
              <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3" width="3" height="10" rx="0.6" /><rect x="9.5" y="3" width="3" height="10" rx="0.6" /></svg>
            ) : (
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" /></svg>
            )}
          </button>
          <label className="sb-vol">
            <span aria-hidden="true">vol</span>
            <input type="range" min="0" max="1" step="0.01" value={vol} onChange={(e) => setVol(Number(e.target.value))} aria-label="Volume" />
          </label>
        </div>
        <div className="sb-feet" aria-hidden="true"><i /><i /></div>
      </div>

      {!expanded && !sounds.length && !readOnly && (
        <button className="mini-btn ghost sb-load" onClick={() => file.current.click()}>load a sound</button>
      )}
      {!expanded && sounds.length > 1 && (
        <div className="sb-count">{cur + 1} of {sounds.length}</div>
      )}

      {expanded && (
        <div className="sb-more">
          {sound && !gone && (
            <input className="sb-seek" type="range" min="0" max={length || 0} step="0.1" value={Math.min(pos, length)} onChange={(e) => seek(Number(e.target.value))} aria-label="Position" />
          )}
          <ul className="sb-list">
            {sounds.map((x, k) => (
              <li key={x.id} className={k === cur ? "on" : ""}>
                <button className="sb-pick" onClick={() => pick(k)} aria-current={k === cur}>
                  <span className="sb-n">{k + 1}</span>
                  <span className="sb-name">{x.name}</span>
                  <span className="sb-len">{x.dur ? clock(x.dur) : ""}</span>
                </button>
                <button className="tp-chip" onClick={() => saveAsFile(x.id, x.name)} title="Save as a file" aria-label={`Save ${x.name}`}>⤓</button>
                {!readOnly && <button className="x-btn" onClick={() => remove(x)} aria-label={`Take out ${x.name}`}>✕</button>}
              </li>
            ))}
          </ul>
          {!readOnly && <button className="mini-btn ghost" onClick={() => file.current.click()}>+ add sound files</button>}
          <p className="sb-note">sound files stay on the computer they were added from; drop more on the set to queue them</p>
        </div>
      )}
      <input
        ref={file}
        type="file"
        accept="audio/*"
        multiple
        hidden
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
