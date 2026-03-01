/**
 * System action detail panel - shows system activity, especially era transitions.
 */

import React from "react";
import { EVENT_COLORS } from "./traceConstants";
import type { SystemActionRecord } from "./traceTypes";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SystemActionDetailPanelProps {
  systemAction: SystemActionRecord | null;
  isEraTransition: boolean;
  isLocked: boolean;
  onClear: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface EraTransitionSectionProps {
  eraTransition: NonNullable<NonNullable<SystemActionRecord["details"]>["eraTransition"]>;
}

function EraTransitionSection({ eraTransition }: EraTransitionSectionProps) {
  return (
    <div className="lw-trace-view-template-era-transition">
      <div className="lw-trace-view-detail-sub-header">Era Transition</div>
      <div className="lw-trace-view-era-transition">
        <div className="lw-trace-view-era-flow">
          <span className="lw-trace-view-era-from">{eraTransition.fromEra}</span>
          <span className="lw-trace-view-era-arrow">{"\u2192"}</span>
          <span className="lw-trace-view-era-to">{eraTransition.toEra}</span>
        </div>

        <div className="lw-trace-view-entity-placement-grid">
          <div className="lw-trace-view-entity-placement-row">
            <span className="lw-trace-view-entity-placement-label">Duration</span>
            <span className="lw-trace-view-entity-placement-value">
              {eraTransition.tickInEra} ticks
            </span>
          </div>

          <div className="lw-trace-view-entity-placement-row">
            <span className="lw-trace-view-entity-placement-label">From Era ID</span>
            <span className="lw-trace-view-entity-placement-value mono">
              {eraTransition.fromEraId}
            </span>
          </div>

          <div className="lw-trace-view-entity-placement-row">
            <span className="lw-trace-view-entity-placement-label">To Era ID</span>
            <span className="lw-trace-view-entity-placement-value mono">
              {eraTransition.toEraId}
            </span>
          </div>

          {(eraTransition.prominentEntitiesLinked ?? 0) > 0 && (
            <div className="lw-trace-view-entity-placement-row">
              <span className="lw-trace-view-entity-placement-label">Entities Linked</span>
              <span className="lw-trace-view-entity-placement-value">
                {eraTransition.prominentEntitiesLinked} prominent entities
              </span>
            </div>
          )}
        </div>

        {(eraTransition.exitConditionsMet?.length ?? 0) > 0 && (
          <div className="lw-trace-view-entity-exit-conditions">
            <div className="lw-trace-view-entity-section-label">Exit Conditions Met</div>
            <div className="lw-trace-view-entity-tags">
              {eraTransition.exitConditionsMet!.map((cond, i) => (
                <span key={i} className="lw-trace-view-tag">
                  {cond.type}
                  {cond.pressureId && `: ${cond.pressureId} ${cond.operator} ${cond.threshold}`}
                  {cond.entityKind && `: ${cond.entityKind} ${cond.operator} ${cond.threshold}`}
                  {cond.minTicks && `: ${cond.currentAge}/${cond.minTicks} ticks`}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ActivitySummarySectionProps {
  action: SystemActionRecord;
}

function ActivitySummarySection({ action }: ActivitySummarySectionProps) {
  return (
    <div className="lw-trace-view-template-activity-summary">
      <div className="lw-trace-view-detail-sub-header">Activity Summary</div>
      <div className="lw-trace-view-entity-placement-grid">
        <div className="lw-trace-view-entity-placement-row">
          <span className="lw-trace-view-entity-placement-label">Relationships Added</span>
          <span className="lw-trace-view-entity-placement-value">
            {action.relationshipsAdded}
          </span>
        </div>
        <div className="lw-trace-view-entity-placement-row">
          <span className="lw-trace-view-entity-placement-label">Entities Modified</span>
          <span className="lw-trace-view-entity-placement-value">
            {action.entitiesModified}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SystemActionDetailPanel({
  systemAction,
  isEraTransition,
  isLocked,
  onClear,
}: SystemActionDetailPanelProps) {
  if (!systemAction) {
    return (
      <div className="lw-trace-view-detail">
        <div className="lw-trace-view-detail-empty">
          <div className="lw-trace-view-detail-empty-icon">&#9632;</div>
          <div>Hover over a system marker to see details</div>
          <div className="lw-trace-view-detail-hint">Click to lock selection</div>
        </div>
      </div>
    );
  }

  const action = systemAction;
  const eraTransition = action.details?.eraTransition;
  const markerColor = isEraTransition ? "#f59e0b" : EVENT_COLORS.system;

  return (
    <div className="lw-trace-view-detail">
      <div className="lw-trace-view-detail-header">
        <span>
          <span
            className="st-detail-marker"
            style={{ "--st-marker-color": markerColor } as React.CSSProperties}
          >
            {isEraTransition ? "\u2605" : "\u25A0"}
          </span>
          Tick {action.tick} / Epoch {action.epoch}
        </span>
        {isLocked && (
          <button className="lw-trace-view-detail-unlock" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      <div className="lw-trace-view-detail-content">
        <div className="lw-trace-view-template-app">
          <div className="lw-trace-view-template-header">
            <span className="lw-trace-view-template-id">{action.systemName}</span>
            <span className="lw-trace-view-template-target">({action.systemId})</span>
          </div>

          {action.description && (
            <div className="lw-trace-view-template-desc">{action.description}</div>
          )}

          {eraTransition && <EraTransitionSection eraTransition={eraTransition} />}

          <ActivitySummarySection action={action} />

          {Object.keys(action.pressureChanges ?? {}).length > 0 && (
            <div className="lw-trace-view-template-pressures">
              <div className="lw-trace-view-detail-sub-header">Pressure Changes</div>
              {Object.entries(action.pressureChanges!).map(([pressureId, delta]) => (
                <div key={pressureId} className="lw-trace-view-detail-row">
                  <span className="lw-trace-view-detail-label">{pressureId}</span>
                  <span className={delta >= 0 ? "positive" : "negative"}>
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
