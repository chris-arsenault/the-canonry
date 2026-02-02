import { useState } from 'react';
import type { EntityKind, Filters, Prominence, WorldState } from '../types/world.ts';
import { getAllTags, getProminenceLevels, getRelationshipTypeCounts } from '../utils/dataTransform.ts';
import './FilterPanel.css';

export type EdgeMetric = 'strength' | 'distance' | 'none';
export type ViewMode = 'graph3d' | 'graph2d' | 'map' | 'timeline';

interface FilterPanelProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  worldData: WorldState;
  viewMode: ViewMode;
  edgeMetric: EdgeMetric;
  onViewModeChange: (mode: ViewMode) => void;
  onEdgeMetricChange: (metric: EdgeMetric) => void;
  onRecalculateLayout: () => void;
  onToggleStats: () => void;
}

export default function FilterPanel({
  filters,
  onChange,
  worldData,
  viewMode,
  edgeMetric,
  onViewModeChange,
  onEdgeMetricChange,
  onRecalculateLayout,
  onToggleStats,
}: FilterPanelProps) {
  const allTags = getAllTags(worldData);
  const relationshipTypeCounts = getRelationshipTypeCounts(worldData);
  const maxTick = worldData.metadata.tick;

  const allRelationshipTypes = worldData.schema.relationshipKinds.map(rel => rel.kind);
  // Sort relationship types by count (descending)
  const sortedRelationshipTypes = [...allRelationshipTypes].sort((a, b) => {
    return (relationshipTypeCounts[b] || 0) - (relationshipTypeCounts[a] || 0);
  });

  const [isRelTypesExpanded, setIsRelTypesExpanded] = useState(false);

  const entityKindSchemas = worldData.schema.entityKinds;
  const entityKinds: EntityKind[] = entityKindSchemas.map(ek => ek.kind);

  const prominenceLevels: Prominence[] = getProminenceLevels(worldData.schema);

  // Build a map from kind to display name (from schema if available, otherwise use kind as-is)
  const kindDisplayNames = Object.fromEntries(
    entityKindSchemas.map(ek => [ek.kind, ek.style?.displayName || ek.description || ek.kind])
  );

  const toggleKind = (kind: EntityKind) => {
    const kinds = filters.kinds.includes(kind)
      ? filters.kinds.filter(k => k !== kind)
      : [...filters.kinds, kind];
    onChange({ ...filters, kinds });
  };

  const toggleTag = (tag: string) => {
    const tags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    onChange({ ...filters, tags });
  };

  const toggleRelationshipType = (type: string) => {
    let relationshipTypes: string[];

    if (filters.relationshipTypes.length === 0) {
      // Currently showing all - user wants to filter to ONLY this type
      relationshipTypes = [type];
    } else if (filters.relationshipTypes.includes(type)) {
      // Type is selected, uncheck it
      relationshipTypes = filters.relationshipTypes.filter(t => t !== type);
      // If nothing left selected, go back to showing all
      // (empty array = no filter = show all)
    } else {
      // Type not selected, add it
      relationshipTypes = [...filters.relationshipTypes, type];
    }

    onChange({ ...filters, relationshipTypes });
  };

  return (
    <div className="filter-panel">
      {/* View Controls */}
      <div className="view-controls">
        <div className="view-mode-buttons">
          <button
            className={`view-mode-btn ${viewMode === 'graph3d' ? 'active' : ''}`}
            onClick={() => onViewModeChange('graph3d')}
            title="3D Graph View"
          >
            3D
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'graph2d' ? 'active' : ''}`}
            onClick={() => onViewModeChange('graph2d')}
            title="2D Graph View"
          >
            2D
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'map' ? 'active' : ''}`}
            onClick={() => onViewModeChange('map')}
            title="Coordinate Map View"
          >
            Map
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'timeline' ? 'active' : ''}`}
            onClick={() => onViewModeChange('timeline')}
            title="Timeline View - Eras along axis"
          >
            Time
          </button>
        </div>
        <div className="view-actions">
          <button
            className="view-action-btn"
            onClick={onRecalculateLayout}
            title="Recalculate Layout"
          >
            ♻️
          </button>
          <button
            className="view-action-btn"
            onClick={onToggleStats}
            title="Toggle Stats Panel"
          >
            📊
          </button>
        </div>
      </div>

      {/* Edge Metric (for graph views) */}
      {(viewMode === 'graph3d' || viewMode === 'graph2d') && (
        <div className="edge-metric-section">
          <label className="filter-section-label">Edge Spring</label>
          <div className="edge-metric-buttons">
            <button
              className={`edge-metric-btn ${edgeMetric === 'strength' ? 'active' : ''}`}
              onClick={() => onEdgeMetricChange('strength')}
            >
              Strength
            </button>
            <button
              className={`edge-metric-btn ${edgeMetric === 'distance' ? 'active' : ''}`}
              onClick={() => onEdgeMetricChange('distance')}
            >
              Distance
            </button>
            <button
              className={`edge-metric-btn ${edgeMetric === 'none' ? 'active' : ''}`}
              onClick={() => onEdgeMetricChange('none')}
            >
              Equal
            </button>
          </div>
        </div>
      )}

      <div className="filter-panel-divider"></div>

      {/* Search */}
      <div className="filter-section">
        <label className="filter-section-label">Search</label>
        <input
          type="text"
          value={filters.searchQuery}
          onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
          placeholder="Search entities..."
          className="filter-search-input"
        />
      </div>

      {/* Entity Types */}
      <div className="filter-section">
        <label className="filter-section-label">Entity Types</label>
        <div className="filter-checkbox-group">
          {entityKinds.map(kind => (
            <label key={kind} className="filter-checkbox-label">
              <input
                type="checkbox"
                checked={filters.kinds.includes(kind)}
                onChange={() => toggleKind(kind)}
              />
              <span>{kindDisplayNames[kind] ?? kind}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Relationship Types */}
      <div className="filter-section">
        <div className="filter-accordion-container">
          <button
            onClick={() => setIsRelTypesExpanded(!isRelTypesExpanded)}
            className="filter-accordion-header"
          >
            <div className="filter-accordion-header-left">
              <span className="filter-accordion-icon">{isRelTypesExpanded ? '−' : '+'}</span>
              <span className="filter-accordion-title">Relationship Types</span>
            </div>
            <span className="filter-accordion-badge">
              {filters.relationshipTypes.length === 0
                ? 'All'
                : filters.relationshipTypes.length}
            </span>
          </button>
          {isRelTypesExpanded && (
            <div className="filter-accordion-content">
              <div className="filter-accordion-controls">
                <button
                  onClick={() => onChange({ ...filters, relationshipTypes: [] })}
                  className="filter-accordion-control-btn"
                >
                  Show All
                </button>
              </div>
              {sortedRelationshipTypes.map(type => {
                // Empty array = show all (all appear checked)
                // Non-empty = only selected types are checked
                const isChecked = filters.relationshipTypes.length === 0
                  ? true
                  : filters.relationshipTypes.includes(type);
                return (
                  <label key={type} className="filter-checkbox-label">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleRelationshipType(type)}
                    />
                    <span>{type.replace(/_/g, ' ')} ({relationshipTypeCounts[type]})</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Minimum Prominence */}
      <div className="filter-section">
        <label className="filter-section-label">Minimum Prominence</label>
        <select
          value={filters.minProminence}
          onChange={(e) => onChange({ ...filters, minProminence: e.target.value as Prominence })}
          className="filter-select"
        >
          {prominenceLevels.map(level => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>

      {/* Time Range */}
      <div className="filter-section">
        <label className="filter-section-label">Time Range</label>
        <div className="time-range-box">
          <div className="time-range-labels">
            <span className="time-range-label">Start: <span className="time-range-label-value">{filters.timeRange[0]}</span></span>
            <span className="time-range-label">End: <span className="time-range-label-value">{filters.timeRange[1]}</span></span>
          </div>
          <div className="time-range-sliders">
            <input
              type="range"
              min={0}
              max={maxTick}
              value={filters.timeRange[0]}
              onChange={(e) => onChange({
                ...filters,
                timeRange: [parseInt(e.target.value), filters.timeRange[1]]
              })}
            />
            <input
              type="range"
              min={0}
              max={maxTick}
              value={filters.timeRange[1]}
              onChange={(e) => onChange({
                ...filters,
                timeRange: [filters.timeRange[0], parseInt(e.target.value)]
              })}
            />
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="filter-section">
        <label className="filter-section-label">
          Tags <span className="text-blue-400 font-normal">({filters.tags.length} selected)</span>
        </label>
        <div className="tags-box">
          {allTags.map(tag => (
            <label key={tag} className="filter-checkbox-label">
              <input
                type="checkbox"
                checked={filters.tags.includes(tag)}
                onChange={() => toggleTag(tag)}
              />
              <span>{tag}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Minimum Relationship Strength */}
      <div className="filter-section">
        <label className="filter-section-label">
          Min Relationship Strength <span className="text-blue-400 font-normal">({filters.minStrength.toFixed(2)})</span>
        </label>
        <div className="strength-slider-container">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={filters.minStrength}
            onChange={(e) => onChange({ ...filters, minStrength: parseFloat(e.target.value) })}
            className="strength-slider"
          />
          <div className="strength-slider-labels">
            <span>0.0</span>
            <span>0.5</span>
            <span>1.0</span>
          </div>
        </div>
      </div>

      {/* CatalyzedBy Relationships */}
      <div className="filter-section">
        <label className="filter-checkbox-label catalyzed-checkbox">
          <input
            type="checkbox"
            checked={filters.showCatalyzedBy}
            onChange={(e) => onChange({ ...filters, showCatalyzedBy: e.target.checked })}
          />
          <span>Show Catalyzed-By Chains</span>
        </label>
        <div className="filter-help-text">
          Visualizes meta-relationships showing which events or entities catalyzed the formation of relationships
        </div>
      </div>

      {/* Historical Relationships */}
      <div className="filter-section">
        <label className="filter-checkbox-label historical-checkbox">
          <input
            type="checkbox"
            checked={filters.showHistoricalRelationships}
            onChange={(e) => onChange({ ...filters, showHistoricalRelationships: e.target.checked })}
          />
          <span>Show Historical Relationships</span>
        </label>
        <div className="filter-help-text">
          Shows archived relationships that are no longer active but remain in the historical record
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => onChange({
          kinds: entityKinds,
          minProminence: prominenceLevels[0],
          timeRange: [0, maxTick],
          tags: [],
          searchQuery: '',
          relationshipTypes: [],
          minStrength: 0.0,
          showCatalyzedBy: false,
          showHistoricalRelationships: false
        })}
        className="reset-button"
      >
        Reset Filters
      </button>

      {/* Stats */}
      <div className="world-stats-section">
        <div className="world-stats-title">World Stats</div>
        <div className="world-stats-grid">
          <div className="world-stat-card">
            <div className="world-stat-label">Entities</div>
            <div className="world-stat-value">{worldData.metadata.entityCount}</div>
          </div>
          <div className="world-stat-card">
            <div className="world-stat-label">Relations</div>
            <div className="world-stat-value">{worldData.metadata.relationshipCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
