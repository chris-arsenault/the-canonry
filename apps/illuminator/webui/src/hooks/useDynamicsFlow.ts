/**
 * useDynamicsFlow - Hook for world dynamics generation workflow
 *
 * Extracted from IlluminatorRemote. Contains:
 * - handleDynamicsAccepted: merge proposed dynamics into worldContext
 * - handleGenerateDynamics: launch dynamics generation with full context
 * - Delegates to useDynamicsGeneration for the LLM multi-turn flow
 */

import { useCallback } from "react";
import { useDynamicsGeneration } from "./useDynamicsGeneration";
import type { DynamicsRun, ProposedDynamic } from "../lib/dynamicsGenerationTypes";
import * as entityRepo from "../lib/db/entityRepository";
import { getPublishedStaticPagesForProject } from "../lib/db/staticPageRepository";
import type { CanonrySchemaSlice, WorldRelationship } from "@canonry/world-schema";
import type { PersistedEntity } from "../lib/db/illuminatorDb";
import type { EntityNavItem } from "../lib/db/entityNav";

// --- Types ---

interface WorldContextForDynamics {
  worldDynamics?: Array<{
    id: string;
    text: string;
    cultures?: string[];
    kinds?: string[];
    eraOverrides?: Record<string, unknown>;
  }>;
  [key: string]: unknown;
}

export interface UseDynamicsFlowParams {
  projectId: string | null;
  simulationRunId: string | undefined;
  worldContext: WorldContextForDynamics | null;
  worldSchema: CanonrySchemaSlice | null;
  entityNavMap: Map<string, EntityNavItem>;
  relationships: WorldRelationship[];
  updateWorldContext: (patch: Partial<WorldContextForDynamics>) => void;
}

export interface UseDynamicsFlowReturn {
  dynamicsRun: DynamicsRun | null;
  isDynamicsActive: boolean;
  handleGenerateDynamics: () => Promise<void>;
  submitDynamicsFeedback: (feedback: string) => Promise<void>;
  acceptDynamics: () => void;
  cancelDynamicsGeneration: () => void;
}

// --- Module-level helpers ---

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

/**
 * Map proposed dynamics into the worldDynamics format.
 */
function mapProposedDynamics(proposedDynamics: ProposedDynamic[]) {
  return proposedDynamics.map((d, i) => ({
    id: `dyn_gen_${Date.now()}_${i}`,
    text: d.text,
    cultures: d.cultures?.length ? d.cultures : undefined,
    kinds: d.kinds?.length ? d.kinds : undefined,
    eraOverrides:
      d.eraOverrides && Object.keys(d.eraOverrides).length > 0 ? d.eraOverrides : undefined,
  }));
}

/**
 * Load static pages context for dynamics prompt.
 */
async function loadStaticPagesContext(projectId: string): Promise<string> {
  try {
    const pages = await getPublishedStaticPagesForProject(projectId);
    if (pages.length > 0) {
      return pages.map((p) => `## ${p.title}\n\n${p.content}`).join("\n\n---\n\n");
    }
  } catch (err) {
    console.warn("[Dynamics] Failed to load static pages:", err);
  }
  return "";
}

/**
 * Build entity context array for dynamics generation.
 */
function buildEntityContexts(allEntities: PersistedEntity[]) {
  return allEntities.map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    subtype: e.subtype || "",
    culture: e.culture || "",
    status: e.status || "",
    summary: e.summary || "",
    description: e.description || "",
    tags: e.tags || {},
    eraId: e.eraId,
  }));
}

/**
 * Build relationships payload with resolved names.
 */
function buildRelationshipsPayload(
  relationships: WorldRelationship[],
  entityNavMap: Map<string, EntityNavItem>,
) {
  return relationships.map((r) => ({
    src: r.src,
    dst: r.dst,
    kind: r.kind,
    weight: r.weight ?? r.strength,
    srcName: entityNavMap.get(r.src)?.name || r.src,
    dstName: entityNavMap.get(r.dst)?.name || r.dst,
  }));
}

// --- Main hook ---

export function useDynamicsFlow({
  projectId,
  simulationRunId,
  worldContext,
  worldSchema,
  entityNavMap,
  relationships,
  updateWorldContext,
}: UseDynamicsFlowParams): UseDynamicsFlowReturn {
  // Handle accepted dynamics from LLM
  const handleDynamicsAccepted = useCallback(
    (proposedDynamics: ProposedDynamic[] | undefined) => {
      if (!proposedDynamics?.length) return;
      const newDynamics = mapProposedDynamics(proposedDynamics);
      const existing = worldContext?.worldDynamics || [];
      updateWorldContext({ worldDynamics: [...existing, ...newDynamics] });
    },
    [worldContext, updateWorldContext]
  );

  const {
    run: dynamicsRun,
    isActive: isDynamicsActive,
    startGeneration: startDynamicsGeneration,
    submitFeedback: submitDynamicsFeedback,
    acceptDynamics,
    cancelGeneration: cancelDynamicsGeneration,
  } = useDynamicsGeneration(handleDynamicsAccepted);

  // Launch dynamics generation with full world context
  const handleGenerateDynamics = useCallback(async () => {
    if (!projectId || !simulationRunId) return;

    const staticPagesContext = await loadStaticPagesContext(projectId);
    const schemaContext = buildSchemaContext(worldSchema);

    // Build entity context -- load full entities from Dexie (needs description, tags)
    const allEntities = await entityRepo.getEntitiesForRun(simulationRunId);
    const entityContexts = buildEntityContexts(allEntities);
    const relationshipsPayload = buildRelationshipsPayload(relationships, entityNavMap);

    void startDynamicsGeneration({
      projectId,
      simulationRunId,
      staticPagesContext,
      schemaContext,
      entities: entityContexts,
      relationships: relationshipsPayload,
    });
  }, [
    projectId,
    simulationRunId,
    worldSchema,
    entityNavMap,
    relationships,
    startDynamicsGeneration,
  ]);

  return {
    dynamicsRun,
    isDynamicsActive,
    handleGenerateDynamics,
    submitDynamicsFeedback,
    acceptDynamics,
    cancelDynamicsGeneration,
  };
}
