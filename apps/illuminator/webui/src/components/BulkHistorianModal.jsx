/**
 * BulkHistorianModal - Progress display for bulk historian annotation and copy-edit
 *
 * Three phases (handled by BulkOperationShell):
 * 1. Confirmation: entity list, tone selection (edition) or tone cycle preview (review)
 * 2. Processing: progress bar, current entity, cost
 * 3. Terminal: completion/cancellation/failure message, failed entities list
 */

import React from "react";
import PropTypes from "prop-types";
import { TONE_META } from "./HistorianToneSelector";
import BulkOperationShell, { BulkProgressBar, BulkTerminalMessage, BulkFailedList, BulkCost } from "./BulkOperationShell";
import "./BulkHistorianModal.css";
const TONE_CYCLE_ORDER = ["witty", "weary", "forensic", "elegiac", "cantankerous"];
function getTitle(progress) {
  if (progress.operation === "clear") return "Clear All Annotations";
  if (progress.operation === "review") return "Bulk Annotation";
  return "Bulk Copy Edit";
}
function getStatusText(progress) {
  if (progress.status === "confirming") return `${progress.totalEntities} entities`;
  if (progress.status === "running") return "Processing...";
  if (progress.status === "complete") return "Complete";
  if (progress.status === "cancelled") return "Cancelled";
  if (progress.status === "failed") return "Failed";
  return "";
}
function getPillText(progress) {
  if (progress.status === "running") return `${progress.processedEntities}/${progress.totalEntities}`;
  return progress.status;
}
function getConfirmLabel(progress) {
  if (progress.operation === "clear") return `Clear Annotations (${progress.totalEntities} entities)`;
  if (progress.operation === "review") return `Start Annotation (${progress.totalEntities} entities)`;
  return `Start Copy Edit (${progress.totalEntities} entities)`;
}
export default function BulkHistorianModal({
  progress,
  onConfirm,
  onCancel,
  onClose,
  onChangeTone,
  editionMaxTokens
}) {
  const isConfirming = progress?.status === "confirming";
  const isTerminal = progress?.status === "complete" || progress?.status === "cancelled" || progress?.status === "failed";
  const isReview = progress?.operation === "review";
  const isClear = progress?.operation === "clear";
  const title = progress ? getTitle(progress) : "";
  return <BulkOperationShell pillId="bulk-historian" title={title} progress={progress} onConfirm={onConfirm} onCancel={onCancel} onClose={onClose} confirmLabel={progress ? getConfirmLabel(progress) : ""} statusText={progress ? getStatusText(progress) : ""} pillStatusText={progress ? getPillText(progress) : ""}>
      {/* ---- Confirmation screen ---- */}
      {isConfirming && <>
          {/* Tone section (not for clear) */}
          {!isClear && isReview && (/* Review mode: show tone cycling info */
      <div className="bhm-tone-cycle-box">
              <span className="bhm-tone-cycle-label">Tones cycle:</span>
              {TONE_CYCLE_ORDER.map((t, i) => {
          const meta = TONE_META[t];
          return <span key={t}>
                    {i > 0 && <span className="bhm-tone-cycle-arrow">&rarr;</span>}
                    <span className="bhm-tone-cycle-symbol">{meta?.symbol}</span> {meta?.label}
                  </span>;
        })}
            </div>)}
          {!isClear && !isReview && (/* Edition mode: tone picker */
      <div className="bhm-tone-picker">
              <div className="bhm-section-label">Historian Tone</div>
              <div className="bhm-tone-options">
                {TONE_CYCLE_ORDER.map(t => {
            const meta = TONE_META[t];
            const isSelected = progress.tone === t;
            return <button key={t} onClick={() => onChangeTone(t)} className={`bhm-tone-btn ${isSelected ? "bhm-tone-btn-selected" : "bhm-tone-btn-default"}`}>
                      <span className="bhm-tone-btn-symbol">{meta?.symbol}</span>
                      {meta?.label}
                    </button>;
          })}
              </div>
            </div>)}

          {/* Entity list */}
          <div className="bhm-entity-section">
            <div className="bhm-entity-section-label">
              Entities ({progress.entities.length})
            </div>

            <div className="bhm-entity-list">
              {progress.entities.map((entity, i) => <div key={entity.entityId} className={`bhm-entity-row ${i < progress.entities.length - 1 ? "bhm-entity-row-bordered" : ""}`}>
                  <div className="bhm-entity-row-info">
                    {isReview && entity.tone && <span className="bhm-entity-tone-symbol" title={TONE_META[entity.tone]?.label || entity.tone}>
                        {TONE_META[entity.tone]?.symbol}
                      </span>}
                    <span className="bhm-entity-name">{entity.entityName}</span>
                    <span className="bhm-entity-kind">
                      {entity.entityKind}
                      {entity.entitySubtype ? ` / ${entity.entitySubtype}` : ""}
                    </span>
                  </div>
                  {!isReview && entity.tokenEstimate > 0 && <span className={`bhm-entity-tokens ${editionMaxTokens && entity.tokenEstimate > editionMaxTokens ? "bhm-entity-tokens-over" : ""}`} title={`~${entity.tokenEstimate} tokens estimated from word count`}>
                      ~{entity.tokenEstimate.toLocaleString()}t
                    </span>}
                </div>)}
            </div>
          </div>

          {/* Token estimate summary for edition mode */}
          {!isReview && !isClear && (() => {
        const estimates = progress.entities.map(e => e.tokenEstimate || 0).filter(t => t > 0);
        if (estimates.length === 0) return null;
        const maxEst = Math.max(...estimates);
        const overCount = editionMaxTokens ? estimates.filter(t => t > editionMaxTokens).length : 0;
        return <div className={`bhm-token-summary ${overCount > 0 ? "bhm-token-summary-over" : "bhm-token-summary-ok"}`}>
                  <div>
                    Largest description: <strong>~{maxEst.toLocaleString()} tokens</strong>
                    {editionMaxTokens > 0 && <span className="bhm-token-limit-note">
                        (output limit: <strong>{editionMaxTokens.toLocaleString()}</strong>)
                      </span>}
                  </div>
                  {overCount > 0 && <div className="bhm-token-over-warning">
                      {overCount} {overCount === 1 ? "entity exceeds" : "entities exceed"} the
                      current output token limit — results may be truncated.
                    </div>}
                </div>;
      })()}
        </>}

      {/* ---- Processing / Terminal screen ---- */}
      {!isConfirming && progress?.status !== "idle" && <>
          {/* Global progress */}
          <BulkProgressBar processed={progress.processedEntities} total={progress.totalEntities} status={progress.status} />

          <div className="bhm-progress-counts">
            {progress.processedEntities} / {progress.totalEntities} entities
            {progress.failedEntities.length > 0 && <span className="bhm-progress-failed-count">
                {progress.failedEntities.length} failed
              </span>}
          </div>

          {/* Current entity detail */}
          {progress.currentEntityName && !isTerminal && <div className="bhm-current-entity">
              <div className="bhm-current-entity-name">
                {progress.currentEntityTone && TONE_META[progress.currentEntityTone] && <span className="bhm-current-entity-tone">
                    {TONE_META[progress.currentEntityTone].symbol}
                  </span>}
                {progress.currentEntityName}
              </div>
              <div className="bhm-current-entity-status">
                {(() => {
            if (isClear) return "Clearing annotations...";
            if (isReview) return "Generating annotations...";
            return "Generating copy edit...";
          })()}
              </div>
            </div>}

          {/* Terminal state messages */}
          {progress.status === "complete" && <BulkTerminalMessage status="complete">
              {(() => {
          if (isClear) return `Cleared annotations from ${progress.processedEntities} entities.`;
          if (isReview) return `Annotated ${progress.processedEntities} entities.`;
          return `Copy-edited ${progress.processedEntities} entities.`;
        })()}
              {progress.failedEntities.length > 0 && <span className="bulk-failed-inline">
                  {" "}
                  {progress.failedEntities.length} failed.
                </span>}
            </BulkTerminalMessage>}

          {progress.status === "cancelled" && <BulkTerminalMessage status="cancelled">
              Cancelled after processing {progress.processedEntities} of{" "}
              {progress.totalEntities} entities.
            </BulkTerminalMessage>}

          {progress.status === "failed" && <BulkTerminalMessage status="failed">
              {progress.error || "An unexpected error occurred."}
            </BulkTerminalMessage>}

          {/* Failed entities list */}
          {isTerminal && <BulkFailedList items={progress.failedEntities} labelKey="entityName" errorKey="error" />}

          {/* Cost */}
          <BulkCost cost={progress.totalCost} />
        </>}
    </BulkOperationShell>;
}
BulkHistorianModal.propTypes = {
  progress: PropTypes.object,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onChangeTone: PropTypes.func,
  editionMaxTokens: PropTypes.number
};
