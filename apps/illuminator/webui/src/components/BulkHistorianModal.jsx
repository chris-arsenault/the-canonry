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

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
    >
      <div
        style={{
          background: "var(--bg-primary)",
          borderRadius: "12px",
          border: "1px solid var(--border-color)",
          width: isConfirming ? "540px" : "480px",
          maxWidth: "95vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: "16px" }}>{title}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                  className="illuminator-button"
                  style={{ padding: "2px 8px", fontSize: "11px" }}
                  title="Minimize to pill"
                >
                  ―
                </button>
              )}
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color:
                    progress.status === "complete"
                      ? "#10b981"
                      : progress.status === "failed"
                        ? "#ef4444"
                        : progress.status === "cancelled"
                          ? "#f59e0b"
                          : "var(--text-muted)",
                }}
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
          style={{
            padding: "20px",
            overflowY: isConfirming ? "auto" : "visible",
            flex: isConfirming ? 1 : undefined,
            minHeight: 0,
          }}
        >
          {/* ---- Confirmation screen ---- */}
          {isConfirming && (
            <>
              {/* Tone section (not for clear) */}
              {isClear ? null : isReview ? (
                /* Review mode: show tone cycling info */
                <div
                  style={{
                    padding: "10px 12px",
                    marginBottom: "12px",
                    borderRadius: "8px",
                    background: "var(--bg-secondary)",
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    style={{ fontWeight: 600, color: "var(--text-primary)", marginRight: "6px" }}
                  >
                    Tones cycle:
                  </span>
                  {TONE_CYCLE_ORDER.map((t, i) => {
                    const meta = TONE_META[t];
                    return (
                      <span key={t}>
                        {i > 0 && (
                          <span style={{ margin: "0 4px", color: "var(--text-muted)" }}>
                            &rarr;
                          </span>
                        )}
                        <span style={{ color: "#8b7355" }}>{meta?.symbol}</span> {meta?.label}
                      </span>
                    );
                  })}
                </div>
              ) : (
                /* Edition mode: tone picker */
                <div style={{ marginBottom: "12px" }}>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      marginBottom: "6px",
                    }}
                  >
                    Historian Tone
                  </div>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {TONE_CYCLE_ORDER.map((t) => {
                      const meta = TONE_META[t];
                      const isSelected = progress.tone === t;
                      return (
                        <button
                          key={t}
                          onClick={() => onChangeTone(t)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 10px",
                            borderRadius: "4px",
                            border: isSelected
                              ? "1px solid #8b7355"
                              : "1px solid var(--border-color)",
                            background: isSelected
                              ? "rgba(139, 115, 85, 0.15)"
                              : "var(--bg-secondary)",
                            color: isSelected ? "#8b7355" : "var(--text-secondary)",
                            cursor: "pointer",
                            fontSize: "11px",
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          <span style={{ fontSize: "12px" }}>{meta?.symbol}</span>
                          {meta?.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Entity list */}
              <div style={{ marginBottom: "12px" }}>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    marginBottom: "8px",
                  }}
                >
                  Entities ({progress.entities.length})
                </div>

                <div
                  style={{
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    overflow: "hidden",
                    maxHeight: "400px",
                    overflowY: "auto",
                  }}
                >
                  {progress.entities.map((entity, i) => (
                    <div
                      key={entity.entityId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 12px",
                        borderBottom:
                          i < progress.entities.length - 1
                            ? "1px solid var(--border-color)"
                            : "none",
                        fontSize: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        {isReview && entity.tone && (
                          <span
                            style={{ fontSize: "11px", color: "#8b7355", flexShrink: 0 }}
                            title={TONE_META[entity.tone]?.label || entity.tone}
                          >
                            {TONE_META[entity.tone]?.symbol}
                          </span>
                        )}
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {entity.entityName}
                        </span>
                        <span
                          style={{ fontSize: "10px", color: "var(--text-muted)", flexShrink: 0 }}
                        >
                          {entity.entityKind}
                          {entity.entitySubtype ? ` / ${entity.entitySubtype}` : ""}
                        </span>
                      </div>
                      {!isReview && entity.tokenEstimate > 0 && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontVariantNumeric: "tabular-nums",
                            color:
                              editionMaxTokens && entity.tokenEstimate > editionMaxTokens
                                ? "#ef4444"
                                : "var(--text-muted)",
                            flexShrink: 0,
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
                      style={{
                        padding: "8px 12px",
                        borderRadius: "6px",
                        background:
                          overCount > 0 ? "rgba(239, 68, 68, 0.08)" : "var(--bg-secondary)",
                        border:
                          overCount > 0
                            ? "1px solid rgba(239, 68, 68, 0.2)"
                            : "1px solid var(--border-color)",
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                      }}
                    >
                      <div>
                        Largest description: <strong>~{maxEst.toLocaleString()} tokens</strong>
                        {editionMaxTokens > 0 && (
                          <span style={{ marginLeft: "8px" }}>
                            (output limit: <strong>{editionMaxTokens.toLocaleString()}</strong>)
                          </span>
                        )}
                      </div>
                      {overCount > 0 && (
                        <div style={{ color: "#ef4444", marginTop: "2px" }}>
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
              <div style={{ marginBottom: "20px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: "6px",
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: 500 }}>
                    Entity {Math.min(progress.processedEntities + 1, progress.totalEntities)} /{" "}
                    {progress.totalEntities}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {globalPercent}%
                  </span>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: "8px",
                    borderRadius: "4px",
                    background: "var(--bg-secondary)",
                    overflow: "hidden",
                    marginBottom: "6px",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: "4px",
                      background:
                        progress.status === "failed"
                          ? "#ef4444"
                          : progress.status === "cancelled"
                            ? "#f59e0b"
                            : "#10b981",
                      width: `${globalPercent}%`,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                  }}
                >
                  {progress.processedEntities} / {progress.totalEntities} entities
                  {progress.failedEntities.length > 0 && (
                    <span style={{ color: "#ef4444", marginLeft: "8px" }}>
                      {progress.failedEntities.length} failed
                    </span>
                  )}
                </div>
              </div>

              {/* Current entity detail */}
              {progress.currentEntityName && !isTerminal && (
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    background: "var(--bg-secondary)",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {progress.currentEntityTone && TONE_META[progress.currentEntityTone] && (
                      <span style={{ color: "#8b7355", fontSize: "13px" }}>
                        {TONE_META[progress.currentEntityTone].symbol}
                      </span>
                    )}
                    {progress.currentEntityName}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
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
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    marginBottom: "16px",
                    fontSize: "12px",
                  }}
                >
                  {isClear
                    ? `Cleared annotations from ${progress.processedEntities} entities.`
                    : isReview
                      ? `Annotated ${progress.processedEntities} entities.`
                      : `Copy-edited ${progress.processedEntities} entities.`}
                  {progress.failedEntities.length > 0 && (
                    <span style={{ color: "#ef4444" }}>
                      {" "}
                      {progress.failedEntities.length} failed.
                    </span>
                  )}
                </div>
              )}

              {progress.status === "cancelled" && (
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.2)",
                    marginBottom: "16px",
                    fontSize: "12px",
                  }}
                >
                  Cancelled after processing {progress.processedEntities} of{" "}
                  {progress.totalEntities} entities.
                </div>
              )}

              {progress.status === "failed" && (
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    marginBottom: "16px",
                    fontSize: "12px",
                  }}
                >
                  {progress.error || "An unexpected error occurred."}
                </div>
              )}

              {/* Failed entities list */}
              {isTerminal && progress.failedEntities.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      marginBottom: "6px",
                    }}
                  >
                    Failed ({progress.failedEntities.length})
                  </div>
                  <div
                    style={{
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      overflow: "hidden",
                      maxHeight: "200px",
                      overflowY: "auto",
                    }}
                  >
                    {progress.failedEntities.map((f, i) => (
                      <div
                        key={f.entityId}
                        style={{
                          padding: "6px 12px",
                          borderBottom:
                            i < progress.failedEntities.length - 1
                              ? "1px solid var(--border-color)"
                              : "none",
                          fontSize: "11px",
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{f.entityName}</span>
                        <span style={{ color: "#ef4444", marginLeft: "8px" }}>{f.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cost */}
              {progress.totalCost > 0 && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    textAlign: "right",
                  }}
                >
                  Cost: ${progress.totalCost.toFixed(4)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          {isConfirming && (
            <>
              <button
                onClick={onCancel}
                className="illuminator-button"
                style={{ padding: "6px 16px", fontSize: "12px" }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="illuminator-button illuminator-button-primary"
                style={{ padding: "6px 16px", fontSize: "12px" }}
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
              className="illuminator-button"
              style={{ padding: "6px 16px", fontSize: "12px" }}
            >
              Cancel
            </button>
          )}
          {isTerminal && (
            <button
              onClick={onClose}
              className="illuminator-button"
              style={{ padding: "6px 16px", fontSize: "12px" }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
