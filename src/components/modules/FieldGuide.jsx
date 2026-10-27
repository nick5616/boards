import { useState, useEffect } from "react";
import { useCachedJSON, cachedJSON, useApiKey, KEYS, DAY } from "../../lib/apis";
import { uid } from "../../utils/uid";
import {
  GROUPS, SEEN_TTL, seenUrl, seenKey, seenList, searchUrl, speciesOf, onList, newLife, newThisMonth,
  ebirdUrl, ebirdKey, ebirdInit, RADIUS_KM,
} from "../../lib/fieldguide";
import { usePlace } from "../../lib/place";
import { Seg, Empty, ChipRow, Credit, PlaceAsk } from "./kit";
import { PlaceFold } from "./SkyBits";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function Card({ sp, listed, onSaw }) {
  return (
    <div className={`fg-card${listed ? " got" : ""}`}>
      {sp.photo ? <img src={sp.photo} alt={sp.name} loading="lazy" title={sp.credit} /> : <div className="fg-nophoto" aria-hidden="true">{GROUPS.find((g) => g.id === sp.group)?.icon ?? "🔎"}</div>}
      <b>{sp.name}</b>
      <em>{sp.sci !== sp.name ? sp.sci : ""}</em>
      {sp.count != null && <span className="fg-n">{sp.count.toLocaleString()} sightings</span>}
      <button className="mini-btn ghost" disabled={listed} onClick={() => onSaw(sp)}>
        {listed ? "✓ on your list" : "I saw it"}
      </button>
    </div>
  );
}

