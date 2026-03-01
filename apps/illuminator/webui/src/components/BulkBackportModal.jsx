/**
 * BulkBackportModal - Progress display for automatic multi-chronicle bulk backport
 *
 * Two phases:
 * 1. Confirmation: entity list with chronicle counts, confirm/cancel buttons
 * 2. Processing: progress bars, current chronicle, entity count, cost
 *
 * Uses BulkOperationShell for overlay, header, pill lifecycle, and footer.
 */

import React, { useMemo } from "react";
import PropTypes from "prop-types";
import BulkOperationShell, { BulkTerminalMessage, BulkCost } from "./BulkOperationShell";
import "./BulkBackportModal.css";
const PILL_ID = "bulk-backport";
export default function BulkBackportModal({
  progress,
  onConfirm,
  onCancel,
  onClose
}) {
  const chronicles = progress?.chronicles;
  const realTotal = useMemo(() => chronicles ? chronicles.reduce((sum, c) => sum + c.totalEntities, 0) : 0, [chronicles]);
  const isConfirming = progress?.status === "confirming";
  const isTerminal = progress?.status === "complete" || progress?.status === "cancelled" || progress?.status === "failed";
  const currentChronicle = progress?.chronicles?.[progress.currentChronicleIndex];
  const globalPercent = progress?.totalEntities > 0 ? Math.round(progress.processedEntities / progress.totalEntities * 100) : 0;
  const completedChronicles = progress?.chronicles?.filter(c => c.status === "complete").length ?? 0;
  const failedChronicles = progress?.chronicles?.filter(c => c.status === "failed").length ?? 0;
  let progressFillModifier;
  if (progress?.status === "failed") progressFillModifier = "bbm-progress-fill-failed";else if (progress?.status === "cancelled") progressFillModifier = "bbm-progress-fill-cancelled";else progressFillModifier = "bbm-progress-fill-ok";
  const progressFillClass = `bbm-progress-fill ${progressFillModifier}`;

  // Header status text
  let statusText;
  if (isConfirming) statusText = `${progress?.chronicles?.length ?? 0} chronicles`;else if (progress?.status === "running") statusText = "Processing...";else if (progress?.status === "complete") statusText = "Complete";else if (progress?.status === "cancelled") statusText = "Cancelled";else if (progress?.status === "failed") statusText = "Failed";

  // Pill status text when minimized
  const pillStatusText = progress?.status === "running" ? `${progress.processedEntities}/${progress.totalEntities}` : progress?.status;
  return <BulkOperationShell pillId={PILL_ID} title="Bulk Backport" tabId="chronicle" progress={progress} onConfirm={onConfirm} onCancel={onCancel} onClose={onClose} confirmLabel={`Start Backport (${progress?.totalEntities ?? 0} entities)`} statusText={statusText} pillStatusText={pillStatusText} confirmWidth="540px" processWidth="480px">
      {/* ---- Confirmation screen ---- */}
      {isConfirming && progress.entitySummary && <div className="bbm-entity-section">
          <div className="bbm-entity-header">
            <span className="bbm-section-label">
              Entities ({progress.entitySummary.length})
            </span>
            <span className="bbm-section-meta">
              {progress.totalEntities} updates across {progress.chronicles.length} chronicles
            </span>
          </div>

          <div className="bbm-entity-list">
            {progress.entitySummary.map((entity, i) => <div key={entity.entityId} className={`bbm-entity-row ${i < progress.entitySummary.length - 1 ? "bbm-entity-row-bordered" : ""}`}>
                <div className="bbm-entity-info">
                  <span className="bbm-entity-name">{entity.entityName}</span>
                  <span className="bbm-entity-kind">
                    {entity.entityKind}
                    {entity.entitySubtype ? ` / ${entity.entitySubtype}` : ""}
                  </span>
                </div>
                <span className="bbm-entity-chr" title={`${entity.chronicleCount} chronicle${entity.chronicleCount !== 1 ? "s" : ""} will update this entity`}>
                  {entity.chronicleCount} chr
                </span>
              </div>)}
          </div>
        </div>}

      {/* ---- Processing screen ---- */}
      {!isConfirming && progress?.status !== "idle" && <>
          {/* Global progress */}
          <div className="bbm-progress-section">
            <div className="bbm-progress-header">
              <span className="bbm-progress-label">
                Chronicle{" "}
                {Math.min(progress.currentChronicleIndex + 1, progress.chronicles.length)} /{" "}
                {progress.chronicles.length}
              </span>
              <span className="bbm-progress-percent">{globalPercent}%</span>
            </div>

            {/* Global progress bar */}
            <div className="bbm-progress-track">
              <div className={progressFillClass}
          style={{
            "--bbm-progress-width": `${globalPercent}%`
          }} />
            </div>

            <div className="bbm-progress-stats">
              <span>
                {progress.processedEntities} / {realTotal || progress.totalEntities} entities
              </span>
              <span>
                {completedChronicles} / {progress.chronicles.length} chronicles
              </span>
            </div>
          </div>

          {/* Current chronicle detail */}
          {currentChronicle && !isTerminal && <div className="bbm-chronicle-detail">
              <div className="bbm-chronicle-title">{currentChronicle.chronicleTitle}</div>

              {currentChronicle.totalBatches > 1 && <div className="bbm-chronicle-batch-info">
                  <span>
                    Batch{" "}
                    {Math.min(currentChronicle.completedBatches + 1, currentChronicle.totalBatches)}{" "}
                    / {currentChronicle.totalBatches}
                  </span>
                  <span>
                    {currentChronicle.processedEntities} / {currentChronicle.totalEntities}{" "}
                    entities
                  </span>
                </div>}

              {currentChronicle.totalBatches <= 1 && <div className="bbm-chronicle-entity-count">
                  {currentChronicle.totalEntities} entities
                </div>}
            </div>}

          {/* Terminal state messages */}
          {progress.status === "complete" && <BulkTerminalMessage status="complete">
              Backported {progress.processedEntities} entities across {completedChronicles}{" "}
              chronicles.
              {failedChronicles > 0 && <span className="bulk-failed-inline">
                  {" "}
                  {failedChronicles} chronicle(s) failed.
                </span>}
            </BulkTerminalMessage>}

          {progress.status === "cancelled" && <BulkTerminalMessage status="cancelled">
              Cancelled after processing {progress.processedEntities} entities across{" "}
              {completedChronicles} chronicles.
            </BulkTerminalMessage>}

          {progress.status === "failed" && <BulkTerminalMessage status="failed">
              {progress.error || "An unexpected error occurred."}
            </BulkTerminalMessage>}

          {/* Cost */}
          <BulkCost cost={progress.totalCost} />
        </>}
    </BulkOperationShell>;
}
BulkBackportModal.propTypes = {
  progress: PropTypes.object,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
};
