/**
 * ChronicleBulkActions - Collapsible grid of bulk operation buttons.
 *
 * Extracted from ChroniclePanel to reduce complexity. Receives callbacks
 * and state as props rather than computing them inline.
 */

import React, { useCallback } from "react";
import type { ChronicleNavItem, HistorianConfig } from "./chroniclePanelTypes";

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

interface BulkEraNarrativeProgress {
  status: string;
}

export interface ChronicleBulkActionsProps {
  showBulkActions: boolean;
  onToggleBulkActions: () => void;
  chronicleItems: ChronicleNavItem[];
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
  historianConfig: HistorianConfig;
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
}: ChronicleBulkActionsProps) {
  const handleRefreshEraSummaries = useCallback(() => {
    if (!onRefreshEraSummaries) return;
    void (async () => {
      try {
        const count = await onRefreshEraSummaries();
        onEraSummaryRefreshResult({ success: true, count });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        onEraSummaryRefreshResult({ success: false, error: message });
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
            {(toneRankingProgress.status === "complete" ||
              toneRankingProgress.status === "failed" ||
              toneRankingProgress.status === "cancelled") && (
              <div
                className={`chron-bulk-status-text chron-bulk-status-text-${toneRankingProgress.status}`}
              >
                {toneRankingProgress.status === "complete" &&
                  `Ranked ${toneRankingProgress.processedChronicles}/${toneRankingProgress.totalChronicles}`}
                {toneRankingProgress.status === "failed" &&
                  (toneRankingProgress.error || "Failed")}
                {toneRankingProgress.status === "cancelled" &&
                  `Cancelled (${toneRankingProgress.processedChronicles}/${toneRankingProgress.totalChronicles})`}
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
