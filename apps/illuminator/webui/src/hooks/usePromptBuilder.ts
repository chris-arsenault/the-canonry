/**
 * usePromptBuilder - Hook for building entity description and image prompts
 *
 * Extracted from IlluminatorRemote. Contains:
 * - getVisualConfig: resolve visual config for an entity from guidance
 * - buildPrompt: build description or image prompts using guidance + culture identities
 *
 * Complex logic is extracted into module-level functions to keep
 * cognitive complexity of each callback under 10.
 */

import { useCallback } from "react";
import {
  buildDescriptionPromptFromGuidance,
  buildImagePromptFromGuidance,
  getVisualConfigFromGuidance,
} from "../lib/promptBuilders";
import type {
  EntityGuidance,
  CultureIdentities,
  WorldContext,
  EntityContext,
  StyleInfo,
} from "../lib/promptBuilders";
import { resolveStyleSelection } from "../components/StyleSelector";
import { prominenceLabelFromScale, getEntityEvents, getEntityEffects } from "@canonry/world-schema";
import type {
  ProminenceScale,
  NarrativeEvent,
  CanonrySchemaSlice,
  StyleLibrary,
  WorldRelationship,
} from "@canonry/world-schema";
import type { PersistedEntity } from "../lib/db/illuminatorDb";
import type { EntityNavItem } from "../lib/db/entityNav";
import type { EraTemporalEntry } from "../lib/db/indexTypes";
import type { ImageGenSettings } from "./useImageGenSettings";

// --- Types ---

interface StyleSelection {
  artisticStyleId: string;
  compositionStyleId: string;
  colorPaletteId: string;
}

interface EraInfo {
  name: string;
  description?: string;
}

interface PromptBuilderConfig {
  minEventSignificance?: number;
  [key: string]: unknown;
}

interface EntityContextParams {
  relationshipsByEntity: Map<string, WorldRelationship[]>;
  entityNavMap: Map<string, EntityNavItem>;
  prominenceScale: ProminenceScale;
  currentEra: EraInfo | null;
  prominentByCulture: Record<string, Array<{ id: string; name: string }>>;
}

interface DescriptionPromptParams extends EntityContextParams {
  entityGuidance: EntityGuidance;
  cultureIdentities: CultureIdentities;
  worldContext: WorldContext;
  narrativeEvents: NarrativeEvent[];
  config: PromptBuilderConfig;
}

interface ImagePromptParams extends EntityContextParams {
  entityGuidance: EntityGuidance;
  cultureIdentities: CultureIdentities;
  worldContext: WorldContext;
  styleSelection: StyleSelection;
  worldSchema: CanonrySchemaSlice | null;
  styleLibrary: StyleLibrary;
}

export interface UsePromptBuilderParams {
  entityGuidance: EntityGuidance;
  cultureIdentities: CultureIdentities;
  worldContext: WorldContext;
  relationshipsByEntity: Map<string, WorldRelationship[]>;
  entityNavMap: Map<string, EntityNavItem>;
  currentEra: EraInfo | null;
  narrativeEvents: NarrativeEvent[];
  prominentByCulture: Record<string, Array<{ id: string; name: string }>>;
  styleSelection: StyleSelection;
  worldSchema: CanonrySchemaSlice | null;
  config: PromptBuilderConfig;
  prominenceScale: ProminenceScale;
  styleLibrary: StyleLibrary;
  eraTemporalInfo: EraTemporalEntry[];
  eraTemporalInfoByKey: Map<string, EraTemporalEntry>;
}

export interface UsePromptBuilderReturn {
  buildPrompt: (entity: PersistedEntity, type: "description" | "image") => string;
  getVisualConfig: (entity: PersistedEntity) => Record<string, unknown>;
}

// --- Module-level helpers to reduce callback complexity ---

/**
 * Resolve the eraId for an entity.
 */
function resolveEntityEraId(entity: PersistedEntity): string | undefined {
  if (!entity) return undefined;
  if (typeof entity.eraId === "string" && entity.eraId) return entity.eraId;
  return undefined;
}

/**
 * Build the relationships array for an entity prompt context.
 */
function buildRelationshipsForPrompt(
  entity: PersistedEntity,
  relationshipsByEntity: Map<string, WorldRelationship[]>,
  entityNavMap: Map<string, EntityNavItem>,
) {
  return (relationshipsByEntity.get(entity.id) || []).slice(0, 8).map((rel) => {
    const targetId = rel.src === entity.id ? rel.dst : rel.src;
    const target = entityNavMap.get(targetId);
    return {
      kind: rel.kind,
      targetName: target?.name || targetId,
      targetKind: target?.kind || "unknown",
      targetSubtype: target?.subtype,
      strength: rel.strength,
    };
  });
}

function resolveVisualFields(entity: PersistedEntity) {
  const text = entity.enrichment?.text;
  return { visualThesis: text?.visualThesis || "", visualTraits: text?.visualTraits || [] };
}

function buildEntityFields(entity: PersistedEntity) {
  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    subtype: entity.subtype,
    culture: entity.culture || "",
    status: entity.status || "active",
    summary: entity.summary || "",
    description: entity.description || "",
    tags: entity.tags || {},
    ...resolveVisualFields(entity),
  };
}

