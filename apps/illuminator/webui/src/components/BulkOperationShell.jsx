/**
 * BulkOperationShell - Shared wrapper for bulk operation modals
 *
 * Handles the identical structural parts of all bulk modals:
 * - Overlay + dialog with dynamic width
 * - Header with title, minimize button, status text
 * - Floating pill lifecycle (minimize, update, cleanup)
 * - Footer button logic (confirm/cancel/close)
 * - Phase detection (confirming → running → terminal)
 *
 * Each bulk modal provides:
 * - pillId, title, tabId for pill identity
 * - confirmLabel for the confirm button text
 * - statusText for the header status display
 * - children for phase-specific body content
 */

import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { useFloatingPillStore } from "../lib/db/floatingPillStore";
import { ErrorMessage } from "@the-canonry/shared-components";
import "./BulkOperationShell.css";
const STATUS_COLORS = {
  running: "#f59e0b",
  complete: "#10b981",
  failed: "#ef4444",
  cancelled: "#f59e0b"
};
function getStatusColor(status) {
  return STATUS_COLORS[status] || "#6b7280";
}
export default function BulkOperationShell({
  pillId,
  title,
  tabId = "chronicle",
  progress,
  onConfirm,
  onCancel,
  onClose,
  confirmLabel,
  statusText,
  pillStatusText,
  confirmWidth = "540px",
  processWidth = "480px",
  children
}) {
  const isMinimized = useFloatingPillStore(s => s.isMinimized(pillId));
  const progressStatus = progress?.status;

  // Update pill when minimized
  useEffect(() => {
    if (!isMinimized || !progress) return;
    useFloatingPillStore.getState().updatePill(pillId, {
      statusText: pillStatusText || progressStatus,
      statusColor: getStatusColor(progressStatus)
    });
  }, [isMinimized, progress, progressStatus, pillId, pillStatusText]);

  // Clean up pill when idle
  useEffect(() => {
    if (!progress || progressStatus === "idle") {
      useFloatingPillStore.getState().remove(pillId);
    }
  }, [progress, progressStatus, pillId]);
  if (!progress || progress.status === "idle") return null;
  if (isMinimized) return null;
  const isConfirming = progress.status === "confirming";
  const isTerminal = progress.status === "complete" || progress.status === "cancelled" || progress.status === "failed";
  const handleMinimize = () => {
    useFloatingPillStore.getState().minimize({
      id: pillId,
      label: title,
      statusText: pillStatusText || progressStatus,
      statusColor: getStatusColor(progressStatus),
      tabId
    });
  };
  return <div className="bulk-overlay">
      <div className="bulk-dialog" style={{
      "--bulk-dialog-width": isConfirming ? confirmWidth : processWidth
    }}>
        {/* Header */}
        <div className="bulk-header">
          <div className="bulk-header-row">
            <h2 className="bulk-title">{title}</h2>
            <div className="bulk-header-actions">
              {!isConfirming && <button onClick={handleMinimize} className="illuminator-button bulk-minimize-btn" title="Minimize to pill">
                  ―
                </button>}
              <span className={`bulk-status bulk-status-${progress.status}`}>
                {statusText}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className={`bulk-body ${isConfirming ? "bulk-body-confirming" : "bulk-body-processing"}`}>
          {children}
        </div>

        {/* Footer */}
        <div className="bulk-footer">
          {isConfirming && <>
              <button onClick={onCancel} className="illuminator-button bulk-footer-btn">
                Cancel
              </button>
              <button onClick={onConfirm} className="illuminator-button illuminator-button-primary bulk-footer-btn">
                {confirmLabel}
              </button>
            </>}
          {!isConfirming && !isTerminal && <button onClick={onCancel} className="illuminator-button bulk-footer-btn">
              Cancel
            </button>}
          {isTerminal && <button onClick={onClose} className="illuminator-button bulk-footer-btn">
              Close
            </button>}
        </div>
      </div>
    </div>;
}

/**
 * Shared progress bar component for bulk operations
 */
export function BulkProgressBar({
  processed,
  total,
  status
}) {
  const pct = total > 0 ? Math.round(processed / total * 100) : 0;
  let fillClass = "bulk-progress-fill-ok";
  if (status === "failed") fillClass = "bulk-progress-fill-failed";else if (status === "cancelled") fillClass = "bulk-progress-fill-cancelled";
  return <div className="bulk-progress-section">
      <div className="bulk-progress-header">
        <span className="bulk-progress-label">
          {Math.min(processed + 1, total)} / {total}
        </span>
        <span className="bulk-progress-pct">{pct}%</span>
      </div>
      <div className="bulk-progress-track">
        <div className={`bulk-progress-fill ${fillClass}`} style={{
        "--bulk-progress-width": `${pct}%`
      }} />
      </div>
    </div>;
}

/**
 * Shared terminal message component for bulk operations
 */
export function BulkTerminalMessage({
  status,
  children
}) {
  return <div className={`bulk-terminal-msg bulk-terminal-msg-${status}`}>
      {children}
    </div>;
}

/**
 * Shared failed items list component for bulk operations
 */
export function BulkFailedList({
  items,
  labelKey = "title",
  errorKey = "error"
}) {
  if (!items || items.length === 0) return null;
  return <div className="bulk-issue-section">
      <div className="bulk-issue-label">Failed ({items.length})</div>
      <div className="bulk-issue-list">
        {items.map((item, i) => <ErrorMessage
            key={item.id || item.chronicleId || item.entityId || i}
            title={item[labelKey]}
            message={item[errorKey]}
            className="bulk-failed-item"
          />)}
      </div>
    </div>;
}

/**
 * Shared cost display for bulk operations
 */
export function BulkCost({
  cost
}) {
  if (!cost || cost <= 0) return null;
  return <div className="bulk-cost">Cost: ${cost.toFixed(4)}</div>;
}
BulkOperationShell.propTypes = {
  pillId: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  tabId: PropTypes.string,
  progress: PropTypes.object,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  confirmLabel: PropTypes.string.isRequired,
  statusText: PropTypes.string,
  pillStatusText: PropTypes.string,
  confirmWidth: PropTypes.string,
  processWidth: PropTypes.string,
  children: PropTypes.node
};
BulkProgressBar.propTypes = {
  processed: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  status: PropTypes.string
};
BulkTerminalMessage.propTypes = {
  status: PropTypes.string.isRequired,
  children: PropTypes.node
};
BulkFailedList.propTypes = {
  items: PropTypes.array,
  labelKey: PropTypes.string,
  errorKey: PropTypes.string
};
BulkCost.propTypes = {
  cost: PropTypes.number
};
