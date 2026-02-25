import { useState, useCallback, useEffect, useRef } from "react";

const DEFAULT_WORLD_CONTEXT = {
  name: "",
  description: "",
  toneFragments: { core: "" },
  canonFactsWithMetadata: [],
  factSelection: {},
  worldDynamics: [],
};

export default function useWorldContextSync({ externalWorldContext, onWorldContextChange }) {
  const [localWorldContext, setLocalWorldContext] = useState(DEFAULT_WORLD_CONTEXT);
  const worldContext = localWorldContext;
  const worldContextSyncTimeoutRef = useRef(null);
  const worldContextDirtyRef = useRef(false);
  const pendingWorldContextRef = useRef(localWorldContext);

  // Detect external context changes during render (no ref access)
  const [prevExternalContext, setPrevExternalContext] = useState(externalWorldContext);
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
    (updates) => {
      setLocalWorldContext((prev) => {
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
