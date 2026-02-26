import React from "react";
import ReactDOM from "react-dom/client";
import "./App.css";

// Standalone entry point is intentionally minimal.
// Lore Weave runs inside the Canonry shell via module federation.

const styles = {
  root: {
    height: "100vh",
    backgroundColor: "#1e1e2e",
    color: "#e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
    padding: "24px",
  },
  content: { maxWidth: "520px", textAlign: "center", lineHeight: 1.5 },
  title: { fontSize: "18px", fontWeight: 600, marginBottom: "8px" },
  subtitle: { fontSize: "14px", color: "#9ca3af" },
};

function StandaloneNotice() {
  return (
    <div style={styles.root}>
      <div style={styles.content}>
        <div style={styles.title}>
          Lore Weave runs inside Canonry
        </div>
        <div style={styles.subtitle}>
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
