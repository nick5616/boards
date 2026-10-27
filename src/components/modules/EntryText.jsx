import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { updateEntry } from "../../lib/data";
import AutoTA from "../AutoTA";

// Edits one entry's text, saving a moment after typing stops (and on blur)
export default function EntryText({ entry, field = "text", placeholder, className }) {
  const { uid } = useData();
  const [value, setValue] = useState(entry[field] ?? "");
  const timer = useRef(null);
  const dirty = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!dirty.current) setValue(entry[field] ?? "");
  }, [entry, field]);

  const save = (v) => {
    clearTimeout(timer.current);
    dirty.current = false;
    updateEntry(uid, entry.boardId, entry.id, { [field]: v });
  };

  // Unmounting mid-edit (closing the sheet) still saves
  useEffect(() => () => {
    if (dirty.current) save(valueRef.current);
  }, []);

  return (
    <div className={className} onBlur={() => dirty.current && save(value)}>
      <AutoTA
        value={value}
        placeholder={placeholder}
        rich
        solo
        onChange={(v) => {
          setValue(v);
          dirty.current = true;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => save(v), 700);
        }}
      />
    </div>
  );
}
