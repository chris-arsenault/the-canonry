/**
 * useRevisionFlow - Hook for summary revision workflow
 *
 * Extracted from IlluminatorRemote. Contains:
 * - getEntityContextsForRevision: build rich entity context arrays for LLM
 * - handleRevisionApplied: apply revision patches to Dexie
 * - revisionFilter: modal state for filtering eligible entities
 * - handleOpenRevisionFilter: compute eligibility stats
 * - handleStartRevision: launch a batch revision
 * - handleAcceptRevision: accept and apply batch patches
 * - Delegates to useSummaryRevision for the actual batch orchestration
 *
 * Complex inner-map logic is extracted to module-level helpers.
 */

import { useState, useCallback } from "react";
import { useSummaryRevision } from "./useSummaryRevision";
import type { SummaryRevisionConfig } from "./useSummaryRevision";
import type { SummaryRevisionRun, SummaryRevisionPatch } from "../lib/summaryRevisionTypes";
import * as entityRepo from "../lib/db/entityRepository";
import { useEntityStore } from "../lib/db/entityStore";
import { getEntityUsageStats } from "../lib/db/chronicleRepository";
import { getPublishedStaticPagesForProject } from "../lib/db/staticPageRepository";
import { prominenceLabelFromScale } from "@canonry/world-schema";
import type { ProminenceScale, CanonrySchemaSlice, WorldRelationship } from "@canonry/world-schema";
import type { PersistedEntity } from "../lib/db/illuminatorDb";
import type { EntityNavItem } from "../lib/db/entityNav";
import type { EntityGuidance } from "../lib/promptBuilders";

// --- Types ---

interface WorldContextForRevision {
  worldDynamics?: Array<{
    text: string;
    cultures?: string[];
    kinds?: string[];
  }>;
  [key: string]: unknown;
}

interface RevisionContextParams {
  relationshipsByEntity: Map<string, WorldRelationship[]>;
  entityNavMap: Map<string, EntityNavItem>;
  prominenceScale: ProminenceScale;
  entityGuidance: EntityGuidance;
}

interface RevisionEntityParams {
  relationshipsByEntity: Map<string, WorldRelationship[]>;
  entityNavMap: Map<string, EntityNavItem>;
  prominenceScale: ProminenceScale;
}

interface RevisionFilterState {
  open: boolean;
  totalEligible: number;
  usedInChronicles: number;
  chronicleEntityIds: Set<string>;
}

interface BuildRevisionStartParams {
  projectId: string;
  simulationRunId: string;
  worldContext: WorldContextForRevision | null;
  worldSchema: CanonrySchemaSlice | null;
  navEntities: EntityNavItem[];
  entityNavMap: Map<string, EntityNavItem>;
  relationshipsByEntity: Map<string, WorldRelationship[]>;
  prominenceScale: ProminenceScale;
  excludeChronicleEntities: boolean;
  chronicleEntityIds: Set<string>;
  startRevision: (config: SummaryRevisionConfig) => Promise<void>;
}

export interface UseRevisionFlowParams {
  projectId: string | null;
  simulationRunId: string | undefined;
  navEntities: EntityNavItem[];
  entityNavMap: Map<string, EntityNavItem>;
  relationshipsByEntity: Map<string, WorldRelationship[]>;
  prominenceScale: ProminenceScale;
  worldContext: WorldContextForRevision | null;
  worldSchema: CanonrySchemaSlice | null;
  entityGuidance: EntityGuidance;
  reloadEntities: (invalidateIds?: string[]) => Promise<void>;
}

// --- Module-level helpers to reduce callback complexity ---

const buildSchemaContext = (schema: CanonrySchemaSlice | null): string => {
  if (!schema) return "";
  const sections = [];
  if (schema.entityKinds?.length) {
    sections.push("Entity Kinds: " + schema.entityKinds.map((k) => k.kind).join(", "));
  }
  if (schema.relationshipKinds?.length) {
    sections.push("Relationship Kinds: " + schema.relationshipKinds.map((k) => k.kind).join(", "));
  }
  if (schema.cultures?.length) {
    sections.push("Cultures: " + schema.cultures.map((c) => c.name || c.id).join(", "));
  }
  return sections.join("\n");
};

