import { useState, useCallback, useEffect, useRef } from "react";
import type { EntityGuidance, CultureIdentities } from "../lib/promptBuilders";
import { createDefaultEntityGuidance, createDefaultCultureIdentities } from "../lib/promptBuilders";

// ============================================================================
// Types
// ============================================================================

export interface UseEntityGuidanceSyncProps {
  externalEntityGuidance?: EntityGuidance;
  onEntityGuidanceChange?: (guidance: EntityGuidance) => void;
  externalCultureIdentities?: CultureIdentities;
  onCultureIdentitiesChange?: (identities: CultureIdentities) => void;
}

export interface UseEntityGuidanceSyncReturn {
  entityGuidance: EntityGuidance;
  updateEntityGuidance: (nextGuidance: EntityGuidance) => void;
  cultureIdentities: CultureIdentities;
  updateCultureIdentities: (nextIdentities: CultureIdentities) => void;
}

// ============================================================================
// Hook
// ============================================================================

export default function useEntityGuidanceSync({
  externalEntityGuidance,
  onEntityGuidanceChange,
  externalCultureIdentities,
  onCultureIdentitiesChange,
}: UseEntityGuidanceSyncProps): UseEntityGuidanceSyncReturn {
  const [localEntityGuidance, setLocalEntityGuidance] = useState<EntityGuidance>(createDefaultEntityGuidance);
  const [localCultureIdentities, setLocalCultureIdentities] = useState<CultureIdentities>(
    createDefaultCultureIdentities
  );
  const pendingEntityGuidanceRef = useRef<EntityGuidance>(localEntityGuidance);
  const pendingCultureIdentitiesRef = useRef<CultureIdentities>(localCultureIdentities);

  // Detect external changes during render (no ref access)
  const [prevGuidance, setPrevGuidance] = useState<EntityGuidance | undefined>(externalEntityGuidance);
  if (externalEntityGuidance !== prevGuidance) {
    setPrevGuidance(externalEntityGuidance);
    if (externalEntityGuidance !== undefined) {
      setLocalEntityGuidance(externalEntityGuidance || createDefaultEntityGuidance());
    }
  }
  const [prevIdentities, setPrevIdentities] = useState<CultureIdentities | undefined>(externalCultureIdentities);
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

  const entityGuidanceSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateEntityGuidance = useCallback(
    (nextGuidance: EntityGuidance) => {
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

  const cultureIdentitiesSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateCultureIdentities = useCallback(
    (nextIdentities: CultureIdentities) => {
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
