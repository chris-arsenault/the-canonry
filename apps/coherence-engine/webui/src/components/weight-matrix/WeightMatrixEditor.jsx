/**
 * WeightMatrixEditor - Spreadsheet-style grid for managing generator/system weights across eras
 *
 * Features:
 * - Toggle between Generators and Systems view
 * - Heatmap coloring (darker = higher weight)
 * - Inline cell editing
 * - Bulk actions: apply to all eras, copy/paste rows
 * - Filter by name/tag
 * - Visual indicators for unassigned items
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { NumberInput } from '../shared';
import './WeightMatrixEditor.css';

// Weight levels for heatmap coloring
const getHeatmapColor = (value, maxValue = 10) => {
  if (value === 0 || value === undefined || value === null) {
    return 'transparent';
  }
  const intensity = Math.min(value / maxValue, 1);
  // Amber gradient: from subtle to bright
  const alpha = 0.15 + intensity * 0.6;
  return `rgba(245, 158, 11, ${alpha})`;
};

// Get text color based on cell value
const getTextColor = (value) => {
  if (value === 0 || value === undefined || value === null) {
    return '#64748b'; // Muted gray
  }
  return '#fbbf24'; // Amber
};

export default function WeightMatrixEditor({
  generators = [],
  systems = [],
  eras = [],
  onErasChange,
}) {
  const [viewMode, setViewMode] = useState('generators'); // 'generators' | 'systems'
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState(null); // { rowId, eraId }
  const [editValue, setEditValue] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [copiedRow, setCopiedRow] = useState(null); // { id, weights: { eraId: value } }
  const inputRef = useRef(null);

  // Get current items based on view mode
  const items = useMemo(() => {
    const source = viewMode === 'generators' ? generators : systems;
    return source.map((item) => ({
      id: viewMode === 'generators' ? item.id : item.config.id,
      name: viewMode === 'generators' ? (item.name || item.id) : (item.config.name || item.config.id),
      type: viewMode === 'generators' ? 'generator' : item.systemType,
    }));
  }, [viewMode, generators, systems]);

  // Detect orphaned references - IDs in eras that don't exist in generators/systems
  const orphanedReferences = useMemo(() => {
    const generatorIds = new Set(generators.map(g => g.id));
    const systemIds = new Set(systems.map(s => s.config.id));

    const orphanedGenerators = [];
    const orphanedSystems = [];

    eras.forEach(era => {
      // Check template weights
      Object.keys(era.templateWeights || {}).forEach(id => {
        if (!generatorIds.has(id)) {
          orphanedGenerators.push({ id, eraId: era.id, eraName: era.name });
        }
      });

      // Check system modifiers
      Object.keys(era.systemModifiers || {}).forEach(id => {
        if (!systemIds.has(id)) {
          orphanedSystems.push({ id, eraId: era.id, eraName: era.name });
        }
      });
    });

    return { generators: orphanedGenerators, systems: orphanedSystems };
  }, [eras, generators, systems]);

  // Count total orphans
  const totalOrphans = orphanedReferences.generators.length + orphanedReferences.systems.length;

  // Clean up all orphaned references
  const cleanupOrphanedReferences = useCallback(() => {
    const generatorIds = new Set(generators.map(g => g.id));
    const systemIds = new Set(systems.map(s => s.config.id));

    const newEras = eras.map(era => {
      const newTemplateWeights = { ...era.templateWeights };
      const newSystemModifiers = { ...era.systemModifiers };

      // Remove orphaned generator references
      Object.keys(newTemplateWeights).forEach(id => {
        if (!generatorIds.has(id)) {
          delete newTemplateWeights[id];
        }
      });

      // Remove orphaned system references
      Object.keys(newSystemModifiers).forEach(id => {
        if (!systemIds.has(id)) {
          delete newSystemModifiers[id];
        }
      });

      return { ...era, templateWeights: newTemplateWeights, systemModifiers: newSystemModifiers };
    });

    onErasChange(newEras);
  }, [eras, generators, systems, onErasChange]);

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.id.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  // Get weight for an item in an era
  const getWeight = useCallback((itemId, eraId) => {
    const era = eras.find((e) => e.id === eraId);
    if (!era) return null;
    const weights = viewMode === 'generators' ? era.templateWeights : era.systemModifiers;
    return weights?.[itemId] ?? null;
  }, [eras, viewMode]);

  // Set weight for an item in an era
  const setWeight = useCallback((itemId, eraId, value) => {
    const newEras = eras.map((era) => {
      if (era.id !== eraId) return era;

      const weightsKey = viewMode === 'generators' ? 'templateWeights' : 'systemModifiers';
      const weights = { ...era[weightsKey] };

      if (value === null || value === '' || value === undefined) {
        delete weights[itemId];
      } else {
        weights[itemId] = parseFloat(value) || 0;
      }

      return { ...era, [weightsKey]: weights };
    });

    onErasChange(newEras);
  }, [eras, viewMode, onErasChange]);

  // Handle cell click to start editing
  const handleCellClick = (rowId, eraId) => {
    const currentValue = getWeight(rowId, eraId);
    setEditingCell({ rowId, eraId });
    setEditValue(currentValue !== null ? String(currentValue) : '');
    setTimeout(() => inputRef.current?.select(), 0);
  };

  // Handle cell edit completion
  const handleCellBlur = () => {
    if (editingCell) {
      const value = editValue.trim();
      if (value === '') {
        setWeight(editingCell.rowId, editingCell.eraId, null);
      } else {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          setWeight(editingCell.rowId, editingCell.eraId, numValue);
        }
      }
      setEditingCell(null);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // Apply weight to all eras for a row
  const applyToAllEras = (itemId, value) => {
    const newEras = eras.map((era) => {
      const weightsKey = viewMode === 'generators' ? 'templateWeights' : 'systemModifiers';
      const weights = { ...era[weightsKey] };

      if (value === null || value === 0) {
        delete weights[itemId];
      } else {
        weights[itemId] = value;
      }

      return { ...era, [weightsKey]: weights };
    });
    onErasChange(newEras);
  };

  // Copy row weights
  const copyRow = (itemId) => {
    const weights = {};
    eras.forEach((era) => {
      const value = getWeight(itemId, era.id);
      if (value !== null) {
        weights[era.id] = value;
      }
    });
    setCopiedRow({ id: itemId, weights });
  };

  // Paste row weights
  const pasteRow = (targetItemId) => {
    if (!copiedRow) return;

    const newEras = eras.map((era) => {
      const weightsKey = viewMode === 'generators' ? 'templateWeights' : 'systemModifiers';
      const weights = { ...era[weightsKey] };

      if (copiedRow.weights[era.id] !== undefined) {
        weights[targetItemId] = copiedRow.weights[era.id];
      } else {
        delete weights[targetItemId];
      }

      return { ...era, [weightsKey]: weights };
    });
    onErasChange(newEras);
  };

  // Remove from all eras
  const removeFromAllEras = (itemId) => {
    const newEras = eras.map((era) => {
      const weightsKey = viewMode === 'generators' ? 'templateWeights' : 'systemModifiers';
      const weights = { ...era[weightsKey] };
      delete weights[itemId];
      return { ...era, [weightsKey]: weights };
    });
    onErasChange(newEras);
  };

  // Check if item is used in any era
  const isUsedInAnyEra = (itemId) => {
    return eras.some((era) => {
      const weights = viewMode === 'generators' ? era.templateWeights : era.systemModifiers;
      return weights?.[itemId] !== undefined && weights[itemId] !== null;
    });
  };

  // Count eras where item is active
  const countActiveEras = (itemId) => {
    return eras.filter((era) => {
      const weights = viewMode === 'generators' ? era.templateWeights : era.systemModifiers;
      return weights?.[itemId] > 0;
    }).length;
  };

  // Quick set weight for bulk operations
  const [quickSetValue, setQuickSetValue] = useState(1);

  const handleQuickSetSelected = () => {
    const value = quickSetValue ?? 0;
    selectedRows.forEach((itemId) => {
      applyToAllEras(itemId, value);
    });
    setSelectedRows(new Set());
  };

  const toggleRowSelection = (itemId) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedRows(newSelection);
  };

  const selectAllRows = () => {
    if (selectedRows.size === filteredItems.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredItems.map((i) => i.id)));
    }
  };

  return (
    <div className="weight-matrix-editor">
      <div className="header">
        <h1 className="title">Weight Matrix</h1>
        <p className="subtitle">
          Manage {viewMode} weights across all eras in a spreadsheet view.
          Click any cell to edit, or use row actions for bulk operations.
        </p>
      </div>

      {/* Orphaned References Warning */}
      {totalOrphans > 0 && (
        <div className="orphan-warning">
          <div className="orphan-warning-content">
            <span className="orphan-warning-icon">⚠️</span>
            <div className="orphan-warning-text">
              <strong>{totalOrphans} orphaned reference{totalOrphans !== 1 ? 's' : ''} detected</strong>
              <span className="orphan-warning-details">
                {orphanedReferences.generators.length > 0 && (
                  <span>{orphanedReferences.generators.length} deleted generator{orphanedReferences.generators.length !== 1 ? 's' : ''}</span>
                )}
                {orphanedReferences.generators.length > 0 && orphanedReferences.systems.length > 0 && ', '}
                {orphanedReferences.systems.length > 0 && (
                  <span>{orphanedReferences.systems.length} deleted system{orphanedReferences.systems.length !== 1 ? 's' : ''}</span>
                )}
                {' still referenced in eras'}
              </span>
            </div>
          </div>
          <button className="btn btn-warning" onClick={cleanupOrphanedReferences}>
            Clean Up All
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="matrix-toolbar">
        <div className="toolbar-left">
          {/* View Mode Toggle */}
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'generators' ? 'active' : ''}`}
              onClick={() => setViewMode('generators')}
            >
              Generators ({generators.length})
              {orphanedReferences.generators.length > 0 && viewMode !== 'generators' && (
                <span className="orphan-badge">{orphanedReferences.generators.length}</span>
              )}
            </button>
            <button
              className={`toggle-btn ${viewMode === 'systems' ? 'active' : ''}`}
              onClick={() => setViewMode('systems')}
            >
              Systems ({systems.length})
              {orphanedReferences.systems.length > 0 && viewMode !== 'systems' && (
                <span className="orphan-badge">{orphanedReferences.systems.length}</span>
              )}
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            className="matrix-search"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="toolbar-right">
          {/* Bulk Actions */}
          {selectedRows.size > 0 && (
            <div className="bulk-actions">
              <span className="selection-count">{selectedRows.size} selected</span>
              <NumberInput
                className="quick-set-input"
                value={quickSetValue}
                onChange={setQuickSetValue}
                min={0}
                max={10}
                step={0.1}
              />
              <button className="btn btn-secondary" onClick={handleQuickSetSelected}>
                Set All Eras
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setSelectedRows(new Set())}
              >
                Clear
              </button>
            </div>
          )}

          {/* Paste indicator */}
          {copiedRow && (
            <span className="copied-indicator">
              Copied: {copiedRow.id}
            </span>
          )}
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="matrix-container">
        <table className="matrix-table">
          <thead>
            <tr>
              <th className="checkbox-col">
                <input
                  type="checkbox"
                  checked={selectedRows.size === filteredItems.length && filteredItems.length > 0}
                  onChange={selectAllRows}
                />
              </th>
              <th className="name-col">
                {viewMode === 'generators' ? 'Generator' : 'System'}
              </th>
              <th className="status-col">Eras</th>
              {eras.map((era) => (
                <th key={era.id} className="era-col" title={era.summary || era.name}>
                  {era.name || era.id}
                </th>
              ))}
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={eras.length + 4} className="empty-row">
                  {searchQuery
                    ? `No ${viewMode} match "${searchQuery}"`
                    : `No ${viewMode} defined`}
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isUsed = isUsedInAnyEra(item.id);
                const activeCount = countActiveEras(item.id);

                return (
                  <tr
                    key={item.id}
                    className={`matrix-row ${!isUsed ? 'unused' : ''} ${selectedRows.has(item.id) ? 'selected' : ''}`}
                  >
                    <td className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(item.id)}
                        onChange={() => toggleRowSelection(item.id)}
                      />
                    </td>
                    <td className="name-col">
                      <span className="item-name" title={item.id}>
                        {item.name}
                      </span>
                      {item.type && viewMode === 'systems' && (
                        <span className="item-type">{item.type}</span>
                      )}
                    </td>
                    <td className="status-col">
                      <span className={`era-count ${activeCount === 0 ? 'zero' : ''}`}>
                        {activeCount}/{eras.length}
                      </span>
                    </td>
                    {eras.map((era) => {
                      const weight = getWeight(item.id, era.id);
                      const isEditing = editingCell?.rowId === item.id && editingCell?.eraId === era.id;

                      return (
                        <td
                          key={era.id}
                          className={`weight-cell ${weight === null ? 'empty' : ''}`}
                          style={{
                            backgroundColor: getHeatmapColor(weight),
                          }}
                          onClick={() => handleCellClick(item.id, era.id)}
                        >
                          {isEditing ? (
                            <input
                              ref={inputRef}
                              type="text"
                              className="cell-input"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellBlur}
                              onKeyDown={handleKeyDown}
                              autoFocus
                            />
                          ) : (
                            <span
                              className="cell-value"
                              style={{ color: getTextColor(weight) }}
                            >
                              {weight !== null ? weight : '-'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="actions-col">
                      <div className="row-actions">
                        <button
                          className="action-btn"
                          onClick={() => applyToAllEras(item.id, 1)}
                          title="Add to all eras (weight 1)"
                        >
                          +All
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => copyRow(item.id)}
                          title="Copy weights"
                        >
                          Copy
                        </button>
                        {copiedRow && copiedRow.id !== item.id && (
                          <button
                            className="action-btn"
                            onClick={() => pasteRow(item.id)}
                            title="Paste weights"
                          >
                            Paste
                          </button>
                        )}
                        <button
                          className="action-btn danger"
                          onClick={() => removeFromAllEras(item.id)}
                          title="Remove from all eras"
                        >
                          Clear
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="matrix-legend">
        <span className="legend-label">Weight:</span>
        <div className="legend-scale">
          <span className="legend-item" style={{ backgroundColor: getHeatmapColor(0) }}>0</span>
          <span className="legend-item" style={{ backgroundColor: getHeatmapColor(2.5) }}>2.5</span>
          <span className="legend-item" style={{ backgroundColor: getHeatmapColor(5) }}>5</span>
          <span className="legend-item" style={{ backgroundColor: getHeatmapColor(7.5) }}>7.5</span>
          <span className="legend-item" style={{ backgroundColor: getHeatmapColor(10) }}>10</span>
        </div>
        <span className="legend-note">Click cell to edit. "-" = not assigned.</span>
      </div>
    </div>
  );
}
