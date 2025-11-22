import { useState } from 'react';
import type { WorldState, Filters, EntityKind } from '../types/world.ts';
import { applyFilters } from '../utils/dataTransform.ts';
import GraphView from './GraphView.tsx';
import FilterPanel from './FilterPanel.tsx';
import EntityDetail from './EntityDetail.tsx';

interface WorldExplorerProps {
  worldData: WorldState;
}

export default function WorldExplorer({ worldData }: WorldExplorerProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<Filters>({
    kinds: ['npc', 'faction', 'location', 'rules', 'abilities'] as EntityKind[],
    minProminence: 'forgotten',
    timeRange: [0, worldData.metadata.tick],
    tags: [],
    searchQuery: ''
  });

  const filteredData = applyFilters(worldData, filters);

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--arctic-deep)' }}>
      {/* Header */}
      <header className="relative px-8 py-5 border-b-2 border-blue-500/30 shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0a1929 100%)',
          borderImageSource: 'linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6)',
          borderImageSlice: 1
        }}>
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            <div className="text-5xl leading-none" style={{ textShadow: '0 0 20px rgba(59, 130, 246, 0.5)' }}>
              🐧
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #93c5fd 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '0.02em'
                }}>
                PENGUIN TALES
              </h1>
              <p className="text-blue-300 text-sm tracking-wide font-medium">
                History Explorer
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-xs text-blue-400 uppercase tracking-wider mb-1.5">Epoch</div>
                <div className="text-xl font-bold text-white">{worldData.metadata.epoch}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-blue-400 uppercase tracking-wider mb-1.5">Tick</div>
                <div className="text-xl font-bold text-white">{worldData.metadata.tick}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Filter Panel */}
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          worldData={worldData}
        />

        {/* Graph View */}
        <main className="flex-1">
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

      {/* Footer Status Bar */}
      <footer className="border-t border-blue-500/20 px-8 py-3 text-xs shadow-lg"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0a1929 100%)' }}>
        <div className="flex items-center justify-between text-blue-200 gap-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-blue-400">Entities:</span>
              <span className="font-semibold text-white">{filteredData.metadata.entityCount}</span>
              <span className="text-blue-600">/</span>
              <span className="text-gray-400">{worldData.metadata.entityCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400">Relationships:</span>
              <span className="font-semibold text-white">{filteredData.metadata.relationshipCount}</span>
              <span className="text-blue-600">/</span>
              <span className="text-gray-400">{worldData.metadata.relationshipCount}</span>
            </div>
          </div>
          <div className="text-blue-300 flex-shrink-0">
            {selectedEntityId ? (
              <span>
                <span className="text-blue-400">Selected:</span> <span className="font-mono text-white ml-2">{selectedEntityId}</span>
              </span>
            ) : (
              <span className="text-gray-500 italic">No selection</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
