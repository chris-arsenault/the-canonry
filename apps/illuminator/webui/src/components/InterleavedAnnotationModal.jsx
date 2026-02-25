/**
 * InterleavedAnnotationModal — Progress display for interleaved chronicle + entity annotation.
 *
 * Three phases: confirmation → processing → terminal.
 * Confirmation shows grouped work list: chronicles with entity clusters indented below.
 */

import { useEffect } from "react";
import { TONE_META } from "./HistorianToneSelector";
import { useFloatingPillStore } from "../lib/db/floatingPillStore";
import "./InterleavedAnnotationModal.css";

const PILL_ID = "interleaved-annotation";

export default function InterleavedAnnotationModal({ progress, onConfirm, onCancel, onClose }) {
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
        ? `${progress.processedItems}/${progress.totalItems}`
        : progress.status;
    useFloatingPillStore.getState().updatePill(PILL_ID, { statusText, statusColor });
  }, [isMinimized, progress?.status, progress?.processedItems]);

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
    progress.totalItems > 0 ? Math.round((progress.processedItems / progress.totalItems) * 100) : 0;

  return (
    <div className="iam-overlay">
      <div
        className="iam-dialog"
        // eslint-disable-next-line local/no-inline-styles -- dynamic dialog width based on phase
        style={{ '--iam-dialog-width': isConfirming ? '560px' : '480px' }}
      >
        {/* Header */}
        <div className="iam-header">
          <div className="iam-header-row">
            <h2 className="iam-title">Interleaved Annotation</h2>
            <div className="iam-header-actions">
              {!isConfirming && (
                <button
                  onClick={() =>
                    useFloatingPillStore.getState().minimize({
                      id: PILL_ID,
                      label: "Interleaved Annotation",
                      statusText:
                        progress.status === "running"
                          ? `${progress.processedItems}/${progress.totalItems}`
                          : progress.status,
                      statusColor:
                        progress.status === "running"
                          ? "#f59e0b"
                          : progress.status === "complete"
                            ? "#10b981"
                            : "#ef4444",
                    })
                  }
                  className="illuminator-button iam-minimize-btn"
                  title="Minimize to pill"
                >
                  —
                </button>
              )}
              <span
                className="iam-status-text"
                // eslint-disable-next-line local/no-inline-styles -- dynamic status color based on progress.status
                style={{ '--iam-status-color': progress.status === "complete" ? "#10b981" : progress.status === "failed" ? "#ef4444" : progress.status === "cancelled" ? "#f59e0b" : "var(--text-muted)" }}
              >
                {isConfirming && `${progress.totalItems} items`}
                {progress.status === "running" &&
                  `${progress.processedItems}/${progress.totalItems}`}
                {progress.status === "complete" && "Complete"}
                {progress.status === "cancelled" && "Cancelled"}
                {progress.status === "failed" && "Failed"}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className={`iam-body ${isConfirming ? 'iam-body--confirming' : 'iam-body--processing'}`}>
          {/* ---- Confirmation screen ---- */}
          {isConfirming && (
            <>
              <div className="iam-confirm-info">
                Chronicles in chronological order, each followed by its referenced entities. Results
                auto-applied. Voice digest accumulates across both types.
                <div className="iam-confirm-summary">
                  {progress.chronicleCount} chronicles + {progress.entityCount} entities ={" "}
                  {progress.totalItems} total
                </div>
              </div>

              {/* Work list — grouped */}
              <div className="iam-worklist-section">
                <div className="iam-section-label">
                  Work List
                </div>

                <div className="iam-worklist">
                  {progress.workItems.map((item) => {
                    const isChronicle = item.type === "chronicle";
                    const toneMeta = TONE_META[item.tone];
                    return (
                      <div
                        key={isChronicle ? `c-${item.chronicleId}` : `e-${item.entityId}`}
                        className={`iam-work-item ${isChronicle ? 'iam-work-item--chronicle' : 'iam-work-item--entity'}`}
                      >
                        <div className="iam-work-item-left">
                          <span className={`iam-work-item-icon ${isChronicle ? 'iam-work-item-icon--chronicle' : 'iam-work-item-icon--entity'}`}>
                            {isChronicle ? "\u25a0" : "\u25cb"}
                          </span>
                          <span className={`iam-work-item-name ${isChronicle ? 'iam-work-item-name--chronicle' : 'iam-work-item-name--entity'}`}>
                            {isChronicle ? item.title : item.entityName}
                          </span>
                          {!isChronicle && (
                            <span className="iam-work-item-kind">
                              {item.entityKind}
                            </span>
                          )}
                        </div>
                        <span
                          className="iam-work-item-tone"
                          title={toneMeta?.label || item.tone}
                        >
                          {toneMeta?.symbol || item.tone}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ---- Processing screen ---- */}
          {!isConfirming && (
            <>
              <div className="iam-progress-section">
                <div className="iam-progress-header">
                  <span className="iam-progress-label">
                    Item {Math.min(progress.processedItems + 1, progress.totalItems)} /{" "}
                    {progress.totalItems}
                  </span>
                  <span className="iam-progress-percent">
                    {globalPercent}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="iam-progress-track">
                  <div
                    className="iam-progress-fill"
                    // eslint-disable-next-line local/no-inline-styles -- dynamic progress width and color from JS variables
                    style={{ '--iam-progress-bg': progress.status === "failed" ? "#ef4444" : progress.status === "cancelled" ? "#f59e0b" : "#10b981", '--iam-progress-width': `${globalPercent}%` }}
                  />
                </div>

                <div className="iam-progress-detail">
                  <span>
                    Chronicles: {progress.processedChronicles}/{progress.chronicleCount}
                    {" \u00b7 "}
                    Entities: {progress.processedEntities}/{progress.entityCount}
                  </span>
                  {progress.failedItems.length > 0 && (
                    <span className="iam-failed-count">{progress.failedItems.length} failed</span>
                  )}
                </div>
              </div>

              {/* Current item */}
              {progress.currentItem && !isTerminal && (
                <div className="iam-current-item">
                  <div className="iam-current-item-header">
                    <span className={`iam-current-item-icon ${progress.currentItem.type === "chronicle" ? 'iam-work-item-icon--chronicle' : 'iam-work-item-icon--entity'}`}>
                      {progress.currentItem.type === "chronicle" ? "\u25a0" : "\u25cb"}
                    </span>
                    {progress.currentItem.type === "chronicle"
                      ? progress.currentItem.title
                      : progress.currentItem.entityName}
                    {TONE_META[progress.currentItem.tone] && (
                      <span className="iam-current-item-tone">
                        {TONE_META[progress.currentItem.tone].symbol}
                      </span>
                    )}
                  </div>
                  <div className="iam-current-item-sub">
                    {progress.currentItem.type === "chronicle"
                      ? "Annotating chronicle..."
                      : "Annotating entity..."}
                  </div>
                </div>
              )}

              {/* Terminal state messages */}
              {progress.status === "complete" && (
                <div className="iam-terminal-complete">
                  Annotated {progress.processedChronicles} chronicles and{" "}
                  {progress.processedEntities} entities.
                  {progress.failedItems.length > 0 && (
                    <span className="iam-failed-inline"> {progress.failedItems.length} failed.</span>
                  )}
                </div>
              )}

              {progress.status === "cancelled" && (
                <div className="iam-terminal-cancelled">
                  Cancelled after {progress.processedItems} of {progress.totalItems} items (
                  {progress.processedChronicles} chronicles, {progress.processedEntities} entities).
                </div>
              )}

              {progress.status === "failed" && (
                <div className="iam-terminal-failed">
                  {progress.error || "An unexpected error occurred."}
                </div>
              )}

              {/* Failed items list */}
              {isTerminal && progress.failedItems.length > 0 && (
                <div className="iam-failed-section">
                  <div className="iam-failed-label">
                    Failed ({progress.failedItems.length})
                  </div>
                  {progress.failedItems.map((f, i) => (
                    <div key={i} className="iam-failed-item">
                      {f.item.type === "chronicle" ? f.item.title : f.item.entityName}: {f.error}
                    </div>
                  ))}
                </div>
              )}

              {/* Cost */}
              {progress.totalCost > 0 && (
                <div className="iam-cost">
                  Cost: ${progress.totalCost.toFixed(4)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="iam-footer">
          {isConfirming && (
            <>
              <button
                onClick={onCancel}
                className="illuminator-button iam-footer-btn"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="illuminator-button illuminator-button-primary iam-footer-btn"
              >
                Start ({progress.totalItems} items)
              </button>
            </>
          )}
          {!isConfirming && !isTerminal && (
            <button
              onClick={onCancel}
              className="illuminator-button iam-footer-btn"
            >
              Cancel
            </button>
          )}
          {isTerminal && (
            <button
              onClick={onClose}
              className="illuminator-button iam-footer-btn"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
