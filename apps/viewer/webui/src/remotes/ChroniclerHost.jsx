import React, { Suspense, lazy } from 'react';
import RemotePlaceholder from './RemotePlaceholder.jsx';

const ChroniclerRemote = lazy(() =>
  import('chronicler/ChroniclerRemote').catch(() => ({
    default: () => (
      <RemotePlaceholder
        name="Chronicler"
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
    color: '#c4b99a',
    fontSize: '14px',
  },
};

const loadingFallback = React.createElement(
  'div',
  { style: styles.loading },
  'Loading Chronicler...'
);

export default function ChroniclerHost({
  projectId,
  slotIndex,
  requestedPageId,
  onRequestedPageConsumed,
  dexieSeededAt,
}) {
  return (
    <div style={styles.container}>
      <Suspense fallback={loadingFallback}>
        <ChroniclerRemote
          projectId={projectId}
          activeSlotIndex={slotIndex}
          requestedPageId={requestedPageId}
          onRequestedPageConsumed={onRequestedPageConsumed}
          dexieSeededAt={dexieSeededAt}
        />
      </Suspense>
    </div>
  );
}
