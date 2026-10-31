import { useState } from "react";
import { usePwa, applyUpdate, checkForUpdate, promptInstall } from "../lib/pwa";

const built = new Date(parseInt(__BUILD__, 36)).toLocaleString(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

// Settings → App: boards on the home screen, and which version this is (lib/pwa.js)
export default function AppSettings() {
  const pwa = usePwa();
  const [checked, setChecked] = useState(false);

  const check = async () => {
    setChecked(false);
    await checkForUpdate();
    setChecked(true);
  };

  return (
    <div className="diag appset">
      <p className="diag-intro">
        boards can live on your home screen like an app. It opens without a connection, and what you
        change while offline syncs when you're back.
      </p>

      <h3 className="diag-h">On this device</h3>
      {pwa.installed ? (
        <p className="appset-line">Installed ✓ You're in the app.</p>
      ) : pwa.canInstall ? (
        <div className="diag-acts">
          <button className="mini-btn" onClick={promptInstall}>install boards</button>
        </div>
      ) : pwa.ios ? (
        <p className="appset-line">
          In Safari, tap <b>Share</b> then <b>Add to Home Screen</b>.
        </p>
      ) : (
        <p className="appset-line">
          In your browser's menu, choose <b>Install app</b> or <b>Add to Home screen</b>.
        </p>
      )}

      <h3 className="diag-h">Updates</h3>
      <p className="appset-line">This version: {built}</p>
      {!pwa.supported || !import.meta.env.PROD ? (
        <p className="diag-none">
          {import.meta.env.PROD ? "This browser can't update boards in the background." : "Dev server: always the newest code, no offline copy."}
        </p>
      ) : (
        <>
          <div className="diag-acts">
            {pwa.ready ? (
              <button className="mini-btn" onClick={applyUpdate}>refresh to update</button>
            ) : (
              <button className="mini-btn ghost" onClick={check} disabled={pwa.checking}>
                {pwa.checking ? "checking…" : checked ? "up to date ✓" : "check for updates"}
              </button>
            )}
          </div>
          <p className="diag-none">
            New versions download in the background and switch in next time you open boards.
          </p>
        </>
      )}
    </div>
  );
}
