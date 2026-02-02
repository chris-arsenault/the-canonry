/**
 * ArchivistHost - Loads and hosts the Archivist remote module
 *
 * Displays world data from lore-weave simulation results.
 */

import React, { Suspense, lazy } from 'react';
import RemotePlaceholder from './RemotePlaceholder';
import { colors, typography } from '../theme';

// Lazy load the remote module
const ArchivistRemote = lazy(() =>
  import('archivist/ArchivistRemote').catch(() => ({
    default: () => (
      <RemotePlaceholder
        name="Archivist"
        port={5005}
        instructions="cd apps/archivist/webui && npm install && npm run dev"
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
  'Loading Archivist...'
);

export default function ArchivistHost({ worldData, loreData }) {
  return (
    <div style={styles.container}>
      <Suspense fallback={loadingFallback}>
        <ArchivistRemote
          worldData={worldData}
          loreData={loreData}
        />
      </Suspense>
    </div>
  );
}
