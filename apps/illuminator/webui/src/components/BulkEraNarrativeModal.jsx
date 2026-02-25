/**
 * BulkEraNarrativeModal — Runs all eras through the full narrative pipeline.
 *
 * Three phases:
 * 1. Confirmation: eligible eras, tone selection, start
 * 2. Processing: progress bar, current era + step, streaming text, cost
 * 3. Terminal: completion/cancellation/failure summary
 */

import { useEffect, useMemo } from "react";
import { useBulkEraNarrativeStore } from "../lib/db/bulkEraNarrativeStore";
import { useEnrichmentQueueStore } from "../lib/db/enrichmentQueueStore";
import { useThinkingStore } from "../lib/db/thinkingStore";
import { useFloatingPillStore } from "../lib/db/floatingPillStore";
const PILL_ID = "bulk-era-narrative";

const ERA_NARRATIVE_TONES = [
  { value: "witty", label: "Witty", symbol: "✶", description: "Sly, dry, finds the dark comic" },
  {
    value: "cantankerous",
    label: "Cantankerous",
    symbol: "♯",
    description: "Irritable energy, argues with the dead",
  },
  {
    value: "bemused",
    label: "Bemused",
    symbol: "⁂",
    description: "Puzzled and delighted by absurdity",
  },
  { value: "defiant", label: "Defiant", symbol: "▲", description: "Proud of what was attempted" },
  {
    value: "sardonic",
    label: "Sardonic",
    symbol: "◆",
    description: "Sharp irony, names the pattern",
  },
  { value: "tender", label: "Tender", symbol: "◠", description: "Lingers on what survived" },
  { value: "hopeful", label: "Hopeful", symbol: "☀", description: "Reads for what was seeded" },
  {
    value: "enthusiastic",
    label: "Enthusiastic",
    symbol: "⚡",
    description: "Thrilled by scale and ambition",
  },
];

const TONE_OPTIONS = ERA_NARRATIVE_TONES.map((t) => t.value);
const TONE_META = Object.fromEntries(ERA_NARRATIVE_TONES.map((t) => [t.value, t]));

const STEP_LABEL = {
  threads: "Threads",
  generate: "Writing",
  edit: "Editing",
};

