import { useCallback } from "react";
import { findEntityMentions } from "../../lib/wikiLinkService";
import { useChronicleStore } from "../../lib/db/chronicleStore";
import { getEntitiesForRun } from "../../lib/db/entityRepository";
import type { ChronicleRecord } from "../../lib/chronicleTypes";
import type { ResolvedVersion } from "./useVersionState";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWikiEntities(entities: Array<Record<string, unknown>>): Array<{ id: string; name: string }> {
  const wikiEntities: Array<{ id: string; name: string }> = [];
  for (const entity of entities) {
    if (entity.kind === "era") continue;
    wikiEntities.push({ id: entity.id as string, name: entity.name as string });
    const aliases = (entity.enrichment as Record<string, unknown>)?.text as Record<string, unknown> | undefined;
    const aliasList = aliases?.aliases;
    if (!Array.isArray(aliasList)) continue;
    for (const alias of aliasList) {
      if (typeof alias === "string" && alias.length >= 3) {
        wikiEntities.push({ id: entity.id as string, name: alias });
      }
    }
  }
  return wikiEntities;
}

function deduplicateMentions(
  mentions: Array<{ entityId: string; start: number; end: number }>,
  declaredIds: Set<string>,
  entityMap: Map<string, Record<string, unknown>>,
  content: string,
  prevDecisions: Map<string, boolean>
) {
  const seen = new Set<string>();
  const entries: Array<{
    entityId: string; name: string; kind: string;
    matchedAs: string; matchStart: number; matchEnd: number; accepted: boolean;
  }> = [];
  for (const m of mentions) {
    if (declaredIds.has(m.entityId) || seen.has(m.entityId)) continue;
    seen.add(m.entityId);
    const entity = entityMap.get(m.entityId);
    if (!entity) continue;
    entries.push({
      entityId: entity.id as string,
      name: entity.name as string,
      kind: entity.kind as string,
      matchedAs: content.slice(m.start, m.end),
      matchStart: m.start,
      matchEnd: m.end,
      accepted: prevDecisions.get(entity.id as string) ?? true,
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTertiaryCast(
  item: ChronicleRecord,
  simulationRunId: string | undefined,
  isComplete: boolean,
  selectedVersion: ResolvedVersion | undefined
) {
  const detectTertiaryCast = useCallback(async () => {
    if (!simulationRunId) return;
    const content = isComplete
      ? item.finalContent
      : selectedVersion?.content || item.assembledContent;
    if (!content) return;

    const freshEntities = await getEntitiesForRun(simulationRunId);
    const freshEntityMap = new Map(freshEntities.map((e) => [e.id, e]));

    const wikiEntities = buildWikiEntities(freshEntities);

    const mentions = findEntityMentions(content, wikiEntities);
    const declaredIds = new Set(item.selectedEntityIds || []);
    const prevDecisions = new Map(
      (item.tertiaryCast || []).map((e) => [e.entityId, e.accepted])
    );

    const entries = deduplicateMentions(mentions, declaredIds, freshEntityMap, content, prevDecisions);

    const { updateChronicleTertiaryCast } = await import("../../lib/db/chronicleRepository");
    await updateChronicleTertiaryCast(item.chronicleId, entries);
    await useChronicleStore.getState().refreshChronicle(item.chronicleId);
  }, [
    simulationRunId,
    isComplete,
    item.finalContent,
    item.assembledContent,
    item.selectedEntityIds,
    item.chronicleId,
    item.tertiaryCast,
    selectedVersion,
  ]);

  const toggleTertiaryCast = useCallback(
    async (entityId: string) => {
      const current = item.tertiaryCast || [];
      const updated = current.map((e) =>
        e.entityId === entityId ? { ...e, accepted: !e.accepted } : e
      );
      const { updateChronicleTertiaryCast } = await import("../../lib/db/chronicleRepository");
      await updateChronicleTertiaryCast(item.chronicleId, updated);
      await useChronicleStore.getState().refreshChronicle(item.chronicleId);
    },
    [item.chronicleId, item.tertiaryCast]
  );

  return { detectTertiaryCast, toggleTertiaryCast };
}
