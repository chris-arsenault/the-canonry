/**
 * EntityDetailCard - Clean metric display for selected entity
 *
 * Replaces cryptic badges with a readable card layout showing:
 * - Distance (with visual indicator)
 * - Usage count
 * - Link strength
 * - Era alignment
 * - Category and relationship type additions
 */

import type { EntityContext } from "../../../lib/chronicleTypes";
import type { EntitySelectionMetrics } from "../../../lib/chronicle/selectionWizard";
import React from "react";
import "./EntityDetailCard.css";

interface EntityDetailCardProps {
  entity: EntityContext | null;
  metrics?: EntitySelectionMetrics;
  eraName?: string;
  eraColor?: string;
  isEntryPoint?: boolean;
  isAssigned?: boolean;
}

export default function EntityDetailCard({
  entity,
  metrics,
  eraName,
  eraColor,
  isEntryPoint = false,
  isAssigned = false,
}: Readonly<EntityDetailCardProps>) {
  // Empty state
  if (!entity) {
    return (
      <div className="edc-empty">
        <div className="edc-empty-sub">No entity selected</div>
        <div className="edc-empty-hint">Click a node to see details</div>
      </div>
    );
  }

  return (
    <div className="edc-card">
      {/* Header - compact */}
      <div className="edc-header">
        <div className="edc-name-row">
          {entity.name}
          {isEntryPoint && (
            <span className="edc-entry-badge">
              Entry
            </span>
          )}
          {isAssigned && !isEntryPoint && (
            <span className="edc-assigned-badge">
              Assigned
            </span>
          )}
        </div>
        <div className="edc-kind-line">
          {entity.kind}
          {entity.subtype && ` · ${entity.subtype}`}
        </div>
      </div>

      {/* Metrics - two rows: stats on top, story effects below */}
      {(metrics || eraName) && (
        <div className="edc-metrics">
          {/* Row 1: Basic stats */}
          <div className="edc-metric-row">
            {metrics && (
              <>
                <MetricChip
                  label={(() => {
                    if (metrics.distance === 0) return "Entry";
                    if (metrics.distance === 1) return "Direct";
                    if (metrics.distance >= 99) return "Distant";
                    return `${metrics.distance}-hop`;
                  })()}
                />
                <MetricChip
                  label={`${metrics.usageCount}x used`}
                  variant={(() => {
                    if (metrics.usageCount >= 5) return "error" as const;
                    if (metrics.usageCount >= 2) return "warning" as const;
                    return "default" as const;
                  })()}
                />
                <MetricChip label={`${(metrics.avgStrength * 100).toFixed(0)}% link`} />
              </>
            )}
            {eraName && <MetricChip label={eraName} customColor={eraColor} />}
          </div>
          {/* Row 2: Story effects (always separate line) */}
          {(metrics?.addsNewCategory || (metrics && metrics.newRelTypes > 0)) && (
            <div className="edc-metric-row">
              {metrics?.addsNewCategory && <MetricChip label="+category" variant="accent" />}
              {metrics && metrics.newRelTypes > 0 && (
                <MetricChip label={`+${metrics.newRelTypes} rel`} variant="accent" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MetricChipProps {
  label: string;
  variant?: "default" | "success" | "warning" | "error" | "accent";
  customColor?: string;
}

function MetricChip({ label, variant = "default", customColor }: Readonly<MetricChipProps>) {
  if (customColor) {
    return (
      <span
        className="edc-chip"
        style={{
          '--edc-chip-bg': `${customColor}26`,
          '--edc-chip-color': customColor,
        } as React.CSSProperties}
      >
        {label}
      </span>
    );
  }

  const variantClass = `edc-chip-${variant}`;

  return (
    <span className={`edc-chip ${variantClass}`}>
      {label}
    </span>
  );
}
