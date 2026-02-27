/**
 * BulkEraNarrativeModal — Runs all eras through the full narrative pipeline.
 *
 * Three phases:
 * 1. Confirmation: eligible eras, tone selection, start
 * 2. Processing: progress bar, current era + step, streaming text, cost
 * 3. Terminal: completion/cancellation/failure summary
 */

import React, { useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { useBulkEraNarrativeStore } from "../lib/db/bulkEraNarrativeStore";
import { useEnrichmentQueueStore } from "../lib/db/enrichmentQueueStore";
import { useThinkingStore } from "../lib/db/thinkingStore";
import { useFloatingPillStore } from "../lib/db/floatingPillStore";
import "./BulkEraNarrativeModal.css";
const PILL_ID = "bulk-era-narrative";
const ERA_NARRATIVE_TONES = [{
  value: "witty",
  label: "Witty",
  symbol: "\u2736",
  description: "Sly, dry, finds the dark comic"
}, {
  value: "cantankerous",
  label: "Cantankerous",
  symbol: "\u266F",
  description: "Irritable energy, argues with the dead"
}, {
  value: "bemused",
  label: "Bemused",
  symbol: "\u2042",
  description: "Puzzled and delighted by absurdity"
}, {
  value: "defiant",
  label: "Defiant",
  symbol: "\u25B2",
  description: "Proud of what was attempted"
}, {
  value: "sardonic",
  label: "Sardonic",
  symbol: "\u25C6",
  description: "Sharp irony, names the pattern"
}, {
  value: "tender",
  label: "Tender",
  symbol: "\u25E0",
  description: "Lingers on what survived"
}, {
  value: "hopeful",
  label: "Hopeful",
  symbol: "\u2600",
  description: "Reads for what was seeded"
}, {
  value: "enthusiastic",
  label: "Enthusiastic",
  symbol: "\u26A1",
  description: "Thrilled by scale and ambition"
}];
const TONE_OPTIONS = ERA_NARRATIVE_TONES.map(t => t.value);
const TONE_META = Object.fromEntries(ERA_NARRATIVE_TONES.map(t => [t.value, t]));
const STEP_LABEL = {
  threads: "Threads",
  generate: "Writing",
  edit: "Editing"
};
export default function BulkEraNarrativeModal({
  isOpen,
  onClose,
  chronicleItems,
  wizardEras,
  eraTemporalInfo,
  projectId,
  simulationRunId,
  styleLibrary
}) {
  const progress = useBulkEraNarrativeStore(s => s.progress);
  const prepareBulk = useBulkEraNarrativeStore(s => s.prepareBulk);
  const confirmBulk = useBulkEraNarrativeStore(s => s.confirmBulk);
  const cancelBulk = useBulkEraNarrativeStore(s => s.cancelBulk);
  const closeBulk = useBulkEraNarrativeStore(s => s.closeBulk);
  const setEraTone = useBulkEraNarrativeStore(s => s.setEraTone);
  const isMinimized = useFloatingPillStore(s => s.isMinimized(PILL_ID));

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
  const activeTaskId = useEnrichmentQueueStore(s => {
    const item = s.queue.find(q => q.type === "eraNarrative" && q.status === "running");
    return item?.id || null;
  });

  // Subscribe to streaming text for the active task
  const streamEntry = useThinkingStore(s => activeTaskId ? s.entries.get(activeTaskId) : undefined);

  // Refs for values used in the prepare effect that shouldn't trigger re-run
  const prepareDepsRef = useRef({
    chronicleItems,
    wizardEras,
    eraTemporalInfo,
    projectId,
    simulationRunId,
    narrativeWeightMap,
    prepareBulk,
    progress
  });
  useEffect(() => {
    prepareDepsRef.current = {
      chronicleItems,
      wizardEras,
      eraTemporalInfo,
      projectId,
      simulationRunId,
      narrativeWeightMap,
      prepareBulk,
      progress
    };
  }, [chronicleItems, wizardEras, eraTemporalInfo, projectId, simulationRunId, narrativeWeightMap, prepareBulk, progress]);

  // Prepare when opening
  useEffect(() => {
    const {
      chronicleItems: ci,
      wizardEras: we,
      eraTemporalInfo: eti,
      projectId: pid,
      simulationRunId: sid,
      narrativeWeightMap: nwm,
      prepareBulk: pb,
      progress: p
    } = prepareDepsRef.current;
    if (isOpen && p.status === "idle" && ci?.length > 0 && we?.length > 0) {
      pb(ci, we, eti, pid, sid, "witty", nwm);
    }
  }, [isOpen]);
  const progressStatus = progress?.status;
  const processedEras = progress?.processedEras;
  const totalEras = progress?.totalEras;

  // Update pill while minimized
  useEffect(() => {
    if (!isMinimized || !progress) return;
    let statusColor;
    if (progressStatus === "running") statusColor = "#f59e0b";else if (progressStatus === "complete") statusColor = "#10b981";else if (progressStatus === "failed") statusColor = "#ef4444";else statusColor = "#6b7280";
    const statusText = progressStatus === "running" ? `${processedEras}/${totalEras}` : progressStatus;
    useFloatingPillStore.getState().updatePill(PILL_ID, {
      statusText,
      statusColor
    });
  }, [isMinimized, progress, progressStatus, processedEras, totalEras]);

  // Remove pill when idle
  useEffect(() => {
    if (!progress || progressStatus === "idle") {
      useFloatingPillStore.getState().remove(PILL_ID);
    }
  }, [progress, progressStatus]);
  if (!isOpen) return null;
  if (!progress || progress.status === "idle") return null;
  if (isMinimized) return null;
  const isConfirming = progress.status === "confirming";
  const isRunning = progress.status === "running";
  const isTerminal = progress.status === "complete" || progress.status === "cancelled" || progress.status === "failed";
  const globalPercent = progress.totalEras > 0 ? Math.round(progress.processedEras / progress.totalEras * 100) : 0;
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
  let statusColor;
  if (progress.status === "complete") statusColor = "#10b981";else if (progress.status === "failed") statusColor = "#ef4444";else if (progress.status === "cancelled") statusColor = "#f59e0b";else statusColor = "var(--text-muted)";
  let progressFillModifier;
  if (progress.status === "failed") progressFillModifier = "benm-progress-fill-failed";else if (progress.status === "cancelled") progressFillModifier = "benm-progress-fill-cancelled";else progressFillModifier = "benm-progress-fill-complete";
  const progressFillClass = `benm-progress-fill ${progressFillModifier}`;
  return <div className="benm-overlay">
      <div className="benm-modal"
    style={{
      "--benm-modal-width": isConfirming ? "540px" : "560px"
    }}>
        {/* Header */}
        <div className="benm-header">
          <div className="benm-header-row">
            <h2 className="benm-title">Bulk Era Narrative</h2>
            <div className="benm-header-actions">
              {!isConfirming && <button onClick={() => useFloatingPillStore.getState().minimize({
              id: PILL_ID,
              label: "Bulk Era Narrative",
              statusText: progress.status === "running" ? `${progress.processedEras}/${progress.totalEras}` : progress.status,
              statusColor: (() => {
                if (progress.status === "running") return "#f59e0b";
                if (progress.status === "complete") return "#10b981";
                return "#ef4444";
              })(),
              tabId: "chronicle"
            })} className="illuminator-button benm-minimize-btn" title="Minimize to pill">
                  {"\u2015"}
                </button>}
              <span className="benm-status-label"
            style={{
              "--benm-status-color": statusColor
            }}>
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
        <div className={`benm-body ${isConfirming ? "benm-body-confirming" : "benm-body-processing"}`}>
          {/* ---- Confirmation screen ---- */}
          {isConfirming && <>
              {/* Era list with per-era tone */}
              <div className="benm-era-section">
                <div className="benm-section-label">Eras ({progress.eras.length})</div>
                <div className="benm-era-list">
                  {progress.eras.map((era, i) => {
                return <div key={era.eraId} className={`benm-era-row ${i < progress.eras.length - 1 ? "benm-era-row-bordered" : ""}`}>
                        <div className="benm-era-row-info">
                          <span className="benm-era-name">{era.eraName}</span>
                        </div>
                        <div className="benm-era-row-actions">
                          <span className="benm-era-prepped">
                            {era.preppedCount}/{era.totalCount} prepped
                          </span>
                          {era.hasExisting && <span className="benm-era-existing" title="Has existing completed narrative">
                              {"\u2713"}
                            </span>}
                          {/* Per-era tone selector */}
                          <div className="benm-tone-selector">
                            {TONE_OPTIONS.map(t => {
                        const meta = TONE_META[t];
                        const selected = era.tone === t;
                        return <button key={t} onClick={() => setEraTone(era.eraId, t)} title={meta?.label} className={`benm-tone-btn ${selected ? "benm-tone-btn-selected" : "benm-tone-btn-default"}`}>
                                  {meta?.symbol}
                                </button>;
                      })}
                          </div>
                        </div>
                      </div>;
              })}
                </div>
              </div>
            </>}

          {/* ---- Processing + terminal ---- */}
          {!isConfirming && <>
              {/* Progress bar */}
              <div className="benm-progress-section">
                <div className="benm-progress-header">
                  <span className="benm-progress-era-label">
                    Era {Math.min(progress.processedEras + 1, progress.totalEras)} /{" "}
                    {progress.totalEras}
                  </span>
                  <span className="benm-progress-percent">{globalPercent}%</span>
                </div>
                <div className="benm-progress-track">
                  <div className={progressFillClass}
              style={{
                "--benm-progress-width": `${globalPercent}%`
              }} />
                </div>
                <div className="benm-progress-counts">
                  {progress.processedEras} / {progress.totalEras} eras
                </div>
              </div>

              {/* Current era — step progress with live word counts */}
              {progress.currentEraName && !isTerminal && (() => {
            const currentEra = progress.eras.find(e => e.eraName === progress.currentEraName);
            const currentToneMeta = currentEra ? TONE_META[currentEra.tone] : null;
            const stepOrder = ["threads", "generate", "edit"];
            const activeIdx = stepOrder.indexOf(progress.currentStep);

            // Live word counts from streaming deltas
            const thinkingWords = streamEntry?.thinking ? streamEntry.thinking.split(/\s+/).filter(Boolean).length : 0;
            const outputWords = streamEntry?.text ? streamEntry.text.split(/\s+/).filter(Boolean).length : 0;
            return <div className="benm-current-era">
                      {/* Era name + tone */}
                      <div className="benm-current-era-name">
                        {currentToneMeta && <span className="benm-current-era-tone" title={currentToneMeta.label}>
                            {currentToneMeta.symbol}
                          </span>}
                        {progress.currentEraName}
                      </div>

                      {/* Step rows */}
                      <div className="benm-steps">
                        {stepOrder.map((step, idx) => {
                  const isDone = idx < activeIdx;
                  const isActive = idx === activeIdx;
                  const isPending = idx > activeIdx;
                  let icon;
                  if (isDone) icon = "\u2713";else if (isActive) icon = "\u25B8";else icon = "\u25CB";
                  let iconColor;
                  if (isDone) iconColor = "#10b981";else if (isActive) iconColor = "#f59e0b";else iconColor = "var(--text-muted)";

                  // Word count bar caps for visual scaling
                  let barMax;
                  if (step === "generate") barMax = 4000;else if (step === "threads") barMax = 2000;else barMax = 3000;
                  const barPercent = isActive ? Math.min(100, outputWords / barMax * 100) : 0;
                  return <div key={step}>
                              <div className="benm-step-row">
                                <span className="benm-step-icon"
                      style={{
                        "--benm-step-color": iconColor
                      }}>
                                  {icon}
                                </span>
                                <span className={`benm-step-label ${isActive ? "benm-step-label-active" : ""} ${isPending ? "benm-step-label-pending" : ""}`}>
                                  {STEP_LABEL[step]}
                                </span>

                                {isActive && <div className="benm-step-active-content">
                                    {/* Mini progress bar */}
                                    <div className="benm-step-bar-track">
                                      <div className="benm-step-bar-fill"
                          style={{
                            "--benm-bar-width": `${barPercent}%`
                          }} />
                                    </div>
                                    {/* Live counters */}
                                    <span className="benm-step-counters">
                                      {thinkingWords > 0 && <span title="Thinking words received">
                                          <span className="benm-counter-thinking-label">T</span>{" "}
                                          {thinkingWords.toLocaleString()}
                                        </span>}
                                      {thinkingWords > 0 && outputWords > 0 && <span className="benm-counter-separator">/</span>}
                                      {outputWords > 0 && <span title="Output words received">
                                          <span className="benm-counter-output-label">O</span>{" "}
                                          {outputWords.toLocaleString()}
                                        </span>}
                                    </span>
                                  </div>}

                                {isDone && <span className="benm-step-done">done</span>}
                              </div>
                            </div>;
                })}
                      </div>
                    </div>;
          })()}

              {/* Terminal state messages */}
              {progress.status === "complete" && <div className="benm-terminal-msg benm-terminal-msg-complete">
                  Generated {progress.processedEras} era narratives.
                  {progress.totalWords > 0 && <span> {progress.totalWords.toLocaleString()} words total.</span>}
                </div>}

              {progress.status === "cancelled" && <div className="benm-terminal-msg benm-terminal-msg-cancelled">
                  Cancelled after processing {progress.processedEras} of {progress.totalEras} eras.
                </div>}

              {progress.status === "failed" && <div className="benm-terminal-msg benm-terminal-msg-failed">
                  {progress.error || "An unexpected error occurred."}
                </div>}

              {/* Cost + words */}
              {(progress.totalCost > 0 || progress.totalWords > 0) && <div className="benm-stats">
                  {progress.totalWords > 0 && <span>{progress.totalWords.toLocaleString()} words</span>}
                  {progress.totalCost > 0 && <span>Cost: ${progress.totalCost.toFixed(4)}</span>}
                </div>}
            </>}
        </div>

        {/* Footer */}
        <div className="benm-footer">
          {isConfirming && <>
              <button onClick={handleCancel} className="illuminator-button benm-footer-btn">
                Cancel
              </button>
              <button onClick={handleConfirm} className="illuminator-button illuminator-button-primary benm-footer-btn">
                Run All ({progress.totalEras} eras)
              </button>
            </>}
          {!isConfirming && !isTerminal && <button onClick={handleCancel} className="illuminator-button benm-footer-btn">
              Cancel
            </button>}
          {isTerminal && <button onClick={handleClose} className="illuminator-button benm-footer-btn">
              Close
            </button>}
        </div>
      </div>
    </div>;
}
BulkEraNarrativeModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  chronicleItems: PropTypes.array,
  wizardEras: PropTypes.array,
  eraTemporalInfo: PropTypes.any,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  simulationRunId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  styleLibrary: PropTypes.object
};
