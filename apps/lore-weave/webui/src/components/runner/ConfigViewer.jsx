/**
 * ConfigViewer - Collapsible engine config display
 */

import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import "./ConfigViewer.css";

export default function ConfigViewer({ engineConfig, debugConfig, onShowDebugModal }) {
  const [showConfig, setShowConfig] = useState(false);

  const copyConfig = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(engineConfig, null, 2));
  }, [engineConfig]);

  return (
    <>
      <div className="cv-row">
        <div
          className="lw-config-toggle cv-toggle-flush"
          onClick={() => setShowConfig(!showConfig)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
        >
          <span>{showConfig ? "▼" : "▶"}</span>
          <span>View Engine Configuration</span>
          <button
            className="lw-btn-copy"
            onClick={(e) => {
              e.stopPropagation();
              copyConfig();
            }}
          >
            Copy
          </button>
        </div>
        <button
          className={`lw-btn lw-btn-debug ${debugConfig.enabled ? "active" : ""}`}
          onClick={onShowDebugModal}
        >
          🔧 Debug {debugConfig.enabled ? `(${debugConfig.enabledCategories.length || "All"})` : ""}
        </button>
      </div>
      {showConfig && (
        <div className="lw-config-output">{JSON.stringify(engineConfig, null, 2)}</div>
      )}
    </>
  );
}

ConfigViewer.propTypes = {
  engineConfig: PropTypes.object,
  debugConfig: PropTypes.object,
  onShowDebugModal: PropTypes.func,
};
