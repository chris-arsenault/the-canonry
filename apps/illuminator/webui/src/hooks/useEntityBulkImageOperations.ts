/**
 * useEntityBulkImageOperations — Bulk image style operations for entities.
 *
 * Provides: tag styles (LLM), assign primary, assign secondary,
 * bulk clear images, bulk generate with primary/secondary toggle.
 */

import { useState, useCallback } from "react";
import type { StyleLibrary } from "@canonry/world-schema";
import type { EntityNavItem } from "../lib/db/entityNav";
import type { PersistedEntity } from "../lib/db/illuminatorDb";
import {
  assignImageStyles,
  assignSecondaryStyles,
  type ImageRefRanking,
} from "../lib/imageStyleAssignment";
import {
  applyImageStyleResult,
  clearEntityImage,
  getEntitiesForRun,
} from "../lib/db/entityRepository";
import { buildImagePromptFromGuidance } from "../lib/promptBuilders";
import type { EntityContext, StyleInfo } from "../lib/promptBuilders";
import { getSizeForAspect } from "../lib/imageSettings";
import { prominenceLabelFromScale } from "@canonry/world-schema";
import type { ProminenceScale, WorldRelationship } from "@canonry/world-schema";

interface OperationResult {
  success: boolean;
  count: number;
  error?: string;
}

interface UseEntityBulkImageOperationsParams {
  entityNavItems: EntityNavItem[];
  simulationRunId: string;
  styleLibrary: StyleLibrary | null;
  imageModel: string;
  imageQuality: string;
  onEnqueue: (items: Array<Record<string, unknown>>) => void;
  refresh: () => Promise<void>;
  // Prompt building dependencies
  entityGuidance: Record<string, unknown>;
  cultureIdentities: Record<string, unknown>;
  worldContext: Record<string, unknown>;
  relationshipsByEntity: Map<string, WorldRelationship[]>;
  entityNavMap: Map<string, EntityNavItem>;
  prominenceScale: ProminenceScale;
  currentEra: { name: string; description?: string } | null;
  prominentByCulture: Record<string, Array<{ id: string; name: string }>>;
}

function buildMinimalEntityContext(
  entity: PersistedEntity,
  params: {
    relationshipsByEntity: Map<string, WorldRelationship[]>;
    entityNavMap: Map<string, EntityNavItem>;
    prominenceScale: ProminenceScale;
    currentEra: { name: string; description?: string } | null;
    prominentByCulture: Record<string, Array<{ id: string; name: string }>>;
  },
): EntityContext {
  const relationships = (params.relationshipsByEntity.get(entity.id) || [])
    .slice(0, 8)
    .map((rel) => {
      const targetId = rel.src === entity.id ? rel.dst : rel.src;
      const target = params.entityNavMap.get(targetId);
      return {
        kind: rel.kind,
        targetName: target?.name || targetId,
        targetKind: target?.kind || "unknown",
        targetSubtype: target?.subtype,
        strength: rel.strength,
      };
    });

  const text = entity.enrichment?.text;
  return {
    entity: {
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      subtype: entity.subtype,
      prominence: prominenceLabelFromScale(
        entity.prominence,
        params.prominenceScale,
      ),
      culture: entity.culture || "",
      status: entity.status || "active",
      summary: entity.summary || "",
      description: entity.description || "",
      tags: entity.tags || {},
      visualThesis: text?.visualThesis || "",
      visualTraits: text?.visualTraits || [],
    },
    relationships,
    era: {
      name: params.currentEra?.name || "",
      description: params.currentEra?.description,
    },
    entityAge: "established" as const,
    culturalPeers: (params.prominentByCulture[entity.culture] || [])
      .filter((peer) => peer.id !== entity.id)
      .slice(0, 3)
      .map((peer) => peer.name),
  };
}

