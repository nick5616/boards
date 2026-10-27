import { useMemo } from "react";
import { useCachedJSON } from "../../lib/apis";
import { clock } from "../../lib/sky";
import {
  wxUrl, aqUrl, wxKey, aqKey, WX_TTL, summarize, showTemp, showWind, showPressure, aqiBand,
} from "../../lib/barometer";
import { usePlace } from "../../lib/place";
import { Seg, Empty, Credit, PlaceAsk } from "./kit";
import { PlaceFold } from "./SkyBits";

const INK = "#2a2520";

// Tick marks around the dial: one every 12 degrees from -60 to 60
const TICKS = Array.from({ length: 11 }, (_, i) => -60 + i * 12);

function Dial({ angle, pressure, units }) {
  return (
    <svg viewBox="0 0 200 190" className="bm-dial" role="img" aria-label="Barometer dial">
      <defs>
        <radialGradient id="bm-brass" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#f7e08a" />
          <stop offset="0.55" stopColor="#c9a13a" />
          <stop offset="1" stopColor="#8a6a1c" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="98" r="86" fill="url(#bm-brass)" stroke={INK} strokeWidth="2.5" />
      <circle cx="100" cy="98" r="72" fill="#fff6dc" stroke={INK} strokeWidth="2" />
      {[0, 90, 180, 270].map((a) => (
        <circle key={a} cx={100 + 79 * Math.sin((a * Math.PI) / 180)} cy={98 - 79 * Math.cos((a * Math.PI) / 180)} r="2" fill="#7a5a14" stroke={INK} strokeWidth="0.8" />
      ))}
      {/* weather words on the arc, like a real aneroid */}
      <g fontFamily="'Caveat', cursive" fontSize="11" fill={INK} textAnchor="middle">
        <text x="100" y="52">steady</text>
        <text x="46" y="82" transform="rotate(-32 46 82)">falling</text>
        <text x="154" y="82" transform="rotate(32 154 82)">rising</text>
      </g>
      <g stroke={INK} strokeLinecap="round">
        {TICKS.map((a) => (
          <line key={a} x1="100" y1="34" x2="100" y2={a % 60 === 0 || a === 0 ? 42 : 39} strokeWidth={a === 0 ? 2 : 1.2} transform={`rotate(${a} 100 98)`} />
        ))}
      </g>
      <path d="M43 98 A57 57 0 0 1 60 58" fill="none" stroke="#4a86b5" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      <path d="M157 98 A57 57 0 0 0 140 58" fill="none" stroke="#e0a030" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      <text x="100" y="128" textAnchor="middle" fontSize="15" fontWeight="700" fill={INK}>{showPressure(pressure, units)}</text>
      <g className="bm-needle" style={{ transform: `rotate(${angle}deg)`, transformOrigin: "100px 98px" }}>
        <path d="M100 98 L96.5 98 L100 40 L103.5 98 Z" fill="#c0392b" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M100 98 L97 98 L100 112 L103 98 Z" fill={INK} />
      </g>
      <circle cx="100" cy="98" r="6" fill="url(#bm-brass)" stroke={INK} strokeWidth="1.8" />
    </svg>
  );
}

// An hour strip: bars for the chance of rain, a dot for the temperature
function Strip({ hours, units, off }) {
  if (!hours.length) return null;
  const temps = hours.map((h) => h.feels);
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  return (
    <div className="bm-strip" aria-label="Next twelve hours">
      {hours.map((h, i) => (
        <div key={h.t} className="bm-hr" title={`${clock(h.t, off)}: ${showTemp(h.feels, units)}, ${h.pop}% rain`}>
          <span className="bm-pop"><i style={{ height: `${Math.max(2, h.pop)}%` }} /></span>
          <b style={{ marginBottom: `${hi === lo ? 8 : ((h.feels - lo) / (hi - lo)) * 14}px` }}>{showTemp(h.feels, units)}</b>
          <em>{i % 2 === 0 ? clock(h.t, off).replace(/(am|pm)$/, "") : ""}</em>
        </div>
      ))}
    </div>
  );
}

