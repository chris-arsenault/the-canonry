import { useEffect, useMemo, useState } from "react";
import type { WorldState } from "../types/world.ts";
import { buildWorldStateForSlot } from "@the-canonry/world-store";
import { IndexedDBBackend, useNarrativeStore } from "@the-canonry/narrative-store";
import { useAsyncAction } from "./useAsyncAction";

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
  const { busy, error: loadError, run } = useAsyncAction();
  const loading = !!busy;

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
    void run("load", async () => {
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      if (cancelled) return;
      try {
        const loaded = await buildWorldStateForSlot(projectId, activeSlotIndex);
        if (cancelled) return;
        setWorldDataState(loaded);
      } catch (err: unknown) {
        console.error("[ChroniclerRemote] Failed to load world data:", err);
        throw err;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeSlotIndex, dexieSeededAt, hasPreloadedWorld, projectId, run]);

  useEffect(() => {
    const store = useNarrativeStore.getState();
    store.configureBackend(narrativeBackend);
    if (store.simulationRunId !== simulationRunId) {
      store.setSimulationRunId(simulationRunId);
    }
  }, [narrativeBackend, simulationRunId]);

  return effective;
}
