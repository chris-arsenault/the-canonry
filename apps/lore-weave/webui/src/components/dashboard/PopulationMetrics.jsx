/**
 * PopulationMetrics - Entity counts and population health
 */

import React from 'react';

export default function PopulationMetrics({ populationReport, epochStats }) {
  // Get latest epoch stats for entity breakdown
  const latestEpoch = epochStats[epochStats.length - 1];

  if (!populationReport && !latestEpoch) {
    return (
      <div className="lw-panel">
        <div className="lw-panel-header">
          <div className="lw-panel-title">
            <span>📊</span>
            Population Metrics
          </div>
        </div>
        <div className="lw-panel-content">
          <div className="lw-empty-state">
            <span className="lw-empty-icon">📈</span>
            <span>Metrics will appear after first epoch</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lw-panel">
      <div className="lw-panel-header">
        <div className="lw-panel-title">
          <span>📊</span>
          Population Metrics
        </div>
        {populationReport && (
          <span style={{
            fontSize: '12px',
            color: populationReport.avgDeviation < 0.2 ? 'var(--lw-success)' :
                   populationReport.avgDeviation < 0.4 ? 'var(--lw-warning)' : 'var(--lw-danger)'
          }}>
            {(populationReport.avgDeviation * 100).toFixed(1)}% avg deviation
          </span>
        )}
      </div>
      <div className="lw-panel-content">
        {/* Entity counts by kind */}
        {latestEpoch && (
          <div className="lw-metric-grid">
            {Object.entries(latestEpoch.entitiesByKind).map(([kind, count]) => (
              <div key={kind} className="lw-metric-card">
                <div className="lw-metric-header">
                  <span className="lw-metric-name">{kind}</span>
                </div>
                <div className="lw-metric-value">{count}</div>
              </div>
            ))}
          </div>
        )}

        {/* Population deviations */}
        {populationReport && populationReport.entityMetrics.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--lw-text-muted)', marginBottom: '8px' }}>
              Population Health
            </div>
            <div className="lw-flex-col lw-gap-sm">
              {populationReport.entityMetrics.slice(0, 6).map(metric => {
                const deviationPercent = Math.abs(metric.deviation * 100);
                const color = deviationPercent < 20 ? 'var(--lw-success)' :
                              deviationPercent < 40 ? 'var(--lw-warning)' : 'var(--lw-danger)';
                return (
                  <div key={`${metric.kind}:${metric.subtype}`} className="lw-pressure-gauge">
                    <span className="lw-pressure-name">{metric.kind}:{metric.subtype}</span>
                    <div className="lw-pressure-bar">
                      <div
                        className="lw-pressure-fill"
                        style={{
                          width: `${Math.min(100, (metric.count / metric.target) * 50)}%`,
                          backgroundColor: color
                        }}
                      />
                    </div>
                    <span className="lw-pressure-value" style={{ color }}>
                      {metric.count}/{metric.target}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
