/**
 * ChronicleBulkActions - Collapsible grid of bulk operation buttons.
 *
 * Extracted from ChroniclePanel to reduce complexity. Receives callbacks
 * and state as props rather than computing them inline.
 */

import React, { useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToneRankingProgress {
  status: string;
  processedChronicles?: number;
  totalChronicles?: number;
  error?: string;
}

interface BulkAnnotationProgress {
  status: string;
  operation?: string;
}

export interface ChronicleBulkActionsProps {
  showBulkActions: boolean;
  onToggleBulkActions: () => void;
  // Validation section
  onBulkTemporalCheck: () => void;
  onBulkDetectTertiary: () => void;
  tertiaryDetectRunning: boolean;
  onRefreshEraSummaries: (() => Promise<number>) | undefined;
  onEraSummaryRefreshResult: (result: { success: boolean; count?: number; error?: string }) => void;
  onBulkSummary: () => void;
  onPrepareFactCoverage: () => void;
  isFactCoverageActive: boolean;
  // Historian Tone section
  onPrepareToneRanking: () => void;
  isToneRankingActive: boolean;
  toneRankingProgress: ToneRankingProgress;
  onPrepareAssignment: () => void;
  onDownloadToneReview: () => void;
  // Backport section
  onStartBulkBackport: () => void;
  isBulkBackportActive: boolean;
  onReconcileBackports: () => void;
  onOpenResetBackportModal: () => void;
  // Historian section
  historianConfigured: boolean;
  skipCompletedPrep: boolean;
  onSetSkipCompletedPrep: (value: boolean) => void;
  onOpenChronologyModal: () => void;
  onBulkHistorianPrep: () => void;
  onOpenEraNarrativeModal: () => void;
  onOpenBulkEraNarrativeModal: () => void;
  bulkEraNarrativeRunning: boolean;
  onPrepareBulkAnnotation: (op: "run" | "clear") => void;
  isBulkAnnotationActive: boolean;
  bulkAnnotationProgress: BulkAnnotationProgress;
  onPrepareInterleaved: () => void;
  isInterleavedActive: boolean;
  onDownloadAnnotationReview: () => void;
  onAmendBriefs: () => void;
  onBulkRegenerateImageRefs: () => void;
  onBulkTagImageRefs: () => void;
  onAssignImageStyles: () => void;
  onBulkGenerateSceneImages: () => void;
  onAssignCoverImageStyles: () => void;
  onBulkGenerateCoverImages: () => void;
  onBulkClearImageRefs: () => void;
  onBulkClearSceneImages: () => void;
  onBulkGenerateCoverScenes: () => void;
  onBulkClearCoverImages: () => void;
  onBulkTagCoverImages: () => void;
}

function formatToneProgress(progress: ToneRankingProgress): string | null {
  switch (progress.status) {
    case "complete":
      return `Ranked ${progress.processedChronicles}/${progress.totalChronicles}`;
    case "failed":
      return progress.error || "Failed";
    case "cancelled":
      return `Cancelled (${progress.processedChronicles}/${progress.totalChronicles})`;
    default:
      return null;
  }
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

export function ChronicleBulkActions({
  showBulkActions,
  onToggleBulkActions,
  onBulkTemporalCheck,
  onBulkDetectTertiary,
  tertiaryDetectRunning,
  onRefreshEraSummaries,
  onEraSummaryRefreshResult,
  onBulkSummary,
  onPrepareFactCoverage,
  isFactCoverageActive,
  onPrepareToneRanking,
  isToneRankingActive,
  toneRankingProgress,
  onPrepareAssignment,
  onDownloadToneReview,
  onStartBulkBackport,
  isBulkBackportActive,
  onReconcileBackports,
  onOpenResetBackportModal,
  historianConfigured,
  skipCompletedPrep,
  onSetSkipCompletedPrep,
  onOpenChronologyModal,
  onBulkHistorianPrep,
  onOpenEraNarrativeModal,
  onOpenBulkEraNarrativeModal,
  bulkEraNarrativeRunning,
  onPrepareBulkAnnotation,
  isBulkAnnotationActive,
  bulkAnnotationProgress,
  onPrepareInterleaved,
  isInterleavedActive,
  onDownloadAnnotationReview,
  onAmendBriefs,
  onBulkRegenerateImageRefs,
  onBulkTagImageRefs,
  onAssignImageStyles,
  onBulkGenerateSceneImages,
  onAssignCoverImageStyles,
  onBulkGenerateCoverImages,
  onBulkClearImageRefs,
  onBulkClearSceneImages,
  onBulkGenerateCoverScenes,
  onBulkClearCoverImages,
  onBulkTagCoverImages,
}: Readonly<ChronicleBulkActionsProps>) {
  const handleRefreshEraSummaries = useCallback(() => {
    if (!onRefreshEraSummaries) return;
    void (async () => {
      try {
        const count = await onRefreshEraSummaries();
        onEraSummaryRefreshResult({ success: true, count });
      } catch (err: unknown) {
        onEraSummaryRefreshResult({ success: false, error: formatError(err) });
      }
    })();
  }, [onRefreshEraSummaries, onEraSummaryRefreshResult]);

  const historianDisabledTitle = "Configure historian persona first";

  return (
    <div className="chron-bulk">
      <button onClick={onToggleBulkActions} className="chron-bulk-toggle">
        <span
          className={`chron-bulk-toggle-icon ${showBulkActions ? "chron-bulk-toggle-icon-open" : ""}`}
        >
          &#9654;
        </span>
        Bulk Actions
      </button>
      {showBulkActions && (
        <div className="chron-bulk-grid">
          {/* Validation */}
          <div className="chron-bulk-section viewer-section-inline">
            <span className="chron-bulk-section-label">Validation</span>
            <button
              onClick={onBulkTemporalCheck}
              className="illuminator-button"
              title="Re-run temporal alignment check on all chronicles that have a temporal narrative"
            >
              Rerun Temporal Checks
            </button>
            <button
              onClick={onBulkDetectTertiary}
              disabled={tertiaryDetectRunning}
              className="illuminator-button"
              title="Re-detect tertiary cast (entity mentions not in declared cast) on all chronicles"
            >
              {tertiaryDetectRunning ? "Detecting..." : "Re-detect Tertiary"}
            </button>
            {onRefreshEraSummaries && (
              <button
                onClick={handleRefreshEraSummaries}
                className="illuminator-button"
                title="Refresh era summaries in all chronicle temporal contexts from current entity data"
              >
                Refresh Era Summaries
              </button>
            )}
            <button
              onClick={onBulkSummary}
              className="illuminator-button"
              title="Generate summaries for all chronicles that are missing them"
            >
              Generate Summaries
            </button>
            <button
              onClick={onPrepareFactCoverage}
              disabled={isFactCoverageActive}
              className="illuminator-button"
              title="Analyze canon fact coverage across all chronicles using Haiku"
            >
              {isFactCoverageActive ? "Analyzing..." : "Fact Coverage"}
            </button>
          </div>

          {/* Scene Images */}
          <div className="chron-bulk-section viewer-section-inline">
            <span className="chron-bulk-section-label">Scene Images</span>
            <button
              onClick={onBulkRegenerateImageRefs}
              className="illuminator-button"
              title="Regenerate image refs for all chronicles: convert entity refs to scene images, fix stale anchors"
            >
              Regenerate Refs
            </button>
            <button
              onClick={onBulkTagImageRefs}
              className="illuminator-button"
              title="Tag image refs with visual/atmospheric tags and suggest artistic + composition styles"
            >
              Tag Refs
            </button>
            <button
              onClick={onAssignImageStyles}
              className="illuminator-button"
              title="Distribute styles/compositions/palettes across all tagged image refs for maximum coverage (deterministic, no LLM)"
            >
              Assign Styles
            </button>
            <button
              onClick={() => void onBulkGenerateSceneImages()}
              className="illuminator-button"
              title="Generate images for all scene refs that have assigned styles but no image yet"
            >
              Generate Images
            </button>
            <button
              onClick={onBulkClearSceneImages}
              className="illuminator-button"
              title="Clear generated images from all scene refs (keeps the refs and descriptions, removes images)"
            >
              Clear Images
            </button>
            <button
              onClick={onBulkClearImageRefs}
              className="illuminator-button"
              title="Remove all image refs from all chronicles (use before bulk regenerate to start fresh)"
            >
              Clear All Refs
            </button>
          </div>

          {/* Cover Images */}
          <div className="chron-bulk-section viewer-section-inline">
            <span className="chron-bulk-section-label">Cover Images</span>
            <button
              onClick={onBulkGenerateCoverScenes}
              className="illuminator-button"
              title="Generate cover image scene descriptions for all chronicles that are missing them"
            >
              Generate Scenes
            </button>
            <button
              onClick={onBulkTagCoverImages}
              className="illuminator-button"
              title="Tag cover images with visual/atmospheric tags and suggest artistic + composition styles"
            >
              Tag Styles
            </button>
            <button
              onClick={onAssignCoverImageStyles}
              className="illuminator-button"
              title="Distribute artistic styles and palettes across all tagged cover images for even coverage (composition is fixed by narrative style, deterministic, no LLM)"
            >
              Assign Styles
            </button>
            <button
              onClick={() => void onBulkGenerateCoverImages()}
              className="illuminator-button"
              title="Generate cover images for all chronicles that have assigned styles but no image yet"
            >
              Generate Images
            </button>
            <button
              onClick={onBulkClearCoverImages}
              className="illuminator-button"
              title="Clear generated cover images from all chronicles (keeps scene descriptions and style tags)"
            >
              Clear Images
            </button>
          </div>

          {/* Historian Tone */}
          <div className="chron-bulk-section viewer-section-inline">
            <span className="chron-bulk-section-label">Historian Tone</span>
            <button
              onClick={onPrepareToneRanking}
              disabled={isToneRankingActive}
              className="illuminator-button"
              title="Rank top 3 historian annotation tones for each chronicle using Haiku"
            >
              {isToneRankingActive ? "Ranking..." : "Rank Tones"}
            </button>
            {formatToneProgress(toneRankingProgress) && (
              <div
                className={`chron-bulk-status-text chron-bulk-status-text-${toneRankingProgress.status}`}
              >
                {formatToneProgress(toneRankingProgress)}
              </div>
            )}
            <button
              onClick={onPrepareAssignment}
              className="illuminator-button"
              title="Assign tones across corpus with distribution balancing (requires ranked tones)"
            >
              Assign Tones
            </button>
            <button
              onClick={onDownloadToneReview}
              className="illuminator-button"
              title="Export all chronicle tone/fact data for offline review"
            >
              Review Export
            </button>
          </div>

          {/* Backport */}
          <div className="chron-bulk-section viewer-section-inline">
            <span className="chron-bulk-section-label">Backport</span>
            <button
              onClick={onStartBulkBackport}
              disabled={isBulkBackportActive}
              className="illuminator-button"
              title="Backport lore from all published chronicles to cast entities (auto-accept, chunked)"
            >
              {isBulkBackportActive ? "Bulk Backport Running..." : "Backport All"}
            </button>
            <button
              onClick={onReconcileBackports}
              className="illuminator-button"
              title="Reconcile backport status from actual entity backrefs - fixes status to match reality"
            >
              Reconcile Backports
            </button>
            <button
              onClick={onOpenResetBackportModal}
              className="illuminator-button"
              title="Reset per-entity backport status on all chronicles (for re-running backport)"
            >
              Reset Backports
            </button>
          </div>

          {/* Historian */}
          <div className="chron-bulk-section viewer-section-inline">
            <span className="chron-bulk-section-label">Historian</span>
            <button
              onClick={onOpenChronologyModal}
              className="illuminator-button"
              disabled={!historianConfigured}
              title={
                historianConfigured
                  ? "Historian assigns chronological years to chronicles within each era"
                  : historianDisabledTitle
              }
            >
              Chronology
            </button>
            <button
              onClick={onBulkHistorianPrep}
              className="illuminator-button"
              disabled={!historianConfigured}
              title={
                historianConfigured
                  ? "Generate historian reading notes for all chronicles (input for era narratives)"
                  : historianDisabledTitle
              }
            >
              Historian Prep
            </button>
            <label
              className="chron-bulk-skip-label"
              title="Skip chronicles that already have historian prep briefs"
            >
              <input
                type="checkbox"
                checked={skipCompletedPrep}
                onChange={(e) => onSetSkipCompletedPrep(e.target.checked)}
                className="chron-bulk-skip-checkbox"
              />
              Skip completed
            </label>
            <button
              onClick={onOpenEraNarrativeModal}
              className="illuminator-button"
              disabled={!historianConfigured}
              title={
                historianConfigured
                  ? "Generate a multi-chapter era narrative from historian prep briefs"
                  : historianDisabledTitle
              }
            >
              Era Narrative
            </button>
            <button
              onClick={onOpenBulkEraNarrativeModal}
              className="illuminator-button"
              disabled={!historianConfigured || bulkEraNarrativeRunning}
              title={
                historianConfigured
                  ? "Run all eras through the full narrative pipeline (threads -> generate -> edit)"
                  : historianDisabledTitle
              }
            >
              {bulkEraNarrativeRunning ? "Running..." : "Bulk Era Narrative"}
            </button>
            <button
              onClick={() => onPrepareBulkAnnotation("run")}
              disabled={!historianConfigured || isBulkAnnotationActive || isInterleavedActive}
              className="illuminator-button"
              title={
                historianConfigured
                  ? "Run historian annotations on all complete chronicles using their assigned tones"
                  : historianDisabledTitle
              }
            >
              {isBulkAnnotationActive && bulkAnnotationProgress.operation === "run"
                ? "Annotating..."
                : "Run Annotations"}
            </button>
            <button
              onClick={() => onPrepareBulkAnnotation("clear")}
              disabled={isBulkAnnotationActive || isInterleavedActive}
              className="illuminator-button"
              title="Clear all historian annotations from chronicles that have them"
            >
              Clear Annotations
            </button>
            <button
              onClick={onPrepareInterleaved}
              disabled={!historianConfigured || isBulkAnnotationActive || isInterleavedActive}
              className="illuminator-button"
              title="Annotate chronicles and their referenced entities in chronological order"
            >
              {isInterleavedActive ? "Running..." : "Annotate All (Interleaved)"}
            </button>
            <button
              onClick={onDownloadAnnotationReview}
              className="illuminator-button"
              title="Export all chronicle titles, styles, formats, and annotations for offline review"
            >
              Annotation Export
            </button>
            <button
              onClick={onAmendBriefs}
              className="illuminator-button"
              title="Annotate entity names in historian prep briefs with type/culture metadata (e.g. faction/company, aurora-stack)"
            >
              Amend Briefs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChronicleBulkActions;
