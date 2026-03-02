import React, { useState, useRef, lazy, Suspense, useMemo, useEffect, useCallback } from "react";
import type { WorldState, Filters, LoreData } from "../types/world.ts";
import { applyFilters, applyTemporalFilter, getProminenceLevels } from "../utils/dataTransform.ts";
import CoordinateMapView from "./CoordinateMapView.tsx";
import FilterPanel from "./FilterPanel.tsx";
import EntityDetail from "./EntityDetail.tsx";
import TimelineControl from "./TimelineControl.tsx";
import StatsPanel from "./StatsPanel.tsx";
import "./WorldExplorer.css";
import "./archivist-section.css";
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  type ProminenceScale,
} from "@canonry/world-schema";

/**
 * Parse entity ID from URL hash
 * Hash format: #/entity/{entityId} or #/ for none
 */
function parseHashEntityId(): string | undefined {
  const hash = window.location.hash;
  if (!hash || hash === "#/" || hash === "#") {
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
    return "#/";
  }
  return `#/entity/${encodeURIComponent(entityId)}`;
}

interface WorldExplorerProps {
  worldData: WorldState;
  loreData: LoreData | null;
}

export type EdgeMetric = "strength" | "distance" | "none";
export type ViewMode = "graph3d" | "graph2d" | "map" | "timeline";

const GraphView = lazy(() => import("./GraphView.tsx"));
const GraphView3D = lazy(() => import("./GraphView3D.tsx"));
const TimelineView3D = lazy(() => import("./TimelineView3D.tsx"));

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const webglAvailable = detectWebGL();

function useHashEntitySelection() {
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(() => parseHashEntityId());
  useEffect(() => {
    const handler = () => setSelectedEntityId(parseHashEntityId());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  const handleEntitySelect = useCallback((entityId: string | undefined) => {
    const newHash = buildEntityHash(entityId);
    if (window.location.hash !== newHash) window.location.hash = newHash;
  }, []);
  return { selectedEntityId, handleEntitySelect } as const;
}

const LOADING_FALLBACK = <div className="world-loading">Loading view…</div>;

export default function WorldExplorer({ worldData, loreData }: Readonly<WorldExplorerProps>) {
  const { selectedEntityId, handleEntitySelect } = useHashEntitySelection();
  const [currentTick, setCurrentTick] = useState<number>(worldData.metadata.tick);
  const [isStatsPanelOpen, setIsStatsPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(webglAvailable ? "graph3d" : "graph2d");
  const [edgeMetric, setEdgeMetric] = useState<EdgeMetric>("strength");
  const recalculateLayoutRef = useRef<(() => void) | null>(null);
  const handleRecalculateLayout = useCallback(() => recalculateLayoutRef.current?.(), []);
  const handleToggleStats = useCallback(() => setIsStatsPanelOpen(prev => !prev), []);
  const handleRecalculateLayoutRef = useCallback(
    (handler: (() => void) | null) => { recalculateLayoutRef.current = handler; }, []);
  const prominenceScale = useMemo<ProminenceScale>(() => {
    const values = worldData.hardState.map((e) => e.prominence).filter((v) => typeof v === "number" && Number.isFinite(v));
    return buildProminenceScale(values, { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
  }, [worldData]);
  const [filters, setFilters] = useState<Filters>({
    kinds: worldData.schema.entityKinds.map((ek) => ek.kind),
    minProminence: getProminenceLevels(worldData.schema)[0],
    timeRange: [0, worldData.metadata.tick], tags: [], searchQuery: "",
    relationshipTypes: [], minStrength: 0.0, showCatalyzedBy: false, showHistoricalRelationships: false,
  });
  const filteredData = applyFilters(applyTemporalFilter(worldData, currentTick), filters, prominenceScale);

  return (
    <div className="world-explorer">
      <div className="world-main">
        <FilterPanel filters={filters} onChange={setFilters} worldData={worldData} viewMode={viewMode}
          edgeMetric={edgeMetric} onViewModeChange={setViewMode} onEdgeMetricChange={setEdgeMetric}
          onRecalculateLayout={handleRecalculateLayout} onToggleStats={handleToggleStats} />
        <main className="world-graph-container">
          <Suspense fallback={LOADING_FALLBACK}>
            {viewMode === "graph3d" && <GraphView3D key={`3d-view-${edgeMetric}`} data={filteredData}
              selectedNodeId={selectedEntityId} onNodeSelect={handleEntitySelect}
              showCatalyzedBy={filters.showCatalyzedBy} edgeMetric={edgeMetric} prominenceScale={prominenceScale} />}
            {viewMode === "graph2d" && <GraphView key="2d-view" data={filteredData}
              selectedNodeId={selectedEntityId} onNodeSelect={handleEntitySelect}
              showCatalyzedBy={filters.showCatalyzedBy} onRecalculateLayoutRef={handleRecalculateLayoutRef} prominenceScale={prominenceScale} />}
            {viewMode === "timeline" && <TimelineView3D key={`timeline-view-${edgeMetric}`} data={filteredData}
              selectedNodeId={selectedEntityId} onNodeSelect={handleEntitySelect}
              showCatalyzedBy={filters.showCatalyzedBy} edgeMetric={edgeMetric} prominenceScale={prominenceScale} />}
          </Suspense>
          {viewMode === "map" && <CoordinateMapView key="map-view" data={filteredData}
            selectedNodeId={selectedEntityId} onNodeSelect={handleEntitySelect} />}
        </main>
        <EntityDetail entityId={selectedEntityId} worldData={worldData} loreData={loreData}
          onRelatedClick={handleEntitySelect} prominenceScale={prominenceScale} />
      </div>
      <TimelineControl worldData={worldData} loreData={loreData} currentTick={currentTick} onTickChange={setCurrentTick} />
      <StatsPanel worldData={worldData} isOpen={isStatsPanelOpen} onToggle={handleToggleStats} />
    </div>
  );
}
