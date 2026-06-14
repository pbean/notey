import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyBootTheme, applyStartupConfig } from "./features/command-palette/actions";
import "./index.css";

// Synchronous boot default honors the OS `prefers-color-scheme` (Story 7.2), so
// first launch — and any `theme: system` user — paints the matching theme with
// no opposite-theme flash. applyStartupConfig then reconciles to the persisted
// preference (a saved dark/light choice overrides the OS default).
applyBootTheme();
void applyStartupConfig();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
