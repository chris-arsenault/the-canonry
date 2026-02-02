/**
 * ActivityPanel - Worker activity monitor
 *
 * Shows the current state of the enrichment queue:
 * - Currently running tasks
 * - Queued tasks
 * - Recent completed/errored tasks
 */

import { useMemo, useState, useRef, useCallback } from 'react';

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString();
}

function TaskRow({ item, onCancel, onRetry, onViewDebug }) {
  const duration = item.startedAt
    ? item.completedAt
      ? item.completedAt - item.startedAt
      : Date.now() - item.startedAt
    : null;

  const statusStyles = {
    queued: { color: 'var(--text-muted)' },
    running: { color: '#f59e0b' },
    complete: { color: '#10b981' },
    error: { color: '#ef4444' },
  };

  const statusIcons = {
    queued: '◷',
    running: '◐',
    complete: '✓',
    error: '✗',
  };
  const hasDebug = Boolean(item.debug && (item.debug.request || item.debug.response));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <span style={{ fontSize: '16px', ...statusStyles[item.status] }}>
        {statusIcons[item.status]}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: '13px' }}>{item.entityName}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {item.type === 'description' ? 'Description' : item.type === 'image' ? 'Image' : 'Chronicle'}
          {item.entityKind && ` · ${item.entityKind}`}
        </div>
      </div>

      {duration !== null && (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {formatDuration(duration)}
        </span>
      )}

      {item.status === 'queued' && onCancel && (
        <button
          onClick={() => onCancel(item.id)}
          className="illuminator-button-link"
          style={{ fontSize: '11px' }}
        >
          Cancel
        </button>
      )}

      {item.status === 'running' && onCancel && (
        <button
          onClick={() => onCancel(item.id)}
          className="illuminator-button-link"
          style={{ fontSize: '11px' }}
        >
          Cancel
        </button>
      )}

      {item.status === 'error' && onRetry && (
        <button
          onClick={() => onRetry(item.id)}
          className="illuminator-button-link"
          style={{ fontSize: '11px' }}
        >
          Retry
        </button>
      )}

      {hasDebug && onViewDebug && (
        <button
          onClick={() => onViewDebug(item)}
          className="illuminator-button-link"
          style={{ fontSize: '11px' }}
        >
          View Debug
        </button>
      )}
    </div>
  );
}

