import { useState } from 'react';
import type { EntityKind, Filters, Prominence, WorldState } from '../types/world.ts';
import { getAllTags, getAllRelationshipTypes, getRelationshipTypeCounts } from '../utils/dataTransform.ts';
import './FilterPanel.css';

interface FilterPanelProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  worldData: WorldState;
}

export default function FilterPanel({ filters, onChange, worldData }: FilterPanelProps) {
  const allTags = getAllTags(worldData);
  const allRelationshipTypes = getAllRelationshipTypes(worldData);
  const relationshipTypeCounts = getRelationshipTypeCounts(worldData);
  const maxTick = worldData.metadata.tick;

  // Sort relationship types by count (descending)
  const sortedRelationshipTypes = [...allRelationshipTypes].sort((a, b) => {
    return (relationshipTypeCounts[b] || 0) - (relationshipTypeCounts[a] || 0);
  });

  const [isRelTypesExpanded, setIsRelTypesExpanded] = useState(false);

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
      // Currently showing all, uncheck one means select all EXCEPT this one
      relationshipTypes = sortedRelationshipTypes.filter(t => t !== type);
    } else if (filters.relationshipTypes.includes(type)) {
      // Currently checked, uncheck it
      relationshipTypes = filters.relationshipTypes.filter(t => t !== type);
    } else {
      // Currently unchecked, check it
      relationshipTypes = [...filters.relationshipTypes, type];

      // If all are now checked, go back to "show all" (empty array)
      if (relationshipTypes.length === sortedRelationshipTypes.length) {
        relationshipTypes = [];
      }
    }

    onChange({ ...filters, relationshipTypes });
  };

  const entityKinds: EntityKind[] = ['npc', 'faction', 'location', 'rules', 'abilities'];
  const prominenceLevels: Prominence[] = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

  return (
    <div className="filter-panel">
      <div>
        <h2 className="filter-panel-title">
          Filters
        </h2>
        <div className="filter-panel-divider"></div>
      </div>

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
              <span>{kind}</span>
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
                : filters.relationshipTypes.length === sortedRelationshipTypes.length
                ? 'None'
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
                  Select All
                </button>
                <button
                  onClick={() => onChange({ ...filters, relationshipTypes: sortedRelationshipTypes })}
                  className="filter-accordion-control-btn"
                >
                  Clear All
                </button>
              </div>
              {sortedRelationshipTypes.map(type => {
                const isChecked = filters.relationshipTypes.length === 0 || filters.relationshipTypes.includes(type);
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

      {/* Reset Button */}
      <button
        onClick={() => onChange({
          kinds: entityKinds,
          minProminence: 'forgotten',
          timeRange: [0, maxTick],
          tags: [],
          searchQuery: '',
          relationshipTypes: []
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