// A field notebook: what iNaturalist's community is seeing near you this month, and your
// own life list. Straight from iNaturalist in the browser (no key). The small card is the
// nearby birds (or whatever group) and the list; search, other months, eBird (needs a free
// key) and the place are in the big view.
// State: place {name,lat,lon} (only if different from home),
// life [{ id, taxonId, name, sci, photo, group, at, note, place }].
export default function FieldGuide({ mod, setState, expanded, openBig }) {
  const { life = [] } = mod.state;
  const { place, own } = usePlace(mod.state.place);
  const [tab, setTab] = useState("near"); // near | life
  const [group, setGroup] = useState("birds");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [q, setQ] = useState("");
  const [found, setFound] = useState(null); // search results
  const [lifeGroup, setLifeGroup] = useState("all");
  const ebird = useApiKey("ebird");

  const near = useCachedJSON(place ? seenUrl(place, group, month) : null, { ttl: SEEN_TTL, key: place && seenKey(place, group, month) });
  const birds = useCachedJSON(expanded && place && ebird ? ebirdUrl(place) : null, { ttl: SEEN_TTL / 4, key: place && ebirdKey(place), init: ebirdInit() });

  // Type to look any species up (iNaturalist's taxon search), after a short pause
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setFound(null); return; }
    let live = true;
    const t = setTimeout(() => {
      cachedJSON(searchUrl(term), { ttl: DAY })
        .then((r) => live && setFound((r.data.results ?? []).map((x) => speciesOf(x))))
        .catch(() => live && setFound([]));
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  const saw = (sp) => setState((s) => ((s.life ?? []).length && onList(s.life, sp) ? s : { ...s, life: [newLife(uid(), sp, s.place ?? place), ...(s.life ?? [])] }));
  const patch = (id, f) => setState((s) => ({ ...s, life: (s.life ?? []).map((x) => (x.id === id ? { ...x, ...f } : x)) }), { debounce: 500 });
  const drop = (id) => setState((s) => ({ ...s, life: (s.life ?? []).filter((x) => x.id !== id) }));
  const setPlace = (p) => setState((s) => ({ ...s, place: p }));

  const species = seenList(near.data);
  const shownLife = life.filter((x) => lifeGroup === "all" || x.group === lifeGroup);
  const listed = new Set(life.map((x) => x.taxonId ?? x.name.toLowerCase())).size;
  const fresh = newThisMonth(life);
  const cap = expanded ? 30 : 2;
  const chips = (cur, set) => (
    <ChipRow label="Kind of life">
      {GROUPS.map((g) => (
        <button key={g.id} className={`mini-btn${cur === g.id ? "" : " ghost"}`} onClick={() => set(g.id)} aria-pressed={cur === g.id}>{g.icon} {g.label}</button>
      ))}
    </ChipRow>
  );

  return (
    <div className="fg">
      <Seg label="Field guide" value={tab} onChange={setTab}
        options={[{ id: "near", label: "seen nearby" }, { id: "life", label: `my list · ${listed}` }]} />
      {expanded && (
        <input className="line-input fg-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="look up any plant, bird, bug…" aria-label="Look up a species" />
      )}
      {found && (
        <div className="fg-grid">
          {found.length === 0 && <div className="fg-empty">nothing by that name</div>}
          {found.map((sp) => <Card key={sp.taxonId} sp={sp} listed={onList(life, sp)} onSaw={saw} />)}
        </div>
      )}

      {tab === "near" && !found && (!place ? (
        <Empty action={<PlaceAsk why="which neighbourhood?" onPlace={setPlace} />}>What's been seen near you?</Empty>
      ) : (
        <>
          {chips(group, setGroup)}
          {expanded && (
            <div className="fg-month">
              <button className="x-btn" onClick={() => setMonth((m) => (m === 1 ? 12 : m - 1))} aria-label="Previous month">‹</button>
              <span>seen in <b>{MONTHS[month - 1]}</b> within {RADIUS_KM} km</span>
              <button className="x-btn" onClick={() => setMonth((m) => (m === 12 ? 1 : m + 1))} aria-label="Next month">›</button>
            </div>
          )}
          {near.loading && !species.length && <div className="fg-empty">flipping through the pages…</div>}
          <div className="fg-grid">
            {species.slice(0, cap).map((sp) => <Card key={sp.taxonId} sp={sp} listed={onList(life, sp)} onSaw={saw} />)}
          </div>
          {!expanded && species.length > cap && <button className="mini-btn ghost fg-more" onClick={openBig}>+ {species.length - cap} more</button>}

          {expanded && (group === "all" || group === "birds") && (
            <div className="fg-ebird">
              <div className="fg-h">eBird this week</div>
              {!ebird ? (
                <div className="fg-note">needs a free eBird key: <a href={KEYS.ebird.get} target="_blank" rel="noreferrer">get one</a>, then paste it in Settings → API keys</div>
              ) : birds.error ? (
                <div className="fg-note">eBird said no (check your key)</div>
              ) : (
                (birds.data ?? []).slice(0, 20).map((o) => {
                  const sp = { taxonId: null, name: o.comName, sci: o.sciName, photo: null, group: "birds" };
                  return (
                    <div key={`${o.speciesCode}-${o.locId}-${o.obsDt}`} className="fg-bird">
                      <span><b>{o.comName}</b>{o.howMany ? ` ×${o.howMany}` : ""}<em>{o.locName} · {o.obsDt}</em></span>
                      <button className="mini-btn ghost" disabled={onList(life, sp)} onClick={() => saw(sp)}>{onList(life, sp) ? "✓" : "I saw it"}</button>
                    </div>
                  );
                })
              )}
            </div>
          )}
          {expanded && <PlaceFold place={place} mine={own} onPlace={setPlace} />}
        </>
      ))}

      {tab === "life" && !found && (
        <>
          {life.length > 0 && chips(lifeGroup, setLifeGroup)}
          {life.length === 0 && <Empty action={<button className="mini-btn" onClick={() => setTab("near")}>see what's nearby</button>}>Your life list is empty.</Empty>}
          {shownLife.slice(0, expanded ? 200 : 4).map((x) => (
            <div key={x.id} className="fg-entry">
              {x.photo ? <img src={x.photo} alt="" loading="lazy" /> : <div className="fg-nophoto sm" aria-hidden="true">{GROUPS.find((g) => g.id === x.group)?.icon ?? "🔎"}</div>}
              <div>
                <b>{x.name}</b>
                <em>{new Date(x.at).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}{x.place ? ` · ${x.place}` : ""}</em>
                {expanded && <input className="line-input" defaultValue={x.note} placeholder="a note…" onChange={(e) => patch(x.id, { note: e.target.value })} aria-label={`Note for ${x.name}`} />}
              </div>
              {expanded && <button className="x-btn" onClick={() => drop(x.id)} aria-label={`Remove ${x.name}`}>✕</button>}
            </div>
          ))}
          {!expanded && shownLife.length > 4 && <button className="mini-btn ghost fg-more" onClick={openBig}>+ {shownLife.length - 4} more</button>}
        </>
      )}

      <Credit at={tab === "near" ? near.at : null} loading={near.loading} error={near.error && !species.length} stale={near.stale} reload={near.reload}>
        iNaturalist{fresh ? ` · ${fresh} new this month` : ""}
      </Credit>
    </div>
  );
}