function buildRelationshipsForContext(
  entityId: string,
  relationshipsByEntity: Map<string, WorldRelationship[]>,
  entityNavMap: Map<string, EntityNavItem>,
) {
  return (relationshipsByEntity.get(entityId) || []).slice(0, 8).map((rel) => {
    const targetId = rel.src === entityId ? rel.dst : rel.src;
    const target = entityNavMap.get(targetId);
    return {
      kind: rel.kind,
      targetName: target?.name || targetId,
      targetKind: target?.kind || "unknown",
    };
  });
}

function resolveEntityDefaults(entity: PersistedEntity) {
  return {
    subtype: entity.subtype || "",
    culture: entity.culture || "",
    status: entity.status || "active",
    summary: entity.summary || "",
    description: entity.description || "",
    visualThesis: entity.enrichment?.text?.visualThesis || "",
  };
}

function resolveOptionalRevisionFields(entity: PersistedEntity, entityGuidance: EntityGuidance) {
  const result: Record<string, unknown> = {};
  const existingAnchorPhrases = (entity.enrichment?.chronicleBackrefs || [])
    .map((br) => br.anchorPhrase)
    .filter(Boolean);
  if (existingAnchorPhrases.length > 0) result.existingAnchorPhrases = existingAnchorPhrases;
  const kindFocus = entityGuidance[entity.kind]?.focus || "";
  if (kindFocus) result.kindFocus = kindFocus;
  return result;
}

function resolveAliases(entity: PersistedEntity): string[] {
  return (entity.enrichment?.text?.aliases || []).filter(
    (a) => typeof a === "string" && a.length >= 3
  );
}

function mapEntityToRevisionContext(entity: PersistedEntity, params: RevisionContextParams) {
  const { relationshipsByEntity, entityNavMap, prominenceScale, entityGuidance } = params;
  const defaults = resolveEntityDefaults(entity);
  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    ...defaults,
    prominence: prominenceLabelFromScale(entity.prominence, prominenceScale),
    relationships: buildRelationshipsForContext(entity.id, relationshipsByEntity, entityNavMap),
    aliases: resolveAliases(entity),
    ...resolveOptionalRevisionFields(entity, entityGuidance),
  };
}

function mapEntityToRevisionEntity(entity: PersistedEntity, params: RevisionEntityParams) {
  const { relationshipsByEntity, entityNavMap, prominenceScale } = params;
  const defaults = resolveEntityDefaults(entity);
  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    ...defaults,
    prominence: prominenceLabelFromScale(entity.prominence, prominenceScale),
    relationships: buildRelationshipsForContext(entity.id, relationshipsByEntity, entityNavMap),
  };
}

async function loadStaticPagesContext(projectId: string): Promise<string> {
  try {
    const pages = await getPublishedStaticPagesForProject(projectId);
    if (pages.length > 0) {
      return pages.map((p) => `## ${p.title}\n\n${p.content}`).join("\n\n---\n\n");
    }
  } catch (err) {
    console.warn("[Revision] Failed to load static pages:", err);
  }
  return "";
}

function buildDynamicsContext(worldContext: WorldContextForRevision | null): string {
  return (worldContext?.worldDynamics || [])
    .map((d) => {
      let text = d.text;
      if (d.cultures?.length) text += ` [cultures: ${d.cultures.join(", ")}]`;
      if (d.kinds?.length) text += ` [kinds: ${d.kinds.join(", ")}]`;
      return `- ${text}`;
    })
    .join("\n");
}

function filterEligibleIds(
  navEntities: EntityNavItem[],
  excludeChronicleEntities: boolean,
  chronicleEntityIds: Set<string>,
): string[] {
  return navEntities
    .filter((nav) => {
      if (!nav.hasDescription || nav.lockedSummary) return false;
      if (excludeChronicleEntities && chronicleEntityIds.has(nav.id)) return false;
      return true;
    })
    .map((nav) => nav.id);
}

async function buildRevisionStartPayload(params: BuildRevisionStartParams): Promise<void> {
  const {
    projectId,
    simulationRunId,
    worldContext,
    worldSchema,
    navEntities,
    entityNavMap,
    relationshipsByEntity,
    prominenceScale,
    excludeChronicleEntities,
    chronicleEntityIds,
    startRevision,
  } = params;

  const staticPagesContext = await loadStaticPagesContext(projectId);
  const dynamicsContext = buildDynamicsContext(worldContext);
  const schemaContext = buildSchemaContext(worldSchema);
  const eligibleIds = filterEligibleIds(navEntities, excludeChronicleEntities, chronicleEntityIds);
  const fullEntities = await useEntityStore.getState().loadEntities(eligibleIds);
  const mapParams = { relationshipsByEntity, entityNavMap, prominenceScale };
  const revisionEntities = fullEntities
    .filter((e) => e.summary && e.description)
    .map((e) => mapEntityToRevisionEntity(e, mapParams));

  startRevision({
    projectId,
    simulationRunId,
    worldDynamicsContext: dynamicsContext,
    staticPagesContext,
    schemaContext,
    revisionGuidance: "",
    entities: revisionEntities,
  });
}

