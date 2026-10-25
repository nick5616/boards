import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { useImage } from "../../hooks/useEntries";
import { useLocalBlobUrl } from "../../hooks/useLocalBlob";
import { addEntry, compressImage, saveImage, deleteImage, loadImage } from "../../lib/data";
import { put, del as delLocal } from "../../lib/localMedia";
import { hash } from "../Sticker";

// The css is used on the preview and baked into the canvas when snapping
const FILTERS = [
  { id: "none", label: "plain", css: "" },
  { id: "bw", label: "b&w", css: "grayscale(1) contrast(1.1)" },
  { id: "sepia", label: "sepia", css: "sepia(.9) contrast(1.05)" },
  { id: "vampire", label: "vampire", css: "grayscale(.85) sepia(.3) hue-rotate(180deg) saturate(1.6) contrast(1.5) brightness(.9)" },
];
const cssFor = (id) => FILTERS.find((f) => f.id === id)?.css ?? "";
const KEEP = 4; // snaps the mirror holds on to
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
const toBlob = (c) => new Promise((r) => c.toBlob(r, "image/jpeg", 0.88));

// Centre-crops the live frame to the box's shape onto a canvas, filter and all
function drawFrame(ctx, video, x, y, w, h, filter) {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const want = w / h;
  let sw = vw;
  let sh = vw / want;
  if (sh > vh) {
    sh = vh;
    sw = vh * want;
  }
  ctx.save();
  ctx.filter = filter || "none";
  ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, x, y, w, h);
  ctx.restore();
}

// A small keepsake along the mirror's edge
function Snap({ id, onOpen, onToss }) {
  const { uid } = useData();
  const src = useImage(uid, id);
  const rot = ((hash(id) % 9) - 4) * 1.2;
  return (
    <figure className="mir-snap" style={{ transform: `rotate(${rot}deg)` }}>
      <button className="x-btn" onClick={onToss} aria-label="Toss this snap">✕</button>
      <button className="mir-snap-img" onClick={onOpen} aria-label="Send this snap somewhere">
        {src ? <img src={src} alt="" draggable={false} /> : null}
      </button>
    </figure>
  );
}

// One little film reel: click to watch it in the mirror
function Reel({ reel, on, onPlay, onToss }) {
  return (
    <span className={`mir-reel${on ? " on" : ""}`}>
      <button onClick={onPlay} title={`${Math.round(reel.secs)}s clip, on this computer`}>
        <i /><i />
        <small>{Math.round(reel.secs)}s</small>
      </button>
      <button className="mir-reel-x" onClick={onToss} aria-label="Toss this clip">✕</button>
    </span>
  );
}

function ReelPlayer({ id }) {
  const url = useLocalBlobUrl(id);
  return url ? <video className="mir-held" src={url} controls autoPlay playsInline /> : <div className="mir-off" />;
}

