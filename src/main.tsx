import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyStartupConfig } from "./features/command-palette/actions";
import "./index.css";

// Synchronous dark default avoids a light flash for the common case;
// applyStartupConfig then reconciles to the persisted theme + layout mode.
document.documentElement.classList.add('dark');
void applyStartupConfig();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
