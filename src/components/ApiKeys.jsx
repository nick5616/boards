import { useState } from "react";
import { KEYS, apiKey, keySource, setApiKey } from "../lib/apis";

// Settings → API keys. Most modules need no key at all; these few get better (or
// start working) with a free one. Keys stay in this browser and only go to their API.
export default function ApiKeys() {
  const [, bump] = useState(0);
  const [draft, setDraft] = useState({});

  const save = (name) => {
    setApiKey(name, draft[name]);
    setDraft((d) => ({ ...d, [name]: undefined }));
    bump((n) => n + 1);
  };

  return (
    <div className="apikeys">
      <p className="apikeys-intro">
        Most modules use free APIs that need no key. These ones work better with your own free key.
        Paste it here. It stays in this browser and is only sent to that one service.
      </p>
      {Object.entries(KEYS).map(([name, k]) => {
        const src = keySource(name);
        const editing = draft[name] !== undefined;
        return (
          <div key={name} className={`apikey apikey-${src ?? "none"}`}>
            <div className="apikey-top">
              <b>{k.label}</b>
              <span className="apikey-state">
                {src === "mine" ? "your key ✓" : src === "env" ? "from .env" : src === "demo" ? "shared demo key" : "no key yet"}
              </span>
            </div>
            <div className="apikey-for">{k.unlocks}</div>
            <div className="apikey-row">
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={src === "mine" ? "••••••••" + (apiKey(name) ?? "").slice(-4) : "paste a key"}
                value={draft[name] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && save(name)}
              />
              {editing && <button className="btn-mini" onClick={() => save(name)}>Save</button>}
              {src === "mine" && !editing && (
                <button className="btn-mini" onClick={() => { setApiKey(name, ""); bump((n) => n + 1); }}>Forget</button>
              )}
              <a className="apikey-get" href={k.get} target="_blank" rel="noreferrer">Get a key ↗</a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
