import { hslStr, inkColor } from "../utils/color";
import StampSVG from "./StampSVG";

export default function CardInnards({
    layout,
    stampId,
    iconData,
    color,
    title,
    meta,
    scale = 1,
    iconOffsetX = 0,
    iconScale = 1,
}) {
    const bg = hslStr(color.h, color.s, color.l);
    const ink = inkColor(color);
    const hasDrawn = !!iconData;
    const hasStamp = !!stampId && !hasDrawn;
    const fs = (n) => `${n * scale}px`;
    const iconStyle = (iconOffsetX !== 0 || iconScale !== 1)
        ? { transform: `translateX(${iconOffsetX * 50}%) scale(${iconScale})` }
        : undefined;

    if (layout === "bleed")
        return (
            <>
                <div className="card-bg" style={{ background: bg }} />
                <div className="bleed-icon" style={iconStyle}>
                    {hasDrawn && <img src={iconData} alt="" />}
                    {hasStamp && <StampSVG stampId={stampId} color={ink} />}
                </div>
                <div className="bleed-text">
                    <div className="card-title" style={{ fontSize: fs(9) }}>
                        {title}
                    </div>
                    {meta && <div className="card-meta">{meta}</div>}
                </div>
            </>
        );

    if (layout === "bubble")
        return (
            <>
                <div className="card-bg" style={{ background: bg }} />
                <div className="bubble-icon" style={iconStyle}>
                    {hasDrawn && <img src={iconData} alt="" />}
                    {hasStamp && <StampSVG stampId={stampId} color={ink} />}
                </div>
                <div className="bubble-text">
                    <div className="card-title" style={{ fontSize: fs(9) }}>
                        {title}
                    </div>
                    {meta && <div className="card-meta">{meta}</div>}
                </div>
            </>
        );

    if (layout === "centered")
        return (
            <>
                <div className="card-bg" style={{ background: bg }} />
                <div className="centered-icon-area" style={iconStyle}>
                    {hasDrawn ? (
                        <div className="centered-drawn">
                            <img src={iconData} alt="" />
                        </div>
                    ) : hasStamp ? (
                        <div className="centered-stamp-bg">
                            <StampSVG stampId={stampId} color={ink} />
                        </div>
                    ) : null}
                </div>
                <div className="centered-text">
                    <div className="card-title" style={{ fontSize: fs(9) }}>
                        {title}
                    </div>
                    {meta && <div className="card-meta">{meta}</div>}
                </div>
            </>
        );

    return null;
}
