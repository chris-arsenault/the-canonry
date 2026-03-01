import React, { useCallback, useMemo } from "react";
import { useExpandBoolean } from "@the-canonry/shared-components";
import type { EntityKind, Filters, Prominence, WorldState } from "../types/world.ts";
import {
  getAllTags,
  getProminenceLevels,
  getRelationshipTypeCounts,
} from "../utils/dataTransform.ts";
import "./FilterPanel.css";

export type EdgeMetric = "strength" | "distance" | "none";
export type ViewMode = "graph3d" | "graph2d" | "map" | "timeline";

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

// ---------------------------------------------------------------------------
// Extracted sub-components
// ---------------------------------------------------------------------------

const VIEW_MODES: { key: ViewMode; label: string; title: string }[] = [
  { key: "graph3d", label: "3D", title: "3D Graph View" },
  { key: "graph2d", label: "2D", title: "2D Graph View" },
  { key: "map", label: "Map", title: "Coordinate Map View" },
  { key: "timeline", label: "Time", title: "Timeline View - Eras along axis" },
];

function ViewControls({
  viewMode,
  onViewModeChange,
  onRecalculateLayout,
  onToggleStats,
}: Readonly<{
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  onRecalculateLayout: () => void;
  onToggleStats: () => void;
}>) {
  return (
    <div className="view-controls">
      <div className="view-mode-buttons">
        {VIEW_MODES.map((m) => (
          <button
            key={m.key}
            className={`view-mode-btn ${viewMode === m.key ? "active" : ""}`}
            onClick={() => onViewModeChange(m.key)}
            title={m.title}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="view-actions">
        <button className="view-action-btn" onClick={onRecalculateLayout} title="Recalculate Layout">
          recalc
        </button>
        <button className="view-action-btn" onClick={onToggleStats} title="Toggle Stats Panel">
          stats
        </button>
      </div>
    </div>
  );
}

const EDGE_METRICS: { key: EdgeMetric; label: string }[] = [
  { key: "strength", label: "Strength" },
  { key: "distance", label: "Distance" },
  { key: "none", label: "Equal" },
];

function EdgeMetricSelector({
  edgeMetric,
  onEdgeMetricChange,
}: Readonly<{
  edgeMetric: EdgeMetric;
  onEdgeMetricChange: (m: EdgeMetric) => void;
}>) {
  return (
    <div className="edge-metric-group">
      <span className="filter-section-label">Edge Spring</span>
      <div className="edge-metric-buttons">
        {EDGE_METRICS.map((m) => (
          <button
            key={m.key}
            className={`edge-metric-btn ${edgeMetric === m.key ? "active" : ""}`}
            onClick={() => onEdgeMetricChange(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RelationshipTypeAccordion({
  filters,
  onChange,
  sortedTypes,
  typeCounts,
}: Readonly<{
  filters: Filters;
  onChange: (f: Filters) => void;
  sortedTypes: string[];
  typeCounts: Record<string, number>;
}>) {
  const { expanded: isRelTypesExpanded, toggle } = useExpandBoolean();

  const toggleType = useCallback(
    (type: string) => {
      let next: string[];
      if (filters.relationshipTypes.length === 0) {
        next = [type];
      } else if (filters.relationshipTypes.includes(type)) {
        next = filters.relationshipTypes.filter((t) => t !== type);
      } else {
        next = [...filters.relationshipTypes, type];
      }
      onChange({ ...filters, relationshipTypes: next });
    },
    [filters, onChange],
  );

  return (
    <div className="fp-group">
      <div className="filter-accordion-container">
        <button onClick={toggle} className="filter-accordion-header">
          <div className="filter-accordion-header-left">
            <span className="filter-accordion-icon">{isRelTypesExpanded ? "\u2212" : "+"}</span>
            <span className="filter-accordion-title">Relationship Types</span>
          </div>
          <span className="filter-accordion-badge">
            {filters.relationshipTypes.length === 0 ? "All" : filters.relationshipTypes.length}
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
            {sortedTypes.map((type) => {
              const isChecked =
                filters.relationshipTypes.length === 0 || filters.relationshipTypes.includes(type);
              return (
                <label key={type} className="filter-checkbox-label">
                  <input type="checkbox" checked={isChecked} onChange={() => toggleType(type)} />
                  <span>
                    {type.replace(/_/g, " ")} ({typeCounts[type]})
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TimeRangeSlider({
  filters,
  onChange,
  maxTick,
}: Readonly<{
  filters: Filters;
  onChange: (f: Filters) => void;
  maxTick: number;
}>) {
  return (
    <div className="fp-group">
      <span className="filter-section-label">Time Range</span>
      <div className="time-range-box">
        <div className="time-range-labels">
          <span className="time-range-label">
            Start: <span className="time-range-label-value">{filters.timeRange[0]}</span>
          </span>
          <span className="time-range-label">
            End: <span className="time-range-label-value">{filters.timeRange[1]}</span>
          </span>
        </div>
        <div className="time-range-sliders">
          <input
            type="range"
            min={0}
            max={maxTick}
            value={filters.timeRange[0]}
            onChange={(e) =>
              onChange({ ...filters, timeRange: [parseInt(e.target.value), filters.timeRange[1]] })
            }
          />
          <input
            type="range"
            min={0}
            max={maxTick}
            value={filters.timeRange[1]}
            onChange={(e) =>
              onChange({ ...filters, timeRange: [filters.timeRange[0], parseInt(e.target.value)] })
            }
          />
        </div>
      </div>
    </div>
  );
}

function StrengthSlider({
  filters,
  onChange,
}: Readonly<{ filters: Filters; onChange: (f: Filters) => void }>) {
  return (
    <div className="fp-group">
      <span className="filter-section-label">
        Min Relationship Strength{" "}
        <span className="text-blue-400 font-normal">({filters.minStrength.toFixed(2)})</span>
      </span>
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
  );
}

function WorldStats({ worldData }: Readonly<{ worldData: WorldState }>) {
  return (
    <div className="fp-stats">
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
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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
}: Readonly<FilterPanelProps>) {
  const allTags = getAllTags(worldData);
  const relationshipTypeCounts = getRelationshipTypeCounts(worldData);
  const maxTick = worldData.metadata.tick;

  const entityKindSchemas = worldData.schema.entityKinds;
  const entityKinds: EntityKind[] = useMemo(
    () => entityKindSchemas.map((ek) => ek.kind),
    [entityKindSchemas],
  );
  const prominenceLevels: Prominence[] = getProminenceLevels(worldData.schema);

  const kindDisplayNames = useMemo(
    () =>
      Object.fromEntries(
        entityKindSchemas.map((ek) => [ek.kind, ek.style?.displayName || ek.description || ek.kind]),
      ),
    [entityKindSchemas],
  );

  const sortedRelationshipTypes = useMemo(() => {
    const all = entityKindSchemas.length > 0
      ? worldData.schema.relationshipKinds.map((rel) => rel.kind)
      : [];
    return [...all].sort((a, b) => (relationshipTypeCounts[b] || 0) - (relationshipTypeCounts[a] || 0));
  }, [worldData.schema.relationshipKinds, relationshipTypeCounts, entityKindSchemas.length]);

  const toggleKind = useCallback(
    (kind: EntityKind) => {
      const kinds = filters.kinds.includes(kind)
        ? filters.kinds.filter((k) => k !== kind)
        : [...filters.kinds, kind];
      onChange({ ...filters, kinds });
    },
    [filters, onChange],
  );

  const toggleTag = useCallback(
    (tag: string) => {
      const tags = filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag];
      onChange({ ...filters, tags });
    },
    [filters, onChange],
  );

  const showEdgeMetric = viewMode === "graph3d" || viewMode === "graph2d";

  return (
    <div className="filter-panel">
      <ViewControls
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        onRecalculateLayout={onRecalculateLayout}
        onToggleStats={onToggleStats}
      />

      {showEdgeMetric && (
        <EdgeMetricSelector edgeMetric={edgeMetric} onEdgeMetricChange={onEdgeMetricChange} />
      )}

      <div className="filter-panel-divider" />

      {/* Search */}
      <div className="fp-group">
        <label htmlFor="search" className="filter-section-label">Search</label>
        <input
          id="search"
          type="text"
          value={filters.searchQuery}
          onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
          placeholder="Search entities..."
          className="filter-search-input"
        />
      </div>

      {/* Entity Types */}
      <div className="fp-group">
        <span className="filter-section-label">Entity Types</span>
        <div className="filter-checkbox-group">
          {entityKinds.map((kind) => (
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

      <RelationshipTypeAccordion
        filters={filters}
        onChange={onChange}
        sortedTypes={sortedRelationshipTypes}
        typeCounts={relationshipTypeCounts}
      />

      {/* Minimum Prominence */}
      <div className="fp-group">
        <label htmlFor="minimum-prominence" className="filter-section-label">Minimum Prominence</label>
        <select
          id="minimum-prominence"
          value={filters.minProminence}
          onChange={(e) => onChange({ ...filters, minProminence: e.target.value as Prominence })}
          className="filter-select"
        >
          {prominenceLevels.map((level) => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
      </div>

      <TimeRangeSlider filters={filters} onChange={onChange} maxTick={maxTick} />

      {/* Tags */}
      <div className="fp-group">
        <span className="filter-section-label">
          Tags <span className="text-blue-400 font-normal">({filters.tags.length} selected)</span>
        </span>
        <div className="tags-box">
          {allTags.map((tag) => (
            <label key={tag} className="filter-checkbox-label">
              <input type="checkbox" checked={filters.tags.includes(tag)} onChange={() => toggleTag(tag)} />
              <span>{tag}</span>
            </label>
          ))}
        </div>
      </div>

      <StrengthSlider filters={filters} onChange={onChange} />

      {/* CatalyzedBy */}
      <div className="fp-group">
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

      {/* Historical */}
      <div className="fp-group">
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

      {/* Reset */}
      <button
        onClick={() =>
          onChange({
            kinds: entityKinds,
            minProminence: prominenceLevels[0],
            timeRange: [0, maxTick],
            tags: [],
            searchQuery: "",
            relationshipTypes: [],
            minStrength: 0.0,
            showCatalyzedBy: false,
            showHistoricalRelationships: false,
          })
        }
        className="reset-button"
      >
        Reset Filters
      </button>

      <WorldStats worldData={worldData} />
    </div>
  );
}
