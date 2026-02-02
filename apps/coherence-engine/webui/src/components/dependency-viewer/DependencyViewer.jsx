/**
 * DependencyViewer - Visual representation of schema dependencies
 *
 * Shows a compact summary of how elements reference each other:
 * - Schema elements (entity kinds, relationship kinds) → Generators/Systems/Actions
 * - Pressures → Generators/Systems/Actions
 * - Generators/Systems → Eras
 *
 * Uses a grouped list view with expandable sections for detailed views.
 */

import React, { useMemo } from 'react';
import './dependency-viewer.css';
import { DependencySection, UsageBadges } from './components';

export default function DependencyViewer({ usageMap }) {
  // Prepare entity kinds data
  const entityKindsData = useMemo(() => {
    if (!usageMap?.entityKinds) return [];
    return Object.entries(usageMap.entityKinds)
      .map(([kind, usage]) => ({
        id: kind,
        usage,
        totalUsage: (usage.generators?.length || 0) + (usage.systems?.length || 0) +
                    (usage.actions?.length || 0) + (usage.pressures?.length || 0),
      }))
      .sort((a, b) => b.totalUsage - a.totalUsage);
  }, [usageMap]);

  // Prepare relationship kinds data
  const relationshipKindsData = useMemo(() => {
    if (!usageMap?.relationshipKinds) return [];
    return Object.entries(usageMap.relationshipKinds)
      .map(([kind, usage]) => ({
        id: kind,
        usage,
        totalUsage: (usage.generators?.length || 0) + (usage.systems?.length || 0) +
                    (usage.actions?.length || 0) + (usage.pressures?.length || 0),
      }))
      .sort((a, b) => b.totalUsage - a.totalUsage);
  }, [usageMap]);

  // Prepare pressures data
  const pressuresData = useMemo(() => {
    if (!usageMap?.pressures) return [];
    return Object.entries(usageMap.pressures)
      .map(([id, usage]) => ({
        id,
        usage,
        totalUsage: (usage.generators?.length || 0) + (usage.systems?.length || 0) + (usage.actions?.length || 0),
      }))
      .sort((a, b) => b.totalUsage - a.totalUsage);
  }, [usageMap]);

  // Prepare generators data
  const generatorsData = useMemo(() => {
    if (!usageMap?.generators) return [];
    return Object.entries(usageMap.generators)
      .map(([id, usage]) => ({
        id,
        usage,
        eraCount: usage.eras?.length || 0,
      }))
      .sort((a, b) => b.eraCount - a.eraCount);
  }, [usageMap]);

  // Prepare systems data
  const systemsData = useMemo(() => {
    if (!usageMap?.systems) return [];
    return Object.entries(usageMap.systems)
      .map(([id, usage]) => ({
        id,
        usage,
        eraCount: usage.eras?.length || 0,
      }))
      .sort((a, b) => b.eraCount - a.eraCount);
  }, [usageMap]);

  // Prepare tags data
  const tagsData = useMemo(() => {
    if (!usageMap?.tags) return [];
    return Object.entries(usageMap.tags)
      .map(([tag, usage]) => ({
        id: tag,
        usage,
        totalUsage: (usage.generators?.length || 0) + (usage.systems?.length || 0) +
                    (usage.actions?.length || 0) + (usage.pressures?.length || 0),
      }))
      .sort((a, b) => b.totalUsage - a.totalUsage);
  }, [usageMap]);

  if (!usageMap) {
    return (
      <div className="dependency-viewer-container">
        <div className="dependency-empty-state">Loading dependency data...</div>
      </div>
    );
  }

  const renderSchemaItem = (item) => (
    <div key={item.id} className="dependency-item-row">
      <span className="dependency-item-name">{item.id}</span>
      <UsageBadges usage={item.usage} />
    </div>
  );

  const renderEraItem = (item) => (
    <div key={item.id} className="dependency-item-row">
      <span className="dependency-item-name">{item.id}</span>
      {item.eraCount > 0 ? (
        <div className="dependency-used-by-list">
          <span className="dependency-badge dependency-badge-era">
            {item.eraCount} era{item.eraCount !== 1 ? 's' : ''}
          </span>
        </div>
      ) : (
        <span className="dependency-orphan-badge">Not in any era</span>
      )}
    </div>
  );

  return (
    <div className="dependency-viewer-container">
      <div className="dependency-viewer-header">
        <div className="dependency-viewer-title">
          <span>🔗</span>
          <span>Dependencies</span>
        </div>
        <div className="dependency-viewer-legend">
          <div className="dependency-legend-item">
            <div className="dependency-legend-dot" style={{ backgroundColor: '#60a5fa' }} />
            <span>Generators</span>
          </div>
          <div className="dependency-legend-item">
            <div className="dependency-legend-dot" style={{ backgroundColor: '#a855f7' }} />
            <span>Systems</span>
          </div>
          <div className="dependency-legend-item">
            <div className="dependency-legend-dot" style={{ backgroundColor: '#22c55e' }} />
            <span>Actions</span>
          </div>
          <div className="dependency-legend-item">
            <div className="dependency-legend-dot" style={{ backgroundColor: '#ec4899' }} />
            <span>Eras</span>
          </div>
        </div>
      </div>

      <DependencySection
        title="Entity Kinds"
        icon="📦"
        items={entityKindsData}
        renderItem={renderSchemaItem}
        defaultExpanded={true}
      />

      <DependencySection
        title="Relationship Kinds"
        icon="🔗"
        items={relationshipKindsData}
        renderItem={renderSchemaItem}
      />

      <DependencySection
        title="Tags"
        icon="🏷️"
        items={tagsData}
        renderItem={renderSchemaItem}
      />

      <DependencySection
        title="Pressures"
        icon="📊"
        items={pressuresData}
        renderItem={renderSchemaItem}
      />

      <DependencySection
        title="Generators → Eras"
        icon="✨"
        items={generatorsData}
        renderItem={renderEraItem}
      />

      <DependencySection
        title="Systems → Eras"
        icon="⚙️"
        items={systemsData}
        renderItem={renderEraItem}
      />
    </div>
  );
}

export { DependencyViewer };
