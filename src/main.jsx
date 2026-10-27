import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import "./styles/boards.css";
import "./styles/kit.css";
import "./styles/apis.css";
import "./styles/pack-words.css";
import "./styles/pack-music.css";
import "./styles/pack-screen.css";
import "./styles/pack-games.css";
import "./styles/pack-sky.css";
import "./styles/pack-travel.css";
import "./styles/pack-kitchen.css";
import "./styles/pack-desk.css";
import "./styles/pack-live.css";
import "./styles/pack-media.css";
import App from "./App";
import { BASE } from "./lib/routes";
import { installTelemetry } from "./lib/telemetry";

installTelemetry();

// /remote is the phone's half of the phone remote: its own little page, no boards loaded
const Remote = lazy(() => import("./components/remote/RemotePage"));
const onRemote = /^\/remote\/?$/.test(window.location.pathname.slice(BASE.length));

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {onRemote ? <Suspense fallback={null}><Remote /></Suspense> : <App />}
  </StrictMode>
);
