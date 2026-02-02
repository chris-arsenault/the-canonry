/**
 * CosmographerHost - Loads and hosts the Cosmographer remote module
 */

import React, { Suspense, lazy } from 'react';
import RemotePlaceholder from './RemotePlaceholder';
import { colors, typography } from '../theme';

// Lazy load the remote module
// This will be replaced with actual federation import once cosmographer exposes the remote
const CosmographerRemote = lazy(() =>
  import('cosmographer/CosmographerRemote').catch(() => ({
    default: () => (
      <RemotePlaceholder
        name="Cosmographer"
        port={5002}
        instructions="cd apps/cosmographer/webui && npm run dev"
      />
    ),
  }))
);

const styles = {
  container: {
    height: '100%',
    overflow: 'auto',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: colors.textMuted,
    fontSize: typography.sizeLg,
    fontFamily: typography.fontFamily,
  },
};

const loadingFallback = React.createElement(
  'div',
  { style: styles.loading },
  'Loading Cosmographer...'
);

export default function CosmographerHost({
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
  return (
    <div style={styles.container}>
      <Suspense fallback={loadingFallback}>
        <CosmographerRemote
          schema={schema}
          axisDefinitions={axisDefinitions}
          seedEntities={seedEntities}
          seedRelationships={seedRelationships}
          onEntityKindsChange={onEntityKindsChange}
          onCulturesChange={onCulturesChange}
          onAxisDefinitionsChange={onAxisDefinitionsChange}
          onTagRegistryChange={onTagRegistryChange}
          onSeedEntitiesChange={onSeedEntitiesChange}
          onSeedRelationshipsChange={onSeedRelationshipsChange}
          onAddTag={onAddTag}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          schemaUsage={schemaUsage}
        />
      </Suspense>
    </div>
  );
}
