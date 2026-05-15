import { STAMPS } from "../constants/stamps";
import { useIconOverrides } from "../contexts/IconOverridesContext";

export default function StampSVG({ stampId, color = "#2A2520", size }) {
  const ctx = useIconOverrides();
  const stamp = STAMPS.find((s) => s.id === stampId);

  if (!stamp) return null;

  const override = ctx?.overrides?.[stampId];
  const sizeProps = size ? { width: size, height: size } : {};

  if (override?.data) {
    return (
      <img
        src={override.data}
        alt={stampId}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...sizeProps}
    >
      <path d={stamp.path} />
    </svg>
  );
}
