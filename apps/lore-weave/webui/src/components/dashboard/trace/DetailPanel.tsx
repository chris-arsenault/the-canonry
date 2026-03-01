/**
 * Pressure detail panel - shows breakdown attribution for a selected tick.
 */

import React from "react";
import { PRESSURE_COLORS, EVENT_COLORS } from "./traceConstants";
import type { TickBreakdownInfo, DiscreteMod, PressureBreakdown } from "./traceTypes";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  selectedTick: number | null;
  lockedTick: number | null;
  breakdownsByTick: Map<number, Map<string, TickBreakdownInfo>>;
  pressureIds: string[];
  onUnlock: () => void;
}

// ---------------------------------------------------------------------------
// Small sub-components to keep nesting and complexity low
// ---------------------------------------------------------------------------

function discreteSourceSymbol(sourceType: string): string {
  if (sourceType === "template") return "\u25B2";
  if (sourceType === "system") return "\u25C6";
  return "\u25CF";
}

interface DiscreteRowProps {
  mod: DiscreteMod;
  index: number;
}

function DiscreteRow({ mod, index }: DiscreteRowProps) {
  const sourceType = mod.source?.type ?? "unknown";
  const sourceId =
    mod.source?.templateId ??
    mod.source?.systemId ??
    mod.source?.actionId ??
    "unknown";

  return (
    <div key={index} className="lw-trace-view-detail-row">
      <span className="lw-trace-view-detail-label">
        <span
          className="lw-trace-view-discrete-badge"
          style={{ "--st-badge-color": EVENT_COLORS[sourceType] ?? "#888" } as React.CSSProperties}
        >
          {discreteSourceSymbol(sourceType)}
        </span>
        {sourceId}
      </span>
      <span className={mod.delta >= 0 ? "positive" : "negative"}>
        {mod.delta >= 0 ? "+" : ""}
        {mod.delta.toFixed(3)}
      </span>
    </div>
  );
}

interface FeedbackSectionProps {
  breakdown: PressureBreakdown;
}

function FeedbackSection({ breakdown }: FeedbackSectionProps) {
  return (
    <div className="lw-trace-view-detail-breakdown">
      <div className="lw-trace-view-detail-sub-header">Feedback</div>

      {breakdown.positiveFeedback
        ?.filter((fb) => fb.contribution !== 0)
        .map((fb, k) => (
          <div key={`pos-${k}`} className="lw-trace-view-detail-row">
            <span className="lw-trace-view-detail-label">
              <span className="lw-trace-view-feedback-badge positive">+</span>
              {fb.label}
            </span>
            <span className="positive">+{fb.contribution.toFixed(3)}</span>
          </div>
        ))}

      {breakdown.negativeFeedback
        ?.filter((fb) => fb.contribution !== 0)
        .map((fb, k) => (
          <div key={`neg-${k}`} className="lw-trace-view-detail-row">
            <span className="lw-trace-view-detail-label">
              <span className="lw-trace-view-feedback-badge negative">{"\u2212"}</span>
              {fb.label}
            </span>
            <span className="negative">{fb.contribution.toFixed(3)}</span>
          </div>
        ))}

      {breakdown.homeostasis !== 0 && (
        <div className="lw-trace-view-detail-row">
          <span className="lw-trace-view-detail-label">Homeostasis</span>
          <span className={breakdown.homeostaticDelta >= 0 ? "positive" : "negative"}>
            {breakdown.homeostaticDelta >= 0 ? "+" : ""}
            {breakdown.homeostaticDelta.toFixed(3)}
          </span>
        </div>
      )}

      {breakdown.eraModifier != null && breakdown.eraModifier !== 1 && (
        <div className="lw-trace-view-detail-row lw-trace-view-detail-row-muted">
          <span className="lw-trace-view-detail-label">Era modifier</span>
          <span>{"\u00D7"}{breakdown.eraModifier.toFixed(2)}</span>
        </div>
      )}

      {breakdown.growthScaling != null && breakdown.growthScaling !== 1 && (
        <div className="lw-trace-view-detail-row lw-trace-view-detail-row-muted">
          <span className="lw-trace-view-detail-label">Growth scaling</span>
          <span>{"\u00D7"}{breakdown.growthScaling.toFixed(2)}</span>
        </div>
      )}

      <div className="lw-trace-view-detail-row lw-trace-view-detail-subtotal">
        <span className="lw-trace-view-detail-label">Net {"\u0394"} (smoothed)</span>
        <span className={breakdown.smoothedDelta >= 0 ? "positive" : "negative"}>
          {breakdown.smoothedDelta >= 0 ? "+" : ""}
          {breakdown.smoothedDelta.toFixed(3)}
        </span>
      </div>
    </div>
  );
}

