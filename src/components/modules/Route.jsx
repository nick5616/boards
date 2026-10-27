import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import { useData } from "../../contexts/DataContext";
import { useLive } from "../../contexts/LiveContext";
import MapPaper from "../map/MapPaper";
import SendTo, { WireTag } from "../board/SendTo";
import { decodeTrack, trackLength, toMiles, fmtClock, fmtPace, fmtMiles } from "../../lib/geo";
import { subscribe, runSnap, startTrack, endTrack, saveRun, canLocate } from "../../lib/runtrack";
import { dayKey, addDays, agoLabel } from "../../utils/date";
import { deleteEntry } from "../../lib/data";

// The dock's little readout while a run is on, so you can watch it from any board
export function DockMiles({ modId }) {
  const r = useSyncExternalStore(subscribe, runSnap)[modId];
  return r ? <span className="rt-dock">{fmtMiles(toMiles(r.meters))} mi</span> : null;
}

const useNow = (on) => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
};

// Weeks start on Monday, like the other cards
export const weekMiles = (runs = []) => {
  const today = new Date();
  const monday = dayKey(addDays(today, -((today.getDay() + 6) % 7)));
  return runs.filter((r) => dayKey(new Date(r.at)) >= monday).reduce((n, r) => n + r.miles, 0);
};

