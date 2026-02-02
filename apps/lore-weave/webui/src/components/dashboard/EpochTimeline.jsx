/**
 * EpochTimeline - Shows recent epochs and pressure gauges with detailed breakdowns
 */

import React, { useState } from 'react';

function formatEpochEra(era) {
  if (!era) return 'Unknown era';
  const startName = era.start?.name || 'Unknown era';
  const endName = era.end?.name || startName;
  if (!era.transitions || era.transitions.length === 0 || startName === endName) {
    return endName;
  }
  return `${startName} → ${endName}`;
}

/**
 * PressureTooltip - Shows detailed breakdown of a pressure's sources
 * Now displays cumulative data across the entire epoch
 */
function PressureTooltip({ detail, discreteModifications, tickCount }) {
  if (!detail) return null;

  const { breakdown } = detail;
  const relevantMods = discreteModifications?.filter(m => m.pressureId === detail.id) || [];

  // Group discrete modifications by source type
  const groupedMods = {};
  for (const mod of relevantMods) {
    const key = mod.source.type;
    if (!groupedMods[key]) {
      groupedMods[key] = [];
    }
    groupedMods[key].push(mod);
  }

  // Format a number with sign
  const fmt = (n) => n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2);

  // Calculate totals by source type
  const modTotals = {};
  for (const [type, mods] of Object.entries(groupedMods)) {
    modTotals[type] = mods.reduce((sum, m) => sum + m.delta, 0);
  }

  return (
    <div className="lw-pressure-tooltip">
      <div className="lw-tooltip-header">
        <strong>{detail.name}</strong>
        <span className="lw-tooltip-value">{detail.previousValue.toFixed(1)} → {detail.newValue.toFixed(1)}</span>
      </div>
      {tickCount && (
        <div className="lw-tooltip-epoch-info">
          Cumulative over {tickCount} ticks
        </div>
      )}

      <div className="lw-tooltip-section">
        <div className="lw-tooltip-subtitle">Feedback (cumulative)</div>
        {breakdown.positiveFeedback.length === 0 && breakdown.negativeFeedback.length === 0 && (
          <div className="lw-tooltip-row lw-tooltip-empty">
            <span>No feedback factors defined</span>
          </div>
        )}
        {breakdown.positiveFeedback.map((f, i) => (
          <div key={`pos-${i}`} className="lw-tooltip-row">
            <span title={`${f.type}: avg raw=${f.rawValue.toFixed(2)}, coef=${f.coefficient}`}>↑ {f.label}</span>
            <span className="positive">{fmt(f.contribution)}</span>
          </div>
        ))}
        {breakdown.negativeFeedback.map((f, i) => (
          <div key={`neg-${i}`} className="lw-tooltip-row">
            <span title={`${f.type}: avg raw=${f.rawValue.toFixed(2)}, coef=${f.coefficient}`}>↓ {f.label}</span>
            <span className="negative">-{f.contribution.toFixed(2)}</span>
          </div>
        ))}
        <div className="lw-tooltip-row lw-tooltip-subtotal">
          <span>Net feedback (before scaling)</span>
          <span>{fmt(breakdown.feedbackTotal)}</span>
        </div>
        {breakdown.homeostasis !== undefined && breakdown.homeostasis !== 0 && (
          <div className="lw-tooltip-row">
            <span>Homeostatic pull</span>
            <span className={breakdown.homeostaticDelta >= 0 ? 'positive' : 'negative'}>{fmt(breakdown.homeostaticDelta)}</span>
          </div>
        )}
      </div>

      <div className="lw-tooltip-section">
        <div className="lw-tooltip-subtitle">Modifiers (cumulative)</div>
        <div className="lw-tooltip-row">
          <span>Growth scaling (diminishing returns)</span>
          <span>×{breakdown.growthScaling.toFixed(2)}</span>
        </div>
        {breakdown.eraModifier !== 1.0 && (
          <div className="lw-tooltip-row">
            <span>Era modifier</span>
            <span>×{breakdown.eraModifier.toFixed(2)}</span>
          </div>
        )}
      </div>

      {Object.keys(groupedMods).length > 0 && (
        <div className="lw-tooltip-section">
          <div className="lw-tooltip-subtitle">Discrete Changes</div>
          {Object.entries(groupedMods).map(([type, mods]) => (
            <div key={type} className="lw-tooltip-mod-group">
              <div className="lw-tooltip-row lw-tooltip-mod-header">
                <span>{type} ({mods.length})</span>
                <span className={modTotals[type] >= 0 ? 'positive' : 'negative'}>{fmt(modTotals[type])}</span>
              </div>
              {mods.slice(0, 3).map((mod, i) => (
                <div key={i} className="lw-tooltip-row lw-tooltip-mod-detail">
                  <span>{mod.source.templateId || mod.source.systemId || mod.source.eraId || 'unknown'}</span>
                  <span className={mod.delta >= 0 ? 'positive' : 'negative'}>{fmt(mod.delta)}</span>
                </div>
              ))}
              {mods.length > 3 && (
                <div className="lw-tooltip-row lw-tooltip-mod-detail">
                  <span>... and {mods.length - 3} more</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="lw-tooltip-section lw-tooltip-final">
        <div className="lw-tooltip-row">
          <span>Total raw delta (feedback + homeostasis)</span>
          <span>{fmt(breakdown.rawDelta)}</span>
        </div>
        <div className="lw-tooltip-row">
          <span>Smoothed delta (max ±2/tick × {tickCount || '?'} ticks)</span>
          <span className={breakdown.smoothedDelta >= 0 ? 'positive' : 'negative'}>{fmt(breakdown.smoothedDelta)}</span>
        </div>
        <div className="lw-tooltip-row lw-tooltip-actual-change">
          <span>Actual epoch change</span>
          <span className={detail.delta >= 0 ? 'positive' : 'negative'}><strong>{fmt(detail.delta)}</strong></span>
        </div>
      </div>
    </div>
  );
}

/**
 * PressureGauge - Individual pressure with hover details
 */
function PressureGauge({ name, value, detail, discreteModifications, tickCount }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="lw-pressure-gauge"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{ position: 'relative', cursor: 'pointer' }}
    >
      <span className="lw-pressure-name">{name}</span>
      <div className="lw-pressure-bar">
        <div
          className="lw-pressure-fill"
          style={{
            width: `${Math.min(100, value)}%`,
            backgroundColor: value > 70 ? 'var(--lw-danger)' : value > 40 ? 'var(--lw-warning)' : 'var(--lw-success)'
          }}
        />
      </div>
      <span className="lw-pressure-value">
        {value.toFixed(0)}
        {detail && (
          <span className={`lw-pressure-delta ${detail.delta >= 0 ? 'positive' : 'negative'}`}>
            {detail.delta >= 0 ? '↑' : '↓'}
          </span>
        )}
      </span>
      {showTooltip && detail && (
        <PressureTooltip detail={detail} discreteModifications={discreteModifications} tickCount={tickCount} />
      )}
    </div>
  );
}

export default function EpochTimeline({ epochStats, currentEpoch, pressures, pressureDetails, reachability }) {
  const recentEpochs = epochStats.slice(-5).reverse();

  // Build a map of pressure details by ID for easy lookup
  const detailsMap = new Map();
  if (pressureDetails?.pressures) {
    for (const p of pressureDetails.pressures) {
      detailsMap.set(p.id, p);
    }
  }

  const connectedComponents = reachability?.connectedComponents;
  const fullyConnectedTick = reachability?.fullyConnectedTick ?? null;
  const disconnectedClustersValue = typeof connectedComponents === 'number'
    ? connectedComponents.toLocaleString()
    : '--';
  const fullyConnectedValue = reachability
    ? (fullyConnectedTick === null ? 'never' : fullyConnectedTick.toLocaleString())
    : '--';
  const metricRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    color: 'var(--lw-text-primary)'
  };
  const clusterValueStyle = {
    fontWeight: 600,
    color: typeof connectedComponents === 'number' && connectedComponents > 1
      ? 'var(--lw-danger)'
      : 'var(--lw-text-primary)'
  };

  return (
    <div className="lw-panel">
      <div className="lw-panel-header">
        <div className="lw-panel-title">
          <span>⏱</span>
          Epoch Timeline
        </div>
        {currentEpoch && (
          <span style={{ fontSize: '12px', color: 'var(--lw-text-muted)' }}>
            Era: {currentEpoch.era.name}
          </span>
        )}
      </div>
      <div className="lw-panel-content">
        {recentEpochs.length === 0 ? (
          <div className="lw-empty-state">
            <span className="lw-empty-icon">⏳</span>
            <span>No epochs completed yet</span>
          </div>
        ) : (
          <>
            <div className="lw-timeline">
              {recentEpochs.map((epoch, i) => (
                <div
                  key={epoch.epoch}
                  className={`lw-timeline-item ${i === 0 ? 'active' : ''}`}
                  style={{ opacity: i === 0 ? 1 : 0.7 }}
                >
                  <div className={`lw-timeline-icon ${i === 0 ? 'active' : ''}`}>
                    {epoch.epoch}
                  </div>
                  <div className="lw-timeline-content">
                    <div className="lw-timeline-title">{formatEpochEra(epoch.era)}</div>
                    <div className="lw-timeline-subtitle">
                      +{epoch.entitiesCreated} entities • +{epoch.relationshipsCreated} relations
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pressure Gauges with hover details */}
            {pressures && Object.keys(pressures).length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--lw-text-muted)', marginBottom: '8px' }}>
                  Current Pressures
                  {pressureDetails && (
                    <span style={{ marginLeft: '8px', opacity: 0.6 }}>
                      (hover for epoch details{pressureDetails.ticksAggregated ? `, ${pressureDetails.ticksAggregated} ticks` : ''})
                    </span>
                  )}
                </div>
                <div className="lw-flex-col lw-gap-sm">
                  {Object.entries(pressures).map(([name, value]) => (
                    <PressureGauge
                      key={name}
                      name={name}
                      value={value}
                      detail={detailsMap.get(name)}
                      discreteModifications={pressureDetails?.discreteModifications}
                      tickCount={pressureDetails?.ticksAggregated}
                    />
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--lw-text-muted)', marginBottom: '8px' }}>
                Graph Connectivity
              </div>
              <div className="lw-flex-col lw-gap-sm">
                <div style={metricRowStyle}>
                  <span>Disconnected clusters</span>
                  <span style={clusterValueStyle}>{disconnectedClustersValue}</span>
                </div>
                <div style={metricRowStyle}>
                  <span>Fully connected tick</span>
                  <span style={{ fontWeight: 600 }}>{fullyConnectedValue}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
