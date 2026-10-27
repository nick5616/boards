// Field guide: what iNaturalist says is being seen near you this month, and your life list.
// iNaturalist is free, keyless and CORS-friendly; eBird is optional (needs a free key).
import { HOUR, apiKey } from "./apis";

export const GROUPS = [
  { id: "all", label: "everything", icon: "🔎", taxa: "" },
  { id: "birds", label: "birds", icon: "🐦", taxa: "Aves" },
  { id: "plants", label: "plants", icon: "🌿", taxa: "Plantae" },
  { id: "fungi", label: "fungi", icon: "🍄", taxa: "Fungi" },
  { id: "insects", label: "insects", icon: "🦋", taxa: "Insecta" },
];
export const SEEN_TTL = 12 * HOUR;

export const RADIUS_KM = 25;
export const seenKey = (p, group, month) => `inat-seen:${p.lat.toFixed(1)},${p.lon.toFixed(1)}:${group}:${month}`;
export const seenUrl = (p, group, month) => {
  const taxa = GROUPS.find((g) => g.id === group)?.taxa;
  return (
    `https://api.inaturalist.org/v1/observations/species_counts?lat=${p.lat.toFixed(3)}&lng=${p.lon.toFixed(3)}` +
    `&radius=${RADIUS_KM}&month=${month}&per_page=30&locale=en&verifiable=true` +
    (taxa ? `&iconic_taxa=${taxa}` : "")
  );
};
export const searchUrl = (q) =>
  `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(q)}&per_page=8&locale=en`;

// A species row from either endpoint → one plain shape
export function speciesOf(taxon, count = null) {
  const photo = taxon.default_photo;
  return {
    taxonId: taxon.id,
    name: taxon.preferred_common_name || taxon.english_common_name || taxon.name,
    sci: taxon.name,
    photo: photo?.medium_url || photo?.square_url || null,
    credit: photo?.attribution || "",
    group: groupOfIconic(taxon.iconic_taxon_name),
    count,
  };
}
const groupOfIconic = (n) => GROUPS.find((g) => g.taxa === n)?.id ?? "other";

// Seen near you → species cards
export const seenList = (data) => (data?.results ?? []).filter((r) => r.taxon).map((r) => speciesOf(r.taxon, r.count));

// eBird (optional): recent birds around you, needs the person's own free key
export const ebirdUrl = (p) =>
  `https://api.ebird.org/v2/data/obs/geo/recent?lat=${p.lat.toFixed(2)}&lng=${p.lon.toFixed(2)}&dist=${RADIUS_KM}&back=7&maxResults=30`;
export const ebirdKey = (p) => `ebird:${p.lat.toFixed(1)},${p.lon.toFixed(1)}`;
export const ebirdInit = () => ({ headers: { "X-eBirdApiToken": apiKey("ebird") ?? "" } });

// ── The life list ────────────────────────────────────────────────────────────
// life: [{ id, taxonId|null, name, sci, photo, group, at (ms), note, place }]
export const onList = (life, sp) =>
  life.some((x) => (sp.taxonId != null && x.taxonId === sp.taxonId) || (x.taxonId == null && x.name.toLowerCase() === sp.name.toLowerCase()));

export function newLife(id, sp, place, now = Date.now()) {
  return {
    id, taxonId: sp.taxonId ?? null, name: sp.name, sci: sp.sci ?? "", photo: sp.photo ?? null,
    group: sp.group ?? "other", at: now, note: "", place: place?.name ?? "",
  };
}

export const newThisMonth = (life, now = new Date()) =>
  life.filter((x) => {
    const d = new Date(x.at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

// "47 species · 3 new this month"
export function glanceFor(mods) {
  const all = mods.flatMap((m) => m.state.life ?? []);
  if (!all.length) return null;
  const seen = new Set(all.map((x) => x.taxonId ?? x.name.toLowerCase()));
  const fresh = newThisMonth(all);
  return `🐦 life list ${seen.size}${fresh ? ` · ${fresh} new this month` : ""}`;
}

