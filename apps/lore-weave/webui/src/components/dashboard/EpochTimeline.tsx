/**
 * EpochTimeline - Shows recent epochs and pressure gauges with detailed breakdowns
 */

import React, { useState, useMemo, useCallback } from "react";
import type { EpochStatsPayload, EpochStartPayload, PressureUpdatePayload, PressureChangeDetail, DiscretePressureModification, FeedbackContribution } from "../../../../lib/observer/types";
import type { EpochEraSummary } from "../../../../lib/engine/types";
import "./EpochTimeline.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReachabilityInfo {
  connectedComponents?: number;
  fullyConnectedTick?: number | null;
}

interface EpochTimelineProps {
  epochStats: EpochStatsPayload[];
  currentEpoch: EpochStartPayload | null;
  pressures: Record<string, number> | null;
  pressureDetails: PressureUpdatePayload | null;
  reachability: ReachabilityInfo | null;
}

interface PressureTooltipProps {
  detail: PressureChangeDetail;
  discreteModifications: DiscretePressureModification[];
  tickCount: number | undefined;
}

interface PressureGaugeProps {
  name: string;
  value: number;
  detail: PressureChangeDetail | undefined;
  discreteModifications: DiscretePressureModification[] | undefined;
  tickCount: number | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEpochEra(era: EpochEraSummary | undefined) {
  if (!era) return "Unknown era";
  const startName = era.start?.name || "Unknown era";
  const endName = era.end?.name || startName;
  if (!era.transitions || era.transitions.length === 0 || startName === endName) {
    return endName;
  }
  return `${startName} \u2192 ${endName}`;
}

function formatSigned(n: number): string {
  return n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
}

// ---------------------------------------------------------------------------
// PressureTooltip sub-components
// ---------------------------------------------------------------------------

function FeedbackSection({ breakdown }: { breakdown: PressureChangeDetail["breakdown"] }) {
  return (
    <div className="viewer-section">
      <div className="lw-tooltip-subtitle">Feedback (cumulative)</div>
      {breakdown.positiveFeedback.length === 0 && breakdown.negativeFeedback.length === 0 && (
        <div className="lw-tooltip-row lw-tooltip-empty">
          <span>No feedback factors defined</span>
        </div>
      )}
      {breakdown.positiveFeedback.map((f: FeedbackContribution, i: number) => (
        <div key={`pos-${i}`} className="lw-tooltip-row">
          <span title={`${f.type}: avg raw=${f.rawValue.toFixed(2)}, coef=${f.coefficient}`}>
            {"\u2191"} {f.label}
          </span>
          <span className="positive">{formatSigned(f.contribution)}</span>
        </div>
      ))}
      {breakdown.negativeFeedback.map((f: FeedbackContribution, i: number) => (
        <div key={`neg-${i}`} className="lw-tooltip-row">
          <span title={`${f.type}: avg raw=${f.rawValue.toFixed(2)}, coef=${f.coefficient}`}>
            {"\u2193"} {f.label}
          </span>
          <span className="negative">-{f.contribution.toFixed(2)}</span>
        </div>
      ))}
      <div className="lw-tooltip-row lw-tooltip-subtotal">
        <span>Net feedback (before scaling)</span>
        <span>{formatSigned(breakdown.feedbackTotal)}</span>
      </div>
      {breakdown.homeostasis !== undefined && breakdown.homeostasis !== 0 && (
        <div className="lw-tooltip-row">
          <span>Homeostatic pull</span>
          <span className={breakdown.homeostaticDelta >= 0 ? "positive" : "negative"}>
            {formatSigned(breakdown.homeostaticDelta)}
          </span>
        </div>
      )}
    </div>
  );
}

function ModifiersSection({ breakdown }: { breakdown: PressureChangeDetail["breakdown"] }) {
  return (
    <div className="viewer-section">
      <div className="lw-tooltip-subtitle">Modifiers (cumulative)</div>
      <div className="lw-tooltip-row">
        <span>Growth scaling (diminishing returns)</span>
        <span>{"\u00D7"}{breakdown.growthScaling.toFixed(2)}</span>
      </div>
      {breakdown.eraModifier !== 1.0 && (
        <div className="lw-tooltip-row">
          <span>Era modifier</span>
          <span>{"\u00D7"}{breakdown.eraModifier.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

interface GroupedMods {
  [type: string]: DiscretePressureModification[];
}

function DiscreteChangesSection({ groupedMods }: { groupedMods: GroupedMods }) {
  const modTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const [type, mods] of Object.entries(groupedMods)) {
      totals[type] = mods.reduce((sum, m) => sum + m.delta, 0);
    }
    return totals;
  }, [groupedMods]);

  if (Object.keys(groupedMods).length === 0) return null;

  return (
    <div className="viewer-section">
      <div className="lw-tooltip-subtitle">Discrete Changes</div>
      {Object.entries(groupedMods).map(([type, mods]) => (
        <div key={type} className="lw-tooltip-mod-group">
          <div className="lw-tooltip-row lw-tooltip-mod-header">
            <span>
              {type} ({mods.length})
            </span>
            <span className={modTotals[type] >= 0 ? "positive" : "negative"}>
              {formatSigned(modTotals[type])}
            </span>
          </div>
          {mods.slice(0, 3).map((mod, i) => (
            <div key={i} className="lw-tooltip-row lw-tooltip-mod-detail">
              <span>
                {mod.source.type === "template" ? mod.source.templateId :
                 mod.source.type === "system" ? mod.source.systemId :
                 mod.source.type === "era_entry" || mod.source.type === "era_exit" ? mod.source.eraId :
                 mod.source.type === "action" ? mod.source.actionId : "unknown"}
              </span>
              <span className={mod.delta >= 0 ? "positive" : "negative"}>{formatSigned(mod.delta)}</span>
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
  );
}

function FinalSection({ detail, breakdown, tickCount }: {
  detail: PressureChangeDetail;
  breakdown: PressureChangeDetail["breakdown"];
  tickCount: number | undefined;
}) {
  return (
    <div className="viewer-section lw-tooltip-final">
      <div className="lw-tooltip-row">
        <span>Total raw delta (feedback + homeostasis)</span>
        <span>{formatSigned(breakdown.rawDelta)}</span>
      </div>
      <div className="lw-tooltip-row">
        <span>Smoothed delta (max {"\u00B1"}2/tick {"\u00D7"} {tickCount || "?"} ticks)</span>
        <span className={breakdown.smoothedDelta >= 0 ? "positive" : "negative"}>
          {formatSigned(breakdown.smoothedDelta)}
        </span>
      </div>
      <div className="lw-tooltip-row lw-tooltip-actual-change">
        <span>Actual epoch change</span>
        <span className={detail.delta >= 0 ? "positive" : "negative"}>
          <strong>{formatSigned(detail.delta)}</strong>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PressureTooltip
// ---------------------------------------------------------------------------

function PressureTooltip({ detail, discreteModifications, tickCount }: PressureTooltipProps) {
  if (!detail) return null;

  const { breakdown } = detail;
  const relevantMods = discreteModifications?.filter((m) => m.pressureId === detail.id) || [];

  const groupedMods = useMemo(() => {
    const groups: GroupedMods = {};
    for (const mod of relevantMods) {
      const key = mod.source.type;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(mod);
    }
    return groups;
  }, [relevantMods]);

  return (
    <div className="lw-pressure-tooltip">
      <div className="lw-tooltip-header">
        <strong>{detail.name}</strong>
        <span className="lw-tooltip-value">
          {detail.previousValue.toFixed(1)} {"\u2192"} {detail.newValue.toFixed(1)}
        </span>
      </div>
      {tickCount && <div className="lw-tooltip-epoch-info">Cumulative over {tickCount} ticks</div>}

      <FeedbackSection breakdown={breakdown} />
      <ModifiersSection breakdown={breakdown} />
      <DiscreteChangesSection groupedMods={groupedMods} />
      <FinalSection detail={detail} breakdown={breakdown} tickCount={tickCount} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PressureGauge
// ---------------------------------------------------------------------------

function PressureGauge({ name, value, detail, discreteModifications, tickCount }: PressureGaugeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleMouseEnter = useCallback(() => setShowTooltip(true), []);
  const handleMouseLeave = useCallback(() => setShowTooltip(false), []);

  const fillColor = value > 70 ? "var(--lw-danger)" : value > 40 ? "var(--lw-warning)" : "var(--lw-success)";

  return (
    <div
      className="lw-pressure-gauge et-gauge-interactive"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="lw-pressure-name">{name}</span>
      <div className="lw-pressure-bar">
        <div
          className="lw-pressure-fill et-pressure-fill"
          style={{
            '--et-pressure-fill-width': `${Math.min(100, value)}%`,
            '--et-pressure-fill-color': fillColor,
          } as React.CSSProperties}
        />
      </div>
      <span className="lw-pressure-value">
        {value.toFixed(0)}
        {detail && (
          <span className={`lw-pressure-delta ${detail.delta >= 0 ? "positive" : "negative"}`}>
            {detail.delta >= 0 ? "\u2191" : "\u2193"}
          </span>
        )}
      </span>
      {showTooltip && detail && (
        <PressureTooltip
          detail={detail}
          discreteModifications={discreteModifications || []}
          tickCount={tickCount}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connectivity section
// ---------------------------------------------------------------------------

function ConnectivitySection({ reachability }: { reachability: ReachabilityInfo | null }) {
  const connectedComponents = reachability?.connectedComponents;
  const fullyConnectedTick = reachability?.fullyConnectedTick ?? null;

  const disconnectedClustersValue =
    typeof connectedComponents === "number" ? connectedComponents.toLocaleString() : "--";

  let fullyConnectedValue = "--";
  if (reachability) {
    fullyConnectedValue = fullyConnectedTick === null ? "never" : fullyConnectedTick.toLocaleString();
  }

  const clusterValueColor =
    typeof connectedComponents === "number" && connectedComponents > 1
      ? "var(--lw-danger)"
      : undefined;

  return (
    <div className="lw-section-spacer">
      <div className="lw-section-label">
        Graph Connectivity
      </div>
      <div className="lw-flex-col lw-gap-sm">
        <div className="et-metric-row">
          <span>Disconnected clusters</span>
          <span className="et-cluster-value" style={{ '--et-cluster-value-color': clusterValueColor } as React.CSSProperties}>{disconnectedClustersValue}</span>
        </div>
        <div className="et-metric-row">
          <span>Fully connected tick</span>
          <span className="et-connected-value">{fullyConnectedValue}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EpochTimeline({
  epochStats,
  currentEpoch,
  pressures,
  pressureDetails,
  reachability,
}: EpochTimelineProps) {
  const recentEpochs = useMemo(() => epochStats.slice(-5).reverse(), [epochStats]);

  const detailsMap = useMemo(() => {
    const map = new Map<string, PressureChangeDetail>();
    if (pressureDetails?.pressures) {
      for (const p of pressureDetails.pressures) {
        map.set(p.id, p);
      }
    }
    return map;
  }, [pressureDetails?.pressures]);

  const pressureEntries = useMemo(
    () => (pressures ? Object.entries(pressures) : []),
    [pressures],
  );

  return (
    <div className="lw-panel">
      <div className="lw-panel-header">
        <div className="lw-panel-title">
          <span>{"\u23F1"}</span>
          Epoch Timeline
        </div>
        {currentEpoch && (
          <span className="et-era-label">
            Era: {currentEpoch.era.name}
          </span>
        )}
      </div>
      <div className="lw-panel-content">
        {recentEpochs.length === 0 ? (
          <div className="viewer-empty-state">
            <span className="lw-empty-icon">{"\u23F3"}</span>
            <span>No epochs completed yet</span>
          </div>
        ) : (
          <>
            <div className="lw-timeline">
              {recentEpochs.map((epoch, i) => (
                <div
                  key={epoch.epoch}
                  className={`lw-timeline-item ${i === 0 ? "active" : ""} et-timeline-opacity`}
                  style={{ '--et-timeline-opacity': i === 0 ? 1 : 0.7 } as React.CSSProperties}
                >
                  <div className={`lw-timeline-icon ${i === 0 ? "active" : ""}`}>{epoch.epoch}</div>
                  <div className="lw-timeline-content">
                    <div className="lw-timeline-title">{formatEpochEra(epoch.era)}</div>
                    <div className="lw-timeline-subtitle">
                      +{epoch.entitiesCreated} entities {"\u2022"} +{epoch.relationshipsCreated} relations
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {pressures && pressureEntries.length > 0 && (
              <div className="lw-section-spacer">
                <div className="lw-section-label">
                  Current Pressures
                  {pressureDetails && (
                    <span className="lw-section-label-hint">
                      (hover for epoch details
                      {pressureDetails.tick
                        ? `, ${pressureDetails.tick} ticks`
                        : ""}
                      )
                    </span>
                  )}
                </div>
                <div className="lw-flex-col lw-gap-sm">
                  {pressureEntries.map(([name, value]) => (
                    <PressureGauge
                      key={name}
                      name={name}
                      value={value}
                      detail={detailsMap.get(name)}
                      discreteModifications={pressureDetails?.discreteModifications}
                      tickCount={(pressureDetails as PressureUpdatePayload & { ticksAggregated?: number })?.ticksAggregated}
                    />
                  ))}
                </div>
              </div>
            )}

            <ConnectivitySection reachability={reachability} />
          </>
        )}
      </div>
    </div>
  );
}
