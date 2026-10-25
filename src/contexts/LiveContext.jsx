import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore } from "react";
import { useData } from "./DataContext";
import { startTimer, stopTimer } from "../lib/timer";
import { startMetronome, stopMetronome, syncEngines, trainerStep, metroState } from "../lib/metronome";
import { startRadio, stopRadio, stopAudio, subscribe, radioSnap } from "../lib/radio";
import { songLine } from "../lib/nowplaying";
import { ding, hasGesture } from "../lib/audio";

// Things that are running right now and should outlive the board they live on:
// the kitchen timer today, a metronome or tape recorder later. The dock shows them.
//
// Session: { id, boardId, modId, kind, label, startedAt, endsAt?, icon?, onStop?(), render?() }
//   endsAt  - counts down to it (then up past it) instead of just counting up
//   onStop  - called when stopped from the dock; kill your sound/recording here
//   render  - optional extra bits (a bpm readout, a level meter) shown on the ticket
// Timers and metronomes aren't registered at all: they're read straight off the boards
// (see RUNNERS), so a running one shows up on load and every collaborator sees the same
// thing. needsSound marks one that stays silent until the page has been touched.
// { sessions, start(session), stop(id, {log}), update(id, patch), popOut, poppedOut, pipWindow, openBoard }
const Ctx = createContext(null);
export const useLive = () => useContext(Ctx);

// Module types whose running state lives in the module (startedAt); type = session kind.
// start(data, boardId, modId) / stop(data, boardId, modId, state, log) edit that state.
const RUNNERS = {
  timer: {
    icon: "🍅",
    label: (s) => `${s.preset ?? 20} min timer`,
    endsAt: (s) => s.startedAt + (s.preset ?? 20) * 60000,
    start: startTimer,
    stop: stopTimer,
  },
  metronome: {
    icon: "♩",
    label: (s) => `metronome at ${metroState(s).bpm}`,
    needsSound: true,
    start: startMetronome,
    stop: stopMetronome,
  },
  radio: {
    icon: "📻",
    label: (s) => s.station?.name ?? "radio",
    needsSound: true,
    start: startRadio,
    stop: stopRadio,
  },
};

