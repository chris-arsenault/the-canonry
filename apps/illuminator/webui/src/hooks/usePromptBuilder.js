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
import { resolveStyleSelection } from "../components/StyleSelector";
import { prominenceLabelFromScale, getEntityEvents, getEntityEffects } from "@canonry/world-schema";

// --- Module-level helpers to reduce callback complexity ---

/**
 * Resolve the eraId for an entity.
 */
function resolveEntityEraId(entity) {
  if (!entity) return undefined;
  if (typeof entity.eraId === "string" && entity.eraId) return entity.eraId;
  return undefined;
}

/**
 * Build the relationships array for an entity prompt context.
 */
function buildRelationshipsForPrompt(entity, relationshipsByEntity, entityNavMap) {
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

function resolveVisualFields(entity) {
  const text = entity.enrichment?.text;
  return { visualThesis: text?.visualThesis || "", visualTraits: text?.visualTraits || [] };
}

function buildEntityFields(entity) {
  return {
    id: entity.id, name: entity.name, kind: entity.kind, subtype: entity.subtype,
    culture: entity.culture || "", status: entity.status || "active",
    summary: entity.summary || "", description: entity.description || "",
    tags: entity.tags || {}, ...resolveVisualFields(entity),
  };
}

function buildEntityContext(entity, params) {
  const { relationshipsByEntity, entityNavMap, prominenceScale, currentEra, prominentByCulture } = params;
  return {
    entity: { ...buildEntityFields(entity), prominence: prominenceLabelFromScale(entity.prominence, prominenceScale) },
    relationships: buildRelationshipsForPrompt(entity, relationshipsByEntity, entityNavMap),
    era: { name: currentEra?.name || "", description: currentEra?.description },
    entityAge: "established",
    culturalPeers: (prominentByCulture[entity.culture] || [])
      .filter((peer) => peer.id !== entity.id)
      .slice(0, 3)
      .map((peer) => peer.name),
  };
}

/**
 * Build a description prompt for an entity (module-level, no closure deps).
 */
function buildEntityDescriptionPrompt(entity, params) {
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
function buildEntityImagePrompt(entity, params) {
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
}) {
  // Get visual config for an entity (thesis/traits prompts, avoid elements, era)
  const getVisualConfig = useCallback(
    (entity) => {
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
    (entity, type) => {
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