function buildEntityContext(entity: PersistedEntity, params: EntityContextParams) {
  const { relationshipsByEntity, entityNavMap, prominenceScale, currentEra, prominentByCulture } =
    params;
  return {
    entity: {
      ...buildEntityFields(entity),
      prominence: prominenceLabelFromScale(entity.prominence, prominenceScale),
    },
    relationships: buildRelationshipsForPrompt(entity, relationshipsByEntity, entityNavMap),
    era: { name: currentEra?.name || "", description: currentEra?.description },
    entityAge: "established" as const,
    culturalPeers: (prominentByCulture[entity.culture] || [])
      .filter((peer) => peer.id !== entity.id)
      .slice(0, 3)
      .map((peer) => peer.name),
  };
}

/**
 * Build a description prompt for an entity (module-level, no closure deps).
 */
function buildEntityDescriptionPrompt(entity: PersistedEntity, params: DescriptionPromptParams): string {
  const {
    entityGuidance,
    cultureIdentities,
    worldContext,
    relationshipsByEntity,
    entityNavMap,
    prominenceScale,
    currentEra,
    narrativeEvents,
    prominentByCulture,
    config,
  } = params;

  const entityContext = buildEntityContext(entity, {
    relationshipsByEntity,
    entityNavMap,
    prominenceScale,
    currentEra,
    prominentByCulture,
  });

  // Get entity events from narrative history (filtered by significance)
  const entityEvents = getEntityEvents(narrativeEvents, {
    entityId: entity.id,
    minSignificance: config.minEventSignificance ?? 0.25,
    excludeProminenceOnly: true,
    limit: 10, // Cap at 10 events to avoid prompt bloat
  });

  // Add events to entity context (use era name instead of tick)
  entityContext.events = entityEvents.map((e) => {
    const eraEntity = entityNavMap.get(e.era);
    const eraName = eraEntity?.name || e.era;
    return {
      era: eraName,
      description: e.description,
      significance: e.significance,
      effects: getEntityEffects(e, entity.id).map((eff) => ({
        type: eff.type,
        description: eff.description,
      })),
    };
  });

  return buildDescriptionPromptFromGuidance(
    entityGuidance,
    cultureIdentities,
    worldContext,
    entityContext
  );
}

/**
 * Build an image prompt for an entity (module-level, no closure deps).
 */
function buildEntityImagePrompt(entity: PersistedEntity, params: ImagePromptParams): string {
  const {
    entityGuidance,
    cultureIdentities,
    worldContext,
    relationshipsByEntity,
    entityNavMap,
    prominenceScale,
    currentEra,
    prominentByCulture,
    styleSelection,
    worldSchema,
    styleLibrary,
  } = params;

  const entityContext = buildEntityContext(entity, {
    relationshipsByEntity,
    entityNavMap,
    prominenceScale,
    currentEra,
    prominentByCulture,
  });

  // Resolve style selection for this entity
  const resolvedStyle = resolveStyleSelection({
    selection: styleSelection,
    entityCultureId: entity.culture,
    entityKind: entity.kind,
    cultures: worldSchema?.cultures || [],
    styleLibrary,
  });

  // Build style info for the prompt
  const styleInfo = {
    artisticPromptFragment: resolvedStyle.artisticStyle?.promptFragment,
    compositionPromptFragment: resolvedStyle.compositionStyle?.promptFragment,
    colorPalettePromptFragment: resolvedStyle.colorPalette?.promptFragment,
    cultureKeywords: resolvedStyle.cultureKeywords,
  };

  return buildImagePromptFromGuidance(
    entityGuidance,
    cultureIdentities,
    worldContext,
    entityContext,
    styleInfo
  );
}

// --- Main hook ---

export function usePromptBuilder({
  entityGuidance,
  cultureIdentities,
  worldContext,
  relationshipsByEntity,
  entityNavMap,
  currentEra,
  narrativeEvents,
  prominentByCulture,
  styleSelection,
  worldSchema,
  config,
  prominenceScale,
  styleLibrary,
  eraTemporalInfo,
  eraTemporalInfoByKey,
}: UsePromptBuilderParams): UsePromptBuilderReturn {
  // Get visual config for an entity (thesis/traits prompts, avoid elements, era)
  const getVisualConfig = useCallback(
    (entity: PersistedEntity) => {
      const visualConfig = getVisualConfigFromGuidance(entityGuidance, entity.kind);

      const entityEraId = resolveEntityEraId(entity);
      const entityFocalEra = entityEraId ? eraTemporalInfoByKey.get(entityEraId) : undefined;
      const entityAllEras = eraTemporalInfo.length > 0 ? eraTemporalInfo : undefined;

      return {
        ...visualConfig,
        entityEraId,
        entityFocalEra,
        entityAllEras,
      };
    },
    [entityGuidance, eraTemporalInfo, eraTemporalInfoByKey]
  );

  // Build prompt for entity using EntityGuidance and CultureIdentities directly
  const buildPrompt = useCallback(
    (entity: PersistedEntity, type: "description" | "image"): string => {
      const params = {
        entityGuidance,
        cultureIdentities,
        worldContext,
        relationshipsByEntity,
        entityNavMap,
        prominenceScale,
        currentEra,
        narrativeEvents,
        prominentByCulture,
        styleSelection,
        worldSchema,
        styleLibrary,
        config,
      };

      if (type === "description") {
        return buildEntityDescriptionPrompt(entity, params);
      }
      if (type === "image") {
        return buildEntityImagePrompt(entity, params);
      }
      return `Describe ${entity.name}, a ${entity.subtype} ${entity.kind}.`;
    },
    [
      worldContext,
      entityGuidance,
      cultureIdentities,
      relationshipsByEntity,
      entityNavMap,
      currentEra,
      narrativeEvents,
      prominentByCulture,
      styleSelection,
      worldSchema,
      styleLibrary,
      config,
      prominenceScale,
    ]
  );

  return { buildPrompt, getVisualConfig };
}
