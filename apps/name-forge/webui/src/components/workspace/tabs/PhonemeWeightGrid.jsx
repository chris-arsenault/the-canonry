import React, { useState } from "react";
import PropTypes from "prop-types";

/**
 * Visual grid editor for phoneme weights
 * Shows each phoneme with its corresponding weight and a visual bar
 */
function PhonemeWeightGrid({ label, items, weights, onChange, minWeight = 0.1, maxWeight = 3.0 }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState("");

  // Ensure weights array matches items length
  const normalizedWeights = items.map((_, i) => weights?.[i] ?? 1.0);

  // Calculate max for visual scaling
  const maxVal = Math.max(...normalizedWeights, 1);

  const handleCellClick = (index) => {
    setEditingIndex(index);
    setEditValue(normalizedWeights[index].toString());
  };

  const handleBlur = () => {
    if (editingIndex !== null) {
      const newValue = parseFloat(editValue);
      if (!isNaN(newValue) && newValue >= minWeight && newValue <= maxWeight) {
        const newWeights = [...normalizedWeights];
        newWeights[editingIndex] = Math.round(newValue * 100) / 100;
        onChange(newWeights);
      }
      setEditingIndex(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setEditingIndex(null);
    }
  };

  const handleReset = () => {
    onChange(items.map(() => 1.0));
  };

  if (items.length === 0) {
    return (
      <div className="weight-grid-section">
        <div className="weight-grid-header">
          <span className="weight-grid-label">{label}</span>
        </div>
        <div className="weight-grid-empty">
          No items defined. Add {label.toLowerCase().replace(" weights", "s")} in Phonology section.
        </div>
      </div>
    );
  }

  return (
    <div className="weight-grid-section">
      <div className="weight-grid-header">
        <span className="weight-grid-label">{label}</span>
        <button
          type="button"
          className="weight-grid-reset"
          onClick={handleReset}
          title="Reset all to 1.0"
        >
          Reset
        </button>
      </div>
      <div className="weight-grid">
        {items.map((item, index) => {
          const weight = normalizedWeights[index];
          const barHeight = (weight / maxVal) * 100;
          const isEditing = editingIndex === index;

          // Color based on weight: low=cool, normal=neutral, high=warm
          let hue;
          if (weight < 1) hue = 200;
          else if (weight > 1) hue = 30;
          else hue = 150;
          const saturation = Math.abs(weight - 1) * 50 + 20;

          return (
            <div
              key={index}
              className={`weight-cell ${isEditing ? "editing" : ""}`}
              onClick={() => !isEditing && handleCellClick(index)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
            >
              <div className="weight-cell-item" title={item}>
                {item}
              </div>
              {isEditing ? (
                <input
                  type="number"
                  className="weight-cell-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  step="0.1"
                  min={minWeight}
                  max={maxWeight}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
              ) : (
                <div className="weight-cell-value">{weight.toFixed(1)}</div>
              )}
              <div className="weight-cell-bar-container">
                <div
                  className="weight-cell-bar"
                  style={{
                    height: `${barHeight}%`,
                    backgroundColor: `hsl(${hue}, ${saturation}%, 50%)`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

PhonemeWeightGrid.propTypes = {
  label: PropTypes.string,
  items: PropTypes.array,
  weights: PropTypes.array,
  onChange: PropTypes.func,
  minWeight: PropTypes.number,
  maxWeight: PropTypes.number,
};

export default PhonemeWeightGrid;
