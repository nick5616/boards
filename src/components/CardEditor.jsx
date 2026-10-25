import { useState, useEffect, useRef } from "react";
import { defaultColor, hslStr, inkColor } from "../utils/color";
import { STAMPS } from "../constants/stamps";
import { LAYOUTS } from "../constants/layouts";
import ColorPicker from "./ColorPicker";
import DrawCanvas from "./DrawCanvas";
import LayoutThumb from "./LayoutThumb";
import StampSVG from "./StampSVG";

// draft: a drawing started earlier but not (or no longer) the icon. Once you
// start drawing, the drawing is kept: picking a stamp or closing without
// saving hands it to onDraft instead of throwing it away.
export default function CardEditor({ card, draft, onSave, onDraft, onClose, onDelete }) {
    const [title, setTitle] = useState(card?.title ?? "");
    const [color, setColor] = useState(card?.color ?? defaultColor());
    const [stampId, setStampId] = useState(card?.stampId ?? null);
    const [startDrawing] = useState(() => draft ?? card?.iconData ?? "");
    const [iconData, setIconData] = useState(startDrawing);
    const [layout, setLayout] = useState(card?.layout ?? "bleed");
    const [iconTab, setIconTab] = useState(card ? (card.iconData ? "draw" : "stamp") : startDrawing ? "draw" : "stamp");
    const [iconOffsetX, setIconOffsetX] = useState(card?.iconOffsetX ?? 0);
    const [iconScale, setIconScale] = useState(card?.iconScale ?? 1);

    const drawingRef = useRef(iconData);
    drawingRef.current = iconData;
    const saved = useRef(false);

    // However the editor goes away (✕, Cancel, Escape, tapping outside), an
    // unsaved drawing stays behind as a draft
    useEffect(() => () => {
        if (!saved.current && drawingRef.current !== startDrawing) onDraft?.(drawingRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Lock body scroll while modal is open
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    // Close on Escape
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const bg = hslStr(color.h, color.s, color.l);
    const ink = inkColor(color);
    const activeStamp = iconTab === "stamp" ? stampId : null;
    const activeIcon = iconTab === "draw" ? iconData : "";

    const handleSave = () => {
        if (!title.trim()) return;
        saved.current = true;
        onSave({
            title: title.trim(),
            color,
            stampId: activeStamp,
            iconData: activeIcon,
            iconDraft: iconData || null,
            layout,
            iconOffsetX,
            iconScale,
        });
    };

    return (
        <div
            className="overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-label={card ? "Edit card" : "New card"}
            >
                <div className="modal-topbar">
                    <div className="modal-handle" />
                    <div className="modal-title">
                        {card ? "Edit card" : "New card"}
                    </div>
                    <button
                        className="modal-x"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                <div className="modal-body">
                    <div className="field">
                        <label className="field-label" htmlFor="card-name">
                            Name
                        </label>
                        <input
                            id="card-name"
                            className="field-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="What is this collection?"
                            autoFocus
                            autoComplete="off"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSave();
                            }}
                        />
                    </div>

                    <div className="field">
                        <label className="field-label">Background color</label>
                        <ColorPicker color={color} onChange={setColor} />
                    </div>

                    <div className="field">
                        <label className="field-label">Icon</label>
                        <div className="draw-tabs">
                            <button
                                className={`draw-tab${iconTab === "stamp" ? " sel" : ""}`}
                                onClick={() => setIconTab("stamp")}
                            >
                                Choose stamp
                            </button>
                            <button
                                className={`draw-tab${iconTab === "draw" ? " sel" : ""}`}
                                onClick={() => setIconTab("draw")}
                            >
                                Draw your own
                            </button>
                        </div>
                        {iconTab === "stamp" && (
                            <div className="stamp-grid">
                                <div
                                    className={`stamp-none${stampId === null ? " sel" : ""}`}
                                    onClick={() => setStampId(null)}
                                    role="button"
                                    aria-label="No stamp"
                                >
                                    none
                                </div>
                                {iconData && (
                                    <div
                                        className="stamp-btn stamp-draft"
                                        onClick={() => setIconTab("draw")}
                                        role="button"
                                        aria-label="Use your drawing"
                                        title="your drawing"
                                        style={{ background: bg }}
                                    >
                                        <img src={iconData} alt="" />
                                        <span>draft</span>
                                    </div>
                                )}
                                {STAMPS.map((st) => (
                                    <div
                                        key={st.id}
                                        className={`stamp-btn${stampId === st.id ? " sel" : ""}`}
                                        onClick={() => setStampId(st.id)}
                                        role="button"
                                        aria-label={st.id}
                                        title={st.id}
                                    >
                                        <StampSVG
                                            stampId={st.id}
                                            color={
                                                stampId === st.id
                                                    ? ink
                                                    : "#8A8280"
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                        {iconTab === "draw" && (
                            <>
                                <DrawCanvas
                                    value={iconData}
                                    onChange={setIconData}
                                    bgColor={bg}
                                />
                                {iconData && iconData !== card?.iconData && (
                                    <div className="draw-draft-note">
                                        draft · kept even if you close without saving
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="field">
                        <label className="field-label">Card layout</label>
                        {(activeStamp || activeIcon) && (
                            <div className="icon-adjust">
                                <div className="sl-row">
                                    <label>X</label>
                                    <input
                                        type="range"
                                        className="sl-slider"
                                        min={-100}
                                        max={100}
                                        step={1}
                                        value={Math.round(iconOffsetX * 100)}
                                        onChange={(e) => setIconOffsetX(e.target.value / 100)}
                                        style={{ background: "#e8e2da" }}
                                    />
                                </div>
                                <div className="sl-row">
                                    <label>S</label>
                                    <input
                                        type="range"
                                        className="sl-slider"
                                        min={50}
                                        max={200}
                                        step={5}
                                        value={Math.round(iconScale * 100)}
                                        onChange={(e) => setIconScale(e.target.value / 100)}
                                        style={{ background: "#e8e2da" }}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="layout-row">
                            {LAYOUTS.map((lo) => (
                                <div
                                    key={lo.id}
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        width: "29%",
                                    }}
                                >
                                    <div className="layout-opt-label">
                                        {lo.label}
                                    </div>
                                    <div
                                        className={`layout-opt${layout === lo.id ? " sel" : ""}`}
                                        onClick={() => setLayout(lo.id)}
                                        role="button"
                                        aria-label={lo.label}
                                    >
                                        <LayoutThumb
                                            layout={lo.id}
                                            color={color}
                                            stampId={activeStamp}
                                            iconData={activeIcon}
                                            title={title}
                                            iconOffsetX={iconOffsetX}
                                            iconScale={iconScale}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    {onDelete && (
                        <button className="btn-ghost btn-danger" onClick={onDelete}>
                            Delete
                        </button>
                    )}
                    <button className="btn-ghost" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn-save" onClick={handleSave}>
                        {card ? "Save changes" : "Create card"}
                    </button>
                </div>
            </div>
        </div>
    );
}
