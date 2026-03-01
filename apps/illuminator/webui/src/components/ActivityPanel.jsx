/**
 * ActivityPanel - Worker activity monitor
 *
 * Shows the current state of the enrichment queue:
 * - Currently running tasks
 * - Queued tasks
 * - Recent completed/errored tasks
 */

import React, { useMemo, useState, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import { useThinkingStore } from "../lib/db/thinkingStore";
import { ErrorMessage } from "@the-canonry/shared-components";
import "./ActivityPanel.css";
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString();
}
function extractAnthropicErrorMessage(debug) {
  if (!debug?.response) return null;
  if (debug?.meta?.provider && debug.meta.provider !== "anthropic") return null;
  try {
    const data = JSON.parse(debug.response);
    const error = data?.error;
    const message = typeof error?.message === "string" ? error.message.trim() : "";
    const type = typeof error?.type === "string" ? error.type.trim() : "";
    const topLevelMessage = typeof data?.message === "string" ? data.message.trim() : "";
    if (message && type) return `${type}: ${message}`;
    return message || topLevelMessage || type || null;
  } catch {
    return null;
  }
}
function formatActivityError(item) {
  const baseError = item.error || "";
  const providerError = extractAnthropicErrorMessage(item.debug);
  if (!providerError) {
    return baseError;
  }
  if (!baseError) {
    return providerError;
  }
  if (baseError.includes(providerError)) {
    return baseError;
  }
  return `${baseError} (Anthropic: ${providerError})`;
}
const TASK_STATUS_COLORS = {
  queued: "var(--text-muted)",
  running: "#f59e0b",
  complete: "#10b981",
  error: "#ef4444"
};
const TASK_STATUS_ICONS = {
  queued: "◷",
  running: "◐",
  complete: "✓",
  error: "✗"
};
function TaskRow({
  item,
  onCancel,
  onRetry,
  onViewDebug
}) {
  const streamEntry = useThinkingStore(s => s.entries.get(item.id));
  const hasStream = Boolean(streamEntry);
  const openThinking = useThinkingStore(s => s.openViewer);
  let duration = null;
  if (item.startedAt) {
    duration = item.completedAt ? item.completedAt - item.startedAt : Date.now() - item.startedAt;
  }
  const statusIcons = TASK_STATUS_ICONS;
  const hasDebug = Boolean(item.debug && (item.debug.request || item.debug.response));
  return <div className="ap-task-row">
      <span className="ap-task-status-icon"
    style={{
      "--ap-status-color": TASK_STATUS_COLORS[item.status]
    }}>
        {statusIcons[item.status]}
      </span>

      <div className="ap-task-info">
        <div className="ap-task-name">{item.entityName}</div>
        <div className="ap-task-type">
          {(() => {
          if (item.type === "description") return "Description";
          if (item.type === "image") return "Image";
          return "Chronicle";
        })()}
          {item.entityKind && ` · ${item.entityKind}`}
        </div>
      </div>

      {duration !== null && <span className="ap-task-duration">{formatDuration(duration)}</span>}

      {item.status === "queued" && onCancel && <button onClick={() => onCancel(item.id)} className="illuminator-button-link ap-task-action">
          Cancel
        </button>}

      {item.status === "running" && onCancel && <button onClick={() => onCancel(item.id)} className="illuminator-button-link ap-task-action">
          Cancel
        </button>}

      {item.status === "error" && onRetry && <button onClick={() => onRetry(item.id)} className="illuminator-button-link ap-task-action">
          Retry
        </button>}

      {hasStream && <button onClick={() => openThinking(item.id)} className="illuminator-button-link ap-task-action" title="View LLM stream (thinking + response)">
          {(() => {
        if (!streamEntry.isActive) return "Stream";
        if (streamEntry.text.length > 0) return `${Math.round(streamEntry.text.length / 1000)}K`;
        if (streamEntry.thinking.length > 0) return "Thinking";
        return "...";
      })()}
        </button>}

      {hasDebug && onViewDebug && <button onClick={() => onViewDebug(item)} className="illuminator-button-link ap-task-action">
          View Debug
        </button>}
    </div>;
}
TaskRow.propTypes = {
  item: PropTypes.object,
  onCancel: PropTypes.func,
  onRetry: PropTypes.func,
  onViewDebug: PropTypes.func
};
export default function ActivityPanel({
  queue,
  stats,
  onCancel,
  onRetry,
  onCancelAll,
  onClearCompleted
}) {
  const [debugItem, setDebugItem] = useState(null);
  const mouseDownOnOverlay = useRef(false);
  const handleOverlayMouseDown = useCallback(e => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  }, []);
  const handleOverlayClick = useCallback(e => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      setDebugItem(null);
    }
  }, []);

  // Split queue into categories
  const {
    running,
    queued,
    completed,
    errored
  } = useMemo(() => {
    const running = queue.filter(item => item.status === "running");
    const queued = queue.filter(item => item.status === "queued");
    const completed = queue.filter(item => item.status === "complete").sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).slice(0, 20);
    const errored = queue.filter(item => item.status === "error");
    return {
      running,
      queued,
      completed,
      errored
    };
  }, [queue]);
  const debugRequest = debugItem?.debug?.request || "";
  const debugResponse = debugItem?.debug?.response || "";
  return <div>
      {/* Stats header */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Activity</h2>
          <div className="ap-header-actions">
            {queue.length > 0 && <button onClick={onCancelAll} className="illuminator-button illuminator-button-secondary ap-header-btn">
                Cancel All
              </button>}
            {stats.completed > 0 && <button onClick={onClearCompleted} className="illuminator-button illuminator-button-secondary ap-header-btn">
                Clear Completed
              </button>}
          </div>
        </div>

        {/* Stats */}
        <div className="ap-stats-row">
          <div>
            <span className="ap-stat-value">{stats.queued}</span>
            <span className="ap-stat-label">queued</span>
          </div>
          <div>
            <span className="ap-stat-value ap-stat-value-running">{stats.running}</span>
            <span className="ap-stat-label">running</span>
          </div>
          <div>
            <span className="ap-stat-value ap-stat-value-completed">{stats.completed}</span>
            <span className="ap-stat-label">completed</span>
          </div>
          <div>
            <span className="ap-stat-value ap-stat-value-errors">{stats.errored}</span>
            <span className="ap-stat-label">errors</span>
          </div>
        </div>
      </div>

      {/* Currently Running */}
      {running.length > 0 && <div className="illuminator-card ap-section-card">
          <div className="ap-section-header">Currently Running</div>
          {running.map(item => <TaskRow key={item.id} item={item} onCancel={onCancel} onViewDebug={setDebugItem} />)}
        </div>}

      {/* Queued */}
      {queued.length > 0 && <div className="illuminator-card ap-section-card">
          <div className="ap-section-header">Queued ({queued.length})</div>
          {queued.slice(0, 10).map(item => <TaskRow key={item.id} item={item} onCancel={onCancel} onViewDebug={setDebugItem} />)}
          {queued.length > 10 && <div className="ap-more-indicator">... and {queued.length - 10} more</div>}
        </div>}

      {/* Errors */}
      {errored.length > 0 && <div className="illuminator-card ap-section-card">
          <div className="ap-section-header ap-section-header-errors">
            Errors ({errored.length})
          </div>
          {errored.map(item => {
        const activityError = formatActivityError(item);
        return <div key={item.id}>
                <TaskRow item={item} onRetry={onRetry} onViewDebug={setDebugItem} />
                {activityError && <ErrorMessage message={activityError} className="ap-error-detail" />}
              </div>;
      })}
        </div>}

      {/* Recent Completed */}
      {completed.length > 0 && <div className="illuminator-card ap-section-card">
          <div className="ap-section-header">Recent Completed</div>
          {completed.map(item => <TaskRow key={item.id} item={item} onViewDebug={setDebugItem} />)}
        </div>}

      {/* Empty state */}
      {queue.length === 0 && <div className="illuminator-card">
          <div className="ap-empty-state">
            No activity yet. Queue some enrichment tasks from the Entities tab.
          </div>
        </div>}

      {debugItem && <div className="illuminator-modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick} role="button" tabIndex={0} onKeyDown={e => {
      if (e.key === "Enter" || e.key === " ") handleOverlayClick(e);
    }}>
          <div className="illuminator-modal ap-debug-modal">
            <div className="illuminator-modal-header">
              <h3>Network Debug</h3>
              <button onClick={() => setDebugItem(null)} className="illuminator-modal-close">
                &times;
              </button>
            </div>
            <div className="illuminator-modal-body ap-debug-body">
              <div className="ap-debug-entity-info">
                {debugItem.entityName}
                {(() => {
              if (debugItem.type === "description") return " · Description";
              if (debugItem.type === "image") return " · Image";
              return " · Chronicle";
            })()}
              </div>
              <div>
                <label htmlFor="request-raw" className="ap-debug-label">Request (raw)</label>
                <textarea id="request-raw" className="illuminator-textarea ap-debug-request-textarea" value={debugRequest} readOnly />
              </div>
              <div>
                <label htmlFor="response-raw" className="ap-debug-label">Response (raw)</label>
                <textarea id="response-raw" className="illuminator-textarea ap-debug-response-textarea" value={debugResponse} readOnly />
              </div>
            </div>
          </div>
        </div>}
    </div>;
}
ActivityPanel.propTypes = {
  queue: PropTypes.array,
  stats: PropTypes.object,
  onCancel: PropTypes.func,
  onRetry: PropTypes.func,
  onCancelAll: PropTypes.func,
  onClearCompleted: PropTypes.func
};
