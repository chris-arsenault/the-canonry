/**
 * BulkFactCoverageModal - Progress display for bulk canon fact coverage analysis
 *
 * Three phases following BulkHistorianModal pattern:
 * 1. Confirmation: chronicle list with count
 * 2. Processing: progress bar, current chronicle, cost
 * 3. Terminal: completion/cancellation/failure message
 */

import { useEffect } from "react";
import { useFloatingPillStore } from "../lib/db/floatingPillStore";
import "./BulkFactCoverageModal.css";

const PILL_ID = "bulk-fact-coverage";

export default function BulkFactCoverageModal({ progress, onConfirm, onCancel, onClose }) {
  const isMinimized = useFloatingPillStore((s) => s.isMinimized(PILL_ID));

  useEffect(() => {
    if (!isMinimized || !progress) return;
    const statusColor =
      progress.status === "running"
        ? "#f59e0b"
        : progress.status === "complete"
          ? "#10b981"
          : progress.status === "failed"
            ? "#ef4444"
            : "#6b7280";
    const statusText =
      progress.status === "running"
        ? `${progress.processedChronicles}/${progress.totalChronicles}`
        : progress.status;
    useFloatingPillStore.getState().updatePill(PILL_ID, { statusText, statusColor });
  }, [isMinimized, progress?.status, progress?.processedChronicles]);

  useEffect(() => {
    if (!progress || progress.status === "idle") {
      useFloatingPillStore.getState().remove(PILL_ID);
    }
  }, [progress?.status]);

  if (!progress || progress.status === "idle") return null;
  if (isMinimized) return null;

  const isConfirming = progress.status === "confirming";
  const isTerminal =
    progress.status === "complete" ||
    progress.status === "cancelled" ||
    progress.status === "failed";

  const globalPercent =
    progress.totalChronicles > 0
      ? Math.round((progress.processedChronicles / progress.totalChronicles) * 100)
      : 0;

  return (
    <div className="bfc-overlay">
      <div
        className="bfc-dialog"
        // eslint-disable-next-line local/no-inline-styles -- dynamic dialog width based on phase
        style={{ '--bfc-dialog-width': isConfirming ? '540px' : '480px' }}
      >
        {/* Header */}
        <div className="bfc-header">
          <div className="bfc-header-row">
            <h2 className="bfc-title">Fact Coverage Analysis</h2>
            <div className="bfc-header-actions">
              {!isConfirming && (
                <button
                  onClick={() =>
                    useFloatingPillStore.getState().minimize({
                      id: PILL_ID,
                      label: "Fact Coverage",
                      statusText:
                        progress.status === "running"
                          ? `${progress.processedChronicles}/${progress.totalChronicles}`
                          : progress.status,
                      statusColor:
                        progress.status === "running"
                          ? "#f59e0b"
                          : progress.status === "complete"
                            ? "#10b981"
                            : "#ef4444",
                      tabId: "chronicle",
                    })
                  }
                  className="illuminator-button bfc-minimize-btn"
                  title="Minimize to pill"
                >
                  ―
                </button>
              )}
              <span
                className="bfc-status-text"
                // eslint-disable-next-line local/no-inline-styles -- dynamic status color based on progress.status
                style={{ '--bfc-status-color': progress.status === "complete" ? "#10b981" : progress.status === "failed" ? "#ef4444" : progress.status === "cancelled" ? "#f59e0b" : "var(--text-muted)" }}
              >
                {isConfirming && `${progress.totalChronicles} chronicles`}
                {progress.status === "running" && "Analyzing..."}
                {progress.status === "complete" && "Complete"}
                {progress.status === "cancelled" && "Cancelled"}
                {progress.status === "failed" && "Failed"}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className={`bfc-body ${isConfirming ? 'bfc-body--confirming' : 'bfc-body--processing'}`}>
          {/* ---- Confirmation screen ---- */}
          {isConfirming && (
            <>
              <div className="bfc-confirm-info">
                Analyze each chronicle's narrative against all canon facts using Haiku. Results are
                stored per-chronicle and visible in the Reference tab.
              </div>

              {/* Chronicle list */}
              <div className="bfc-list-section">
                <div className="bfc-section-label">
                  Chronicles ({progress.chronicles.length})
                </div>

                <div className="bfc-chronicle-list">
                  {progress.chronicles.map((chron) => (
                    <div
                      key={chron.chronicleId}
                      className="bfc-chronicle-item"
                    >
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
              {/* Global progress */}
              <div className="bfc-progress-section">
                <div className="bfc-progress-header">
                  <span className="bfc-progress-label">
                    Chronicle {Math.min(progress.processedChronicles + 1, progress.totalChronicles)}{" "}
                    / {progress.totalChronicles}
                  </span>
                  <span className="bfc-progress-percent">
                    {globalPercent}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="bfc-progress-track">
                  <div
                    className="bfc-progress-fill"
                    // eslint-disable-next-line local/no-inline-styles -- dynamic progress width and color from JS variables
                    style={{ '--bfc-progress-bg': progress.status === "failed" ? "#ef4444" : progress.status === "cancelled" ? "#f59e0b" : "#10b981", '--bfc-progress-width': `${globalPercent}%` }}
                  />
                </div>

                <div className="bfc-progress-detail">
                  {progress.processedChronicles} / {progress.totalChronicles} chronicles
                  {progress.failedChronicles.length > 0 && (
                    <span className="bfc-failed-count">
                      {progress.failedChronicles.length} failed
                    </span>
                  )}
                </div>
              </div>

              {/* Current chronicle */}
              {progress.currentTitle && !isTerminal && (
                <div className="bfc-current-item">
                  <div className="bfc-current-item-title">
                    {progress.currentTitle}
                  </div>
                  <div className="bfc-current-item-sub">
                    Analyzing fact coverage...
                  </div>
                </div>
              )}

              {/* Terminal state messages */}
              {progress.status === "complete" && (
                <div className="bfc-terminal-complete">
                  Analyzed {progress.processedChronicles} chronicles.
                  {progress.failedChronicles.length > 0 && (
                    <span className="bfc-failed-inline">
                      {" "}
                      {progress.failedChronicles.length} failed.
                    </span>
                  )}
                </div>
              )}

              {progress.status === "cancelled" && (
                <div className="bfc-terminal-cancelled">
                  Cancelled after {progress.processedChronicles} of {progress.totalChronicles}{" "}
                  chronicles.
                </div>
              )}

              {progress.status === "failed" && (
                <div className="bfc-terminal-failed">
                  {progress.error || "An unexpected error occurred."}
                </div>
              )}

              {/* Failed chronicles list */}
              {isTerminal && progress.failedChronicles.length > 0 && (
                <div className="bfc-failed-section">
                  <div className="bfc-failed-label">
                    Failed ({progress.failedChronicles.length})
                  </div>
                  <div className="bfc-failed-list">
                    {progress.failedChronicles.map((f) => (
                      <div
                        key={f.chronicleId}
                        className="bfc-failed-item"
                      >
                        <span className="bfc-failed-item-title">{f.title}</span>
                        <span className="bfc-failed-item-error">{f.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cost */}
              {progress.totalCost > 0 && (
                <div className="bfc-cost">
                  Cost: ${progress.totalCost.toFixed(4)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bfc-footer">
          {isConfirming && (
            <>
              <button
                onClick={onCancel}
                className="illuminator-button bfc-footer-btn"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="illuminator-button illuminator-button-primary bfc-footer-btn"
              >
                Analyze ({progress.totalChronicles} chronicles)
              </button>
            </>
          )}
          {!isConfirming && !isTerminal && (
            <button
              onClick={onCancel}
              className="illuminator-button bfc-footer-btn"
            >
              Cancel
            </button>
          )}
          {isTerminal && (
            <button
              onClick={onClose}
              className="illuminator-button bfc-footer-btn"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
