/**
 * ChroniclerRemote - MFE entry point for Chronicler
 *
 * Wiki-style explorer for world content with long-form narratives,
 * cross-linking, and MediaWiki-inspired navigation.
 *
 * Loads world data from the shared Dexie store.
 */

import { useEffect, useMemo, useState } from 'react';
import './styles/variables.css';
import WikiExplorer from './components/WikiExplorer.tsx';
import type { WorldState, SerializedPageIndex } from './types/world.ts';
import { buildWorldStateForSlot } from '@penguin-tales/world-store';
import { IndexedDBBackend, useNarrativeStore } from '@penguin-tales/narrative-store';
import type { ChronicleRecord } from './lib/chronicleStorage.ts';
import type { StaticPage } from './lib/staticPageStorage.ts';

export interface ChroniclerRemoteProps {
  projectId?: string;
  activeSlotIndex?: number;
  /** Timestamp updated when Dexie ingestion completes (viewer). */
  dexieSeededAt?: number;
  /** Page ID requested by external navigation */
  requestedPageId?: string | null;
  /** Callback to signal that the requested page has been consumed */
  onRequestedPageConsumed?: () => void;
  /** Pre-loaded world data — skips IndexedDB read when provided (viewer context) */
  preloadedWorldData?: WorldState | null;
  /** Pre-loaded chronicles — skips IndexedDB read when provided (viewer context) */
  preloadedChronicles?: ChronicleRecord[];
  /** Pre-loaded static pages — skips IndexedDB read when provided (viewer context) */
  preloadedStaticPages?: StaticPage[];
  /** Pre-baked parchment tile URL — skips runtime canvas pipeline when provided */
  prebakedParchmentUrl?: string;
  /** Pre-computed page index — skips buildPageIndex on mount when provided */
  precomputedPageIndex?: SerializedPageIndex;
}

export default function ChroniclerRemote({
  projectId,
  activeSlotIndex = 0,
  dexieSeededAt,
  requestedPageId,
  onRequestedPageConsumed,
  preloadedWorldData,
  preloadedChronicles,
  preloadedStaticPages,
  prebakedParchmentUrl,
  precomputedPageIndex,
}: ChroniclerRemoteProps) {
  const [worldDataState, setWorldDataState] = useState<WorldState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const narrativeBackend = useMemo(() => new IndexedDBBackend(), []);
  const hasPreloadedWorld = preloadedWorldData !== undefined;
  const effectiveWorldData = projectId ? (hasPreloadedWorld ? preloadedWorldData : worldDataState) : null;
  const effectiveLoading = projectId ? (hasPreloadedWorld ? false : loading) : false;
  const effectiveLoadError = projectId ? (hasPreloadedWorld ? null : loadError) : null;
  const simulationRunId = effectiveWorldData?.metadata?.simulationRunId ?? null;

  // Load world data from IndexedDB when no preloaded data is provided (Canonry shell context)
  useEffect(() => {
    if (hasPreloadedWorld) return;
    if (!projectId) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setLoadError(null);
    });

    buildWorldStateForSlot(projectId, activeSlotIndex)
      .then((loaded) => {
        if (cancelled) return;
        setWorldDataState(loaded);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[ChroniclerRemote] Failed to load world data:', err);
        setWorldDataState(null);
        setLoadError(err?.message || 'Failed to load world data from Dexie.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSlotIndex, dexieSeededAt, hasPreloadedWorld, projectId]);

  useEffect(() => {
    const store = useNarrativeStore.getState();
    store.configureBackend(narrativeBackend);
    if (store.simulationRunId !== simulationRunId) {
      store.setSimulationRunId(simulationRunId);
    }
  }, [narrativeBackend, simulationRunId]);

  if (effectiveLoading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-bg-primary, #352a1e)',
          color: 'var(--color-text-muted, #8a7d6b)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', color: 'var(--color-text-primary, #e8dcc8)', marginBottom: '8px', fontFamily: '"Playfair Display", Georgia, serif' }}>
            Loading World Data
          </div>
          <div style={{ fontSize: '14px' }}>
            Reading from local storage...
          </div>
        </div>
      </div>
    );
  }

  if (effectiveLoadError) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-bg-primary, #352a1e)',
          color: 'var(--color-text-muted, #8a7d6b)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#x2756;</div>
          <div style={{ fontSize: '18px', color: 'var(--color-text-primary, #e8dcc8)', marginBottom: '8px', fontFamily: '"Playfair Display", Georgia, serif' }}>
            World Data Unavailable
          </div>
          <div style={{ fontSize: '14px' }}>
            {effectiveLoadError}
          </div>
        </div>
      </div>
    );
  }

  if (!effectiveWorldData) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-bg-primary, #352a1e)',
          color: 'var(--color-text-muted, #8a7d6b)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#x2756;</div>
          <div style={{ fontSize: '18px', color: 'var(--color-text-primary, #e8dcc8)', marginBottom: '8px', fontFamily: '"Playfair Display", Georgia, serif' }}>
            No World Data
          </div>
          <div style={{ fontSize: '14px' }}>
            Run a simulation in Lore Weave and enrich it with Illuminator to view the world chronicle.
          </div>
        </div>
      </div>
    );
  }

  return (
    <WikiExplorer
      projectId={projectId}
      worldData={effectiveWorldData}
      loreData={null}
      requestedPageId={requestedPageId}
      onRequestedPageConsumed={onRequestedPageConsumed}
      preloadedChronicles={preloadedChronicles}
      preloadedStaticPages={preloadedStaticPages}
      prebakedParchmentUrl={prebakedParchmentUrl}
      precomputedPageIndex={precomputedPageIndex}
    />
  );
}
