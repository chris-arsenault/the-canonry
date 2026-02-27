/**
 * ThinkingViewer — Modal that displays live LLM streaming content.
 *
 * Two tabs: Thinking (extended thinking) and Response (text output).
 * Both stream in real-time with auto-scroll and copy buttons.
 * Renders at z-index 10001 to layer above everything including process modals.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useThinkingStore } from "../lib/db/thinkingStore";
import "./ThinkingViewer.css";

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
      className="tv-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleOverlayClick(e); }}
    >
      <div
        className="tv-dialog"
      >
        {/* Header */}
        <div
          className="tv-header"
        >
          <div className="tv-header-left">
            <h3 className="tv-header-title">LLM Stream</h3>
            {entry.isActive && (
              <span
                className="tv-streaming-label"
              >
                streaming...
              </span>
            )}
          </div>
          <div className="tv-header-actions">
            <button
              onClick={handleCopy}
              className="illuminator-button tv-copy-button"
              disabled={!content}
            >
              Copy
            </button>
            <button
              onClick={closeViewer}
              className="illuminator-button tv-close-button"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Subtitle + tabs */}
        <div
          className="tv-subtitle-bar"
        >
          <span className="tv-subtitle-label">
            {entry.entityName} &middot; {entry.taskType}
          </span>
          <div className="tv-tab-group">
            <button
              onClick={() => setActiveTab("thinking")}
              className={`tv-tab-button ${activeTab === "thinking" ? "tv-tab-button-active" : "tv-tab-button-inactive"}`}
            >
              Thinking{" "}
              {thinkingLen > 0 && <span className="tv-size-label">({formatSize(thinkingLen)})</span>}
            </button>
            <button
              onClick={() => setActiveTab("response")}
              className={`tv-tab-button ${activeTab === "response" ? "tv-tab-button-active" : "tv-tab-button-inactive"}`}
            >
              Response{" "}
              {textLen > 0 && <span className="tv-size-label">({formatSize(textLen)})</span>}
            </button>
          </div>
        </div>

        {/* Body */}
        <pre
          ref={preRef}
          className="tv-body"
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
