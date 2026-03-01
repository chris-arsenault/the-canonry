/**
 * ProgressPanel - Track enrichment worker progress
 *
 * Shows:
 * - Overall progress bar
 * - Current task being processed
 * - Logs of completed tasks
 * - Pause/Resume/Abort controls
 */

import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { ErrorMessage } from "@the-canonry/shared-components";
import "./ProgressPanel.css";
export default function ProgressPanel({
  status,
  progress,
  tasks,
  onPause,
  onResume,
  onAbort,
  onRunAll,
  hasRequiredKeys
}) {
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isIdle = status === "idle";
  const isComplete = status === "complete";
  const completedTasks = useMemo(() => tasks.filter(t => t.status === "complete"), [tasks]);
  const errorTasks = useMemo(() => tasks.filter(t => t.status === "error"), [tasks]);
  const runningTasks = useMemo(() => tasks.filter(t => t.status === "running"), [tasks]);
  const pendingTasks = useMemo(() => tasks.filter(t => t.status === "pending"), [tasks]);
  const progressPercent = progress.total > 0 ? Math.round(progress.completed / progress.total * 100) : 0;
  return <div>
      {/* Status card */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Enrichment Progress</h2>
          <div className="pp-button-group">
            {isIdle && <button onClick={onRunAll} className="illuminator-button" disabled={!hasRequiredKeys || pendingTasks.length === 0}>
                Start Enrichment
              </button>}
            {isRunning && <button onClick={onPause} className="illuminator-button illuminator-button-secondary">
                Pause
              </button>}
            {isPaused && <button onClick={onResume} className="illuminator-button">
                Resume
              </button>}
            {(isRunning || isPaused) && <button onClick={onAbort} className="pp-abort-btn">
                Abort
              </button>}
          </div>
        </div>

        {!hasRequiredKeys && isIdle && <div className="ilu-warning-banner pp-key-warning">Set API keys in the sidebar to start enrichment</div>}

        {/* Progress bar */}
        <div className="pp-progress-section">
          <div className="pp-progress-header">
            <span className="pp-progress-completed">
              {progress.completed} / {progress.total} tasks
            </span>
            <span className="pp-progress-percent">{progressPercent}%</span>
          </div>
          <div className="illuminator-progress">
            <div className="illuminator-progress-bar" style={{
            "--pp-bar-width": `${progressPercent}%`
          }} />
          </div>
        </div>

        {/* Current task */}
        {runningTasks.length > 0 && <div className="pp-current-task">
            <div className="pp-current-task-label">Currently processing:</div>
            {runningTasks.map(task => <div key={task.id} className="pp-current-task-item">
                {task.entityName} - {task.type}
              </div>)}
          </div>}

        {/* Stats */}
        <div className="pp-stats-grid">
          <div className="pp-stat-card">
            <div className="pp-stat-value">{completedTasks.length}</div>
            <div className="pp-stat-label pp-stat-label-completed">Completed</div>
          </div>
          <div className="pp-stat-card">
            <div className="pp-stat-value">{runningTasks.length}</div>
            <div className="pp-stat-label pp-stat-label-running">Running</div>
          </div>
          <div className="pp-stat-card">
            <div className="pp-stat-value">{pendingTasks.length}</div>
            <div className="pp-stat-label pp-stat-label-pending">Pending</div>
          </div>
          <div className="pp-stat-card">
            <div className={`pp-stat-value${errorTasks.length > 0 ? " pp-stat-value-danger" : ""}`}>
              {errorTasks.length}
            </div>
            <div className="pp-stat-label pp-stat-label-errors">Errors</div>
          </div>
        </div>
      </div>

      {/* Error log */}
      {errorTasks.length > 0 && <div className="illuminator-card">
          <div className="illuminator-card-header">
            <h2 className="illuminator-card-title pp-error-title">Errors ({errorTasks.length})</h2>
          </div>
          <div className="pp-error-list">
            {errorTasks.map(task => <ErrorMessage
                key={task.id}
                title={`${task.entityName} - ${task.type}`}
                message={task.error || "Unknown error"}
                className="pp-error-item"
              />)}
          </div>
        </div>}

      {/* Completion message */}
      {isComplete && <div className="illuminator-card">
          <div className="pp-complete-section">
            <div className="pp-complete-icon">&#x2728;</div>
            <div className="pp-complete-title">Enrichment Complete!</div>
            <div className="pp-complete-summary">
              {completedTasks.length} tasks completed
              {errorTasks.length > 0 && `, ${errorTasks.length} errors`}
            </div>
          </div>
        </div>}
    </div>;
}
ProgressPanel.propTypes = {
  status: PropTypes.string,
  progress: PropTypes.object,
  tasks: PropTypes.array,
  onPause: PropTypes.func,
  onResume: PropTypes.func,
  onAbort: PropTypes.func,
  onRunAll: PropTypes.func,
  hasRequiredKeys: PropTypes.bool
};
