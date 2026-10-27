import { useRef, useState, useEffect, useSyncExternalStore } from "react";
import { useData } from "../../contexts/DataContext";
import { useLive } from "../../contexts/LiveContext";
import { useImage } from "../../hooks/useEntries";
import { deleteImage } from "../../lib/data";
import { savePhotos, useImageIntake } from "../../lib/studio";
import { subscribe, gestureSnap, startGesture, togglePause, skip, finish, planFor, poseMs, clock, mix } from "../../lib/gesture";
import SendTo, { WireTag } from "../board/SendTo";

const SECS = [30, 60, 120, 300];
const COUNTS = [5, 10, 20];
const secLabel = (s) => (s >= 60 ? `${s / 60}m` : `${s}s`);

function Thumb({ id, onToss }) {
  const { uid } = useData();
  const src = useImage(uid, id);
  return (
    <span className="gst-thumb">
      {src ? <img src={src} alt="" draggable={false} /> : null}
      <button onClick={onToss} aria-label="Take this reference down" title="Take it down">✕</button>
    </span>
  );
}

// The sand runs out of the top bulb as the pose runs out
function Hourglass({ frac, running }) {
  const f = Math.max(0, Math.min(1, frac));
  return (
    <svg className="gst-glass" viewBox="0 0 40 64" aria-hidden="true">
      <defs>
        <clipPath id="gst-top"><path d="M9 8 h22 q0 14 -9 22 q-2 2 0 4 q9 8 9 22 h-22 q0 -14 9 -22 q2 -2 0 -4 q-9 -8 -9 -22z" /></clipPath>
      </defs>
      <g clipPath="url(#gst-top)">
        {/* top sand sinks, bottom pile grows */}
        <rect x="6" y={8 + (1 - f) * 22} width="28" height={f * 22} fill="#e8b84a" />
        <rect x="6" y={56 - (1 - f) * 22} width="28" height={(1 - f) * 22} fill="#e8b84a" />
        {running && f > 0.02 && <rect className="gst-stream" x="19.2" y="30" width="1.6" height="24" fill="#e8b84a" />}
      </g>
      <path className="gst-glass-rim" d="M9 8 h22 q0 14 -9 22 q-2 2 0 4 q9 8 9 22 h-22 q0 -14 9 -22 q2 -2 0 -4 q-9 -8 -9 -22z" />
      <rect x="5" y="3" width="30" height="5" rx="2" className="gst-glass-cap" />
      <rect x="5" y="56" width="30" height="5" rx="2" className="gst-glass-cap" />
    </svg>
  );
}

