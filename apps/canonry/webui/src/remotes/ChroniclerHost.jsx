/**
 * ChroniclerHost - Loads and hosts the Chronicler remote module
 *
 * Wiki-style explorer for world content with long-form narratives.
 */

import React, { Suspense, lazy } from 'react';
import RemotePlaceholder from './RemotePlaceholder';
import { colors, typography } from '../theme';

// Lazy load the remote module
const ChroniclerRemote = lazy(() =>
  import('chronicler/ChroniclerRemote').catch(() => ({
    default: () => (
      <RemotePlaceholder
        name="Chronicler"
        port={5007}
        instructions="cd apps/chronicler/webui && npm install && npm run dev"
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
  'Loading Chronicler...'
);

export default function ChroniclerHost({
  projectId,
  worldData,
  loreData,
  requestedPageId,
  onRequestedPageConsumed,
}) {
  return (
    <div style={styles.container}>
      <Suspense fallback={loadingFallback}>
        <ChroniclerRemote
          projectId={projectId}
          worldData={worldData}
          loreData={loreData}
          requestedPageId={requestedPageId}
          onRequestedPageConsumed={onRequestedPageConsumed}
        />
      </Suspense>
    </div>
  );
}
