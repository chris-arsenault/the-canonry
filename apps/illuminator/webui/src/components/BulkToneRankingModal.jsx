/**
 * BulkToneRankingModal - Progress display for bulk tone ranking analysis
 *
 * Three phases:
 * 1. Confirmation: chronicle list with count
 * 2. Processing: single LLM call in progress (no per-chronicle tracking)
 * 3. Terminal: completion/cancellation/failure message
 */

import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { useFloatingPillStore } from "../lib/db/floatingPillStore";
import "./BulkToneRankingModal.css";

const PILL_ID = "bulk-tone-ranking";

export default function BulkToneRankingModal({ progress, onConfirm, onCancel, onClose }) {
  const isMinimized = useFloatingPillStore((s) => s.isMinimized(PILL_ID));
  const progressStatus = progress?.status;

  // Update pill status when progress changes while minimized
  useEffect(() => {
    if (!isMinimized || !progress) return;
    let statusColor;
    if (progressStatus === "running") statusColor = "#f59e0b";
    else if (progressStatus === "complete") statusColor = "#10b981";
    else if (progressStatus === "failed") statusColor = "#ef4444";
    else statusColor = "#6b7280";
    let statusText;
    if (progressStatus === "running") statusText = "Ranking...";
    else if (progressStatus === "complete") statusText = "Complete";
    else if (progressStatus === "failed") statusText = "Failed";
    else if (progressStatus === "cancelled") statusText = "Cancelled";
    else statusText = "";
    useFloatingPillStore.getState().updatePill(PILL_ID, { statusText, statusColor });
  }, [isMinimized, progress, progressStatus]);

  // Clean up pill when process resets to idle
  useEffect(() => {
    if (!progress || progressStatus === "idle") {
      useFloatingPillStore.getState().remove(PILL_ID);
    }
  }, [progress, progressStatus]);

  if (!progress || progress.status === "idle") return null;
  if (isMinimized) return null;

  const isConfirming = progress.status === "confirming";
  const isTerminal =
    progress.status === "complete" ||
    progress.status === "cancelled" ||
    progress.status === "failed";

  let statusClass;
  if (progress.status === "complete") statusClass = "btrm-status-complete";
  else if (progress.status === "failed") statusClass = "btrm-status-failed";
  else if (progress.status === "cancelled") statusClass = "btrm-status-cancelled";
  else statusClass = "btrm-status-default";

  return (
    <div className="btrm-overlay">
      <div
        className={`btrm-dialog ${isConfirming ? "btrm-dialog-confirming" : "btrm-dialog-processing"}`}
      >
        {/* Header */}
        <div className="btrm-header">
          <div className="btrm-header-row">
            <h2 className="btrm-title">Tone Ranking</h2>
            <div className="btrm-header-actions">
              {!isConfirming && (
                <button
                  onClick={() =>
                    useFloatingPillStore.getState().minimize({
                      id: PILL_ID,
                      label: "Tone Ranking",
                      statusText: progress.status === "running" ? "Ranking..." : progress.status,
                      statusColor: (() => {
                        if (progress.status === "running") return "#f59e0b";
                        if (progress.status === "complete") return "#10b981";
                        return "#ef4444";
                      })(),
                      tabId: "chronicle",
                    })
                  }
                  className="illuminator-button btrm-minimize-btn"
                  title="Minimize to pill"
                >
                  ―
                </button>
              )}
              <span className={`btrm-status ${statusClass}`}>
                {isConfirming && `${progress.totalChronicles} chronicles`}
                {progress.status === "running" &&
                  (progress.processedChronicles > 0
                    ? `${progress.processedChronicles}/${progress.totalChronicles}`
                    : "Ranking...")}
                {progress.status === "complete" && "Complete"}
                {progress.status === "cancelled" && "Cancelled"}
                {progress.status === "failed" && "Failed"}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className={`btrm-body ${isConfirming ? "btrm-body-confirming" : ""}`}>
          {/* ---- Confirmation screen ---- */}
          {isConfirming && (
            <>
              <div className="btrm-info-box">
                Chronicles are split into batches of ~35-45. Each batch gets its own LLM call so the
                model maintains attention across all entries.
              </div>

              {/* Chronicle list */}
              <div className="btrm-chronicle-section">
                <div className="btrm-chronicle-heading">
                  Chronicles ({progress.chronicles.length})
                </div>

                <div className="btrm-chronicle-list">
                  {progress.chronicles.map((chron) => (
                    <div key={chron.chronicleId} className="btrm-chronicle-item">
                      {chron.title}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ---- Processing / Terminal screen ---- */}
          {!isConfirming && (
            <>
              {/* Batch processing status */}
              {progress.status === "running" &&
                (() => {
                  const pct =
                    progress.totalChronicles > 0
                      ? Math.round((progress.processedChronicles / progress.totalChronicles) * 100)
                      : 0;
                  return (
                    <div className="btrm-progress-section">
                      <div className="btrm-progress-header">
                        <span className="btrm-progress-title">
                          {progress.currentTitle ||
                            `Ranking ${progress.totalChronicles} chronicles...`}
                        </span>
                        {progress.processedChronicles > 0 && (
                          <span className="btrm-progress-pct">{pct}%</span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="btrm-progress-bar-track">
                        <div
                          className="btrm-progress-bar-fill"
                          // eslint-disable-next-line local/no-inline-styles -- dynamic progress width
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="btrm-progress-count">
                        {progress.processedChronicles} / {progress.totalChronicles} chronicles
                        ranked
                      </div>
                    </div>
                  );
                })()}

              {/* Terminal state messages */}
              {progress.status === "complete" && (
                <div className="btrm-terminal-msg btrm-terminal-msg-complete">
                  Ranked {progress.processedChronicles} of {progress.totalChronicles} chronicles.
                </div>
              )}

              {progress.status === "cancelled" && (
                <div className="btrm-terminal-msg btrm-terminal-msg-cancelled">
                  Cancelled after {progress.processedChronicles} of {progress.totalChronicles}{" "}
                  chronicles.
                </div>
              )}

              {progress.status === "failed" && (
                <div className="btrm-terminal-msg btrm-terminal-msg-failed">
                  {progress.error || "An unexpected error occurred."}
                </div>
              )}

              {/* Cost */}
              {progress.totalCost > 0 && (
                <div className="btrm-cost">Cost: ${progress.totalCost.toFixed(4)}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="btrm-footer">
          {isConfirming && (
            <>
              <button onClick={onCancel} className="illuminator-button btrm-footer-btn">
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="illuminator-button illuminator-button-primary btrm-footer-btn"
              >
                Rank ({progress.totalChronicles} chronicles)
              </button>
            </>
          )}
          {!isConfirming && !isTerminal && (
            <button onClick={onCancel} className="illuminator-button btrm-footer-btn">
              Cancel
            </button>
          )}
          {isTerminal && (
            <button onClick={onClose} className="illuminator-button btrm-footer-btn">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

BulkToneRankingModal.propTypes = {
  progress: PropTypes.object,
  onConfirm: PropTypes.func,
  onCancel: PropTypes.func,
  onClose: PropTypes.func,
};
