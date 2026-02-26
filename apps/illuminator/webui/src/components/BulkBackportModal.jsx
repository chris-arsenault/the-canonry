/**
 * BulkBackportModal - Progress display for automatic multi-chronicle bulk backport
 *
 * Two phases:
 * 1. Confirmation: entity list with chronicle counts, confirm/cancel buttons
 * 2. Processing: progress bars, current chronicle, entity count, cost
 */

import React, { useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { useFloatingPillStore } from "../lib/db/floatingPillStore";
import "./BulkBackportModal.css";

const PILL_ID = "bulk-backport";

export default function BulkBackportModal({ progress, onConfirm, onCancel, onClose }) {
  const isMinimized = useFloatingPillStore((s) => s.isMinimized(PILL_ID));

  const progressStatus = progress?.status;
  const processedEntities = progress?.processedEntities;
  const totalEntities = progress?.totalEntities;
  const chronicles = progress?.chronicles;

  useEffect(() => {
    if (!isMinimized || !progress) return;
    let statusColor;
    if (progressStatus === "running") statusColor = "#f59e0b";
    else if (progressStatus === "complete") statusColor = "#10b981";
    else if (progressStatus === "failed") statusColor = "#ef4444";
    else statusColor = "#6b7280";
    const statusText =
      progressStatus === "running"
        ? `${processedEntities}/${totalEntities}`
        : progressStatus;
    useFloatingPillStore.getState().updatePill(PILL_ID, { statusText, statusColor });
  }, [isMinimized, progress, progressStatus, processedEntities, totalEntities]);

  useEffect(() => {
    if (!progress || progressStatus === "idle") {
      useFloatingPillStore.getState().remove(PILL_ID);
    }
  }, [progress, progressStatus]);

  const realTotal = useMemo(
    () => chronicles ? chronicles.reduce((sum, c) => sum + c.totalEntities, 0) : 0,
    [chronicles]
  );

  if (!progress || progress.status === "idle") return null;
  if (isMinimized) return null;

  const isConfirming = progress.status === "confirming";
  const isTerminal =
    progress.status === "complete" ||
    progress.status === "cancelled" ||
    progress.status === "failed";
  const currentChronicle = progress.chronicles[progress.currentChronicleIndex];

  const globalPercent =
    progress.totalEntities > 0
      ? Math.round((progress.processedEntities / progress.totalEntities) * 100)
      : 0;

  const completedChronicles = progress.chronicles.filter((c) => c.status === "complete").length;
  const failedChronicles = progress.chronicles.filter((c) => c.status === "failed").length;

  let statusClass;
  if (progress.status === "complete") statusClass = "bbm-status-complete";
  else if (progress.status === "failed") statusClass = "bbm-status-failed";
  else if (progress.status === "cancelled") statusClass = "bbm-status-cancelled";
  else statusClass = "bbm-status-default";

  let progressFillModifier;
  if (progress.status === "failed") progressFillModifier = "bbm-progress-fill-failed";
  else if (progress.status === "cancelled") progressFillModifier = "bbm-progress-fill-cancelled";
  else progressFillModifier = "bbm-progress-fill-ok";
  const progressFillClass = `bbm-progress-fill ${progressFillModifier}`;

  return (
    <div className="bbm-overlay">
      <div
        className={`bbm-dialog ${isConfirming ? "bbm-dialog-confirming" : "bbm-dialog-processing"}`}
      >
        {/* Header */}
        <div className="bbm-header">
          <div className="bbm-header-row">
            <h2 className="bbm-title">Bulk Backport</h2>
            <div className="bbm-header-actions">
              {!isConfirming && (
                <button
                  onClick={() =>
                    useFloatingPillStore.getState().minimize({
                      id: PILL_ID,
                      label: "Bulk Backport",
                      statusText:
                        progress.status === "running"
                          ? `${progress.processedEntities}/${progress.totalEntities}`
                          : progress.status,
                      statusColor: (() => {
                        if (progress.status === "running") return "#f59e0b";
                        if (progress.status === "complete") return "#10b981";
                        return "#ef4444";
                      })(),
                    })
                  }
                  className="illuminator-button bbm-minimize-btn"
                  title="Minimize to pill"
                >
                  ―
                </button>
              )}
              <span className={`bbm-status ${statusClass}`}>
                {isConfirming && `${progress.chronicles.length} chronicles`}
                {progress.status === "running" && "Processing..."}
                {progress.status === "complete" && "Complete"}
                {progress.status === "cancelled" && "Cancelled"}
                {progress.status === "failed" && "Failed"}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className={`bbm-body ${isConfirming ? "bbm-body-confirming" : "bbm-body-processing"}`}>
          {/* ---- Confirmation screen ---- */}
          {isConfirming && progress.entitySummary && (
            <>
              <div className="bbm-entity-section">
                <div className="bbm-entity-header">
                  <span className="bbm-section-label">
                    Entities ({progress.entitySummary.length})
                  </span>
                  <span className="bbm-section-meta">
                    {progress.totalEntities} updates across {progress.chronicles.length} chronicles
                  </span>
                </div>

                <div className="bbm-entity-list">
                  {progress.entitySummary.map((entity, i) => (
                    <div
                      key={entity.entityId}
                      className={`bbm-entity-row ${i < progress.entitySummary.length - 1 ? "bbm-entity-row-bordered" : ""}`}
                    >
                      <div className="bbm-entity-info">
                        <span className="bbm-entity-name">{entity.entityName}</span>
                        <span className="bbm-entity-kind">
                          {entity.entityKind}
                          {entity.entitySubtype ? ` / ${entity.entitySubtype}` : ""}
                        </span>
                      </div>
                      <span
                        className="bbm-entity-chr"
                        title={`${entity.chronicleCount} chronicle${entity.chronicleCount !== 1 ? "s" : ""} will update this entity`}
                      >
                        {entity.chronicleCount} chr
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ---- Processing screen ---- */}
          {!isConfirming && (
            <>
              {/* Global progress */}
              <div className="bbm-progress-section">
                <div className="bbm-progress-header">
                  <span className="bbm-progress-label">
                    Chronicle{" "}
                    {Math.min(progress.currentChronicleIndex + 1, progress.chronicles.length)} /{" "}
                    {progress.chronicles.length}
                  </span>
                  <span className="bbm-progress-percent">{globalPercent}%</span>
                </div>

                {/* Global progress bar */}
                <div className="bbm-progress-track">
                  <div
                    className={progressFillClass}
                    // eslint-disable-next-line local/no-inline-styles -- dynamic width from JS percentage
                    style={{
                      "--bbm-progress-width": `${globalPercent}%`,
                      width: "var(--bbm-progress-width)",
                    }}
                  />
                </div>

                <div className="bbm-progress-stats">
                  <span>
                    {progress.processedEntities} / {realTotal || progress.totalEntities} entities
                  </span>
                  <span>
                    {completedChronicles} / {progress.chronicles.length} chronicles
                  </span>
                </div>
              </div>

              {/* Current chronicle detail */}
              {currentChronicle && !isTerminal && (
                <div className="bbm-chronicle-detail">
                  <div className="bbm-chronicle-title">{currentChronicle.chronicleTitle}</div>

                  {currentChronicle.totalBatches > 1 && (
                    <div className="bbm-chronicle-batch-info">
                      <span>
                        Batch{" "}
                        {Math.min(
                          currentChronicle.completedBatches + 1,
                          currentChronicle.totalBatches
                        )}{" "}
                        / {currentChronicle.totalBatches}
                      </span>
                      <span>
                        {currentChronicle.processedEntities} / {currentChronicle.totalEntities}{" "}
                        entities
                      </span>
                    </div>
                  )}

                  {currentChronicle.totalBatches <= 1 && (
                    <div className="bbm-chronicle-entity-count">
                      {currentChronicle.totalEntities} entities
                    </div>
                  )}
                </div>
              )}

              {/* Terminal state messages */}
              {progress.status === "complete" && (
                <div className="bbm-terminal-banner bbm-terminal-banner-complete">
                  Backported {progress.processedEntities} entities across {completedChronicles}{" "}
                  chronicles.
                  {failedChronicles > 0 && (
                    <span className="bbm-failed-inline">
                      {" "}
                      {failedChronicles} chronicle(s) failed.
                    </span>
                  )}
                </div>
              )}

              {progress.status === "cancelled" && (
                <div className="bbm-terminal-banner bbm-terminal-banner-cancelled">
                  Cancelled after processing {progress.processedEntities} entities across{" "}
                  {completedChronicles} chronicles.
                </div>
              )}

              {progress.status === "failed" && (
                <div className="bbm-terminal-banner bbm-terminal-banner-failed">
                  {progress.error || "An unexpected error occurred."}
                </div>
              )}

              {/* Cost */}
              {progress.totalCost > 0 && (
                <div className="bbm-cost">Cost: ${progress.totalCost.toFixed(4)}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bbm-footer">
          {isConfirming && (
            <>
              <button onClick={onCancel} className="illuminator-button bbm-footer-btn">
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="illuminator-button illuminator-button-primary bbm-footer-btn"
              >
                Start Backport ({progress.totalEntities} entities)
              </button>
            </>
          )}
          {!isConfirming && !isTerminal && (
            <button onClick={onCancel} className="illuminator-button bbm-footer-btn">
              Cancel
            </button>
          )}
          {isTerminal && (
            <button onClick={onClose} className="illuminator-button bbm-footer-btn">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

BulkBackportModal.propTypes = {
  progress: PropTypes.object,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
