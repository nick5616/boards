// Link previews for Clipping cards. Details come from /api/unfurl (served by
// the dev server, see server/unfurl.js); players for video and music links
// are worked out right here from the address.

export async function fetchPreview(url) {
  try {
    const res = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`);
    if (!res.ok || !/json/.test(res.headers.get("content-type") ?? "")) return { unavailable: true };
    return await res.json();
  } catch {
    return { unavailable: true };
  }
}

// A player that can sit right on the card: { src, ratio, thumb? }
export function embedFor(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  if (host === "youtube.com" || host === "youtu.be") {
    const id = host === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v") ?? u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]+)/)?.[1];
    if (!id) return null;
    const start = parseInt(u.searchParams.get("t") ?? "", 10);
    return {
      src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1${start ? `&start=${start}` : ""}`,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      ratio: u.pathname.startsWith("/shorts") ? "9 / 16" : "16 / 9",
    };
  }
  if (host === "vimeo.com") {
    const id = u.pathname.match(/^\/(\d+)/)?.[1];
    return id ? { src: `https://player.vimeo.com/video/${id}?autoplay=1`, ratio: "16 / 9" } : null;
  }
  if (host === "open.spotify.com") {
    const m = u.pathname.match(/\/(track|album|playlist|episode|show|artist)\/(\w+)/);
    return m ? { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: m[1] === "track" ? 152 : 352 } : null;
  }
  if (host === "soundcloud.com") {
    return { src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&visual=true&auto_play=true`, height: 300 };
  }
  return null;
}

export const priceLabel = (price, currency) => {
  if (!price) return null;
  const n = Number(String(price).replace(/,/g, ""));
  if (!currency || Number.isNaN(n)) return String(price);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${price} ${currency}`;
  }
};
