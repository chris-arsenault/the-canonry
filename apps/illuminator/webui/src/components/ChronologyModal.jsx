/**
 * ChronologyModal — Historian assigns chronological years to chronicles within an era.
 *
 * Two states:
 * 1. Setup: pick era, review chronicle list (with prep status), kick off task
 * 2. Review: see assignments, adjust years, apply
 *
 * Always uses scholarly tone. Prefers historian prep notes over summaries for context.
 */

import React, { useState, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { useChronicleStore } from "../lib/db/chronicleStore";
import { batchUpdateChronicleEraYears } from "../lib/db/chronicleRepository";
import { useHistorianChronology } from "../hooks/useHistorianChronology";
import { ErrorMessage } from "@the-canonry/shared-components";
import "./ChronologyModal.css";

export default function ChronologyModal({
  isOpen,
  onClose,
  chronicleItems,
  wizardEras,
  wizardEvents,
  projectId,
  simulationRunId,
  historianConfig,
  onEnqueue,
  onApplied,
}) {
  const [selectedEraId, setSelectedEraId] = useState("");
  const [expandedReasoning, setExpandedReasoning] = useState({});

  const { run, isActive, startChronology, adjustYear, applyChronology, cancelChronology } =
    useHistorianChronology(onEnqueue);

  // Build era options from wizardEras
  const eraOptions = useMemo(() => {
    return wizardEras.map((era) => {
      const eraChronicles = chronicleItems.filter((c) => c.focalEraName === era.name);
      return {
        id: era.id,
        name: era.name,
        startTick: era.startTick,
        endTick: era.endTick,
        count: eraChronicles.length,
        preppedCount: eraChronicles.filter((c) => c.hasHistorianPrep).length,
      };
    });
  }, [wizardEras, chronicleItems]);

  // Get chronicles for the selected era
  const selectedEra = eraOptions.find((e) => e.id === selectedEraId);

  // Chronicles in the selected era for the list display
  const selectedEraChronicles = useMemo(() => {
    if (!selectedEra) return [];
    const era = wizardEras.find((e) => e.id === selectedEraId);
    if (!era) return [];
    return chronicleItems
      .filter((c) => c.focalEraName === era.name)
      .sort((a, b) => (a.eraYear || 0) - (b.eraYear || 0) || a.name.localeCompare(b.name));
  }, [selectedEra, selectedEraId, wizardEras, chronicleItems]);

  // Build context and start
  const handleStart = useCallback(async () => {
    if (!selectedEra) return;

    const era = wizardEras.find((e) => e.id === selectedEraId);
    if (!era) return;

    // Get chronicles in this era
    const eraChronicles = chronicleItems.filter((item) => item.focalEraName === era.name);

    // Load full records for summaries
    const store = useChronicleStore.getState();
    const chronicleEntries = [];

    for (const item of eraChronicles) {
      const record = await store.loadChronicle(item.chronicleId);
      if (!record) continue;

      // Resolve event headlines for this chronicle
      const chronicleEventIds = new Set(record.selectedEventIds || []);
      const events = (wizardEvents || [])
        .filter((e) => chronicleEventIds.has(e.id))
        .map((e) => ({ tick: e.tick, headline: e.headline }));

      // Cast from role assignments
      const cast = (record.roleAssignments || []).map((r) => ({
        entityName: r.entityName,
        role: r.roleName || (r.isPrimary ? "primary" : "supporting"),
        kind: r.entityKind || "",
      }));

      // Prefer historian prep, then summary, then opening text
      const content = record.finalContent || record.assembledContent || "";
      const openingText = content.slice(0, 300).split(/\n\n/).slice(0, 2).join("\n\n");

      chronicleEntries.push({
        chronicleId: record.chronicleId,
        title: record.title || item.name,
        tickRange: record.temporalContext?.chronicleTickRange || [0, 0],
        temporalScope: record.temporalContext?.temporalScope || "unknown",
        isMultiEra: record.temporalContext?.isMultiEra || false,
        cast,
        events,
        prep: record.historianPrep || undefined,
        summary: record.historianPrep ? undefined : record.summary,
        openingText: record.historianPrep || record.summary ? undefined : openingText,
      });
    }

    // Previous eras for context
    const previousEras = wizardEras
      .filter((e) => e.order < era.order)
      .sort((a, b) => a.order - b.order)
      .map((e) => ({
        name: e.name,
        startTick: e.startTick,
        endTick: e.endTick,
        summary: e.summary,
      }));

    const contextJson = JSON.stringify({
      era: {
        eraId: era.id,
        eraName: era.name,
        eraSummary: era.summary,
        startTick: era.startTick,
        endTick: era.endTick,
      },
      previousEras,
      chronicles: chronicleEntries,
    });

    startChronology({
      projectId,
      simulationRunId,
      eraId: era.id,
      eraName: era.name,
      contextJson,
      historianConfig,
      tone: "scholarly",
    });
  }, [
    selectedEra,
    selectedEraId,
    wizardEras,
    chronicleItems,
    wizardEvents,
    projectId,
    simulationRunId,
    historianConfig,
    startChronology,
  ]);

  // Apply assignments to chronicle records
  const handleApply = useCallback(async () => {
    const assignments = applyChronology();
    if (assignments.length === 0) return;

    await batchUpdateChronicleEraYears(
      assignments.map((a) => ({
        chronicleId: a.chronicleId,
        eraYear: a.year,
        eraYearReasoning: a.reasoning,
      }))
    );

    onApplied();
  }, [applyChronology, onApplied]);

  // Cancel
  const handleCancel = useCallback(() => {
    cancelChronology();
  }, [cancelChronology]);

  // Close modal (cancel if active)
  const handleClose = useCallback(() => {
    if (isActive) cancelChronology();
    onClose();
  }, [isActive, cancelChronology, onClose]);

  if (!isOpen) return null;

  const isGenerating = run?.status === "pending" || run?.status === "generating";
  const isReviewing = run?.status === "reviewing";
  const isFailed = run?.status === "failed";
  const assignments = run?.chronologyAssignments || [];
  const sortedAssignments = [...assignments].sort((a, b) => a.year - b.year);

  // Find chronicle title by ID
  const titleMap = {};
  for (const item of chronicleItems) {
    titleMap[item.chronicleId] = item.name;
  }

  const canStart = selectedEraId && selectedEra?.count > 0;

  return (
    <div
      className="chm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
    >
      <div className="chm-dialog">
        {/* Header */}
        <div className="chm-header">
          <span className="chm-header-title">
            {isReviewing ? `Chronology: ${run?.targetName}` : "Historian Chronology"}
          </span>
          <button onClick={handleClose} className="chm-close-btn">
            {"\u2715"}
          </button>
        </div>

        {/* Body */}
        <div className="chm-body">
          {/* Setup state */}
          {!isActive && !isReviewing && !isFailed && (
            <>
              <div className="chm-field">
                <label htmlFor="era" className="chm-field-label">Era</label>
                <select id="era"
                  className="illuminator-select chm-era-select"
                  value={selectedEraId}
                  onChange={(e) => setSelectedEraId(e.target.value)}
                >
                  <option value="">Select an era...</option>
                  {eraOptions.map((era) => (
                    <option key={era.id} value={era.id}>
                      {era.name} ({era.count} chronicles, Y{era.startTick}
                      {"\u2013"}Y{era.endTick})
                    </option>
                  ))}
                </select>
              </div>

              {/* Chronicle list for selected era */}
              {selectedEra && selectedEraChronicles.length > 0 && (
                <div className="chm-field">
                  <div className="chm-list-header">
                    <span>Chronicles ({selectedEraChronicles.length})</span>
                    <span className="chm-list-header-right">
                      {selectedEra.preppedCount}/{selectedEraChronicles.length} prepped
                    </span>
                  </div>
                  <div className="chm-chronicle-list">
                    {selectedEraChronicles.map((c, i) => (
                      <div
                        key={c.chronicleId}
                        className={`chm-chronicle-row ${i < selectedEraChronicles.length - 1 ? "chm-chronicle-row-bordered" : ""}`}
                      >
                        <span
                          className={`chm-prep-icon ${c.hasHistorianPrep ? "chm-prep-icon-ready" : "chm-prep-icon-none"}`}
                          title={
                            c.hasHistorianPrep ? "Historian prep available" : "No historian prep"
                          }
                        >
                          {c.hasHistorianPrep ? "\u25C6" : "\u25C7"}
                        </span>
                        <span className="chm-chronicle-name">{c.name}</span>
                        {c.eraYear != null && <span className="chm-era-year">Y{c.eraYear}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => void handleStart()}
                disabled={!canStart}
                className={`illuminator-button chm-start-btn ${canStart ? "chm-start-btn-active" : "chm-start-btn-disabled"}`}
              >
                Assign Years
              </button>
            </>
          )}

          {/* Generating state */}
          {isGenerating && (
            <div className="chm-generating">
              <div className="chm-generating-msg">The historian is ordering chronicles...</div>
              <div className="chm-generating-target">{run?.targetName}</div>
            </div>
          )}

          {/* Failed state */}
          {isFailed && (
            <div className="chm-failed">
              <ErrorMessage title="Chronology failed" message={run?.error} className="chm-failed-error" />
              <button onClick={handleCancel} className="illuminator-button">
                Dismiss
              </button>
            </div>
          )}

          {/* Review state */}
          {isReviewing && sortedAssignments.length > 0 && (
            <>
              <div className="chm-review-hint">
                {sortedAssignments.length} chronicles ordered. Adjust years if needed, then apply.
              </div>

              <div className="chm-assignments">
                {sortedAssignments.map((a) => (
                  <div key={a.chronicleId} className="chm-assignment-card">
                    <div className="chm-assignment-row">
                      <input
                        type="number"
                        value={a.year}
                        min={selectedEra?.startTick}
                        max={selectedEra?.endTick}
                        onChange={(e) =>
                          adjustYear(a.chronicleId, parseInt(e.target.value, 10) || a.year)
                        }
                        className="chm-year-input"
                      />
                      <span className="chm-assignment-title">
                        {titleMap[a.chronicleId] || a.chronicleId}
                      </span>
                      {a.reasoning && (
                        <button
                          onClick={() =>
                            setExpandedReasoning((prev) => ({
                              ...prev,
                              [a.chronicleId]: !prev[a.chronicleId],
                            }))
                          }
                          className="chm-reasoning-btn"
                          title="Show reasoning"
                        >
                          {expandedReasoning[a.chronicleId] ? "\u25BC" : "\u25B6"}
                        </button>
                      )}
                    </div>
                    {expandedReasoning[a.chronicleId] && a.reasoning && (
                      <div className="chm-reasoning-text">{a.reasoning}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {isReviewing && (
          <div className="chm-footer">
            <button onClick={handleCancel} className="illuminator-button">
              Cancel
            </button>
            <button onClick={() => void handleApply()} className="illuminator-button chm-apply-btn">
              Apply ({sortedAssignments.length} years)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

ChronologyModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  chronicleItems: PropTypes.array,
  wizardEras: PropTypes.array,
  wizardEvents: PropTypes.array,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  simulationRunId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  historianConfig: PropTypes.object,
  onEnqueue: PropTypes.func,
  onApplied: PropTypes.func,
};