// A brass barometer on the wall: the needle swings with the pressure trend, and under it
// one line that matters (bad air, rain coming, or a good hour to run). Opened big it adds
// the hours ahead, the air and units. Open-Meteo weather and air quality, no key, cached
// half an hour. State: place {name,lat,lon} (only if different from home), units "F"|"C".
export default function Barometer({ mod, setState, expanded }) {
  const { units = "F" } = mod.state;
  const { place, own } = usePlace(mod.state.place);
  const wx = useCachedJSON(place ? wxUrl(place) : null, { ttl: WX_TTL, key: place && wxKey(place) });
  const aq = useCachedJSON(place ? aqUrl(place) : null, { ttl: WX_TTL, key: place && aqKey(place) });
  const s = useMemo(() => summarize(wx.data, aq.data), [wx.data, aq.data]);
  const band = aqiBand(s?.aqi);
  const uvNow = s?.next12[0]?.uv;
  const setPlace = (p) => setState((x) => ({ ...x, place: p }));

  if (!place) {
    return <Empty action={<PlaceAsk why="where should the barometer read?" onPlace={setPlace} />}>The glass needs a place.</Empty>;
  }

  // The one line worth reading on the small card
  const headline = !s ? null
    : s.aqi != null && s.aqi > 100 ? `AQI ${s.aqi} · ${band.word}`
    : s.rainAt ? `☔ rain at ${clock(s.rainAt.t, s.off)} (${s.rainAt.pop}%)`
    : s.run?.hour ? `🏃 good run hour: ${clock(s.run.hour.t, s.off)}`
    : `🌤 dry · ${showTemp(s.now.feels, units)} feels`;

  return (
    <div className="bm">
      <Dial angle={s?.trend.angle ?? 0} pressure={s?.now.pressure} units={units} />
      <div className="bm-plaque">
        {s ? <><b>{s.trend.word}</b> · {s.trend.label}</> : wx.error ? "couldn't reach the weather" : "reading the glass…"}
      </div>
      {headline && <div className="bm-line">{headline}</div>}

      {expanded && s && (
        <>
          <div className="bm-now">
            <span><b>{showTemp(s.now.temp, units)}</b>now</span>
            <span><b>{showTemp(s.now.feels, units)}</b>feels</span>
            <span><b>{showWind(s.now.wind, units)}</b>wind</span>
            <span><b>{uvNow != null ? Math.round(uvNow) : "–"}</b>UV</span>
          </div>
          <Strip hours={s.next12} units={units} off={s.off} />
          <div className={`bm-run${s.run?.none ? " no" : ""}`}>
            {s.run?.hour
              ? <>🏃 good hour for a run: <b>{clock(s.run.hour.t, s.off)}</b> · {showTemp(s.run.hour.feels, units)} feels, {s.run.why}</>
              : s.run?.none ? <>🏃 skip the run: {s.run.none}</> : null}
          </div>
          <div className="bm-air">
            {band ? <span className="bm-aqi" style={{ background: band.color }}>AQI {s.aqi} · {band.word}</span> : <span className="bm-aqi none">no air reading here</span>}
            {s.pollen.length > 0 && <span className="bm-pollen">🌼 {s.pollen.slice(0, 3).map((x) => `${x.name} ${Math.round(x.n)}`).join(", ")}</span>}
          </div>
          <Seg small label="Units" value={units} onChange={(u) => setState((x) => ({ ...x, units: u }))} options={[{ id: "F", label: "°F · mph" }, { id: "C", label: "°C · km/h" }]} />
          <PlaceFold place={place} mine={own} onPlace={setPlace} />
        </>
      )}
      <Credit at={wx.at} loading={wx.loading} error={wx.error} stale={wx.stale} reload={() => { wx.reload(); aq.reload(); }}>Open-Meteo</Credit>
    </div>
  );
}
