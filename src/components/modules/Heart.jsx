import { useState, useEffect, useSyncExternalStore } from "react";
import { useData } from "../../contexts/DataContext";
import { useLive } from "../../contexts/LiveContext";
import { fmtClock } from "../../lib/geo";
import { ZONES, DEFAULT_MAX, zoneOf, subscribe, heartSnap, connectStrap, disconnectStrap, startSession, endSession, logSession, rememberWires, setMax, canBluetooth } from "../../lib/heart";
import SendTo, { WireTag } from "../board/SendTo";

// The dock's readout: the live number
export function DockBpm({ modId }) {
  const h = useSyncExternalStore(subscribe, heartSnap)[modId];
  return h?.bpm ? <span className="hr-dock">♥ {h.bpm}</span> : null;
}

// five arcs round the heart, one per zone; the ones you've reached light up
function Ring({ zone }) {
  const arcs = ZONES.map((z, i) => {
    const a0 = ((i * 72 + 4 - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * 72 - 4 - 90) * Math.PI) / 180;
    const r = 54;
    const p = (a) => `${60 + r * Math.cos(a)} ${60 + r * Math.sin(a)}`;
    return <path key={z.name} d={`M${p(a0)} A${r} ${r} 0 0 1 ${p(a1)}`} stroke={z.color} className={zone > i ? "on" : ""} />;
  });
  return <g className="hr-ring">{arcs}</g>;
}

// A strap you wear on your chest: a heart that beats at your pulse. Pair it, press go, and the
// session (average, hottest beat, time in each zone) goes on the chart when you finish.
export default function Heart({ board, mod, setState, expanded }) {
  const data = useData();
  const live = useLive();
  const maxHr = mod.state.maxHr ?? DEFAULT_MAX;
  const h = useSyncExternalStore(subscribe, heartSnap)[mod.id];
  const [now, setNow] = useState(Date.now);
  const rec = h?.rec;
  const id = `heartrate:${mod.id}`;

  useEffect(() => {
    if (!rec) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [rec]);
  useEffect(() => {
    setMax(mod.id, maxHr);
  }, [mod.id, maxHr]);

  const bpm = h?.bpm ?? null;
  const zone = bpm ? zoneOf(bpm, maxHr) : 0;
  const beat = bpm ? Math.max(0.25, Math.min(2, 60 / bpm)) : 1.4;

  const finish = () => logSession(data, board.id, mod.id, endSession(mod.id));
  const go = () => {
    rememberWires(mod.id, mod.state.sendTo);
    const r = startSession(mod.id);
    if (!r) return;
    live.start({ id, kind: "heartrate", boardId: board.id, modId: mod.id, icon: "❤️", label: "heart strap", startedAt: r.startedAt, onStop: finish, render: () => <DockBpm modId={mod.id} /> });
  };
  const cancel = () => {
    endSession(mod.id);
    live.stop(id);
  };

  const status = !canBluetooth() ? "no Bluetooth here" : h?.status === "connecting" ? "pairing…" : h?.status === "waiting" ? "paired, waiting for a beat…" : h?.status === "lost" ? "lost the strap" : h?.status === "live" ? h.name : "not paired";
  const secs = rec ? Math.round((now - rec.startedAt) / 1000) : 0;
  const zoneTotal = rec ? rec.zones.reduce((a, b) => a + b, 0) || 1 : 1;

  return (
    <div className="hr">
      <svg className={`hr-svg${bpm ? " beating" : ""}`} viewBox="0 0 120 120" style={{ "--beat": `${beat}s` }} role="img" aria-label={bpm ? `${bpm} beats per minute, ${zone ? ZONES[zone - 1].name : "resting"}` : "no heartbeat yet"}>
        <circle className="hr-dial" cx="60" cy="60" r="54" />
        <Ring zone={zone} />
        <g className="hr-heart">
          <path className="hr-body" d="M60 92 C26 68 24 44 38 36 C48 31 57 36 60 44 C63 36 72 31 82 36 C96 44 94 68 60 92Z" />
          <path className="hr-shine" d="M38 44 C40 40 45 39 48 41" />
        </g>
      </svg>
      <div className="hr-bpm">
        <b>{bpm ?? "––"}</b> <span>bpm</span>
      </div>
      <div className="hr-zone" style={zone ? { color: ZONES[zone - 1].color } : undefined}>{bpm ? (zone ? ZONES[zone - 1].name : "resting") : status}</div>

      {rec && (
        <div className="hr-sess">
          <div className="hr-stats">
            <span><b>{fmtClock(secs)}</b>time</span>
            <span><b>{rec.secs ? Math.round(rec.sum / rec.secs) : "––"}</b>avg</span>
            <span><b>{rec.max || "––"}</b>max</span>
          </div>
          <div className="hr-zones" aria-label="Time in each zone">
            {ZONES.map((z, i) => <i key={z.name} title={`${z.name}: ${fmtClock(rec.zones[i + 1])}`} style={{ flex: Math.max(0.02, rec.zones[i + 1] / zoneTotal), background: z.color }} />)}
          </div>
        </div>
      )}

      <div className="hr-btns">
        {rec ? (
          <>
            <button className="mini-btn hr-go" onClick={() => live.stop(id)}>■ stop &amp; log</button>
            <button className="mini-btn ghost" onClick={cancel}>cancel</button>
          </>
        ) : h?.status === "live" ? (
          <>
            <button className="mini-btn hr-go" onClick={go}>▶ start a session</button>
            <button className="mini-btn ghost" onClick={() => disconnectStrap(mod.id)}>unpair</button>
          </>
        ) : (
          <button className="mini-btn hr-go" onClick={() => connectStrap(mod.id, maxHr)} disabled={!canBluetooth() || h?.status === "connecting" || h?.status === "waiting"} title={canBluetooth() ? undefined : "Bluetooth works in Chrome or Edge"}>
            {h?.status === "lost" ? "↻ reconnect" : "pair a strap"}
          </button>
        )}
      </div>
      {h?.error && <div className="rt-hint">{h.error}</div>}
      {!canBluetooth() && <div className="rt-hint">this browser can't talk to a strap (try Chrome or Edge)</div>}

      {expanded && (
        <div className="gr-settings">
          <label>max heart rate<input className="line-input" inputMode="numeric" defaultValue={maxHr} onChange={(e) => setState((s) => ({ ...s, maxHr: Math.max(100, Math.min(230, parseInt(e.target.value) || DEFAULT_MAX)) }), { debounce: 600 })} /> bpm</label>
        </div>
      )}
      <WireTag board={board} mod={mod} />
      {!rec && <SendTo fold board={board} mod={mod} setState={setState} note="your average goes there when you stop" />}
    </div>
  );
}
