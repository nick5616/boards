import { useState, useEffect } from "react";

export function useMedia(q) {
  const [match, setMatch] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mql = window.matchMedia(q);
    const on = () => setMatch(mql.matches);
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, [q]);
  return match;
}

export const useDesktop = () => useMedia("(min-width: 800px)");
