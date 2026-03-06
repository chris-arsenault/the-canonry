/**
 * ConfigViewer - Collapsible engine config display
 */

import React from "react";
import { useState, useCallback } from "react";
import "./ConfigViewer.css";

interface DebugConfig {
  enabled: boolean;
  enabledCategories: string[];
}

interface ConfigViewerProps {
  engineConfig: Record<string, unknown>;
  debugConfig: DebugConfig;
  onShowDebugModal: () => void;
}

export default function ConfigViewer({ engineConfig, debugConfig, onShowDebugModal }: Readonly<ConfigViewerProps>) {
  const [showConfig, setShowConfig] = useState(false);

  const copyConfig = useCallback(() => {
    void navigator.clipboard.writeText(JSON.stringify(engineConfig, null, 2));
  }, [engineConfig]);

  return (
    <>
      <div className="cv-row">
        <div
          className="config-expand"
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