// --- Main hook ---

export function useRevisionFlow({
  projectId,
  simulationRunId,
  navEntities,
  entityNavMap,
  relationshipsByEntity,
  prominenceScale,
  worldContext,
  worldSchema,
  entityGuidance,
  reloadEntities,
}: UseRevisionFlowParams) {
  const getEntityContextsForRevision = useCallback(
    async (entityIds: string[]) => {
      const fullEntities = await useEntityStore.getState().loadEntities(entityIds);
      const params = { relationshipsByEntity, entityNavMap, prominenceScale, entityGuidance };
      return fullEntities.map((entity) => mapEntityToRevisionContext(entity, params));
    },
    [entityNavMap, relationshipsByEntity, prominenceScale, entityGuidance]
  );

  const handleRevisionApplied = useCallback(
    async (patches: SummaryRevisionPatch[] | undefined, source = "summary-revision") => {
      if (!patches?.length) return;
      const updatedIds = await entityRepo.applyRevisionPatches(patches, source);
      await reloadEntities(updatedIds);
    },
    [reloadEntities]
  );

  const {
    run: revisionRun,
    isActive: isRevisionActive,
    startRevision,
    continueToNextBatch,
    autoContineAll: autoContineAllRevision,
    togglePatchDecision,
    applyAccepted: applyAcceptedPatches,
    cancelRevision,
  } = useSummaryRevision(getEntityContextsForRevision);

  const [revisionFilter, setRevisionFilter] = useState<RevisionFilterState>({
    open: false,
    totalEligible: 0,
    usedInChronicles: 0,
    chronicleEntityIds: new Set<string>(),
  });

  const handleOpenRevisionFilter = useCallback(async () => {
    if (!projectId || !simulationRunId) return;
    const eligible = navEntities.filter((e) => e.hasDescription && !e.lockedSummary);
    let chronicleEntityIds = new Set<string>();
    try {
      const usageStats = await getEntityUsageStats(simulationRunId);
      chronicleEntityIds = new Set(usageStats.keys());
    } catch (err) {
      console.warn("[Revision] Failed to load chronicle usage stats:", err);
    }
    const usedInChronicles = eligible.filter((e) => chronicleEntityIds.has(e.id)).length;
    setRevisionFilter({
      open: true,
      totalEligible: eligible.length,
      usedInChronicles,
      chronicleEntityIds,
    });
  }, [projectId, simulationRunId, navEntities]);

  const handleStartRevision = useCallback(
    async (excludeChronicleEntities: boolean) => {
      if (!projectId || !simulationRunId) return;
      setRevisionFilter((prev) => ({ ...prev, open: false }));
      await buildRevisionStartPayload({
        projectId,
        simulationRunId,
        worldContext,
        worldSchema,
        navEntities,
        entityNavMap,
        relationshipsByEntity,
        prominenceScale,
        excludeChronicleEntities,
        chronicleEntityIds: revisionFilter.chronicleEntityIds,
        startRevision,
      });
    },
    [
      projectId,
      simulationRunId,
      worldContext,
      worldSchema,
      navEntities,
      entityNavMap,
      relationshipsByEntity,
      prominenceScale,
      startRevision,
      revisionFilter.chronicleEntityIds,
    ]
  );

  const handleAcceptRevision = useCallback(() => {
    handleRevisionApplied(applyAcceptedPatches());
  }, [applyAcceptedPatches, handleRevisionApplied]);

  return {
    revisionRun,
    isRevisionActive,
    revisionFilter,
    setRevisionFilter,
    getEntityContextsForRevision,
    handleOpenRevisionFilter,
    handleStartRevision,
    handleAcceptRevision,
    continueToNextBatch,
    autoContineAllRevision,
    togglePatchDecision,
    cancelRevision,
    startRevision,
  };
}
