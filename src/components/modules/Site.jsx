import { useLayoutEffect, useRef, useState } from "react";
import { SITE_OF, siteHost } from "../../lib/sites";
import { useCachedJSON } from "../../lib/apis";
import { Seg, Credit } from "./kit";

const ALLOW = "fullscreen; clipboard-read; clipboard-write";

// One of Nicole's own sites, running right on the card. Heavy ones (3D worlds,
// multiplayer, camera) wait for a tap. Ones that can't be framed are a repo card.
export default function Site({ mod, setState, expanded }) {
  const site = SITE_OF[mod.type];
  if (site.frame === false) return <Repo site={site} expanded={expanded} />;
  return <Framed site={site} mod={mod} setState={setState} expanded={expanded} />;
}

function Framed({ site, mod, setState, expanded }) {
  const url = mod.state.url ?? site.url;
  const [on, setOn] = useState(!site.tap);
  const [nonce, setNonce] = useState(0); // ↻ reloads the frame
  const live = on || expanded;
  const page = site.pages?.find((p) => p.url.replace(/\/$/, "") === url.replace(/\/$/, ""))?.label;

  return (
    <div className={`site${expanded ? " big" : ""}`}>
      {site.pages && (expanded || !site.tap || on) && (
        <Seg small label="Pages" options={site.pages.map((p) => p.label)} value={page} onChange={(label) => setState((st) => ({ ...st, url: site.pages.find((p) => p.label === label).url }))} />
      )}
      {live ? (
        <Fit key={`${url}#${nonce}`} url={url} site={site} title={mod.title} />
      ) : (
        <button className="site-poster" onClick={() => setOn(true)} aria-label={`Start ${site.label}`}>
          {site.shot && <img src={site.shot} alt="" loading="lazy" referrerPolicy="no-referrer" />}
          <span className="site-play">▶ start it here</span>
        </button>
      )}
      {expanded && site.note && <p className="site-note">{site.note}</p>}
      <Credit reload={live ? () => setNonce((n) => n + 1) : undefined}>
        <a href={url} target="_blank" rel="noopener noreferrer" title={site.note ?? url}>{siteHost(site)} ↗</a>
      </Credit>
    </div>
  );
}

// The iframe. A desktop layout (vw) is laid out that wide and shrunk to fit the card,
// so a dashboard reads as a dashboard and not as its phone view.
function Fit({ url, site, title }) {
  const boxRef = useRef(null);
  const [box, setBox] = useState(null);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const k = site.vw && box?.w && box.w < site.vw ? box.w / site.vw : 1;
  const style = k < 1 ? { width: site.vw, height: box.h / k, transform: `scale(${k})` } : undefined;
  return (
    <div className="site-frame" ref={boxRef}>
      <iframe
        src={url}
        title={title}
        style={style}
        allow={site.allow ? `${ALLOW}; ${site.allow}` : ALLOW}
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

const ago = (t) => {
  const d = Math.round((Date.now() - new Date(t)) / 86400000);
  return d < 1 ? "today" : d === 1 ? "yesterday" : d < 45 ? `${d} days ago` : d < 540 ? `${Math.round(d / 30)} months ago` : `${Math.round(d / 365)} years ago`;
};

// GitHub won't go in an iframe: the repo's own facts instead, and its latest commits opened big
function Repo({ site, expanded }) {
  const api = `https://api.github.com/repos/${site.repo}`;
  const r = useCachedJSON(api, { ttl: 3 * 3600e3 });
  const c = useCachedJSON(expanded ? `${api}/commits?per_page=6` : null, { ttl: 3 * 3600e3 });
  const repo = r.data;
  return (
    <div className={`site site-repo${expanded ? " big" : ""}`}>
      {site.shot && expanded && <img className="site-shot" src={site.shot} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      <p className="site-desc">{repo?.description ?? site.blurb}</p>
      {repo && (
        <div className="site-facts">
          {repo.language && <span>{repo.language}</span>}
          <span>★ {repo.stargazers_count}</span>
          <span>pushed {ago(repo.pushed_at)}</span>
        </div>
      )}
      {expanded && c.data?.length > 0 && (
        <ul className="site-commits">
          {c.data.map((x) => (
            <li key={x.sha}>
              <a href={x.html_url} target="_blank" rel="noopener noreferrer">{x.commit.message.split("\n")[0]}</a>
              <span>{ago(x.commit.author.date)}</span>
            </li>
          ))}
        </ul>
      )}
      <a className="mini-btn ghost site-open" href={site.url} target="_blank" rel="noopener noreferrer">open on GitHub ↗</a>
      <Credit at={r.at} loading={r.loading} error={r.error} stale={r.stale} reload={r.reload}>github</Credit>
    </div>
  );
}
