import { useData } from "../contexts/DataContext";
import { parse, resolve } from "../lib/mentions";

// Words with their @-mentions turned into little paper tags. Clicking a tag
// goes there; clicking anywhere else (or tabbing in) asks to edit the text.
// Without onEdit it's display only.
export default function RichText({ value, className = "", placeholder, onEdit }) {
  const { boards, goTo } = useData();
  return (
    <div
      className={`${className} mn-rich`}
      tabIndex={onEdit ? 0 : undefined}
      onClick={onEdit}
      onFocus={onEdit && ((e) => e.target === e.currentTarget && onEdit())}
    >
      {parse(value).map((p, i) => {
        if (p.type === "text") return <span key={i}>{p.value}</span>;
        const r = resolve(boards, p);
        const go = (e) => {
          e.stopPropagation();
          if (r.ok) goTo(p.boardId, p.modId);
        };
        return (
          <span
            key={i}
            role="link"
            tabIndex={0}
            className={`mn-chip${r.ok ? "" : " gone"}`}
            title={r.ok ? (r.where ? `${r.title} · ${r.where}` : r.title) : "not here any more (or not yours to open)"}
            onClick={go}
            onKeyDown={(e) => e.key === "Enter" && go(e)}
          >
            {p.kind === "board" ? "▤" : "◧"} {r.title}
          </span>
        );
      })}
      {!value && <span className="mn-ph">{placeholder}</span>}
    </div>
  );
}
