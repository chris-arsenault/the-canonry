/**
 * LogStream - Collapsible log viewer with filtering
 */

import React, { useState, useMemo } from 'react';

export default function LogStream({ logs, onClear }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState('all');

  const filteredLogs = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter(log => log.level === filter);
  }, [logs, filter]);

  const logCounts = useMemo(() => ({
    all: logs.length,
    info: logs.filter(l => l.level === 'info').length,
    warn: logs.filter(l => l.level === 'warn').length,
    error: logs.filter(l => l.level === 'error').length,
  }), [logs]);

  return (
    <div className="lw-log-panel">
      <div className="lw-log-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--lw-text-primary)' }}>
            {isExpanded ? '▼' : '▶'} Log Stream
          </span>
          <span style={{ fontSize: '12px', color: 'var(--lw-text-muted)' }}>
            {logs.length} entries
          </span>
          {logCounts.error > 0 && (
            <span className="lw-badge lw-badge-error">
              {logCounts.error} errors
            </span>
          )}
          {logCounts.warn > 0 && (
            <span className="lw-badge lw-badge-warn">
              {logCounts.warn} warnings
            </span>
          )}
        </div>
        {logs.length > 0 && (
          <button
            className="lw-btn-copy"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
          >
            Clear
          </button>
        )}
      </div>
      {isExpanded && logs.length > 0 && (
        <>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--lw-border-color)' }}>
            <div className="lw-filter-tabs">
              {['all', 'info', 'warn', 'error'].map(f => (
                <button
                  key={f}
                  className={`lw-filter-tab ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f} ({logCounts[f] || 0})
                </button>
              ))}
            </div>
          </div>
          <div className="lw-log-content">
            {filteredLogs.slice(-100).map((log, i) => (
              <div key={i} className={`lw-log-entry ${log.level}`}>
                [{log.level.toUpperCase().padEnd(5)}] {log.message}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
