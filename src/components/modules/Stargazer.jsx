import { useState, useEffect, useId, useMemo } from "react";
import { useCachedJSON, HOUR } from "../../lib/apis";
import { uid } from "../../utils/uid";
import { clock, inLabel, kmToMi } from "../../lib/sky";
import {
  moonOf, daysUntilPhase, lstDeg, project, horizon, STARS, FIGURES, NAMED,
  sunUrl, sunKey, SUN_TTL, darkness, ISS_URL, ISS_NEAR_KM, issNear,
  LAUNCH_URL, LAUNCH_KEY, LAUNCH_TTL, launchBits, apodUrl, apodKey, APOD_TTL,
} from "../../lib/stargazer";
import { usePlace } from "../../lib/place";
import { Empty, Credit, PlaceAsk } from "./kit";
import { PlaceFold } from "./SkyBits";

const INK = "#2a2520";
const R = 100; // dial radius in viewBox units

// The star wheel: the sky above `place` at time `ms`, centred on the pole you can see with
// the meridian straight up. Everything inside the lighter horizon shape is above the horizon.
function Wheel({ place, ms }) {
  const id = useId();
  const lst = lstDeg(ms, place.lon);
  const south = place.lat < 0;
  const pt = (k) => project(STARS[k][1], STARS[k][2], lst, place.lat, R);
  const hz = useMemo(() => horizon(lst, place.lat, R), [lst, place.lat]);
  const hzPath = `M${hz.map((p) => p.map((n) => n.toFixed(1)).join(",")).join("L")}Z`;
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15);
  const stars = Object.keys(STARS).map((k) => ({ k, p: pt(k) }));
  const mag = (k) => (NAMED.includes(k) ? 2 : 1.3);
  const field = (dim) => (
    <g opacity={dim ? 0.3 : 1}>
      {FIGURES.map((f) => (
        <g key={f.name} fill="none" stroke="#9fc4ff" strokeWidth="0.7" strokeLinejoin="round">
          {f.lines.map((l, i) => <polyline key={i} points={l.map((k) => pt(k).join(",")).join(" ")} />)}
        </g>
      ))}
      {stars.map(({ k, p }) => <circle key={k} cx={p[0]} cy={p[1]} r={mag(k)} fill="#fff8d0" />)}
      {!dim && (
        <g fontSize="5.5" fill="#d8e6ff" fontFamily="'Caveat', cursive">
          {FIGURES.map((f) => { const p = pt(f.label); return <text key={f.name} x={p[0] + 4} y={p[1] - 3}>{f.name}</text>; })}
          {NAMED.map((k) => { const p = pt(k); return <text key={k} x={p[0] + 3} y={p[1] + 7} fill="#ffe9a8">{STARS[k][0]}</text>; })}
        </g>
      )}
    </g>
  );
  return (
    <svg viewBox="-112 -112 224 224" className="sg-wheel" role="img" aria-label={`Star wheel for ${place.name}`}>
      <defs>
        <clipPath id={`${id}d`}><circle r={R} /></clipPath>
        <clipPath id={`${id}h`}><path d={hzPath} /></clipPath>
      </defs>
      <circle r="110" fill="#e8c76a" stroke={INK} strokeWidth="2.5" />
      <circle r="102" fill="none" stroke={INK} strokeWidth="1" />
      <g stroke={INK} strokeLinecap="round">
        {ticks.map((a) => <line key={a} y1="-104" y2={a % 90 === 0 ? -110 : -107} strokeWidth={a % 90 === 0 ? 1.8 : 1} transform={`rotate(${a})`} />)}
      </g>
      <circle r={R} fill="#162447" stroke={INK} strokeWidth="2" />
      <g clipPath={`url(#${id}d)`}>
        <path d={hzPath} fill="#24396e" />
        {field(true)}
        <g clipPath={`url(#${id}h)`}>{field(false)}</g>
        <path d={hzPath} fill="none" stroke="#f2c94c" strokeWidth="1.2" strokeDasharray="3 2" />
        <circle r="1.6" fill="#ffb4b4" />
      </g>
      <text y="-91" textAnchor="middle" fontSize="8" fontWeight="700" fill="#f2c94c">{south ? "N" : "S"}</text>
    </svg>
  );
}

