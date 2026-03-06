/**
 * EpochTimeline - Shows recent epochs and pressure gauges with detailed breakdowns
 */

import React, { useState } from "react";
import "./EpochTimeline.css";
import type { EpochStatsPayload, EpochStartPayload } from "../../../../lib/observer/types";

interface FeedbackItem {
  label: string;
  type: string;
  rawValue: number;
  coefficient: number;
  contribution: number;
}

interface PressureBreakdown {
  positiveFeedback: FeedbackItem[];
  negativeFeedback: FeedbackItem[];
  feedbackTotal: number;
  growthScaling: number;
  scaledFeedback: number;
  homeostasis: number;
  homeostaticDelta: number;
  eraModifier: number;
  rawDelta: number;
  smoothedDelta: number;
}

interface PressureDetail {
  id: string;
  name: string;
  previousValue: number;
  newValue: number;
  delta: number;
  tickCount: number;
  breakdown: PressureBreakdown;
}

interface DiscreteMod {
  pressureId: string;
  delta: number;
  source: { type: string; templateId: string; systemId: string; eraId: string };
}

interface PressureDetailsData {
  tick: number;
  epoch: number;
  ticksAggregated: number;
  pressures: PressureDetail[];
  discreteModifications: DiscreteMod[];
}

interface ReachabilityData {
  connectedComponents: number;
  fullyConnectedTick: number | null;
}

function formatEpochEra(era: EpochStatsPayload['era']): string {
  if (!era) return "Unknown era";
  const startName = era.start?.name || "Unknown era";
  const endName = era.end?.name || startName;
  if (!era.transitions || era.transitions.length === 0 || startName === endName) return endName;
  return `${startName} → ${endName}`;
}

const fmt = (n: number) => (n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2));

