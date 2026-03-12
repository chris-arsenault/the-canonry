/**
 * BulkTagCoverImagesModal - Progress display for sequential bulk cover image tagging
 *
 * Three phases following BulkOperationShell pattern:
 * 1. Confirmation: batch count, scene count, style summary
 * 2. Processing: progress bar, current batch, cost
 * 3. Terminal: completion/cancellation/failure message
 */

import React from "react";
import PropTypes from "prop-types";
import BulkOperationShell, {
  BulkProgressBar,
  BulkTerminalMessage,
  BulkFailedList,
  BulkCost,
} from "./BulkOperationShell";

function getStatusText(progress) {
  if (progress.status === "confirming")
    return `${progress.totalBatches} batches · ~${progress.totalScenes} cover scenes`;
  if (progress.status === "running") return "Tagging...";
  if (progress.status === "complete") return "Complete";
  if (progress.status === "cancelled") return "Cancelled";
  if (progress.status === "failed") return "Failed";
  return "";
}

function getPillText(progress) {
  if (progress.status === "running")
    return `${progress.processedBatches}/${progress.totalBatches}`;
  return progress.status;
}

export default function BulkTagCoverImagesModal({ progress, onConfirm, onCancel, onClose, renderMode }) {
  const isConfirming = progress?.status === "confirming";
  const isTerminal =
    progress?.status === "complete" ||
    progress?.status === "cancelled" ||
    progress?.status === "failed";

  return (
    <BulkOperationShell
      pillId="bulk-tag-cover-images"
      title="Tag Cover Images"
      progress={progress}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onClose={onClose}
      confirmLabel={`Tag ${progress?.totalBatches || 0} batches (~${progress?.totalScenes || 0} cover scenes)`}
      statusText={progress ? getStatusText(progress) : ""}
      pillStatusText={progress ? getPillText(progress) : ""}
      renderMode={renderMode}
    >
      {/* Confirmation screen */}
      {isConfirming && (
        <>
          <div className="bulk-info-box">
            Tag cover images with ranked artistic styles, compositions, and color palettes
            using sequential LLM calls. Each batch of ~30 chronicles is processed one at a time.
          </div>

          <div className="bulk-item-list-section">
            <div className="bulk-section-label">
              Batches ({progress.totalBatches})
            </div>
            <div className="bulk-item-list">
              {progress.batches.map((batch) => (
                <div key={batch.batchIndex} className="bulk-item-list-entry">
                  Batch {batch.batchIndex + 1}: {batch.chronicleIds.length} chronicles
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Processing / Terminal screen */}
      {!isConfirming && progress?.status !== "idle" && (
        <>
          <BulkProgressBar
            processed={progress.processedBatches}
            total={progress.totalBatches}
            status={progress.status}
          />

          <div className="bulk-progress-detail">
            {progress.processedBatches} / {progress.totalBatches} batches
            {progress.taggedScenes > 0 && (
              <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>
                {progress.taggedScenes} cover scenes tagged
              </span>
            )}
            {progress.failedBatches?.length > 0 && (
              <span className="bulk-failed-inline">
                {" "}{progress.failedBatches.length} failed
              </span>
            )}
          </div>

          {/* Current batch indicator */}
          {progress.currentBatchIndex >= 0 && !isTerminal && (
            <div className="bulk-current-item">
              <div className="bulk-current-item-title">
                Batch {progress.currentBatchIndex + 1} of {progress.totalBatches}
              </div>
              <div className="bulk-current-item-sub">Running LLM tagging...</div>
            </div>
          )}

          {progress.status === "complete" && (
            <BulkTerminalMessage
              type="success"
              message={`Tagged ${progress.taggedScenes} cover scenes across ${progress.totalBatches} batches`}
            />
          )}
          {progress.status === "cancelled" && (
            <BulkTerminalMessage
              type="warning"
              message={`Cancelled after ${progress.processedBatches} batches (${progress.taggedScenes} scenes tagged)`}
            />
          )}
          {progress.status === "failed" && (
            <BulkTerminalMessage type="error" message={progress.error || "Unknown error"} />
          )}

          {progress.failedBatches?.length > 0 && (
            <BulkFailedList
              items={progress.failedBatches.map((f) => ({
                id: String(f.batchIndex),
                title: `Batch ${f.batchIndex + 1}`,
                error: f.error,
              }))}
            />
          )}

          {progress.totalCost > 0 && <BulkCost cost={progress.totalCost} />}
        </>
      )}
    </BulkOperationShell>
  );
}

BulkTagCoverImagesModal.propTypes = {
  progress: PropTypes.object,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
