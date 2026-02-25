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
import * as entityRepo from "../lib/db/entityRepository";
import { useEntityStore } from "../lib/db/entityStore";
import { getEntityUsageStats } from "../lib/db/chronicleRepository";
import { getPublishedStaticPagesForProject } from "../lib/db/staticPageRepository";
import { prominenceLabelFromScale } from "@canonry/world-schema";

// --- Module-level helpers to reduce callback complexity ---

const buildSchemaContext = (schema) => {
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

function buildRelationshipsForContext(entityId, relationshipsByEntity, entityNavMap) {
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

function resolveEntityDefaults(entity) {
  return {
    subtype: entity.subtype || "",
    culture: entity.culture || "",
    status: entity.status || "active",
    summary: entity.summary || "",
    description: entity.description || "",
    visualThesis: entity.enrichment?.text?.visualThesis || "",
  };
}

function resolveOptionalRevisionFields(entity, entityGuidance) {
  const result = {};
  const existingAnchorPhrases = (entity.enrichment?.chronicleBackrefs || [])
    .map((br) => br.anchorPhrase)
    .filter(Boolean);
  if (existingAnchorPhrases.length > 0) result.existingAnchorPhrases = existingAnchorPhrases;
  const kindFocus = entityGuidance[entity.kind]?.focus || "";
  if (kindFocus) result.kindFocus = kindFocus;
  return result;
}

function resolveAliases(entity) {
  return (entity.enrichment?.text?.aliases || []).filter(
    (a) => typeof a === "string" && a.length >= 3
  );
}

function mapEntityToRevisionContext(entity, params) {
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

function mapEntityToRevisionEntity(entity, params) {
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

async function loadStaticPagesContext(projectId) {
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

function buildDynamicsContext(worldContext) {
  return (worldContext?.worldDynamics || [])
    .map((d) => {
      let text = d.text;
      if (d.cultures?.length) text += ` [cultures: ${d.cultures.join(", ")}]`;
      if (d.kinds?.length) text += ` [kinds: ${d.kinds.join(", ")}]`;
      return `- ${text}`;
    })
    .join("\n");
}

function filterEligibleIds(navEntities, excludeChronicleEntities, chronicleEntityIds) {
  return navEntities
    .filter((nav) => {
      if (!nav.hasDescription || nav.lockedSummary) return false;
      if (excludeChronicleEntities && chronicleEntityIds.has(nav.id)) return false;
      return true;
    })
    .map((nav) => nav.id);
}

async function buildRevisionStartPayload(params) {
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
}) {
  const getEntityContextsForRevision = useCallback(
    async (entityIds) => {
      const fullEntities = await useEntityStore.getState().loadEntities(entityIds);
      const params = { relationshipsByEntity, entityNavMap, prominenceScale, entityGuidance };
      return fullEntities.map((entity) => mapEntityToRevisionContext(entity, params));
    },
    [entityNavMap, relationshipsByEntity, prominenceScale, entityGuidance]
  );

  const handleRevisionApplied = useCallback(
    async (patches, source = "summary-revision") => {
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

  const [revisionFilter, setRevisionFilter] = useState({
    open: false,
    totalEligible: 0,
    usedInChronicles: 0,
    chronicleEntityIds: new Set(),
  });

  const handleOpenRevisionFilter = useCallback(async () => {
    if (!projectId || !simulationRunId) return;
    const eligible = navEntities.filter((e) => e.hasDescription && !e.lockedSummary);
    let chronicleEntityIds = new Set();
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
    async (excludeChronicleEntities) => {
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
