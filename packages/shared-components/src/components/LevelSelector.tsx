/**
 * LevelSelector - Visual level selector with configurable levels
 *
 * Supports:
 * - Click-to-select levels (for both string and numeric values)
 * - Optional numeric input for precise values (numeric mode only)
 * - Partial fill visualization for intermediate values (numeric mode)
 */

import React, { useState } from 'react';
import type { Optional } from '../types/optionality.js';

interface LevelDefinition {
  value: number | string;
  label: string;
  color: string;
}

interface LevelSelectorProps {
  readonly value: number | string;
  readonly onChange: (value: number | string) => void;
  readonly levels: LevelDefinition[];
  readonly showNumeric: Optional<boolean>;
  readonly min: Optional<number>;
  readonly max: Optional<number>;
  readonly step: Optional<number>;
  readonly className: Optional<string>;
}

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
}: LevelSelectorProps) {
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null);
  const isNumeric = typeof levels[0]?.value === 'number';
  const getLevelIndex = (val: number | string) => {
    if (!isNumeric) { const idx = levels.findIndex(l => l.value === val); return idx >= 0 ? idx : 0; }
    for (let i = levels.length - 1; i >= 0; i--) { if (val >= levels[i].value) return i; }
    return 0;
  };
  const levelIndex = getLevelIndex(value);
  const currentLevel = levels[levelIndex];
  const hoverLevel = hoveredLevel !== null ? levels[hoveredLevel] : null;
  const getPartialFill = (idx: number) => {
    if (!isNumeric) return idx <= levelIndex ? 1 : 0;
    if (idx < levelIndex) return 1;
    if (idx > levelIndex) return 0;
    const levelStart = levels[idx].value;
    const levelEnd = idx < levels.length - 1 ? levels[idx + 1].value : max;
    return Math.max(0, Math.min(1, (value - levelStart) / (levelEnd - levelStart)));
  };

  return (
    <div className={`level-selector ${className}`.trim()}>
      <div className="level-selector-dots">
        {levels.map((level, idx) => {
          const fill = getPartialFill(idx);
          const baseColor = (hoveredLevel !== null && idx <= hoveredLevel) ? hoverLevel.color : currentLevel.color;
          return (
            <div key={idx} title={level.label} role="button" tabIndex={0}
              className={`level-selector-dot ${hoveredLevel === idx ? 'level-selector-dot-active' : ''}`.trim()}
              onClick={() => onChange(level.value)} onMouseEnter={() => setHoveredLevel(idx)}
              onMouseLeave={() => setHoveredLevel(null)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}>
              <svg className="level-selector-dot-fill-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <rect x="0" y={100 - (fill * 100)} width="100" height={fill * 100} fill={baseColor} />
              </svg>
            </div>
          );
        })}
      </div>
      {showNumeric && isNumeric && (
        <input type="number" className="level-selector-input" value={value} step={step} min={min} max={max}
          onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v))); }} />
      )}
    </div>
  );
}
