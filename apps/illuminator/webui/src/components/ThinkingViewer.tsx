/**
 * ThinkingViewer — Modal that displays live LLM streaming content.
 *
 * Two tabs: Thinking (extended thinking) and Response (text output).
 * Both stream in real-time with auto-scroll and copy buttons.
 * Renders at z-index 10001 to layer above everything including process modals.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useThinkingStore } from "../lib/db/thinkingStore";

const styles = {
  overlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10001,
  },
  dialog: {
    background: "var(--bg-primary)",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    width: "900px",
    maxWidth: "95vw",
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column" as const,
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
  },
  header: {
    padding: "12px 20px",
    borderBottom: "1px solid var(--border-color)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "8px" },
  headerTitle: { margin: 0, fontSize: "14px" },
  streamingLabel: { fontSize: "11px", color: "#f59e0b", fontWeight: 500 },
  headerActions: { display: "flex", alignItems: "center", gap: "8px" },
  copyButton: { padding: "4px 12px", fontSize: "11px" },
  closeButton: { padding: "4px 8px", fontSize: "14px", lineHeight: 1 },
  subtitleBar: {
    padding: "8px 20px",
    borderBottom: "1px solid var(--border-color)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
  },
  subtitleLabel: { fontSize: "11px", color: "var(--text-muted)" },
  tabGroup: { display: "flex", gap: "4px" },
  sizeLabel: { opacity: 0.6 },
  body: {
    flex: 1,
    minHeight: 0,
    margin: 0,
    padding: "16px 20px",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "12px",
    lineHeight: 1.6,
    overflowY: "auto" as const,
    color: "var(--text-secondary)",
  },
} as const;

type ViewerTab = "thinking" | "response";

export function ThinkingViewer() {
  const viewingTaskId = useThinkingStore((s) => s.viewingTaskId);
  const entry = useThinkingStore((s) => (viewingTaskId ? s.entries.get(viewingTaskId) : undefined));
  const closeViewer = useThinkingStore((s) => s.closeViewer);
  const [activeTab, setActiveTab] = useState<ViewerTab>("thinking");
  const preRef = useRef<HTMLPreElement>(null);
  const mouseDownOnOverlay = useRef(false);

  const content = activeTab === "thinking" ? entry?.thinking : entry?.text;

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (preRef.current && entry?.isActive) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [content, entry?.isActive]);

  // Auto-switch to response tab when thinking finishes but text is still streaming
  useEffect(() => {
    if (entry && !entry.thinking && entry.text && activeTab === "thinking") {
      setActiveTab("response");
    }
  }, [entry?.thinking, entry?.text, activeTab]);

  const handleCopy = useCallback(() => {
    if (content) {
      void navigator.clipboard.writeText(content);
    }
  }, [content]);

  const handleOverlayMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
        closeViewer();
      }
    },
    [closeViewer]
  );

  if (!viewingTaskId || !entry) return null;

  const thinkingLen = entry.thinking.length;
  const textLen = entry.text.length;

  return (
    <div
      style={styles.overlay}
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleOverlayClick(e); }}
    >
      <div
        style={styles.dialog}
      >
        {/* Header */}
        <div
          style={styles.header}
        >
          <div style={styles.headerLeft}>
            <h3 style={styles.headerTitle}>LLM Stream</h3>
            {entry.isActive && (
              <span
                style={styles.streamingLabel}
              >
                streaming...
              </span>
            )}
          </div>
          <div style={styles.headerActions}>
            <button
              onClick={handleCopy}
              className="illuminator-button"
              style={styles.copyButton}
              disabled={!content}
            >
              Copy
            </button>
            <button
              onClick={closeViewer}
              className="illuminator-button"
              style={styles.closeButton}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Subtitle + tabs */}
        <div
          style={styles.subtitleBar}
        >
          <span style={styles.subtitleLabel}>
            {entry.entityName} &middot; {entry.taskType}
          </span>
          <div style={styles.tabGroup}>
            <button
              onClick={() => setActiveTab("thinking")}
              style={{
                padding: "2px 10px",
                fontSize: "11px",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                background: activeTab === "thinking" ? "var(--bg-tertiary)" : "transparent",
                color: activeTab === "thinking" ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: activeTab === "thinking" ? 500 : 400,
              }}
            >
              Thinking{" "}
              {thinkingLen > 0 && <span style={styles.sizeLabel}>({formatSize(thinkingLen)})</span>}
            </button>
            <button
              onClick={() => setActiveTab("response")}
              style={{
                padding: "2px 10px",
                fontSize: "11px",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                background: activeTab === "response" ? "var(--bg-tertiary)" : "transparent",
                color: activeTab === "response" ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: activeTab === "response" ? 500 : 400,
              }}
            >
              Response{" "}
              {textLen > 0 && <span style={styles.sizeLabel}>({formatSize(textLen)})</span>}
            </button>
          </div>
        </div>

        {/* Body */}
        <pre
          ref={preRef}
          style={styles.body}
        >
          {content || (() => {
            if (entry.isActive) {
              return activeTab === "thinking"
                ? "Waiting for thinking content..."
                : "Waiting for response text...";
            }
            return activeTab === "thinking"
              ? "No thinking content (thinking may be disabled for this call type)."
              : "No response text received.";
          })()}
        </pre>
      </div>
    </div>
  );
}

function formatSize(chars: number): string {
  if (chars < 1000) return `${chars}`;
  return `${(chars / 1000).toFixed(1)}K`;
}
