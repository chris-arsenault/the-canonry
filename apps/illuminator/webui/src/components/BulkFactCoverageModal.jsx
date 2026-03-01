/**
 * BulkFactCoverageModal - Progress display for bulk canon fact coverage analysis
 *
 * Three phases following BulkOperationShell pattern:
 * 1. Confirmation: chronicle list with count
 * 2. Processing: progress bar, current chronicle, cost
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
  if (progress.status === "confirming") return `${progress.totalChronicles} chronicles`;
  if (progress.status === "running") return "Analyzing...";
  if (progress.status === "complete") return "Complete";
  if (progress.status === "cancelled") return "Cancelled";
  if (progress.status === "failed") return "Failed";
  return "";
}

function getPillText(progress) {
  if (progress.status === "running")
    return `${progress.processedChronicles}/${progress.totalChronicles}`;
  return progress.status;
}

export default function BulkFactCoverageModal({ progress, onConfirm, onCancel, onClose }) {
  const isConfirming = progress?.status === "confirming";
  const isTerminal =
    progress?.status === "complete" ||
    progress?.status === "cancelled" ||
    progress?.status === "failed";

  return (
    <BulkOperationShell
      pillId="bulk-fact-coverage"
      title="Fact Coverage Analysis"
      progress={progress}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onClose={onClose}
      confirmLabel={`Analyze (${progress?.totalChronicles || 0} chronicles)`}
      statusText={progress ? getStatusText(progress) : ""}
      pillStatusText={progress ? getPillText(progress) : ""}
    >
      {/* Confirmation screen */}
      {isConfirming && (
        <>
          <div className="bulk-info-box">
            Analyze each chronicle&apos;s narrative against all canon facts using Haiku. Results are
            stored per-chronicle and visible in the Reference tab.
          </div>

          <div className="bulk-item-list-section">
            <div className="bulk-section-label">Chronicles ({progress.chronicles.length})</div>
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
      {!isConfirming && progress?.status !== "idle" && (
        <>
          <BulkProgressBar
            processed={progress.processedChronicles}
            total={progress.totalChronicles}
            status={progress.status}
          />

          <div className="bulk-progress-detail">
            {progress.processedChronicles} / {progress.totalChronicles} chronicles
            {progress.failedChronicles?.length > 0 && (
              <span className="bulk-failed-inline">
                {" "}{progress.failedChronicles.length} failed
              </span>
            )}
          </div>

          {/* Current chronicle */}
          {progress.currentTitle && !isTerminal && (
            <div className="bulk-current-item">
              <div className="bulk-current-item-title">{progress.currentTitle}</div>
              <div className="bulk-current-item-sub">Analyzing fact coverage...</div>
            </div>
          )}

          {progress.status === "complete" && (
            <BulkTerminalMessage status="complete">
              Analyzed {progress.processedChronicles} chronicles.
              {progress.failedChronicles?.length > 0 && (
                <span className="bulk-failed-inline">
                  {" "}{progress.failedChronicles.length} failed.
                </span>
              )}
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

          {isTerminal && (
            <BulkFailedList
              items={progress.failedChronicles}
              labelKey="title"
              errorKey="error"
            />
          )}

          <BulkCost cost={progress.totalCost} />
        </>
      )}
    </BulkOperationShell>
  );
}

BulkFactCoverageModal.propTypes = {
  progress: PropTypes.object,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