function PressureTooltip({ detail, discreteModifications, tickCount }: Readonly<{ detail: PressureDetail; discreteModifications: DiscreteMod[]; tickCount: number }>) {
  const { breakdown } = detail;
  const relevantMods = discreteModifications.filter((m) => m.pressureId === detail.id);

  const groupedMods: Record<string, DiscreteMod[]> = {};
  for (const mod of relevantMods) {
    const key = mod.source.type;
    if (!groupedMods[key]) groupedMods[key] = [];
    groupedMods[key].push(mod);
  }

  const modTotals: Record<string, number> = {};
  for (const [type, mods] of Object.entries(groupedMods)) {
    modTotals[type] = mods.reduce((sum, m) => sum + m.delta, 0);
  }

  return (
    <div className="lw-pressure-tooltip">
      <div className="lw-tooltip-header">
        <strong>{detail.name}</strong>
        <span className="lw-tooltip-value">{detail.previousValue.toFixed(1)} → {detail.newValue.toFixed(1)}</span>
      </div>
      {tickCount > 0 && <div className="lw-tooltip-epoch-info">Cumulative over {tickCount} ticks</div>}

      <div className="viewer-section">
        <div className="lw-tooltip-subtitle">Feedback (cumulative)</div>
        {breakdown.positiveFeedback.length === 0 && breakdown.negativeFeedback.length === 0 && (
          <div className="lw-tooltip-row lw-tooltip-empty"><span>No feedback factors defined</span></div>
        )}
        {breakdown.positiveFeedback.map((f, i) => (
          <div key={`pos-${String(i)}`} className="lw-tooltip-row">
            <span title={`${f.type}: avg raw=${f.rawValue.toFixed(2)}, coef=${String(f.coefficient)}`}>↑ {f.label}</span>
            <span className="positive">{fmt(f.contribution)}</span>
          </div>
        ))}
        {breakdown.negativeFeedback.map((f, i) => (
          <div key={`neg-${String(i)}`} className="lw-tooltip-row">
            <span title={`${f.type}: avg raw=${f.rawValue.toFixed(2)}, coef=${String(f.coefficient)}`}>↓ {f.label}</span>
            <span className="negative">-{f.contribution.toFixed(2)}</span>
          </div>
        ))}
        <div className="lw-tooltip-row lw-tooltip-subtotal"><span>Net feedback (before scaling)</span><span>{fmt(breakdown.feedbackTotal)}</span></div>
        {breakdown.homeostasis !== 0 && (
          <div className="lw-tooltip-row"><span>Homeostatic pull</span><span className={breakdown.homeostaticDelta >= 0 ? "positive" : "negative"}>{fmt(breakdown.homeostaticDelta)}</span></div>
        )}
      </div>

      <div className="viewer-section">
        <div className="lw-tooltip-subtitle">Modifiers (cumulative)</div>
        <div className="lw-tooltip-row"><span>Growth scaling (diminishing returns)</span><span>×{breakdown.growthScaling.toFixed(2)}</span></div>
        {breakdown.eraModifier !== 1.0 && (<div className="lw-tooltip-row"><span>Era modifier</span><span>×{breakdown.eraModifier.toFixed(2)}</span></div>)}
      </div>

      {Object.keys(groupedMods).length > 0 && (
        <div className="viewer-section">
          <div className="lw-tooltip-subtitle">Discrete Changes</div>
          {Object.entries(groupedMods).map(([type, mods]) => (
            <div key={type} className="lw-tooltip-mod-group">
              <div className="lw-tooltip-row lw-tooltip-mod-header">
                <span>{type} ({mods.length})</span>
                <span className={modTotals[type] >= 0 ? "positive" : "negative"}>{fmt(modTotals[type])}</span>
              </div>
              {mods.slice(0, 3).map((mod, i) => (
                <div key={i} className="lw-tooltip-row lw-tooltip-mod-detail">
                  <span>{mod.source.templateId || mod.source.systemId || mod.source.eraId || "unknown"}</span>
                  <span className={mod.delta >= 0 ? "positive" : "negative"}>{fmt(mod.delta)}</span>
                </div>
              ))}
              {mods.length > 3 && (<div className="lw-tooltip-row lw-tooltip-mod-detail"><span>... and {mods.length - 3} more</span></div>)}
            </div>
          ))}
        </div>
      )}

      <div className="viewer-section lw-tooltip-final">
        <div className="lw-tooltip-row"><span>Total raw delta (feedback + homeostasis)</span><span>{fmt(breakdown.rawDelta)}</span></div>
        <div className="lw-tooltip-row"><span>Smoothed delta (max ±2/tick × {tickCount || "?"} ticks)</span><span className={breakdown.smoothedDelta >= 0 ? "positive" : "negative"}>{fmt(breakdown.smoothedDelta)}</span></div>
        <div className="lw-tooltip-row lw-tooltip-actual-change"><span>Actual epoch change</span><span className={detail.delta >= 0 ? "positive" : "negative"}><strong>{fmt(detail.delta)}</strong></span></div>
      </div>
    </div>
  );
}

interface PressureGaugeProps {
  name: string;
  value: number;
  detail: PressureDetail | null;
  discreteModifications: DiscreteMod[];
  tickCount: number;
}

function pressureColor(value: number): string {
  if (value > 70) return "var(--lw-danger)";
  if (value > 40) return "var(--lw-warning)";
  return "var(--lw-success)";
}

function PressureGauge({ name, value, detail, discreteModifications, tickCount }: Readonly<PressureGaugeProps>) {
  const [showTooltip, setShowTooltip] = useState(false);
  const fillColor = pressureColor(value);

  return (
    <div className="lw-pressure-gauge et-gauge-interactive" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <span className="lw-pressure-name">{name}</span>
      <div className="lw-pressure-bar">
        <div className="lw-pressure-fill et-pressure-fill" style={{
          '--et-pressure-fill-width': `${String(Math.min(100, value))}%`,
          '--et-pressure-fill-color': fillColor,
        } as React.CSSProperties} />
      </div>
      <span className="lw-pressure-value">
        {value.toFixed(0)}
        {detail && (<span className={`lw-pressure-delta ${detail.delta >= 0 ? "positive" : "negative"}`}>{detail.delta >= 0 ? "↑" : "↓"}</span>)}
      </span>
      {showTooltip && detail && (
        <PressureTooltip detail={detail} discreteModifications={discreteModifications} tickCount={tickCount} />
      )}
    </div>
  );
}

