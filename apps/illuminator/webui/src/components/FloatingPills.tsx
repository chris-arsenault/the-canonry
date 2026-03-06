/**
 * FloatingPills — Fixed-position container for minimized process modals.
 *
 * Renders as a stack of compact pills in the bottom-right corner.
 * Each pill shows status and can be clicked to re-expand the modal.
 */

import { useFloatingPillStore, type FloatingPill } from "../lib/db/floatingPillStore";
import { useThinkingStore } from "../lib/db/thinkingStore";
import React from "react";
import "./FloatingPills.css";

function Pill({ pill, onNavigate }: Readonly<{ pill: FloatingPill; onNavigate?: (tabId: string) => void }>) {
  const expand = useFloatingPillStore((s) => s.expand);
  const hasThinking = useThinkingStore((s) => {
    if (!pill.taskId) return false;
    const entry = s.entries.get(pill.taskId);
    return Boolean(entry && entry.thinking.length > 0);
  });

  return (
    <div
      className="fp-pill"
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
        className="fp-status-dot"
        style={{ "--fp-dot-color": pill.statusColor } as React.CSSProperties}
      />

      {/* Label + status */}
      <span className="fp-label">{pill.label}</span>
      <span className="fp-status-text">{pill.statusText}</span>

      {/* Thinking icon */}
      {hasThinking && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            useThinkingStore.getState().openViewer(pill.taskId);
          }}
          title="View thinking"
          className="fp-thinking-icon"
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
    <div className="fp-container">
      {Array.from(pills.values()).map((pill) => (
        <Pill key={pill.id} pill={pill} onNavigate={onNavigate} />
      ))}
    </div>
  );
}
