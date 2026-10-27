import { useState, useEffect, useId, useMemo } from "react";
import { useCachedJSON } from "../../lib/apis";
import { clock, inLabel } from "../../lib/sky";
import {
  getStations, nearest, NEAR_KM, tideUrl, tideKey, TIDE_TTL, marineUrl, marineKey, MARINE_TTL,
  noaaEvents, marineEvents, phaseAt, showHeight, showWave,
} from "../../lib/tides";
import { usePlace } from "../../lib/place";
import { haversine } from "../../lib/sky";
import { Seg, Empty, Credit, PlaceAsk } from "./kit";
import { PlaceFold } from "./SkyBits";

const INK = "#2a2520";

// A round tide clock: the water in the face rises and falls, and the hand sweeps once per
// tide — straight up at high water, straight down at low, so it always points at what's next.
function Face({ phase }) {
  const id = useId();
  const level = phase?.level ?? 0.5;
  const y = 56 - level * 104; // water surface, from the rim (full) to the bottom (empty)
  return (
    <svg viewBox="-60 -60 120 120" className="td-face" role="img" aria-label={phase ? `${phase.rising ? "Rising" : "Falling"} tide` : "Tide clock"}>
      <defs><clipPath id={id}><circle r="51" /></clipPath></defs>
      <circle r="58" fill="#c9a13a" stroke={INK} strokeWidth="2.5" />
      <circle r="51" fill="#fff6dc" stroke={INK} strokeWidth="2" />
      <g clipPath={`url(#${id})`}>
        <path
          d={`M-60 ${y} q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V60 H-60Z`}
          fill="#6fb3d9" stroke={INK} strokeWidth="1.6" opacity="0.85"
          className="td-water"
        />
      </g>
      <g stroke={INK} strokeLinecap="round">
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} y1="-51" y2={i % 3 === 0 ? -43 : -47} strokeWidth={i % 3 === 0 ? 2 : 1.2} transform={`rotate(${i * 30})`} />
        ))}
      </g>
      <g fontSize="8" fontWeight="700" fill={INK} textAnchor="middle" fontFamily="'Caveat', cursive">
        <text y="-34">HIGH</text>
        <text y="42">LOW</text>
      </g>
      <g className="td-hand" style={{ transform: `rotate(${phase?.angle ?? 0}deg)` }}>
        <path d="M0 6 L-2.6 0 L0 -40 L2.6 0 Z" fill="#c0392b" stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
      </g>
      <circle r="4" fill="#c9a13a" stroke={INK} strokeWidth="1.6" />
    </svg>
  );
}

