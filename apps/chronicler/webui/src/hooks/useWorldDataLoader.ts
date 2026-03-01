import { useEffect, useMemo, useState } from "react";
import type { WorldState } from "../types/world.ts";
import { buildWorldStateForSlot } from "@the-canonry/world-store";
import { IndexedDBBackend, useNarrativeStore } from "@the-canonry/narrative-store";

interface WorldDataLoaderOptions {
  projectId?: string;
  activeSlotIndex: number;
  dexieSeededAt?: number;
  preloadedWorldData?: WorldState | null;
}

interface WorldDataLoaderResult {
  worldData: WorldState | null;
  loading: boolean;
  loadError: string | null;
}

function resolveEffectiveState(
  projectId: string | undefined,
  hasPreloadedWorld: boolean,
  preloadedWorldData: WorldState | null | undefined,
  worldDataState: WorldState | null,
  loading: boolean,
  loadError: string | null
): WorldDataLoaderResult {
  if (!projectId) {
    return { worldData: null, loading: false, loadError: null };
  }
  if (hasPreloadedWorld) {
    return { worldData: preloadedWorldData ?? null, loading: false, loadError: null };
  }
  return { worldData: worldDataState, loading, loadError };
}

export default function useWorldDataLoader({
  projectId,
  activeSlotIndex,
  dexieSeededAt,
  preloadedWorldData,
}: WorldDataLoaderOptions): WorldDataLoaderResult {
  const [worldDataState, setWorldDataState] = useState<WorldState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const narrativeBackend = useMemo(() => new IndexedDBBackend(), []);
  const hasPreloadedWorld = preloadedWorldData !== undefined;

  const effective = resolveEffectiveState(
    projectId,
    hasPreloadedWorld,
    preloadedWorldData,
    worldDataState,
    loading,
    loadError
  );
  const simulationRunId = effective.worldData?.metadata?.simulationRunId ?? null;

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
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("[ChroniclerRemote] Failed to load world data:", err);
        setWorldDataState(null);
        setLoadError(err instanceof Error ? err.message : "Failed to load world data from Dexie.");
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

  return effective;
}
