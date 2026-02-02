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
    color: '#93c5fd',
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
  worldData,
  loreData,
  chronicles,
  staticPages,
  requestedPageId,
  onRequestedPageConsumed,
  narrativeHistoryLoading,
}) {
  return (
    <div style={styles.container}>
      <Suspense fallback={loadingFallback}>
        <ChroniclerRemote
          projectId={projectId}
          worldData={worldData}
          loreData={loreData}
          chronicles={chronicles}
          staticPages={staticPages}
          requestedPageId={requestedPageId}
          onRequestedPageConsumed={onRequestedPageConsumed}
          narrativeHistoryLoading={narrativeHistoryLoading}
        />
      </Suspense>
    </div>
  );
}
