/**
 * Action detail panel - shows agent action breakdown.
 */

import React from "react";
import type { ActionApplication, CreatedRelationship } from "./traceTypes";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActionDetailPanelProps {
  actionApplication: ActionApplication | null;
  isLocked: boolean;
  onClear: () => void;
}

// ---------------------------------------------------------------------------
// Lookup tables
// ---------------------------------------------------------------------------

const OUTCOME_COLORS: Record<string, string> = {
  success: "#22c55e",
  failed_roll: "#ef4444",
  failed_no_target: "#f59e0b",
  failed_no_instigator: "#f59e0b",
};

const OUTCOME_LABELS: Record<string, string> = {
  success: "Success",
  failed_roll: "Failed Roll",
  failed_no_target: "No Target",
  failed_no_instigator: "No Instigator",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ParticipantsSectionProps {
  app: ActionApplication;
}

function ParticipantsSection({ app }: ParticipantsSectionProps) {
  return (
    <div className="lw-trace-view-template-participants">
      <div className="lw-trace-view-detail-sub-header">Participants</div>
      <div className="lw-trace-view-entity-placement-grid">
        <div className="lw-trace-view-entity-placement-row">
          <span className="lw-trace-view-entity-placement-label">Actor</span>
          <span className="lw-trace-view-entity-placement-value">
            <span className="lw-trace-view-anchor-entity">{app.actorName}</span>
            <span className="lw-trace-view-anchor-entity-kind">({app.actorKind})</span>
          </span>
        </div>

        <div className="lw-trace-view-entity-placement-row">
          <span className="lw-trace-view-entity-placement-label">Prominence</span>
          <span className="lw-trace-view-entity-placement-value">{app.actorProminence}</span>
        </div>

        {app.instigatorId && (
          <div className="lw-trace-view-entity-placement-row">
            <span className="lw-trace-view-entity-placement-label">Instigator</span>
            <span className="lw-trace-view-entity-placement-value">
              <span className="lw-trace-view-anchor-entity">
                {app.instigatorName ?? app.instigatorId}
              </span>
            </span>
          </div>
        )}

        {app.targetId && (
          <div className="lw-trace-view-entity-placement-row">
            <span className="lw-trace-view-entity-placement-label">Target</span>
            <span className="lw-trace-view-entity-placement-value">
              <span className="lw-trace-view-anchor-entity">{app.targetName}</span>
              {app.targetKind && (
                <span className="lw-trace-view-anchor-entity-kind">({app.targetKind})</span>
              )}
            </span>
          </div>
        )}

        {app.target2Id && (
          <div className="lw-trace-view-entity-placement-row">
            <span className="lw-trace-view-entity-placement-label">Target 2</span>
            <span className="lw-trace-view-entity-placement-value">
              <span className="lw-trace-view-anchor-entity">
                {app.target2Name ?? app.target2Id}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface SelectionContextSectionProps {
  app: ActionApplication;
}

function SelectionContextSection({ app }: SelectionContextSectionProps) {
  const ctx = app.selectionContext;
  const selectionPct = ((ctx.selectedWeight / ctx.totalWeight) * 100).toFixed(0);

  return (
    <div className="lw-trace-view-template-selection-ctx">
      <div className="lw-trace-view-detail-sub-header">Selection Context</div>
      <div className="lw-trace-view-entity-placement-grid">
        <div className="lw-trace-view-entity-placement-row">
          <span className="lw-trace-view-entity-placement-label">Available Actions</span>
          <span className="lw-trace-view-entity-placement-value">
            {ctx.availableActionCount}
          </span>
        </div>

        <div className="lw-trace-view-entity-placement-row">
          <span className="lw-trace-view-entity-placement-label">Selected Weight</span>
          <span className="lw-trace-view-entity-placement-value">
            {ctx.selectedWeight.toFixed(2)} / {ctx.totalWeight.toFixed(2)}
            <span className="st-muted-annotation">({selectionPct}%)</span>
          </span>
        </div>

        <div className="lw-trace-view-entity-placement-row">
          <span className="lw-trace-view-entity-placement-label">Attempt Chance</span>
          <span className="lw-trace-view-entity-placement-value">
            {(ctx.attemptChance * 100).toFixed(0)}%
            {ctx.prominenceBonus > 0 && (
              <span className="positive st-muted-annotation">
                (+{(ctx.prominenceBonus * 100).toFixed(0)}% pressure bonus)
              </span>
            )}
          </span>
        </div>
      </div>

      {(ctx.pressureInfluences?.length ?? 0) > 0 && (
        <div className="lw-trace-view-detail-discrete st-section-spaced">
          <div className="lw-trace-view-detail-sub-header">
            Pressure Influences (on selection weight)
          </div>
          {ctx.pressureInfluences!.map((influence, i) => (
            <div key={i} className="lw-trace-view-detail-row">
              <span className="lw-trace-view-detail-label">
                {influence.pressureId}
                <span className="st-muted-annotation">
                  ({influence.value.toFixed(0)} {"\u00D7"} {influence.multiplier.toFixed(1)})
                </span>
              </span>
              <span className={influence.contribution >= 0 ? "positive" : "negative"}>
                {influence.contribution >= 0 ? "+" : ""}
                {influence.contribution.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface OutcomeSectionProps {
  app: ActionApplication;
}

function RelationshipsList({ relationships }: { relationships: CreatedRelationship[] }) {
  return (
    <div className="lw-trace-view-detail-discrete st-section-spaced">
      <div className="lw-trace-view-detail-sub-header">
        Relationships Created ({relationships.length})
      </div>
      {relationships.slice(0, 5).map((rel, i) => (
        <div key={i} className="lw-trace-view-detail-row">
          <span className="lw-trace-view-rel-kind">{rel.kind}</span>
          <span className="lw-trace-view-rel-ids">
            {rel.srcName} {"\u2192"} {rel.dstName}
            {rel.strength !== undefined && (
              <span className="st-muted-annotation">
                (str: {rel.strength.toFixed(2)})
              </span>
            )}
          </span>
        </div>
      ))}
      {relationships.length > 5 && (
        <div className="lw-trace-view-detail-row lw-trace-view-detail-row-muted">
          +{relationships.length - 5} more
        </div>
      )}
    </div>
  );
}

function OutcomeSection({ app }: OutcomeSectionProps) {
  const { outcome } = app;

  return (
    <div className="lw-trace-view-template-outcome">
      <div className="lw-trace-view-detail-sub-header">Outcome (roll-based)</div>
      <div className="lw-trace-view-entity-placement-grid">
        <div className="lw-trace-view-entity-placement-row">
          <span className="lw-trace-view-entity-placement-label">Success Chance</span>
          <span className="lw-trace-view-entity-placement-value">
            {(outcome.successChance * 100).toFixed(0)}%
            <span className="st-muted-annotation">
              (base {"\u00D7"} {outcome.prominenceMultiplier.toFixed(1)} prominence)
            </span>
          </span>
        </div>
      </div>

      {(outcome.relationshipsCreated?.length ?? 0) > 0 && (
        <RelationshipsList relationships={outcome.relationshipsCreated!} />
      )}

      {(outcome.prominenceChanges?.length ?? 0) > 0 && (
        <div className="lw-trace-view-detail-discrete st-section-spaced">
          <div className="lw-trace-view-detail-sub-header">Prominence Changes</div>
          {outcome.prominenceChanges!.map((change, i) => (
            <div key={i} className="lw-trace-view-detail-row">
              <span className="lw-trace-view-detail-label">{change.entityName}</span>
              <span className={change.direction === "up" ? "positive" : "negative"}>
                {change.direction === "up" ? "\u2191" : "\u2193"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ActionDetailPanel({
  actionApplication,
  isLocked,
  onClear,
}: ActionDetailPanelProps) {
  if (!actionApplication) {
    return (
      <div className="lw-trace-view-detail">
        <div className="lw-trace-view-detail-empty">
          <div className="lw-trace-view-detail-empty-icon">{"\u25CF"}</div>
          <div>Hover over an action marker to see details</div>
          <div className="lw-trace-view-detail-hint">Click to lock selection</div>
        </div>
      </div>
    );
  }

  const app = actionApplication;
  const outcomeColor = OUTCOME_COLORS[app.outcome.status] ?? "#888";

  return (
    <div className="lw-trace-view-detail">
      <div className="lw-trace-view-detail-header">
        <span>
          <span
            className="st-detail-marker"
            style={{ "--st-marker-color": outcomeColor } as React.CSSProperties}
          >
            {"\u25CF"}
          </span>
          Tick {app.tick} / Epoch {app.epoch}
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
            <span className="lw-trace-view-template-id">{app.actionName}</span>
            <span
              className="lw-trace-view-outcome-badge st-outcome-badge"
              style={{ "--st-outcome-bg": outcomeColor } as React.CSSProperties}
            >
              {OUTCOME_LABELS[app.outcome.status] ?? app.outcome.status}
            </span>
          </div>

          {app.outcome.description && (
            <div className="lw-trace-view-template-desc">{app.outcome.description}</div>
          )}

          <ParticipantsSection app={app} />
          <SelectionContextSection app={app} />
          <OutcomeSection app={app} />
        </div>
      </div>
    </div>
  );
}
