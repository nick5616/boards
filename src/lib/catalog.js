// Papers for the card catalog. Crossref (DOIs), DataCite (arXiv ids: arXiv's own API has no CORS,
// but every arXiv paper has a DataCite DOI) and Semantic Scholar (title search, open-access PDFs).
// All free, no key, called straight from the browser. Cards keep only the fields they show.
import { cachedJSON, DAY } from "./apis";

// ── What did they paste? ─────────────────────────────────────────────────────
const DOI = /\b(10\.\d{4,9}\/[^\s"'<>]+)/i;
const ARXIV_NEW = /\b(\d{4}\.\d{4,5})(v\d+)?\b/;
const ARXIV_OLD = /\b([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?\b/;

const tidyDoi = (d) => d.replace(/[).,;\]]+$/, "").toLowerCase();

// → { doi } | { arxiv } | null, from a DOI, doi.org / arxiv.org link, "arXiv:1706.03762" or a bare id
export function refOf(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  const arx = /arxiv\.org\/(?:abs|pdf|html)\/([^\s?#]+?)(?:v\d+)?(?:\.pdf)?(?:[?#]|\s|$)/i.exec(t) ?? /^arxiv:\s*(\S+?)(?:v\d+)?$/i.exec(t);
  if (arx) return { arxiv: arx[1] };
  if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(t)) return { arxiv: ARXIV_NEW.exec(t)[1] };
  const d = DOI.exec(t);
  if (d) {
    // arXiv's own DOIs are DataCite's, so they go the arXiv way
    const a = /^10\.48550\/arxiv\.(.+)$/i.exec(tidyDoi(d[1]));
    return a ? { arxiv: a[1] } : { doi: tidyDoi(d[1]) };
  }
  return null;
}

// Every line (or link) in a paste that names a paper
export const refsIn = (text) => String(text ?? "").split(/\n+/).map(refOf).filter(Boolean);

// ── Names ────────────────────────────────────────────────────────────────────
// "Ashish Vaswani" → { given: "Ashish", family: "Vaswani" }
export function splitName(full) {
  const s = String(full ?? "").trim();
  if (s.includes(",")) {
    const [family, given = ""] = s.split(",").map((x) => x.trim());
    return { given, family };
  }
  const parts = s.split(/\s+/);
  return parts.length < 2 ? { given: "", family: s } : { given: parts.slice(0, -1).join(" "), family: parts.at(-1) };
}

// ── Fetching ─────────────────────────────────────────────────────────────────
const strip = (html) =>
  String(html ?? "")
    .replace(/<\/?(jats:)?(title|p|sec)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/^\s*abstract[:.]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

const yearOf = (w) => w?.["published-print"]?.["date-parts"]?.[0]?.[0] ?? w?.issued?.["date-parts"]?.[0]?.[0] ?? w?.created?.["date-parts"]?.[0]?.[0] ?? null;

const fromCrossref = (w) => ({
  title: strip(w.title?.[0]) || "untitled",
  authors: (w.author ?? []).map((a) => ({ given: a.given ?? "", family: a.family ?? a.name ?? "" })),
  year: yearOf(w),
  abstract: strip(w.abstract),
  doi: w.DOI?.toLowerCase() ?? null,
  url: w.DOI ? `https://doi.org/${w.DOI}` : w.URL,
  venue: w["container-title"]?.[0] ?? w.publisher ?? "",
  pdf: null,
  cites: w["is-referenced-by-count"] ?? null,
});

const fromS2 = (p) => ({
  title: p.title ?? "untitled",
  authors: (p.authors ?? []).map((a) => splitName(a.name)),
  year: p.year ?? null,
  abstract: strip(p.abstract),
  doi: p.externalIds?.DOI?.toLowerCase() ?? null,
  arxiv: p.externalIds?.ArXiv ?? null,
  url: p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : p.externalIds?.ArXiv ? `https://arxiv.org/abs/${p.externalIds.ArXiv}` : null,
  venue: p.venue ?? "",
  pdf: p.openAccessPdf?.url ?? (p.externalIds?.ArXiv ? `https://arxiv.org/pdf/${p.externalIds.ArXiv}` : null),
  cites: p.citationCount ?? null,
});

const S2 = "https://api.semanticscholar.org/graph/v1/paper";
const S2_FIELDS = "title,authors,year,abstract,venue,citationCount,openAccessPdf,externalIds";

// The abstract and open-access PDF Crossref doesn't have. Semantic Scholar rate-limits
// shared traffic, so this is a bonus and any failure is quietly fine.
async function enrich(card) {
  try {
    const id = card.arxiv ? `ARXIV:${card.arxiv}` : `DOI:${card.doi}`;
    const { data } = await cachedJSON(`${S2}/${encodeURIComponent(id)}?fields=${S2_FIELDS}`, { ttl: DAY });
    const s = fromS2(data);
    return { ...card, abstract: card.abstract || s.abstract, pdf: card.pdf || s.pdf, cites: card.cites ?? s.cites };
  } catch {
    return card;
  }
}

export async function byDoi(doi) {
  const { data } = await cachedJSON(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { ttl: 7 * DAY });
  return enrich(fromCrossref(data.message));
}

export async function byArxiv(id) {
  const { data } = await cachedJSON(`https://api.datacite.org/dois/10.48550/arxiv.${encodeURIComponent(id)}`, { ttl: 7 * DAY });
  const a = data.data.attributes;
  const note = (a.descriptions ?? []).find((d) => d.descriptionType === "Abstract") ?? a.descriptions?.[0];
  return {
    title: strip(a.titles?.[0]?.title) || "untitled",
    authors: (a.creators ?? []).map((c) => (c.familyName ? { given: c.givenName ?? "", family: c.familyName } : splitName(c.name))),
    year: a.publicationYear ?? null,
    abstract: strip(note?.description),
    doi: null,
    arxiv: id,
    url: `https://arxiv.org/abs/${id}`,
    venue: "arXiv",
    pdf: `https://arxiv.org/pdf/${id}`,
    cites: null,
  };
}

// A title or a few words → candidate papers. Semantic Scholar first (it has abstracts and
// PDF links); Crossref when that is rate-limited or down.
export async function searchPapers(q) {
  try {
    const { data } = await cachedJSON(`${S2}/search?query=${encodeURIComponent(q)}&limit=6&fields=${S2_FIELDS}`, { ttl: DAY });
    const hits = (data.data ?? []).map(fromS2);
    if (hits.length) return hits;
  } catch { /* fall through to Crossref */ }
  const { data } = await cachedJSON(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=6`, { ttl: DAY });
  return (data.message.items ?? []).map(fromCrossref);
}

// Whatever they typed → one or more candidate papers
export async function lookUp(text) {
  const ref = refOf(text);
  if (ref?.doi) return [await byDoi(ref.doi)];
  if (ref?.arxiv) return [await byArxiv(ref.arxiv)];
  return searchPapers(text.trim());
}

// ── Citations ────────────────────────────────────────────────────────────────
const initials = (given) =>
  given.split(/[\s-]+/).filter(Boolean).map((p) => `${p[0].toUpperCase()}.`).join(" ");

const apaName = (a) => (a.given ? `${a.family}, ${initials(a.given)}` : a.family);

export function authorsApa(authors) {
  const names = (authors ?? []).map(apaName).filter(Boolean);
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length > 20) return `${names.slice(0, 19).join(", ")}, . . . ${names.at(-1)}`;
  return `${names.slice(0, -1).join(", ")}, & ${names.at(-1)}`;
}

export function apa(c) {
  const who = authorsApa(c.authors) || c.title;
  const when = c.year ? `(${c.year})` : "(n.d.)";
  const link = c.doi ? `https://doi.org/${c.doi}` : c.arxiv ? `https://arxiv.org/abs/${c.arxiv}` : c.url ?? "";
  const bits = [c.authors?.length ? `${who} ${when}. ${c.title.replace(/\.$/, "")}.` : `${c.title.replace(/\.$/, "")}. ${when}.`];
  if (c.venue) bits.push(`${c.venue.replace(/\.$/, "")}.`);
  if (link) bits.push(link);
  return bits.join(" ");
}

const ascii = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]/g, "");

export function bibKey(c) {
  const first = ascii(c.authors?.[0]?.family ?? "anon").toLowerCase() || "anon";
  const word = ascii((c.title.split(/\s+/).find((w) => w.length > 3 && !/^(with|from|that|this|their|about)$/i.test(w)) ?? "paper")).toLowerCase();
  return `${first}${c.year ?? ""}${word}`;
}

export function bibtex(c) {
  const arxiv = !c.doi && c.arxiv;
  const rows = [
    ["title", `{${c.title}}`],
    ["author", `{${(c.authors ?? []).map((a) => (a.given ? `${a.family}, ${a.given}` : a.family)).join(" and ")}}`],
    c.year && ["year", `{${c.year}}`],
    c.venue && !arxiv && ["journal", `{${c.venue}}`],
    c.doi && ["doi", `{${c.doi}}`],
    arxiv && ["eprint", `{${c.arxiv}}`],
    arxiv && ["archivePrefix", "{arXiv}"],
    c.url && ["url", `{${c.url}}`],
  ].filter(Boolean);
  return `@${arxiv ? "misc" : "article"}{${bibKey(c)},\n${rows.map(([k, v]) => `  ${k} = ${v}`).join(",\n")}\n}`;
}

export const byline = (c) => {
  const a = c.authors ?? [];
  const names = a.slice(0, 3).map((x) => x.family).filter(Boolean);
  return names.join(", ") + (a.length > 3 ? " et al." : "");
};

export const toRead = (state) => (state.cards ?? []).filter((c) => c.status === "toread");
