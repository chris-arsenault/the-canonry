/**
 * ChronicleItemCard - Nav list card for a single chronicle entry.
 *
 * Uses inline symbols + compact subtitle pattern per UI style guide.
 */

import React, { useMemo, useCallback } from "react";
import type { ChronicleNavItem } from "./chroniclePanelTypes";

interface ChronicleItemCardProps {
  item: ChronicleNavItem;
  isSelected: boolean;
  onClick: (e: React.MouseEvent | React.KeyboardEvent) => void;
}

interface StatusLabel {
  label: string;
  color: string;
}

interface InlineSymbol {
  symbol: string;
  title: string;
  color: string;
}

const TONE_SYMBOLS: Record<string, string> = {
  witty: "\u2736",
  weary: "\u25CB",
  forensic: "\u25C8",
  elegiac: "\u25C7",
  cantankerous: "\u266F",
};

const TONE_LABELS: Record<string, string> = {
  witty: "Witty",
  weary: "Weary",
  forensic: "Forensic",
  elegiac: "Elegiac",
  cantankerous: "Cantankerous",
};

const FAILURE_STEP_LABELS: Record<string, string> = {
  validate: "Validate",
  edit: "Edit",
  generate_v2: "Generation",
};

function getStatusLabel(item: ChronicleNavItem): StatusLabel {
  switch (item.status) {
    case "not_started":
      return { label: "Not Started", color: "var(--text-muted)" };
    case "generating":
      return { label: "Generating...", color: "#3b82f6" };
    case "assembly_ready":
      return { label: "Assembly Ready", color: "#f59e0b" };
    case "editing":
      return { label: "Editing...", color: "#3b82f6" };
    case "validating":
      return { label: "Validating...", color: "#3b82f6" };
    case "validation_ready":
      return { label: "Review", color: "#f59e0b" };
    case "failed": {
      const stepLabel = FAILURE_STEP_LABELS[item.failureStep || ""] || "Generation";
      return { label: `${stepLabel} Failed`, color: "#ef4444" };
    }
    case "complete":
      return { label: "Complete", color: "#10b981" };
    default:
      return { label: "Unknown", color: "var(--text-muted)" };
  }
}

function buildInlineSymbols(item: ChronicleNavItem): InlineSymbol[] {
  const syms: InlineSymbol[] = [];

  // Focus type
  if (item.focusType === "ensemble") {
    syms.push({ symbol: "\u25C7\u25C7", title: "Ensemble", color: "#a855f7" });
  } else if (item.primaryCount > 0) {
    syms.push({ symbol: "\u25C6", title: "Single focus", color: "#3b82f6" });
  } else {
    syms.push({ symbol: "\u25CB", title: "No primary entity", color: "var(--text-muted)" });
  }

  if (item.perspectiveSynthesis) {
    syms.push({ symbol: "\u2726", title: "Perspective synthesis", color: "#06b6d4" });
  }
  if (item.combineInstructions) {
    syms.push({ symbol: "\u2727", title: "Versions combined", color: "#f59e0b" });
  }
  if (item.coverImageComplete) {
    syms.push({ symbol: "\u25A3", title: "Cover image generated", color: "#10b981" });
  }
  if (item.backportDone > 0) {
    const allDone = item.backportDone === item.backportTotal;
    syms.push({
      symbol: "\u21C4",
      title: `Backport: ${item.backportDone}/${item.backportTotal} entities`,
      color: allDone ? "#10b981" : "#f59e0b",
    });
  }
  if (item.historianNoteCount > 0) {
    syms.push({ symbol: "\u2020", title: "Historian notes", color: "#8b7355" });
  }
  if (item.lens) {
    syms.push({ symbol: "\u25C8", title: `Lens: ${item.lens.entityName}`, color: "#8b5cf6" });
  }
  if (item.hasTemporalNarrative) {
    syms.push({
      symbol: "\u29D6",
      title: item.hasTemporalCheck
        ? "Temporal alignment checked"
        : "Temporal narrative (no alignment check)",
      color: item.hasTemporalCheck ? "#f59e0b" : "var(--text-muted)",
    });
  }
  if (item.hasHistorianPrep) {
    syms.push({ symbol: "\u270E", title: "Historian prep brief", color: "#8b7355" });
  }
  if (item.assignedTone) {
    syms.push({
      symbol: TONE_SYMBOLS[item.assignedTone] || "?",
      title: `Tone: ${TONE_LABELS[item.assignedTone] || item.assignedTone}`,
      color: "#b8860b",
    });
  }

  return syms;
}

