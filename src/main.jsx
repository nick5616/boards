import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import "./styles/boards.css";
import App from "./App";
import { BASE } from "./lib/routes";

// /remote is the phone's half of the phone remote: its own little page, no boards loaded
const Remote = lazy(() => import("./components/remote/RemotePage"));
const onRemote = /^\/remote\/?$/.test(window.location.pathname.slice(BASE.length));

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {onRemote ? <Suspense fallback={null}><Remote /></Suspense> : <App />}
  </StrictMode>
);
