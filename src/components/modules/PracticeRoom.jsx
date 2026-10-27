import { useState, useEffect, useRef, useCallback } from "react";
import { useTogether } from "../live/TogetherContext";
import { Empty } from "./kit";
import { shareMedia, watchMedia } from "../../lib/liveMedia";

const MAX = 8; // a mesh: everyone sends to everyone, so it stops here
const VOICE = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
// Music mode: the browser's voice clean-up squashes held notes and chops off decays
const MUSIC = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
const CAM = { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } };

// One little screen. Theirs is a TV set; mine is a polaroid.
function Tile({ stream, name, color, self, cam, mic }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream ?? null;
  });
  const seeing = !!stream?.getVideoTracks().length && cam;
  return (
    <figure className={`prac-tile ${self ? "me" : "tv"}`} style={{ "--c": color }}>
      <div className="prac-screen">
        {/* audio plays through here too; mine is muted so I don't hear myself */}
        <video ref={ref} autoPlay playsInline muted={!!self} style={{ visibility: seeing ? "visible" : "hidden" }} />
        {!seeing && <span className="prac-initial">{(name || "?").slice(0, 1).toUpperCase()}</span>}
        {!mic && <span className="prac-muted" title="muted">🔇</span>}
      </div>
      <figcaption>{self ? "you" : name || "someone"}</figcaption>
    </figure>
  );
}

