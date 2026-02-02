/**
 * SelectionFiltersEditor - Manage a list of selection filters
 */

import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { FILTER_TYPES } from '../constants';
import { SelectionFilterCard } from './SelectionFilterCard';

/**
 * @param {Object} props
 * @param {Array} props.filters - Array of filter configurations
 * @param {Function} props.onChange - Callback when filters change
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.availableRefs - Available entity references
 */
export function SelectionFiltersEditor({ filters, onChange, schema, availableRefs }) {
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef(null);

  // Calculate dropdown position when opening (like TagSelector)
  useLayoutEffect(() => {
    if (showTypeMenu && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 220),
      });
    }
  }, [showTypeMenu]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!showTypeMenu) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowTypeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTypeMenu]);

  const handleAddFilter = (type) => {
    // Create with empty required fields - validation will flag them
    const newFilter = { type };
    // Tag filters
    if (type === 'has_tag') newFilter.tag = '';
    if (type === 'has_tags') newFilter.tags = [];
    if (type === 'has_any_tag') newFilter.tags = [];
    if (type === 'lacks_tag') newFilter.tag = '';
    if (type === 'lacks_any_tag') newFilter.tags = [];
    // Attribute filters
    if (type === 'has_culture') newFilter.culture = '';
    if (type === 'matches_culture') newFilter.with = '';
    if (type === 'has_status') newFilter.status = '';
    if (type === 'has_prominence') newFilter.minProminence = '';
    // Relationship filters
    if (type === 'has_relationship') newFilter.kind = '';
    if (type === 'lacks_relationship') newFilter.kind = '';
    if (type === 'shares_related') {
      newFilter.relationshipKind = '';
      newFilter.with = '';
    }
    // Other
    if (type === 'exclude') newFilter.entities = [];
    if (type === 'graph_path') newFilter.assert = {
      check: '',
      path: [{ via: '', direction: '', targetKind: '', targetSubtype: '' }]
    };
    onChange([...(filters || []), newFilter]);
    setShowTypeMenu(false);
  };

  const handleUpdateFilter = (index, updated) => {
    const newFilters = [...(filters || [])];
    newFilters[index] = updated;
    onChange(newFilters);
  };

  const handleRemoveFilter = (index) => {
    onChange((filters || []).filter((_, i) => i !== index));
  };

  return (
    <div>
      {(filters || []).length === 0 ? (
        <div className="empty-state-compact">
          No filters defined. Filters narrow down which entities can be selected as targets.
        </div>
      ) : (
        <div className="condition-list">
          {(filters || []).map((filter, index) => (
            <SelectionFilterCard
              key={index}
              filter={filter}
              onChange={(updated) => handleUpdateFilter(index, updated)}
              onRemove={() => handleRemoveFilter(index)}
              schema={schema}
              availableRefs={availableRefs}
            />
          ))}
        </div>
      )}

      <div ref={containerRef} style={{ position: 'relative', marginTop: '12px' }}>
        <button
          onClick={() => setShowTypeMenu(!showTypeMenu)}
          className="btn-add-inline"
        >
          + Add Filter
        </button>

        {showTypeMenu && (
          <div
            className="dropdown-menu"
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              maxHeight: '300px',
              overflowY: 'auto',
              zIndex: 10000,
            }}
          >
            {Object.entries(FILTER_TYPES).map(([type, config]) => (
              <div
                key={type}
                onClick={() => handleAddFilter(type)}
                className="dropdown-menu-item"
              >
                <span className="dropdown-menu-icon" style={{ backgroundColor: `${config.color}20` }}>
                  {config.icon}
                </span>
                <span className="dropdown-menu-label">{config.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SelectionFiltersEditor;
