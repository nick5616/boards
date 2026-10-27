import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { useData } from "../../contexts/DataContext";
import { useLive } from "../../contexts/LiveContext";
import { del as delLocal, saveAsFile } from "../../lib/localMedia";
import {
  EVERY, FOR_MINS, everyLabel, forLabel, MAX_FRAMES,
  startCapture, stopCapture, isCapturing, captureInfo, subscribe, snapshot,
  listCameras, cameraTrouble, loadBitmaps, paintFrame, makeMovie, canMakeMovie,
} from "../../lib/timelapse";

const FPS = [4, 8, 12, 24];
const clock = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
// "+2h 10m" since the first frame
const since = (ms) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `+${m}m` : `+${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};
const stamp = (t) => new Date(t).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });

// A little camera on a tripod. Pick a camera, how often and for how long, and it takes a
// small picture every so often (the live dock keeps it going across boards; the pictures
// stay on this computer). Then flip through them like a flipbook, drag the rise line to mark
// where the dough started, and save the lot as a movie.
export default function TimeLapse({ board, mod, setState }) {
  const { toast, updateBoard } = useData();
  const live = useLive();
  const { deviceId = "", every = 60, mins = 240, frames = [], rise = null, fps = 8 } = mod.state;
  const key = mod.id;
  useSyncExternalStore(subscribe, snapshot);
  const running = isCapturing(key);
  const info = captureInfo(key);

  const [now, setNow] = useState(Date.now);
  const [pos, setPos] = useState(0); // which frame the flipbook shows
  const [follow, setFollow] = useState(true); // stay on the newest frame
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(0); // bumps when more bitmaps are in
  const [cams, setCams] = useState([]);
  const [trouble, setTrouble] = useState(null);
  const [peek, setPeek] = useState(false); // live preview, to aim the camera
  const [making, setMaking] = useState(null); // 0..1 while a movie is being made
  const bmps = useRef(new Map()); // frame id → bitmap
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const peekStream = useRef(null);
  const screenRef = useRef(null);
  const cancel = useRef({ cancelled: false });
  const upd = useRef(updateBoard);
  upd.current = updateBoard;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  // New frames are loaded off the shelf as they appear
  const ids = frames.map((f) => f.id).join(",");
  useEffect(() => {
    const need = frames.filter((f) => !bmps.current.has(f.id));
    if (!need.length) return setLoaded((n) => n + 1);
    let gone = false;
    loadBitmaps(need.map((f) => f.id)).then((out) => {
      if (gone) return;
      need.forEach((f, i) => out[i] && bmps.current.set(f.id, out[i]));
      setLoaded((n) => n + 1);
    });
    return () => { gone = true; };
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const here = frames.filter((f) => bmps.current.has(f.id)); // frames this computer actually has
  const shown = here[Math.min(pos, here.length - 1)];
  useEffect(() => {
    if (follow && here.length) setPos(here.length - 1);
  }, [here.length, follow]); // eslint-disable-line react-hooks/exhaustive-deps

  // The flipbook
  useEffect(() => {
    if (!playing || here.length < 2) return;
    const t = setInterval(() => setPos((p) => (p + 1) % here.length), 1000 / fps);
    return () => clearInterval(t);
  }, [playing, fps, here.length]);

  // Paint the shown frame
  const first = bmps.current.get(frames.find((f) => bmps.current.has(f.id))?.id);
  useEffect(() => {
    const c = canvasRef.current;
    const bmp = shown && bmps.current.get(shown.id);
    if (!c || !bmp) return;
    if (c.width !== bmp.width) (c.width = bmp.width, (c.height = bmp.height));
    paintFrame(c.getContext("2d"), bmp, c.width, c.height);
  }, [shown?.id, loaded, peek]); // eslint-disable-line react-hooks/exhaustive-deps

  // The aiming preview: only while asked for, never while a capture holds the camera
  const stopPeek = () => {
    peekStream.current?.getTracks().forEach((t) => t.stop());
    peekStream.current = null;
    setPeek(false);
  };
  const startPeek = async (id = deviceId) => {
    setTrouble(null);
    peekStream.current?.getTracks().forEach((t) => t.stop());
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: id ? { deviceId: { exact: id } } : { width: { ideal: 1280 } }, audio: false });
      peekStream.current = s;
      setPeek(true);
      setCams(await listCameras());
    } catch (e) {
      setTrouble(cameraTrouble(e));
    }
  };
  useEffect(() => {
    const v = videoRef.current;
    if (peek && v && peekStream.current && v.srcObject !== peekStream.current) v.srcObject = peekStream.current;
  });
  useEffect(() => {
    const hide = () => document.hidden && peekStream.current && stopPeek();
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      peekStream.current?.getTracks().forEach((t) => t.stop());
      cancel.current.cancelled = true;
    };
  }, []);

  // Frames go into the module through the board, not this card's setState, so a capture
  // carries on adding them after you've left the board.
  const addFrame = (f) =>
    upd.current(board.id, (b) => ({
      ...b,
      modules: b.modules.map((m) =>
        m.id === mod.id ? { ...m, state: { ...m.state, frames: [...(m.state.frames ?? []), f].slice(-MAX_FRAMES) } } : m
      ),
    }));

  const start = async () => {
    stopPeek();
    setTrouble(null);
    const sid = `timelapse:${mod.id}`;
    const r = await startCapture({
      key,
      deviceId,
      every,
      mins,
      boardId: board.id,
      modId: mod.id,
      onFrame: (f) => {
        addFrame(f);
        live.update(sid, { label: `time-lapse · ${captureInfo(key)?.count ?? 0} frames` });
      },
      onEnd: (why) => {
        live.stop(sid);
        if (why === "done") toast({ text: "time-lapse finished ✓ — flip through it" });
        if (why === "lost") toast({ text: "the camera went away, so the time-lapse stopped" });
      },
    });
    if (!r.ok) return setTrouble(r.why);
    setFollow(true);
    setPlaying(false);
    live.start({
      id: sid,
      kind: "timelapse",
      boardId: board.id,
      modId: mod.id,
      icon: "📷",
      label: "time-lapse",
      endsAt: Date.now() + mins * 60000,
      onStop: () => stopCapture(key, "stopped"),
    });
    setCams(await listCameras());
  };

  const clear = () => {
    if (running) return;
    frames.forEach((f) => delLocal(f.id));
    bmps.current.clear();
    setState((s) => ({ ...s, frames: [] }));
    setPos(0);
    setPlaying(false);
  };

  const patch = (p) => setState((s) => ({ ...s, ...p }));

  // Drag the rise line: a fraction of the picture's height
  const dragRise = (e) => {
    const box = screenRef.current.getBoundingClientRect();
    const move = (ev) => patch({ rise: Math.max(0.02, Math.min(0.98, (ev.clientY - box.top) / box.height)) });
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const movie = async () => {
    const list = here.map((f) => bmps.current.get(f.id));
    if (!list.length || making != null) return;
    setPlaying(false);
    cancel.current.cancelled = false;
    setMaking(0);
    const blob = await makeMovie(list, {
      fps,
      signal: cancel.current,
      onProgress: setMaking,
      after: (ctx, w, h, i) => {
        if (rise != null) {
          ctx.strokeStyle = "#ff5a4d";
          ctx.lineWidth = Math.max(2, w / 240);
          ctx.setLineDash([w / 40, w / 80]);
          ctx.beginPath();
          ctx.moveTo(0, rise * h);
          ctx.lineTo(w, rise * h);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = "rgba(0,0,0,.45)";
        ctx.fillRect(0, h - h / 11, w, h / 11);
        ctx.fillStyle = "#fff";
        ctx.font = `${Math.round(h / 20)}px sans-serif`;
        ctx.fillText(since(here[i].at - here[0].at), w / 40, h - h / 40);
      },
    });
    setMaking(null);
    if (!blob) return toast({ text: "couldn't make the movie here" });
    if (await saveAsFile(blob, `${mod.title || "time-lapse"}.webm`)) toast({ text: "movie saved ✓" });
  };

  const live_ = running && info;
  const left = live_ ? Math.max(0, info.nextAt - now) : 0;
  const aspect = first ? `${first.width} / ${first.height}` : "4 / 3";
  const missing = frames.length - here.length;

  return (
    <div className="tl">
      <div className="tl-cam">
        <span className={`tl-lamp${running ? " on" : ""}`} aria-hidden="true" />
        <i className="tl-shoe" aria-hidden="true" />
        <div className="tl-screen" ref={screenRef} style={{ aspectRatio: aspect }}>
          {peek ? (
            <video ref={videoRef} className="tl-live" autoPlay muted playsInline />
          ) : here.length ? (
            <canvas ref={canvasRef} className="tl-canvas" aria-label={`Frame ${pos + 1} of ${here.length}`} />
          ) : (
            <p className="tl-empty">
              {trouble ?? (frames.length ? "These frames are on another computer's shelf." : "Nothing yet. Point me at the dough, then press start.")}
            </p>
          )}
          {rise != null && (
            <button
              className="tl-rise"
              style={{ top: `${rise * 100}%` }}
              onPointerDown={dragRise}
              aria-label="Rise line: drag to the dough's starting height"
              title="drag me to where the dough started"
            >
              <span>start</span>
            </button>
          )}
          {running && <span className="tl-rec">● rec</span>}
          {shown && !peek && <span className="tl-stamp">{since(shown.at - here[0].at)} · {stamp(shown.at)}</span>}
        </div>
        <i className="tl-lens" aria-hidden="true" />
      </div>
      <div className="tl-legs" aria-hidden="true"><i /><i /><i /></div>

      {trouble && (peek || here.length > 0) && <p className="tl-trouble">{trouble}</p>}

      {running ? (
        <div className="tl-run">
          <b>{info.count} frame{info.count === 1 ? "" : "s"}</b>
          <span>next in {clock(left)} · done in {clock(info.endsAt - now)}</span>
          <button className="mini-btn" onClick={() => stopCapture(key, "stopped")}>■ stop</button>
        </div>
      ) : (
        <div className="tl-set">
          <div className="tl-row">
            <span>every</span>
            {EVERY.map((s) => (
              <button key={s} className={`tl-chip${s === every ? " sel" : ""}`} onClick={() => patch({ every: s })}>{everyLabel(s)}</button>
            ))}
          </div>
          <div className="tl-row">
            <span>for</span>
            {FOR_MINS.map((m) => (
              <button key={m} className={`tl-chip${m === mins ? " sel" : ""}`} onClick={() => patch({ mins: m })}>{forLabel(m)}</button>
            ))}
          </div>
          {cams.length > 1 && (
            <select className="tl-cam-pick" value={deviceId} onChange={(e) => { patch({ deviceId: e.target.value }); peek && startPeek(e.target.value); }} aria-label="Camera">
              <option value="">default camera</option>
              {cams.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
            </select>
          )}
          <div className="tl-row go">
            <button className="mini-btn" onClick={() => (peek ? stopPeek() : startPeek())}>{peek ? "stop aiming" : "👁 aim camera"}</button>
            <button className="tl-start" onClick={start} aria-label="Start the time-lapse">
              <i />
              <span>start · {Math.floor((mins * 60) / every) + 1} frames</span>
            </button>
          </div>
        </div>
      )}

      {here.length > 0 && !peek && (
        <div className="tl-play">
          <div className="tl-row">
            <button className="mini-btn" onClick={() => setPlaying((p) => !p)} disabled={here.length < 2} aria-label={playing ? "Pause" : "Play"}>
              {playing ? "❚❚" : "▶"}
            </button>
            <input
              type="range"
              className="tl-scrub"
              min={0}
              max={Math.max(0, here.length - 1)}
              value={Math.min(pos, here.length - 1)}
              onChange={(e) => {
                setPlaying(false);
                setFollow(+e.target.value === here.length - 1);
                setPos(+e.target.value);
              }}
              aria-label="Scrub through the frames"
            />
            <small>{Math.min(pos, here.length - 1) + 1}/{here.length}</small>
          </div>
          <div className="tl-row">
            <span>speed</span>
            {FPS.map((f) => (
              <button key={f} className={`tl-chip${f === fps ? " sel" : ""}`} onClick={() => patch({ fps: f })}>{f}/s</button>
            ))}
            <button className={`tl-chip${rise != null ? " sel" : ""}`} onClick={() => patch({ rise: rise == null ? 0.7 : null })} title="a line to mark the dough's starting height">
              ┄ rise line
            </button>
          </div>
          <div className="tl-row">
            {canMakeMovie() ? (
              <button className="mini-btn" onClick={movie} disabled={making != null || running}>
                {making != null ? `making movie… ${Math.round(making * 100)}%` : "🎬 save as movie"}
              </button>
            ) : (
              <small>this browser can't make movies, but the frames are still here</small>
            )}
            {!running && <button className="mini-btn ghost" onClick={clear}>clear frames</button>}
          </div>
        </div>
      )}
      <small className="tl-note">
        {frames.length ? `${frames.length} frame${frames.length === 1 ? "" : "s"} · on this computer only${missing > 0 ? ` (${missing} on another)` : ""}` : "pictures stay on this computer"}
      </small>
    </div>
  );
}
