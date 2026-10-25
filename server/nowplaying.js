// "What song is this?" for a radio stream. Most stations tuck the current song into
// the audio itself (ICY metadata, the thing car radios read), but browsers can't read
// it across sites, so this reads it server-side: one short peek at the stream.
// Runs inside the dev server like unfurl; in production it becomes a Function
// (docs/plans/hypermedia-server.md, S1).

const TTL = 15000; // so ten listeners on a station cost one peek, not ten
const MAX_BYTES = 64 * 1024; // give up if the song name isn't in the first bit of the stream
const cache = new Map(); // stream url -> { at, song } or { at, wait }

// "Artist - Title" → both halves; stations with no dash get just a title
const split = (t) => {
  const i = t.indexOf(" - ");
  return i > 0 ? { artist: t.slice(0, i).trim(), title: t.slice(i + 3).trim() } : { artist: "", title: t.trim() };
};

// Metadata bytes are usually UTF-8, but older stations send latin-1
const text = (bytes) => {
  const u = new TextDecoder("utf-8").decode(bytes);
  return u.includes("�") ? new TextDecoder("latin1").decode(bytes) : u;
};

async function peek(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch(url, { headers: { "Icy-MetaData": "1", "User-Agent": "boards-radio/1" }, redirect: "follow", signal: ctl.signal });
    const every = Number(res.headers.get("icy-metaint"));
    if (!res.ok || !every || every > MAX_BYTES) return {};
    // Audio for `every` bytes, one length byte (x16), then that much metadata
    const reader = res.body.getReader();
    let buf = new Uint8Array(0);
    let want = every + 1;
    while (buf.length < want) {
      const { done, value } = await reader.read();
      if (done) break;
      const next = new Uint8Array(buf.length + value.length);
      next.set(buf);
      next.set(value, buf.length);
      buf = next;
      if (buf.length > every && want === every + 1) want = every + 1 + buf[every] * 16;
    }
    if (buf.length < want || want === every + 1) return {};
    const meta = text(buf.slice(every + 1, want));
    const t = meta.match(/StreamTitle='(.*?)';/s)?.[1]?.trim();
    return t ? split(t) : {};
  } finally {
    clearTimeout(timer);
    ctl.abort(); // we only wanted a peek
  }
}

export function nowPlaying(url) {
  const hit = cache.get(url);
  if (hit && (hit.wait || Date.now() - hit.at < TTL)) return hit.wait ?? Promise.resolve(hit.song);
  const wait = peek(url).catch(() => ({}));
  cache.set(url, { at: Date.now(), wait });
  return wait.then((song) => {
    cache.set(url, { at: Date.now(), song });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return song;
  });
}

// GET /api/nowplaying?url=…  → { artist, title } (empty when the station doesn't say)
export async function handle(req, res) {
  const target = new URL(req.url, "http://x").searchParams.get("url");
  const send = (code, body) => {
    res.statusCode = code;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  };
  let u;
  try { u = new URL(target); } catch { return send(400, { error: "bad url" }); }
  if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[?::1)/.test(u.hostname)) {
    return send(400, { error: "not allowed" });
  }
  send(200, await nowPlaying(u.toString()));
}