// A folded paper map you run across. Press "go" and it follows your GPS (the live dock
// keeps the screen awake and the ticket on every board); or click out a route by hand.
// Each finished run is kept as a squashed line in an entry, so the card stays small.
export default function Route({ board, mod, setState, entries, expanded }) {
  const data = useData();
  const live = useLive();
  const { runs = [], shown = null } = mod.state;
  const rec = useSyncExternalStore(subscribe, runSnap)[mod.id];
  const now = useNow(!!rec);
  const [draw, setDraw] = useState(false);
  const [draft, setDraft] = useState([]);
  const [mins, setMins] = useState("");
  const [here, setHere] = useState(null);
  const [note, setNote] = useState("");
  const sessionId = `route:${mod.id}`;

  // The run on the map: the live one, else the picked one (decoded from its entry)
  const run = runs.find((r) => r.id === shown) ?? null;
  const past = useMemo(() => {
    const e = run && entries?.find((x) => x.kind === "run" && x.runId === run.id);
    return e ? decodeTrack(e.poly) : [];
  }, [run, entries]);

  const livePts = rec?.pts ?? [];
  const tracks = [];
  const pins = [];
  if (rec) tracks.push({ pts: livePts });
  else if (draw) tracks.push({ pts: draft, dashed: true });
  else if (past.length) tracks.push({ pts: past });
  if (!rec && !draw && past.length > 1) pins.push({ pt: past[0], kind: "start", label: "start" }, { pt: past[past.length - 1], kind: "end" });
  if (draw) draft.forEach((p, i) => pins.push({ pt: p, kind: i ? "dot" : "start" }));
  if (rec && livePts.length) pins.push({ pt: livePts[livePts.length - 1], kind: "me" });
  else if (here && !past.length && !draw) pins.push({ pt: here, kind: "me" });

  const fit = rec ? null : draw ? (draft.length > 1 ? draft : null) : past.length > 1 ? past : null;
  const center = rec && livePts.length ? livePts[livePts.length - 1] : here ?? undefined;

  const meters = rec ? rec.meters : draw ? trackLength(draft) : 0;
  const miles = rec || draw ? toMiles(meters) : run?.miles ?? 0;
  const secs = rec ? Math.round((now - rec.startedAt) / 1000) : run && !draw ? run.secs : 0;
  const week = weekMiles(runs) + (rec ? toMiles(rec.meters) : 0);

  const finish = (log) => {
    const r = endTrack(mod.id);
    if (log && r) saveRun(data, board.id, mod.id, r);
  };
  const go = () => {
    setNote("");
    if (!startTrack(mod.id, mod.state.sendTo)) return setNote("this browser has no GPS");
    setDraw(false);
    live.start({
      id: sessionId,
      kind: "route",
      boardId: board.id,
      modId: mod.id,
      icon: "🏃",
      label: "on a run",
      onStop: () => finish(true),
      render: () => <DockMiles modId={mod.id} />,
    });
  };
  const stop = () => live.stop(sessionId);
  const cancel = () => {
    endTrack(mod.id);
    live.stop(sessionId);
  };

  const findMe = () => {
    setNote("looking for you…");
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setHere([p.coords.latitude, p.coords.longitude]);
        setNote("");
      },
      () => setNote("can't find you (is location allowed?)"),
      { timeout: 10000 }
    );
  };

  const logDrawn = () => {
    const m = parseFloat(mins);
    if (!(m > 0) || draft.length < 2) return;
    saveRun(data, board.id, mod.id, { pts: draft, meters: trackLength(draft), secs: Math.round(m * 60) }, mod.state.sendTo);
    setDraft([]);
    setMins("");
    setDraw(false);
  };

  const forget = (r) => {
    deleteEntry(data.uid, { id: r.entryId, boardId: board.id, kind: "run", moduleId: mod.id });
    setState((s) => ({ ...s, runs: s.runs.filter((x) => x.id !== r.id), shown: s.shown === r.id ? null : s.shown }));
  };

  return (
    <div className="rt">
      <div className="rt-map">
        <MapPaper
          tracks={tracks}
          pins={pins}
          fit={fit}
          fitKey={rec ? "live" : draw ? `d${draft.length > 1 ? 1 : 0}` : `${shown}:${past.length}`}
          center={center}
          onPick={draw && !rec ? (p) => setDraft((d) => [...d, p]) : undefined}
          label={rec ? "your run so far" : "route map"}
        />
        {rec?.error && <div className="rt-warn">{rec.error}</div>}
        {rec && !livePts.length && !rec.error && <div className="rt-warn">finding the sky… (stand still a moment)</div>}
      </div>

      <div className="rt-stub" aria-live="off">
        <div><b>{fmtMiles(miles)}</b><span>miles</span></div>
        <div><b>{fmtClock(secs)}</b><span>time</span></div>
        <div><b>{fmtPace(secs, miles)}</b><span>per mile</span></div>
      </div>

      {rec ? (
        <div className="rt-btns">
          <button className="rt-go stop" onClick={stop}>■ finish &amp; log</button>
          <button className="mini-btn ghost" onClick={cancel}>cancel</button>
        </div>
      ) : draw ? (
        <div className="rt-btns">
          <input className="line-input rt-mins" inputMode="decimal" placeholder="took (min)" value={mins} onChange={(e) => setMins(e.target.value)} onKeyDown={(e) => e.key === "Enter" && logDrawn()} aria-label="How many minutes it took" />
          <button className="mini-btn" disabled={draft.length < 2 || !(parseFloat(mins) > 0)} onClick={logDrawn}>log it</button>
          <button className="mini-btn ghost" disabled={!draft.length} onClick={() => setDraft((d) => d.slice(0, -1))}>↩</button>
          <button className="mini-btn ghost" onClick={() => (setDraw(false), setDraft([]))}>done</button>
        </div>
      ) : (
        <div className="rt-btns">
          <button className="rt-go" onClick={go} disabled={!canLocate()} title={canLocate() ? undefined : "no GPS here, try drawing a route"}>▶ go for a run</button>
          <button className="mini-btn" onClick={() => setDraw(true)} title="click the map to trace a route">✎ draw</button>
          <button className="mini-btn ghost" onClick={findMe} disabled={!canLocate()} title="centre the map on you">◎</button>
        </div>
      )}
      {draw && <div className="rt-hint">click the map to lay down a route{draft.length > 1 ? ` · ${fmtMiles(miles)} mi so far` : ""}</div>}
      {note && <div className="rt-hint">{note}</div>}

      <div className="rt-week"><b>{fmtMiles(week)}</b> mi this week</div>
      <WireTag board={board} mod={mod} />
      {!rec && !draw && <SendTo fold board={board} mod={mod} setState={setState} note="the miles go there when a run is saved" />}

      {(expanded || runs.length > 0) && !rec && !draw && (
        <div className={`rt-runs${expanded ? " open" : ""}`}>
          {runs.slice(0, expanded ? 60 : 3).map((r) => (
            <div key={r.id} className={`rt-run${r.id === shown ? " sel" : ""}`}>
              <button className="rt-run-pick" onClick={() => setState((s) => ({ ...s, shown: s.shown === r.id ? null : r.id }))}>
                <b>{fmtMiles(r.miles)} mi</b>
                <span>{fmtClock(r.secs)} · {fmtPace(r.secs, r.miles)}/mi</span>
                <i>{agoLabel(r.at)}</i>
              </button>
              {expanded && <button className="x-btn" onClick={() => forget(r)} aria-label="Forget this run">✕</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
