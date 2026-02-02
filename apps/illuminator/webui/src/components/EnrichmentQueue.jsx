/**
 * EnrichmentQueue - Task list with entity-level controls
 *
 * Displays enrichment tasks grouped by entity with:
 * - Filter by entity kind, prominence, status
 * - Individual task controls (Run, Skip)
 * - Multi-select for batch operations
 * - Run Selected / Run All buttons
 */

import { useState, useMemo } from 'react';
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceLabelFromScale,
  prominenceThresholdFromScale,
} from '@canonry/world-schema';

const PROMINENCE_LEVELS = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

function TaskStatusBadge({ status }) {
  const statusClass = `illuminator-status-${status}`;
  const labels = {
    pending: 'Pending',
    queued: 'Queued',
    running: 'Running',
    complete: 'Complete',
    error: 'Error',
    skipped: 'Skipped',
  };

  return (
    <span className={`illuminator-status-badge ${statusClass}`}>
      {labels[status] || status}
    </span>
  );
}

function EntityTaskGroup({
  entityId,
  entityName,
  entityKind,
  entitySubtype,
  prominence,
  tasks,
  selectedTasks,
  onToggleTask,
  onRunTask,
  expanded,
  onToggleExpand,
  prominenceScale,
}) {
  const completedCount = tasks.filter((t) => t.status === 'complete').length;
  const hasError = tasks.some((t) => t.status === 'error');

  return (
    <div
      style={{
        marginBottom: '8px',
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggleExpand}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          background: 'var(--bg-tertiary)',
          border: 'none',
          color: 'var(--text-color)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {expanded ? '▼' : '▶'}
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ fontWeight: 500 }}>{entityName}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
            {entityKind}/{entitySubtype} - {prominenceLabelFromScale(prominence, prominenceScale)}
          </span>
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {completedCount}/{tasks.length}
          {hasError && <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>!</span>}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)' }}>
          {tasks.map((task) => (
            <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 0',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <input
                type="checkbox"
                checked={selectedTasks.has(task.id)}
                onChange={() => onToggleTask(task.id)}
                className="illuminator-checkbox"
                disabled={task.status === 'running'}
              />
              <span style={{ flex: 1, fontSize: '12px' }}>
                {task.type === 'description' && 'Description'}
                {task.type === 'image' && 'Image'}
                {task.type === 'entityChronicle' && 'Chronicle'}
              </span>
              <TaskStatusBadge status={task.status} />
              {(task.status === 'queued' || task.status === 'error') && (
                <button
                  onClick={() => onRunTask(task.id)}
                  style={{
                    padding: '2px 8px',
                    background: 'var(--accent-color)',
                    border: 'none',
                    borderRadius: '3px',
                    color: 'white',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  {task.status === 'error' ? 'Retry' : 'Run'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EnrichmentQueue({
  tasks,
  onRunTasks,
  onRunAll,
  worldSchema,
  hasRequiredKeys,
  prominenceScale,
}) {
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [expandedEntities, setExpandedEntities] = useState(new Set());
  const [filterKind, setFilterKind] = useState('all');
  const [filterProminence, setFilterProminence] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const effectiveProminenceScale = useMemo(() => {
    if (prominenceScale) return prominenceScale;
    const values = tasks
      .map((task) => task.prominence)
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
    return buildProminenceScale(values, { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
  }, [prominenceScale, tasks]);

  // Group tasks by entity
  const groupedTasks = useMemo(() => {
    const groups = new Map();

    for (const task of tasks) {
      if (!groups.has(task.entityId)) {
        groups.set(task.entityId, {
          entityId: task.entityId,
          entityName: task.entityName,
          entityKind: task.entityKind,
          entitySubtype: task.entitySubtype,
          prominence: task.prominence,
          tasks: [],
        });
      }
      groups.get(task.entityId).tasks.push(task);
    }

    return Array.from(groups.values());
  }, [tasks]);

  // Apply filters
  const filteredGroups = useMemo(() => {
    return groupedTasks.filter((group) => {
      if (filterKind !== 'all' && group.entityKind !== filterKind) return false;
      if (filterProminence !== 'all') {
        // Filter to entities with at least the selected prominence level
        const entityProminence = typeof group.prominence === 'number' ? group.prominence : 0;
        const filterThreshold = prominenceThresholdFromScale(filterProminence, effectiveProminenceScale);
        if (entityProminence < filterThreshold) return false;
      }
      if (filterStatus !== 'all') {
        const hasMatchingTask = group.tasks.some((t) => t.status === filterStatus);
        if (!hasMatchingTask) return false;
      }
      return true;
    });
  }, [groupedTasks, filterKind, filterProminence, filterStatus, effectiveProminenceScale]);

  // Get unique entity kinds
  const entityKinds = useMemo(() => {
    const kinds = new Set(tasks.map((t) => t.entityKind));
    return Array.from(kinds);
  }, [tasks]);

  const toggleTask = (taskId) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const toggleEntity = (entityId) => {
    setExpandedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  };

  const runSelected = () => {
    onRunTasks(Array.from(selectedTasks));
  };

  const totalPending = tasks.filter((t) => t.status === 'pending').length;
  const totalError = tasks.filter((t) => t.status === 'error').length;

  return (
    <div>
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Enrichment Queue</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onRunAll}
              className="illuminator-button"
              disabled={!hasRequiredKeys || totalPending === 0}
            >
              Run All ({totalPending})
            </button>
          </div>
        </div>

        {!hasRequiredKeys && (
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
            Set API keys in the sidebar to run enrichment tasks
          </div>
        )}

        {/* Filters */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px',
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
          }}
        >
          <div>
            <label
              style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}
            >
              Entity Kind
            </label>
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              className="illuminator-select"
              style={{ width: '120px' }}
            >
              <option value="all">All</option>
              {entityKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}
            >
              Prominence
            </label>
            <select
              value={filterProminence}
              onChange={(e) => setFilterProminence(e.target.value)}
              className="illuminator-select"
              style={{ width: '120px' }}
            >
              <option value="all">All</option>
              {PROMINENCE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}+
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}
            >
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="illuminator-select"
              style={{ width: '120px' }}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="complete">Complete</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {filteredGroups.length} entities, {tasks.length} tasks
            </span>
          </div>
        </div>

        {/* Task groups */}
        <div>
          {filteredGroups.map((group) => (
            <EntityTaskGroup
              key={group.entityId}
              {...group}
              selectedTasks={selectedTasks}
              onToggleTask={toggleTask}
              onRunTask={(taskId) => onRunTasks([taskId])}
              expanded={expandedEntities.has(group.entityId)}
              onToggleExpand={() => toggleEntity(group.entityId)}
              prominenceScale={effectiveProminenceScale}
            />
          ))}

          {filteredGroups.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No tasks match current filters
            </div>
          )}
        </div>
      </div>

      {/* Selection actions */}
      {selectedTasks.size > 0 && (
        <div
          style={{
            position: 'sticky',
            bottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--accent-color)',
            borderRadius: '6px',
          }}
        >
          <span style={{ fontSize: '13px' }}>
            {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setSelectedTasks(new Set())}
              className="illuminator-button illuminator-button-secondary"
            >
              Clear
            </button>
            <button
              onClick={runSelected}
              className="illuminator-button"
              disabled={!hasRequiredKeys}
            >
              Run Selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
