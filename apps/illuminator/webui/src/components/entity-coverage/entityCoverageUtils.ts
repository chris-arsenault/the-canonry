/**
 * Pure utility functions for EntityCoveragePanel.
 * No JSX — these are used by multiple section components.
 */

import type { PersistedEntity, PersistedNarrativeEvent, PersistedRelationship } from "../../lib/db/illuminatorDb";
import type { ChronicleRecord } from "../../lib/chronicleTypes";
import type {
  FilterOption,
  CoreAnalysis,
  EntityUsageEntry,
  EraChronicleEntry,
  CultureRoleEntry,
  CultureEntityEntry,
} from "./entityCoverageTypes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PROMINENCE_LABELS = ["forgotten", "marginal", "recognized", "renowned", "mythic"];

export const SECTION_IDS = [
  "suggestions",
  "backrefs",
  "history",
  "culture",
  "events",
  "potential",
  "eras",
  "integration",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_LABELS: Record<SectionId, string> = {
  suggestions: "Chronicle Suggestions",
  backrefs: "Chronicle Backrefs per Entity",
  history: "Description History per Entity",
  culture: "Cultural Representation",
  events: "Rare Event Coverage",
  potential: "Untapped Story Potential",
  eras: "Era Coverage Gaps",
  integration: "Lore Integration Gaps",
};

export const SECTION_DESCRIPTIONS: Record<SectionId, string> = {
  suggestions:
    "Uncovered events by action type — expand to see involved entities, era, and significance",
  backrefs:
    "Backref links from entity descriptions to source chronicles, relative to prominence",
  history:
    "Description rewrites from lore backport vs. backref mentions — divergence signals shallow integration",
  culture:
    "Primary vs supporting role distribution by culture across chronicles",
  events:
    "High-significance events not yet selected for any chronicle",
  potential:
    "Story potential score vs actual chronicle usage — find underused narrative anchors",
  eras:
    "Chronicle distribution across eras — find underexplored time periods",
  integration:
    "Pipeline completeness — description, backrefs, history, historian notes, image",
};

export const PROMINENCE_OPTIONS: FilterOption[] = [
  { value: "all", label: "All prominence" },
  ...PROMINENCE_LABELS.map((l) => ({ value: l, label: l })),
];

// ---------------------------------------------------------------------------
// Prominence helpers
// ---------------------------------------------------------------------------

export function prominenceLabel(value: string | number | undefined | null): string {
  if (value == null || !Number.isFinite(Number(value))) return "unknown";
  const n = Number(value);
  if (n < 1) return "forgotten";
  if (n < 2) return "marginal";
  if (n < 3) return "recognized";
  if (n < 4) return "renowned";
  return "mythic";
}

export function expectedForProminence(value: string | number | undefined | null): number {
  const label = prominenceLabel(value);
  switch (label) {
    case "forgotten":
    case "marginal":
      return 0;
    case "recognized":
      return 1;
    case "renowned":
      return 2;
    case "mythic":
      return 3;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Event helpers
// ---------------------------------------------------------------------------

/** Strip entity-specific suffix from action: "kill_orca:The Sapphire League" -> "kill_orca" */
export function baseAction(raw: string | undefined): string {
  if (!raw) return "unknown";
  const idx = raw.indexOf(":");
  return idx > 0 ? raw.slice(0, idx) : raw;
}

/** Check if an event is purely a prominence side-effect */
function isProminenceOnly(event: PersistedNarrativeEvent): boolean {
  const effects = (event as Record<string, unknown>).participantEffects as
    | Array<{ effects?: Array<{ type?: string; field?: string }> }>
    | undefined;
  if (!effects || effects.length === 0) return false;
  for (const pe of effects) {
    for (const eff of pe.effects ?? []) {
      if (eff.type !== "field_changed" || eff.field !== "prominence") return false;
    }
  }
  return true;
}

/**
 * Compute group key for an event:
 * - creation_batch -> template name from causedBy.actionType
 * - prominence-only side-effects -> "prominence_change"
 * - everything else -> base action
 */
export function eventGroupKey(event: PersistedNarrativeEvent): string {
  const ev = event as Record<string, unknown>;
  const eventKind = ev.eventKind as string | undefined;
  const causedBy = ev.causedBy as { actionType?: string } | undefined;
  const action = ev.action as string | undefined;

  if (eventKind === "creation_batch" && causedBy?.actionType) {
    return causedBy.actionType;
  }
  if (isProminenceOnly(event)) {
    return "prominence_change";
  }
  return baseAction(action ?? eventKind) || "unknown";
}

// ---------------------------------------------------------------------------
// Option extractors for filter dropdowns
// ---------------------------------------------------------------------------

export function getKindOptions(entities: PersistedEntity[]): FilterOption[] {
  const kinds = new Set<string>();
  for (const e of entities) {
    if (e.kind && e.kind !== "era") kinds.add(e.kind);
  }
  return [
    { value: "all", label: "All kinds" },
    ...[...kinds].sort().map((k) => ({ value: k, label: k })),
  ];
}

export function getCultureOptions(entities: PersistedEntity[]): FilterOption[] {
  const cultures = new Set<string>();
  for (const e of entities) {
    if (e.culture) cultures.add(e.culture);
  }
  return [
    { value: "all", label: "All cultures" },
    ...[...cultures].sort().map((c) => ({ value: c, label: c })),
  ];
}

export function getEraOptions(events: PersistedNarrativeEvent[]): FilterOption[] {
  const eras = new Set<string>();
  for (const e of events) {
    const era = (e as Record<string, unknown>).era as string | undefined;
    if (era) eras.add(era);
  }
  return [
    { value: "all", label: "All eras" },
    ...[...eras].sort().map((e) => ({ value: e, label: e })),
  ];
}

export function getEventKindOptions(events: PersistedNarrativeEvent[]): FilterOption[] {
  const kinds = new Set<string>();
  for (const e of events) {
    const ek = (e as Record<string, unknown>).eventKind as string | undefined;
    if (ek) kinds.add(ek);
  }
  return [
    { value: "all", label: "All event kinds" },
    ...[...kinds].sort().map((k) => ({ value: k, label: k })),
  ];
}

// ---------------------------------------------------------------------------
// Core analysis computation
// ---------------------------------------------------------------------------

export function computeCoreAnalysis(
  entities: PersistedEntity[],
  chronicles: ChronicleRecord[],
  events: PersistedNarrativeEvent[],
  _relationships: PersistedRelationship[],
): CoreAnalysis {
  const nonEraEntities = entities.filter((e) => e.kind !== "era");
  const activeChronicles = chronicles.filter(
    (c) => (c as Record<string, unknown>).status !== "generating",
  );

  // Entity usage map
  const entityUsage = new Map<string, EntityUsageEntry>();
  for (const chronicle of activeChronicles) {
    const cr = chronicle as Record<string, unknown>;
    const roleAssignments = (cr.roleAssignments ?? []) as Array<{
      isPrimary?: boolean;
      entityId: string;
    }>;
    const primaryIds = new Set(
      roleAssignments.filter((r) => r.isPrimary).map((r) => r.entityId),
    );
    const selectedEntityIds = (cr.selectedEntityIds ?? []) as string[];
    for (const entityId of selectedEntityIds) {
      const existing = entityUsage.get(entityId) ?? {
        total: 0,
        primary: 0,
        supporting: 0,
        chronicleIds: [],
      };
      existing.total += 1;
      existing.chronicleIds.push(chronicle.chronicleId);
      if (primaryIds.has(entityId)) existing.primary += 1;
      else existing.supporting += 1;
      entityUsage.set(entityId, existing);
    }
  }

  // Event coverage map
  const eventCoverage = new Map<string, number>();
  for (const chronicle of activeChronicles) {
    const selectedEventIds =
      ((chronicle as Record<string, unknown>).selectedEventIds ?? []) as string[];
    for (const eventId of selectedEventIds) {
      eventCoverage.set(eventId, (eventCoverage.get(eventId) ?? 0) + 1);
    }
  }

  // Era chronicle map
  const eraChronicles = new Map<string, EraChronicleEntry>();
  for (const chronicle of activeChronicles) {
    const cr = chronicle as Record<string, unknown>;
    const temporal = cr.temporalContext as { focalEra?: { id?: string } } | undefined;
    const eraId = temporal?.focalEra?.id;
    if (!eraId) continue;
    const existing = eraChronicles.get(eraId) ?? { total: 0, completed: 0, backported: 0 };
    existing.total += 1;
    if (cr.status === "complete") existing.completed += 1;
    const backportStatus = cr.entityBackportStatus as Record<string, unknown> | undefined;
    if (backportStatus && Object.keys(backportStatus).length > 0) existing.backported += 1;
    eraChronicles.set(eraId, existing);
  }

  // Era entity counts
  const eraEntityCounts = new Map<string, number>();
  for (const entity of nonEraEntities) {
    const eraId = (entity as Record<string, unknown>).eraId as string | undefined;
    if (eraId) {
      eraEntityCounts.set(eraId, (eraEntityCounts.get(eraId) ?? 0) + 1);
    }
  }

  // Era event counts
  const eraEventCounts = new Map<string, number>();
  for (const event of events) {
    const era = (event as Record<string, unknown>).era as string | undefined;
    if (era) {
      eraEventCounts.set(era, (eraEventCounts.get(era) ?? 0) + 1);
    }
  }

  // Culture stats
  const cultureRoles = new Map<string, CultureRoleEntry>();
  for (const chronicle of activeChronicles) {
    const cr = chronicle as Record<string, unknown>;
    const roleAssignments = (cr.roleAssignments ?? []) as Array<{
      isPrimary?: boolean;
      entityId: string;
    }>;
    for (const role of roleAssignments) {
      const entity = nonEraEntities.find((e) => e.id === role.entityId);
      if (!entity?.culture) continue;
      const c = entity.culture;
      const existing = cultureRoles.get(c) ?? {
        primary: 0,
        supporting: 0,
        entityIds: new Set<string>(),
      };
      if (role.isPrimary) existing.primary += 1;
      else existing.supporting += 1;
      existing.entityIds.add(role.entityId);
      cultureRoles.set(c, existing);
    }
  }

  // Culture entity counts and avg prominence
  const cultureEntities = new Map<string, CultureEntityEntry>();
  for (const entity of nonEraEntities) {
    if (!entity.culture) continue;
    const existing = cultureEntities.get(entity.culture) ?? {
      count: 0,
      totalProminence: 0,
      entityIds: new Set<string>(),
    };
    existing.count += 1;
    existing.totalProminence += Number(entity.prominence) || 0;
    existing.entityIds.add(entity.id);
    cultureEntities.set(entity.culture, existing);
  }

  // Backported chronicle counts per entity
  const entityBackportedCount = new Map<string, number>();
  for (const chronicle of activeChronicles) {
    const cr = chronicle as Record<string, unknown>;
    const statusMap = cr.entityBackportStatus as Record<string, unknown> | undefined;
    if (!statusMap) continue;
    const selectedEntityIds = (cr.selectedEntityIds ?? []) as string[];
    for (const entityId of selectedEntityIds) {
      if (statusMap[entityId]) {
        entityBackportedCount.set(
          entityId,
          (entityBackportedCount.get(entityId) ?? 0) + 1,
        );
      }
    }
  }

  return {
    nonEraEntities,
    activeChronicles,
    entityUsage,
    eventCoverage,
    eraChronicles,
    eraEntityCounts,
    eraEventCounts,
    cultureRoles,
    cultureEntities,
    entityBackportedCount,
  };
}