const SEEN_ICON = { iss: "🛰", launch: "🚀", moon: "🌙", other: "✨" };

// A planisphere: the sky above you right now, with the moon and the next launch under it.
// Opened big it turns the wheel through the night and adds the dark window, the ISS, more
// launches, NASA's picture of the day and a "seen it" log. The moon is worked out here;
// sunset is Open-Meteo, the ISS wheretheiss.at, launches Launch Library 2 (cached 90 min,
// it allows 15 asks an hour), the picture NASA (your api.data.gov key, else the demo key).
// State: place {name,lat,lon} (only if different from home),
// seen [{ id, kind: iss|launch|moon|other, label, at }].
export default function Stargazer({ mod, setState, expanded, openBig }) {
  const { seen = [] } = mod.state;
  const { place, own } = usePlace(mod.state.place);
  const [now, setNow] = useState(Date.now());
  const [shift, setShift] = useState(0); // hours the wheel is turned from now
  const [iss, setIss] = useState(null);
  const [other, setOther] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  // The station moves fast, so it's polled every 15s, only while the tab is visible and
  // the big view is open
  useEffect(() => {
    if (!place || !expanded) return;
    let live = true;
    const go = () => {
      if (document.hidden) return;
      fetch(ISS_URL).then((r) => r.json()).then((j) => live && setIss(j)).catch(() => {});
    };
    go();
    const t = setInterval(go, 15000);
    return () => { live = false; clearInterval(t); };
  }, [place, expanded]);

  const sunQ = useCachedJSON(place ? sunUrl(place) : null, { ttl: SUN_TTL, key: place && sunKey(place) });
  const launchQ = useCachedJSON(LAUNCH_URL, { ttl: LAUNCH_TTL, key: LAUNCH_KEY });
  const apodQ = useCachedJSON(expanded ? apodUrl() : null, { ttl: APOD_TTL, key: apodKey() });

  const setPlace = (p) => setState((x) => ({ ...x, place: p }));
  const log = (kind, label) =>
    setState((x) => ({ ...x, seen: [{ id: uid(), kind, label, at: Date.now() }, ...(x.seen ?? [])].slice(0, 200) }));
  const unlog = (id) => setState((x) => ({ ...x, seen: (x.seen ?? []).filter((e) => e.id !== id) }));

  if (!place) {
    return <Empty action={<PlaceAsk why="which sky?" onPlace={setPlace} />}>The star wheel needs a place.</Empty>;
  }

  const t = now + shift * HOUR;
  const moon = moonOf(now);
  const dark = darkness(sunQ.data, now);
  const dist = issNear(iss, place);
  const near = dist != null && dist < ISS_NEAR_KM;
  const launches = (launchQ.data?.results ?? []).map(launchBits).filter((l) => l.net > now - HOUR);
  const toFull = daysUntilPhase(now, 0.5);
  const toNew = daysUntilPhase(now, 0);
  const apod = apodQ.data;
  const next = launches[0];

  return (
    <div className="sg">
      <Wheel place={place} ms={t} />
      {expanded && (
        <label className="sg-turn">
          <span>{shift === 0 ? `sky now (${clock(t)})` : `sky at ${clock(t)}`}</span>
          <input type="range" min="-6" max="12" step="0.5" value={shift} onChange={(e) => setShift(Number(e.target.value))} aria-label="Turn the wheel (hours from now)" />
        </label>
      )}

      <div className="sg-row">
        <span className="sg-big">{moon.icon}</span>
        <div>
          <b>{moon.name} · {Math.round(moon.light * 100)}%</b>
          <em>{dark ? `dark ${clock(dark.dark[0], dark.off)} to ${clock(dark.dark[1], dark.off)}` : `full ${inLabel(now + toFull * 86400000, now)}`}</em>
        </div>
      </div>
      {next && (
        <div className="sg-row">
          <span className="sg-big">🚀</span>
          <div>
            <b>{next.rocket}{next.mission ? ` · ${next.mission}` : ""}</b>
            <em>{inLabel(next.net, now)} · {new Date(next.net).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</em>
          </div>
          {!expanded && launches.length > 1 && <button className="mini-btn ghost" onClick={openBig}>+{launches.length - 1}</button>}
        </div>
      )}

      {expanded && (
        <>
          <div className={`sg-row${near ? " near" : ""}`}>
            <span className="sg-big">🛰</span>
            <div>
              <b>ISS {dist == null ? "…" : near ? "is near you" : "is far away"}</b>
              <em>{dist == null ? "finding it…" : `${Math.round(dist).toLocaleString()} km (${Math.round(kmToMi(dist)).toLocaleString()} mi) · ${iss.visibility}${near && iss.visibility === "visible" ? " · look up!" : ""}`}</em>
            </div>
            <button className="mini-btn ghost" onClick={() => log("iss", "the ISS")}>saw it</button>
          </div>
          <div className="sg-row">
            <span className="sg-big">{moon.icon}</span>
            <div><b>full {inLabel(now + toFull * 86400000, now)}</b><em>new {inLabel(now + toNew * 86400000, now)}{dark ? ` · sunset ${clock(dark.sunset, dark.off)}` : ""}</em></div>
            <button className="mini-btn ghost" onClick={() => log("moon", moon.name)} aria-label="Log that I looked at the moon">saw it</button>
          </div>

          <div className="sg-h">next launches</div>
          {launches.length === 0 && <div className="sg-empty">{launchQ.loading ? "checking the pads…" : launchQ.error ? "couldn't reach the launch schedule" : "nothing on the schedule"}</div>}
          {launches.slice(0, 5).map((l) => (
            <div key={l.id} className="sg-launch">
              <div>
                <b>{l.rocket}{l.mission ? ` · ${l.mission}` : ""}</b>
                <em>{new Date(l.net).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })} ({inLabel(l.net, now)}) · {l.status || "?"} · {l.where}</em>
              </div>
              <button className="mini-btn ghost" onClick={() => log("launch", `${l.rocket}${l.mission ? ` · ${l.mission}` : ""}`)} aria-label={`Log that I watched ${l.rocket}`}>watched</button>
            </div>
          ))}

          {apod && !apod.error && (
            <div className="sg-apod">
              <div className="sg-h">NASA picture of the day</div>
              {apod.media_type === "image" ? (
                <a href={apod.hdurl || apod.url} target="_blank" rel="noreferrer"><img src={apod.url} alt={apod.title} loading="lazy" /></a>
              ) : (
                <a className="sg-link" href={apod.url} target="_blank" rel="noreferrer">▶ watch today’s video</a>
              )}
              <b>{apod.title}</b>
              {apod.copyright && <em>© {apod.copyright.trim()}</em>}
              <p>{apod.explanation}</p>
            </div>
          )}

          <div className="sg-h">seen it ({seen.length})</div>
          <div className="sg-seenadd">
            <input className="line-input" value={other} onChange={(e) => setOther(e.target.value)} placeholder="saw a meteor, a comet…" aria-label="Something else you saw"
              onKeyDown={(e) => { if (e.key === "Enter" && other.trim()) { log("other", other.trim()); setOther(""); } }} />
            <button className="mini-btn" disabled={!other.trim()} onClick={() => { log("other", other.trim()); setOther(""); }}>log</button>
          </div>
          {seen.slice(0, 30).map((x) => (
            <div key={x.id} className="sg-seen">
              <span>{SEEN_ICON[x.kind] ?? "✨"} {x.label}</span>
              <em>{new Date(x.at).toLocaleDateString([], { month: "short", day: "numeric" })}</em>
              <button className="x-btn" onClick={() => unlog(x.id)} aria-label={`Remove ${x.label}`}>✕</button>
            </div>
          ))}
          <PlaceFold place={place} mine={own} onPlace={setPlace} />
        </>
      )}
      <Credit at={launchQ.at} loading={launchQ.loading} error={launchQ.error && !launchQ.data} stale={launchQ.stale} reload={launchQ.reload}>
        {expanded ? "moon here · Open-Meteo · wheretheiss.at · Launch Library 2 · NASA" : "Launch Library 2"}
      </Credit>
    </div>
  );
}
