/**
 * CosmographerRemote - Module Federation entry point for Cosmographer
 *
 * This component is loaded by The Canonry shell and receives:
 * - schema: Read-only world schema (entityKinds, relationshipKinds, cultures)
 * - seedEntities: Array of seed entities
 * - seedRelationships: Array of seed relationships
 * - onEntityKindsChange: Callback when entity kinds change
 * - onCulturesChange: Callback when cultures change
 * - onSeedEntitiesChange: Callback when seed entities change
 * - onSeedRelationshipsChange: Callback when seed relationships change
 *
 * It focuses on visual placement and entity/relationship editing
 * without the schema management overhead (handled by Canonry).
 */

import React, { useMemo, useCallback } from 'react';
import SemanticPlaneEditor from './components/SemanticPlane/index.jsx';
import CultureEditor from './components/CultureEditor/index.jsx';
import EntityEditor from './components/EntityEditor/index.jsx';
import RelationshipEditor from './components/RelationshipEditor/index.jsx';
import AxisRegistryEditor from './components/AxisRegistry/index.jsx';

const TABS = [
  { id: 'axes', label: 'Axis Registry' },
  { id: 'planes', label: 'Semantic Planes' },
  { id: 'cultures', label: 'Culture Biases' },
  { id: 'entities', label: 'Entities' },
  { id: 'relationships', label: 'Relationships' },
];

// Arctic Blue Theme - Cosmographer uses frost blue accent
const ACCENT_GRADIENT = 'linear-gradient(135deg, #60a5fa 0%, #93c5fd 100%)';
const HOVER_BG = 'rgba(96, 165, 250, 0.15)';
const ACCENT_COLOR = '#60a5fa';

const styles = {
  container: {
    display: 'flex',
    height: '100%',
    backgroundColor: '#0a1929',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  sidebar: {
    width: '200px',
    backgroundColor: '#0c1f2e',
    borderRight: '1px solid rgba(59, 130, 246, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  nav: {
    padding: '12px',
  },
  navButton: {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    marginBottom: '4px',
    fontSize: '13px',
    fontWeight: 500,
    textAlign: 'left',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  navButtonInactive: {
    backgroundColor: 'transparent',
    color: '#93c5fd',
  },
  navButtonActive: {
    background: ACCENT_GRADIENT,
    color: '#0a1929',
    fontWeight: 600,
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
  },
  noSchema: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#60a5fa',
    textAlign: 'center',
    padding: '40px',
  },
  noSchemaTitle: {
    fontSize: '18px',
    fontWeight: 500,
    marginBottom: '8px',
    color: '#ffffff',
  },
};

export default function CosmographerRemote({
  schema,
  axisDefinitions,
  seedEntities,
  seedRelationships,
  onEntityKindsChange,
  onCulturesChange,
  onAxisDefinitionsChange,
  onTagRegistryChange,
  onSeedEntitiesChange,
  onSeedRelationshipsChange,
  onAddTag,
  activeSection,
  onSectionChange,
  schemaUsage,
}) {
  // Use passed-in section or default to 'axes'
  const activeTab = activeSection || 'axes';
  const setActiveTab = onSectionChange || (() => {});

  // Build internal project representation
  const project = useMemo(
    () => ({
      entityKinds: schema?.entityKinds || [],
      relationshipKinds: schema?.relationshipKinds || [],
      cultures: schema?.cultures || [],
      axisDefinitions: axisDefinitions || [],
      seedEntities: seedEntities || [],
      seedRelationships: seedRelationships || [],
      tagRegistry: schema?.tagRegistry || [],
    }),
    [schema, axisDefinitions, seedEntities, seedRelationships]
  );

  // Handle save - route updates to appropriate callbacks
  const handleSave = useCallback(
    (updates) => {
      if (updates.entityKinds && onEntityKindsChange) {
        onEntityKindsChange(updates.entityKinds);
      }

      // Handle seed entity changes
      if (updates.seedEntities && onSeedEntitiesChange) {
        onSeedEntitiesChange(updates.seedEntities);
      }

      // Handle seed relationship changes
      if (updates.seedRelationships && onSeedRelationshipsChange) {
        onSeedRelationshipsChange(updates.seedRelationships);
      }

      if (updates.cultures && onCulturesChange) {
        onCulturesChange(updates.cultures);
      }
    },
    [
      onEntityKindsChange,
      onCulturesChange,
      onSeedEntitiesChange,
      onSeedRelationshipsChange,
    ]
  );

  const hasSchema =
    schema?.entityKinds?.length > 0 || schema?.cultures?.length > 0;

  if (!hasSchema) {
    return (
      <div style={styles.container}>
        <div style={styles.noSchema}>
          <div style={styles.noSchemaTitle}>No Schema Defined</div>
          <div>
            Define entity kinds and cultures in the <strong>Enumerist</strong> tab
            first, then return here to place entities and manage relationships.
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'axes':
        return (
          <AxisRegistryEditor
            axisDefinitions={project.axisDefinitions}
            entityKinds={project.entityKinds}
            tagRegistry={project.tagRegistry}
            onAxisDefinitionsChange={onAxisDefinitionsChange}
            onTagRegistryChange={onTagRegistryChange}
          />
        );
      case 'planes':
        return (
          <SemanticPlaneEditor
            project={project}
            onSave={handleSave}
            axisDefinitions={project.axisDefinitions}
          />
        );
      case 'cultures':
        return <CultureEditor project={project} onSave={handleSave} />;
      case 'entities':
        return <EntityEditor project={project} onSave={handleSave} onAddTag={onAddTag} schemaUsage={schemaUsage} />;
      case 'relationships':
        return <RelationshipEditor project={project} onSave={handleSave} />;
      default:
        return null;
    }
  };

  return (
    <div style={styles.container}>
      {/* Left sidebar with nav */}
      <div style={styles.sidebar}>
        <nav style={styles.nav}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.navButton,
                ...(activeTab === tab.id
                  ? styles.navButtonActive
                  : styles.navButtonInactive),
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content area */}
      <div style={styles.main}>
        <div style={styles.content}>{renderContent()}</div>
      </div>
    </div>
  );
}
