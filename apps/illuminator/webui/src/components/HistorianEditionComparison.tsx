/**
 * HistorianEditionComparison — Compare pre-historian baseline and all historian edition versions.
 *
 * Shows when an entity has at least one historian edition. Versions include the pre-historian
 * baseline plus each historian output, allowing word count and diff comparison across all.
 * Reuses InlineDiff pattern from SummaryRevisionModal and version selector pattern from
 * ChronicleVersionSelector.
 */

import React, { useState, useMemo } from "react";
import { diffWords } from "diff";
import "./HistorianEditionComparison.css";
import type { HistorianNote } from "../lib/historianTypes";

interface HistoryEntry {
  description: string;
  source?: string;
  replacedAt?: number;
}

interface EditionVersion {
  label: string;
  description: string;
  historyIndex: number; // -1 = current entity.description
  isCurrent: boolean;
  wordCount: number;
  date?: string;
}

interface HistorianEditionComparisonProps {
  entityId: string;
  currentDescription: string;
  descriptionHistory: HistoryEntry[];
  historianNotes?: HistorianNote[];
  onRestoreVersion: (entityId: string, historyIndex: number) => void;
}

export default function HistorianEditionComparison({
  entityId,
  currentDescription,
  descriptionHistory,
  historianNotes,
  onRestoreVersion,
}: Readonly<HistorianEditionComparisonProps>) {
  const [expanded, setExpanded] = useState(false);

  const versions = useMemo(() => {
    // Find all historian-edition and legacy-copy-edit entries with their original indices
    const editionSources = new Set(["historian-edition", "legacy-copy-edit"]);
    const historianEntries = descriptionHistory
      .map((entry, index) => ({ ...entry, historyIndex: index }))
      .filter((entry) => editionSources.has(entry.source || ""));

    if (historianEntries.length === 0) return [];

    const editionVersions: EditionVersion[] = [];

    // First entry = pre-historian baseline
    const baseline = historianEntries[0];
    editionVersions.push({
      label: "Pre-Historian",
      description: baseline.description,
      historyIndex: baseline.historyIndex,
      isCurrent: false,
      wordCount: baseline.description.split(/\s+/).length,
      date: baseline.replacedAt ? new Date(baseline.replacedAt).toLocaleDateString() : undefined,
    });

    // Subsequent entries = prior historian/legacy outputs pushed to history when replaced
    for (let i = 1; i < historianEntries.length; i++) {
      const entry = historianEntries[i];
      const isLegacy = entry.source === "legacy-copy-edit";
      editionVersions.push({
        label: `Edition ${i}${isLegacy ? " (legacy)" : ""}`,
        description: entry.description,
        historyIndex: entry.historyIndex,
        isCurrent: false,
        wordCount: entry.description.split(/\s+/).length,
        date: entry.replacedAt ? new Date(entry.replacedAt).toLocaleDateString() : undefined,
      });
    }

    // Current description = latest edition
    editionVersions.push({
      label: `Edition ${historianEntries.length} (active)`,
      description: currentDescription,
      historyIndex: -1,
      isCurrent: true,
      wordCount: currentDescription.split(/\s+/).length,
    });

    return editionVersions;
  }, [descriptionHistory, currentDescription]);

  // Exportable when we have 3+ versions: pre-historian baseline, at least one prior edition, and active.
  // versions[0] = pre-historian, versions[last] = active, everything in between = prior editions.
  const exportData = useMemo(() => {
    if (versions.length < 3) return null;
    const active = versions[versions.length - 1];
    if (!active?.isCurrent) return null;
    const data: Record<string, unknown> = {
      preHistorian: versions[0].description,
      legacyCopyEdit: versions[versions.length - 2].description,
      active: active.description,
    };
    // Include non-disabled annotations when present
    const activeNotes = historianNotes?.filter((n) => n.display !== "disabled");
    if (activeNotes && activeNotes.length > 0) {
      data.annotations = activeNotes.map((n) => ({
        type: n.type,
        display: n.display || "full",
        anchorPhrase: n.anchorPhrase,
        text: n.text,
      }));
    }
    return data;
  }, [versions, historianNotes]);

  const [selectedIdx, setSelectedIdx] = useState(() => versions.length - 1);
  const [compareIdx, setCompareIdx] = useState(() =>
    versions.length > 1 ? versions.length - 2 : -1
  );

  if (versions.length < 2) return null;

  const selected = versions[selectedIdx] || versions[versions.length - 1];
  const compare = compareIdx >= 0 ? versions[compareIdx] : null;

  const wordDelta = compare ? selected.wordCount - compare.wordCount : 0;
  const deltaSign = wordDelta >= 0 ? "+" : "";

  return (
    <div className="hec-wrapper">
      <div
        onClick={() => setExpanded(!expanded)}
        className="hec-toggle"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
      >
        <span>{expanded ? "\u25BC" : "\u25B6"}</span>
        <span className="hec-toggle-label">
          Edition Comparison
        </span>
        <span
          title={`${versions.length - 1} historian edition${versions.length - 1 !== 1 ? "s" : ""} + pre-historian baseline`}
        >
          {"\u25C7"} {versions.length} versions
        </span>
      </div>

      {expanded && (
        <div className="hec-expanded">
          {/* Version selectors */}
          <div className="hec-selector-row">
            <select
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
              className="illuminator-select ilu-compact-select hec-select"
            >
              {versions.map((v, i) => (
                <option key={i} value={i}>
                  {v.label} ({v.wordCount}w){v.date ? ` — ${v.date}` : ""}
                </option>
              ))}
            </select>
            <select
              value={compareIdx}
              onChange={(e) => setCompareIdx(Number(e.target.value))}
              className="illuminator-select ilu-compact-select hec-compare-select"
              title="Select a version to diff against"
            >
              <option value={-1}>Compare to...</option>
              {versions
                .filter((_, i) => i !== selectedIdx)
                .map((v) => {
                  const realIdx = versions.indexOf(v);
                  return (
                    <option key={realIdx} value={realIdx}>
                      {v.label} ({v.wordCount}w)
                    </option>
                  );
                })}
            </select>
            {selected.isCurrent ? (
              <span className="ilu-active-badge">
                Active
              </span>
            ) : (
              <button
                onClick={() => onRestoreVersion(entityId, selected.historyIndex)}
                className="ilu-action-btn-sm hec-make-active-btn"
              >
                Make Active
              </button>
            )}
            {exportData && (
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `edition-comparison-${entityId}-${ts}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="ilu-action-btn-sm hec-export-btn"
                title="Export pre-historian, legacy, and active versions as JSON"
              >
                Export
              </button>
            )}
          </div>

          {/* Word count summary */}
          {compare && (
            <div className="hec-word-summary">

              <span>
                {"\u25C6"} {selected.label}: {selected.wordCount.toLocaleString()}w
              </span>
              <span>
                {"\u25C6"} {compare.label}: {compare.wordCount.toLocaleString()}w
              </span>
              <span
                className="hec-word-delta"
                style={{
                  "--hec-delta-color":
                    wordDelta < 0 ? "#22c55e" : wordDelta > 0 ? "#f59e0b" : "var(--text-muted)",
                } as React.CSSProperties}
              >
                {deltaSign}
                {wordDelta.toLocaleString()}w ({deltaSign}
                {compare.wordCount > 0 ? Math.round((wordDelta / compare.wordCount) * 100) : 0}%)
              </span>
            </div>
          )}

          {/* Diff view */}
          {compare ? (
            <DiffView older={compare.description} newer={selected.description} />
          ) : (
            <div className="hec-text-view">

              {selected.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiffView({ older, newer }: Readonly<{ older: string; newer: string }>) {
  const changes = diffWords(older, newer);
  return (
    <div className="hec-text-view">
      {changes.map((part, i) => {
        if (part.added) {
          return (
            <span key={i} className="hec-diff-added">
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span key={i} className="hec-diff-removed">
              {part.value}
            </span>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </div>
  );
}
