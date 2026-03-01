/**
 * PopulationMetrics - Entity counts and population health
 */

import React from "react";
import PropTypes from "prop-types";
import "./PopulationMetrics.css";

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
          <span
            className="pm-deviation"
            style={{
              '--pm-deviation-color': (() => {
                if (populationReport.avgDeviation < 0.2) return "var(--lw-success)";
                if (populationReport.avgDeviation < 0.4) return "var(--lw-warning)";
                return "var(--lw-danger)";
              })(),
            }}
          >
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
          <div className="lw-section-spacer">
            <div className="lw-section-label">
              Population Health
            </div>
            <div className="lw-flex-col lw-gap-sm">
              {populationReport.entityMetrics.slice(0, 6).map((metric) => {
                const deviationPercent = Math.abs(metric.deviation * 100);
                let color;
                if (deviationPercent < 20) color = "var(--lw-success)";
                else if (deviationPercent < 40) color = "var(--lw-warning)";
                else color = "var(--lw-danger)";
                return (
                  <div key={`${metric.kind}:${metric.subtype}`} className="lw-pressure-gauge">
                    <span className="lw-pressure-name">
                      {metric.kind}:{metric.subtype}
                    </span>
                    <div className="lw-pressure-bar">
                      <div
                        className="lw-pressure-fill pm-pressure-fill"
                        style={{
                          '--pm-pressure-fill-width': `${Math.min(100, (metric.count / metric.target) * 50)}%`,
                          '--pm-pressure-fill-color': color,
                        }}
                      />
                    </div>
                    <span className="lw-pressure-value pm-pressure-value" style={{ '--pm-pressure-value-color': color }}>
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

PopulationMetrics.propTypes = {
  populationReport: PropTypes.object,
  epochStats: PropTypes.array,
};
