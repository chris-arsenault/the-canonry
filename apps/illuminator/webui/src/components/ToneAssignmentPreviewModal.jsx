/**
 * ToneAssignmentPreviewModal - Preview and edit corpus-wide tone assignments
 *
 * Shows:
 * - Distribution bar chart (5 tones, count per tone)
 * - Scrollable list with each chronicle's ranking and assigned tone
 * - Chronicles shifted from rank-1 are visually flagged
 * - Manual override per-chronicle before confirming
 */

import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { TONE_META } from "./HistorianToneSelector";
import "./ToneAssignmentPreviewModal.css";

const ANNOTATION_TONES = [
  "witty",
  "weary",
  "elegiac",
  "cantankerous",
  "rueful",
  "conspiratorial",
  "bemused",
];

const TONE_COLORS = {
  witty: "#f59e0b",
  weary: "#6b7280",
  forensic: "#3b82f6",
  elegiac: "#8b5cf6",
  cantankerous: "#ef4444",
  rueful: "#d97706",
  conspiratorial: "#059669",
  bemused: "#0891b2",
};

export default function ToneAssignmentPreviewModal({ preview, onApply, onClose }) {
  if (!preview) return null;

  const [entries, setEntries] = useState(preview.entries);

  const distribution = useMemo(() => {
    const counts = Object.fromEntries(ANNOTATION_TONES.map((t) => [t, 0]));
    for (const e of entries) {
      if (counts[e.assignedTone] !== undefined) counts[e.assignedTone]++;
    }
    return counts;
  }, [entries]);

  const maxCount = Math.max(1, ...Object.values(distribution));
  const shiftedCount = entries.filter((e) => e.wasShifted).length;

  const handleToneChange = (chronicleId, newTone) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.chronicleId === chronicleId
          ? { ...e, assignedTone: newTone, wasShifted: newTone !== e.ranking[0] }
          : e
      )
    );
  };

  return (
    <div className="tapm-overlay">
      <div className="tapm-modal">
        {/* Header */}
        <div className="tapm-header">
          <div className="tapm-header-row">
            <h2 className="tapm-title">Tone Assignment</h2>
            <span className="tapm-subtitle">
              {entries.length} chronicles
              {shiftedCount > 0 && ` · ${shiftedCount} shifted`}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="tapm-body">
          {/* Distribution chart */}
          <div className="tapm-distribution">
            <div className="tapm-section-label">Distribution</div>
            <div className="tapm-chart">
              {ANNOTATION_TONES.map((tone) => {
                const count = distribution[tone] || 0;
                const meta = TONE_META[tone];
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={tone} className="tapm-chart-row">
                    <span
                      className="tapm-chart-symbol"
                      // eslint-disable-next-line local/no-inline-styles -- dynamic tone color from TONE_COLORS map
                      style={{ color: TONE_COLORS[tone] }}
                    >
                      {meta?.symbol || "?"}
                    </span>
                    <span className="tapm-chart-label">{meta?.label || tone}</span>
                    <div className="tapm-chart-bar-track">
                      <div
                        className="tapm-chart-bar-fill"
                        // eslint-disable-next-line local/no-inline-styles -- dynamic tone color and computed width
                        style={{
                          "--tapm-bar-color": TONE_COLORS[tone] || "#888",
                          "--tapm-bar-width": `${pct}%`,
                          background: "var(--tapm-bar-color)",
                          width: "var(--tapm-bar-width)",
                        }}
                      />
                    </div>
                    <span className="tapm-chart-count">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chronicle list */}
          <div className="tapm-section-label tapm-section-label-assignments">Assignments</div>
          <div className="tapm-list">
            {entries.map((entry) => (
              <div
                key={entry.chronicleId}
                className={`tapm-entry ${entry.wasShifted ? "tapm-entry-shifted" : ""}`}
              >
                {/* Title */}
                <div className="tapm-entry-title">{entry.title}</div>

                {/* Ranking display */}
                <div className="tapm-ranking">
                  {entry.ranking.map((tone, rank) => {
                    const meta = TONE_META[tone];
                    const isAssigned = tone === entry.assignedTone;
                    return (
                      <span
                        key={rank}
                        title={`#${rank + 1}: ${meta?.label || tone}`}
                        className={`tapm-rank-chip ${isAssigned ? "tapm-rank-chip-assigned" : "tapm-rank-chip-unassigned"}`}
                        // eslint-disable-next-line local/no-inline-styles -- dynamic tone color and rank-based opacity
                        style={{
                          "--tapm-chip-bg": isAssigned ? TONE_COLORS[tone] : "transparent",
                          background: "var(--tapm-chip-bg)",
                          opacity: rank === 0 ? 1 : rank === 1 ? 0.7 : 0.4,
                        }}
                        onClick={() => handleToneChange(entry.chronicleId, tone)}
                      >
                        {meta?.symbol || "?"}
                      </span>
                    );
                  })}
                </div>

                {/* Shifted indicator */}
                {entry.wasShifted && (
                  <span
                    title="Shifted from rank 1 for distribution balance"
                    className="tapm-shifted-label"
                  >
                    shifted
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="tapm-footer">
          <button onClick={onClose} className="illuminator-button tapm-footer-btn">
            Cancel
          </button>
          <button
            onClick={() => onApply(entries)}
            className="illuminator-button illuminator-button-primary tapm-footer-btn"
          >
            Apply ({entries.length} assignments)
          </button>
        </div>
      </div>
    </div>
  );
}

ToneAssignmentPreviewModal.propTypes = {
  preview: PropTypes.object,
  onApply: PropTypes.func,
  onClose: PropTypes.func,
};
