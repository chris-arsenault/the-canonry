import { useState, useEffect } from "react";
import * as slotRepo from "../lib/db/slotRepository";
import { useEntityStore } from "../lib/db/entityStore";
import { useIndexStore } from "../lib/db/indexStore";
import { useNarrativeEventStore } from "../lib/db/narrativeEventStore";
import { useRelationshipStore } from "../lib/db/relationshipStore";
import {
  useEraTemporalInfo,
  useEraTemporalInfoByKey,
  useProminentByCulture,
} from "../lib/db/indexSelectors";

function resolveCurrentEra(slotRecord, navEntities) {
  const eraId = slotRecord?.finalEraId;
  if (!eraId) return { era: null, needsFullLoad: null };
  const eraNav = navEntities.find(
    (entity) =>
      entity.kind === "era" &&
      (entity.id === eraId || entity.eraId === eraId || entity.name === eraId)
  );
  if (!eraNav) return { era: { name: eraId }, needsFullLoad: null };
  return { era: null, needsFullLoad: eraNav.id };
}

function resolveEraRenderAdjustment(slotRecord, navEntities) {
  const resolved = resolveCurrentEra(slotRecord, navEntities);
  if (resolved.era !== undefined && resolved.needsFullLoad === null) {
    return { changed: true, era: resolved.era };
  }
  return { changed: false };
}

function buildEraFromLoadedEntity(full, fallbackId) {
  return full ? { name: full.name, description: full.description } : { name: fallbackId };
}

function resolveProjectSlotChange(projectId, prevProjectSlot, activeSlotIndex) {
  if (
    projectId !== prevProjectSlot.projectId ||
    activeSlotIndex !== prevProjectSlot.activeSlotIndex
  ) {
    if (!projectId) {
      return { changed: true, clearSlot: true };
    }
    return { changed: true, clearSlot: false };
  }
  return { changed: false };
}

export default function useSlotManagement({ projectId, activeSlotIndex, navEntities }) {
  const [slotRecord, setSlotRecord] = useState(null);

  // Adjust state during render when projectId changes (avoids setState-in-effect)
  const [prevProjectSlot, setPrevProjectSlot] = useState({ projectId, activeSlotIndex });
  const projectSlotChange = resolveProjectSlotChange(projectId, prevProjectSlot, activeSlotIndex);
  if (projectSlotChange.changed) {
    setPrevProjectSlot({ projectId, activeSlotIndex });
    if (projectSlotChange.clearSlot) setSlotRecord(null);
  }

  // Load slot metadata from Dexie (async work stays in effect)
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    (async () => {
      const slot = await slotRepo.getSlot(projectId, activeSlotIndex);
      if (cancelled) return;
      setSlotRecord(slot || null);
      useEntityStore.getState().reset();
      useIndexStore.getState().reset();
      useNarrativeEventStore.getState().reset();
      useRelationshipStore.getState().reset();
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, activeSlotIndex]);

  const [currentEra, setCurrentEra] = useState(null);

  // Adjust current era during render for synchronous cases
  const [prevEraKey, setPrevEraKey] = useState(slotRecord?.finalEraId);
  const currentEraId = slotRecord?.finalEraId;
  if (currentEraId !== prevEraKey) {
    setPrevEraKey(currentEraId);
    const result = resolveEraRenderAdjustment(slotRecord, navEntities);
    if (result.changed) setCurrentEra(result.era);
  }

  // Async full-entity load for era (when we have a nav match but need description)
  useEffect(() => {
    const resolved = resolveCurrentEra(slotRecord, navEntities);
    if (!resolved.needsFullLoad) return;
    useEntityStore
      .getState()
      .loadEntity(resolved.needsFullLoad)
      .then((full) => {
        setCurrentEra(buildEraFromLoadedEntity(full, resolved.needsFullLoad));
      });
  }, [slotRecord, navEntities]);

  const eraTemporalInfo = useEraTemporalInfo();
  const eraTemporalInfoByKey = useEraTemporalInfoByKey();
  const prominentByCulture = useProminentByCulture();

  // Extract simulationRunId from slot metadata for content association
  const simulationRunId = slotRecord?.simulationRunId;

  return {
    slotRecord,
    setSlotRecord,
    simulationRunId,
    currentEra,
    eraTemporalInfo,
    eraTemporalInfoByKey,
    prominentByCulture,
  };
}
