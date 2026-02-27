import React from "react";
import ReactDOM from "react-dom/client";
import "./App.css";
import "./main.css";

// Standalone entry point is intentionally minimal.
// Lore Weave runs inside the Canonry shell via module federation.

function StandaloneNotice() {
  return (
    <div className="sn-root">
      <div className="sn-content">
        <div className="sn-title">
          Lore Weave runs inside Canonry
        </div>
        <div className="sn-subtitle">
          Launch the Canonry shell to use Lore Weave.
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StandaloneNotice />
  </React.StrictMode>
);
