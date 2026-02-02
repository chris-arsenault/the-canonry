/**
 * ProgressPanel - Track enrichment worker progress
 *
 * Shows:
 * - Overall progress bar
 * - Current task being processed
 * - Logs of completed tasks
 * - Pause/Resume/Abort controls
 */

import { useMemo } from 'react';

export default function ProgressPanel({
  status,
  progress,
  tasks,
  onPause,
  onResume,
  onAbort,
  onRunAll,
  hasRequiredKeys,
}) {
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';
  const isComplete = status === 'complete';

  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === 'complete'),
    [tasks]
  );

  const errorTasks = useMemo(
    () => tasks.filter((t) => t.status === 'error'),
    [tasks]
  );

  const runningTasks = useMemo(
    () => tasks.filter((t) => t.status === 'running'),
    [tasks]
  );

  const pendingTasks = useMemo(
    () => tasks.filter((t) => t.status === 'pending'),
    [tasks]
  );

  const progressPercent =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div>
      {/* Status card */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Enrichment Progress</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {isIdle && (
              <button
                onClick={onRunAll}
                className="illuminator-button"
                disabled={!hasRequiredKeys || pendingTasks.length === 0}
              >
                Start Enrichment
              </button>
            )}
            {isRunning && (
              <button onClick={onPause} className="illuminator-button illuminator-button-secondary">
                Pause
              </button>
            )}
            {isPaused && (
              <button onClick={onResume} className="illuminator-button">
                Resume
              </button>
            )}
            {(isRunning || isPaused) && (
              <button
                onClick={onAbort}
                style={{
                  padding: '6px 16px',
                  background: 'var(--danger)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Abort
              </button>
            )}
          </div>
        </div>

        {!hasRequiredKeys && isIdle && (
          <div
            style={{
              padding: '12px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '12px',
              color: 'var(--warning)',
            }}
          >
            Set API keys in the sidebar to start enrichment
          </div>
        )}

        {/* Progress bar */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '8px',
              fontSize: '12px',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>
              {progress.completed} / {progress.total} tasks
            </span>
            <span style={{ color: 'var(--text-muted)' }}>{progressPercent}%</span>
          </div>
          <div className="illuminator-progress">
            <div
              className="illuminator-progress-bar"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Current task */}
        {runningTasks.length > 0 && (
          <div
            style={{
              padding: '12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Currently processing:
            </div>
            {runningTasks.map((task) => (
              <div key={task.id} style={{ fontSize: '13px', color: 'var(--text-color)' }}>
                {task.entityName} - {task.type}
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
          }}
        >
          <div
            style={{
              padding: '12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-color)' }}>
              {completedTasks.length}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--success)' }}>Completed</div>
          </div>
          <div
            style={{
              padding: '12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-color)' }}>
              {runningTasks.length}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--arctic-ice)' }}>Running</div>
          </div>
          <div
            style={{
              padding: '12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-color)' }}>
              {pendingTasks.length}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pending</div>
          </div>
          <div
            style={{
              padding: '12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 600, color: errorTasks.length > 0 ? 'var(--danger)' : 'var(--text-color)' }}>
              {errorTasks.length}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--danger)' }}>Errors</div>
          </div>
        </div>
      </div>

      {/* Error log */}
      {errorTasks.length > 0 && (
        <div className="illuminator-card">
          <div className="illuminator-card-header">
            <h2 className="illuminator-card-title" style={{ color: 'var(--danger)' }}>
              Errors ({errorTasks.length})
            </h2>
          </div>
          <div style={{ maxHeight: '200px', overflow: 'auto' }}>
            {errorTasks.map((task) => (
              <div
                key={task.id}
                style={{
                  padding: '8px 12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  fontSize: '12px',
                }}
              >
                <div style={{ fontWeight: 500, color: 'var(--text-color)' }}>
                  {task.entityName} - {task.type}
                </div>
                <div style={{ color: 'var(--danger)', marginTop: '4px' }}>
                  {task.error || 'Unknown error'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completion message */}
      {isComplete && (
        <div className="illuminator-card">
          <div
            style={{
              textAlign: 'center',
              padding: '24px',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#x2728;</div>
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Enrichment Complete!
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {completedTasks.length} tasks completed
              {errorTasks.length > 0 && `, ${errorTasks.length} errors`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