function buildImageCountTitle(hasCover: boolean, sceneCount: number): string {
  const coverPrefix = hasCover ? "Cover + " : "";
  const plural = sceneCount !== 1 ? "s" : "";
  return `${coverPrefix}${sceneCount} scene image${plural}`;
}

export function ChronicleItemCard({ item, isSelected, onClick }: ChronicleItemCardProps) {
  const inlineSymbols = useMemo(
    () => buildInlineSymbols(item),
    [
      item.focusType,
      item.primaryCount,
      item.perspectiveSynthesis,
      item.combineInstructions,
      item.coverImageComplete,
      item.backportDone,
      item.backportTotal,
      item.historianNoteCount,
      item.lens,
      item.hasTemporalNarrative,
      item.hasTemporalCheck,
      item.hasHistorianPrep,
      item.assignedTone,
    ],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onClick(e);
    },
    [onClick],
  );

  const castCount = (item.primaryCount || 0) + (item.supportingCount || 0);
  const sceneCount = item.imageRefCompleteCount || 0;
  const hasCover = item.coverImageComplete;
  const imageCount = sceneCount + (hasCover ? 1 : 0);
  const styleName = item.narrativeStyleName || null;
  const status = getStatusLabel(item);

  const eraRelativeSuffix =
    item.eraYear != null && item.focalEraStartTick != null
      ? ` (era-relative: Y${item.eraYear - item.focalEraStartTick + 1})`
      : "";
  const eraYearTitle = item.eraYear != null ? `Year ${item.eraYear}${eraRelativeSuffix}` : "";

  return (
    <div
      onClick={onClick}
      className={`chron-card ${isSelected ? "chron-card-selected" : "chron-card-default"}`}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Title row with inline symbols */}
      <div className="chron-card-title-row">
        <span className="chron-card-name">
          {item.name}
          {inlineSymbols.map((sym, i) => (
            <span
              key={i}
              title={sym.title}
              className="chron-card-symbol"
              style={{ "--chron-symbol-color": sym.color } as React.CSSProperties}
            >
              {sym.symbol}
            </span>
          ))}
        </span>
        <span
          className="chron-card-status"
          style={{ "--chron-status-color": status.color } as React.CSSProperties}
        >
          {status.label}
        </span>
      </div>

      {/* Subtitle: era year + narrative style + numeric counts */}
      <div className="chron-card-subtitle">
        <span className="chron-card-subtitle-left">
          {item.eraYear != null && (
            <span className="chron-card-era-year" title={eraYearTitle}>
              {"\u231B"} Y
              {item.focalEraStartTick != null
                ? item.eraYear - item.focalEraStartTick + 1
                : item.eraYear}
            </span>
          )}
          {styleName && <span className="chron-card-style-name">{styleName}</span>}
        </span>
        {(castCount > 0 || imageCount > 0) && (
          <span className="chron-card-counts">
            {castCount > 0 && (
              <span
                title={`${item.primaryCount || 0} primary, ${item.supportingCount || 0} supporting`}
              >
                <span className="chron-card-count-icon">{"\u2630"}</span> {castCount}
              </span>
            )}
            {imageCount > 0 && (
              <span title={buildImageCountTitle(hasCover, sceneCount)}>
                <span className="chron-card-count-icon">{"\u25A3"}</span> {imageCount}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

export default ChronicleItemCard;
