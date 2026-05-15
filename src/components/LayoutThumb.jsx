import { useRef, useState, useEffect } from "react";
import CardInnards from "./CardInnards";

const REAL_W = 290;
const REAL_H = 145;

export default function LayoutThumb({
    layout,
    color,
    stampId,
    iconData,
    title,
    iconOffsetX = 0,
    iconScale = 1,
}) {
    const wrapRef = useRef(null);
    const [scale, setScale] = useState(0.5);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            const w = entry.contentRect.width;
            if (w > 0) setScale(w / REAL_W);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return (
        <div className="layout-thumb-wrap" ref={wrapRef}>
            <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                <div
                    className={`card card-${layout}`}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: REAL_W,
                        height: REAL_H,
                        transform: `scale(${scale})`,
                        transformOrigin: "top left",
                        borderRadius: 0,
                        boxShadow: "none",
                        cursor: "default",
                        pointerEvents: "none",
                    }}
                >
                    <CardInnards
                        layout={layout}
                        stampId={stampId}
                        iconData={iconData}
                        color={color}
                        title={title || "Card name"}
                        scale={1 / scale}
                        iconOffsetX={iconOffsetX}
                        iconScale={iconScale}
                    />
                </div>
            </div>
        </div>
    );
}
