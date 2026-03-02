import type { WorldState, Validation } from "../types/world.ts";
import "./StatsPanel.css";
import React from "react";

function intensityClass(value: number): string {
  const mag = Math.abs(Math.max(-100, Math.min(100, value)));
  if (mag >= 75) return "high";
  if (mag >= 50) return "medium";
  if (mag >= 25) return "low";
  return "minimal";
}

function ValidationGroup({ validation }: Readonly<{ validation: Validation }>) {
  return (
    <div className="stats-group">
      <h4 className="stats-group-title">Validation</h4>
      <div className="validation-summary">
        <div className="validation-stat">
          <span className="validation-label">Passed:</span>
          <span className="validation-value passed">{validation.passed}/{validation.totalChecks}</span>
        </div>
        {validation.failed > 0 && (
          <div className="validation-stat">
            <span className="validation-label">Failed:</span>
            <span className="validation-value failed">{validation.failed}</span>
          </div>
        )}
      </div>
      <div className="validation-results">
        {validation.results.map((result, i) => (
          <div key={i} className={`validation-result ${result.passed ? "passed" : "failed"}`}>
            <div className="validation-result-header">
              <span className="validation-result-icon">{result.passed ? "✓" : "✗"}</span>
              <span className="validation-result-name">{result.name}</span>
              {!result.passed && <span className="validation-result-count">({result.failureCount})</span>}
            </div>
            {!result.passed && <div className="validation-result-details">{result.details}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PressuresGroup({ pressures }: Readonly<{ pressures: Record<string, number> }>) {
  const entries = Object.entries(pressures).sort((a, b) => b[1] - a[1]);
  return (
    <div className="stats-group">
      <h4 className="stats-group-title">World Pressures</h4>
      <div className="pressures-grid">
        {entries.map(([name, value]) => (
          <div key={name} className="pressure-item">
            <div className="pressure-header">
              <span className="pressure-name">{name.replace(/_/g, " ")}</span>
              <span className="pressure-value">{value.toFixed(1)}</span>
            </div>
            <div className="pressure-bar">
              <div className={`pressure-bar-fill ${intensityClass(value)}`}
                style={{ '--sp-pressure-width': `${(Math.max(-100, Math.min(100, value)) + 100) / 2}%` } as React.CSSProperties} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface StatsPanelProps { worldData: WorldState; isOpen: boolean; onToggle: () => void; }

export default function StatsPanel({ worldData, isOpen, onToggle }: Readonly<StatsPanelProps>) {
  if (!isOpen) return null;
  return (
    <div className="stats-panel">
      <div className="stats-panel-header">
        <h3 className="stats-panel-title">World Statistics</h3>
        <button onClick={onToggle} className="stats-panel-close">✕</button>
      </div>
      <div className="stats-panel-content">
        {worldData.validation && <ValidationGroup validation={worldData.validation} />}
        <PressuresGroup pressures={worldData.pressures} />
      </div>
    </div>
  );
}
