/**
 * FloatingPills — Fixed-position container for minimized process modals.
 *
 * Renders as a stack of compact pills in the bottom-right corner.
 * Each pill shows status and can be clicked to re-expand the modal.
 */

import { useFloatingPillStore, type FloatingPill } from "../lib/db/floatingPillStore";
import { useThinkingStore } from "../lib/db/thinkingStore";
import React from "react";

const styles = {
  pill: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    background: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: "20px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
    cursor: "pointer",
    fontSize: "12px",
    minWidth: "160px",
    transition: "box-shadow 0.15s",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  } as const,
  label: { fontWeight: 500, color: "var(--text-primary)" },
  statusText: { color: "var(--text-muted)", marginLeft: "auto" },
  thinkingIcon: {
    cursor: "pointer",
    fontSize: "13px",
    opacity: 0.7,
    marginLeft: "4px",
  },
  container: {
    position: "fixed" as const,
    bottom: "16px",
    right: "16px",
    zIndex: 9999,
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
    alignItems: "flex-end",
  },
} as const;

function Pill({ pill, onNavigate }: Readonly<{ pill: FloatingPill; onNavigate?: (tabId: string) => void }>) {
  const expand = useFloatingPillStore((s) => s.expand);
  const hasThinking = useThinkingStore((s) => {
    if (!pill.taskId) return false;
    const entry = s.entries.get(pill.taskId);
    return Boolean(entry && entry.thinking.length > 0);
  });

  return (
    <div
      style={styles.pill}
      onClick={() => {
        if (pill.tabId && onNavigate) onNavigate(pill.tabId);
        expand(pill.id);
      }}
      title="Click to expand"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
    >
      {/* Status dot */}
      <span
        style={{ ...styles.statusDot, background: pill.statusColor }}
      />

      {/* Label + status */}
      <span style={styles.label}>{pill.label}</span>
      <span style={styles.statusText}>{pill.statusText}</span>

      {/* Thinking icon */}
      {hasThinking && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            useThinkingStore.getState().openViewer(pill.taskId);
          }}
          title="View thinking"
          style={styles.thinkingIcon}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
        >
          ✦
        </span>
      )}
    </div>
  );
}

export function FloatingPills({ onNavigate }: Readonly<{ onNavigate?: (tabId: string) => void }>) {
  const pills = useFloatingPillStore((s) => s.pills);

  if (pills.size === 0) return null;

  return (
    <div
      style={styles.container}
    >
      {Array.from(pills.values()).map((pill) => (
        <Pill key={pill.id} pill={pill} onNavigate={onNavigate} />
      ))}
    </div>
  );
}
