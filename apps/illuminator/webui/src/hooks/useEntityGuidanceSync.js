import { useState, useCallback, useEffect, useRef } from "react";
import { createDefaultEntityGuidance, createDefaultCultureIdentities } from "../lib/promptBuilders";

export default function useEntityGuidanceSync({
  externalEntityGuidance,
  onEntityGuidanceChange,
  externalCultureIdentities,
  onCultureIdentitiesChange,
}) {
  const [localEntityGuidance, setLocalEntityGuidance] = useState(createDefaultEntityGuidance);
  const [localCultureIdentities, setLocalCultureIdentities] = useState(
    createDefaultCultureIdentities
  );
  const pendingEntityGuidanceRef = useRef(localEntityGuidance);
  const pendingCultureIdentitiesRef = useRef(localCultureIdentities);

  // Detect external changes during render (no ref access)
  const [prevGuidance, setPrevGuidance] = useState(externalEntityGuidance);
  if (externalEntityGuidance !== prevGuidance) {
    setPrevGuidance(externalEntityGuidance);
    if (externalEntityGuidance !== undefined) {
      setLocalEntityGuidance(externalEntityGuidance || createDefaultEntityGuidance());
    }
  }
  const [prevIdentities, setPrevIdentities] = useState(externalCultureIdentities);
  if (externalCultureIdentities !== prevIdentities) {
    setPrevIdentities(externalCultureIdentities);
    if (externalCultureIdentities !== undefined) {
      setLocalCultureIdentities(externalCultureIdentities || createDefaultCultureIdentities());
    }
  }

  // Sync refs in effects
  useEffect(() => {
    if (externalEntityGuidance !== undefined) {
      pendingEntityGuidanceRef.current = externalEntityGuidance || createDefaultEntityGuidance();
    }
  }, [externalEntityGuidance]);
  useEffect(() => {
    if (externalCultureIdentities !== undefined) {
      pendingCultureIdentitiesRef.current =
        externalCultureIdentities || createDefaultCultureIdentities();
    }
  }, [externalCultureIdentities]);

  const entityGuidanceSyncTimeoutRef = useRef(null);
  const updateEntityGuidance = useCallback(
    (nextGuidance) => {
      setLocalEntityGuidance(nextGuidance);
      pendingEntityGuidanceRef.current = nextGuidance;
      if (!onEntityGuidanceChange) return;
      if (entityGuidanceSyncTimeoutRef.current) clearTimeout(entityGuidanceSyncTimeoutRef.current);
      entityGuidanceSyncTimeoutRef.current = setTimeout(() => {
        onEntityGuidanceChange(pendingEntityGuidanceRef.current);
        entityGuidanceSyncTimeoutRef.current = null;
      }, 300);
    },
    [onEntityGuidanceChange]
  );

  const cultureIdentitiesSyncTimeoutRef = useRef(null);
  const updateCultureIdentities = useCallback(
    (nextIdentities) => {
      setLocalCultureIdentities(nextIdentities);
      pendingCultureIdentitiesRef.current = nextIdentities;
      if (!onCultureIdentitiesChange) return;
      if (cultureIdentitiesSyncTimeoutRef.current)
        clearTimeout(cultureIdentitiesSyncTimeoutRef.current);
      cultureIdentitiesSyncTimeoutRef.current = setTimeout(() => {
        onCultureIdentitiesChange(pendingCultureIdentitiesRef.current);
        cultureIdentitiesSyncTimeoutRef.current = null;
      }, 300);
    },
    [onCultureIdentitiesChange]
  );

  useEffect(
    () => () => {
      if (entityGuidanceSyncTimeoutRef.current) clearTimeout(entityGuidanceSyncTimeoutRef.current);
      if (cultureIdentitiesSyncTimeoutRef.current)
        clearTimeout(cultureIdentitiesSyncTimeoutRef.current);
    },
    []
  );

  return {
    entityGuidance: localEntityGuidance,
    updateEntityGuidance,
    cultureIdentities: localCultureIdentities,
    updateCultureIdentities,
  };
}
