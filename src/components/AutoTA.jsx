import { useRef, useEffect } from "react";

export default function AutoTA({ value, onChange, placeholder, className }) {
  const ref = useRef(null);
  const fit = () => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = ref.current.scrollHeight + "px";
  };
  useEffect(fit, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(e) => { onChange(e.target.value); fit(); }}
      rows={1}
    />
  );
}
