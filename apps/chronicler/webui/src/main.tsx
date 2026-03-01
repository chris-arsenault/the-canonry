/**
 * Main entry point for Chronicler MFE
 * Only used in standalone development mode
 */

import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/variables.css";
import "./dev-shell.css";
import ChroniclerRemote from "./ChroniclerRemote.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="dev-shell">
      <h1 className="dev-shell-title">Chronicler (Standalone Dev Mode)</h1>
      <p className="dev-shell-notice">
        Chronicler is designed to run within The Canonry shell. Run <code>npm run canonry</code>{" "}
        from the repo root to use the full suite.
      </p>
      <ChroniclerRemote />
    </div>
  </React.StrictMode>
);
