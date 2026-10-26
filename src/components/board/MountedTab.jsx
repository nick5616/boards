import { useData } from "../../contexts/DataContext";
import BoardView from "./BoardView";

// A tab whose things live in another space (a shared tab, or a whole shared board
// tucked into this one). It's a board view of that space, without the board's header:
// every add, move and remove goes through updateBoard(thatSpace.id), so it all
// lands in the shared space and not in the board the tab sits on.
export default function MountedTab({ tab, onRemove }) {
  const { mounted } = useData();
  const space = mounted?.get(tab.mount);

  // A space that's still loading is null; one that isn't in the map at all is gone
  // (the owner stopped sharing, took me off it, or it was never shared with me)
  if (space) return <BoardView key={space.id} embedded board={space} onBack={() => {}} onEdit={() => {}} />;
  if (mounted?.has(tab.mount)) return <div className="board-empty mounted-wait">opening the shared tab…</div>;
  return (
    <div className="board-empty mounted-gone">
      <b>this tab went away</b>
      <span>whoever shared it stopped sharing, or it isn't shared with you any more</span>
      <button className="mini-btn" onClick={onRemove}>remove this tab</button>
    </div>
  );
}
