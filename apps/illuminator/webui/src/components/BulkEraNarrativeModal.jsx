/**
 * BulkEraNarrativeModal — Runs all eras through the full narrative pipeline.
 *
 * Three phases:
 * 1. Confirmation: eligible eras, tone selection, start
 * 2. Processing: progress bar, current era + step, streaming text, cost
 * 3. Terminal: completion/cancellation/failure summary
 *
 * Uses BulkOperationShell for overlay, header, pill lifecycle, and footer.
 */

import React, { useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { useBulkEraNarrativeStore } from "../lib/db/bulkEraNarrativeStore";
import { useEnrichmentQueueStore } from "../lib/db/enrichmentQueueStore";
import { useThinkingStore } from "../lib/db/thinkingStore";
import BulkOperationShell, { BulkTerminalMessage } from "./BulkOperationShell";
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

  if (!isOpen) return null;

  const progressStatus = progress?.status;
  const isConfirming = progressStatus === "confirming";
  const isTerminal = progressStatus === "complete" || progressStatus === "cancelled" || progressStatus === "failed";
  const globalPercent = progress?.totalEras > 0 ? Math.round(progress.processedEras / progress.totalEras * 100) : 0;
  const handleConfirm = () => {
    confirmBulk();
  };
  const handleCancel = () => {
    cancelBulk();
    if (progressStatus === "confirming") {
      onClose();
    }
  };
  const handleClose = () => {
    closeBulk();
    onClose();
  };

  // Header status text
  let statusText;
  if (isConfirming) statusText = `${progress?.totalEras ?? 0} eras`;
  else if (progressStatus === "running") statusText = "Processing...";
  else if (progressStatus === "complete") statusText = "Complete";
  else if (progressStatus === "cancelled") statusText = "Cancelled";
  else if (progressStatus === "failed") statusText = "Failed";

  // Pill status text when minimized
  const pillStatusText = progressStatus === "running"
    ? `${progress.processedEras}/${progress.totalEras}`
    : progressStatus;

  let progressFillModifier;
  if (progressStatus === "failed") progressFillModifier = "benm-progress-fill-failed";
  else if (progressStatus === "cancelled") progressFillModifier = "benm-progress-fill-cancelled";
  else progressFillModifier = "benm-progress-fill-complete";
  const progressFillClass = `benm-progress-fill ${progressFillModifier}`;
  return <BulkOperationShell pillId={PILL_ID} title="Bulk Era Narrative" tabId="chronicle" progress={progress} onConfirm={handleConfirm} onCancel={handleCancel} onClose={handleClose} confirmLabel={`Run All (${progress?.totalEras ?? 0} eras)`} statusText={statusText} pillStatusText={pillStatusText} confirmWidth="540px" processWidth="560px">
      {/* ---- Confirmation screen ---- */}
      {isConfirming && <>
          {/* Era list with per-era tone */}
          <div className="benm-era-section">
            <div className="bulk-section-label">Eras ({progress.eras.length})</div>
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
          {progress.status === "complete" && <BulkTerminalMessage status="complete">
              Generated {progress.processedEras} era narratives.
              {progress.totalWords > 0 && <span> {progress.totalWords.toLocaleString()} words total.</span>}
            </BulkTerminalMessage>}

          {progress.status === "cancelled" && <BulkTerminalMessage status="cancelled">
              Cancelled after processing {progress.processedEras} of {progress.totalEras} eras.
            </BulkTerminalMessage>}

          {progress.status === "failed" && <BulkTerminalMessage status="failed">
              {progress.error || "An unexpected error occurred."}
            </BulkTerminalMessage>}

          {/* Cost + words */}
          {(progress.totalCost > 0 || progress.totalWords > 0) && <div className="benm-stats">
              {progress.totalWords > 0 && <span>{progress.totalWords.toLocaleString()} words</span>}
              {progress.totalCost > 0 && <span>Cost: ${progress.totalCost.toFixed(4)}</span>}
            </div>}
        </>}
    </BulkOperationShell>;
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
