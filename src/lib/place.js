// Where you are, asked once for everything. The weather, tides, sky, almanac, errands
// and garden modules all start from this home place; a module keeps its own `place`
// only when someone picks a different one for it (a friend's town, a trip).
// It lives in this browser, like the API keys.
import { useEffect, useState } from "react";

const KEY = "boards-home-place";
const CHANGED = "boards-home-place-changed";

export function homePlace() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}

export function setHomePlace(place) {
  try {
    if (place) localStorage.setItem(KEY, JSON.stringify({ name: place.name, lat: place.lat, lon: place.lon }));
    else localStorage.removeItem(KEY);
  } catch { /* private window: it just won't stick */ }
  window.dispatchEvent(new Event(CHANGED));
}

export function useHomePlace() {
  const [place, setPlace] = useState(homePlace);
  useEffect(() => {
    const sync = () => setPlace(homePlace());
    window.addEventListener(CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return place;
}

// A module's place: its own if it has one, else home. `own` says which.
export function usePlace(modPlace) {
  const home = useHomePlace();
  return { place: modPlace ?? home, own: !!modPlace, home };
}
