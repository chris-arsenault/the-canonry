/**
 * CoherenceEngineHost - Loads and hosts the Coherence Engine remote module
 */

import React, { Suspense, lazy } from 'react';
import RemotePlaceholder from './RemotePlaceholder';
import { colors, typography } from '../theme';

// Lazy load the remote module
const CoherenceEngineRemote = lazy(() =>
  import('coherenceEngine/CoherenceEngineRemote').catch(() => ({
    default: () => (
      <RemotePlaceholder
        name="Coherence Engine"
        port={5003}
        instructions="cd apps/coherence-engine/webui && npm install && npm run dev"
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
  'Loading Coherence Engine...'
);

export default function CoherenceEngineHost({
  projectId,
  schema,
  eras,
  onErasChange,
  pressures,
  onPressuresChange,
  generators,
  onGeneratorsChange,
  actions,
  onActionsChange,
  systems,
  onSystemsChange,
  activeSection,
  onSectionChange,
}) {
  return (
    <div style={styles.container}>
      <Suspense fallback={loadingFallback}>
        <CoherenceEngineRemote
          projectId={projectId}
          schema={schema}
          eras={eras}
          onErasChange={onErasChange}
          pressures={pressures}
          onPressuresChange={onPressuresChange}
          generators={generators}
          onGeneratorsChange={onGeneratorsChange}
          actions={actions}
          onActionsChange={onActionsChange}
          systems={systems}
          onSystemsChange={onSystemsChange}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
        />
      </Suspense>
    </div>
  );
}