export default function BulkEraNarrativeModal({
  isOpen,
  onClose,
  chronicleItems,
  wizardEras,
  eraTemporalInfo,
  projectId,
  simulationRunId,
  styleLibrary,
}) {
  const progress = useBulkEraNarrativeStore((s) => s.progress);
  const prepareBulk = useBulkEraNarrativeStore((s) => s.prepareBulk);
  const confirmBulk = useBulkEraNarrativeStore((s) => s.confirmBulk);
  const cancelBulk = useBulkEraNarrativeStore((s) => s.cancelBulk);
  const closeBulk = useBulkEraNarrativeStore((s) => s.closeBulk);
  const setEraTone = useBulkEraNarrativeStore((s) => s.setEraTone);

  const isMinimized = useFloatingPillStore((s) => s.isMinimized(PILL_ID));

  // Build narrative weight map from style library
  const narrativeWeightMap = useMemo(() => {
    const map = {};
    if (styleLibrary?.narrativeStyles) {
      for (const s of styleLibrary.narrativeStyles) {
        if (s.eraNarrativeWeight) map[s.id] = s.eraNarrativeWeight;
      }
    }
    return map;
  }, [styleLibrary]);

  // Find the active eraNarrative task in the queue for streaming
  const activeTaskId = useEnrichmentQueueStore((s) => {
    const item = s.queue.find((q) => q.type === "eraNarrative" && q.status === "running");
    return item?.id || null;
  });

  // Subscribe to streaming text for the active task
  const streamEntry = useThinkingStore((s) =>
    activeTaskId ? s.entries.get(activeTaskId) : undefined
  );

  // Prepare when opening
  useEffect(() => {
    if (
      isOpen &&
      progress.status === "idle" &&
      chronicleItems?.length > 0 &&
      wizardEras?.length > 0
    ) {
      prepareBulk(
        chronicleItems,
        wizardEras,
        eraTemporalInfo,
        projectId,
        simulationRunId,
        "witty",
        narrativeWeightMap
      );
    }
  }, [isOpen]);

  // Update pill while minimized
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
        ? `${progress.processedEras}/${progress.totalEras}`
        : progress.status;
    useFloatingPillStore.getState().updatePill(PILL_ID, { statusText, statusColor });
  }, [isMinimized, progress?.status, progress?.processedEras]);

  // Remove pill when idle
  useEffect(() => {
    if (!progress || progress.status === "idle") {
      useFloatingPillStore.getState().remove(PILL_ID);
    }
  }, [progress?.status]);

  if (!isOpen) return null;
  if (!progress || progress.status === "idle") return null;
  if (isMinimized) return null;

  const isConfirming = progress.status === "confirming";
  const isRunning = progress.status === "running";
  const isTerminal =
    progress.status === "complete" ||
    progress.status === "cancelled" ||
    progress.status === "failed";

  const globalPercent =
    progress.totalEras > 0 ? Math.round((progress.processedEras / progress.totalEras) * 100) : 0;

  const handleConfirm = () => {
    confirmBulk();
  };

  const handleCancel = () => {
    cancelBulk();
    if (progress.status === "confirming") {
      onClose();
    }
  };

  const handleClose = () => {
    closeBulk();
    onClose();
  };

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
          width: isConfirming ? "540px" : "560px",
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
            <h2 style={{ margin: 0, fontSize: "16px" }}>Bulk Era Narrative</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {!isConfirming && (
                <button
                  onClick={() =>
                    useFloatingPillStore.getState().minimize({
                      id: PILL_ID,
                      label: "Bulk Era Narrative",
                      statusText:
                        progress.status === "running"
                          ? `${progress.processedEras}/${progress.totalEras}`
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
                  className="illuminator-button"
                  style={{ padding: "2px 8px", fontSize: "11px" }}
                  title="Minimize to pill"
                >
                  {"\u2015"}
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
                {isConfirming && `${progress.totalEras} eras`}
                {isRunning && "Processing..."}
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
              {/* Era list with per-era tone */}
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
                  Eras ({progress.eras.length})
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
                  {progress.eras.map((era, i) => {
                    const eraMeta = TONE_META[era.tone];
                    return (
                      <div
                        key={era.eraId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 12px",
                          borderBottom:
                            i < progress.eras.length - 1 ? "1px solid var(--border-color)" : "none",
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
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {era.eraName}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexShrink: 0,
                          }}
                        >
                          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                            {era.preppedCount}/{era.totalCount} prepped
                          </span>
                          {era.hasExisting && (
                            <span
                              style={{ fontSize: "10px", color: "#3b82f6" }}
                              title="Has existing completed narrative"
                            >
                              {"\u2713"}
                            </span>
                          )}
                          {/* Per-era tone selector */}
                          <div style={{ display: "flex", gap: "2px" }}>
                            {TONE_OPTIONS.map((t) => {
                              const meta = TONE_META[t];
                              const selected = era.tone === t;
                              return (
                                <button
                                  key={t}
                                  onClick={() => setEraTone(era.eraId, t)}
                                  title={meta?.label}
                                  style={{
                                    width: "18px",
                                    height: "18px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: 0,
                                    borderRadius: "3px",
                                    border: selected
                                      ? "1px solid #8b7355"
                                      : "1px solid transparent",
                                    background: selected
                                      ? "rgba(139, 115, 85, 0.15)"
                                      : "transparent",
                                    color: selected ? "#8b7355" : "var(--text-muted)",
                                    cursor: "pointer",
                                    fontSize: "10px",
                                    lineHeight: 1,
                                  }}
                                >
                                  {meta?.symbol}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ---- Processing + terminal ---- */}
          {!isConfirming && (
            <>
              {/* Progress bar */}
              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: "6px",
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: 500 }}>
                    Era {Math.min(progress.processedEras + 1, progress.totalEras)} /{" "}
                    {progress.totalEras}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {globalPercent}%
                  </span>
                </div>
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
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {progress.processedEras} / {progress.totalEras} eras
                </div>
              </div>

              {/* Current era — step progress with live word counts */}
              {progress.currentEraName &&
                !isTerminal &&
                (() => {
                  const currentEra = progress.eras.find(
                    (e) => e.eraName === progress.currentEraName
                  );
                  const currentToneMeta = currentEra ? TONE_META[currentEra.tone] : null;
                  const stepOrder = ["threads", "generate", "edit"];
                  const activeIdx = stepOrder.indexOf(progress.currentStep);

                  // Live word counts from streaming deltas
                  const thinkingWords = streamEntry?.thinking
                    ? streamEntry.thinking.split(/\s+/).filter(Boolean).length
                    : 0;
                  const outputWords = streamEntry?.text
                    ? streamEntry.text.split(/\s+/).filter(Boolean).length
                    : 0;

                  return (
                    <div
                      style={{
                        padding: "12px",
                        borderRadius: "8px",
                        background: "var(--bg-secondary)",
                        marginBottom: "12px",
                      }}
                    >
                      {/* Era name + tone */}
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "10px",
                        }}
                      >
                        {currentToneMeta && (
                          <span
                            style={{ color: "#8b7355", fontSize: "13px" }}
                            title={currentToneMeta.label}
                          >
                            {currentToneMeta.symbol}
                          </span>
                        )}
                        {progress.currentEraName}
                      </div>

                      {/* Step rows */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {stepOrder.map((step, idx) => {
                          const isDone = idx < activeIdx;
                          const isActive = idx === activeIdx;
                          const isPending = idx > activeIdx;
                          const icon = isDone ? "\u2713" : isActive ? "\u25B8" : "\u25CB";
                          const iconColor = isDone
                            ? "#10b981"
                            : isActive
                              ? "#f59e0b"
                              : "var(--text-muted)";

                          // Word count bar caps for visual scaling
                          const barMax =
                            step === "generate" ? 4000 : step === "threads" ? 2000 : 3000;
                          const barPercent = isActive
                            ? Math.min(100, (outputWords / barMax) * 100)
                            : 0;

                          return (
                            <div key={step}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  fontSize: "11px",
                                }}
                              >
                                <span
                                  style={{
                                    color: iconColor,
                                    width: "12px",
                                    textAlign: "center",
                                    fontWeight: 600,
                                    fontSize: "10px",
                                  }}
                                >
                                  {icon}
                                </span>
                                <span
                                  style={{
                                    width: "52px",
                                    color: isPending
                                      ? "var(--text-muted)"
                                      : "var(--text-secondary)",
                                    fontWeight: isActive ? 600 : 400,
                                  }}
                                >
                                  {STEP_LABEL[step]}
                                </span>

                                {isActive && (
                                  <div
                                    style={{
                                      flex: 1,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "10px",
                                    }}
                                  >
                                    {/* Mini progress bar */}
                                    <div
                                      style={{
                                        flex: 1,
                                        height: "4px",
                                        borderRadius: "2px",
                                        background: "var(--bg-primary)",
                                        overflow: "hidden",
                                      }}
                                    >
                                      <div
                                        style={{
                                          height: "100%",
                                          borderRadius: "2px",
                                          background: "#f59e0b",
                                          width: `${barPercent}%`,
                                          transition: "width 0.2s ease",
                                        }}
                                      />
                                    </div>
                                    {/* Live counters */}
                                    <span
                                      style={{
                                        color: "var(--text-muted)",
                                        fontVariantNumeric: "tabular-nums",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {thinkingWords > 0 && (
                                        <span title="Thinking words received">
                                          <span
                                            style={{ color: "var(--text-muted)", opacity: 0.6 }}
                                          >
                                            T
                                          </span>{" "}
                                          {thinkingWords.toLocaleString()}
                                        </span>
                                      )}
                                      {thinkingWords > 0 && outputWords > 0 && (
                                        <span style={{ margin: "0 6px", opacity: 0.3 }}>/</span>
                                      )}
                                      {outputWords > 0 && (
                                        <span title="Output words received">
                                          <span style={{ color: "#f59e0b", opacity: 0.8 }}>O</span>{" "}
                                          {outputWords.toLocaleString()}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                )}

                                {isDone && (
                                  <span
                                    style={{
                                      flex: 1,
                                      fontSize: "10px",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    done
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

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
                  Generated {progress.processedEras} era narratives.
                  {progress.totalWords > 0 && (
                    <span> {progress.totalWords.toLocaleString()} words total.</span>
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
                  Cancelled after processing {progress.processedEras} of {progress.totalEras} eras.
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

              {/* Cost + words */}
              {(progress.totalCost > 0 || progress.totalWords > 0) && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    textAlign: "right",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "12px",
                  }}
                >
                  {progress.totalWords > 0 && (
                    <span>{progress.totalWords.toLocaleString()} words</span>
                  )}
                  {progress.totalCost > 0 && <span>Cost: ${progress.totalCost.toFixed(4)}</span>}
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
                onClick={handleCancel}
                className="illuminator-button"
                style={{ padding: "6px 16px", fontSize: "12px" }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="illuminator-button illuminator-button-primary"
                style={{ padding: "6px 16px", fontSize: "12px" }}
              >
                Run All ({progress.totalEras} eras)
              </button>
            </>
          )}
          {!isConfirming && !isTerminal && (
            <button
              onClick={handleCancel}
              className="illuminator-button"
              style={{ padding: "6px 16px", fontSize: "12px" }}
            >
              Cancel
            </button>
          )}
          {isTerminal && (
            <button
              onClick={handleClose}
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