// An easel with your own reference photos on it and a sand timer on the ledge.
// Pin up photos, pick how long each pose lasts, and it flips through them for you,
// chiming between poses. The run lives in lib/gesture so the dock can keep it going.
export default function Gesture({ board, mod, setState, expanded }) {
  const data = useData();
  const { uid, toast } = data;
  const live = useLive();
  const fileRef = useRef(null);
  const { images = [], secs = 60, count = 10, klass = false } = mod.state;
  const session = useSyncExternalStore(subscribe, gestureSnap)[mod.id];
  const [, tick] = useState(0);

  const add = async (files) => {
    const ids = await savePhotos(uid, board.id, files, toast);
    if (ids.length) setState((s) => ({ ...s, images: [...(s.images ?? []), ...ids] }));
  };
  const { rootRef, drop, dropping } = useImageIntake(add);

  const toss = (id) => {
    deleteImage(uid, id);
    setState((s) => ({ ...s, images: (s.images ?? []).filter((x) => x !== id) }));
  };

  // The engine ticks every quarter second; this just keeps the sand smooth in between
  useEffect(() => {
    if (!session || session.paused) return;
    const t = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(t);
  }, [session]);

  const set = (patch) => setState((s) => ({ ...s, ...patch }));
  const plan = planFor({ secs, count, klass });
  const pose = session ? session.poses[session.idx] : images[images.length - 1];
  const src = useImage(uid, pose);

  const len = session ? session.plan[session.idx] : 0;
  const el = session ? poseMs(session) / 1000 : 0;
  const left = session ? Math.max(0, len - el) : 0;
  const frac = session ? left / len : 1;

  const start = () =>
    startGesture({ data, live, boardId: board.id, modId: mod.id, imageIds: images, plan, sendTo: mod.state.sendTo });

  return (
    <div ref={rootRef} className={`gst${dropping ? " dropping" : ""}${expanded ? " big" : ""}`} {...drop}>
      <div className="gst-stage">
        <div className="gst-easel">
          <div className="gst-canvas">
            {src ? (
              <img src={src} alt="" draggable={false} />
            ) : (
              <button className="gst-empty" onClick={() => fileRef.current?.click()}>
                <span>+</span>pin up a reference
                <small>choose, paste or drop photos</small>
              </button>
            )}
            {session && <span className="gst-tag">{session.idx + 1} / {session.plan.length}</span>}
            {session?.paused && <span className="gst-paused">paused</span>}
          </div>
          <div className="gst-ledge"><span className="gst-pencil" aria-hidden="true" /></div>
          <svg className="gst-legs" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
            <path className="o" d="M24 0 L8 40 M76 0 L92 40 M50 0 L50 40" />
            <path d="M24 0 L8 40 M76 0 L92 40 M50 0 L50 40" />
          </svg>
        </div>
        <div className="gst-side">
          <Hourglass frac={frac} running={!!session && !session.paused} />
          <span className="gst-clock">{session ? clock(Math.ceil(left)) : clock(klass ? 30 : secs)}</span>
        </div>
      </div>

      {session ? (
        <div className="gst-row">
          <button className="mini-btn" onClick={() => togglePause(mod.id)}>{session.paused ? "▶ go on" : "⏸ pause"}</button>
          <button className="mini-btn" onClick={() => skip(mod.id)}>⏭ skip</button>
          <button className="mini-btn" onClick={() => finish(mod.id, { log: true })}>■ stop & log</button>
          <button className="mini-btn ghost" onClick={() => finish(mod.id, { log: false })}>cancel</button>
        </div>
      ) : (
        <>
          <div className="gst-chips" role="radiogroup" aria-label="Seconds per pose">
            {SECS.map((p) => (
              <button key={p} role="radio" aria-checked={!klass && p === secs} className={`gst-chip${!klass && p === secs ? " sel" : ""}`} onClick={() => set({ secs: p, klass: false })}>
                {secLabel(p)}
              </button>
            ))}
            <button role="radio" aria-checked={klass} className={`gst-chip wide${klass ? " sel" : ""}`} onClick={() => set({ klass: true })} title="10 × 30s, 5 × 1m, 2 × 5m">
              class
            </button>
          </div>
          {!klass && (
            <div className="gst-chips" role="radiogroup" aria-label="How many poses">
              {COUNTS.map((c) => (
                <button key={c} role="radio" aria-checked={c === count} className={`gst-chip${c === count ? " sel" : ""}`} onClick={() => set({ count: c })}>
                  ×{c}
                </button>
              ))}
            </div>
          )}
          <button className="mini-btn gst-go" disabled={!images.length} onClick={start}>
            ✏️ {images.length ? `draw ${plan.length} poses · ${mix(plan)}` : "add a photo first"}
          </button>
        </>
      )}

      {!session && (
        <div className="gst-thumbs">
          {images.map((id) => <Thumb key={id} id={id} onToss={() => toss(id)} />)}
          <button className="gst-plus" onClick={() => fileRef.current?.click()} aria-label="Add reference photos">+</button>
        </div>
      )}
      <WireTag board={board} mod={mod} />
      {!session && <SendTo fold board={board} mod={mod} setState={setState} note="the gesture count goes there when you log" />}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          add([...e.target.files]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