export function LiveProvider({ boards, onOpenBoard, children }) {
  const data = useData();
  const [extra, setExtra] = useState([]);
  const [pipWindow, setPipWindow] = useState(null);

  // Callbacks read these so they never act on a stale board
  const boardsRef = useRef(boards);
  boardsRef.current = boards;
  const dataRef = useRef(data);
  dataRef.current = data;

  const derived = useMemo(
    () =>
      (boards ?? []).flatMap((b) =>
        b.modules
          .filter((m) => RUNNERS[m.type] && m.state?.startedAt)
          .map((m) => {
            const r = RUNNERS[m.type];
            return {
              id: `${m.type}:${m.id}`,
              boardId: b.id,
              modId: m.id,
              kind: m.type,
              label: r.label(m.state),
              icon: r.icon,
              startedAt: m.state.startedAt,
              ...(r.endsAt && { endsAt: r.endsAt(m.state) }),
              ...(r.needsSound && { needsSound: true }),
            };
          })
      ),
    [boards]
  );
  // A playing radio's ticket reads the song, with the station as the small line
  const radio = useSyncExternalStore(subscribe, radioSnap);
  const sessions = useMemo(
    () =>
      [...derived, ...extra].map((s) =>
        s.kind === "radio" && radio.song && radio.modId === s.modId
          ? { ...s, label: songLine(radio.song), sub: s.label, song: radio.song }
          : s
      ),
    [derived, extra, radio.song, radio.modId]
  );
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  const start = useCallback((s) => {
    if (RUNNERS[s.kind]) return RUNNERS[s.kind].start(dataRef.current, s.boardId, s.modId);
    const id = s.id ?? `${s.kind}:${s.modId}`;
    setExtra((xs) => [...xs.filter((x) => x.id !== id), { startedAt: Date.now(), ...s, id }]);
    return id;
  }, []);

  const stop = useCallback((id, { log = true } = {}) => {
    const s = sessionsRef.current.find((x) => x.id === id);
    if (!s) return;
    if (RUNNERS[s.kind]) {
      const mod = boardsRef.current?.find((b) => b.id === s.boardId)?.modules.find((m) => m.id === s.modId);
      RUNNERS[s.kind].stop(dataRef.current, s.boardId, s.modId, mod?.state ?? {}, log);
      return;
    }
    s.onStop?.();
    setExtra((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const update = useCallback(
    (id, patch) => setExtra((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    []
  );

  // Metronomes tick from here, not from their card, so they carry on across boards
  const tickKey = sessions
    .filter((s) => s.kind === "metronome")
    .map((s) => `${s.modId}/${s.boardId}`)
    .join(",");
  useEffect(() => {
    const where = new Map(tickKey ? tickKey.split(",").map((k) => k.split("/")) : []);
    syncEngines([...where.keys()], (modId) => {
      const boardId = where.get(modId);
      return {
        read: () => boardsRef.current?.find((b) => b.id === boardId)?.modules.find((m) => m.id === modId)?.state,
        onBar: (n) => trainerStep(dataRef.current.updateBoard, boardId, modId, n),
      };
    });
  }, [tickKey]);
  useEffect(() => () => syncEngines([]), []);

  // A radio taken off its board (or its whole board deleted) mid-song would play on with
  // no ticket to stop it. Only "gone" counts: a missing startedAt can just mean it's still tuning in.
  useEffect(() => {
    if (!radio.modId || !boards) return;
    if (!boards.some((b) => b.modules.some((m) => m.id === radio.modId))) stopAudio();
  }, [boards, radio.modId]);

  // The bell: once per run, only if we watched it cross the line (not on rehydrate)
  const rung = useRef(new Set());
  useEffect(() => {
    const t = setInterval(() => {
      for (const s of sessionsRef.current) {
        if (!s.endsAt) continue;
        const key = `${s.id}@${s.startedAt}`;
        const over = Date.now() - s.endsAt;
        if (over >= 0 && over < 5000 && !rung.current.has(key)) {
          rung.current.add(key);
          if (hasGesture()) ding();
        }
      }
    }, 500);
    return () => clearInterval(t);
  }, []);

  // Keep the screen awake while something is running
  const live = sessions.length > 0;
  useEffect(() => {
    if (!live || !("wakeLock" in navigator)) return;
    let lock = null;
    let gone = false;
    const grab = () => {
      if (document.visibilityState !== "visible" || lock) return;
      navigator.wakeLock.request("screen").then(
        (l) => {
          if (gone) return l.release().catch(() => {});
          lock = l;
          l.addEventListener("release", () => { if (lock === l) lock = null; });
        },
        () => {} // refused (low battery, no gesture): nothing to do
      );
    };
    grab();
    document.addEventListener("visibilitychange", grab);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", grab);
      lock?.release().catch(() => {});
    };
  }, [live]);

  // Lock-screen / media-key card. Chrome may only show it while audio plays.
  const first = sessions[0];
  const boardTitle = first && boards?.find((b) => b.id === first.boardId)?.title;
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const stopFirst = () => sessionsRef.current[0] && stop(sessionsRef.current[0].id);
    try {
      if (!first) {
        ms.metadata = null;
        ["pause", "stop"].forEach((a) => ms.setActionHandler(a, null));
        return;
      }
      // A radio with a known song shows it on the lock screen: song, artist, station
      const meta = first.song
        ? { title: first.song.title, artist: first.song.artist, album: first.sub }
        : { title: first.label, artist: boardTitle ?? "" };
      if (window.MediaMetadata) ms.metadata = new window.MediaMetadata(meta);
      ["pause", "stop"].forEach((a) => ms.setActionHandler(a, stopFirst));
    } catch {
      /* some browsers reject unknown actions */
    }
  }, [first?.id, first?.label, first?.sub, first?.song, boardTitle, stop]);

  // Pop-out: the dock in a little always-on-top window (Chrome desktop only)
  const canPop = typeof window !== "undefined" && "documentPictureInPicture" in window;
  const popOut = useCallback(async () => {
    if (!canPop) return;
    if (pipWindow) return pipWindow.close();
    try {
      const w = await window.documentPictureInPicture.requestWindow({ width: 340, height: 150 });
      // The pop-out is a blank document: bring the app's styles along
      for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) {
        w.document.head.appendChild(node.cloneNode(true));
      }
      w.document.documentElement.className = document.documentElement.className;
      w.document.body.className = "live-pip";
      w.addEventListener("pagehide", () => setPipWindow(null));
      setPipWindow(w);
    } catch {
      /* needs a gesture, or the browser said no */
    }
  }, [canPop, pipWindow]);

  // Nothing left to show: put the window away
  useEffect(() => {
    if (!live && pipWindow) pipWindow.close();
  }, [live, pipWindow]);

  const value = useMemo(
    () => ({
      sessions,
      start,
      stop,
      update,
      popOut: canPop ? popOut : null,
      poppedOut: !!pipWindow,
      pipWindow,
      openBoard: onOpenBoard,
    }),
    [sessions, start, stop, update, canPop, popOut, pipWindow, onOpenBoard]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
