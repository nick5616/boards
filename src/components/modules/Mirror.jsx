import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { useBoardContext } from "../board/BoardContext";
import { useImage } from "../../hooks/useEntries";
import { useLocalBlobUrl } from "../../hooks/useLocalBlob";
import { addEntry, compressImage, saveImage, deleteImage, loadImage } from "../../lib/data";
import { put, del as delLocal } from "../../lib/localMedia";
import { composeStrip, newStrip, withStrips, FRAMES } from "../../lib/photostrip";
import { hash } from "../Sticker";

// The css is used on the preview and baked into the canvas when snapping. It also tints the
// little lens swatches: a colourful patch seen through the same filter.
const FILTERS = [
  { id: "none", label: "plain", css: "" },
  { id: "bw", label: "b&w", css: "grayscale(1) contrast(1.1)" },
  { id: "sepia", label: "sepia", css: "sepia(.9) contrast(1.05)" },
  { id: "vampire", label: "vampire", css: "grayscale(.85) sepia(.3) hue-rotate(180deg) saturate(1.6) contrast(1.5) brightness(.9)" },
];
const cssFor = (id) => FILTERS.find((f) => f.id === id)?.css ?? "";
// What the shutter does, per mode: the dial, and the words under the button
const MODES = [
  { id: "photo", icon: "📷", label: "photo", sub: "one shot" },
  { id: "strip", icon: "🎞", label: "strip", sub: `${FRAMES} shots` },
  { id: "clip", icon: "🎥", label: "clip", sub: "silent video" },
];
const KEEP = 4; // snaps the mirror holds on to
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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
// nothing is saved unless you send it. A finished photo or strip is shown whole (never inside the
// oval) with a list of where it can go: a scrapbook or photo strips module on the board, a brand
// new one (made through the board context), or kept in the mirror as imageIds. Clips stay on this
// computer's shelf (lib/localMedia).
// Later: "show me" (live camera to a friend over P2P) would take the stream from streamRef.
export default function Mirror({ board, mod, setState }) {
  const { uid, toast } = useData();
  const ctx = useBoardContext(); // null when the mirror is shown outside a board
  const { filter = "none", mode = "photo", sendTo = {}, snaps = [], reels = [] } = mod.state;
  const scraps = board.modules.filter((m) => m.type === "scrapbook");
  const stripMods = board.modules.filter((m) => m.type === "photostrip");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const alive = useRef(true);
  const [on, setOn] = useState(false);
  const [denied, setDenied] = useState(null); // friendly reason the camera won't come on
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [camMenu, setCamMenu] = useState(false);
  const [count, setCount] = useState(0); // 3-2-1, or 0 when idle
  const [shot, setShot] = useState(0); // which frame of the strip is being taken (1-based), 0 when idle
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [held, setHeld] = useState(null); // { blob, url, kind, frames?, filter, at } waiting to be sent somewhere
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

  // Where a photo or strip can go, in the order they're listed. Strips can go to a photo strips
  // module (or a new one); both kinds can go to a scrapbook (a strip lands as one tall picture).
  const destsFor = (kind) => {
    const canMake = !!ctx?.createModule;
    return [
      ...(kind === "strip" && ctx ? stripMods.map((m) => ({ key: m.id, icon: "🎞", label: m.title, note: `${m.state.strips?.length ?? 0} strips` })) : []),
      ...scraps.map((m) => ({ key: m.id, icon: "📒", label: m.title, note: "scrapbook" })),
      ...(kind === "strip" && canMake ? [{ key: "new:photostrip", icon: "＋", label: "new photo strip", note: "starts a new module" }] : []),
      ...(canMake ? [{ key: "new:scrapbook", icon: "＋", label: "new scrapbook", note: "starts a new module" }] : []),
      { key: "keep", icon: "🪞", label: "keep it in the mirror", note: `holds the last ${KEEP}` },
    ];
  };

  const hold = (blob, kind, extra = {}) => {
    const opts = destsFor(kind);
    // The last choice for this kind, if it's still there
    const last = sendTo[kind];
    setHeld({ blob, kind, url: URL.createObjectURL(blob), filter, at: Date.now(), ...extra });
    setDest(opts.some((o) => o.key === last) ? last : opts[0].key);
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

  // 3-2-1 before each of four frames, like the booth at the mall. Each frame is kept on its
  // own (for a photo strips module) and stacked into one tall picture (for a scrapbook).
  const strip = async () => {
    const v = videoRef.current;
    if (!v || busy) return;
    setBusy(true);
    const frames = [];
    for (let i = 0; i < FRAMES; i++) {
      setShot(i + 1);
      for (let n = i === 0 ? 3 : 1; n > 0; n--) {
        setCount(n);
        await wait(800);
      }
      setCount(0);
      if (!streamRef.current || !videoRef.current) {
        setShot(0);
        return setBusy(false); // switched off mid-strip
      }
      const c = document.createElement("canvas");
      c.width = 480;
      c.height = 360;
      drawFrame(c.getContext("2d"), videoRef.current, 0, 0, 480, 360, cssFor(filter));
      frames.push(c);
      await flashIt();
      await wait(250);
    }
    setShot(0);
    const at = Date.now();
    hold(await toBlob(composeStrip(frames, at)), "strip", { at, frames: await Promise.all(frames.map(toBlob)) });
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
    const { kind } = held;
    try {
      let said;
      if (kind === "strip" && (dest === "new:photostrip" || stripMods.some((m) => m.id === dest))) {
        // Frames go in as pictures of their own
        const ids = [];
        for (const f of held.frames) ids.push(saveImage(uid, board.id, await compressImage(f)));
        const one = newStrip(ids, held.filter, held.at);
        if (dest === "new:photostrip") {
          ctx.createModule("photostrip", { near: mod.id, state: withStrips({ strips: [] }, [one]) });
          said = "started a new photo strip module";
        } else {
          ctx.onModules((ms) => ms.map((m) => (m.id === dest ? { ...m, state: withStrips(m.state, [one]) } : m)));
          said = `pinned on “${stripMods.find((m) => m.id === dest)?.title}”`;
        }
      } else {
        const imageId = saveImage(uid, board.id, await compressImage(held.blob));
        if (dest === "keep") {
          // The mirror only holds the last few; the ones pushed off are deleted
          [imageId, ...snaps].slice(KEEP).forEach((id) => deleteImage(uid, id));
          setState((s) => ({ ...s, snaps: [imageId, ...(s.snaps ?? [])].slice(0, KEEP) }));
          said = "kept in the mirror";
        } else {
          const into = dest === "new:scrapbook" ? ctx.createModule("scrapbook", { near: mod.id, title: "Snaps" }) : dest;
          addEntry(uid, { kind: "photo", boardId: board.id, moduleId: into, imageId, text: "" });
          said = dest === "new:scrapbook" ? "started a new scrapbook" : `stuck in “${scraps.find((m) => m.id === dest)?.title}”`;
        }
      }
      setState((s) => ({ ...s, sendTo: { ...s.sendTo, [kind]: dest } }));
      toast({ text: said });
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

  const setMode = (id) => setState((s) => ({ ...s, mode: id }));
  const shutter = mode === "strip" ? strip : mode === "clip" ? film : snap;
  const idle = on && !busy && !watching && (mode === "clip" || !recording);
  const caption = !on
    ? "switch the mirror on first"
    : watching
      ? "watching a clip"
      : shot
        ? `shot ${shot} of ${FRAMES}`
        : recording
          ? "stop"
          : mode === "strip"
            ? `start strip · ${FRAMES} shots`
            : mode === "clip"
              ? "record"
              : "snap";
  const options = held ? destsFor(held.kind) : [];

  return (
    <div className="mir">
      {held ? (
        // The booth's output slot: the whole picture, never cropped by the oval
        <div className={`mir-review ${held.kind}`}>
          <div className="mir-slot">
            <img className="mir-out" src={held.url} alt={held.kind === "strip" ? "your photo strip, all four frames" : "the picture you just took"} />
          </div>
          <div className="mir-send">
            <b>{held.kind === "strip" ? "your strip is ready" : "your photo is ready"}</b>
            <span>where should it go?</span>
            <div className="mir-dests" role="radiogroup" aria-label="Where it goes">
              {options.map((o) => (
                <button
                  key={o.key}
                  role="radio"
                  aria-checked={dest === o.key}
                  className={`${dest === o.key ? "on" : ""}${o.key.startsWith("new:") ? " new" : ""}`}
                  onClick={() => setDest(o.key)}
                >
                  <i>{o.icon}</i>
                  <span>{o.label}<small>{o.note}</small></span>
                </button>
              ))}
            </div>
            <div className="mir-send-go">
              <button className="mir-btn go" onClick={send}>
                {dest === "keep" ? "Keep it" : dest.startsWith("new:") ? "Start it" : "Send it"}
              </button>
              <button className="mir-btn" onClick={() => setHeld(null)}>Toss</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <button className={`mir-switch${on ? " on" : ""}`} role="switch" aria-checked={on} onClick={() => (on ? stop() : start())} disabled={busy}>
            <span className="mir-track"><i /></span>
            <b>{on ? "mirror is on" : "turn on the mirror"}</b>
          </button>

          <div className="mir-glass">
            <div className="mir-bulbs" aria-hidden="true">
              {Array.from({ length: 18 }, (_, i) => {
                const a = (i / 18) * Math.PI * 2;
                return <i key={i} className={on ? "lit" : ""} style={{ left: `${50 + 47 * Math.cos(a)}%`, top: `${50 + 47 * Math.sin(a)}%` }} />;
              })}
            </div>
            <div className="mir-oval">
              {watching ? (
                <ReelPlayer id={watching} />
              ) : on ? (
                <video ref={videoRef} className="mir-live" style={{ filter: cssFor(filter) || undefined }} autoPlay muted playsInline />
              ) : (
                <div className="mir-off">
                  {denied ? <p>{denied}</p> : <p>Your reflection is shy.<br />Flip the switch.</p>}
                </div>
              )}
              {count > 0 && <div className="mir-count">{count}</div>}
              {flash && <div className="mir-flash" />}
              {recording && <span className="mir-rec">● rec</span>}
            </div>
          </div>

          <div className="mir-modes" role="radiogroup" aria-label="What the shutter takes">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={mode === m.id}
                className={mode === m.id ? "on" : ""}
                disabled={busy || recording}
                onClick={() => setMode(m.id)}
              >
                <span>{m.icon} {m.label}</span>
                <small>{m.sub}</small>
              </button>
            ))}
          </div>

          <div className="mir-shutter">
            <button
              className={`mir-snapbtn${recording ? " rec" : ""}`}
              onClick={shutter}
              disabled={!(idle || recording)}
              aria-label={caption}
            >
              <i />
            </button>
            <span>{caption}</span>
            {watching && <button className="mir-btn" onClick={() => setWatching(null)}>Back to me</button>}
          </div>

          <div className="mir-lenses">
            <span className="mir-lens-name">lens · {FILTERS.find((f) => f.id === filter)?.label}</span>
            <div role="radiogroup" aria-label="Lens">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  role="radio"
                  aria-checked={filter === f.id}
                  className={filter === f.id ? "on" : ""}
                  title={f.label}
                  aria-label={f.label}
                  onClick={() => setState((s) => ({ ...s, filter: f.id }))}
                >
                  <i style={{ filter: f.css || undefined }} />
                </button>
              ))}
            </div>
            {devices.length > 1 && (
              <button className="mir-gear" onClick={() => setCamMenu((v) => !v)} aria-expanded={camMenu}>⚙ camera ▾</button>
            )}
          </div>
          {camMenu && devices.length > 1 && (
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
        </>
      )}

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