// An audio / video call inside a board, for up to eight people in a shared space. It goes
// straight between browsers (lib/liveMedia) and is never recorded or stored; nothing is
// kept in the module's state.
export default function PracticeRoom({ mod }) {
  const t = useTogether();
  const room = t?.room ?? null;
  const label = `call:${mod.id}`;

  const [joined, setJoined] = useState(false);
  const [members, setMembers] = useState(() => new Map()); // peer → { cam, mic }: who's in the call
  const [heard, setHeard] = useState(() => new Map()); // peer → their stream
  const [mine, setMine] = useState(null); // my stream, for my own tile
  const [flags, setFlags] = useState({ cam: true, mic: true, music: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const local = useRef(null);
  const out = useRef(null);
  const live = useRef({ joined, flags, members });
  live.current = { joined, flags, members };

  const say = useCallback(
    (to) => room?.send("pr", { k: "here", mod: mod.id, cam: live.current.flags.cam, mic: live.current.flags.mic }, to),
    [room, mod.id]
  );

  const hangUp = useCallback(() => {
    local.current?.getTracks().forEach((tr) => tr.stop());
    local.current = null;
    setMine(null);
    setJoined(false);
  }, []);

  // Who's in the call, whether or not I am (so the room can show it and say when it's full)
  useEffect(() => {
    if (!room) return;
    const offs = [
      room.on("pr", (m, from) => {
        if (m.mod !== mod.id) return;
        if (m.k === "ask") {
          if (live.current.joined) say(from);
        } else if (m.k === "here") {
          setMembers((prev) => new Map(prev).set(from, { cam: m.cam, mic: m.mic }));
          if (m.hi && live.current.joined) say(from); // a newcomer: let them know I'm here
        } else if (m.k === "bye") {
          setMembers((prev) => (prev.has(from) ? new Map([...prev].filter(([k]) => k !== from)) : prev));
        }
      }),
      room.onPeer((id, here) => {
        if (here) return;
        setMembers((prev) => (prev.has(id) ? new Map([...prev].filter(([k]) => k !== id)) : prev));
      }),
    ];
    room.send("pr", { k: "ask", mod: mod.id });
    return () => {
      offs.forEach((off) => off());
      setMembers(new Map());
    };
  }, [room, mod.id, say]);

  // While I'm in: send my stream to whoever's in the call, and show theirs
  useEffect(() => {
    if (!room || !joined || !local.current) return;
    const o = shareMedia(room, label, local.current);
    out.current = o;
    const off = watchMedia(room, label, (stream, from, up) =>
      setHeard((prev) => {
        const next = new Map(prev);
        if (up) next.set(from, stream);
        else if (next.get(from) === stream) next.delete(from);
        else return prev;
        return next;
      })
    );
    room.send("pr", { k: "here", mod: mod.id, hi: true, cam: live.current.flags.cam, mic: live.current.flags.mic });
    return () => {
      off();
      o.stop();
      out.current = null;
      room.send("pr", { k: "bye", mod: mod.id });
      setHeard(new Map());
    };
  }, [room, joined, label, mod.id]);

  // The people in the call are the ones I send to
  useEffect(() => {
    out.current?.to([...members.keys()]);
  }, [members, joined]);

  // The tab went to the background (or the board closed): the room is gone, so the mic goes too
  useEffect(() => {
    if (joined && !room) hangUp();
  }, [joined, room, hangUp]);
  useEffect(() => () => local.current?.getTracks().forEach((tr) => tr.stop()), []);

  const join = async () => {
    if (busy || members.size >= MAX - 1) return;
    setBusy(true);
    setErr("");
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: VOICE, video: CAM });
      } catch (e) {
        if (e?.name === "NotAllowedError" || e?.name === "SecurityError") throw e;
        // No camera? Voice alone is fine.
        stream = await navigator.mediaDevices.getUserMedia({ audio: VOICE });
      }
      local.current = stream;
      setMine(stream);
      setFlags({ cam: !!stream.getVideoTracks().length, mic: true, music: false });
      setJoined(true);
    } catch (e) {
      setErr(
        e?.name === "NotAllowedError" || e?.name === "SecurityError"
          ? "The microphone is turned off for this page. Allow it in the address bar, then try again."
          : e?.name === "NotFoundError"
            ? "No microphone found. Plug one in and try again."
            : "The microphone is busy or won't start."
      );
    }
    setBusy(false);
  };

  const mute = () => {
    const on = !flags.mic;
    local.current?.getAudioTracks().forEach((tr) => (tr.enabled = on));
    live.current.flags = { ...flags, mic: on };
    setFlags(live.current.flags);
    say();
  };

  const camera = () => {
    const on = !flags.cam;
    local.current?.getVideoTracks().forEach((tr) => (tr.enabled = on));
    live.current.flags = { ...flags, cam: on };
    setFlags(live.current.flags);
    say();
  };

  // Swap the mic for one with (or without) the voice processing, keeping the camera
  const music = async () => {
    const on = !flags.music;
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ audio: on ? MUSIC : VOICE });
      if (!local.current) return fresh.getTracks().forEach((tr) => tr.stop());
      const [audio] = fresh.getAudioTracks();
      audio.enabled = flags.mic;
      local.current.getAudioTracks().forEach((tr) => tr.stop());
      const next = new MediaStream([audio, ...local.current.getVideoTracks()]);
      local.current = next;
      setMine(next);
      out.current?.swap(next);
      setFlags((f) => ({ ...f, music: on }));
    } catch {
      setErr("Couldn't switch the microphone.");
    }
  };

  const leave = () => hangUp();

  if (!t) {
    return (
      <Empty>A call for people sharing this board. Invite someone to start one.</Empty>
    );
  }

  const others = [...members.keys()];
  const full = !joined && members.size >= MAX - 1;
  const alone = !t.peers.length;

  return (
    <div className="prac">
      {!joined ? (
        <div className="prac-lobby">
          <div className="prac-tvs" aria-hidden="true"><i /><i /><i /></div>
          <b>{others.length ? `${others.length} in the room` : "nobody in the room yet"}</b>
          {others.length > 0 && <span className="prac-who">{others.map((p) => t.who(p).name || "someone").join(", ")}</span>}
          {!room ? (
            <span className="prac-note">connecting…</span>
          ) : alone && !others.length ? (
            <span className="prac-note">nobody else is here right now</span>
          ) : full ? (
            <span className="prac-note">The room is full ({MAX} people).</span>
          ) : null}
          <button className="mini-btn on" onClick={join} disabled={busy || !room || full || (alone && !others.length)}>
            {busy ? "…" : "Join the room"}
          </button>
          {err && <p className="prac-err">{err}</p>}
          <small className="prac-note">up to {MAX} · never recorded</small>
        </div>
      ) : (
        <>
          <div className="prac-grid">
            <Tile stream={mine} self name="" color={t.me?.color ?? "#ffd166"} cam={flags.cam} mic={flags.mic} />
            {others.map((p) => {
              const who = t.who(p);
              const m = members.get(p);
              return <Tile key={p} stream={heard.get(p)} name={who.name} color={who.color} cam={m?.cam ?? true} mic={m?.mic ?? true} />;
            })}
          </div>
          <div className="prac-bar">
            <button className={`mini-btn ghost${flags.mic ? "" : " on"}`} onClick={mute} aria-pressed={!flags.mic}>
              {flags.mic ? "🎤 mute" : "🔇 unmute"}
            </button>
            {!!mine?.getVideoTracks().length && (
              <button className={`mini-btn ghost${flags.cam ? "" : " on"}`} onClick={camera} aria-pressed={!flags.cam}>
                {flags.cam ? "📷 camera off" : "📷 camera on"}
              </button>
            )}
            <button className={`mini-btn ghost${flags.music ? " on" : ""}`} onClick={music} aria-pressed={flags.music} title="turns off echo cancelling, noise cutting and auto volume so instruments come through">
              🎸 music mode
            </button>
            <button className="mini-btn" onClick={leave}>Leave</button>
          </div>
          {flags.music && <small className="prac-note">Music mode is on: wear headphones so the others don't echo back.</small>}
          {err && <p className="prac-err">{err}</p>}
        </>
      )}
    </div>
  );
}