export default function ActivityPanel({
  queue,
  stats,
  onCancel,
  onRetry,
  onCancelAll,
  onClearCompleted,
  enrichmentTriggers,
}) {
  const [debugItem, setDebugItem] = useState(null);
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = useCallback((e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  }, []);

  const handleOverlayClick = useCallback((e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      setDebugItem(null);
    }
  }, []);

  const triggerSummary = useMemo(() => {
    if (!enrichmentTriggers || typeof enrichmentTriggers !== 'object') return null;
    const total = typeof enrichmentTriggers.total === 'number' ? enrichmentTriggers.total : null;
    const byKind = enrichmentTriggers.byKind && typeof enrichmentTriggers.byKind === 'object'
      ? enrichmentTriggers.byKind
      : null;
    const entries = byKind
      ? Object.entries(byKind).filter(([, value]) => typeof value === 'number')
      : [];
    const comment = typeof enrichmentTriggers.comment === 'string' ? enrichmentTriggers.comment : null;
    if (total === null && entries.length === 0 && !comment) return null;
    return { total, entries, comment };
  }, [enrichmentTriggers]);

  // Split queue into categories
  const { running, queued, completed, errored } = useMemo(() => {
    const running = queue.filter((item) => item.status === 'running');
    const queued = queue.filter((item) => item.status === 'queued');
    const completed = queue
      .filter((item) => item.status === 'complete')
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      .slice(0, 20);
    const errored = queue.filter((item) => item.status === 'error');

    return { running, queued, completed, errored };
  }, [queue]);
  const debugRequest = debugItem?.debug?.request || '';
  const debugResponse = debugItem?.debug?.response || '';

  return (
    <div>
      {/* Stats header */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Activity</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {queue.length > 0 && (
              <button
                onClick={onCancelAll}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Cancel All
              </button>
            )}
            {stats.completed > 0 && (
              <button
                onClick={onClearCompleted}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Clear Completed
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: 'flex',
            gap: '24px',
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
          }}
        >
          <div>
            <span style={{ fontSize: '20px', fontWeight: 600 }}>{stats.queued}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
              queued
            </span>
          </div>
          <div>
            <span style={{ fontSize: '20px', fontWeight: 600, color: '#f59e0b' }}>
              {stats.running}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
              running
            </span>
          </div>
          <div>
            <span style={{ fontSize: '20px', fontWeight: 600, color: '#10b981' }}>
              {stats.completed}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
              completed
            </span>
          </div>
          <div>
            <span style={{ fontSize: '20px', fontWeight: 600, color: '#ef4444' }}>
              {stats.errored}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
              errors
            </span>
          </div>
        </div>
      </div>

      {triggerSummary && (
        <div className="illuminator-card">
          <div className="illuminator-card-header">
            <h2 className="illuminator-card-title">Enrichment Triggers</h2>
            <span className="illuminator-card-subtitle">Lore Weave signals</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            {triggerSummary.comment || 'Detected enrichment triggers during simulation.'}
          </div>
          {triggerSummary.total !== null && (
            <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '10px' }}>
              {triggerSummary.total} total
            </div>
          )}
          {triggerSummary.entries.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {triggerSummary.entries.map(([key, value]) => (
                <span
                  key={key}
                  style={{
                    padding: '4px 8px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {key}: {value}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Currently Running */}
      {running.length > 0 && (
        <div className="illuminator-card" style={{ padding: 0 }}>
          <div
            style={{
              padding: '12px',
              borderBottom: '1px solid var(--border-color)',
              fontWeight: 500,
              fontSize: '13px',
              background: 'var(--bg-tertiary)',
            }}
          >
            Currently Running
          </div>
          {running.map((item) => (
            <TaskRow key={item.id} item={item} onCancel={onCancel} onViewDebug={setDebugItem} />
          ))}
        </div>
      )}

      {/* Queued */}
      {queued.length > 0 && (
        <div className="illuminator-card" style={{ padding: 0 }}>
          <div
            style={{
              padding: '12px',
              borderBottom: '1px solid var(--border-color)',
              fontWeight: 500,
              fontSize: '13px',
              background: 'var(--bg-tertiary)',
            }}
          >
            Queued ({queued.length})
          </div>
          {queued.slice(0, 10).map((item) => (
            <TaskRow key={item.id} item={item} onCancel={onCancel} onViewDebug={setDebugItem} />
          ))}
          {queued.length > 10 && (
            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              ... and {queued.length - 10} more
            </div>
          )}
        </div>
      )}

      {/* Errors */}
      {errored.length > 0 && (
        <div className="illuminator-card" style={{ padding: 0 }}>
          <div
            style={{
              padding: '12px',
              borderBottom: '1px solid var(--border-color)',
              fontWeight: 500,
              fontSize: '13px',
              background: 'var(--bg-tertiary)',
              color: '#ef4444',
            }}
          >
            Errors ({errored.length})
          </div>
          {errored.map((item) => (
            <div key={item.id}>
              <TaskRow item={item} onRetry={onRetry} onViewDebug={setDebugItem} />
              {item.error && (
                <div
                  style={{
                    padding: '8px 12px 12px 40px',
                    fontSize: '11px',
                    color: '#ef4444',
                    background: 'rgba(239, 68, 68, 0.1)',
                  }}
                >
                  {item.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recent Completed */}
      {completed.length > 0 && (
        <div className="illuminator-card" style={{ padding: 0 }}>
          <div
            style={{
              padding: '12px',
              borderBottom: '1px solid var(--border-color)',
              fontWeight: 500,
              fontSize: '13px',
              background: 'var(--bg-tertiary)',
            }}
          >
            Recent Completed
          </div>
          {completed.map((item) => (
            <TaskRow key={item.id} item={item} onViewDebug={setDebugItem} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {queue.length === 0 && (
        <div className="illuminator-card">
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No activity yet. Queue some enrichment tasks from the Entities tab.
          </div>
        </div>
      )}

      {debugItem && (
        <div className="illuminator-modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
          <div
            className="illuminator-modal"
            style={{ maxWidth: '900px', width: '90%', maxHeight: '85vh' }}
          >
            <div className="illuminator-modal-header">
              <h3>Network Debug</h3>
              <button onClick={() => setDebugItem(null)} className="illuminator-modal-close">&times;</button>
            </div>
            <div className="illuminator-modal-body" style={{ display: 'grid', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {debugItem.entityName}
                {debugItem.type === 'description'
                  ? ' · Description'
                  : debugItem.type === 'image'
                    ? ' · Image'
                    : ' · Chronicle'}
              </div>
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  Request (raw)
                </label>
                <textarea
                  className="illuminator-textarea"
                  value={debugRequest}
                  readOnly
                  style={{ minHeight: '140px' }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  Response (raw)
                </label>
                <textarea
                  className="illuminator-textarea"
                  value={debugResponse}
                  readOnly
                  style={{ minHeight: '160px' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
