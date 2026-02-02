import React from 'react';

/**
 * Multi-select pills component for selecting multiple options
 * Note: Consider replacing with ChipSelect from shared-components in future
 */
export default function MultiSelectPills({ options, selected, onChange, allLabel = 'All' }) {
  const isAllSelected = selected.length === 0 || (selected.length === 1 && selected[0] === '*');

  const handleToggle = (value) => {
    if (value === '*') {
      onChange([]);
    } else {
      const newSelected = selected.filter(s => s !== '*');
      if (newSelected.includes(value)) {
        const filtered = newSelected.filter(s => s !== value);
        onChange(filtered.length === 0 ? [] : filtered);
      } else {
        onChange([...newSelected, value]);
      }
    }
  };

  return (
    <div className="flex flex-wrap gap-xs">
      <button
        type="button"
        onClick={() => handleToggle('*')}
        className={`pill-button ${isAllSelected ? 'selected-gold' : ''}`}
      >
        {allLabel}
      </button>
      {options.map(opt => {
        const isSelected = !isAllSelected && selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => handleToggle(opt)}
            className={`pill-button ${isSelected ? 'selected-green' : ''}`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
