/**
 * BulkTagImageRefsModal - Progress display for sequential bulk image ref tagging
 *
 * Three phases following BulkOperationShell pattern:
 * 1. Confirmation: batch count, ref count, style summary
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
    return `${progress.totalBatches} batches · ~${progress.totalRefs} refs`;
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

export default function BulkTagImageRefsModal({ progress, onConfirm, onCancel, onClose }) {
  const isConfirming = progress?.status === "confirming";
  const isTerminal =
    progress?.status === "complete" ||
    progress?.status === "cancelled" ||
    progress?.status === "failed";

  return (
    <BulkOperationShell
      pillId="bulk-tag-image-refs"
      title="Tag Image Refs"
      progress={progress}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onClose={onClose}
      confirmLabel={`Tag ${progress?.totalBatches || 0} batches (~${progress?.totalRefs || 0} refs)`}
      statusText={progress ? getStatusText(progress) : ""}
      pillStatusText={progress ? getPillText(progress) : ""}
    >
      {/* Confirmation screen */}
      {isConfirming && (
        <>
          <div className="bulk-info-box">
            Tag image refs with ranked artistic styles, compositions, and color palettes
            using sequential LLM calls. Each batch of ~30 chronicles is processed one at a time.
          </div>

          <div className="bulk-item-list-section">
            <div className="bulk-section-label">
              Batches ({progress.totalBatches})
            </div>
            <div className="bulk-item-list">
              {progress.batches.map((batch) => (
                <div key={batch.batchIndex} className="bulk-item-list-entry">
                  Batch {batch.batchIndex + 1}: {batch.chronicleIds.length} chronicles · ~{batch.refCount} refs
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
            {progress.taggedRefs > 0 && (
              <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>
                {progress.taggedRefs} refs tagged
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
              message={`Tagged ${progress.taggedRefs} image refs across ${progress.totalBatches} batches`}
            />
          )}
          {progress.status === "cancelled" && (
            <BulkTerminalMessage
              type="warning"
              message={`Cancelled after ${progress.processedBatches} batches (${progress.taggedRefs} refs tagged)`}
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

BulkTagImageRefsModal.propTypes = {
  progress: PropTypes.object,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
