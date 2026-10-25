import { useEffect, useRef, useState } from "react";
import { useData } from "../../contexts/DataContext";
import { useImage } from "../../hooks/useEntries";
import { compressImage, saveImage, deleteImage } from "../../lib/data";
import { classify, takeIn, imagesIn, pointerTarget, shortName } from "../../lib/paste";
import { fetchPreview, embedFor, priceLabel } from "../../lib/unfurl";
import AutoTA from "../AutoTA";

// One link, cut out like a catalog clipping: its picture, name, site, price
// tag and blurb, read from the page itself. Video and music links play right
// on the card. Paste or drop a picture on it to give it your own.
export default function Clipping({ board, mod, setState, onPatch, expanded }) {
  const { uid, toast } = useData();
  const rootRef = useRef(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const s = mod.state;
  const embed = s.url ? embedFor(s.url) : null;
  const own = useImage(uid, s.imageId);
  const picture = own ?? s.image ?? embed?.thumb;
  const price = priceLabel(s.price, s.currency);

  const lookUp = async () => {
    setLoading(true);
    const m = await fetchPreview(s.url);
    setLoading(false);
    // Fill in from the page, but never over something typed by hand
    setState((st) => ({
      ...st,
      fetchedAt: Date.now(),
      blocked: !!m.blocked,
      unavailable: !!m.unavailable,
      title: st.titleEdited || !m.title ? st.title : m.title,
      description: m.description ?? st.description ?? null,
      image: m.image ?? st.image ?? null,
      siteName: m.siteName ?? st.siteName ?? null,
      icon: m.icon ?? st.icon ?? null,
      price: st.priceEdited ? st.price : m.price ?? st.price ?? null,
      currency: m.currency ?? st.currency ?? null,
      gallery: m.gallery ?? st.gallery ?? null,
    }));
    // The page's own title names the card better than the address did
    const name = shortName(m.title, m.siteName);
    if (name && !mod.named) onPatch?.({ title: name });
  };

  useEffect(() => {
    if (s.url && !s.fetchedAt) lookUp();
  }, [s.url]);

  const setLink = () => {
    const raw = input.trim();
    if (!raw) return;
    const p = classify({ images: [], text: /^https?:\/\//i.test(raw) ? raw : `https://${raw}` });
    if (p?.kind !== "link") return toast({ text: "that doesn't look like a link" });
    setState((st) => takeIn("clipping", st, p));
    setInput("");
  };

  const setPicture = async (file) => {
    try {
      const old = s.imageId;
      const imageId = saveImage(uid, board.id, await compressImage(file));
      setState((st) => ({ ...st, imageId }));
      if (old) deleteImage(uid, old);
    } catch {
      toast({ text: "couldn't read that picture" });
    }
  };
  const latest = useRef(setPicture);
  latest.current = setPicture;

  // Ctrl/⌘+V a picture while pointing at the card
  useEffect(() => {
    const frame = rootRef.current?.closest(".mod");
    if (!frame) return;
    const onPaste = (e) => {
      const [file] = imagesIn(e.clipboardData?.files);
      if (!file || !frame.contains(pointerTarget())) return;
      e.preventDefault();
      latest.current(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const editPrice = () => {
    const v = prompt("Price", s.price ?? "");
    if (v != null) setState((st) => ({ ...st, price: v.trim() || null, priceEdited: true }));
  };

  if (!s.url) {
    return (
      <div className="clip" ref={rootRef}>
        <input
          className="line-input clip-link"
          placeholder="+ paste a link to clip"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setLink()}
          onBlur={setLink}
        />
      </div>
    );
  }

  return (
    <div
      className={`clip${expanded ? " big" : ""}`}
      ref={rootRef}
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDrop={(e) => {
        const [file] = imagesIn(e.dataTransfer.files);
        if (!file) return;
        e.preventDefault();
        setPicture(file);
      }}
    >
      <div className="clip-media">
        {playing && embed ? (
          <iframe
            src={embed.src}
            title={s.title}
            style={embed.ratio ? { aspectRatio: embed.ratio } : { height: embed.height }}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
            allowFullScreen
          />
        ) : !own && s.gallery?.length > 1 ? (
          // A page of pictures (a Pinterest search, a product's photos): show them all,
          // each one going where it goes
          <div className="clip-mosaic">
            {s.gallery.slice(0, expanded ? 12 : 6).map((g, i) => (
              <a
                key={g.image}
                href={g.link ?? s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={g.title ?? s.title}
                style={{ background: g.color ?? undefined }}
              >
                <img src={g.image} alt={g.title ?? ""} loading="lazy" referrerPolicy="no-referrer" />
                {g.link && <span className="clip-out">↗</span>}
                {expanded && g.title && <span className="clip-cap">{g.title}</span>}
              </a>
            ))}
          </div>
        ) : picture ? (
          <img src={picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className="clip-noimg">{loading ? "looking it up…" : "paste or drop a picture of it here"}</div>
        )}
        {embed && !playing && (
          <button className="clip-play" onClick={() => setPlaying(true)} aria-label={`Play ${s.title}`}>▶</button>
        )}
        {(price || s.site === "shop") && (
          <button className={`clip-price${price ? "" : " empty"}`} onClick={editPrice} title="Set the price">
            {price ?? "+ price"}
          </button>
        )}
      </div>
      <div className="clip-site">
        {s.icon && <img src={s.icon} alt="" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />}
        <span>{s.siteName ?? s.domain}</span>
      </div>
      <AutoTA
        className="clip-title"
        value={s.title}
        onChange={(title) => setState((st) => ({ ...st, title, titleEdited: true }), { debounce: 600 })}
      />
      {s.description && <p className="clip-desc">{s.description}</p>}
      <AutoTA
        className="clip-note"
        value={s.note ?? ""}
        placeholder="+ a note (does it fit? what size? why?)"
        rich
        onChange={(note) => setState((st) => ({ ...st, note }), { debounce: 600 })}
      />
      <div className="clip-actions">
        <a className="clip-open" href={s.url} target="_blank" rel="noopener noreferrer">open ↗</a>
        <button className="clip-refresh" onClick={lookUp} disabled={loading} title="Look the page up again">
          {loading ? "…" : "↻"}
        </button>
        {s.blocked && <span className="clip-hint">the site wouldn't show its details — paste a picture</span>}
        {s.unavailable && <span className="clip-hint">page details need the dev server — paste a picture</span>}
      </div>
    </div>
  );
}
