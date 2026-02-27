/**
 * BulkToneRankingModal - Progress display for bulk tone ranking analysis
 *
 * Three phases:
 * 1. Confirmation: chronicle list with count
 * 2. Processing: single LLM call in progress (no per-chronicle tracking)
 * 3. Terminal: completion/cancellation/failure message
 */

import React from "react";
import PropTypes from "prop-types";
import BulkOperationShell, {
  BulkProgressBar,
  BulkTerminalMessage,
  BulkCost,
} from "./BulkOperationShell";

function getStatusText(progress) {
  if (progress.status === "confirming") return `${progress.totalChronicles} chronicles`;
  if (progress.status === "running") {
    return progress.processedChronicles > 0
      ? `${progress.processedChronicles}/${progress.totalChronicles}`
      : "Ranking...";
  }
  if (progress.status === "complete") return "Complete";
  if (progress.status === "cancelled") return "Cancelled";
  if (progress.status === "failed") return "Failed";
  return "";
}

function getPillText(progress) {
  if (progress.status === "running") return "Ranking...";
  if (progress.status === "complete") return "Complete";
  if (progress.status === "failed") return "Failed";
  if (progress.status === "cancelled") return "Cancelled";
  return "";
}

export default function BulkToneRankingModal({ progress, onConfirm, onCancel, onClose }) {
  return (
    <BulkOperationShell
      pillId="bulk-tone-ranking"
      title="Tone Ranking"
      progress={progress}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onClose={onClose}
      confirmLabel={`Rank (${progress?.totalChronicles || 0} chronicles)`}
      statusText={progress ? getStatusText(progress) : ""}
      pillStatusText={progress ? getPillText(progress) : ""}
    >
      {/* Confirmation screen */}
      {progress?.status === "confirming" && (
        <>
          <div className="bulk-info-box">
            Chronicles are split into batches of ~35-45. Each batch gets its own LLM call so the
            model maintains attention across all entries.
          </div>

          <div className="bulk-item-list-section">
            <div className="bulk-section-label">
              Chronicles ({progress.chronicles.length})
            </div>
            <div className="bulk-item-list">
              {progress.chronicles.map((chron) => (
                <div key={chron.chronicleId} className="bulk-item-list-entry">
                  {chron.title}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Processing / Terminal screen */}
      {progress?.status !== "confirming" && progress?.status !== "idle" && (
        <>
          {progress.status === "running" && (
            <BulkProgressBar
              processed={progress.processedChronicles}
              total={progress.totalChronicles}
              status={progress.status}
            />
          )}

          {progress.status === "complete" && (
            <BulkTerminalMessage status="complete">
              Ranked {progress.processedChronicles} of {progress.totalChronicles} chronicles.
            </BulkTerminalMessage>
          )}

          {progress.status === "cancelled" && (
            <BulkTerminalMessage status="cancelled">
              Cancelled after {progress.processedChronicles} of {progress.totalChronicles}{" "}
              chronicles.
            </BulkTerminalMessage>
          )}

          {progress.status === "failed" && (
            <BulkTerminalMessage status="failed">
              {progress.error || "An unexpected error occurred."}
            </BulkTerminalMessage>
          )}

          <BulkCost cost={progress.totalCost} />
        </>
      )}
    </BulkOperationShell>
  );
}

BulkToneRankingModal.propTypes = {
  progress: PropTypes.object,
  onConfirm: PropTypes.func,
  onCancel: PropTypes.func,
  onClose: PropTypes.func,
};
