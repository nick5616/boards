// Little geography helpers shared by the map and the modules that use it.
// A point is always [lat, lon] in degrees. Distances come out in metres unless the name says miles.

const R = 6371008.8; // earth's mean radius, metres
const rad = (d) => (d * Math.PI) / 180;
export const M_PER_MILE = 1609.344;
export const toMiles = (m) => m / M_PER_MILE;

// Great-circle distance between two points, in metres
export function haversine(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function trackLength(pts) {
  let m = 0;
  for (let i = 1; i < pts.length; i++) m += haversine(pts[i - 1], pts[i]);
  return m;
}

// "31:20", or "1:02:09" past the hour
export function fmtClock(secs) {
  const s = Math.max(0, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// Seconds per mile as "10:05". Nothing sensible under ~100 yards or above an hour a mile.
export function fmtPace(secs, miles) {
  if (!(miles > 0.06) || !(secs > 0)) return "–:––";
  const p = secs / miles;
  return p > 3600 ? "–:––" : fmtClock(p);
}

export const fmtMiles = (mi) => (mi >= 10 ? mi.toFixed(1) : mi.toFixed(2));

// Squash a track to far fewer points, keeping its shape (Douglas-Peucker).
// Works in flat metres around the track, which is plenty close for a run.
function dp(pts, tol) {
  const lat0 = rad(pts[0][0]);
  const xy = pts.map((p) => [rad(p[1]) * Math.cos(lat0) * R, rad(p[0]) * R]);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let far = -1;
    let d2 = tol * tol;
    const [ax, ay] = xy[i];
    const [bx, by] = xy[j];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    for (let k = i + 1; k < j; k++) {
      const t = len2 ? Math.max(0, Math.min(1, ((xy[k][0] - ax) * dx + (xy[k][1] - ay) * dy) / len2)) : 0;
      const ex = xy[k][0] - (ax + t * dx);
      const ey = xy[k][1] - (ay + t * dy);
      const d = ex * ex + ey * ey;
      if (d > d2) {
        d2 = d;
        far = k;
      }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([i, far], [far, j]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

// At most `max` points: tighten the tolerance until it fits
export function simplify(pts, max = 500) {
  if (pts.length <= 2) return pts;
  let tol = 1.5;
  let out = dp(pts, tol);
  while (out.length > max) {
    tol *= 1.6;
    out = dp(pts, tol);
  }
  return out;
}

// Firestore won't hold an array inside an array, so a track is kept as an
// encoded polyline string (5 decimal places, about a metre): ~2 bytes a point.
export function encodeTrack(pts) {
  let out = "";
  let pLat = 0;
  let pLon = 0;
  const put = (n) => {
    let v = n < 0 ? ~(n << 1) : n << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  for (const [lat, lon] of pts) {
    const la = Math.round(lat * 1e5);
    const lo = Math.round(lon * 1e5);
    put(la - pLat);
    put(lo - pLon);
    pLat = la;
    pLon = lo;
  }
  return out;
}

export function decodeTrack(str = "") {
  const pts = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const get = () => {
    let shift = 0;
    let v = 0;
    let b;
    do {
      b = str.charCodeAt(i++) - 63;
      v |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && i <= str.length);
    return v & 1 ? ~(v >> 1) : v >> 1;
  };
  while (i < str.length) {
    lat += get();
    lon += get();
    pts.push([lat / 1e5, lon / 1e5]);
  }
  return pts;
}

// [[south, west], [north, east]] around some points, or null
export function boundsOf(pts) {
  if (!pts.length) return null;
  let s = 90, n = -90, w = 180, e = -180;
  for (const [la, lo] of pts) {
    s = Math.min(s, la); n = Math.max(n, la);
    w = Math.min(w, lo); e = Math.max(e, lo);
  }
  return [[s, w], [n, e]];
}

// Web-mercator: where a point lands on the world "pixel" plane at zoom z (256px tiles)
export function project([lat, lon], z) {
  const scale = 256 * 2 ** z;
  const sin = Math.sin(rad(Math.max(-85.0511, Math.min(85.0511, lat))));
  return [((lon + 180) / 360) * scale, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale];
}

export function unproject([x, y], z) {
  const scale = 256 * 2 ** z;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return [(Math.atan(Math.sinh(n)) * 180) / Math.PI, (x / scale) * 360 - 180];
}
