/**
 * BulkActionsTab — Consolidated bulk operations workspace.
 *
 * Full-width action dashboard organized into sections by operation type.
 * Active inline modals appear in a panel below the action grid.
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { StyleLibrary } from "@canonry/world-schema";
import type { PersistedEntity } from "../../lib/db/illuminatorDb";
import { useIlluminatorConfigStore } from "../../lib/db/illuminatorConfigStore";
import { useChronicleStore } from "../../lib/db/chronicleStore";
import { useChronicleNavItems } from "../../lib/db/chronicleSelectors";
import { useEntityStore } from "../../lib/db/entityStore";
import { useEntityNavItems, useEntityNavList } from "../../lib/db/entitySelectors";
import { useRelationshipsByEntity } from "../../lib/db/relationshipSelectors";
import {
  useProminenceScale,
  useProminentByCulture,
  useEraTemporalInfo,
} from "../../lib/db/indexSelectors";
import { getEntitiesForRun, convertLongEditionsToLegacy } from "../../lib/db/entityRepository";
import { reloadEntities } from "../../hooks/useEntityCrud";
import { isHistorianConfigured } from "../../lib/historianTypes";

// Chronicle bulk
import { useChronicleBulkOperations } from "../chronicle-panel/useChronicleBulkOperations";
import { useFactCoverage } from "../../hooks/useFactCoverage";
import { useToneRanking } from "../../hooks/useToneRanking";
import { useBulkChronicleAnnotationStore } from "../../lib/db/bulkChronicleAnnotationStore";
import { useInterleavedAnnotationStore } from "../../lib/db/interleavedAnnotationStore";
import { useBulkTagImageRefsStore } from "../../lib/db/bulkTagImageRefsStore";
import { useBulkTagCoverImagesStore } from "../../lib/db/bulkTagCoverImagesStore";
import { useBulkEraNarrativeStore } from "../../lib/db/bulkEraNarrativeStore";
import { downloadBulkToneReviewExport, downloadBulkAnnotationReviewExport } from "../../lib/chronicleExport";
import { getChroniclesForSimulation, updateChronicleHistorianPrep } from "../../lib/db/chronicleRepository";
import { annotateEntityNames } from "../../lib/annotateEntityNames";
import { useIlluminatorModals } from "../../lib/db/modalStore";

// Entity bulk
import { useEntityBulkImageOperations } from "../../hooks/useEntityBulkImageOperations";

// Inline modals
import BulkTagImageRefsModal from "../BulkTagImageRefsModal";
import BulkTagCoverImagesModal from "../BulkTagCoverImagesModal";
import BulkFactCoverageModal from "../BulkFactCoverageModal";
import BulkBackportModal from "../BulkBackportModal";
import BulkHistorianModal from "../BulkHistorianModal";
import BulkToneRankingModal from "../BulkToneRankingModal";
import BulkChronicleAnnotationModal from "../BulkChronicleAnnotationModal";
import BulkEraNarrativeModal from "../BulkEraNarrativeModal";
import InterleavedAnnotationModal from "../InterleavedAnnotationModal";
import ToneAssignmentPreviewModal from "../ToneAssignmentPreviewModal";

// Toasts
import {
  EraSummaryRefreshToast,
  TemporalCheckToast,
  BulkSummaryToast,
  BulkImageRefToast,
  BulkClearImageRefToast,
  AssignImageStyleToast,
  BulkGenerateSceneToast,
  BulkClearSceneImageToast,
  BulkGenerateCoverSceneToast,
  AssignSecondaryStyleToast,
  AssignCoverImageStyleToast,
  BulkGenerateCoverImageToast,
  BulkClearCoverImageToast,
  ResetBackportToast,
  ReconcileBackportToast,
} from "../chronicle-panel/ChroniclePanelToasts";
import { ResetBackportModal } from "../chronicle-panel/ChroniclePanelModals";

import "./BulkActionsTab.css";

interface Props {
  styleLibrary: StyleLibrary | null;
  imageModel: string;
  imageQuality: string;
  onEnqueue: (items: Array<Record<string, unknown>>) => void;
  backportFlow: Record<string, unknown>;
  historianFlow: Record<string, unknown>;
  onRefreshEraSummaries?: () => Promise<number>;
}

export default function BulkActionsTab({
  styleLibrary,
  imageModel,
  imageQuality,
  onEnqueue,
  backportFlow,
  historianFlow,
  onRefreshEraSummaries,
}: Readonly<Props>) {
  const {
    simulationRunId,
    projectId,
    worldContext,
    entityGuidance,
    cultureIdentities,
    historianConfig,
  } = useIlluminatorConfigStore();

  // ─── Pipeline collapse state ──────────────────────────────────────
  const COLLAPSE_KEY = "illuminator:bat:collapsed";
  const ALL_PIPELINES = ["validation", "backport", "scene", "cover", "entityimg", "chrhistorian", "tone", "entityhist"];
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set(ALL_PIPELINES);
    } catch { return new Set(ALL_PIPELINES); }
  });
  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  // ─── Chronicle data ──────────────────────────────────────────────
  const chronicleInitialize = useChronicleStore((s) => s.initialize);
  const chronicleInitialized = useChronicleStore((s) => s.initialized);
  useEffect(() => {
    if (simulationRunId && !chronicleInitialized) chronicleInitialize(simulationRunId);
  }, [simulationRunId, chronicleInitialized, chronicleInitialize]);

  const chronicleItems = useChronicleNavItems();
  const refresh = useCallback(() => useChronicleStore.getState().refreshAll(), []);

  // Full entity map ref (needed by useChronicleBulkOperations)
  const fullEntityMapRef = useRef<Map<string, PersistedEntity>>(new Map());
  useEffect(() => {
    if (!simulationRunId) return;
    let cancelled = false;
    void getEntitiesForRun(simulationRunId).then((ents) => {
      if (!cancelled) fullEntityMapRef.current = new Map(ents.map((e) => [e.id, e]));
    });
    return () => { cancelled = true; };
  }, [simulationRunId]);

  const [skipCompletedPrep, setSkipCompletedPrep] = useState(true);
  const historianConfigured = isHistorianConfigured(historianConfig);

  // ─── Chronicle bulk operations ───────────────────────────────────
  const bulk = useChronicleBulkOperations({
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
    chronicleImageQuality: imageQuality,
  });

  // Fact coverage
  const { progress: factCoverageProgress, isActive: isFactCoverageActive, prepareFactCoverage, confirmFactCoverage, cancelFactCoverage, closeFactCoverage } = useFactCoverage();

  // Tone ranking
  const { progress: toneRankingProgress, isActive: isToneRankingActive, prepareToneRanking, prepareAssignment } = useToneRanking();

  // Annotation stores
  const bulkAnnotationProgress = useBulkChronicleAnnotationStore((s) => s.progress);
  const prepareBulkAnnotation = useBulkChronicleAnnotationStore((s) => s.prepareAnnotation);
  const isBulkAnnotationActive = bulkAnnotationProgress.status === "running" || bulkAnnotationProgress.status === "confirming";
  const confirmBulkAnnotation = useBulkChronicleAnnotationStore((s) => s.confirmAnnotation);
  const cancelBulkAnnotation = useBulkChronicleAnnotationStore((s) => s.cancelAnnotation);
  const closeBulkAnnotation = useBulkChronicleAnnotationStore((s) => s.closeAnnotation);
  const prepareInterleaved = useInterleavedAnnotationStore((s) => s.prepareInterleaved);
  const interleavedProgress = useInterleavedAnnotationStore((s) => s.progress);
  const isInterleavedActive = interleavedProgress.status === "running" || interleavedProgress.status === "confirming";
  const confirmInterleaved = useInterleavedAnnotationStore((s) => s.confirmInterleaved);
  const cancelInterleaved = useInterleavedAnnotationStore((s) => s.cancelInterleaved);
  const closeInterleaved = useInterleavedAnnotationStore((s) => s.closeInterleaved);

  // Tag stores
  const bulkTagProgress = useBulkTagImageRefsStore((s) => s.progress);
  const prepareBulkTag = useBulkTagImageRefsStore((s) => s.prepareTag);
  const confirmBulkTag = useBulkTagImageRefsStore((s) => s.confirmTag);
  const cancelBulkTag = useBulkTagImageRefsStore((s) => s.cancelTag);
  const closeBulkTag = useBulkTagImageRefsStore((s) => s.closeTag);

  const bulkTagCoverProgress = useBulkTagCoverImagesStore((s) => s.progress);
  const prepareBulkTagCover = useBulkTagCoverImagesStore((s) => s.prepareTag);
  const confirmBulkTagCover = useBulkTagCoverImagesStore((s) => s.confirmTag);
  const cancelBulkTagCover = useBulkTagCoverImagesStore((s) => s.cancelTag);
  const closeBulkTagCover = useBulkTagCoverImagesStore((s) => s.closeTag);

  // Era narrative
  const bulkEraNarrativeProgress = useBulkEraNarrativeStore((s) => s.progress);
  const [showBulkEraNarrative, setShowBulkEraNarrative] = useState(false);

  // Tone assignment
  const toneAssignmentPreview = useToneRanking().assignmentPreview ?? null;
  const applyToneAssignment = useToneRanking().applyAssignment;
  const closeToneAssignment = useToneRanking().closeAssignment;
  const toneConfirm = useToneRanking().confirmToneRanking;
  const toneCancel = useToneRanking().cancelToneRanking;
  const toneClose = useToneRanking().closeToneRanking;

  // Entity nav items for interleaved annotations
  const entityNavItemsMap = useEntityStore((s) => s.navItems);

  // Amend briefs
  const handleAmendBriefs = useCallback(() => {
    void (async () => {
      if (!simulationRunId || entityNavItemsMap.size === 0) return;
      const chronicles = await getChroniclesForSimulation(simulationRunId);
      let amended = 0;
      for (const record of chronicles) {
        if (!record.historianPrep) continue;
        const annotated = annotateEntityNames(record.historianPrep, entityNavItemsMap);
        if (annotated !== record.historianPrep) {
          await updateChronicleHistorianPrep(record.chronicleId, annotated);
          amended++;
        }
      }
      console.log(`[Amend Briefs] Annotated ${amended}/${chronicles.filter((c: Record<string, unknown>) => c.historianPrep).length} briefs`);
    })();
  }, [simulationRunId, entityNavItemsMap]);

  // ─── Entity bulk operations ──────────────────────────────────────
  const navItems = useEntityStore((s) => s.navItems);
  const entityNavItems = useMemo(() => Array.from(navItems.values()), [navItems]);
  const refreshAll = useEntityStore((s) => s.refreshAll);
  const entityNavMap = useEntityNavItems();
  const relationshipsByEntity = useRelationshipsByEntity();
  const prominenceScale = useProminenceScale();
  const prominentByCulture = useProminentByCulture();
  const eraTemporalInfo = useEraTemporalInfo();
  const currentEra = useMemo(() => {
    if (eraTemporalInfo.length === 0) return null;
    const last = eraTemporalInfo[eraTemporalInfo.length - 1];
    return { name: last.name, description: last.summary };
  }, [eraTemporalInfo]);

  const entityBulkOps = useEntityBulkImageOperations({
    entityNavItems,
    simulationRunId,
    styleLibrary,
    imageModel,
    imageQuality,
    onEnqueue,
    refresh: refreshAll,
    entityGuidance,
    cultureIdentities,
    worldContext,
    relationshipsByEntity,
    entityNavMap,
    prominenceScale,
    currentEra,
    prominentByCulture,
  });

  const taggedCount = useMemo(() => entityNavItems.filter((e) => e.hasImageStyle).length, [entityNavItems]);
  const imageCount = useMemo(() => entityNavItems.filter((e) => e.imageId).length, [entityNavItems]);

  // ─── Backport/historian flow props ───────────────────────────────
  const bf = backportFlow as Record<string, (...args: unknown[]) => unknown>;
  const hf = historianFlow as Record<string, (...args: unknown[]) => unknown>;

  // ─── Entity historian counts ──────────────────────────────────────
  const entityHistorianCounts = useMemo(() => {
    let annotationEligible = 0;
    let copyEditEligible = 0;
    let reEditionEligible = 0;
    let legacyConvertEligible = 0;
    let annotated = 0;
    for (const nav of entityNavItems) {
      if (nav.hasDescription && !nav.hasHistorianNotes) annotationEligible++;
      if (nav.hasDescription && !nav.hasHistorianEdition) copyEditEligible++;
      if (nav.hasDescription && nav.hasHistorianEdition) reEditionEligible++;
      if (nav.hasHistorianEdition) legacyConvertEligible++;
      if (nav.hasHistorianNotes) annotated++;
    }
    return { annotationEligible, copyEditEligible, reEditionEligible, legacyConvertEligible, annotated };
  }, [entityNavItems]);

  const handleEntityAnnotateAll = useCallback(() => {
    const ids = entityNavItems.filter((n) => n.hasDescription && !n.hasHistorianNotes).map((n) => n.id);
    (hf.handleStartBulkHistorianReview as (ids: string[]) => void)(ids);
  }, [entityNavItems, hf]);

  const handleEntityCopyEditAll = useCallback(() => {
    const ids = entityNavItems.filter((n) => n.hasDescription && !n.hasHistorianEdition).map((n) => n.id);
    (hf.handleStartBulkHistorianEdition as (ids: string[], reEdit?: boolean) => void)(ids);
  }, [entityNavItems, hf]);

  const handleEntityReEditAll = useCallback(() => {
    const ids = entityNavItems.filter((n) => n.hasDescription && n.hasHistorianEdition).map((n) => n.id);
    (hf.handleStartBulkHistorianEdition as (ids: string[], reEdit?: boolean) => void)(ids, true);
  }, [entityNavItems, hf]);

  const handleEntityConvertToLegacy = useCallback(() => {
    void (async () => {
      const ids = entityNavItems.filter((n) => n.hasHistorianEdition).map((n) => n.id);
      const count = await convertLongEditionsToLegacy(ids);
      if (count > 0) await reloadEntities(ids);
    })();
  }, [entityNavItems]);

  const handleEntityClearAllNotes = useCallback(() => {
    const ids = entityNavItems.filter((n) => n.hasHistorianNotes).map((n) => n.id);
    (hf.handleStartBulkHistorianClear as (ids: string[]) => void)(ids);
  }, [entityNavItems, hf]);

  const historianDisabledTitle = "Configure historian persona first";
  const toneProgressText = toneRankingProgress.status === "complete"
    ? `Ranked ${toneRankingProgress.processedChronicles}/${toneRankingProgress.totalChronicles}`
    : toneRankingProgress.status === "failed"
      ? (toneRankingProgress.error || "Failed")
      : null;

  const handleRefreshEraSummaries = useCallback(() => {
    if (!onRefreshEraSummaries) return;
    void (async () => {
      try {
        const count = await onRefreshEraSummaries();
        bulk.setEraSummaryRefreshResult({ success: true, count });
      } catch (err: unknown) {
        bulk.setEraSummaryRefreshResult({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
      }
    })();
  }, [onRefreshEraSummaries, bulk]);

  const isBulkHistActive = Boolean(hf.isBulkHistorianActive);

  return (
    <div className="bat-layout">

      {/* ─── Active operations (inline modals) ─── */}
      <div className="bat-operations">
        <BulkTagImageRefsModal progress={bulkTagProgress} onConfirm={confirmBulkTag} onCancel={cancelBulkTag} onClose={closeBulkTag} renderMode="inline" />
        <BulkTagCoverImagesModal progress={bulkTagCoverProgress} onConfirm={confirmBulkTagCover} onCancel={cancelBulkTagCover} onClose={closeBulkTagCover} renderMode="inline" />
        <BulkFactCoverageModal progress={factCoverageProgress} onConfirm={confirmFactCoverage} onCancel={cancelFactCoverage} onClose={closeFactCoverage} renderMode="inline" />

        {(bf.showBulkBackportModal as boolean) && (
          <BulkBackportModal progress={bf.bulkBackportProgress} onConfirm={bf.handleConfirmBulkBackport} onCancel={bf.handleCancelBulkBackport} onClose={bf.handleCloseBulkBackport} renderMode="inline" />
        )}
        {(hf.showBulkHistorianModal as boolean) && (
          <BulkHistorianModal progress={hf.bulkHistorianProgress} onConfirm={hf.handleConfirmBulkHistorian} onCancel={hf.handleCancelBulkHistorian} onClose={hf.handleCloseBulkHistorian} onChangeTone={hf.setBulkHistorianTone} editionMaxTokens={hf.editionMaxTokens} renderMode="inline" />
        )}

        <BulkToneRankingModal progress={toneRankingProgress} onConfirm={toneConfirm} onCancel={toneCancel} onClose={toneClose} renderMode="inline" />
        <ToneAssignmentPreviewModal preview={toneAssignmentPreview} onApply={applyToneAssignment} onClose={closeToneAssignment} />
        <BulkChronicleAnnotationModal progress={bulkAnnotationProgress} onConfirm={confirmBulkAnnotation} onCancel={cancelBulkAnnotation} onClose={closeBulkAnnotation} renderMode="inline" />
        <InterleavedAnnotationModal progress={interleavedProgress} onConfirm={confirmInterleaved} onCancel={cancelInterleaved} onClose={closeInterleaved} />

        <BulkEraNarrativeModal
          isOpen={showBulkEraNarrative || bulkEraNarrativeProgress.status === "running"}
          onClose={() => setShowBulkEraNarrative(false)}
          chronicleItems={chronicleItems}
          wizardEras={eraTemporalInfo}
          eraTemporalInfo={eraTemporalInfo}
          projectId={projectId}
          simulationRunId={simulationRunId}
          styleLibrary={styleLibrary}
          renderMode="inline"
        />
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="bat-phase">Content</div>

      <section className="bat-pipeline">
        <div className={`bat-pipeline-header${collapsed.has("validation") ? " bat-pipeline-collapsed" : ""}`} onClick={() => toggle("validation")}>
          <h3 className="bat-pipeline-title"><span className={`bat-pipeline-arrow${collapsed.has("validation") ? "" : " bat-pipeline-arrow-open"}`}>&#9656;</span>Validation</h3>
        </div>
        {!collapsed.has("validation") && <div className="bat-steps">
          <button onClick={bulk.handleBulkTemporalCheck} className="illuminator-btn" title="Re-run temporal alignment check on all chronicles that have a temporal narrative">Temporal Check</button>
          <button onClick={() => void bulk.handleBulkDetectTertiary()} disabled={bulk.tertiaryDetectResult?.running ?? false} className="illuminator-btn" title="Re-detect tertiary cast on all chronicles">{bulk.tertiaryDetectResult?.running ? "Detecting..." : "Detect Tertiary"}</button>
          {onRefreshEraSummaries && <button onClick={handleRefreshEraSummaries} className="illuminator-btn" title="Refresh era summaries in all chronicle temporal contexts">Era Summaries</button>}
          <button onClick={bulk.handleBulkSummary} className="illuminator-btn" title="Generate summaries for all chronicles missing them">Summaries</button>
          <button onClick={() => prepareFactCoverage(chronicleItems)} disabled={isFactCoverageActive} className="illuminator-btn" title="Analyze canon fact coverage across all chronicles">{isFactCoverageActive ? "Analyzing..." : "Fact Coverage"}</button>
        </div>}
      </section>

      <section className="bat-pipeline">
        <div className={`bat-pipeline-header${collapsed.has("backport") ? " bat-pipeline-collapsed" : ""}`} onClick={() => toggle("backport")}>
          <h3 className="bat-pipeline-title"><span className={`bat-pipeline-arrow${collapsed.has("backport") ? "" : " bat-pipeline-arrow-open"}`}>&#9656;</span>Backport</h3>
        </div>
        {!collapsed.has("backport") && <>
          <div className="bat-steps">
            <span className="bat-step-num">1</span>
            <button onClick={bf.handleStartBulkBackport as () => void} disabled={Boolean(bf.isBulkBackportActive)} className="illuminator-btn illuminator-btn-primary" title="Backport lore from all published chronicles to cast entities">{bf.isBulkBackportActive ? "Running..." : "Backport All"}</button>
            <span className="bat-step-num">2</span>
            <button onClick={() => void bulk.handleReconcileBackports()} className="illuminator-btn" title="Reconcile backport status from actual entity backrefs">Reconcile</button>
          </div>
          <div className="bat-danger-zone">
            <button onClick={bulk.handleOpenResetBackportModal} className="bat-danger-link" title="Reset per-entity backport status on all chronicles">Reset backport status</button>
          </div>
        </>}
      </section>

      {/* ═══ IMAGES ═══ */}
      <div className="bat-phase">Images</div>

      <section className="bat-pipeline">
        <div className={`bat-pipeline-header${collapsed.has("scene") ? " bat-pipeline-collapsed" : ""}`} onClick={() => toggle("scene")}>
          <h3 className="bat-pipeline-title"><span className={`bat-pipeline-arrow${collapsed.has("scene") ? "" : " bat-pipeline-arrow-open"}`}>&#9656;</span>Scene Images</h3>
        </div>
        {!collapsed.has("scene") && <>
          <div className="bat-steps">
            <span className="bat-step-num">1</span>
            <button onClick={bulk.handleBulkRegenerateImageRefs} className="illuminator-btn" title="Regenerate image refs for all chronicles">Regen Refs</button>
            <span className="bat-step-num">2</span>
            <button onClick={() => styleLibrary && prepareBulkTag(chronicleItems, styleLibrary, simulationRunId, projectId)} className="illuminator-btn" title="Tag image refs with visual tags and suggest styles">Tag</button>
            <span className="bat-step-num">3</span>
            <button onClick={bulk.handleAssignImageStyles} className="illuminator-btn" title="Distribute styles across all tagged image refs (deterministic)">Assign</button>
            <span className="bat-step-num">4</span>
            <button onClick={() => void bulk.handleBulkGenerateSceneImages()} className="illuminator-btn illuminator-btn-primary" title="Generate images for scene refs with assigned styles">Generate</button>
          </div>
          <div className="bat-pipeline-options">
            <label className="bat-option"><input type="checkbox" checked={bulk.useSecondaryStyles} onChange={(e) => bulk.setUseSecondaryStyles(e.target.checked)} /> Use secondary styles</label>
            <button onClick={() => void bulk.handleAssignSecondaryStyles()} className="illuminator-btn" title="Assign secondary style combinations from remaining ranked options">Assign Secondary</button>
          </div>
          <div className="bat-danger-zone">
            <button onClick={bulk.handleBulkClearSceneImages} className="bat-danger-link" title="Clear generated images from all scene refs">Clear images</button>
            <span className="bat-danger-sep">·</span>
            <button onClick={bulk.handleBulkClearImageRefs} className="bat-danger-link" title="Remove all image refs from all chronicles">Clear all refs</button>
          </div>
        </>}
      </section>

      <section className="bat-pipeline">
        <div className={`bat-pipeline-header${collapsed.has("cover") ? " bat-pipeline-collapsed" : ""}`} onClick={() => toggle("cover")}>
          <h3 className="bat-pipeline-title"><span className={`bat-pipeline-arrow${collapsed.has("cover") ? "" : " bat-pipeline-arrow-open"}`}>&#9656;</span>Cover Images</h3>
        </div>
        {!collapsed.has("cover") && <>
          <div className="bat-steps">
            <span className="bat-step-num">1</span>
            <button onClick={bulk.handleBulkGenerateCoverScenes} className="illuminator-btn" title="Generate cover scene descriptions for chronicles missing them">Scenes</button>
            <span className="bat-step-num">2</span>
            <button onClick={() => styleLibrary && prepareBulkTagCover(chronicleItems, styleLibrary, simulationRunId, projectId)} className="illuminator-btn" title="Tag cover images with styles">Tag</button>
            <span className="bat-step-num">3</span>
            <button onClick={() => void bulk.handleAssignCoverImageStyles()} className="illuminator-btn" title="Distribute artistic styles and palettes across all tagged cover images">Assign</button>
            <span className="bat-step-num">4</span>
            <button onClick={() => void bulk.handleBulkGenerateCoverImages()} className="illuminator-btn illuminator-btn-primary" title="Generate cover images with assigned styles">Generate</button>
          </div>
          <div className="bat-danger-zone">
            <button onClick={bulk.handleBulkClearCoverImages} className="bat-danger-link" title="Clear generated cover images">Clear images</button>
            <span className="bat-danger-sep">·</span>
            <button onClick={() => bulk.handleBulkClearByComposition(["chronicle-symbolic", "chronicle-document", "chronicle-folk"])} className="bat-danger-link" title="Clear cover images assigned portrait-era compositions">Clear portrait comps</button>
          </div>
        </>}
      </section>

      <section className="bat-pipeline">
        <div className={`bat-pipeline-header${collapsed.has("entityimg") ? " bat-pipeline-collapsed" : ""}`} onClick={() => toggle("entityimg")}>
          <h3 className="bat-pipeline-title"><span className={`bat-pipeline-arrow${collapsed.has("entityimg") ? "" : " bat-pipeline-arrow-open"}`}>&#9656;</span>Entity Images</h3>
          <span className="bat-pipeline-stats">{taggedCount}/{entityNavItems.length} tagged · {imageCount} images</span>
        </div>
        {!collapsed.has("entityimg") && <>
          <div className="bat-steps">
            <span className="bat-step-num">1</span>
            <button onClick={entityBulkOps.handleTagStyles} className="illuminator-btn" title="LLM batch-tags entities with style rankings">Tag</button>
            <span className="bat-step-num">2</span>
            <button onClick={entityBulkOps.handleAssignPrimaryStyles} className="illuminator-btn" title="Deterministic distribution-balanced primary assignment">Assign</button>
            <span className="bat-step-num">3</span>
            <button onClick={entityBulkOps.handleBulkGenerateImages} className="illuminator-btn illuminator-btn-primary" title="Generate images for entities with style assignments and no active image">Generate</button>
          </div>
          <div className="bat-pipeline-options">
            <label className="bat-option"><input type="checkbox" checked={entityBulkOps.useSecondaryStyles} onChange={(e) => entityBulkOps.setUseSecondaryStyles(e.target.checked)} /> Use secondary styles</label>
            <button onClick={entityBulkOps.handleAssignSecondaryStyles} className="illuminator-btn" title="Pair-novelty greedy secondary assignment">Assign Secondary</button>
          </div>
          {entityBulkOps.tagResult && <div className="bat-status bat-status-ok">{entityBulkOps.tagResult.count} queued for tagging</div>}
          {entityBulkOps.assignResult && <div className="bat-status bat-status-ok">{entityBulkOps.assignResult.count} primary assignments</div>}
          {entityBulkOps.assignSecondaryResult && <div className="bat-status bat-status-ok">{entityBulkOps.assignSecondaryResult.count} secondary assignments</div>}
          {entityBulkOps.generateResult && <div className="bat-status bat-status-ok">{entityBulkOps.generateResult.count} images enqueued</div>}
          <div className="bat-danger-zone">
            <button onClick={entityBulkOps.handleBulkClearImages} className="bat-danger-link" title="Clear active image from all entities">Clear all images</button>
          </div>
        </>}
      </section>

      {/* ═══ HISTORIAN ═══ */}
      <div className="bat-phase">Historian</div>

      <section className="bat-pipeline">
        <div className={`bat-pipeline-header${collapsed.has("chrhistorian") ? " bat-pipeline-collapsed" : ""}`} onClick={() => toggle("chrhistorian")}>
          <h3 className="bat-pipeline-title"><span className={`bat-pipeline-arrow${collapsed.has("chrhistorian") ? "" : " bat-pipeline-arrow-open"}`}>&#9656;</span>Chronicle Historian</h3>
        </div>
        {!collapsed.has("chrhistorian") && <>
          <div className="bat-steps">
            <span className="bat-step-num">1</span>
            <button onClick={bulk.handleBulkHistorianPrep} disabled={!historianConfigured} className="illuminator-btn" title={historianConfigured ? "Generate historian reading notes for all chronicles" : historianDisabledTitle}>Prep</button>
            <span className="bat-step-num">2</span>
            <button onClick={() => useIlluminatorModals.getState().openEraNarrative()} disabled={!historianConfigured} className="illuminator-btn" title={historianConfigured ? "Generate era narrative from historian prep briefs" : historianDisabledTitle}>Era Narrative</button>
            <span className="bat-step-num">3</span>
            <button onClick={() => setShowBulkEraNarrative(true)} disabled={!historianConfigured || bulkEraNarrativeProgress.status === "running"} className="illuminator-btn" title={historianConfigured ? "Run all eras through the full narrative pipeline" : historianDisabledTitle}>{bulkEraNarrativeProgress.status === "running" ? "Running..." : "Bulk Era"}</button>
            <span className="bat-step-num">4</span>
            <button onClick={() => prepareBulkAnnotation("run", chronicleItems)} disabled={!historianConfigured || isBulkAnnotationActive || isInterleavedActive} className="illuminator-btn" title={historianConfigured ? "Run historian annotations on all complete chronicles" : historianDisabledTitle}>{isBulkAnnotationActive && bulkAnnotationProgress.operation === "run" ? "Annotating..." : "Annotations"}</button>
            <span className="bat-step-num">5</span>
            <button onClick={() => prepareInterleaved(chronicleItems, entityNavItemsMap)} disabled={!historianConfigured || isBulkAnnotationActive || isInterleavedActive} className="illuminator-btn" title="Annotate chronicles and referenced entities in chronological order">{isInterleavedActive ? "Running..." : "Interleaved"}</button>
            <span className="bat-step-num">6</span>
            <button onClick={handleAmendBriefs} className="illuminator-btn" title="Annotate entity names in historian prep briefs with type/culture metadata">Amend Briefs</button>
          </div>
          <div className="bat-pipeline-options">
            <label className="bat-option"><input type="checkbox" checked={skipCompletedPrep} onChange={(e) => setSkipCompletedPrep(e.target.checked)} /> Skip completed prep</label>
            <button onClick={() => void downloadBulkAnnotationReviewExport(simulationRunId)} className="illuminator-btn" title="Export annotations for offline review">Export</button>
          </div>
          <div className="bat-danger-zone">
            <button onClick={() => prepareBulkAnnotation("clear", chronicleItems)} disabled={isBulkAnnotationActive || isInterleavedActive} className="bat-danger-link" title="Clear all historian annotations">Clear annotations</button>
          </div>
        </>}
      </section>

      <section className="bat-pipeline">
        <div className={`bat-pipeline-header${collapsed.has("tone") ? " bat-pipeline-collapsed" : ""}`} onClick={() => toggle("tone")}>
          <h3 className="bat-pipeline-title"><span className={`bat-pipeline-arrow${collapsed.has("tone") ? "" : " bat-pipeline-arrow-open"}`}>&#9656;</span>Tone</h3>
        </div>
        {!collapsed.has("tone") && <>
          <div className="bat-steps">
            <span className="bat-step-num">1</span>
            <button onClick={() => prepareToneRanking(chronicleItems)} disabled={isToneRankingActive} className="illuminator-btn" title="Rank top 3 historian annotation tones for each chronicle">{isToneRankingActive ? "Ranking..." : "Rank"}</button>
            <span className="bat-step-num">2</span>
            <button onClick={() => void prepareAssignment()} className="illuminator-btn" title="Assign tones across corpus with distribution balancing">Assign</button>
          </div>
          <div className="bat-pipeline-options">
            <button onClick={() => void downloadBulkToneReviewExport(simulationRunId)} className="illuminator-btn" title="Export all chronicle tone/fact data for offline review">Review Export</button>
          </div>
          {toneProgressText && <div className="bat-status">{toneProgressText}</div>}
        </>}
      </section>

      <section className="bat-pipeline">
        <div className={`bat-pipeline-header${collapsed.has("entityhist") ? " bat-pipeline-collapsed" : ""}`} onClick={() => toggle("entityhist")}>
          <h3 className="bat-pipeline-title"><span className={`bat-pipeline-arrow${collapsed.has("entityhist") ? "" : " bat-pipeline-arrow-open"}`}>&#9656;</span>Entity Historian</h3>
          <span className="bat-pipeline-stats">{entityHistorianCounts.annotated}/{entityNavItems.length} annotated</span>
        </div>
        {!collapsed.has("entityhist") && <>
          <div className="bat-steps">
            <span className="bat-step-num">1</span>
            <button onClick={handleEntityAnnotateAll} disabled={isBulkHistActive || entityHistorianCounts.annotationEligible === 0} className="illuminator-btn" title="Run historian annotation on all unannotated entities">{isBulkHistActive ? "Running..." : `Annotate (${entityHistorianCounts.annotationEligible})`}</button>
            <span className="bat-step-num">2</span>
            <button onClick={handleEntityCopyEditAll} disabled={isBulkHistActive || entityHistorianCounts.copyEditEligible === 0} className="illuminator-btn" title="Run historian copy edit on all unedited entities">{isBulkHistActive ? "Running..." : `Copy Edit (${entityHistorianCounts.copyEditEligible})`}</button>
            {entityHistorianCounts.reEditionEligible > 0 && <>
              <span className="bat-step-num">3</span>
              <button onClick={handleEntityReEditAll} disabled={isBulkHistActive} className="illuminator-btn" title="Re-run historian edition on already edited entities">Re-Edit ({entityHistorianCounts.reEditionEligible})</button>
            </>}
          </div>
          {(entityHistorianCounts.annotated > 0 || entityHistorianCounts.legacyConvertEligible > 0) && (
            <div className="bat-danger-zone">
              {entityHistorianCounts.annotated > 0 && <button onClick={handleEntityClearAllNotes} disabled={isBulkHistActive} className="bat-danger-link" title="Remove all historian annotations from entities">Clear notes ({entityHistorianCounts.annotated})</button>}
              {entityHistorianCounts.annotated > 0 && entityHistorianCounts.legacyConvertEligible > 0 && <span className="bat-danger-sep">·</span>}
              {entityHistorianCounts.legacyConvertEligible > 0 && <button onClick={handleEntityConvertToLegacy} disabled={isBulkHistActive} className="bat-danger-link" title="Relabel all historian-edition entries as legacy copy edits">Convert to legacy ({entityHistorianCounts.legacyConvertEligible})</button>}
            </div>
          )}
        </>}
      </section>

      {/* ─── Toasts ─── */}
      {bulk.eraSummaryRefreshResult && <EraSummaryRefreshToast result={bulk.eraSummaryRefreshResult} onDismiss={() => bulk.setEraSummaryRefreshResult(null)} />}
      {bulk.temporalCheckResult && <TemporalCheckToast result={bulk.temporalCheckResult} onDismiss={() => bulk.setTemporalCheckResult(null)} />}
      {bulk.bulkSummaryResult && <BulkSummaryToast result={bulk.bulkSummaryResult} onDismiss={() => bulk.setBulkSummaryResult(null)} />}
      {bulk.bulkImageRefResult && <BulkImageRefToast result={bulk.bulkImageRefResult} onDismiss={() => bulk.setBulkImageRefResult(null)} />}
      {bulk.bulkClearImageRefResult && <BulkClearImageRefToast result={bulk.bulkClearImageRefResult} onDismiss={() => bulk.setBulkClearImageRefResult(null)} />}
      {bulk.assignImageStyleResult && <AssignImageStyleToast result={bulk.assignImageStyleResult} onDismiss={() => bulk.setAssignImageStyleResult(null)} />}
      {bulk.bulkGenerateSceneResult && <BulkGenerateSceneToast result={bulk.bulkGenerateSceneResult} onDismiss={() => bulk.setBulkGenerateSceneResult(null)} />}
      {bulk.bulkClearSceneImageResult && <BulkClearSceneImageToast result={bulk.bulkClearSceneImageResult} onDismiss={() => bulk.setBulkClearSceneImageResult(null)} />}
      {bulk.bulkGenerateCoverSceneResult && <BulkGenerateCoverSceneToast result={bulk.bulkGenerateCoverSceneResult} onDismiss={() => bulk.setBulkGenerateCoverSceneResult(null)} />}
      {bulk.assignSecondaryStyleResult && <AssignSecondaryStyleToast result={bulk.assignSecondaryStyleResult} onDismiss={() => bulk.setAssignSecondaryStyleResult(null)} />}
      {bulk.assignCoverImageStyleResult && <AssignCoverImageStyleToast result={bulk.assignCoverImageStyleResult} onDismiss={() => bulk.setAssignCoverImageStyleResult(null)} />}
      {bulk.bulkGenerateCoverImageResult && <BulkGenerateCoverImageToast result={bulk.bulkGenerateCoverImageResult} onDismiss={() => bulk.setBulkGenerateCoverImageResult(null)} />}
      {bulk.bulkClearCoverImageResult && <BulkClearCoverImageToast result={bulk.bulkClearCoverImageResult} onDismiss={() => bulk.setBulkClearCoverImageResult(null)} />}
      {bulk.bulkClearByCompositionResult && <BulkClearCoverImageToast result={bulk.bulkClearByCompositionResult} onDismiss={() => bulk.setBulkClearByCompositionResult(null)} />}
      {bulk.resetBackportResult && <ResetBackportToast result={bulk.resetBackportResult} onDismiss={() => bulk.setResetBackportResult(null)} />}
      {bulk.reconcileBackportResult && <ReconcileBackportToast result={bulk.reconcileBackportResult} onDismiss={() => bulk.setReconcileBackportResult(null)} />}
      {bulk.showResetBackportModal && <ResetBackportModal onConfirm={() => void bulk.handleResetBackportConfirm()} onCancel={bulk.handleResetBackportCancel} />}
    </div>
  );
}
