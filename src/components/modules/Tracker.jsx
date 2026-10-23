import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { dayKey, addDays, prettyDate, agoLabel } from "../../utils/date";
import Sticker from "../Sticker";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function Tracker({ board, entries, expanded }) {
  const { quickLog, logPractice, undoLog } = useData();
  const [picked, setPicked] = useState(null);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");

  const logs = entries.filter((e) => e.kind === "log");
  const byDay = {};
  logs.forEach((e) => (byDay[e.day] ??= []).push(e));

  const today = new Date();
  const todayKey = dayKey(today);
  const weeks = expanded ? 12 : 4;
  const start = addDays(today, -((today.getDay() + 6) % 7) - 7 * (weeks - 1));
  const days = Array.from({ length: weeks * 7 }, (_, i) => dayKey(addDays(start, i)));
  const thisWeek = days.slice(-7).reduce((n, k) => n + (byDay[k]?.length ?? 0), 0);

  const saveNote = () => {
    if (note.trim()) logPractice(board.id, note.trim());
    setNote("");
    setNoting(false);
  };

  const shown = picked ? byDay[picked] ?? [] : logs.filter((e) => e.text).slice(0, expanded ? 50 : 3);

  return (
    <div className="trk">
      <div className="trk-top">
        <button
          className="trk-stamp"
          onClick={() => quickLog(board.id)}
          aria-label="Log practice for today"
          title="I practiced!"
        >
          <Sticker seed={todayKey + board.id} size={30} />
          <span>practiced</span>
        </button>
        <div className="trk-count">
          <b>{thisWeek}</b> this week
          <div className="trk-last">{board.lastLoggedAt ? `last: ${agoLabel(board.lastLoggedAt)}` : "no stickers yet"}</div>
        </div>
        <button className="mini-btn" onClick={() => setNoting((v) => !v)}>+ note</button>
      </div>

      {noting && (
        <div className="trk-note-in">
          <input
            autoFocus
            className="line-input"
            placeholder="what did you work on?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveNote()}
          />
          <button className="mini-btn" onClick={saveNote}>log</button>
        </div>
      )}

      <div className="trk-grid">
        {WEEKDAYS.map((d, i) => <div key={i} className="trk-wd">{d}</div>)}
        {days.map((k) => {
          const dayLogs = byDay[k];
          const future = k > todayKey;
          return (
            <button
              key={k}
              className={`trk-cell${k === todayKey ? " today" : ""}${future ? " future" : ""}${picked === k ? " picked" : ""}`}
              onClick={() => !future && setPicked(picked === k ? null : k)}
              title={prettyDate(k)}
              tabIndex={dayLogs ? 0 : -1}
            >
              {dayLogs && <Sticker seed={dayLogs[dayLogs.length - 1].id} size={20} />}
              {dayLogs?.length > 1 && <span className="trk-x">×{dayLogs.length}</span>}
            </button>
          );
        })}
      </div>

      {(picked || shown.length > 0) && (
        <div className="trk-notes">
          {picked && <div className="trk-notes-hdr">{prettyDate(picked)} {shown.length === 0 && "· nothing logged"}</div>}
          {shown.map((e) => (
            <div key={e.id} className="trk-note">
              <Sticker seed={e.id} size={14} />
              <span className="trk-note-text">{e.text || "practiced"}</span>
              {!picked && <span className="trk-note-when">{agoLabel(e.at)}</span>}
              {(picked || expanded) && (
                <button className="x-btn" onClick={() => undoLog(e)} aria-label="Remove this log">✕</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
