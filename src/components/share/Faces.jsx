import { faceColor } from "../../lib/share";

// A row of little faces: their photo if they have one, otherwise a coloured
// disc with their first letter. people = [{ uid, name, photo, color? }]
export function Face({ person, size = 28 }) {
  const name = person.name || "Guest";
  const style = { width: size, height: size, fontSize: size * 0.45 };
  return person.photo ? (
    <img className="face" src={person.photo} alt="" title={name} style={style} referrerPolicy="no-referrer" />
  ) : (
    <span className="face face-initial" title={name} style={{ ...style, background: person.color || faceColor(person.uid) }}>
      {name.trim()[0]?.toUpperCase()}
    </span>
  );
}

export default function Faces({ people, size = 28 }) {
  return (
    <span className="faces">
      {people.map((p) => <Face key={p.uid} person={p} size={size} />)}
    </span>
  );
}
