/**
 * BulkChronicleAnnotationModal - Progress display for bulk chronicle annotation operations
 *
 * Handles both "Run Annotations" and "Clear Annotations" workflows.
 * Three phases following BulkOperationShell pattern:
 * 1. Confirmation: chronicle list with tones and warning info
 * 2. Processing: progress bar, current chronicle, tone info
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
import "./BulkChronicleAnnotationModal.css";

function getStatusText(progress) {
  if (progress.status === "confirming") return `${progress.totalChronicles} chronicles`;
  if (progress.status === "running")
    return `${progress.processedChronicles}/${progress.totalChronicles}`;
  if (progress.status === "complete") return "Complete";
  if (progress.status === "cancelled") return "Cancelled";
  if (progress.status === "failed") return "Failed";
  return "";
}

function isTerminalStatus(progress) {
  return (
    progress?.status === "complete" ||
    progress?.status === "cancelled" ||
    progress?.status === "failed"
  );
}

function getPillText(progress) {
  if (progress.status === "running")
    return `${progress.processedChronicles}/${progress.totalChronicles}`;
  if (progress.status === "complete") return "Complete";
  if (progress.status === "failed") return "Failed";
  if (progress.status === "cancelled") return "Cancelled";
  return "";
}

export default function BulkChronicleAnnotationModal({ progress, onConfirm, onCancel, onClose }) {
  const isClear = progress?.operation === "clear";
  const title = isClear ? "Clear Annotations" : "Run Annotations";
  const isConfirming = progress?.status === "confirming";
  const isTerminal = isTerminalStatus(progress);

  const withNotes = progress?.chronicles?.filter((c) => c.hasNotes).length || 0;
  const withTones = progress?.chronicles?.filter((c) => c.assignedTone).length || 0;

  const confirmLabel = isClear
    ? `Clear (${progress?.totalChronicles || 0} chronicles)`
    : `Annotate (${progress?.totalChronicles || 0} chronicles)`;
  const processedSuffix = progress?.processedChronicles === 1 ? "" : "s";

  return (
    <BulkOperationShell
      pillId="bulk-chronicle-annotation"
      title={title}
      tabId="chronicle"
      progress={progress}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onClose={onClose}
      confirmLabel={confirmLabel}
      statusText={progress ? getStatusText(progress) : ""}
      pillStatusText={progress ? getPillText(progress) : ""}
    >
      {/* Confirmation screen */}
      {isConfirming && (
        <>
          <div className="bulk-info-box">
            {isClear ? (
              <>
                This will clear all historian annotations from {progress.totalChronicles}{" "}
                chronicle{progress.totalChronicles !== 1 ? "s" : ""}. Annotations cannot be
                recovered after clearing.
              </>
            ) : (
              <>
                Each chronicle gets a historian review using its assigned tone. Results are
                auto-applied (no manual review step). Chronicles processed sequentially — one
                LLM call each.
                {withTones < progress.totalChronicles && (
                  <span className="ilu-status-warning">
                    {" "}
                    {progress.totalChronicles - withTones} chronicle
                    {progress.totalChronicles - withTones !== 1 ? "s" : ""} have no assigned
                    tone and will default to &quot;weary&quot;.
                  </span>
                )}
                {withNotes > 0 && (
                  <span className="ilu-status-warning">
                    {" "}
                    {withNotes} chronicle{withNotes !== 1 ? "s" : ""} already have annotations —
                    they will be replaced.
                  </span>
                )}
              </>
            )}
          </div>

          {/* Chronicle list */}
          <div className="bulk-item-list-section">
            <div className="bulk-section-label">
              Chronicles ({progress.chronicles.length})
            </div>

            <div className="bulk-item-list">
              {progress.chronicles.map((chron) => (
                <div key={chron.chronicleId} className="bcam-chronicle-item">
                  <span className="truncate flex-1">{chron.title}</span>
                  {!isClear && (
                    <span className="bcam-chronicle-tone">
                      {chron.assignedTone || "weary"}
                      {chron.hasNotes ? " ✎" : ""}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Processing / Terminal screen */}
      {!isConfirming && progress?.status !== "idle" && (
        <>
          {progress.status === "running" && (
            <>
              <div className="bcam-current-title">
                {progress.currentTitle || (isClear ? "Clearing..." : "Annotating...")}
              </div>

              <BulkProgressBar
                processed={progress.processedChronicles}
                total={progress.totalChronicles}
                status={progress.status}
              />

              <div className="ilu-hint-sm bcam-progress-stats">
                <span>
                  {progress.processedChronicles} / {progress.totalChronicles}{" "}
                  {isClear ? "cleared" : "annotated"}
                </span>
                {!isClear && progress.currentTone && (
                  <span>tone: {progress.currentTone}</span>
                )}
              </div>
            </>
          )}

          {progress.status === "complete" && (
            <BulkTerminalMessage status="complete">
              {isClear
                ? `Cleared annotations from ${progress.processedChronicles} chronicle${processedSuffix}.`
                : `Annotated ${progress.processedChronicles} of ${progress.totalChronicles} chronicles.`}
              {progress.failedChronicles.length > 0 &&
                ` (${progress.failedChronicles.length} failed)`}
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

BulkChronicleAnnotationModal.propTypes = {
  progress: PropTypes.object,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
