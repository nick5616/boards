import { useState, useEffect } from "react";
import { uid } from "../../utils/uid";
import { dayKey } from "../../utils/date";
import { usePlace } from "../../lib/place";
import { Seg, Fold, Credit, PlaceAsk } from "./kit";
import { onThisDay } from "../../lib/wiki";
import { moonPhase, sunTimes, clock, featured, factLine } from "../../lib/almanac";

const TABS = [
  { id: "events", label: "events" },
  { id: "births", label: "born" },
  { id: "deaths", label: "died" },
  { id: "holidays", label: "holidays" },
];

// A tear-off almanac page for today: what happened on this day (Wikimedia), holidays,
// sunrise and sunset for a place (Open-Meteo), and the moon (worked out here).
// State: place {name,lat,lon} | null, favs [{ id, text, year, title, url, md }],
// today { day, line } (the glance line, saved when today's page loads).
export default function Almanac({ mod, setState, expanded }) {
  const { favs = [] } = mod.state ?? {};
  const { place, own } = usePlace(mod.state?.place);
  const [off, setOff] = useState(0); // pages torn off: 0 = today
  const [tab, setTab] = useState("events");
  const [feed, setFeed] = useState(null);
  const [err, setErr] = useState(false);
  const [n, setN] = useState(0); // which fact on the page
  const [sun, setSun] = useState(null);
  const [shelf, setShelf] = useState(false);

  const date = new Date();
  date.setDate(date.getDate() + off);
  const key = dayKey(date);
  const moon = moonPhase(date);

  useEffect(() => {
    let live = true;
    setFeed(null); setErr(false); setN(0);
    onThisDay(date)
      .then((f) => {
        if (!live) return;
        setFeed(f);
        if (off === 0) {
          const e = featured(f, date);
          if (e) setState((s) => (s.today?.day === key ? s : { ...s, today: { day: key, line: factLine(e) } }));
        }
      })
      .catch(() => live && setErr(true));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const lat = place?.lat, lon = place?.lon;
  useEffect(() => {
    setSun(null);
    if (lat == null) return;
    let live = true;
    sunTimes({ lat, lon }, date).then((s) => live && setSun(s)).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, key]);

  const list = (tab === "events" ? [...(feed?.selected ?? []), ...(feed?.events ?? [])] : feed?.[tab] ?? [])
    .filter((e, i, a) => e.text && a.findIndex((x) => x.text === e.text) === i);
  // the day's featured fact leads the events
  const lead = tab === "events" && feed ? featured(feed, date) : null;
  const items = lead ? [lead, ...list.filter((e) => e !== lead)] : list;
  const it = items.length ? items[((n % items.length) + items.length) % items.length] : null;
  const pg = it?.pages?.find((p) => p.thumbnail) ?? it?.pages?.[0];
  const md = key.slice(5);

  const isFav = (e) => favs.some((f) => f.text === e.text && f.md === md);
  const keep = (e) => {
    if (isFav(e)) { setState((s) => ({ ...s, favs: (s.favs ?? []).filter((f) => !(f.text === e.text && f.md === md)) })); return; }
    const p = e.pages?.[0];
    setState((s) => ({
      ...s,
      favs: [{ id: uid(), text: e.text, year: e.year ?? null, md, title: p?.titles?.normalized ?? p?.title ?? "", url: p?.content_urls?.desktop?.page ?? "" }, ...(s.favs ?? [])].slice(0, 200),
    }));
  };

  const setPlace = (p) => setState((s) => ({ ...s, place: p }));

  const month = date.toLocaleDateString(undefined, { month: "long" });
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });

  const idx = items.length ? ((n % items.length) + items.length) % items.length : 0;
  const placeRow = sun ? (
    <div className="al-sun">
      <span>🌅 {clock(sun.sunrise)}</span>
      <span>🌇 {clock(sun.sunset)}</span>
    </div>
  ) : null;

  const kept = (
    <div className="al-kept">
      {favs.length ? favs.map((f) => (
        <div key={f.id} className="al-kept-row">
          <b>{f.year != null ? f.year : "—"}</b>
          <span>{f.text}{f.url && <> <a href={f.url} target="_blank" rel="noreferrer">↗</a></>}</span>
          <button className="x-btn" onClick={() => setState((s) => ({ ...s, favs: (s.favs ?? []).filter((x) => x.id !== f.id) }))} aria-label="Remove">✕</button>
        </div>
      )) : <i className="al-none">tap ♡ on a fact to keep it</i>}
    </div>
  );

  const extras = (
    <>
      <div className="al-tear">
        {off !== 0 && <button className="mini-btn ghost" onClick={() => setOff(0)}>back to today</button>}
        <button className="mini-btn ghost" onClick={() => setOff(off + 1)}>tomorrow&apos;s ✂</button>
        {off > -7 && <button className="mini-btn ghost" onClick={() => setOff(off - 1)}>yesterday&apos;s</button>}
      </div>
      {own && <button className="mini-btn ghost" onClick={() => setPlace(null)}>use my home place</button>}
      <PlaceAsk why={place ? `${place.name}${own ? "" : " (home)"} · pick another` : "for sunrise & sunset"} onPlace={setPlace} home={!place} />
      {kept}
    </>
  );

  return (
    <div className="al">
      <div className="al-page" key={key}>
        <div className="al-band" aria-hidden="true" />
        <div className="al-date">
          <span className="al-month">{month} · {weekday}{off === 0 ? "" : off > 0 ? ` · +${off}` : ` · ${off}`}</span>
          <b className="al-day">{date.getDate()}</b>
        </div>

        <div className="al-sky">
          <span className="al-moon" title={`${moon.name}, ${Math.round(moon.lit * 100)}% lit`}>{moon.icon} {moon.name}</span>
          {placeRow}
        </div>

        {expanded && (
          <Seg options={TABS} value={tab} onChange={(t) => { setTab(t); setN(0); }} label="Kind of fact" small />
        )}

        <div className="al-fact" aria-live="polite">
          {err ? <i className="al-none">couldn&apos;t reach Wikipedia right now</i>
            : !feed ? <i className="al-none">turning the page…</i>
            : it ? (
              <>
                {it.year != null && <b className="al-year">{it.year < 0 ? `${-it.year} BC` : it.year}</b>}
                {pg?.thumbnail?.source && expanded && <img className="al-pic" src={pg.thumbnail.source} alt="" loading="lazy" />}
                <p className={expanded ? "" : "clamp"}>{it.text}</p>
              </>
            ) : <i className="al-none">nothing listed</i>}
        </div>

        <div className="al-btns">
          <button className="x-btn" onClick={() => setN(n - 1)} disabled={items.length < 2} aria-label="Previous fact">‹</button>
          <span className="al-count">{items.length ? `${idx + 1} / ${items.length}` : ""}</span>
          <button className="x-btn" onClick={() => setN(n + 1)} disabled={items.length < 2} aria-label="Next fact">›</button>
          <button className={`al-heart${it && isFav(it) ? " on" : ""}`} onClick={() => it && keep(it)} disabled={!it} aria-pressed={!!(it && isFav(it))} aria-label="Keep this fact">
            {it && isFav(it) ? "♥" : "♡"}
          </button>
        </div>
      </div>

      {expanded ? extras : <Fold label={place ? "more" : "add a place, kept facts"}>{extras}</Fold>}
      <Credit loading={!feed && !err} error={err}>
        Wikipedia · CC BY-SA{pg?.content_urls?.desktop?.page ? <> · <a href={pg.content_urls.desktop.page} target="_blank" rel="noreferrer">{pg.titles?.normalized ?? pg.title}</a></> : null}
      </Credit>
    </div>
  );
}
