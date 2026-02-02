/**
 * LevelSelector - Visual level selector with configurable levels
 *
 * Supports:
 * - Click-to-select levels (for both string and numeric values)
 * - Optional numeric input for precise values (numeric mode only)
 * - Partial fill visualization for intermediate values (numeric mode)
 */

import React, { useState } from 'react';

/**
 * @param {Object} props
 * @param {number|string} props.value - Current value
 * @param {Function} props.onChange - Called when value changes
 * @param {Array<{value: number|string, label: string, color: string}>} props.levels - Level definitions
 * @param {boolean} [props.showNumeric] - Show numeric input (default false, only for numeric values)
 * @param {number} [props.min] - Minimum value for numeric input (default 0)
 * @param {number} [props.max] - Maximum value for numeric input (default 10)
 * @param {number} [props.step] - Step for numeric input (default 0.1)
 * @param {string} [props.className] - Additional class names
 */
export function LevelSelector({
  value,
  onChange,
  levels,
  showNumeric = false,
  min = 0,
  max = 10,
  step = 0.1,
  className = '',
}) {
  const [hoveredLevel, setHoveredLevel] = useState(null);

  // Detect if using numeric or string mode
  const isNumeric = typeof levels[0]?.value === 'number';

  // Get level index based on value
  const getLevelIndex = (val) => {
    if (isNumeric) {
      for (let i = levels.length - 1; i >= 0; i--) {
        if (val >= levels[i].value) return i;
      }
      return 0;
    } else {
      const idx = levels.findIndex(l => l.value === val);
      return idx >= 0 ? idx : 0;
    }
  };

  const levelIndex = getLevelIndex(value);
  const currentLevel = levels[levelIndex];
  const hoverLevel = hoveredLevel !== null ? levels[hoveredLevel] : null;

  // Calculate partial fill for each dot (only meaningful for numeric mode)
  const getPartialFill = (idx) => {
    if (!isNumeric) {
      // String mode: full fill up to and including current level
      return idx <= levelIndex ? 1 : 0;
    }
    if (idx < levelIndex) return 1;
    if (idx > levelIndex) return 0;
    // Current level - calculate partial based on value position
    const levelStart = levels[idx].value;
    const levelEnd = idx < levels.length - 1 ? levels[idx + 1].value : max;
    const progress = (value - levelStart) / (levelEnd - levelStart);
    return Math.max(0, Math.min(1, progress));
  };

  return (
    <div className={`level-selector ${className}`.trim()}>
      <div className="level-selector-dots">
        {levels.map((level, idx) => {
          const isHovered = hoveredLevel !== null && idx <= hoveredLevel;
          const fill = getPartialFill(idx);
          const baseColor = isHovered ? hoverLevel.color : currentLevel.color;

          return (
            <div
              key={idx}
              className="level-selector-dot"
              onClick={() => onChange(level.value)}
              onMouseEnter={() => setHoveredLevel(idx)}
              onMouseLeave={() => setHoveredLevel(null)}
              style={{
                transform: hoveredLevel === idx ? 'scale(1.2)' : 'scale(1)',
              }}
              title={`${level.label}`}
            >
              <div
                className="level-selector-dot-fill"
                style={{
                  height: `${fill * 100}%`,
                  backgroundColor: baseColor,
                }}
              />
            </div>
          );
        })}
      </div>
      {showNumeric && isNumeric && (
        <input
          type="number"
          className="level-selector-input"
          value={value}
          onChange={(e) => {
            const newVal = parseFloat(e.target.value);
            if (!isNaN(newVal)) {
              onChange(Math.max(min, Math.min(max, newVal)));
            }
          }}
          step={step}
          min={min}
          max={max}
        />
      )}
    </div>
  );
}

// Common level presets
export const STRENGTH_LEVELS = [
  { value: 0, label: 'Off', color: '#475569' },
  { value: 1, label: 'Low', color: '#3b82f6' },
  { value: 2, label: 'Medium', color: '#22c55e' },
  { value: 3, label: 'High', color: '#f59e0b' },
  { value: 4, label: 'Max', color: '#ef4444' },
];

export const PROMINENCE_LEVELS = [
  { value: 'forgotten', label: 'Forgotten', color: '#6b7280' },
  { value: 'marginal', label: 'Marginal', color: '#60a5fa' },
  { value: 'recognized', label: 'Recognized', color: '#34d399' },
  { value: 'renowned', label: 'Renowned', color: '#fbbf24' },
  { value: 'mythic', label: 'Mythic', color: '#a855f7' },
];
