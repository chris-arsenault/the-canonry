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
      <div
        style={{
          background: "var(--bg-secondary)",
          borderRadius: "6px",
          padding: "12px",
          fontSize: "10px",
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        <div style={{ marginBottom: "4px" }}>No entity selected</div>
        <div style={{ fontSize: "9px", opacity: 0.7 }}>Click a node to see details</div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        borderRadius: "6px",
        padding: "10px",
        fontSize: "10px",
      }}
    >
      {/* Header - compact */}
      <div style={{ marginBottom: "8px" }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: "11px",
            marginBottom: "2px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {entity.name}
          {isEntryPoint && (
            <span
              style={{
                padding: "1px 4px",
                background: "var(--accent-color)",
                color: "white",
                borderRadius: "3px",
                fontSize: "8px",
              }}
            >
              Entry
            </span>
          )}
          {isAssigned && !isEntryPoint && (
            <span
              style={{
                padding: "1px 4px",
                background: "var(--success)",
                color: "white",
                borderRadius: "3px",
                fontSize: "8px",
              }}
            >
              Assigned
            </span>
          )}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: "9px" }}>
          {entity.kind}
          {entity.subtype && ` · ${entity.subtype}`}
        </div>
      </div>

      {/* Metrics - two rows: stats on top, story effects below */}
      {(metrics || eraName) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {/* Row 1: Basic stats */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
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
  const colors = {
    default: { bg: "var(--bg-tertiary)", text: "var(--text-muted)" },
    success: { bg: "rgba(16, 185, 129, 0.15)", text: "var(--success)" },
    warning: { bg: "rgba(245, 158, 11, 0.15)", text: "var(--warning)" },
    error: { bg: "rgba(239, 68, 68, 0.15)", text: "var(--error)" },
    accent: { bg: "rgba(99, 102, 241, 0.15)", text: "var(--accent-color)" },
  };

  const bg = customColor ? `${customColor}26` : colors[variant].bg;
  const text = customColor ?? colors[variant].text;

  return (
    <span
      style={{
        padding: "2px 6px",
        background: bg,
        color: text,
        borderRadius: "3px",
        fontSize: "9px",
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  );
}