// Vanity mirror + photo booth. The camera only runs while the mirror is switched on and in view;
// nothing is saved unless you snap. Snaps go to a scrapbook on the board as pictures (the same
// road a pasted photo takes) or stay in the mirror as imageIds; clips stay on this computer's
// shelf (lib/localMedia).
// Later: "show me" (live camera to a friend over P2P) would take the stream from streamRef.
export default function Mirror({ board, mod, setState }) {
  const { uid, toast } = useData();
  const { filter = "none", snaps = [], reels = [] } = mod.state;
  const scraps = board.modules.filter((m) => m.type === "scrapbook");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const alive = useRef(true);
  const [on, setOn] = useState(false);
  const [denied, setDenied] = useState(null); // friendly reason the camera won't come on
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [count, setCount] = useState(0); // 3-2-1, or 0 when idle
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [held, setHeld] = useState(null); // { blob, url, kind } waiting to be sent somewhere
  const [dest, setDest] = useState("");
  const [recording, setRecording] = useState(false);
  const [watching, setWatching] = useState(null); // reel id

  const stop = () => {
    if (recRef.current?.state === "recording") recRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOn(false);
  };

  const start = async (id = deviceId) => {
    setDenied(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: id ? { deviceId: { exact: id } } : { facingMode: "user", width: { ideal: 1280 } },
        audio: false,
      });
      if (!alive.current) return stream.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      setDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? id);
      setOn(true);
      // Device names only show up once permission is given
      setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput"));
    } catch (e) {
      setOn(false);
      setDenied(
        e?.name === "NotAllowedError" || e?.name === "SecurityError"
          ? "The mirror can't see you: the camera is turned off for this page. Allow it in the address bar, then try again."
          : e?.name === "NotFoundError" || e?.name === "OverconstrainedError"
            ? "No camera found. Plug one in and try again."
            : "The camera is busy or won't start. Close whatever else is using it and try again."
      );
    }
  };

  // The <video> comes and goes (held photo, playback), so hook the stream up whenever it's back
  useEffect(() => {
    const v = videoRef.current;
    if (on && v && streamRef.current && v.srcObject !== streamRef.current) v.srcObject = streamRef.current;
  });

  // Off when the mirror goes away or the tab is hidden
  useEffect(() => {
    alive.current = true;
    const hide = () => document.hidden && stop();
    document.addEventListener("visibilitychange", hide);
    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", hide);
      if (recRef.current?.state === "recording") recRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const hold = (blob, kind) => {
    setHeld({ blob, kind, url: URL.createObjectURL(blob) });
    setDest(scraps[0]?.id ?? "keep");
  };
  useEffect(() => () => held && URL.revokeObjectURL(held.url), [held]);

  const flashIt = async () => {
    setFlash(true);
    await wait(180);
    setFlash(false);
  };

  const snap = async () => {
    const v = videoRef.current;
    if (!v || busy) return;
    setBusy(true);
    const c = document.createElement("canvas");
    c.width = 960;
    c.height = 720;
    drawFrame(c.getContext("2d"), v, 0, 0, 960, 720, cssFor(filter));
    flashIt();
    hold(await toBlob(c), "photo");
    setBusy(false);
  };

  // 3-2-1 before each of four frames, stacked like the booth at the mall
  const strip = async () => {
    const v = videoRef.current;
    if (!v || busy) return;
    setBusy(true);
    const W = 360, H = 270, P = 20, FOOT = 44;
    const c = document.createElement("canvas");
    c.width = W + P * 2;
    c.height = P + 4 * (H + P) + FOOT;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 4; i++) {
      for (let n = i === 0 ? 3 : 1; n > 0; n--) {
        setCount(n);
        await wait(800);
      }
      setCount(0);
      if (!streamRef.current) return setBusy(false); // switched off mid-strip
      drawFrame(ctx, videoRef.current, P, P + i * (H + P), W, H, cssFor(filter));
      await flashIt();
      await wait(250);
    }
    ctx.fillStyle = "#8a8280";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(stamp(), c.width / 2, c.height - 16);
    hold(await toBlob(c), "strip");
    setBusy(false);
  };

  // Silent on purpose: no microphone, so no second permission prompt
  const film = () => {
    if (recRef.current?.state === "recording") return recRef.current.stop();
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") return toast({ text: "this browser can't record video" });
    const chunks = [];
    const rec = new MediaRecorder(stream);
    const t0 = Date.now();
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      setRecording(false);
      const secs = (Date.now() - t0) / 1000;
      const id = await put(new Blob(chunks, { type: rec.mimeType || "video/webm" }), { boardId: board.id, modId: mod.id, meta: { secs } });
      if (!id) return toast({ text: "couldn't keep that clip on this computer" });
      setState((s) => ({ ...s, reels: [{ id, secs, at: t0 }, ...(s.reels ?? [])] }));
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const send = async () => {
    if (!held) return;
    try {
      const imageId = saveImage(uid, board.id, await compressImage(held.blob));
      if (dest === "keep") {
        // The mirror only holds the last few; the ones pushed off are deleted
        [imageId, ...snaps].slice(KEEP).forEach((id) => deleteImage(uid, id));
        setState((s) => ({ ...s, snaps: [imageId, ...(s.snaps ?? [])].slice(0, KEEP) }));
        toast({ text: "kept in the mirror" });
      } else {
        addEntry(uid, { kind: "photo", boardId: board.id, moduleId: dest, imageId, text: "" });
        toast({ text: `stuck in “${scraps.find((m) => m.id === dest)?.title}”` });
      }
      setHeld(null);
    } catch {
      toast({ text: "couldn't save that picture" });
    }
  };

  // Tapping a keepsake picks it back up so it can go to a scrapbook (as a copy)
  const reopen = async (id) => {
    const data = await loadImage(uid, id);
    if (data) hold(await (await fetch(data)).blob(), "photo");
  };
  const tossSnap = (id) => {
    deleteImage(uid, id);
    setState((s) => ({ ...s, snaps: (s.snaps ?? []).filter((x) => x !== id) }));
  };
  const tossReel = (r) => {
    delLocal(r.id);
    setState((s) => ({ ...s, reels: (s.reels ?? []).filter((x) => x.id !== r.id) }));
    if (watching === r.id) setWatching(null);
  };

  return (
    <div className="mir">
      <div className="mir-glass">
        <div className="mir-bulbs" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => {
            const a = (i / 18) * Math.PI * 2;
            return <i key={i} className={on ? "lit" : ""} style={{ left: `${50 + 47 * Math.cos(a)}%`, top: `${50 + 47 * Math.sin(a)}%` }} />;
          })}
        </div>
        <div className="mir-oval">
          {held ? (
            <img className="mir-held" src={held.url} alt="the picture you just took" />
          ) : watching ? (
            <ReelPlayer id={watching} />
          ) : on ? (
            <video ref={videoRef} className="mir-live" style={{ filter: cssFor(filter) || undefined }} autoPlay muted playsInline />
          ) : (
            <div className="mir-off">
              {denied ? <p>{denied}</p> : <p>Your reflection is shy.<br />Switch the mirror on.</p>}
            </div>
          )}
          {count > 0 && <div className="mir-count">{count}</div>}
          {flash && <div className="mir-flash" />}
          {recording && <span className="mir-rec">● rec</span>}
        </div>
      </div>

      {held ? (
        <div className="mir-send">
          <span>{held.kind === "strip" ? "photo strip" : "photo"} · send to</span>
          <select value={dest} onChange={(e) => setDest(e.target.value)}>
            {scraps.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            <option value="keep">keep it in the mirror</option>
          </select>
          <button className="mir-btn go" onClick={send}>Send</button>
          <button className="mir-btn" onClick={() => setHeld(null)}>Toss</button>
        </div>
      ) : (
        <div className="mir-bar">
          <button className={`mir-btn${on ? "" : " go"}`} onClick={() => (on ? stop() : start())} disabled={busy}>
            {on ? "Switch off" : "Switch on"}
          </button>
          {on && (
            <>
              <button className="mir-btn" onClick={snap} disabled={busy || recording || !!watching}>Snap</button>
              <button className="mir-btn" onClick={strip} disabled={busy || recording || !!watching}>Strip</button>
              <button className="mir-btn" onClick={film} disabled={busy}>{recording ? "Stop" : "Film"}</button>
            </>
          )}
          {watching && <button className="mir-btn" onClick={() => setWatching(null)}>Back to me</button>}
        </div>
      )}

      <div className="mir-chips">
        {FILTERS.map((f) => (
          <button key={f.id} className={filter === f.id ? "on" : ""} onClick={() => setState((s) => ({ ...s, filter: f.id }))}>
            {f.label}
          </button>
        ))}
        {devices.length > 1 && (
          <select
            className="mir-cam"
            value={deviceId}
            onChange={(e) => {
              setDeviceId(e.target.value);
              start(e.target.value);
            }}
            aria-label="Camera"
          >
            {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
          </select>
        )}
      </div>

      {(snaps.length > 0 || reels.length > 0) && (
        <div className="mir-shelf">
          {snaps.map((id) => <Snap key={id} id={id} onOpen={() => reopen(id)} onToss={() => tossSnap(id)} />)}
          {reels.map((r) => (
            <Reel key={r.id} reel={r} on={watching === r.id} onPlay={() => setWatching(watching === r.id ? null : r.id)} onToss={() => tossReel(r)} />
          ))}
        </div>
      )}
      {reels.length > 0 && <small className="mir-note">clips live on this computer only</small>}
    </div>
  );
}
