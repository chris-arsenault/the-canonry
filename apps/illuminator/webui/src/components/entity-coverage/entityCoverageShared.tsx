/**
 * Shared UI helper components for EntityCoveragePanel sections.
 * Small, stateless display components used across multiple sections.
 */

import React, { useCallback } from "react";
import { prominenceLabel } from "./entityCoverageUtils";
import type { FilterOption } from "./entityCoverageTypes";

// ---------------------------------------------------------------------------
// ProminenceDots
// ---------------------------------------------------------------------------

interface ProminenceDotsProps {
  value: string | number | undefined | null;
}

export function ProminenceDots({ value }: ProminenceDotsProps) {
  const n = Math.min(5, Math.max(0, Math.round(Number(value) || 0)));
  const dots: React.ReactElement[] = [];
  for (let i = 0; i < 5; i++) {
    dots.push(
      <span
        key={i}
        className={`ecp-prominence-dot ${i < n ? "ecp-prominence-dot-filled" : "ecp-prominence-dot-empty"}`}
      />,
    );
  }
  return (
    <span
      title={`Prominence: ${prominenceLabel(value)} (${Number(value).toFixed(1)})`}
      className="ecp-prominence-wrap"
    >
      {dots}
    </span>
  );
}

// ---------------------------------------------------------------------------
// RatioIndicator
// ---------------------------------------------------------------------------

interface RatioIndicatorProps {
  ratio: number;
  expected: number;
}

export function RatioIndicator({ ratio, expected }: RatioIndicatorProps) {
  if (expected === 0) {
    return (
      <span className="ecp-ratio-muted" title="No backrefs expected at this prominence">
        &mdash;
      </span>
    );
  }
  let color: string;
  if (ratio < 0.5) color = "#ef4444";
  else if (ratio < 1.0) color = "#f59e0b";
  else color = "#22c55e";

  return (
    <span
      className="ecp-ratio-value"
      title={`Ratio: ${ratio.toFixed(2)} (${expected} expected)`}
      style={{ "--ecp-ratio-color": color } as React.CSSProperties}
    >
      {ratio.toFixed(1)}x
    </span>
  );
}

// ---------------------------------------------------------------------------
// SignificanceStars
// ---------------------------------------------------------------------------

interface SignificanceStarsProps {
  value: number;
}

export function SignificanceStars({ value }: SignificanceStarsProps) {
  const stars = Math.max(1, Math.min(5, Math.round(value * 5)));
  return (
    <span title={`Significance: ${(value * 100).toFixed(0)}%`} className="ecp-sig-stars">
      {"\u2605".repeat(stars)}
      {"\u2606".repeat(5 - stars)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CoverageIndicator
// ---------------------------------------------------------------------------

interface CoverageIndicatorProps {
  covered: boolean;
}

export function CoverageIndicator({ covered }: CoverageIndicatorProps) {
  return covered ? (
    <span className="ecp-coverage-covered" title="Covered in at least one chronicle">
      &#9679;
    </span>
  ) : (
    <span className="ecp-coverage-uncovered" title="Not in any chronicle">
      &#9675;
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatusDot
// ---------------------------------------------------------------------------

interface StatusDotProps {
  active: boolean;
  label: string;
}

export function StatusDot({ active, label }: StatusDotProps) {
  return (
    <span
      title={label}
      className={`ecp-status-dot ${active ? "ecp-status-dot-active" : "ecp-status-dot-inactive"}`}
    />
  );
}

// ---------------------------------------------------------------------------
// SectionToolbar
// ---------------------------------------------------------------------------

interface SectionToolbarProps {
  children: React.ReactNode;
}

export function SectionToolbar({ children }: SectionToolbarProps) {
  return <div className="ecp-section-toolbar">{children}</div>;
}

// ---------------------------------------------------------------------------
// FilterSelect
// ---------------------------------------------------------------------------

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  label: string;
}

export function FilterSelect({ value, onChange, options, label }: FilterSelectProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value),
    [onChange],
  );
  return (
    <select value={value} onChange={handleChange} className="ecp-filter-select" title={label}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  sectionId: string;
  expanded: boolean;
  onToggle: () => void;
  label: string;
  description: string;
  underutilCount: number | null;
}

export function SectionHeader({
  sectionId: _sectionId,
  expanded,
  onToggle,
  label,
  description,
  underutilCount,
}: SectionHeaderProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onToggle();
    },
    [onToggle],
  );

  return (
    <div
      onClick={onToggle}
      className="ecp-section-header viewer-section-header"
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <span className="ecp-section-arrow">{expanded ? "\u25BC" : "\u25B6"}</span>
      <span className="ecp-section-label">{label}</span>
      {underutilCount != null && underutilCount > 0 && (
        <span className="ecp-section-underutil">{underutilCount} underutilized</span>
      )}
      {!expanded && description && (
        <span className="ecp-section-desc">{description}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TableWrap
// ---------------------------------------------------------------------------

interface TableWrapProps {
  children: React.ReactNode;
}

export function TableWrap({ children }: TableWrapProps) {
  return (
    <div className="entity-coverage-table">
      <table>{children}</table>
    </div>
  );
}
