import { useState, useEffect } from "react";
import MapPaper from "../map/MapPaper";
import { haversine } from "../../lib/geo";
import { usePlace } from "../../lib/place";
import { PLACE_KINDS, kindById, nearbyPlaces, findAddress, fmtDistance } from "../../lib/travel";
import { Empty, Fold, ChipRow, Credit, PlaceAsk } from "./kit";

const SHOWN = 3; // rows on the small card

// A folded paper map with pins for the errands you're running. Pick a kind of place and
// it asks OpenStreetMap (Overpass) what's within a couple of kilometres; pin the ones you
// mean to visit and check them off. Starts from the shared home place; an address search
// (Nominatim, one ask at a time) picks a different one for just this module.
// State: place {name,lat,lon}|null (own override), kind (PLACE_KINDS id),
// pins [{ id, name, lat, lon, kind, addr, done, note }].
export default function Errands({ mod, setState, expanded, openBig }) {
  const { place: ownPlace = null, kind = "thrift", pins = [] } = mod.state;
  const { place, own } = usePlace(ownPlace);
  const [found, setFound] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [addr, setAddr] = useState("");
  const [msg, setMsg] = useState("");
  const [nonce, setNonce] = useState(0);
  const [at, setAt] = useState(null);

  const lat = place?.lat;
  const lon = place?.lon;
  useEffect(() => {
    if (lat == null) return;
    let live = true;
    setStatus("loading");
    nearbyPlaces(kind, [lat, lon], 2000, nonce > 0)
      .then((r) => live && (setFound(r), setAt(Date.now()), setStatus("idle")))
      .catch(() => live && (setFound([]), setStatus("error")));
    return () => { live = false; };
  }, [lat, lon, kind, nonce]);

  const patch = (f) => setState((s) => ({ ...s, ...f }));
  const here = place ? [place.lat, place.lon] : null;
  const dist = (p) => (here ? haversine(here, [p.lat, p.lon]) : null);

  const lookup = async () => {
    if (!addr.trim()) return;
    setMsg("");
    try {
      const p = await findAddress(addr.trim());
      if (p) { patch({ place: p }); setAddr(""); } else setMsg(`nothing found for “${addr.trim()}”`);
    } catch { setMsg("couldn't reach the address finder"); }
  };

  const pinned = (p) => pins.some((x) => x.id === p.id);
  const pin = (p) => patch({ pins: [...pins, { id: p.id, name: p.name, lat: p.lat, lon: p.lon, kind: p.kind, addr: p.addr, done: false, note: "" }] });
  const setPin = (id, f) => setState((s) => ({ ...s, pins: (s.pins ?? []).map((x) => (x.id === id ? { ...x, ...f } : x)) }));

  const open = pins.filter((p) => !p.done).sort((a, b) => (dist(a) ?? 0) - (dist(b) ?? 0));
  const doneList = pins.filter((p) => p.done);
  const k = kindById(kind);
  const unpinned = found.filter((p) => !pinned(p));
  const openShown = expanded ? open : open.slice(0, SHOWN);
  const foundShown = expanded ? unpinned.slice(0, 20) : open.length ? [] : unpinned.slice(0, SHOWN);
  const hidden = (open.length - openShown.length) + (expanded || open.length ? 0 : Math.max(0, unpinned.length - SHOWN));

  const mapPins = [
    ...(here ? [{ pt: here, kind: "me" }] : []),
    ...unpinned.slice(0, 30).map((p) => ({ pt: [p.lat, p.lon], kind: "dot" })),
    ...open.map((p) => ({ pt: [p.lat, p.lon], kind: "end", label: p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name })),
  ];

  if (!place) return <div className="er"><PlaceAsk why="where should the errands start from?" /></div>;

  return (
    <div className="er">
      <ChipRow label="Kind of place">
        {PLACE_KINDS.map((x) => (
          <button key={x.id} className={`er-chip${x.id === kind ? " on" : ""}`} aria-pressed={x.id === kind} onClick={() => patch({ kind: x.id })}>
            {x.icon} {x.label}
          </button>
        ))}
      </ChipRow>

      <div className={`er-map${expanded ? " big" : ""}`}>
        <MapPaper center={here} zoom={14} fit={[here, ...open.map((p) => [p.lat, p.lon]).slice(0, 6)]} fitKey={`${lat},${lon}:${open.length}`} pins={mapPins} label={`Map of ${k.label} near ${place.name}`} />
      </div>

      {openShown.length > 0 && (
        <ul className="er-list">
          {openShown.map((p) => (
            <li key={p.id}>
              <input type="checkbox" checked={false} onChange={() => setPin(p.id, { done: true })} aria-label={`Done: ${p.name}`} />
              <div>
                <b>{p.name}</b>
                <small>{[dist(p) != null && fmtDistance(dist(p)), p.addr].filter(Boolean).join(" · ")}</small>
              </div>
              {expanded && <button className="x-btn" onClick={() => patch({ pins: pins.filter((x) => x.id !== p.id) })} aria-label={`Unpin ${p.name}`}>✕</button>}
            </li>
          ))}
        </ul>
      )}

      {foundShown.length > 0 && (
        <div className="er-found">
          {expanded && <div className="er-h">{k.label} nearby · {found.length}</div>}
          {foundShown.map((p) => (
            <div key={p.id} className="er-row">
              <div>
                <b>{p.name}</b>
                <small>{[fmtDistance(p.meters), p.addr].filter(Boolean).join(" · ")}</small>
              </div>
              <button className="mini-btn ghost" onClick={() => pin(p)} aria-label={`Pin ${p.name}`}>+ pin</button>
            </div>
          ))}
        </div>
      )}

      {status === "idle" && !found.length && !open.length && (
        <Empty>no named {k.label} within 2 km.</Empty>
      )}
      {hidden > 0 && <button className="mini-btn ghost er-more" onClick={openBig}>+ {hidden} more</button>}

      {expanded && doneList.length > 0 && (
        <details className="er-done">
          <summary>done · {doneList.length}</summary>
          {doneList.map((p) => (
            <div key={p.id} className="er-row gone">
              <span>{p.name}</span>
              <button className="x-btn" onClick={() => setPin(p.id, { done: false })} aria-label={`Undo ${p.name}`}>↺</button>
              <button className="x-btn" onClick={() => patch({ pins: pins.filter((x) => x.id !== p.id) })} aria-label={`Remove ${p.name}`}>✕</button>
            </div>
          ))}
        </details>
      )}

      {expanded && (
        <Fold label={`📍 ${place.name} · change`}>
          <div className="er-where">
            <input className="line-input" value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookup()} placeholder="an address or town…" aria-label="Address" />
            <button className="mini-btn" onClick={lookup} disabled={!addr.trim()}>go</button>
            {own && <button className="mini-btn ghost" onClick={() => patch({ place: null })}>use home</button>}
          </div>
          {msg && <div className="er-msg">{msg}</div>}
        </Fold>
      )}

      <Credit at={at} loading={status === "loading"} error={status === "error"} reload={() => setNonce(nonce + 1)}>© OpenStreetMap contributors</Credit>
    </div>
  );
}
