/**
 * useChronicleBulkOperations - Bulk operation callbacks for ChroniclePanel.
 *
 * Handles tertiary detection, backport reset/reconcile, bulk temporal checks,
 * bulk summaries, and bulk historian prep — all extracted from the monolithic
 * ChroniclePanel to reduce cyclomatic complexity.
 */

import { useState, useCallback, type RefObject } from "react";
import type { ChronicleNavItem, OperationResult, ResetBackportResult, TertiaryDetectResult } from "./chroniclePanelTypes";
import { getEntitiesForRun, resetEntitiesToPreBackportState } from "../../lib/db/entityRepository";
import {
  resetAllBackportFlags,
  reconcileBackportStatusFromEntities,
  getChronicle,
  updateChronicleTertiaryCast,
} from "../../lib/db/chronicleRepository";
import { findEntityMentions } from "../../lib/wikiLinkService";
import { clearChronicleImageRefs, clearChronicleSceneImages, clearChronicleCoverImage } from "../../lib/db/chronicleImageOps";
import { assignImageStyles, type ImageRefRanking } from "../../lib/imageStyleAssignment";
import { db } from "../../lib/db/illuminatorDb";
import type { PersistedEntity } from "../../lib/db/illuminatorDb";
import type { StyleLibrary } from "@canonry/world-schema";
import { buildChronicleScenePrompt, type CastMember } from "../../lib/promptBuilders";
import { annotateEntityNames } from "../../lib/annotateEntityNames";
import type { EntityNavItem } from "../../lib/db/entityNav";
import type { WorldContext } from "./chroniclePanelTypes";
import { getSizeForAspect } from "../../lib/imageSettings";
import { getCoverImageConfig } from "../../lib/coverImageStyles";

type WikiEntity = { id: string; name: string };

function buildWikiEntityList(entities: PersistedEntity[]): WikiEntity[] {
  const wikiEntities: WikiEntity[] = [];
  for (const entity of entities) {
    if (entity.kind === "era") continue;
    wikiEntities.push({ id: entity.id, name: entity.name });
    const aliases = entity.enrichment?.text?.aliases;
    if (Array.isArray(aliases)) {
      for (const alias of aliases) {
        if (typeof alias === "string" && alias.length >= 3) {
          wikiEntities.push({ id: entity.id, name: alias });
        }
      }
    }
  }
  return wikiEntities;
}

async function detectTertiaryForChronicle(
  navItem: ChronicleNavItem,
  wikiEntities: WikiEntity[],
  freshEntities: PersistedEntity[]
): Promise<boolean> {
  const record = await getChronicle(navItem.chronicleId);
  if (!record) return false;
  const content = record.finalContent || record.assembledContent;
  if (!content) return false;

  const mentions = findEntityMentions(content, wikiEntities);
  const declaredIds = new Set(record.selectedEntityIds || []);
  const prevDecisions = new Map(
    (record.tertiaryCast || []).map((e: { entityId: string; accepted: boolean }) => [e.entityId, e.accepted]),
  );
  const seen = new Set<string>();
  const entries: Array<Record<string, unknown>> = [];
  for (const m of mentions) {
    if (declaredIds.has(m.entityId) || seen.has(m.entityId)) continue;
    seen.add(m.entityId);
    const entity = freshEntities.find((e: { id: string }) => e.id === m.entityId);
    if (entity) {
      entries.push({
        entityId: entity.id, name: entity.name, kind: entity.kind,
        matchedAs: content.slice(m.start, m.end),
        matchStart: m.start, matchEnd: m.end,
        accepted: prevDecisions.get(entity.id) ?? true,
      });
    }
  }
  await updateChronicleTertiaryCast(navItem.chronicleId, entries);
  return true;
}

interface UseChronicleBulkOperationsParams {
  simulationRunId: string;
  chronicleItems: ChronicleNavItem[];
  onEnqueue: (items: Array<Record<string, unknown>>) => void;
  refresh: () => Promise<void>;
  historianConfigured: boolean;
  historianConfig: Record<string, unknown>;
  skipCompletedPrep: boolean;
  fullEntityMapRef: RefObject<Map<string, PersistedEntity>>;
  styleLibrary: StyleLibrary | null;
  worldContext: WorldContext;
  imageModel: string;
  chronicleImageQuality: string;
}

