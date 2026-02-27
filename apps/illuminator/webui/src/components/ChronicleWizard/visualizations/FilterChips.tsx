import React from "react";
/**
 * FilterChips - Togglable filter chips for quick filtering
 *
 * Replaces text search with one-click filter toggles.
 * Supports single or multi-select mode.
 */
import "./FilterChips.css";

interface FilterChipsProps<T extends string> {
  /** Available filter options */
  options: T[];
  /** Currently selected options */
  selected: Set<T>;
  /** Called when selection changes */
  onSelectionChange: (selected: Set<T>) => void;
  /** Label for the filter group */
  label?: string;
  /** Allow multiple selection (default: true) */
  multiSelect?: boolean;
  /** Optional: map option value to display label */
  formatLabel?: (option: T) => string;
  /** Optional: map option to color */
  getColor?: (option: T) => string;
}

// Default colors for entity kinds
const KIND_COLORS: Record<string, string> = {
  person: "#6366f1",
  faction: "#8b5cf6",
  location: "#10b981",
  artifact: "#f59e0b",
  creature: "#ec4899",
  event: "#06b6d4",
  concept: "#84cc16",
  organization: "#f97316",
};

export default function FilterChips<T extends string>({
  options,
  selected,
  onSelectionChange,
  label,
  multiSelect = true,
  formatLabel,
  getColor,
}: Readonly<FilterChipsProps<T>>) {
  const handleChipClick = (option: T) => {
    const newSelected = new Set(selected);

    if (newSelected.has(option)) {
      newSelected.delete(option);
    } else {
      if (!multiSelect) {
        newSelected.clear();
      }
      newSelected.add(option);
    }

    onSelectionChange(newSelected);
  };

  const handleClearAll = () => {
    onSelectionChange(new Set());
  };

  const getChipColor = (option: T): string => {
    if (getColor) return getColor(option);
    return KIND_COLORS[option.toLowerCase()] || "var(--accent-color)";
  };

  const getDisplayLabel = (option: T): string => {
    if (formatLabel) return formatLabel(option);
    // Capitalize first letter
    return option.charAt(0).toUpperCase() + option.slice(1);
  };

  return (
    <div className="fc-wrap">
      {label && (
        <div className="fc-header">
          <span className="fc-label">
            {label}
          </span>
          {selected.size > 0 && (
            <button
              onClick={handleClearAll}
              className="fc-clear-btn"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="fc-chips">
        {options.map((option) => {
          const isSelected = selected.has(option);
          const color = getChipColor(option);

          return (
            <button
              key={option}
              onClick={() => handleChipClick(option)}
              className="fc-chip"
              style={{
                '--fc-chip-border': isSelected ? `1px solid ${color}` : "1px solid var(--border-color)",
                '--fc-chip-bg': isSelected ? color : "transparent",
                '--fc-chip-color': isSelected ? "white" : "var(--text-secondary)",
                '--fc-chip-weight': isSelected ? 500 : 400,
              } as React.CSSProperties}
            >
              {/* Color dot when not selected */}
              {!isSelected && (
                <span
                  className="fc-chip-dot"
                  style={{
                    '--fc-dot-bg': color,
                  } as React.CSSProperties}
                />
              )}
              {getDisplayLabel(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
