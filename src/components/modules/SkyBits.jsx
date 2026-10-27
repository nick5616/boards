import { Fold, PlaceAsk } from "./kit";

// Shared by the sky pack, for the big view: "📍 Portland · change". Where you are is the
// shared home place (usePlace); changing it here gives just this module its own place.
// `mine` = the module has its own place; onPlace(place | null) saves it (null = back to home).
export function PlaceFold({ place, mine, onPlace }) {
  return (
    <Fold label={`📍 ${place?.name ?? "place"}${mine ? " (this one only)" : ""}`}>
      <PlaceAsk home={false} why="a different place for just this module" onPlace={onPlace} />
      {mine && <button className="mini-btn ghost sk-reset" onClick={() => onPlace(null)}>back to my home place</button>}
    </Fold>
  );
}
