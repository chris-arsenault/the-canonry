/**
 * ConfigViewer - Collapsible engine config display
 */

import React, { useState, useCallback } from 'react';

export default function ConfigViewer({
  engineConfig,
  debugConfig,
  onShowDebugModal,
}) {
  const [showConfig, setShowConfig] = useState(false);

  const copyConfig = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(engineConfig, null, 2));
  }, [engineConfig]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          className="lw-config-toggle"
          style={{ flex: 1, marginTop: 0 }}
          onClick={() => setShowConfig(!showConfig)}
        >
          <span>{showConfig ? '▼' : '▶'}</span>
          <span>View Engine Configuration</span>
          <button
            className="lw-btn-copy"
            onClick={(e) => { e.stopPropagation(); copyConfig(); }}
          >
            Copy
          </button>
        </div>
        <button
          className={`lw-btn lw-btn-debug ${debugConfig.enabled ? 'active' : ''}`}
          onClick={onShowDebugModal}
        >
          🔧 Debug {debugConfig.enabled ? `(${debugConfig.enabledCategories.length || 'All'})` : ''}
        </button>
      </div>
      {showConfig && (
        <div className="lw-config-output">
          {JSON.stringify(engineConfig, null, 2)}
        </div>
      )}
    </>
  );
}
