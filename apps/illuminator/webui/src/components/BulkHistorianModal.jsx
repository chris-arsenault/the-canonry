/**
 * BulkHistorianModal - Progress display for bulk historian annotation and copy-edit
 *
 * Three phases:
 * 1. Confirmation: entity list, tone selection (edition) or tone cycle preview (review)
 * 2. Processing: progress bar, current entity, cost
 * 3. Terminal: completion/cancellation/failure message, failed entities list
 */

import { useEffect } from "react";
import { TONE_META } from "./HistorianToneSelector";
import { useFloatingPillStore } from "../lib/db/floatingPillStore";
import "./BulkHistorianModal.css";

const TONE_CYCLE_ORDER = ["witty", "weary", "forensic", "elegiac", "cantankerous"];
const PILL_ID = "bulk-historian";

export default function BulkHistorianModal({
  progress,
  onConfirm,
  onCancel,
  onClose,
  onChangeTone,
  editionMaxTokens,
}) {
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
        ? `${progress.processedEntities}/${progress.totalEntities}`
        : progress.status;
    useFloatingPillStore.getState().updatePill(PILL_ID, { statusText, statusColor });
  }, [isMinimized, progress?.status, progress?.processedEntities]);

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
  const isReview = progress.operation === "review";
  const isClear = progress.operation === "clear";

  const globalPercent =
    progress.totalEntities > 0
      ? Math.round((progress.processedEntities / progress.totalEntities) * 100)
      : 0;

  const title = isClear ? "Clear All Annotations" : isReview ? "Bulk Annotation" : "Bulk Copy Edit";

  const statusColor =
    progress.status === "complete"
      ? "#10b981"
      : progress.status === "failed"
        ? "#ef4444"
        : progress.status === "cancelled"
          ? "#f59e0b"
          : "var(--text-muted)";

  const progressFillClass =
    progress.status === "failed"
      ? "bhm-progress-fill bhm-progress-fill--failed"
      : progress.status === "cancelled"
        ? "bhm-progress-fill bhm-progress-fill--cancelled"
        : "bhm-progress-fill bhm-progress-fill--complete";

  return (
    <div className="bhm-overlay">
      <div
        className="bhm-modal"
        // eslint-disable-next-line local/no-inline-styles -- dynamic width based on confirming state
        style={{ width: isConfirming ? "540px" : "480px" }}
      >
        {/* Header */}
        <div className="bhm-header">
          <div className="bhm-header-row">
            <h2 className="bhm-title">{title}</h2>
            <div className="bhm-header-actions">
              {!isConfirming && (
                <button
                  onClick={() =>
                    useFloatingPillStore.getState().minimize({
                      id: PILL_ID,
                      label: isReview ? "Bulk Annotation" : "Bulk Copy Edit",
                      statusText:
                        progress.status === "running"
                          ? `${progress.processedEntities}/${progress.totalEntities}`
                          : progress.status,
                      statusColor:
                        progress.status === "running"
                          ? "#f59e0b"
                          : progress.status === "complete"
                            ? "#10b981"
                            : "#ef4444",
                    })
                  }
                  className="illuminator-button bhm-minimize-btn"
                  title="Minimize to pill"
                >
                  ―
                </button>
              )}
              <span
                className="bhm-status-label"
                // eslint-disable-next-line local/no-inline-styles -- dynamic color from status
                style={{ color: statusColor }}
              >
                {isConfirming && `${progress.totalEntities} entities`}
                {progress.status === "running" && "Processing..."}
                {progress.status === "complete" && "Complete"}
                {progress.status === "cancelled" && "Cancelled"}
                {progress.status === "failed" && "Failed"}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div
          className="bhm-body"
          // eslint-disable-next-line local/no-inline-styles -- dynamic overflow/flex based on confirming state
          style={{
            overflowY: isConfirming ? "auto" : "visible",
            flex: isConfirming ? 1 : undefined,
          }}
        >
          {/* ---- Confirmation screen ---- */}
          {isConfirming && (
            <>
              {/* Tone section (not for clear) */}
              {isClear ? null : isReview ? (
                /* Review mode: show tone cycling info */
                <div className="bhm-tone-cycle-box">
                  <span className="bhm-tone-cycle-label">
                    Tones cycle:
                  </span>
                  {TONE_CYCLE_ORDER.map((t, i) => {
                    const meta = TONE_META[t];
                    return (
                      <span key={t}>
                        {i > 0 && (
                          <span className="bhm-tone-cycle-arrow">
                            &rarr;
                          </span>
                        )}
                        <span className="bhm-tone-cycle-symbol">{meta?.symbol}</span> {meta?.label}
                      </span>
                    );
                  })}
                </div>
              ) : (
                /* Edition mode: tone picker */
                <div className="bhm-tone-picker">
                  <div className="bhm-section-label">
                    Historian Tone
                  </div>
                  <div className="bhm-tone-options">
                    {TONE_CYCLE_ORDER.map((t) => {
                      const meta = TONE_META[t];
                      const isSelected = progress.tone === t;
                      return (
                        <button
                          key={t}
                          onClick={() => onChangeTone(t)}
                          className={`bhm-tone-btn ${isSelected ? "bhm-tone-btn--selected" : "bhm-tone-btn--default"}`}
                        >
                          <span className="bhm-tone-btn-symbol">{meta?.symbol}</span>
                          {meta?.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Entity list */}
              <div className="bhm-entity-section">
                <div className="bhm-entity-section-label">
                  Entities ({progress.entities.length})
                </div>

                <div className="bhm-entity-list">
                  {progress.entities.map((entity, i) => (
                    <div
                      key={entity.entityId}
                      className="bhm-entity-row"
                      // eslint-disable-next-line local/no-inline-styles -- dynamic border for last-child separation
                      style={{
                        borderBottom:
                          i < progress.entities.length - 1
                            ? "1px solid var(--border-color)"
                            : "none",
                      }}
                    >
                      <div className="bhm-entity-row-info">
                        {isReview && entity.tone && (
                          <span
                            className="bhm-entity-tone-symbol"
                            title={TONE_META[entity.tone]?.label || entity.tone}
                          >
                            {TONE_META[entity.tone]?.symbol}
                          </span>
                        )}
                        <span className="bhm-entity-name">
                          {entity.entityName}
                        </span>
                        <span className="bhm-entity-kind">
                          {entity.entityKind}
                          {entity.entitySubtype ? ` / ${entity.entitySubtype}` : ""}
                        </span>
                      </div>
                      {!isReview && entity.tokenEstimate > 0 && (
                        <span
                          className="bhm-entity-tokens"
                          // eslint-disable-next-line local/no-inline-styles -- dynamic color from token limit comparison
                          style={{
                            color:
                              editionMaxTokens && entity.tokenEstimate > editionMaxTokens
                                ? "#ef4444"
                                : "var(--text-muted)",
                          }}
                          title={`~${entity.tokenEstimate} tokens estimated from word count`}
                        >
                          ~{entity.tokenEstimate.toLocaleString()}t
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Token estimate summary for edition mode */}
              {!isReview &&
                !isClear &&
                (() => {
                  const estimates = progress.entities
                    .map((e) => e.tokenEstimate || 0)
                    .filter((t) => t > 0);
                  if (estimates.length === 0) return null;
                  const maxEst = Math.max(...estimates);
                  const overCount = editionMaxTokens
                    ? estimates.filter((t) => t > editionMaxTokens).length
                    : 0;
                  return (
                    <div
                      className={`bhm-token-summary ${overCount > 0 ? "bhm-token-summary--over" : "bhm-token-summary--ok"}`}
                    >
                      <div>
                        Largest description: <strong>~{maxEst.toLocaleString()} tokens</strong>
                        {editionMaxTokens > 0 && (
                          <span className="bhm-token-limit-note">
                            (output limit: <strong>{editionMaxTokens.toLocaleString()}</strong>)
                          </span>
                        )}
                      </div>
                      {overCount > 0 && (
                        <div className="bhm-token-over-warning">
                          {overCount} {overCount === 1 ? "entity exceeds" : "entities exceed"} the
                          current output token limit — results may be truncated.
                        </div>
                      )}
                    </div>
                  );
                })()}
            </>
          )}

          {/* ---- Processing screen ---- */}
          {!isConfirming && (
            <>
              {/* Global progress */}
              <div className="bhm-progress-section">
                <div className="bhm-progress-header">
                  <span className="bhm-progress-entity-label">
                    Entity {Math.min(progress.processedEntities + 1, progress.totalEntities)} /{" "}
                    {progress.totalEntities}
                  </span>
                  <span className="bhm-progress-percent">
                    {globalPercent}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="bhm-progress-track">
                  <div
                    className={progressFillClass}
                    // eslint-disable-next-line local/no-inline-styles -- dynamic width from progress percentage
                    style={{ width: `${globalPercent}%` }}
                  />
                </div>

                <div className="bhm-progress-counts">
                  {progress.processedEntities} / {progress.totalEntities} entities
                  {progress.failedEntities.length > 0 && (
                    <span className="bhm-progress-failed-count">
                      {progress.failedEntities.length} failed
                    </span>
                  )}
                </div>
              </div>

              {/* Current entity detail */}
              {progress.currentEntityName && !isTerminal && (
                <div className="bhm-current-entity">
                  <div className="bhm-current-entity-name">
                    {progress.currentEntityTone && TONE_META[progress.currentEntityTone] && (
                      <span className="bhm-current-entity-tone">
                        {TONE_META[progress.currentEntityTone].symbol}
                      </span>
                    )}
                    {progress.currentEntityName}
                  </div>
                  <div className="bhm-current-entity-status">
                    {isClear
                      ? "Clearing annotations..."
                      : isReview
                        ? "Generating annotations..."
                        : "Generating copy edit..."}
                  </div>
                </div>
              )}

              {/* Terminal state messages */}
              {progress.status === "complete" && (
                <div className="bhm-terminal-msg bhm-terminal-msg--complete">
                  {isClear
                    ? `Cleared annotations from ${progress.processedEntities} entities.`
                    : isReview
                      ? `Annotated ${progress.processedEntities} entities.`
                      : `Copy-edited ${progress.processedEntities} entities.`}
                  {progress.failedEntities.length > 0 && (
                    <span className="bhm-terminal-failed-inline">
                      {" "}
                      {progress.failedEntities.length} failed.
                    </span>
                  )}
                </div>
              )}

              {progress.status === "cancelled" && (
                <div className="bhm-terminal-msg bhm-terminal-msg--cancelled">
                  Cancelled after processing {progress.processedEntities} of{" "}
                  {progress.totalEntities} entities.
                </div>
              )}

              {progress.status === "failed" && (
                <div className="bhm-terminal-msg bhm-terminal-msg--failed">
                  {progress.error || "An unexpected error occurred."}
                </div>
              )}

              {/* Failed entities list */}
              {isTerminal && progress.failedEntities.length > 0 && (
                <div className="bhm-failed-section">
                  <div className="bhm-failed-label">
                    Failed ({progress.failedEntities.length})
                  </div>
                  <div className="bhm-failed-list">
                    {progress.failedEntities.map((f, i) => (
                      <div
                        key={f.entityId}
                        className="bhm-failed-row"
                        // eslint-disable-next-line local/no-inline-styles -- dynamic border for last-child separation
                        style={{
                          borderBottom:
                            i < progress.failedEntities.length - 1
                              ? "1px solid var(--border-color)"
                              : "none",
                        }}
                      >
                        <span className="bhm-failed-name">{f.entityName}</span>
                        <span className="bhm-failed-error">{f.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cost */}
              {progress.totalCost > 0 && (
                <div className="bhm-cost">
                  Cost: ${progress.totalCost.toFixed(4)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bhm-footer">
          {isConfirming && (
            <>
              <button
                onClick={onCancel}
                className="illuminator-button bhm-footer-btn"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="illuminator-button illuminator-button-primary bhm-footer-btn"
              >
                {isClear
                  ? `Clear Annotations (${progress.totalEntities} entities)`
                  : isReview
                    ? `Start Annotation (${progress.totalEntities} entities)`
                    : `Start Copy Edit (${progress.totalEntities} entities)`}
              </button>
            </>
          )}
          {!isConfirming && !isTerminal && (
            <button
              onClick={onCancel}
              className="illuminator-button bhm-footer-btn"
            >
              Cancel
            </button>
          )}
          {isTerminal && (
            <button
              onClick={onClose}
              className="illuminator-button bhm-footer-btn"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