interface EpochTimelineProps {
  epochStats: EpochStatsPayload[];
  currentEpoch: EpochStartPayload | null;
  pressures: Record<string, number> | null;
  pressureDetails: PressureDetailsData | null;
  reachability: ReachabilityData | null;
}

function PressureSection({ pressures, pressureDetails }: Readonly<{
  pressures: Record<string, number>;
  pressureDetails: PressureDetailsData | null;
}>) {
  if (Object.keys(pressures).length === 0) return null;

  const detailsMap = new Map<string, PressureDetail>();
  if (pressureDetails?.pressures) {
    for (const p of pressureDetails.pressures) detailsMap.set(p.id, p);
  }

  return (
    <div className="lw-section-spacer">
      <div className="lw-section-label">
        Current Pressures
        {pressureDetails && (<span className="lw-section-label-hint">(hover for epoch details{pressureDetails.ticksAggregated ? `, ${String(pressureDetails.ticksAggregated)} ticks` : ""})</span>)}
      </div>
      <div className="lw-flex-col lw-gap-sm">
        {Object.entries(pressures).map(([name, value]) => (
          <PressureGauge key={name} name={name} value={value} detail={detailsMap.get(name) ?? null} discreteModifications={pressureDetails?.discreteModifications || []} tickCount={pressureDetails?.ticksAggregated || 0} />
        ))}
      </div>
    </div>
  );
}

function ConnectivitySection({ reachability }: Readonly<{ reachability: ReachabilityData | null }>) {
  const cc = reachability?.connectedComponents;
  const fct = reachability?.fullyConnectedTick ?? null;
  const clustersLabel = typeof cc === "number" ? cc.toLocaleString() : "--";
  let connectedLabel = "--";
  if (reachability) connectedLabel = fct === null ? "never" : fct.toLocaleString();
  const clusterColor = typeof cc === "number" && cc > 1 ? "var(--lw-danger)" : undefined;

  return (
    <div className="lw-section-spacer">
      <div className="lw-section-label">Graph Connectivity</div>
      <div className="lw-flex-col lw-gap-sm">
        <div className="et-metric-row"><span>Disconnected clusters</span><span className="et-cluster-value" style={{ '--et-cluster-value-color': clusterColor } as React.CSSProperties}>{clustersLabel}</span></div>
        <div className="et-metric-row"><span>Fully connected tick</span><span className="et-connected-value">{connectedLabel}</span></div>
      </div>
    </div>
  );
}

export default function EpochTimeline({ epochStats, currentEpoch, pressures, pressureDetails, reachability }: Readonly<EpochTimelineProps>) {
  const recentEpochs = epochStats.slice(-5).reverse();

  return (
    <div className="lw-panel">
      <div className="lw-panel-header">
        <div className="lw-panel-title"><span>⏱</span> Epoch Timeline</div>
        {currentEpoch && (<span className="et-era-label">Era: {currentEpoch.era.name}</span>)}
      </div>
      <div className="lw-panel-content">
        {recentEpochs.length === 0 ? (
          <div className="viewer-empty-state"><span className="lw-empty-icon">⏳</span><span>No epochs completed yet</span></div>
        ) : (
          <>
            <div className="lw-timeline">
              {recentEpochs.map((epoch, i) => (
                <div key={epoch.epoch} className={`lw-timeline-item ${i === 0 ? "active" : ""} et-timeline-opacity`} style={{ '--et-timeline-opacity': i === 0 ? 1 : 0.7 } as React.CSSProperties}>
                  <div className={`lw-timeline-icon ${i === 0 ? "active" : ""}`}>{epoch.epoch}</div>
                  <div className="lw-timeline-content">
                    <div className="lw-timeline-title">{formatEpochEra(epoch.era)}</div>
                    <div className="lw-timeline-subtitle">+{epoch.entitiesCreated} entities • +{epoch.relationshipsCreated} relations</div>
                  </div>
                </div>
              ))}
            </div>
            {pressures && <PressureSection pressures={pressures} pressureDetails={pressureDetails} />}
            <ConnectivitySection reachability={reachability} />
          </>
        )}
      </div>
    </div>
  );
}
