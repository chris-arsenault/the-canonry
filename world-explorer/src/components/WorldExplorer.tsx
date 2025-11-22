import { useState } from 'react';
import type { WorldState, Filters, EntityKind } from '../types/world.ts';
import { applyFilters, applyTemporalFilter } from '../utils/dataTransform.ts';
import GraphView from './GraphView.tsx';
import FilterPanel from './FilterPanel.tsx';
import EntityDetail from './EntityDetail.tsx';
import TimelineControl from './TimelineControl.tsx';
import './WorldExplorer.css';

interface WorldExplorerProps {
  worldData: WorldState;
}

export default function WorldExplorer({ worldData }: WorldExplorerProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(undefined);
  const [currentTick, setCurrentTick] = useState<number>(worldData.metadata.tick);
  const [filters, setFilters] = useState<Filters>({
    kinds: ['npc', 'faction', 'location', 'rules', 'abilities'] as EntityKind[],
    minProminence: 'forgotten',
    timeRange: [0, worldData.metadata.tick],
    tags: [],
    searchQuery: '',
    relationshipTypes: []
  });

  // Apply temporal filter first, then regular filters
  const temporalData = applyTemporalFilter(worldData, currentTick);
  const filteredData = applyFilters(temporalData, filters);

  return (
    <div className="world-explorer">
      {/* Header */}
      <header className="world-header">
        <div className="world-header-content">
          <div className="world-header-left">
            <div className="world-penguin">🐧</div>
            <div className="world-title-container">
              <h1 className="world-title">PENGUIN TALES</h1>
              <p className="world-subtitle">History Explorer</p>
            </div>
          </div>
          <div className="world-header-right">
            <div className="world-header-stats">
              <div className="world-header-stat">
                <div className="world-header-stat-label">Epoch</div>
                <div className="world-header-stat-value">{worldData.metadata.epoch}</div>
              </div>
              <div className="world-header-stat">
                <div className="world-header-stat-label">Tick</div>
                <div className="world-header-stat-value">{worldData.metadata.tick}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="world-main">
        {/* Filter Panel */}
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          worldData={worldData}
        />

        {/* Graph View */}
        <main className="world-graph-container">
          <GraphView
            data={filteredData}
            selectedNodeId={selectedEntityId}
            onNodeSelect={setSelectedEntityId}
          />
        </main>

        {/* Entity Detail Panel */}
        <EntityDetail
          entityId={selectedEntityId}
          worldData={worldData}
          onRelatedClick={setSelectedEntityId}
        />
      </div>

      {/* Timeline Control */}
      <TimelineControl
        worldData={worldData}
        currentTick={currentTick}
        onTickChange={setCurrentTick}
      />

      {/* Footer Status Bar */}
      <footer className="world-footer">
        <div className="world-footer-content">
          <div className="world-footer-left">
            <div className="world-footer-stat">
              <span className="world-footer-stat-label">Showing:</span>
              <span className="world-footer-stat-value">{filteredData.metadata.entityCount}</span>
              <span className="world-footer-stat-separator">/</span>
              <span className="world-footer-stat-total">{temporalData.metadata.entityCount}</span>
              <span className="world-footer-stat-label"> entities</span>
            </div>
            <div className="world-footer-stat">
              <span className="world-footer-stat-value">{filteredData.metadata.relationshipCount}</span>
              <span className="world-footer-stat-separator">/</span>
              <span className="world-footer-stat-total">{temporalData.metadata.relationshipCount}</span>
              <span className="world-footer-stat-label"> links</span>
            </div>
          </div>
          <div className="world-footer-right">
            {selectedEntityId ? (
              <span>
                <span className="world-footer-selected-label">Selected:</span>
                <span className="world-footer-selected-value">{selectedEntityId}</span>
              </span>
            ) : (
              <span className="world-footer-no-selection">No selection</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
