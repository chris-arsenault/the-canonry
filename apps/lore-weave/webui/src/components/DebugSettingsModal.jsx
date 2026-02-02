/**
 * DebugSettingsModal - Configure debug output categories
 *
 * This modal allows users to toggle debug output categories on/off
 * without code changes. Debug messages are filtered by category
 * during simulation.
 */

import React, { useRef } from 'react';

// Debug category metadata - matches types.ts DEBUG_CATEGORY_INFO
const DEBUG_CATEGORIES = [
  { id: 'placement', label: 'Placement', description: 'Entity placement and coordinate resolution' },
  { id: 'coordinates', label: 'Coordinates', description: 'Coordinate context, regions, culture mapping' },
  { id: 'templates', label: 'Templates', description: 'Template expansion and variable resolution' },
  { id: 'systems', label: 'Systems', description: 'System execution and effects' },
  { id: 'relationships', label: 'Relationships', description: 'Relationship creation and mutations' },
  { id: 'selection', label: 'Selection', description: 'Target and template selection' },
  { id: 'eras', label: 'Eras', description: 'Era transitions and epoch events' },
  { id: 'entities', label: 'Entities', description: 'Entity creation and state changes' },
  { id: 'pressures', label: 'Pressures', description: 'Pressure changes and thresholds' },
  { id: 'naming', label: 'Naming', description: 'Name generation' },
  { id: 'prominence', label: 'Prominence', description: 'Prominence mutations and state tracking' },
];

export default function DebugSettingsModal({ isOpen, onClose, debugConfig, onDebugConfigChange }) {
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const handleMasterToggle = () => {
    onDebugConfigChange({
      ...debugConfig,
      enabled: !debugConfig.enabled,
    });
  };

  const handleCategoryToggle = (categoryId) => {
    if (!debugConfig.enabled) return;

    const currentCategories = debugConfig.enabledCategories || [];
    const newCategories = currentCategories.includes(categoryId)
      ? currentCategories.filter(c => c !== categoryId)
      : [...currentCategories, categoryId];

    onDebugConfigChange({
      ...debugConfig,
      enabledCategories: newCategories,
    });
  };

  const handleSelectAll = () => {
    onDebugConfigChange({
      ...debugConfig,
      enabled: true,
      enabledCategories: DEBUG_CATEGORIES.map(c => c.id),
    });
  };

  const handleClearAll = () => {
    onDebugConfigChange({
      ...debugConfig,
      enabledCategories: [],
    });
  };

  const isCategoryEnabled = (categoryId) => {
    // If no categories are explicitly enabled, all are shown (when master is on)
    if (debugConfig.enabledCategories.length === 0) return true;
    return debugConfig.enabledCategories.includes(categoryId);
  };

  return (
    <div className="lw-modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="lw-modal">
        <div className="lw-modal-header">
          <h2 className="lw-modal-title">Debug Settings</h2>
          <button className="lw-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="lw-modal-body">
          {/* Master toggle */}
          <div className="lw-master-toggle">
            <span className="lw-master-label">Enable Debug Output</span>
            <div
              className={`lw-toggle ${debugConfig.enabled ? 'active' : ''}`}
              onClick={handleMasterToggle}
            >
              <div className="lw-toggle-knob" />
            </div>
          </div>

          {/* Category list */}
          <div className="lw-category-list">
            {DEBUG_CATEGORIES.map((category) => (
              <div
                key={category.id}
                className={`lw-category-item ${!debugConfig.enabled ? 'disabled' : ''}`}
                onClick={() => handleCategoryToggle(category.id)}
              >
                <div className={`lw-category-checkbox ${debugConfig.enabled && isCategoryEnabled(category.id) ? 'checked' : ''}`}>
                  {debugConfig.enabled && isCategoryEnabled(category.id) && (
                    <span className="checkmark">✓</span>
                  )}
                </div>
                <div className="lw-category-info">
                  <div className="lw-category-label">{category.label}</div>
                  <div className="lw-category-desc">{category.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer with select/clear buttons */}
        <div className="lw-modal-footer">
          <button className="lw-btn lw-btn-secondary" onClick={handleClearAll}>
            Clear All
          </button>
          <button className="lw-btn lw-btn-secondary" onClick={handleSelectAll}>
            Select All
          </button>
        </div>
      </div>
    </div>
  );
}
