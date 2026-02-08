import React, { Suspense, lazy } from 'react';
import RemotePlaceholder from './RemotePlaceholder.jsx';

const ArchivistRemote = lazy(() =>
  import('archivist/ArchivistRemote').catch(() => ({
    default: () => (
      <RemotePlaceholder
        name="Archivist"
        instructions="cd apps/archivist/webui && npm install && npm run dev"
      />
    ),
  }))
);

const styles = {
  container: {
    height: '100%',
    overflow: 'hidden',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#c4b99a',
    fontSize: '14px',
  },
};

const loadingFallback = React.createElement(
  'div',
  { style: styles.loading },
  'Loading Archivist...'
);

export default function ArchivistHost({ projectId, slotIndex, dexieSeededAt }) {
  return (
    <div style={styles.container}>
      <Suspense fallback={loadingFallback}>
        <ArchivistRemote
          projectId={projectId}
          activeSlotIndex={slotIndex}
          dexieSeededAt={dexieSeededAt}
        />
      </Suspense>
    </div>
  );
}
