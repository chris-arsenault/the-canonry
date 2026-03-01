import React from "react";
import ReactDOM from "react-dom/client";
import CoherenceEngineRemote from "./CoherenceEngineRemote";
import "@the-canonry/shared-components/styles";
import "./main.css";

// Standalone entry point for development
// In production, this is loaded via Module Federation from The Canonry

const mockSchema = Object.freeze({
  entityKinds: [],
  relationshipKinds: [],
  cultures: [],
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <div className="main-root">
      <CoherenceEngineRemote
        schema={mockSchema}
        activeSection="pressures"
        onSectionChange={(section) => console.log("Section changed:", section)}
      />
    </div>
  </React.StrictMode>
);
