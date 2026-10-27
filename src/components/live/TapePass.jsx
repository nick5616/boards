import { useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { firstName } from "../../lib/share";
import { startShelf } from "../../lib/tapePass";

// Invisible. While this board is shared and live, takes that one of us has and another doesn't
// travel over the peer bus (see lib/tapePass.js). Tells the tape recorder cards when one lands.
export default function TapePass({ room, board, who }) {
  const { toast } = useData();
  const live = useRef({});
  live.current = { board, who, toast };

  const shelf = useRef(null);
  useEffect(() => {
    shelf.current = startShelf(room, {
      getTakes: () =>
        live.current.board.modules
          .filter((m) => m.type === "tape")
          .flatMap((m) => (m.state?.takes ?? []).map((take) => ({ take, boardId: live.current.board.id, modId: m.id }))),
      onGot: (id, from) => {
        window.dispatchEvent(new CustomEvent("boards:media", { detail: { id } }));
        const name = firstName(live.current.who(from).name);
        live.current.toast({ text: `${name}'s tape is on your shelf ▶`, ms: 3000 });
      },
    });
    return () => shelf.current?.stop();
  }, [room]);

  // The board gained a take (mine, or one a collaborator made): see if it's missing here
  const key = board.modules.filter((m) => m.type === "tape").flatMap((m) => (m.state?.takes ?? []).map((t) => t.id)).join(",");
  useEffect(() => {
    if (key) shelf.current?.refresh();
  }, [key]);

  return null;
}
