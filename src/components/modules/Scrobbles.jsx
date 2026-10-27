import { Seg, Empty, Fold, Credit } from "./kit";
import { useState, useEffect, useCallback } from "react";
import { useApiKey, KEYS } from "../../lib/apis";
import { useBoardContext } from "../board/BoardContext";
import { uid } from "../../utils/uid";
import { recentTracks, weeklyArtists, similarArtists, topAlbumBy } from "../../lib/music";

const ago = (ms) => {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};

// A little turntable that shows what you've been listening to, read from Last.fm
// (user.getrecenttracks and a weekly user.gettopartists). Needs a free Last.fm key
// in Settings, and the username to look up. Tap an artist for similar ones; if the
// board has a Record crate, each similar artist can drop an album into it.
// State: user, onRepeat { artist, plays } (remembered for the home Glance).
export default function Scrobbles({ mod, setState, expanded }) {
  const { user = "", onRepeat = null } = mod.state;
  const key = useApiKey("lastfm");
  const ctx = useBoardContext();
  const [name, setName] = useState(user);
  const [data, setData] = useState(null); // { tracks, artists }
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(null); // artist whose similar list is open
  const [sim, setSim] = useState(null); // { for, list } | { for, error }
  const [adding, setAdding] = useState({}); // artist -> "…" | "added" | "none"

  const crate = ctx?.board?.modules?.find((m) => m.type === "crate");

  const load = useCallback(async (force) => {
    if (!key || !user) return;
    setBusy(true);
    setErr("");
    try {
      const [tracks, artists] = await Promise.all([recentTracks(user, key, force), weeklyArtists(user, key, force)]);
      setData({ tracks, artists });
      const top = artists[0];
      // remember who's on repeat so the home screen can say so without asking again
      if (top && (onRepeat?.artist !== top.name || onRepeat?.plays !== top.plays)) {
        setState((s) => ({ ...s, onRepeat: { artist: top.name, plays: top.plays } }));
      }
    } catch (e) {
      setErr(e.message || "couldn't read Last.fm");
    }
    setBusy(false);
  }, [key, user, onRepeat?.artist, onRepeat?.plays, setState]);

  useEffect(() => {
    load(false);
    // reload only when the person or key changes; load() itself is stable enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, user]);

  const open = async (artist) => {
    if (pick === artist) { setPick(null); return; }
    setPick(artist);
    setSim(null);
    try {
      setSim({ for: artist, list: await similarArtists(artist, key) });
    } catch (e) {
      setSim({ for: artist, error: e.message });
    }
  };

  const toCrate = async (artist) => {
    setAdding((a) => ({ ...a, [artist]: "…" }));
    try {
      const album = await topAlbumBy(artist);
      if (!album) { setAdding((a) => ({ ...a, [artist]: "none" })); return; }
      ctx.onModules((ms) =>
        ms.map((m) => {
          if (m.id !== crate.id || (m.state.crate ?? []).some((c) => c.mbid === album.mbid)) return m;
          return { ...m, state: { ...m.state, crate: [{ id: uid(), ...album }, ...(m.state.crate ?? [])] } };
        })
      );
      setAdding((a) => ({ ...a, [artist]: "added" }));
    } catch {
      setAdding((a) => ({ ...a, [artist]: "none" }));
    }
  };

  const now = data?.tracks?.find((t) => t.playing);
  const last = now ?? data?.tracks?.[0];
  const spinning = !!now;
  const topPlays = Math.max(1, ...(data?.artists ?? []).map((a) => a.plays));

  const who = (
    <div className="sc-who">
      <input
        className="line-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && setState((s) => ({ ...s, user: name.trim() }))}
        placeholder="Last.fm username"
        aria-label="Last.fm username"
      />
      <button className="mini-btn" onClick={() => setState((s) => ({ ...s, user: name.trim() }))} disabled={!name.trim() || name.trim() === user}>
        spin
      </button>
    </div>
  );

  if (!key) {
    return (
      <div className={`sc${expanded ? " big" : ""}`}>
        <Empty action={<a className="mini-btn" href={KEYS.lastfm.get} target="_blank" rel="noreferrer">get a free key</a>}>
          Needs a free Last.fm key. Paste it in Settings → API keys.
        </Empty>
      </div>
    );
  }
  if (!user) {
    return (
      <div className={`sc${expanded ? " big" : ""}`}>
        <Empty action={who}>Whose Last.fm should the turntable spin?</Empty>
      </div>
    );
  }

  const shown = expanded ? data?.artists ?? [] : (data?.artists ?? []).slice(0, 3);

  return (
    <div className={`sc${expanded ? " big" : ""}`}>
      <div className="sc-deck">
        <div className={`sc-disc${spinning ? " spin" : ""}`} aria-hidden="true"><i /></div>
        <div className="sc-arm" aria-hidden="true" />
        <div className="sc-now">
          <b title={last?.name}>{last ? last.name : busy ? "dropping the needle…" : "nothing yet"}</b>
          <span>{last ? last.artist : ""}</span>
          {last && <em>{spinning ? "♪ playing now" : last.at ? `last played ${ago(last.at)}` : ""}</em>}
        </div>
      </div>

      {data && (
        <>
          {data.artists.length === 0 ? (
            <div className="sc-note">no plays this week yet</div>
          ) : (
            <div className="sc-artists">
              <div className="sc-h">on repeat this week</div>
              {shown.map((a) => (
                <div key={a.name} className="sc-art">
                  <button className="sc-artname" onClick={() => open(a.name)} aria-expanded={pick === a.name}>
                    <span>{a.name}</span>
                    <u style={{ width: `${(a.plays / topPlays) * 100}%` }} />
                  </button>
                  <em>{a.plays}</em>
                  {pick === a.name && (
                    <div className="sc-sim">
                      {!sim && <span className="sc-note">looking for kindred artists…</span>}
                      {sim?.error && <span className="sc-note bad">{sim.error}</span>}
                      {sim?.list?.length === 0 && <span className="sc-note">nobody similar turned up</span>}
                      {sim?.list?.map((n) => (
                        <span key={n} className="sc-simrow">
                          <span>{n}</span>
                          {crate && (
                            <button className="mini-btn ghost" onClick={() => toCrate(n)} disabled={!!adding[n]}>
                              {adding[n] === "added" ? "in crate ✓" : adding[n] === "none" ? "no album" : adding[n] === "…" ? "…" : "+ crate"}
                            </button>
                          )}
                        </span>
                      ))}
                      {!crate && sim?.list?.length > 0 && <span className="sc-note">add a Record crate to this board to collect these</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {expanded && (
            <ul className="sc-list">
              {data.tracks.slice(0, 12).map((t, i) => (
                <li key={`${t.name}${i}`} className={t.playing ? "now" : ""}>
                  <b>{t.name}</b> <span>{t.artist}</span> <em>{t.playing ? "now" : t.at ? ago(t.at) : ""}</em>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {err && <div className="sc-note bad">{err}</div>}
      <Fold label={`@${user}`} start={false}>{who}</Fold>
      <Credit loading={busy} error={!!err && !data} at={data ? Date.now() : null} reload={() => load(true)}>Last.fm</Credit>
    </div>
  );
}
