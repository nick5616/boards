// Reads a page's preview details (the same ones chat apps show when you paste
// a link): Open Graph and Twitter tags, plus schema.org Product data for shops.
// Runs server-side, since browsers can't read other sites' pages.

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};
const MAX_BYTES = 1_500_000;

const decode = (s) =>
  s
    ?.replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .trim() || null;

function metaTags(html) {
  const out = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = tag.match(/\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i);
    if (key && content && !(key in out)) out[key] = decode(content[1] ?? content[2]);
  }
  return out;
}

// The first schema.org Product (or anything with a name) in the page's JSON-LD
function product(html) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const all = [data, ...(Array.isArray(data) ? data : []), ...(data?.["@graph"] ?? [])].flat();
    const p = all.find((d) => d && /Product/.test([].concat(d["@type"]).join(" ")));
    if (!p) continue;
    const offer = [].concat(p.offers ?? [])[0] ?? {};
    const price = offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price;
    const images = [].concat(p.image ?? []).map((i) => i?.url ?? i).filter((i) => typeof i === "string");
    return {
      title: p.name,
      description: p.description,
      image: images[0],
      images,
      price: price != null ? String(price) : null,
      currency: offer.priceCurrency ?? null,
    };
  }
  return {};
}

// Amazon has no preview tags; its picture and price live in its own markup
function amazon(html) {
  const image =
    html.match(/id="landingImage"[^>]*data-old-hires="([^"]+)"/)?.[1] ||
    html.match(/"hiRes":"(https:[^"]+)"/)?.[1] ||
    html.match(/id="landingImage"[^>]*src="([^"]+)"/)?.[1];
  const price = html.match(/"displayPrice":"([^"]+)"/)?.[1] ?? html.match(/a-offscreen">\s*([$£€][\d.,]+)/)?.[1];
  const title = decode(html.match(/id="productTitle"[^>]*>([^<]+)</)?.[1]);
  // Every product photo, biggest size, for the mosaic
  const images = [...new Set([...html.matchAll(/"hiRes":"(https:[^"]+)"/g)].map((x) => x[1]))];
  return {
    title,
    image: image ?? null,
    images,
    price: price?.replace(/[^\d.,]/g, "") || null,
    currency: { $: "USD", "£": "GBP", "€": "EUR" }[price?.match(/[$£€]/)?.[0]] ?? null,
    siteName: "Amazon",
  };
}

const absolute = (u, base) => {
  try { return u ? new URL(u, base).toString() : null; } catch { return null; }
};

// Pinterest pages draw their pins in after loading, so a page fetch only has
// the cover. For ideas and search pages, ask Pinterest's own search for the pins.
const unslug = (s) => decodeURIComponent(s).replace(/[-_+]+/g, " ").trim();

async function pinterest(u) {
  const query =
    u.pathname.match(/^\/ideas\/([^/]+)/)?.[1] ??
    (u.pathname.startsWith("/search/") ? u.searchParams.get("q") : null);
  if (!query) return null;
  const q = unslug(query);
  const data = JSON.stringify({ options: { query: q, scope: "pins", rs: "typed" }, context: {} });
  const api = `https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=${encodeURIComponent(`/search/pins/?q=${q}`)}&data=${encodeURIComponent(data)}`;
  const res = await fetch(api, {
    // Without the handler header Pinterest answers "Invalid Resource Request"
    headers: { ...HEADERS, Accept: "application/json", "X-Requested-With": "XMLHttpRequest", "X-Pinterest-PWS-Handler": "www/search/[scope].js" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const pins = ((await res.json()).resource_response?.data?.results ?? []).filter((p) => p.type === "pin" && p.images);
  const gallery = pins.slice(0, 12).map((p) => ({
    image: p.images["474x"]?.url ?? p.images.orig?.url,
    title: (typeof p.grid_title === "string" && p.grid_title) || (typeof p.title === "string" && p.title) || null,
    link: typeof p.link === "string" ? p.link : null,
    color: p.dominant_color ?? null,
  }));
  const title = q.replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title,
    description: `Pins from Pinterest for “${q}”`,
    image: gallery[0]?.image ?? null,
    gallery,
    siteName: "Pinterest",
    icon: "https://www.pinterest.com/favicon.ico",
    kind: "gallery",
  };
}

// Bot walls (Amazon's captcha page and friends) have nothing to read
const walled = (html) => html.length < 20000 && /captcha|robot check|are you a human|access denied/i.test(html);

export async function unfurl(url, tries = 2) {
  const u = new URL(url);
  if (/(^|\.)pinterest\./.test(u.hostname)) {
    const board = await pinterest(u).catch(() => null);
    if (board) return board;
  }
  const res = await fetch(url, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(8000) });
  if (!res.ok) return { blocked: true, status: res.status };
  if (!/html/.test(res.headers.get("content-type") ?? "")) return { blocked: false };
  const html = (await res.text()).slice(0, MAX_BYTES);
  if (walled(html)) {
    // These walls come and go; one more knock often gets the real page
    if (tries > 1) return new Promise((r) => setTimeout(r, 700)).then(() => unfurl(url, tries - 1));
    return { blocked: true };
  }
  const m = metaTags(html);
  const p = /(^|\.)amazon\./.test(new URL(res.url).hostname) ? amazon(html) : product(html);
  // Every picture the page offers for previews, for a mosaic when there's more than one
  // (the same picture at several sizes counts once)
  const seen = new Set();
  const pics = [...(p.images ?? []), ...(html.match(/<meta[^>]+(?:og:image|twitter:image)(?::url)?["'][^>]*>/gi) ?? [])
    .map((t) => decode(t.match(/content=["']([^"']+)/i)?.[1]))]
    .map((x) => absolute(x, res.url))
    .filter((x) => x && !seen.has(x.split("?")[0]) && seen.add(x.split("?")[0]));
  const icon = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/i)?.[0].match(/href=["']([^"']+)["']/i)?.[1];
  return {
    title: p.title ?? m["og:title"] ?? m["twitter:title"] ?? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]),
    description: p.description ?? m["og:description"] ?? m["twitter:description"] ?? m.description ?? null,
    image: absolute(p.image ?? m["og:image"] ?? m["og:image:url"] ?? m["twitter:image"], res.url),
    siteName: m["og:site_name"] ?? p.siteName ?? null,
    price: p.price ?? m["product:price:amount"] ?? m["og:price:amount"] ?? null,
    currency: p.currency ?? m["product:price:currency"] ?? m["og:price:currency"] ?? null,
    icon: absolute(icon ?? "/favicon.ico", res.url),
    kind: m["og:type"] ?? null,
    gallery: pics.length > 1 ? pics.slice(0, 12).map((image) => ({ image })) : null,
  };
}

// GET /api/unfurl?url=…  → JSON. Only http(s), and never this machine's own network.
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
  try {
    send(200, await unfurl(u.toString()));
  } catch (e) {
    send(502, { error: String(e.message ?? e) });
  }
}
