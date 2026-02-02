/**
 * ResultsViewer - Displays simulation results
 *
 * Shows the output from a completed simulation run including:
 * - Entity and relationship counts
 * - Generated entities by type
 * - History events
 * - Pressure states
 */

import React, { useState, useMemo } from 'react';

export default function ResultsViewer({ results, schema, onNewRun }) {
  const [activeTab, setActiveTab] = useState('overview');

  // Process results for display
  const processedData = useMemo(() => {
    if (!results) return null;

    const { metadata, hardState, relationships, pressures, engineConfig } = results;

    // Group entities by kind
    const entityGroups = {};
    (hardState || []).forEach(entity => {
      const key = `${entity.kind}:${entity.subtype}`;
      if (!entityGroups[key]) entityGroups[key] = [];
      entityGroups[key].push(entity);
    });

    // Group relationships by kind
    const relationshipGroups = {};
    (relationships || []).forEach(rel => {
      if (!relationshipGroups[rel.kind]) relationshipGroups[rel.kind] = [];
      relationshipGroups[rel.kind].push(rel);
    });

    return {
      metadata,
      entityGroups,
      relationshipGroups,
      pressures: pressures || {},
      engineConfig,
    };
  }, [results]);

  if (!results) {
    return (
      <div className="lw-container">
        <div className="lw-empty-state" style={{ height: 'auto', padding: '80px 40px' }}>
          <div className="lw-empty-icon"></div>
          <div className="lw-empty-title">No Results Yet</div>
          <div className="lw-empty-text">
            Run a simulation to see the generated world history here.
            You can review the configuration and adjust parameters before running.
          </div>
          <button className="lw-btn lw-btn-primary" onClick={onNewRun}>
            Go to Run
          </button>
        </div>
      </div>
    );
  }

  const exportResults = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lore-weave-results.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(processedData.engineConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'engine-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="lw-container">
      <div className="lw-header">
        <h1 className="lw-title">Simulation Results</h1>
        <p className="lw-subtitle">
          Generated world with {processedData.metadata?.entityCount || 0} entities
          and {processedData.metadata?.relationshipCount || 0} relationships
        </p>
      </div>

      {/* Action Buttons */}
      <div className="lw-button-group" style={{ marginBottom: '24px' }}>
        <button className="lw-btn lw-btn-secondary" onClick={exportResults}>
          Export Results
        </button>
        <button className="lw-btn lw-btn-secondary" onClick={exportConfig}>
          Export Config
        </button>
        <button className="lw-btn lw-btn-secondary" onClick={onNewRun}>
          Run New Simulation
        </button>
      </div>

      {/* Stats Overview */}
      <div className="lw-stats-grid">
        <StatCard label="Total Entities" value={processedData.metadata?.entityCount || 0} />
        <StatCard label="Total Relationships" value={processedData.metadata?.relationshipCount || 0} />
        <StatCard label="Final Tick" value={processedData.metadata?.tick || 0} />
        <StatCard label="Epochs" value={processedData.metadata?.epoch || 0} />
        <StatCard label="Final Era" value={processedData.metadata?.era || 'N/A'} />
      </div>

      {/* Tabs */}
      <div className="lw-tabs">
        <button
          className={`lw-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`lw-tab ${activeTab === 'entities' ? 'active' : ''}`}
          onClick={() => setActiveTab('entities')}
        >
          Entities
        </button>
        <button
          className={`lw-tab ${activeTab === 'pressures' ? 'active' : ''}`}
          onClick={() => setActiveTab('pressures')}
        >
          Pressures
        </button>
        <button
          className={`lw-tab ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          Config
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Entity Groups */}
          <div className="lw-card">
            <div className="lw-card-title">
              Entity Breakdown ({Object.keys(processedData.entityGroups).length} types)
            </div>
            <div className="lw-item-list">
              {Object.entries(processedData.entityGroups).map(([type, entities]) => (
                <span key={type} className="lw-item-badge">
                  {type}: {entities.length}
                </span>
              ))}
              {Object.keys(processedData.entityGroups).length === 0 && (
                <span className="lw-comment">
                  No entities generated (mock run)
                </span>
              )}
            </div>
          </div>

          {/* Relationship Groups */}
          <div className="lw-card">
            <div className="lw-card-title">
              Relationship Types ({Object.keys(processedData.relationshipGroups).length} kinds)
            </div>
            <div className="lw-item-list">
              {Object.entries(processedData.relationshipGroups).map(([kind, rels]) => (
                <span key={kind} className="lw-item-badge">
                  {kind}: {rels.length}
                </span>
              ))}
              {Object.keys(processedData.relationshipGroups).length === 0 && (
                <span className="lw-comment">
                  No relationships generated (mock run)
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'entities' && (
        <div className="lw-card">
          <div className="lw-card-title">Generated Entities</div>
          {(results.hardState || []).length === 0 ? (
            <div className="lw-comment">
              Entity generation is a mock in the current version.
              Run the CLI for actual entity generation.
            </div>
          ) : (
            <div className="lw-code-block">
              {JSON.stringify(results.hardState, null, 2)}
            </div>
          )}
        </div>
      )}

      {activeTab === 'pressures' && (
        <div className="lw-card">
          <div className="lw-card-title">Final Pressure States</div>
          {Object.entries(processedData.pressures).length === 0 ? (
            <div className="lw-comment">
              No pressure data available
            </div>
          ) : (
            <div className="lw-flex-col lw-gap-md">
              {Object.entries(processedData.pressures).map(([name, value]) => (
                <PressureBar key={name} name={name} value={value} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'config' && (
        <div className="lw-card">
          <div className="lw-card-title">Engine Configuration Used</div>
          <div className="lw-code-block">
            {JSON.stringify(processedData.engineConfig, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="lw-stat-card">
      <div className="lw-stat-card-label">{label}</div>
      <div className="lw-stat-card-value">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function PressureBar({ name, value }) {
  const numValue = typeof value === 'number' ? value : 50;
  const percent = Math.max(0, Math.min(100, numValue));

  // Color based on value
  const color = percent > 70 ? 'var(--lw-danger)' :
                percent > 30 ? 'var(--lw-warning)' : 'var(--lw-success)';

  return (
    <div className="lw-pressure-gauge">
      <span className="lw-pressure-name">{name}</span>
      <div className="lw-pressure-bar">
        <div
          className="lw-pressure-fill"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <span className="lw-pressure-value">{numValue.toFixed(0)}</span>
    </div>
  );
}