export function useChronicleBulkOperations({
  simulationRunId,
  chronicleItems,
  onEnqueue,
  refresh,
  historianConfigured,
  historianConfig,
  skipCompletedPrep,
  fullEntityMapRef,
  styleLibrary,
  worldContext,
  imageModel,
  chronicleImageQuality,
}: UseChronicleBulkOperationsParams) {
  // Bulk image ref regeneration
  const [bulkImageRefResult, setBulkImageRefResult] = useState<OperationResult | null>(null);

  // Bulk tag image refs
  const [bulkTagImageRefResult, setBulkTagImageRefResult] = useState<OperationResult | null>(null);

  // Backport state
  const [showResetBackportModal, setShowResetBackportModal] = useState(false);
  const [resetBackportResult, setResetBackportResult] = useState<ResetBackportResult | null>(null);
  const [reconcileBackportResult, setReconcileBackportResult] = useState<OperationResult | null>(null);

  // Era summary
  const [eraSummaryRefreshResult, setEraSummaryRefreshResult] = useState<OperationResult | null>(null);

  // Temporal check
  const [temporalCheckResult, setTemporalCheckResult] = useState<OperationResult | null>(null);

  // Tertiary detect
  const [tertiaryDetectResult, setTertiaryDetectResult] = useState<TertiaryDetectResult | null>(null);

  // Bulk summary
  const [bulkSummaryResult, setBulkSummaryResult] = useState<OperationResult | null>(null);

  // ── Backport ──

  const handleOpenResetBackportModal = useCallback(() => {
    setShowResetBackportModal(true);
  }, []);

  const handleResetBackportConfirm = useCallback(async () => {
    if (!simulationRunId) return;
    try {
      const chronicleCount = await resetAllBackportFlags(simulationRunId);
      const freshEntities = await getEntitiesForRun(simulationRunId);
      const entityResult = await resetEntitiesToPreBackportState(simulationRunId, freshEntities);
      setResetBackportResult({
        success: true,
        chronicleCount,
        entityCount: entityResult.resetCount,
      });
      await refresh();
      if (entityResult.entityIds.length > 0) {
        window.dispatchEvent(
          new CustomEvent("entities-updated", {
            detail: { entityIds: entityResult.entityIds },
          }),
        );
      }
    } catch (err) {
      console.error("[Chronicle] Failed to reset backport state:", err);
      setResetBackportResult({ success: false, error: String(err) });
    }
    setShowResetBackportModal(false);
  }, [simulationRunId, refresh]);

  const handleResetBackportCancel = useCallback(() => {
    setShowResetBackportModal(false);
    setResetBackportResult(null);
  }, []);

  const handleReconcileBackports = useCallback(async () => {
    if (!simulationRunId) return;
    try {
      const freshEntities = await getEntitiesForRun(simulationRunId);
      const count = await reconcileBackportStatusFromEntities(simulationRunId, freshEntities);
      setReconcileBackportResult({ success: true, count });
      await refresh();
      setTimeout(() => setReconcileBackportResult(null), 5000);
    } catch (err) {
      console.error("[Chronicle] Failed to reconcile backport status:", err);
      setReconcileBackportResult({ success: false, error: String(err) });
    }
  }, [simulationRunId, refresh]);

  // ── Tertiary detection ──

  const handleBulkDetectTertiary = useCallback(async () => {
    if (!simulationRunId) return;
    setTertiaryDetectResult({ running: true, count: 0 });
    try {
      const freshEntities = await getEntitiesForRun(simulationRunId);
      const wikiEntities = buildWikiEntityList(freshEntities);
      const eligible = chronicleItems.filter(
        (c) => c.status === "complete" || c.status === "assembly_ready",
      );
      let updated = 0;
      for (const navItem of eligible) {
        const didUpdate = await detectTertiaryForChronicle(navItem, wikiEntities, freshEntities);
        if (didUpdate) updated++;
      }
      await refresh();
      setTertiaryDetectResult({ success: true, count: updated });
      setTimeout(() => setTertiaryDetectResult(null), 4000);
    } catch (err) {
      console.error("[Chronicle] Bulk tertiary detect failed:", err);
      setTertiaryDetectResult({ success: false, error: String(err) });
      setTimeout(() => setTertiaryDetectResult(null), 6000);
    }
  }, [simulationRunId, chronicleItems, refresh]);

  // ── Bulk temporal checks ──

  const handleBulkTemporalCheck = useCallback(() => {
    const eligible = chronicleItems.filter(
      (c) =>
        c.hasTemporalNarrative &&
        (c.status === "complete" || c.status === "assembly_ready"),
    );
    if (eligible.length === 0) {
      setTemporalCheckResult({ success: true, count: 0 });
      setTimeout(() => setTemporalCheckResult(null), 4000);
      return;
    }
    const items = eligible.map((c) => {
      const primaryRole = c.roleAssignments?.find((r) => r.isPrimary) || c.roleAssignments?.[0];
      const entity = buildQueueEntity(primaryRole, c);
      return {
        entity,
        type: "entityChronicle",
        prompt: "",
        chronicleStep: "temporal_check",
        chronicleId: c.chronicleId,
      };
    });
    onEnqueue(items);
    setTemporalCheckResult({ success: true, count: eligible.length });
    setTimeout(() => setTemporalCheckResult(null), 4000);
  }, [chronicleItems, onEnqueue]);

  // ── Bulk summaries ──

  const handleBulkSummary = useCallback(() => {
    const eligible = chronicleItems.filter(
      (c) =>
        !c.hasSummary &&
        (c.status === "complete" || c.status === "assembly_ready"),
    );
    if (eligible.length === 0) {
      setBulkSummaryResult({ success: true, count: 0 });
      setTimeout(() => setBulkSummaryResult(null), 4000);
      return;
    }
    const items = eligible.map((c) => {
      const primaryRole = c.roleAssignments?.find((r) => r.isPrimary) || c.roleAssignments?.[0];
      const entity = buildQueueEntity(primaryRole, c);
      return {
        entity,
        type: "entityChronicle",
        prompt: "",
        chronicleStep: "summary",
        chronicleId: c.chronicleId,
      };
    });
    onEnqueue(items);
    setBulkSummaryResult({ success: true, count: eligible.length });
    setTimeout(() => setBulkSummaryResult(null), 4000);
  }, [chronicleItems, onEnqueue]);

  // ── Bulk historian prep ──

  const handleBulkHistorianPrep = useCallback(() => {
    if (!historianConfigured) return;
    let eligible = chronicleItems.filter(
      (c) => (c.status === "complete" || c.status === "assembly_ready"),
    );
    if (skipCompletedPrep) {
      eligible = eligible.filter((c) => !c.hasHistorianPrep);
    }
    if (eligible.length === 0) return;
    const items = eligible.map((c) => {
      const primaryRole = c.roleAssignments?.find((r) => r.isPrimary) || c.roleAssignments?.[0];
      const entity = buildQueueEntity(primaryRole, c);
      return {
        entity,
        type: "historianPrep",
        prompt: JSON.stringify({ historianConfig, tone: "weary" }),
        chronicleId: c.chronicleId,
      };
    });
    onEnqueue(items);
  }, [chronicleItems, onEnqueue, historianConfigured, historianConfig, skipCompletedPrep]);

  // ── Bulk image ref regeneration ──

  const handleBulkRegenerateImageRefs = useCallback(() => {
    const eligible = chronicleItems.filter(
      (c) => c.status === "complete" || c.status === "assembly_ready",
    );
    if (eligible.length === 0) {
      setBulkImageRefResult({ success: true, count: 0 });
      setTimeout(() => setBulkImageRefResult(null), 4000);
      return;
    }

    // Build visual identities from the full entity map
    const visualIdentities: Record<string, string> = {};
    for (const [id, entity] of fullEntityMapRef.current) {
      const thesis = entity.enrichment?.text?.visualThesis;
      if (typeof thesis === "string") {
        visualIdentities[id] = thesis;
      }
    }

    const items = eligible.map((c) => {
      const hasRefs = (c.imageRefTotalCount ?? 0) > 0;
      const primaryRole = c.roleAssignments?.find((r) => r.isPrimary) || c.roleAssignments?.[0];
      const entity = buildQueueEntity(primaryRole, c);
      return {
        entity,
        type: "entityChronicle",
        prompt: "",
        chronicleStep: hasRefs ? "regenerate_image_refs" : "image_refs",
        chronicleId: c.chronicleId,
        visualIdentities,
      };
    });
    onEnqueue(items);
    setBulkImageRefResult({ success: true, count: eligible.length });
    setTimeout(() => setBulkImageRefResult(null), 4000);
  }, [chronicleItems, onEnqueue, fullEntityMapRef]);

  // ── Bulk tag image refs ──

  const handleBulkTagImageRefs = useCallback(() => {
    if (!styleLibrary) return;
    // Include all chronicles with image refs — reruns everything, not just untagged
    const eligible = chronicleItems.filter(
      (c) =>
        (c.imageRefTotalCount ?? 0) > 0 &&
        (c.status === "complete" || c.status === "assembly_ready"),
    );
    if (eligible.length === 0) {
      setBulkTagImageRefResult({ success: true, count: 0 });
      setTimeout(() => setBulkTagImageRefResult(null), 4000);
      return;
    }

    const artisticStyles = styleLibrary.artisticStyles.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
    }));
    const compositionStyles = styleLibrary.compositionStyles
      .filter((s) => !s.id.startsWith("chronicle-"))
      .map((s) => ({
        id: s.id,
        name: s.name,
        targetCategory: s.targetCategory,
      }));
    const colorPalettes = styleLibrary.colorPalettes.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      group: (p as Record<string, unknown>).group || "other",
    }));

    // Batch chronicles — ~30 per batch so most batches contain enough refs
    // for every style/composition/palette to appear at least once
    const BATCH_SIZE = 30;
    const batches: typeof eligible[] = [];
    for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
      batches.push(eligible.slice(i, i + BATCH_SIZE));
    }

    const items = batches.map((batch) => {
      const firstChronicle = batch[0];
      const primaryRole = firstChronicle.roleAssignments?.find((r) => r.isPrimary) || firstChronicle.roleAssignments?.[0];
      const entity = buildQueueEntity(primaryRole, firstChronicle);
      return {
        entity,
        type: "entityChronicle",
        prompt: "",
        chronicleStep: "tag_image_refs",
        chronicleId: firstChronicle.chronicleId,
        chronicleIds: batch.map((c) => c.chronicleId),
        artisticStyles,
        compositionStyles,
        colorPalettes,
      };
    });
    onEnqueue(items);
    setBulkTagImageRefResult({ success: true, count: eligible.length });
    setTimeout(() => setBulkTagImageRefResult(null), 4000);
  }, [chronicleItems, onEnqueue, styleLibrary]);

  // ── Bulk clear image refs ──

  const [bulkClearImageRefResult, setBulkClearImageRefResult] = useState<OperationResult | null>(null);

  const handleBulkClearImageRefs = useCallback(async () => {
    const eligible = chronicleItems.filter(
      (c) =>
        (c.imageRefTotalCount ?? 0) > 0 &&
        (c.status === "complete" || c.status === "assembly_ready"),
    );
    if (eligible.length === 0) {
      setBulkClearImageRefResult({ success: true, count: 0 });
      setTimeout(() => setBulkClearImageRefResult(null), 4000);
      return;
    }

    for (const c of eligible) {
      await clearChronicleImageRefs(c.chronicleId);
    }
    await refresh();
    setBulkClearImageRefResult({ success: true, count: eligible.length });
    setTimeout(() => setBulkClearImageRefResult(null), 4000);
  }, [chronicleItems, refresh]);

  // ── Assign image styles (deterministic distribution) ──

  const [assignImageStyleResult, setAssignImageStyleResult] = useState<OperationResult | null>(null);

  const handleAssignImageStyles = useCallback(async () => {
    // Collect ranked lists from all chronicles with tagged image refs
    const eligible = chronicleItems.filter(
      (c) =>
        (c.imageRefTotalCount ?? 0) > 0 &&
        (c.status === "complete" || c.status === "assembly_ready"),
    );

    const rankings: ImageRefRanking[] = [];
    for (const c of eligible) {
      const record = await getChronicle(c.chronicleId);
      if (!record?.imageRefs?.refs) continue;
      for (const ref of record.imageRefs.refs) {
        if (ref.type !== "prompt_request") continue;
        if (!ref.rankedArtisticStyleIds?.length && !ref.rankedCompositionStyleIds?.length && !ref.rankedColorPaletteIds?.length) continue;
        rankings.push({
          chronicleId: c.chronicleId,
          refId: ref.refId,
          rankedArtisticStyleIds: ref.rankedArtisticStyleIds || (ref.suggestedArtisticStyleId ? [ref.suggestedArtisticStyleId] : []),
          rankedCompositionStyleIds: ref.rankedCompositionStyleIds || (ref.suggestedCompositionStyleId ? [ref.suggestedCompositionStyleId] : []),
          rankedColorPaletteIds: ref.rankedColorPaletteIds || (ref.suggestedColorPaletteId ? [ref.suggestedColorPaletteId] : []),
        });
      }
    }

    if (rankings.length === 0) {
      setAssignImageStyleResult({ success: true, count: 0 });
      setTimeout(() => setAssignImageStyleResult(null), 4000);
      return;
    }

    const result = assignImageStyles(rankings, styleLibrary);

    // Write assignments back to chronicle records
    const byChronicle = new Map<string, typeof result.entries>();
    for (const entry of result.entries) {
      const list = byChronicle.get(entry.chronicleId) || [];
      list.push(entry);
      byChronicle.set(entry.chronicleId, list);
    }

    for (const [chronicleId, entries] of byChronicle) {
      const record = await getChronicle(chronicleId);
      if (!record?.imageRefs?.refs) continue;
      const entryMap = new Map(entries.map((e) => [e.refId, e]));
      for (const ref of record.imageRefs.refs) {
        if (ref.type !== "prompt_request") continue;
        const assignment = entryMap.get(ref.refId);
        if (!assignment) continue;
        ref.suggestedArtisticStyleId = assignment.assignedArtisticStyleId;
        ref.suggestedCompositionStyleId = assignment.assignedCompositionStyleId;
        ref.suggestedColorPaletteId = assignment.assignedColorPaletteId;
      }
      record.updatedAt = Date.now();
      await db.chronicles.put(record);
    }

    await refresh();

    const shifted = result.entries.filter((e) => e.artisticShifted || e.compositionShifted || e.paletteShifted).length;
    setAssignImageStyleResult({ success: true, count: rankings.length });
    console.log(`[AssignImageStyles] Assigned ${rankings.length} refs across ${byChronicle.size} chronicles, ${shifted} shifted for distribution`);
    setTimeout(() => setAssignImageStyleResult(null), 4000);
  }, [chronicleItems, refresh, styleLibrary]);

  // ── Assign cover image styles (deterministic distribution) ──

  const [assignCoverImageStyleResult, setAssignCoverImageStyleResult] = useState<OperationResult | null>(null);

  const handleAssignCoverImageStyles = useCallback(async () => {
    // Collect ranked lists from all chronicles with tagged cover images
    const eligible = chronicleItems.filter(
      (c) => c.status === "complete" || c.status === "assembly_ready",
    );

    const rankings: ImageRefRanking[] = [];
    for (const c of eligible) {
      const record = await getChronicle(c.chronicleId);
      if (!record?.coverImage) continue;
      const ci = record.coverImage;
      if (!ci.rankedArtisticStyleIds?.length && !ci.rankedColorPaletteIds?.length) continue;
      // Composition is hardcoded by narrative style — use a single-element ranked list
      const coverConfig = getCoverImageConfig(c.narrativeStyleId || "epic-drama");
      rankings.push({
        chronicleId: c.chronicleId,
        refId: c.chronicleId, // use chronicleId as refId since cover images are 1:1
        rankedArtisticStyleIds: ci.rankedArtisticStyleIds || (ci.suggestedArtisticStyleId ? [ci.suggestedArtisticStyleId] : []),
        rankedCompositionStyleIds: [coverConfig.compositionStyleId],
        rankedColorPaletteIds: ci.rankedColorPaletteIds || (ci.suggestedColorPaletteId ? [ci.suggestedColorPaletteId] : []),
      });
    }

    if (rankings.length === 0) {
      setAssignCoverImageStyleResult({ success: true, count: 0 });
      setTimeout(() => setAssignCoverImageStyleResult(null), 4000);
      return;
    }

    const result = assignImageStyles(rankings, styleLibrary);

    // Write assignments back to chronicle records
    for (const entry of result.entries) {
      const record = await getChronicle(entry.chronicleId);
      if (!record?.coverImage) continue;
      record.coverImage.suggestedArtisticStyleId = entry.assignedArtisticStyleId;
      record.coverImage.suggestedCompositionStyleId = entry.assignedCompositionStyleId;
      record.coverImage.suggestedColorPaletteId = entry.assignedColorPaletteId;
      record.updatedAt = Date.now();
      await db.chronicles.put(record);
    }

    await refresh();

    const shifted = result.entries.filter((e) => e.artisticShifted || e.paletteShifted).length;
    setAssignCoverImageStyleResult({ success: true, count: rankings.length });
    console.log(`[AssignCoverImageStyles] Assigned ${rankings.length} cover images, ${shifted} shifted for distribution`);
    setTimeout(() => setAssignCoverImageStyleResult(null), 4000);
  }, [chronicleItems, refresh, styleLibrary]);

  // ── Bulk generate scene images ──

  const [bulkGenerateSceneResult, setBulkGenerateSceneResult] = useState<OperationResult | null>(null);

  const handleBulkGenerateSceneImages = useCallback(async () => {
    if (!styleLibrary) return;

    // Build lookup maps for styles
    const artisticMap = new Map(styleLibrary.artisticStyles.map((s) => [s.id, s]));
    const compositionMap = new Map(styleLibrary.compositionStyles.map((s) => [s.id, s]));
    const paletteMap = new Map(styleLibrary.colorPalettes.map((s) => [s.id, s]));

    // Build entity nav map from full entity map for name annotation (all ~300 entities)
    const entityNavMap = new Map<string, EntityNavItem>();
    for (const [id, entity] of fullEntityMapRef.current) {
      entityNavMap.set(id, entity as unknown as EntityNavItem);
    }

    const eligible = chronicleItems.filter(
      (c) =>
        (c.imageRefTotalCount ?? 0) > 0 &&
        (c.status === "complete" || c.status === "assembly_ready"),
    );

    const items: Array<Record<string, unknown>> = [];

    for (const c of eligible) {
      const record = await getChronicle(c.chronicleId);
      if (!record?.imageRefs?.refs) continue;

      // Build cast from chronicle's declared cast (selectedEntityIds)
      const chronicleCast: CastMember[] = [];
      for (const entityId of record.selectedEntityIds || []) {
        const entity = fullEntityMapRef.current.get(entityId);
        if (entity && entity.kind !== "era") {
          chronicleCast.push({ name: entity.name, kind: entity.kind, subtype: entity.subtype, culture: entity.culture });
        }
      }

      for (const ref of record.imageRefs.refs) {
        if (ref.type !== "prompt_request") continue;
        // Skip refs that already have a generated image
        if (ref.generatedImageId) continue;
        // Require all three style assignments
        if (!ref.suggestedArtisticStyleId || !ref.suggestedCompositionStyleId || !ref.suggestedColorPaletteId) continue;

        const artistic = artisticMap.get(ref.suggestedArtisticStyleId);
        const composition = compositionMap.get(ref.suggestedCompositionStyleId);
        const palette = paletteMap.get(ref.suggestedColorPaletteId);

        if (!artistic || !composition) continue;

        const styleInfo = {
          artisticPromptFragment: artistic.promptFragment,
          compositionPromptFragment: composition.promptFragment,
          colorPalettePromptFragment: palette?.promptFragment,
        };

        // Annotate entity names in scene description across all entities
        const annotatedScene = annotateEntityNames(ref.sceneDescription, entityNavMap);

        const prompt = buildChronicleScenePrompt(
          {
            sceneDescription: annotatedScene,
            size: ref.size || "medium",
            chronicleTitle: record.title || c.title || c.name,
            world: worldContext
              ? {
                  name: worldContext.name,
                  description: worldContext.description,
                  speciesConstraint: worldContext.speciesConstraint,
                }
              : undefined,
            cast: chronicleCast,
          },
          styleInfo,
        );

        // Use composition's default aspect to pick image size
        const aspect = composition.defaultImageAspect || "landscape";
        const imageSize = getSizeForAspect(imageModel, aspect);

        const primaryRole = c.roleAssignments?.find((r) => r.isPrimary) || c.roleAssignments?.[0];
        const entity = primaryRole
          ? { id: primaryRole.entityId, name: primaryRole.entityName, kind: primaryRole.entityKind }
          : { id: c.chronicleId, name: c.title || "Chronicle", kind: "chronicle" };

        items.push({
          entity,
          type: "image",
          prompt,
          chronicleId: c.chronicleId,
          imageRefId: ref.refId,
          sceneDescription: ref.sceneDescription,
          imageType: "chronicle",
          imageSize,
          imageQuality: chronicleImageQuality,
        });
      }
    }

    if (items.length === 0) {
      setBulkGenerateSceneResult({ success: true, count: 0 });
      setTimeout(() => setBulkGenerateSceneResult(null), 4000);
      return;
    }

    // Enqueue one at a time with a 10s delay to avoid OpenAI rate limits
    const DELAY_MS = 10_000;
    let enqueued = 0;
    for (const item of items) {
      if (enqueued > 0) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
      onEnqueue([item]);
      enqueued++;
      setBulkGenerateSceneResult({ success: true, count: enqueued });
      console.log(`[BulkGenerateSceneImages] Enqueued ${enqueued}/${items.length}`);
    }

    setTimeout(() => setBulkGenerateSceneResult(null), 4000);
  }, [chronicleItems, onEnqueue, styleLibrary, worldContext, imageModel, chronicleImageQuality, fullEntityMapRef]);

  // ── Bulk generate cover images ──

  const [bulkGenerateCoverImageResult, setBulkGenerateCoverImageResult] = useState<OperationResult | null>(null);

  const handleBulkGenerateCoverImages = useCallback(async () => {
    if (!styleLibrary) return;

    const artisticMap = new Map(styleLibrary.artisticStyles.map((s) => [s.id, s]));
    const compositionMap = new Map(styleLibrary.compositionStyles.map((s) => [s.id, s]));
    const paletteMap = new Map(styleLibrary.colorPalettes.map((s) => [s.id, s]));

    const entityNavMap = new Map<string, EntityNavItem>();
    for (const [id, entity] of fullEntityMapRef.current) {
      entityNavMap.set(id, entity as unknown as EntityNavItem);
    }

    const eligible = chronicleItems.filter(
      (c) => c.status === "complete" || c.status === "assembly_ready",
    );

    const items: Array<Record<string, unknown>> = [];

    for (const c of eligible) {
      const record = await getChronicle(c.chronicleId);
      if (!record?.coverImage?.sceneDescription) continue;
      // Skip cover images that already have a generated image
      if (record.coverImage.generatedImageId) continue;
      // Require assigned artistic style and palette
      if (!record.coverImage.suggestedArtisticStyleId) continue;

      const artistic = artisticMap.get(record.coverImage.suggestedArtisticStyleId);
      if (!artistic) continue;

      // Composition from narrative style config
      const coverConfig = getCoverImageConfig(c.narrativeStyleId || "epic-drama");
      const composition = compositionMap.get(coverConfig.compositionStyleId);
      const palette = record.coverImage.suggestedColorPaletteId
        ? paletteMap.get(record.coverImage.suggestedColorPaletteId)
        : undefined;

      const styleInfo = {
        compositionPromptFragment:
          composition?.promptFragment ||
          "cinematic montage composition, overlapping character silhouettes and scene elements, layered movie-poster layout, multiple focal points at different scales, dramatic depth layering, figures and settings blending into each other, NO TEXT NO TITLES NO LETTERING",
        artisticPromptFragment: artistic.promptFragment,
        colorPalettePromptFragment: palette?.promptFragment,
      };

      // Build cast
      const chronicleCast: CastMember[] = [];
      for (const entityId of record.selectedEntityIds || []) {
        const entity = fullEntityMapRef.current.get(entityId);
        if (entity && entity.kind !== "era") {
          chronicleCast.push({ name: entity.name, kind: entity.kind, subtype: entity.subtype, culture: entity.culture });
        }
      }

      const annotatedScene = annotateEntityNames(record.coverImage.sceneDescription, entityNavMap);

      const prompt = buildChronicleScenePrompt(
        {
          sceneDescription: annotatedScene,
          size: "medium",
          chronicleTitle: record.title || c.title || c.name,
          world: worldContext
            ? {
                name: worldContext.name,
                description: worldContext.description,
                speciesConstraint: worldContext.speciesConstraint,
              }
            : undefined,
          cast: chronicleCast,
        },
        styleInfo,
      );

      const aspect = composition?.defaultImageAspect || "landscape";
      const imageSize = getSizeForAspect(imageModel, aspect);

      items.push({
        entity: {
          id: c.chronicleId,
          name: c.title || c.name || "Chronicle",
          kind: "chronicle",
        },
        type: "image",
        prompt,
        chronicleId: c.chronicleId,
        imageRefId: "__cover_image__",
        sceneDescription: record.coverImage.sceneDescription,
        imageType: "chronicle",
        imageSize,
        imageQuality: chronicleImageQuality,
      });
    }

    if (items.length === 0) {
      setBulkGenerateCoverImageResult({ success: true, count: 0 });
      setTimeout(() => setBulkGenerateCoverImageResult(null), 4000);
      return;
    }

    // Enqueue one at a time with a 10s delay to avoid rate limits
    const DELAY_MS = 10_000;
    let enqueued = 0;
    for (const item of items) {
      if (enqueued > 0) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
      onEnqueue([item]);
      enqueued++;
      setBulkGenerateCoverImageResult({ success: true, count: enqueued });
      console.log(`[BulkGenerateCoverImages] Enqueued ${enqueued}/${items.length}`);
    }

    setTimeout(() => setBulkGenerateCoverImageResult(null), 4000);
  }, [chronicleItems, onEnqueue, styleLibrary, worldContext, imageModel, chronicleImageQuality, fullEntityMapRef]);

  // ── Bulk clear scene images ──

  const [bulkClearSceneImageResult, setBulkClearSceneImageResult] = useState<OperationResult | null>(null);

  const handleBulkClearSceneImages = useCallback(async () => {
    const eligible = chronicleItems.filter(
      (c) =>
        c.imageRefCompleteCount > 0 &&
        (c.status === "complete" || c.status === "assembly_ready"),
    );
    if (eligible.length === 0) {
      setBulkClearSceneImageResult({ success: true, count: 0 });
      setTimeout(() => setBulkClearSceneImageResult(null), 4000);
      return;
    }

    let totalCleared = 0;
    for (const c of eligible) {
      totalCleared += await clearChronicleSceneImages(c.chronicleId);
    }
    await refresh();
    setBulkClearSceneImageResult({ success: true, count: totalCleared });
    setTimeout(() => setBulkClearSceneImageResult(null), 4000);
  }, [chronicleItems, refresh]);

  // ── Bulk clear cover images ──

  const [bulkClearCoverImageResult, setBulkClearCoverImageResult] = useState<OperationResult | null>(null);

  const handleBulkClearCoverImages = useCallback(async () => {
    // clearChronicleCoverImage checks for coverImage existence internally
    const eligible = chronicleItems.filter(
      (c) => c.status === "complete" || c.status === "assembly_ready",
    );
    if (eligible.length === 0) {
      setBulkClearCoverImageResult({ success: true, count: 0 });
      setTimeout(() => setBulkClearCoverImageResult(null), 4000);
      return;
    }

    let cleared = 0;
    for (const c of eligible) {
      const didClear = await clearChronicleCoverImage(c.chronicleId);
      if (didClear) cleared++;
    }
    await refresh();
    setBulkClearCoverImageResult({ success: true, count: cleared });
    setTimeout(() => setBulkClearCoverImageResult(null), 4000);
  }, [chronicleItems, refresh]);

  // ── Bulk generate cover scenes ──

  const [bulkGenerateCoverSceneResult, setBulkGenerateCoverSceneResult] = useState<OperationResult | null>(null);

  const handleBulkGenerateCoverScenes = useCallback(() => {
    const eligible = chronicleItems.filter(
      (c) => c.status === "complete" || c.status === "assembly_ready",
    );
    if (eligible.length === 0) {
      setBulkGenerateCoverSceneResult({ success: true, count: 0 });
      setTimeout(() => setBulkGenerateCoverSceneResult(null), 4000);
      return;
    }

    // Build visual identities from the full entity map
    const visualIdentities: Record<string, string> = {};
    for (const [id, entity] of fullEntityMapRef.current) {
      const thesis = entity.enrichment?.text?.visualThesis;
      if (typeof thesis === "string") {
        visualIdentities[id] = thesis;
      }
    }

    const items = eligible.map((c) => {
      const primaryRole = c.roleAssignments?.find((r) => r.isPrimary) || c.roleAssignments?.[0];
      const entity = buildQueueEntity(primaryRole, c);
      return {
        entity,
        type: "entityChronicle",
        prompt: "",
        chronicleStep: "cover_image_scene",
        chronicleId: c.chronicleId,
        chronicleContext: { narrativeStyle: { id: c.narrativeStyleId || "epic-drama" } },
        visualIdentities,
      };
    });
    onEnqueue(items);
    setBulkGenerateCoverSceneResult({ success: true, count: eligible.length });
    setTimeout(() => setBulkGenerateCoverSceneResult(null), 4000);
  }, [chronicleItems, onEnqueue, fullEntityMapRef]);

  return {
    // Backport state & handlers
    showResetBackportModal,
    resetBackportResult,
    setResetBackportResult,
    reconcileBackportResult,
    setReconcileBackportResult,
    handleOpenResetBackportModal,
    handleResetBackportConfirm,
    handleResetBackportCancel,
    handleReconcileBackports,
    // Tertiary
    tertiaryDetectResult,
    setTertiaryDetectResult,
    handleBulkDetectTertiary,
    // Era summary
    eraSummaryRefreshResult,
    setEraSummaryRefreshResult,
    // Temporal check
    temporalCheckResult,
    setTemporalCheckResult,
    handleBulkTemporalCheck,
    // Bulk summary
    bulkSummaryResult,
    setBulkSummaryResult,
    handleBulkSummary,
    // Historian prep
    handleBulkHistorianPrep,
    // Bulk image ref regeneration
    bulkImageRefResult,
    setBulkImageRefResult,
    handleBulkRegenerateImageRefs,
    // Bulk tag image refs
    bulkTagImageRefResult,
    setBulkTagImageRefResult,
    handleBulkTagImageRefs,
    // Bulk clear image refs
    bulkClearImageRefResult,
    setBulkClearImageRefResult,
    handleBulkClearImageRefs,
    // Assign image styles
    assignImageStyleResult,
    setAssignImageStyleResult,
    handleAssignImageStyles,
    // Assign cover image styles
    assignCoverImageStyleResult,
    setAssignCoverImageStyleResult,
    handleAssignCoverImageStyles,
    // Bulk generate scene images
    bulkGenerateSceneResult,
    setBulkGenerateSceneResult,
    handleBulkGenerateSceneImages,
    // Bulk generate cover images
    bulkGenerateCoverImageResult,
    setBulkGenerateCoverImageResult,
    handleBulkGenerateCoverImages,
    // Bulk clear scene images
    bulkClearSceneImageResult,
    setBulkClearSceneImageResult,
    handleBulkClearSceneImages,
    // Bulk clear cover images
    bulkClearCoverImageResult,
    setBulkClearCoverImageResult,
    handleBulkClearCoverImages,
    // Bulk generate cover scenes
    bulkGenerateCoverSceneResult,
    setBulkGenerateCoverSceneResult,
    handleBulkGenerateCoverScenes,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RoleAssignment {
  entityId: string;
  entityName: string;
  entityKind: string;
  isPrimary: boolean;
}

function buildQueueEntity(
  primaryRole: RoleAssignment | undefined,
  c: ChronicleNavItem,
): Record<string, unknown> {
  if (primaryRole) {
    return {
      id: primaryRole.entityId,
      name: primaryRole.entityName,
      kind: primaryRole.entityKind,
      subtype: "",
      prominence: "recognized",
      culture: "",
      status: "active",
      description: "",
      tags: {},
    };
  }
  return {
    id: c.chronicleId,
    name: c.title || "Chronicle",
    kind: "chronicle",
    subtype: "",
    prominence: "recognized",
    culture: "",
    status: "active",
    description: "",
    tags: {},
  };
}
