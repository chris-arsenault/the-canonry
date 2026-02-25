/**
 * ToneAssignmentPreviewModal - Preview and edit corpus-wide tone assignments
 *
 * Shows:
 * - Distribution bar chart (5 tones, count per tone)
 * - Scrollable list with each chronicle's ranking and assigned tone
 * - Chronicles shifted from rank-1 are visually flagged
 * - Manual override per-chronicle before confirming
 */

import { useState, useMemo } from "react";
import { TONE_META } from "./HistorianToneSelector";

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
          width: "680px",
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
            <h2 style={{ margin: 0, fontSize: "16px" }}>Tone Assignment</h2>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {entries.length} chronicles
              {shiftedCount > 0 && ` · ${shiftedCount} shifted`}
            </span>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "20px",
            overflowY: "auto",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Distribution chart */}
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                fontWeight: 600,
                marginBottom: "10px",
              }}
            >
              Distribution
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {ANNOTATION_TONES.map((tone) => {
                const count = distribution[tone] || 0;
                const meta = TONE_META[tone];
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={tone} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        width: "16px",
                        textAlign: "center",
                        fontSize: "13px",
                        color: TONE_COLORS[tone],
                      }}
                    >
                      {meta?.symbol || "?"}
                    </span>
                    <span
                      style={{
                        width: "90px",
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {meta?.label || tone}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: "14px",
                        borderRadius: "3px",
                        background: "var(--bg-secondary)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          borderRadius: "3px",
                          background: TONE_COLORS[tone] || "#888",
                          opacity: 0.7,
                          width: `${pct}%`,
                          transition: "width 0.2s ease",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        width: "24px",
                        textAlign: "right",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chronicle list */}
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: "8px",
            }}
          >
            Assignments
          </div>
          <div
            style={{
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            {entries.map((entry, i) => (
              <div
                key={entry.chronicleId}
                style={{
                  padding: "8px 12px",
                  borderBottom: i < entries.length - 1 ? "1px solid var(--border-color)" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: entry.wasShifted ? "rgba(245, 158, 11, 0.05)" : undefined,
                }}
              >
                {/* Title */}
                <div
                  style={{
                    flex: 1,
                    fontSize: "12px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  {entry.title}
                </div>

                {/* Ranking display */}
                <div
                  style={{
                    display: "flex",
                    gap: "2px",
                    fontSize: "12px",
                    flexShrink: 0,
                  }}
                >
                  {entry.ranking.map((tone, rank) => {
                    const meta = TONE_META[tone];
                    const isAssigned = tone === entry.assignedTone;
                    return (
                      <span
                        key={rank}
                        title={`#${rank + 1}: ${meta?.label || tone}`}
                        style={{
                          width: "20px",
                          height: "20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "3px",
                          fontSize: "11px",
                          background: isAssigned ? TONE_COLORS[tone] : "transparent",
                          color: isAssigned ? "#fff" : "var(--text-muted)",
                          fontWeight: isAssigned ? 600 : 400,
                          opacity: rank === 0 ? 1 : rank === 1 ? 0.7 : 0.4,
                          cursor: "pointer",
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
                    style={{
                      fontSize: "10px",
                      color: "#f59e0b",
                      flexShrink: 0,
                    }}
                  >
                    shifted
                  </span>
                )}
              </div>
            ))}
          </div>
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
          <button
            onClick={onClose}
            className="illuminator-button"
            style={{ padding: "6px 16px", fontSize: "12px" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(entries)}
            className="illuminator-button illuminator-button-primary"
            style={{ padding: "6px 16px", fontSize: "12px" }}
          >
            Apply ({entries.length} assignments)
          </button>
        </div>
      </div>
    </div>
  );
}
