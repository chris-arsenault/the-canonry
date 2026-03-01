/**
 * Compute underutil counts for collapsed section headers.
 * Extracted to reduce complexity of the main EntityCoveragePanel component.
 */

import type { PersistedEntity, PersistedNarrativeEvent } from "../../lib/db/illuminatorDb";
import type { CoreAnalysis } from "./entityCoverageTypes";
import type { SectionId } from "./entityCoverageUtils";
import { expectedForProminence, eventGroupKey } from "./entityCoverageUtils";

export function computeUnderutilCounts(
  sectionIds: readonly SectionId[],
  expandedSections: Set<string>,
  fullEntities: PersistedEntity[],
  safeEvents: PersistedNarrativeEvent[],
  analysis: CoreAnalysis,
): Record<string, number | null> {
  const counts: Record<string, number | null> = {};

  for (const sectionId of sectionIds) {
    if (expandedSections.has(sectionId)) continue;
    counts[sectionId] = computeSingleCount(sectionId, fullEntities, safeEvents, analysis);
  }

  return counts;
}

function computeSingleCount(
  sectionId: SectionId,
  fullEntities: PersistedEntity[],
  safeEvents: PersistedNarrativeEvent[],
  analysis: CoreAnalysis,
): number | null {
  switch (sectionId) {
    case "suggestions":
      return computeSuggestionsCount(safeEvents, analysis);
    case "backrefs":
      return computeBackrefsCount(fullEntities);
    case "history":
      return computeHistoryCount(fullEntities);
    case "culture":
      return computeCultureCount(analysis);
    case "events":
      return computeEventsCount(safeEvents, analysis);
    case "potential":
      return null; // expensive, skip for collapsed
    case "eras":
      return computeErasCount(analysis);
    case "integration":
      return computeIntegrationCount(fullEntities);
  }
}

function computeSuggestionsCount(
  safeEvents: PersistedNarrativeEvent[],
  analysis: CoreAnalysis,
): number {
  const groupsWithUncovered = new Set<string>();
  for (const e of safeEvents) {
    if ((analysis.eventCoverage.get(e.id) ?? 0) <= 0) {
      groupsWithUncovered.add(eventGroupKey(e));
    }
  }
  return groupsWithUncovered.size;
}

function computeBackrefsCount(fullEntities: PersistedEntity[]): number {
  return fullEntities.filter((e) => {
    if (e.kind === "era") return false;
    const expected = expectedForProminence(e.prominence);
    if (expected === 0) return false;
    const enrichment = (e as Record<string, unknown>).enrichment as
      | { chronicleBackrefs?: unknown[] }
      | undefined;
    const count = enrichment?.chronicleBackrefs?.length ?? 0;
    return count / expected < 1;
  }).length;
}

function computeHistoryCount(fullEntities: PersistedEntity[]): number {
  return fullEntities.filter((e) => {
    if (e.kind === "era") return false;
    const enrichment = (e as Record<string, unknown>).enrichment as
      | { chronicleBackrefs?: unknown[]; descriptionHistory?: unknown[] }
      | undefined;
    return (
      (enrichment?.chronicleBackrefs?.length ?? 0) > 0 &&
      (enrichment?.descriptionHistory?.length ?? 0) === 0
    );
  }).length;
}

function computeCultureCount(analysis: CoreAnalysis): number {
  return [...(analysis.cultureEntities?.entries() ?? [])].filter(([, data]) => {
    if (data.count < 3) return false;
    let appeared = 0;
    for (const id of data.entityIds) {
      if (analysis.entityUsage.has(id)) appeared++;
    }
    return appeared / data.count < 0.3;
  }).length;
}

function computeEventsCount(
  safeEvents: PersistedNarrativeEvent[],
  analysis: CoreAnalysis,
): number {
  return safeEvents.filter((e) => {
    const ev = e as Record<string, unknown>;
    const significance = ev.significance as number;
    const participantEffects = (ev.participantEffects ?? []) as unknown[];
    return (
      significance >= 0.7 &&
      participantEffects.length >= 3 &&
      (analysis.eventCoverage.get(e.id) ?? 0) <= 0
    );
  }).length;
}

function computeErasCount(analysis: CoreAnalysis): number {
  const allEraIds = new Set([
    ...analysis.eraChronicles.keys(),
    ...analysis.eraEntityCounts.keys(),
    ...analysis.eraEventCounts.keys(),
  ]);
  return [...allEraIds].filter((eraId) => {
    return (
      (analysis.eraChronicles.get(eraId)?.total ?? 0) <= 0 &&
      ((analysis.eraEntityCounts.get(eraId) ?? 0) > 0 ||
        (analysis.eraEventCounts.get(eraId) ?? 0) > 0)
    );
  }).length;
}

function computeIntegrationCount(fullEntities: PersistedEntity[]): number {
  return fullEntities.filter((e) => {
    if (e.kind === "era") return false;
    if ((Number(e.prominence) || 0) < 2) return false;
    const enrichment = (e as Record<string, unknown>).enrichment as
      | {
          chronicleBackrefs?: unknown[];
          descriptionHistory?: unknown[];
          historianNotes?: unknown[];
          image?: { imageId?: string };
        }
      | undefined;
    let gaps = 0;
    if (!e.description) gaps++;
    if ((enrichment?.chronicleBackrefs?.length ?? 0) <= 0) gaps++;
    if ((enrichment?.descriptionHistory?.length ?? 0) <= 0) gaps++;
    if ((enrichment?.historianNotes?.length ?? 0) <= 0) gaps++;
    if (!enrichment?.image?.imageId) gaps++;
    return gaps >= 3;
  }).length;
}
