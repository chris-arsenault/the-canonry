/**
 * EnsembleHealthBar - Visual indicator of cast diversity and health
 *
 * Shows category coverage as a segmented bar with warnings about gaps.
 * Replaces the +cat/+rel badges with a single unified visualization.
 */

import React, { useMemo } from "react";
import type { EntityContext } from "../../../lib/chronicleTypes";
import type { ChronicleRoleAssignment } from "../../../lib/chronicleTypes";
import "./EnsembleHealthBar.css";

interface EnsembleHealthBarProps {
  assignments: ChronicleRoleAssignment[];
  candidates: EntityContext[];
  /** Map from entity kind to category name (for grouping) */
  kindToCategory?: Map<string, string>;
}

// Color mapping for categories
const CATEGORY_COLORS: Record<string, string> = {
  character: "#6366f1",
  person: "#6366f1",
  faction: "#8b5cf6",
  organization: "#8b5cf6",
  location: "#10b981",
  place: "#10b981",
  artifact: "#f59e0b",
  item: "#f59e0b",
  creature: "#ec4899",
  event: "#06b6d4",
  concept: "#84cc16",
};

export default function EnsembleHealthBar({
  assignments,
  candidates,
  kindToCategory,
}: Readonly<EnsembleHealthBarProps>) {
  // Compute category stats
  const stats = useMemo(() => {
    // Get all unique categories from candidates
    const allCategories = new Set<string>();
    const kindMap = kindToCategory || new Map<string, string>();

    for (const candidate of candidates) {
      const category = kindMap.get(candidate.kind) || candidate.kind;
      allCategories.add(category);
    }

    // Count assigned categories
    const assignedCategories = new Map<string, number>();
    for (const assignment of assignments) {
      const category = kindMap.get(assignment.entityKind) || assignment.entityKind;
      assignedCategories.set(category, (assignedCategories.get(category) || 0) + 1);
    }

    // Find missing categories
    const missingCategories: string[] = [];
    for (const category of allCategories) {
      if (!assignedCategories.has(category)) {
        missingCategories.push(category);
      }
    }

    // Calculate coverage percentage
    const coveredCount = assignedCategories.size;
    const totalCount = allCategories.size;
    const coveragePercent = totalCount > 0 ? (coveredCount / totalCount) * 100 : 0;

    return {
      categories: [...allCategories],
      assignedCategories,
      missingCategories,
      coveragePercent,
      coveredCount,
      totalCount,
    };
  }, [assignments, candidates, kindToCategory]);

  const getColor = (category: string): string => {
    return CATEGORY_COLORS[category.toLowerCase()] || "var(--text-muted)";
  };

  if (stats.totalCount === 0) {
    return null;
  }

  return (
    <div className="ehb-wrap">
      {/* Header */}
      <div className="ehb-header">
        <span className="ehb-title">
          Ensemble Diversity
        </span>
        <span
          className="ehb-count"
          style={{
            '--ehb-count-color': stats.coveragePercent === 100 ? "var(--success)" : "var(--text-muted)",
          } as React.CSSProperties}
        >
          {stats.coveredCount}/{stats.totalCount} categories
        </span>
      </div>

      {/* Segmented bar */}
      <div className="ehb-bar">
        {stats.categories.map((category, i) => {
          const count = stats.assignedCategories.get(category) || 0;
          const isCovered = count > 0;
          const width = `${100 / stats.totalCount}%`;
          const color = getColor(category);

          return (
            <div
              key={category}
              title={`${category}: ${count} assigned`}
              className="ehb-bar-segment"
              style={{
                '--ehb-seg-width': width,
                '--ehb-seg-bg': isCovered ? color : "transparent",
                '--ehb-seg-opacity': isCovered ? 1 : 0.3,
                '--ehb-seg-border': i < stats.categories.length - 1 ? "1px solid var(--bg-tertiary)" : "none",
              } as React.CSSProperties}
            />
          );
        })}
      </div>

      {/* Category legend */}
      <div
        className="ehb-legend"
        style={{
          '--ehb-legend-mb': stats.missingCategories.length > 0 ? "8px" : "0",
        } as React.CSSProperties}
      >
        {stats.categories.map((category) => {
          const count = stats.assignedCategories.get(category) || 0;
          const isCovered = count > 0;
          const color = getColor(category);

          return (
            <div
              key={category}
              className="ehb-legend-item"
              style={{
                '--ehb-item-color': isCovered ? "var(--text-primary)" : "var(--text-muted)",
                '--ehb-item-opacity': isCovered ? 1 : 0.6,
              } as React.CSSProperties}
            >
              <span
                className="ehb-legend-dot"
                style={{
                  '--ehb-dot-bg': isCovered ? color : "var(--bg-secondary)",
                  '--ehb-dot-border': isCovered ? "none" : `1px solid ${color}`,
                } as React.CSSProperties}
              />
              <span className="ehb-legend-label">
                {category}
                {count > 1 && ` (${count})`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Missing categories warning */}
      {stats.missingCategories.length > 0 && (
        <div className="ehb-warning">
          <span className="ehb-warning-icon">💡</span>
          <span>
            Consider adding:{" "}
            {stats.missingCategories.map((cat, i) => (
              <span key={cat}>
                <span className="ehb-missing-cat">{cat}</span>
                {i < stats.missingCategories.length - 1 && ", "}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* All covered celebration */}
      {stats.missingCategories.length === 0 && stats.totalCount > 1 && (
        <div className="ehb-success">
          <span>✓</span>
          <span>All categories represented - diverse ensemble!</span>
        </div>
      )}
    </div>
  );
}