export function useEntityBulkImageOperations({
  entityNavItems,
  simulationRunId,
  styleLibrary,
  imageModel,
  imageQuality,
  onEnqueue,
  refresh,
  entityGuidance,
  cultureIdentities,
  worldContext,
  relationshipsByEntity,
  entityNavMap,
  prominenceScale,
  currentEra,
  prominentByCulture,
}: UseEntityBulkImageOperationsParams) {
  const [useSecondaryStyles, setUseSecondaryStyles] = useState(false);
  const [tagResult, setTagResult] = useState<OperationResult | null>(null);
  const [assignResult, setAssignResult] = useState<OperationResult | null>(
    null,
  );
  const [assignSecondaryResult, setAssignSecondaryResult] =
    useState<OperationResult | null>(null);
  const [clearResult, setClearResult] = useState<OperationResult | null>(null);
  const [generateResult, setGenerateResult] =
    useState<OperationResult | null>(null);

  // ── Tag Styles (enqueue LLM task) ──

  const handleTagStyles = useCallback(() => {
    const eligible = entityNavItems.filter((e) => e.hasVisualThesis);
    if (eligible.length === 0 || !styleLibrary) {
      setTagResult({ success: true, count: 0 });
      setTimeout(() => setTagResult(null), 4000);
      return;
    }

    const artisticStyles = styleLibrary.artisticStyles.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
    }));
    const compositionStyles = styleLibrary.compositionStyles.map((s) => ({
      id: s.id,
      name: s.name,
      targetCategory: s.targetCategory || "",
    }));
    const colorPalettes = styleLibrary.colorPalettes.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      group: p.group,
    }));

    const entityIds = eligible.map((e) => e.id);
    const BATCH_SIZE = 50;
    const batches: string[][] = [];
    for (let i = 0; i < entityIds.length; i += BATCH_SIZE) {
      batches.push(entityIds.slice(i, i + BATCH_SIZE));
    }
    onEnqueue(
      batches.map((batch, idx) => ({
        entity: {
          id: batch[0],
          name: `Batch Tag ${idx + 1}/${batches.length}`,
          kind: "system",
          subtype: "",
        },
        type: "entityTagImageStyles",
        prompt: "",
        entityIds: batch,
        artisticStyles,
        compositionStyles,
        colorPalettes,
      })),
    );

    setTagResult({ success: true, count: eligible.length });
    setTimeout(() => setTagResult(null), 4000);
  }, [entityNavItems, styleLibrary, onEnqueue]);

  // ── Assign Primary Styles (deterministic distribution) ──

  const handleAssignPrimaryStyles = useCallback(async () => {
    const allEntities = await getEntitiesForRun(simulationRunId);
    const rankings: ImageRefRanking[] = [];

    for (const entity of allEntities) {
      const style = entity.enrichment?.imageStyle;
      if (!style?.rankedArtisticStyleIds?.length) continue;
      rankings.push({
        chronicleId: entity.id,
        refId: entity.id,
        rankedArtisticStyleIds: style.rankedArtisticStyleIds,
        rankedCompositionStyleIds: style.rankedCompositionStyleIds,
        rankedColorPaletteIds: style.rankedColorPaletteIds,
      });
    }

    if (rankings.length === 0) {
      setAssignResult({ success: true, count: 0 });
      setTimeout(() => setAssignResult(null), 4000);
      return;
    }

    const result = assignImageStyles(rankings, styleLibrary);

    for (const entry of result.entries) {
      const entity = allEntities.find((e) => e.id === entry.chronicleId);
      if (!entity?.enrichment?.imageStyle) continue;
      await applyImageStyleResult(entity.id, {
        ...entity.enrichment.imageStyle,
        suggestedArtisticStyleId: entry.assignedArtisticStyleId,
        suggestedCompositionStyleId: entry.assignedCompositionStyleId,
        suggestedColorPaletteId: entry.assignedColorPaletteId,
      });
    }

    await refresh();
    const shifted = result.entries.filter(
      (e) => e.artisticShifted || e.compositionShifted || e.paletteShifted,
    ).length;
    setAssignResult({ success: true, count: rankings.length });
    console.log(
      `[AssignEntityStyles] Assigned ${rankings.length} entities, ${shifted} shifted`,
    );
    setTimeout(() => setAssignResult(null), 4000);
  }, [simulationRunId, styleLibrary, refresh]);

  // ── Assign Secondary Styles (pair-novelty greedy) ──

  const handleAssignSecondaryStyles = useCallback(async () => {
    const allEntities = await getEntitiesForRun(simulationRunId);
    const rankings: ImageRefRanking[] = [];
    const primaryAssignments: Array<{
      chronicleId: string;
      refId: string;
      artisticStyleId: string;
      compositionStyleId: string;
      colorPaletteId: string;
    }> = [];

    for (const entity of allEntities) {
      const style = entity.enrichment?.imageStyle;
      if (!style?.rankedArtisticStyleIds?.length) continue;
      if (!style.suggestedArtisticStyleId) continue;
      rankings.push({
        chronicleId: entity.id,
        refId: entity.id,
        rankedArtisticStyleIds: style.rankedArtisticStyleIds,
        rankedCompositionStyleIds: style.rankedCompositionStyleIds,
        rankedColorPaletteIds: style.rankedColorPaletteIds,
      });
      primaryAssignments.push({
        chronicleId: entity.id,
        refId: entity.id,
        artisticStyleId: style.suggestedArtisticStyleId,
        compositionStyleId: style.suggestedCompositionStyleId,
        colorPaletteId: style.suggestedColorPaletteId,
      });
    }

    if (rankings.length === 0) {
      setAssignSecondaryResult({ success: true, count: 0 });
      setTimeout(() => setAssignSecondaryResult(null), 4000);
      return;
    }

    const result = assignSecondaryStyles(rankings, primaryAssignments);

    for (const entry of result.entries) {
      const entity = allEntities.find((e) => e.id === entry.chronicleId);
      if (!entity?.enrichment?.imageStyle) continue;
      await applyImageStyleResult(entity.id, {
        ...entity.enrichment.imageStyle,
        secondaryArtisticStyleId: entry.secondaryArtisticStyleId,
        secondaryCompositionStyleId: entry.secondaryCompositionStyleId,
        secondaryColorPaletteId: entry.secondaryColorPaletteId,
      });
    }

    await refresh();
    setAssignSecondaryResult({ success: true, count: result.entries.length });
    console.log(
      `[AssignEntitySecondaryStyles] ${result.entries.length} secondary combos, ${result.novelPairs}/${result.totalPairs} novel`,
    );
    setTimeout(() => setAssignSecondaryResult(null), 4000);
  }, [simulationRunId, refresh]);

  // ── Bulk Clear Images ──

  const handleBulkClearImages = useCallback(async () => {
    const withImages = entityNavItems.filter((e) => e.imageId);
    for (const nav of withImages) {
      await clearEntityImage(nav.id);
    }
    await refresh();
    setClearResult({ success: true, count: withImages.length });
    setTimeout(() => setClearResult(null), 4000);
  }, [entityNavItems, refresh]);

  // ── Bulk Generate Images ──

  const handleBulkGenerateImages = useCallback(async () => {
    if (!styleLibrary) return;

    const artisticMap = new Map(
      styleLibrary.artisticStyles.map((s) => [s.id, s]),
    );
    const compositionMap = new Map(
      styleLibrary.compositionStyles.map((s) => [s.id, s]),
    );
    const paletteMap = new Map(
      styleLibrary.colorPalettes.map((s) => [s.id, s]),
    );

    const allEntities = await getEntitiesForRun(simulationRunId);
    const entityById = new Map(allEntities.map((e) => [e.id, e]));

    // Only generate for entities with style assignments and no current image
    const eligible = entityNavItems.filter(
      (e) => !e.imageId && e.hasImageStyle,
    );
    const items: Array<Record<string, unknown>> = [];

    for (const nav of eligible) {
      const entity = entityById.get(nav.id);
      if (!entity?.enrichment?.imageStyle) continue;
      const style = entity.enrichment.imageStyle;

      const artId = useSecondaryStyles
        ? style.secondaryArtisticStyleId
        : style.suggestedArtisticStyleId;
      const compId = useSecondaryStyles
        ? style.secondaryCompositionStyleId
        : style.suggestedCompositionStyleId;
      const palId = useSecondaryStyles
        ? style.secondaryColorPaletteId
        : style.suggestedColorPaletteId;
      if (!artId || !compId || !palId) continue;

      const artistic = artisticMap.get(artId);
      const composition = compositionMap.get(compId);
      const palette = paletteMap.get(palId);
      if (!artistic || !composition) continue;

      const styleInfo: StyleInfo = {
        artisticPromptFragment: artistic.promptFragment,
        compositionPromptFragment: composition.promptFragment,
        colorPalettePromptFragment: palette?.promptFragment,
        colorPaletteSwatchColors: palette?.swatchColors,
        artisticNegativePrompt: artistic.negativePrompt,
        artistExemplar: artistic.artistExemplar,
      };

      const entityContext = buildMinimalEntityContext(entity, {
        relationshipsByEntity,
        entityNavMap,
        prominenceScale,
        currentEra,
        prominentByCulture,
      });

      const prompt = buildImagePromptFromGuidance(
        entityGuidance as Record<string, unknown>,
        cultureIdentities as Record<string, unknown>,
        worldContext as Record<string, unknown>,
        entityContext,
        styleInfo,
        imageModel,
      );

      const aspect = composition.defaultImageAspect || "square";
      const imageSize = getSizeForAspect(imageModel, aspect);

      items.push({
        entity: {
          id: entity.id,
          name: entity.name,
          kind: entity.kind,
          subtype: entity.subtype,
          prominence: entity.prominence,
          culture: entity.culture,
          status: entity.status,
          description: entity.description,
          tags: entity.tags,
        },
        type: "image",
        prompt,
        imageSize,
        imageQuality,
        artisticStyleId: artId,
        compositionStyleId: compId,
        colorPaletteId: palId,
        tags: style.visualTags,
      });
    }

    if (items.length === 0) {
      setGenerateResult({ success: true, count: 0 });
      setTimeout(() => setGenerateResult(null), 4000);
      return;
    }

    // Enqueue one at a time with delay (same pattern as chronicle bulk generation)
    const DELAY_MS = 10_000;
    let enqueued = 0;
    for (const item of items) {
      if (enqueued > 0) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
      onEnqueue([item]);
      enqueued++;
      setGenerateResult({ success: true, count: enqueued });
      console.log(
        `[BulkGenerateEntityImages] Enqueued ${enqueued}/${items.length}`,
      );
    }

    setTimeout(() => setGenerateResult(null), 4000);
  }, [
    entityNavItems,
    simulationRunId,
    styleLibrary,
    useSecondaryStyles,
    imageModel,
    imageQuality,
    onEnqueue,
    entityGuidance,
    cultureIdentities,
    worldContext,
    relationshipsByEntity,
    entityNavMap,
    prominenceScale,
    currentEra,
    prominentByCulture,
  ]);

  return {
    useSecondaryStyles,
    setUseSecondaryStyles,
    handleTagStyles,
    handleAssignPrimaryStyles,
    handleAssignSecondaryStyles,
    handleBulkClearImages,
    handleBulkGenerateImages,
    tagResult,
    assignResult,
    assignSecondaryResult,
    clearResult,
    generateResult,
  };
}