interface PressureCardProps {
  id: string;
  colorIndex: number;
  info: TickBreakdownInfo;
}

function PressureCard({ id, colorIndex, info }: PressureCardProps) {
  const { name, value, previousValue, breakdown, discreteModifications } = info;
  const delta = value - previousValue;
  const hasDiscrete = discreteModifications.length > 0;

  return (
    <div
      key={id}
      className="lw-trace-view-detail-pressure"
      style={{ "--st-pressure-border": PRESSURE_COLORS[colorIndex % PRESSURE_COLORS.length] } as React.CSSProperties}
    >
      <div className="lw-trace-view-detail-pressure-header">
        <span className="lw-trace-view-detail-pressure-name">{name}</span>
        <span className="lw-trace-view-detail-pressure-value">
          {value.toFixed(1)}
          <span className={`lw-trace-view-detail-delta ${delta >= 0 ? "positive" : "negative"}`}>
            ({delta >= 0 ? "+" : ""}
            {delta.toFixed(2)})
          </span>
        </span>
      </div>

      {hasDiscrete && (
        <div className="lw-trace-view-detail-discrete">
          <div className="lw-trace-view-detail-sub-header">Discrete Changes</div>
          {discreteModifications.map((mod, j) => (
            <DiscreteRow key={j} mod={mod} index={j} />
          ))}
        </div>
      )}

      {breakdown && <FeedbackSection breakdown={breakdown} />}

      <div className="lw-trace-view-detail-row lw-trace-view-detail-total">
        <span className="lw-trace-view-detail-label">Total {"\u0394"}</span>
        <span className={delta >= 0 ? "positive" : "negative"}>
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(3)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DetailPanel({
  selectedTick,
  lockedTick,
  breakdownsByTick,
  pressureIds,
  onUnlock,
}: DetailPanelProps) {
  const displayTick = lockedTick ?? selectedTick;
  const isLocked = lockedTick !== null;

  if (displayTick === null) {
    return (
      <div className="lw-trace-view-detail">
        <div className="lw-trace-view-detail-empty">
          <div className="lw-trace-view-detail-empty-icon">&#128200;</div>
          <div>Hover over the chart to see pressure attribution details</div>
          <div className="lw-trace-view-detail-hint">Click to lock selection</div>
        </div>
      </div>
    );
  }

  const tickBreakdowns = breakdownsByTick?.get(displayTick);
  if (!tickBreakdowns) {
    return (
      <div className="lw-trace-view-detail">
        <div className="lw-trace-view-detail-header">
          <span>Tick {displayTick}</span>
          {isLocked && (
            <button className="lw-trace-view-detail-unlock" onClick={onUnlock}>
              Unlock
            </button>
          )}
        </div>
        <div className="lw-trace-view-detail-empty">No breakdown data available</div>
      </div>
    );
  }

  return (
    <div className="lw-trace-view-detail">
      <div className="lw-trace-view-detail-header">
        <span>Tick {displayTick}</span>
        {isLocked ? (
          <button className="lw-trace-view-detail-unlock" onClick={onUnlock}>
            Unlock
          </button>
        ) : (
          <span className="lw-trace-view-detail-hint-inline">Click to lock</span>
        )}
      </div>

      <div className="lw-trace-view-detail-content">
        {pressureIds.map((id, i) => {
          const info = tickBreakdowns.get(id);
          if (!info) return null;
          return <PressureCard key={id} id={id} colorIndex={i} info={info} />;
        })}
      </div>
    </div>
  );
}
