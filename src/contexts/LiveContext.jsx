import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore } from "react";
import { useData } from "./DataContext";
import { startTimer, stopTimer } from "../lib/timer";
import { startMetronome, stopMetronome, syncEngines, trainerStep, metroState } from "../lib/metronome";
import { startRadio, stopRadio, stopAudio, subscribe, radioSnap } from "../lib/radio";
import { overlay } from "../lib/metroSync";
import { songLine } from "../lib/nowplaying";
import { ding, hasGesture } from "../lib/audio";
import { startFocus, stopFocus, phaseOf, phaseMins, PHASE_NAME } from "../lib/pomodoro";
import { dueNow, recordDose, snoozeDose, atLabel } from "../lib/meds";

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
// Reminders are separate from sessions: nothing is "running", a medicine-cabinet dose has just come due.
// { id, boardId, modId, kind: "meds", label, sub, icon, slot, actions: [{ label, run }] }
// The dock shows each with its own buttons instead of a clock and a stop button.
// { sessions, reminders, start(session), stop(id, {log}), update(id, patch), popOut, poppedOut, pipWindow, openBoard }
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
  // the focus booth's pomodoro: whichever stretch is on (focus, short or long break)
  focus: {
    icon: "🍅",
    label: (s) => `${PHASE_NAME[phaseOf(s)]}${phaseOf(s) === "focus" ? ` ${(s.round ?? 0) + 1}` : ""}`,
    endsAt: (s) => s.startedAt + phaseMins(s) * 60000,
    start: startFocus,
    stop: stopFocus,
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

  // Medicine-cabinet doses that have come due, worked out from the boards (so they are the
  // same on every device). Only re-checked while some cabinet holds a med.
  const hasMeds = (boards ?? []).some((b) => b.modules.some((m) => m.type === "meds" && m.state.meds?.length));
  const [tick, setTick] = useState(Date.now);
  useEffect(() => {
    if (!hasMeds) return;
    setTick(Date.now());
    const t = setInterval(() => setTick(Date.now()), 15000);
    return () => clearInterval(t);
  }, [hasMeds]);
  const reminders = useMemo(
    () =>
      dueNow(boards, tick).map((r) => {
        const done = (status) => () => recordDose(dataRef.current, r.boardId, r.modId, r.med, { slot: r.slot, status });
        return {
          ...r,
          kind: "meds",
          icon: "💊",
          // A cabinet set to hide names keeps them off the dock and the pings too
          label: r.hide ? "time for a dose" : r.med.name || "a med",
          sub: atLabel(r.slot.at),
          actions: [
            { label: "took it", run: done("taken") },
            { label: "snooze", run: () => snoozeDose(dataRef.current, r.boardId, r.modId, r.med, 15) },
            { label: "skip", run: done("skipped") },
          ],
        };
      }),
    [boards, tick]
  );

  // A browser notification when a dose comes due while boards is open, if the cabinet's bell is on.
  // Not for ones already long past when the page opened: the dock shows those.
  const pinged = useRef(new Set());
  useEffect(() => {
    for (const r of reminders) {
      const key = `${r.id}@${r.slot.key}@${r.med.snoozeUntil ?? 0}`;
      if (!r.notify || pinged.current.has(key)) continue;
      pinged.current.add(key);
      if (Date.now() - r.slot.at > 10 * 60000) continue;
      if (typeof Notification === "undefined" || Notification.permission !== "granted") continue;
      try {
        new Notification(r.hide ? "Time for a dose" : `Time for ${r.med.name || "your med"}`, {
          body: r.hide ? "open boards to log it" : `${r.med.strength ? `${r.med.strength} · ` : ""}scheduled for ${r.sub}`,
          tag: key,
        });
      } catch {
        /* some browsers only allow these from a service worker */
      }
    }
  }, [reminders]);

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
        boardId,
        // what the room has said over the peer bus lately counts before the database copy
        read: () => overlay(modId, boardsRef.current?.find((b) => b.id === boardId)?.modules.find((m) => m.id === modId)?.state),
        onBar: (n) => trainerStep(dataRef.current.updateBoard, boardId, modId, n, overlay(modId, boardsRef.current?.find((b) => b.id === boardId)?.modules.find((m) => m.id === modId)?.state)),
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
    if (!live && !reminders.length && pipWindow) pipWindow.close();
  }, [live, reminders.length, pipWindow]);

  const value = useMemo(
    () => ({
      sessions,
      reminders,
      start,
      stop,
      update,
      popOut: canPop ? popOut : null,
      poppedOut: !!pipWindow,
      pipWindow,
      openBoard: onOpenBoard,
    }),
    [sessions, reminders, start, stop, update, canPop, popOut, pipWindow, onOpenBoard]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
