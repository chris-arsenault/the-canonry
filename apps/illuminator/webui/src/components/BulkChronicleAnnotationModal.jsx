/**
 * BulkChronicleAnnotationModal - Progress display for bulk chronicle annotation operations
 *
 * Handles both "Run Annotations" and "Clear Annotations" workflows.
 * Three phases: confirmation → processing → terminal.
 */

import { useEffect } from "react";
import { useFloatingPillStore } from "../lib/db/floatingPillStore";
import "./BulkChronicleAnnotationModal.css";

const PILL_ID = "bulk-chronicle-annotation";

export default function BulkChronicleAnnotationModal({ progress, onConfirm, onCancel, onClose }) {
  const isMinimized = useFloatingPillStore((s) => s.isMinimized(PILL_ID));

  // Update pill status when progress changes while minimized
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
        : progress.status === "complete"
          ? "Complete"
          : progress.status === "failed"
            ? "Failed"
            : progress.status === "cancelled"
              ? "Cancelled"
              : "";
    useFloatingPillStore.getState().updatePill(PILL_ID, { statusText, statusColor });
  }, [isMinimized, progress?.status, progress?.processedChronicles]);

  // Clean up pill when process resets to idle
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
  const isClear = progress.operation === "clear";
  const title = isClear ? "Clear Annotations" : "Run Annotations";
  const withNotes = progress.chronicles.filter((c) => c.hasNotes).length;
  const withTones = progress.chronicles.filter((c) => c.assignedTone).length;

  return (
    <div className="bcam-overlay">
      <div
        className="bcam-dialog"
        // eslint-disable-next-line local/no-inline-styles -- dynamic dialog width based on confirming state
        style={{ '--bcam-dialog-width': isConfirming ? '540px' : '480px' }}
      >
        {/* Header */}
        <div className="bcam-header">
          <div className="bcam-header-row">
            <h2 className="bcam-title">{title}</h2>
            <div className="bcam-header-actions">
              {!isConfirming && (
                <button
                  onClick={() =>
                    useFloatingPillStore.getState().minimize({
                      id: PILL_ID,
                      label: title,
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
                  className="illuminator-button bcam-minimize-btn"
                  title="Minimize to pill"
                >
                  ―
                </button>
              )}
              <span
                className="bcam-status-label"
                // eslint-disable-next-line local/no-inline-styles -- dynamic status color from progress.status
                style={{ '--bcam-status-color': progress.status === "complete" ? "#10b981" : progress.status === "failed" ? "#ef4444" : progress.status === "cancelled" ? "#f59e0b" : "var(--text-muted)" }}
              >
                {isConfirming && `${progress.totalChronicles} chronicles`}
                {progress.status === "running" &&
                  `${progress.processedChronicles}/${progress.totalChronicles}`}
                {progress.status === "complete" && "Complete"}
                {progress.status === "cancelled" && "Cancelled"}
                {progress.status === "failed" && "Failed"}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div
          className="bcam-body"
          // eslint-disable-next-line local/no-inline-styles -- dynamic overflow/flex based on confirming state
          style={{ '--bcam-body-overflow': isConfirming ? 'auto' : 'visible', '--bcam-body-flex': isConfirming ? 1 : 'unset' }}
        >
          {/* ---- Confirmation screen ---- */}
          {isConfirming && (
            <>
              <div className="bcam-confirm-info">
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
                      <span className="bcam-warning-text">
                        {" "}
                        {progress.totalChronicles - withTones} chronicle
                        {progress.totalChronicles - withTones !== 1 ? "s" : ""} have no assigned
                        tone and will default to "weary".
                      </span>
                    )}
                    {withNotes > 0 && (
                      <span className="bcam-warning-text">
                        {" "}
                        {withNotes} chronicle{withNotes !== 1 ? "s" : ""} already have annotations —
                        they will be replaced.
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Chronicle list */}
              <div className="bcam-chronicle-section">
                <div className="bcam-chronicle-heading">
                  Chronicles ({progress.chronicles.length})
                </div>

                <div className="bcam-chronicle-list">
                  {progress.chronicles.map((chron) => (
                    <div
                      key={chron.chronicleId}
                      className="bcam-chronicle-item"
                    >
                      <span className="bcam-chronicle-title">
                        {chron.title}
                      </span>
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

          {/* ---- Processing / Terminal screen ---- */}
          {!isConfirming && (
            <>
              {progress.status === "running" &&
                (() => {
                  const pct =
                    progress.totalChronicles > 0
                      ? Math.round((progress.processedChronicles / progress.totalChronicles) * 100)
                      : 0;
                  return (
                    <div className="bcam-progress-section">
                      <div className="bcam-progress-header">
                        <span className="bcam-current-title">
                          {progress.currentTitle || (isClear ? "Clearing..." : "Annotating...")}
                        </span>
                        <span className="bcam-pct-label">
                          {pct}%
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="bcam-progress-track">
                        <div
                          className="bcam-progress-fill"
                          // eslint-disable-next-line local/no-inline-styles -- dynamic progress bar width
                          style={{ '--bcam-pct': `${pct}%` }}
                        />
                      </div>

                      <div className="bcam-progress-stats">
                        <span>
                          {progress.processedChronicles} / {progress.totalChronicles}{" "}
                          {isClear ? "cleared" : "annotated"}
                        </span>
                        {!isClear && progress.currentTone && (
                          <span>tone: {progress.currentTone}</span>
                        )}
                      </div>
                    </div>
                  );
                })()}

              {/* Terminal state messages */}
              {progress.status === "complete" && (
                <div className="bcam-terminal-complete">
                  {isClear
                    ? `Cleared annotations from ${progress.processedChronicles} chronicle${progress.processedChronicles !== 1 ? "s" : ""}.`
                    : `Annotated ${progress.processedChronicles} of ${progress.totalChronicles} chronicles.`}
                  {progress.failedChronicles.length > 0 &&
                    ` (${progress.failedChronicles.length} failed)`}
                </div>
              )}

              {progress.status === "cancelled" && (
                <div className="bcam-terminal-cancelled">
                  Cancelled after {progress.processedChronicles} of {progress.totalChronicles}{" "}
                  chronicles.
                </div>
              )}

              {progress.status === "failed" && (
                <div className="bcam-terminal-failed">
                  {progress.error || "An unexpected error occurred."}
                </div>
              )}

              {/* Failed chronicles list */}
              {progress.failedChronicles.length > 0 && (
                <div className="bcam-failed-section">
                  <div className="bcam-failed-heading">
                    Failed ({progress.failedChronicles.length})
                  </div>
                  {progress.failedChronicles.map((f) => (
                    <div
                      key={f.chronicleId}
                      className="bcam-failed-item"
                    >
                      {f.title}: {f.error}
                    </div>
                  ))}
                </div>
              )}

              {/* Cost */}
              {progress.totalCost > 0 && (
                <div className="bcam-cost">
                  Cost: ${progress.totalCost.toFixed(4)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bcam-footer">
          {isConfirming && (
            <>
              <button
                onClick={onCancel}
                className="illuminator-button bcam-footer-btn"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="illuminator-button illuminator-button-primary bcam-footer-btn"
              >
                {isClear
                  ? `Clear (${progress.totalChronicles} chronicles)`
                  : `Annotate (${progress.totalChronicles} chronicles)`}
              </button>
            </>
          )}
          {!isConfirming && !isTerminal && (
            <button
              onClick={onCancel}
              className="illuminator-button bcam-footer-btn"
            >
              Cancel
            </button>
          )}
          {isTerminal && (
            <button
              onClick={onClose}
              className="illuminator-button bcam-footer-btn"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
