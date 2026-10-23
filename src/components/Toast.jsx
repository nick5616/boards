import { useState, useEffect } from "react";

// toast = { text, actions: [{ label, run }], prompt?: { placeholder, submit } }
// An action that returns a prompt object swaps the toast into a one-line input.
export default function Toast({ toast, onDone }) {
  const [prompt, setPrompt] = useState(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    setPrompt(null);
    setValue("");
  }, [toast]);

  useEffect(() => {
    if (!toast || prompt) return;
    const t = setTimeout(onDone, toast.ms ?? 5000);
    return () => clearTimeout(t);
  }, [toast, prompt, onDone]);

  if (!toast) return null;

  if (prompt) {
    const submit = () => {
      if (value.trim()) prompt.submit(value.trim());
      onDone();
    };
    return (
      <div className="toast toast-prompt" role="status">
        <input
          autoFocus
          className="toast-input"
          placeholder={prompt.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onDone();
          }}
        />
        <button className="toast-btn" onClick={submit}>save</button>
      </div>
    );
  }

  return (
    <div className="toast" role="status">
      <span className="toast-text">{toast.text}</span>
      {toast.actions?.map((a) => (
        <button
          key={a.label}
          className="toast-btn"
          onClick={() => {
            const p = a.run();
            if (p?.submit) setPrompt(p);
            else onDone();
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
