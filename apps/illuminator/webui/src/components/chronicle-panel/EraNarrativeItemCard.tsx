/**
 * EraNarrativeItemCard - Nav list card for era narrative entries.
 */

import React, { useMemo, useCallback } from "react";
import type { EraNarrativeNavItem } from "./chroniclePanelTypes";

interface EraNarrativeItemCardProps {
  item: EraNarrativeNavItem;
  isSelected: boolean;
  onClick: (e: React.MouseEvent | React.KeyboardEvent) => void;
}

interface InlineSymbol {
  symbol: string;
  title: string;
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  complete: "#10b981",
  step_complete: "#f59e0b",
  generating: "#3b82f6",
  pending: "var(--text-muted)",
  failed: "#ef4444",
  cancelled: "var(--text-muted)",
};

function buildInlineSymbols(item: EraNarrativeNavItem): InlineSymbol[] {
  const syms: InlineSymbol[] = [];
  syms.push({ symbol: "\u2756", title: "Era narrative", color: "#d97706" });
  if (item.hasThesis) {
    syms.push({ symbol: "\u2261", title: "Thesis identified", color: "#8b7355" });
  }
  if (item.threadCount > 0) {
    syms.push({ symbol: "\u2630", title: `${item.threadCount} threads`, color: "#6366f1" });
  }
  return syms;
}

export function EraNarrativeItemCard({ item, isSelected, onClick }: EraNarrativeItemCardProps) {
  const inlineSymbols = useMemo(
    () => buildInlineSymbols(item),
    [item.hasThesis, item.threadCount],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onClick(e);
    },
    [onClick],
  );

  return (
    <div
      onClick={onClick}
      className={`chron-era-card ${isSelected ? "chron-era-card-selected" : "chron-era-card-default"}`}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="chron-era-card-title-row">
        <span className="chron-era-card-name">
          {item.name}
          {inlineSymbols.map((sym, i) => (
            <span
              key={i}
              title={sym.title}
              className="chron-era-card-symbol"
              style={{ "--chron-symbol-color": sym.color } as React.CSSProperties}
            >
              {sym.symbol}
            </span>
          ))}
        </span>
        <span
          className="chron-era-card-status"
          style={{
            "--chron-status-color": STATUS_COLORS[item.status] || "var(--text-muted)",
          } as React.CSSProperties}
        >
          {item.status === "complete" ? "Complete" : item.status}
        </span>
      </div>
      <div className="chron-era-card-subtitle">
        <span className="chron-era-card-tone">{item.tone}</span>
        <span className="chron-era-card-counts">
          {item.wordCount > 0 && (
            <span title={`${item.wordCount.toLocaleString()} words`}>
              {"\u270E"} {item.wordCount.toLocaleString()}
            </span>
          )}
          {item.movementCount > 0 && (
            <span title={`${item.movementCount} movements`}>
              {"\u25B8"} {item.movementCount}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

export default EraNarrativeItemCard;
