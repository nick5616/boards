import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { membersCol } from "../../lib/data";
import Faces from "./Faces";

// The little "shared" stamp on a mounted tab, with the faces of the people who have it.
// Quiet when the list can't be read (the space is gone, or isn't mine).
export default function TabRibbon({ sid }) {
  const [people, setPeople] = useState([]);
  useEffect(
    () => onSnapshot(membersCol(sid), (s) => setPeople(s.docs.map((d) => d.data())), () => setPeople([])),
    [sid]
  );
  return (
    <span className="tab-ribbon" title={people.length ? `shared with ${people.map((p) => p.name || "a guest").join(", ")}` : "shared"}>
      <span className="tab-ribbon-word">shared</span>
      {people.length > 1 && <Faces people={people.slice(0, 3)} size={16} />}
    </span>
  );
}
