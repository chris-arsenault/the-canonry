import { useState, useRef, lazy, Suspense, useMemo, useEffect, useCallback } from 'react';
import type { WorldState, Filters, EntityKind, LoreData } from '../types/world.ts';
import { applyFilters, applyTemporalFilter, getProminenceLevels } from '../utils/dataTransform.ts';
import CoordinateMapView from './CoordinateMapView.tsx';
import FilterPanel from './FilterPanel.tsx';
import EntityDetail from './EntityDetail.tsx';
import TimelineControl from './TimelineControl.tsx';
import StatsPanel from './StatsPanel.tsx';
import './WorldExplorer.css';
import { buildProminenceScale, DEFAULT_PROMINENCE_DISTRIBUTION, type ProminenceScale } from '@canonry/world-schema';

/**
 * Parse entity ID from URL hash
 * Hash format: #/entity/{entityId} or #/ for none
 */
function parseHashEntityId(): string | undefined {
  const hash = window.location.hash;
  if (!hash || hash === '#/' || hash === '#') {
    return undefined;
  }
  // Match #/entity/{entityId}
  const match = hash.match(/^#\/entity\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Build hash URL for an entity
 */
function buildEntityHash(entityId: string | undefined): string {
  if (!entityId) {
    return '#/';
  }
  return `#/entity/${encodeURIComponent(entityId)}`;
}

interface WorldExplorerProps {
  worldData: WorldState;
  loreData: LoreData | null;
}

export type EdgeMetric = 'strength' | 'distance' | 'none';
export type ViewMode = 'graph3d' | 'graph2d' | 'map' | 'timeline';

const GraphView = lazy(() => import('./GraphView.tsx'));
const GraphView3D = lazy(() => import('./GraphView3D.tsx'));
const TimelineView3D = lazy(() => import('./TimelineView3D.tsx'));

export default function WorldExplorer({ worldData, loreData }: WorldExplorerProps) {
  // Initialize from hash on mount
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(() => parseHashEntityId());
  const [currentTick, setCurrentTick] = useState<number>(worldData.metadata.tick);
  const [isStatsPanelOpen, setIsStatsPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('graph3d');
  const [edgeMetric, setEdgeMetric] = useState<EdgeMetric>('strength');
  const recalculateLayoutRef = useRef<(() => void) | null>(null);

  // Sync hash changes to state (for back/forward buttons)
  useEffect(() => {
    const handleHashChange = () => {
      const entityId = parseHashEntityId();
      setSelectedEntityId(entityId);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Handle entity selection - updates hash which triggers state update via hashchange
  const handleEntitySelect = useCallback((entityId: string | undefined) => {
    const newHash = buildEntityHash(entityId);
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }
  }, []);

  // Get UI configuration from schema
  const entityKinds = worldData.schema.entityKinds.map(ek => ek.kind);
  const defaultMinProminence = getProminenceLevels(worldData.schema)[0];
  const prominenceScale = useMemo<ProminenceScale>(() => {
    const values = worldData.hardState
      .map((entity) => entity.prominence)
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
    return buildProminenceScale(values, { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
  }, [worldData]);

  const [filters, setFilters] = useState<Filters>({
    kinds: entityKinds as EntityKind[],
    minProminence: defaultMinProminence,
    timeRange: [0, worldData.metadata.tick],
    tags: [],
    searchQuery: '',
    relationshipTypes: [],
    minStrength: 0.0,
    showCatalyzedBy: false,
    showHistoricalRelationships: false
  });

  // Apply temporal filter first, then regular filters
  const temporalData = applyTemporalFilter(worldData, currentTick);
  const filteredData = applyFilters(temporalData, filters, prominenceScale);
  const loadingFallback = useMemo(
    () => <div className="world-loading">Loading view…</div>,
    []
  );

  return (
    <div className="world-explorer">
      {/* Main Content */}
      <div className="world-main">
        {/* Filter Panel */}
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          worldData={worldData}
          viewMode={viewMode}
          edgeMetric={edgeMetric}
          onViewModeChange={setViewMode}
          onEdgeMetricChange={setEdgeMetric}
          onRecalculateLayout={() => recalculateLayoutRef.current?.()}
          onToggleStats={() => setIsStatsPanelOpen(!isStatsPanelOpen)}
        />

        {/* Graph View */}
        <main className="world-graph-container">
          <Suspense fallback={loadingFallback}>
            {viewMode === 'graph3d' && (
              <GraphView3D
                key={`3d-view-${edgeMetric}`}
                data={filteredData}
                selectedNodeId={selectedEntityId}
                onNodeSelect={handleEntitySelect}
                showCatalyzedBy={filters.showCatalyzedBy}
                edgeMetric={edgeMetric}
                prominenceScale={prominenceScale}
              />
            )}
            {viewMode === 'graph2d' && (
              <GraphView
                key="2d-view"
                data={filteredData}
                selectedNodeId={selectedEntityId}
                onNodeSelect={handleEntitySelect}
                showCatalyzedBy={filters.showCatalyzedBy}
                onRecalculateLayoutRef={(handler) => { recalculateLayoutRef.current = handler; }}
                prominenceScale={prominenceScale}
              />
            )}
            {viewMode === 'timeline' && (
              <TimelineView3D
                key={`timeline-view-${edgeMetric}`}
                data={filteredData}
                selectedNodeId={selectedEntityId}
                onNodeSelect={handleEntitySelect}
                showCatalyzedBy={filters.showCatalyzedBy}
                edgeMetric={edgeMetric}
                prominenceScale={prominenceScale}
              />
            )}
          </Suspense>
          {viewMode === 'map' && (
            <CoordinateMapView
              key="map-view"
              data={filteredData}
              selectedNodeId={selectedEntityId}
              onNodeSelect={handleEntitySelect}
            />
          )}
        </main>

        {/* Entity Detail Panel */}
        <EntityDetail
          entityId={selectedEntityId}
          worldData={worldData}
          loreData={loreData}
          onRelatedClick={handleEntitySelect}
          prominenceScale={prominenceScale}
        />
      </div>

      {/* Timeline Control */}
      <TimelineControl
        worldData={worldData}
        loreData={loreData}
        currentTick={currentTick}
        onTickChange={setCurrentTick}
      />

      {/* Stats Panel */}
      <StatsPanel
        worldData={worldData}
        isOpen={isStatsPanelOpen}
        onToggle={() => setIsStatsPanelOpen(!isStatsPanelOpen)}
      />
    </div>
  );
}
