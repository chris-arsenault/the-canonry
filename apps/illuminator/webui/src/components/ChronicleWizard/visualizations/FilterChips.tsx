/**
 * FilterChips - Togglable filter chips for quick filtering
 *
 * Replaces text search with one-click filter toggles.
 * Supports single or multi-select mode.
 */

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
  person: '#6366f1',
  faction: '#8b5cf6',
  location: '#10b981',
  artifact: '#f59e0b',
  creature: '#ec4899',
  event: '#06b6d4',
  concept: '#84cc16',
  organization: '#f97316',
};

export default function FilterChips<T extends string>({
  options,
  selected,
  onSelectionChange,
  label,
  multiSelect = true,
  formatLabel,
  getColor,
}: FilterChipsProps<T>) {
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
    return KIND_COLORS[option.toLowerCase()] || 'var(--accent-color)';
  };

  const getDisplayLabel = (option: T): string => {
    if (formatLabel) return formatLabel(option);
    // Capitalize first letter
    return option.charAt(0).toUpperCase() + option.slice(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {label}
          </span>
          {selected.size > 0 && (
            <button
              onClick={handleClearAll}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-color)',
                fontSize: '10px',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
      }}>
        {options.map(option => {
          const isSelected = selected.has(option);
          const color = getChipColor(option);

          return (
            <button
              key={option}
              onClick={() => handleChipClick(option)}
              style={{
                padding: '4px 10px',
                borderRadius: '12px',
                border: isSelected ? `1px solid ${color}` : '1px solid var(--border-color)',
                background: isSelected ? color : 'transparent',
                color: isSelected ? 'white' : 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: isSelected ? 500 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {/* Color dot when not selected */}
              {!isSelected && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: color,
                  }}
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
