// Books from Open Library (free, no key, CORS-friendly), and the camera barcode reader.
// Nothing here is saved anywhere: the shelf keeps the few fields it needs on the book itself.

const OL = "https://openlibrary.org";

// A shelf of spine colours, deep and a little faded like old cloth
export const SPINES = ["#7a2e3b", "#2f5d62", "#b5651d", "#3d405b", "#5b7b3a", "#8c4a6b", "#c9a227", "#264653", "#9c3d2e", "#4a3b6b", "#6a6260", "#e07a5f"];

export const coverUrl = (coverId) => (coverId ? `https://covers.openlibrary.org/b/id/${coverId}-S.jpg?default=false` : null);

// "978-0-14-..." → digits only, if it looks like an ISBN
export function asIsbn(text) {
  const d = String(text ?? "").replace(/[\s-]/g, "");
  return /^(\d{9}[\dXx]|\d{13})$/.test(d) ? d.toUpperCase() : null;
}

const fromDoc = (d) => ({
  title: d.title ?? "untitled",
  author: (d.author_name ?? [])[0] ?? "",
  pages: d.number_of_pages_median ?? null,
  coverId: d.cover_i ?? null,
  isbn: (d.isbn ?? [])[0] ?? null,
  year: d.first_publish_year ?? null,
});

export async function searchBooks(q) {
  const url = `${OL}/search.json?q=${encodeURIComponent(q)}&limit=8&fields=title,author_name,number_of_pages_median,cover_i,isbn,first_publish_year`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("search failed");
  return ((await res.json()).docs ?? []).map(fromDoc);
}

export async function bookByIsbn(isbn) {
  const res = await fetch(`${OL}/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
  if (!res.ok) throw new Error("lookup failed");
  const b = (await res.json())[`ISBN:${isbn}`];
  if (!b) return null;
  const cover = /\/b\/id\/(\d+)-/.exec(b.cover?.medium ?? b.cover?.small ?? "");
  return {
    title: b.title ?? "untitled",
    author: (b.authors ?? [])[0]?.name ?? "",
    pages: b.number_of_pages ?? null,
    coverId: cover ? Number(cover[1]) : null,
    isbn,
    year: null,
  };
}

// Can this browser read barcodes off a camera? (Chrome and Edge, mostly)
export const canScan = () =>
  typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

// Spine size from the book: fatter for more pages, a little taller or shorter by title
export function spineSize(book) {
  const w = Math.round(Math.min(46, Math.max(16, 14 + (book.pages ?? 220) / 12)));
  let h = 0;
  for (const c of book.title ?? "") h = (h * 31 + c.charCodeAt(0)) % 1000;
  return { w, h: 112 + (h % 34) };
}

export const pct = (b) => (b.pages > 0 ? Math.min(100, Math.round(((b.page ?? 0) / b.pages) * 100)) : 0);
