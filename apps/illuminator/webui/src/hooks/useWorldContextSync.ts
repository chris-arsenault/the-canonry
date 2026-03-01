import { useState, useCallback, useEffect, useRef } from "react";

// ============================================================================
// Types
// ============================================================================

export interface LocalWorldContext {
  name: string;
  description: string;
  toneFragments: { core: string; [key: string]: string };
  canonFactsWithMetadata: Array<{ text: string; [key: string]: unknown }>;
  factSelection: Record<string, unknown>;
  worldDynamics: Array<{ text: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface UseWorldContextSyncProps {
  externalWorldContext?: LocalWorldContext;
  onWorldContextChange?: (context: LocalWorldContext) => void;
}

export interface UseWorldContextSyncReturn {
  worldContext: LocalWorldContext;
  updateWorldContext: (updates: Partial<LocalWorldContext>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WORLD_CONTEXT: LocalWorldContext = {
  name: "",
  description: "",
  toneFragments: { core: "" },
  canonFactsWithMetadata: [],
  factSelection: {},
  worldDynamics: [],
};

// ============================================================================
// Hook
// ============================================================================

export default function useWorldContextSync({ externalWorldContext, onWorldContextChange }: UseWorldContextSyncProps): UseWorldContextSyncReturn {
  const [localWorldContext, setLocalWorldContext] = useState<LocalWorldContext>(DEFAULT_WORLD_CONTEXT);
  const worldContext = localWorldContext;
  const worldContextSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const worldContextDirtyRef = useRef<boolean>(false);
  const pendingWorldContextRef = useRef<LocalWorldContext>(localWorldContext);

  // Detect external context changes during render (no ref access)
  const [prevExternalContext, setPrevExternalContext] = useState<LocalWorldContext | undefined>(externalWorldContext);
  if (externalWorldContext !== prevExternalContext) {
    setPrevExternalContext(externalWorldContext);
    if (externalWorldContext !== undefined) {
      const nextContext = externalWorldContext || DEFAULT_WORLD_CONTEXT;
      setLocalWorldContext(nextContext);
    }
  }

  // Ref side effects when external changes (clear timeout, update refs)
  useEffect(() => {
    if (externalWorldContext === undefined) return;
    if (worldContextSyncTimeoutRef.current) {
      clearTimeout(worldContextSyncTimeoutRef.current);
      worldContextSyncTimeoutRef.current = null;
    }
    worldContextDirtyRef.current = false;
    pendingWorldContextRef.current = externalWorldContext || DEFAULT_WORLD_CONTEXT;
  }, [externalWorldContext]);

  const updateWorldContext = useCallback(
    (updates: Partial<LocalWorldContext>) => {
      setLocalWorldContext((prev: LocalWorldContext) => {
        const merged = { ...prev, ...updates };
        pendingWorldContextRef.current = merged;
        if (onWorldContextChange) {
          worldContextDirtyRef.current = true;
          if (worldContextSyncTimeoutRef.current) {
            clearTimeout(worldContextSyncTimeoutRef.current);
          }
          worldContextSyncTimeoutRef.current = setTimeout(() => {
            if (!worldContextDirtyRef.current) return;
            worldContextDirtyRef.current = false;
            onWorldContextChange(pendingWorldContextRef.current);
            worldContextSyncTimeoutRef.current = null;
          }, 300);
        }
        return merged;
      });
    },
    [onWorldContextChange]
  );

  useEffect(() => {
    return () => {
      if (worldContextSyncTimeoutRef.current) {
        clearTimeout(worldContextSyncTimeoutRef.current);
        worldContextSyncTimeoutRef.current = null;
      }
      if (worldContextDirtyRef.current && onWorldContextChange) {
        onWorldContextChange(pendingWorldContextRef.current);
      }
    };
  }, [onWorldContextChange]);

  return { worldContext, updateWorldContext };
}
