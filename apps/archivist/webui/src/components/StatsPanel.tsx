import type { WorldState } from '../types/world.ts';
import './StatsPanel.css';

interface StatsPanelProps {
  worldData: WorldState;
  isOpen: boolean;
  onToggle: () => void;
}

export default function StatsPanel({ worldData, isOpen, onToggle }: StatsPanelProps) {
  const { pressures, validation } = worldData;

  // Get pressure entries and sort by value
  const pressureEntries = Object.entries(pressures).sort((a, b) => b[1] - a[1]);

  return (
    <>
      {/* Stats Panel */}
      {isOpen && (
        <div className="stats-panel">
          <div className="stats-panel-header">
            <h3 className="stats-panel-title">World Statistics</h3>
            <button onClick={onToggle} className="stats-panel-close">✕</button>
          </div>

          <div className="stats-panel-content">
            {/* Validation Status */}
            {validation && (
              <div className="stats-section">
                <h4 className="stats-section-title">Validation</h4>
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
                    <div key={i} className={`validation-result ${result.passed ? 'passed' : 'failed'}`}>
                      <div className="validation-result-header">
                        <span className="validation-result-icon">{result.passed ? '✓' : '✗'}</span>
                        <span className="validation-result-name">{result.name}</span>
                        {!result.passed && (
                          <span className="validation-result-count">({result.failureCount})</span>
                        )}
                      </div>
                      {!result.passed && (
                        <div className="validation-result-details">{result.details}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pressures */}
            <div className="stats-section">
              <h4 className="stats-section-title">World Pressures</h4>
              <div className="pressures-grid">
                {pressureEntries.map(([name, value]) => {
                  const clamped = Math.max(-100, Math.min(100, value));
                  const percentage = ((clamped + 100) / 2); // -100..100 → 0..100
                  const magnitude = Math.abs(clamped);
                  const intensity =
                    magnitude >= 75 ? 'high' :
                    magnitude >= 50 ? 'medium' :
                    magnitude >= 25 ? 'low' : 'minimal';
                  return (
                    <div key={name} className="pressure-item">
                      <div className="pressure-header">
                        <span className="pressure-name">{name.replace(/_/g, ' ')}</span>
                        <span className="pressure-value">{value.toFixed(1)}</span>
                      </div>
                      <div className="pressure-bar">
                        <div
                          className={`pressure-bar-fill ${intensity}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