// The clock face, then the next high or low. Opened big: the coming tides, waves, station,
// units and place. State: place {name,lat,lon} (only if different from home),
// station {id,name,lat,lon} | null (NOAA, US only), units "ft"|"m",
// noStation (the place the person chose "model only" for).
export default function Tides({ mod, setState, expanded }) {
  const { station: saved = null, units = "ft" } = mod.state;
  const { place, own } = usePlace(mod.state.place);
  const [now, setNow] = useState(Date.now());
  const [list, setList] = useState(null); // NOAA's stations (slimmed)
  const [stationErr, setStationErr] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const lat = place?.lat;
  useEffect(() => {
    if (lat == null) return;
    let live = true;
    getStations().then((l) => live && (setList(l), setStationErr(false))).catch(() => live && setStationErr(true));
    return () => { live = false; };
  }, [lat]);

  const close = useMemo(() => (list && place ? nearest(list, place, 6) : []), [list, place]); // eslint-disable-line react-hooks/exhaustive-deps
  const inReach = close.filter((x) => x.km <= NEAR_KM);
  // A saved station only counts while it's still near the place we're looking at
  const station = saved && place && haversine(saved, place) <= NEAR_KM * 1.5 ? saved : null;

  // At a new place, take the nearest station if one is truly near
  useEffect(() => {
    if (!place || !list || station) return;
    if (mod.state.noStation === `${place.lat},${place.lon}`) return;
    if (close[0] && close[0].km <= NEAR_KM) {
      const c = close[0];
      setState((s) => ({ ...s, station: { id: c.id, name: c.name, lat: c.lat, lon: c.lon } }));
    }
  }, [list, place, station]); // eslint-disable-line react-hooks/exhaustive-deps

  const where = station ?? place;
  const tide = useCachedJSON(station ? tideUrl(station.id) : null, { ttl: TIDE_TTL, key: station && tideKey(station.id) });
  const marine = useCachedJSON(where ? marineUrl(where) : null, { ttl: MARINE_TTL, key: where && marineKey(where) });

  const setPlace = (p) => setState((s) => ({ ...s, place: p, station: null, noStation: "" }));
  if (!place) {
    return <Empty action={<PlaceAsk why="which coast?" onPlace={setPlace} />}>The tide clock needs a place.</Empty>;
  }

  const off = marine.data?.utc_offset_seconds ?? null;
  const noaa = station && !tide.error ? noaaEvents(tide.data) : [];
  const events = noaa.length ? noaa : marineEvents(marine.data);
  const modelled = !noaa.length && events.length > 0;
  const phase = phaseAt(events, now);
  const upcoming = events.filter((e) => e.t > now).slice(0, 6);
  const wave = marine.data?.current;

  const pickStation = (id) => {
    const c = close.find((x) => x.id === id);
    setState((x) => ({
      ...x,
      station: c ? { id: c.id, name: c.name, lat: c.lat, lon: c.lon } : null,
      noStation: c ? "" : `${place.lat},${place.lon}`,
    }));
  };

  return (
    <div className="td">
      <Face phase={phase} />
      <div className="td-next">
        {phase ? (
          <>
            <b>{phase.next.type === "H" ? "high" : "low"} tide {clock(phase.next.t, off)}</b>
            <em>{inLabel(phase.next.t, now)} · {phase.rising ? "coming in" : "going out"} · {showHeight(phase.next.ft, units)}</em>
          </>
        ) : tide.loading || marine.loading ? <em>reading the sea…</em> : <em>no tide times for here</em>}
      </div>
      {wave?.wave_height != null && (
        <div className="td-wave">waves {showWave(wave.wave_height, units)}{wave.wave_period != null ? ` every ${Math.round(wave.wave_period)}s` : ""}</div>
      )}

      {expanded && (
        <>
          {upcoming.length > 0 && (
            <div className="td-list">
              {upcoming.map((e) => (
                <div key={e.t} className={e.type === "H" ? "hi" : "lo"}>
                  <span>{e.type === "H" ? "▲ high" : "▼ low"}</span>
                  <b>{clock(e.t, off)}</b>
                  <em>{new Date(e.t + (off ?? -new Date().getTimezoneOffset() * 60) * 1000).toLocaleDateString([], { weekday: "short", timeZone: "UTC" })} · {showHeight(e.ft, units)}</em>
                </div>
              ))}
            </div>
          )}
          <div className="td-station">
            {stationErr ? "couldn't load NOAA's station list" : !list ? "finding tide stations…" : inReach.length === 0 ? (
              <>no NOAA station within {NEAR_KM} km (US only){modelled ? ", so this is Open-Meteo’s sea level model" : ""}</>
            ) : (
              <label>
                station{" "}
                <select value={station?.id ?? ""} onChange={(e) => pickStation(e.target.value)} aria-label="Tide station">
                  {inReach.map((x) => <option key={x.id} value={x.id}>{x.name}, {x.state} · {Math.round(x.km)} km</option>)}
                  <option value="">none (model only)</option>
                </select>
              </label>
            )}
          </div>
          <Seg small label="Units" value={units} onChange={(u) => setState((s) => ({ ...s, units: u }))} options={[{ id: "ft", label: "feet" }, { id: "m", label: "metres" }]} />
          <PlaceFold place={place} mine={own} onPlace={(p) => (p ? setState((s) => ({ ...s, place: p, station: null, noStation: "" })) : setState((s) => ({ ...s, place: null, station: null, noStation: "" })))} />
        </>
      )}
      <Credit at={tide.at ?? marine.at} loading={tide.loading || marine.loading} stale={tide.stale || marine.stale} reload={() => { tide.reload(); marine.reload(); }}>
        {station ? "NOAA" : "Open-Meteo"}{expanded ? " · for planning, not navigation" : ""}
      </Credit>
    </div>
  );
}
