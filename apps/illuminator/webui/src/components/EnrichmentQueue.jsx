/**
 * EnrichmentQueue - Task list with entity-level controls
 *
 * Displays enrichment tasks grouped by entity with:
 * - Filter by entity kind, prominence, status
 * - Individual task controls (Run, Skip)
 * - Multi-select for batch operations
 * - Run Selected / Run All buttons
 */

import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceLabelFromScale,
  prominenceThresholdFromScale,
} from "@canonry/world-schema";
import "./EnrichmentQueue.css";

const PROMINENCE_LEVELS = ["forgotten", "marginal", "recognized", "renowned", "mythic"];

function TaskStatusBadge({ status }) {
  const statusClass = `illuminator-status-${status}`;
  const labels = {
    pending: "Pending",
    queued: "Queued",
    running: "Running",
    complete: "Complete",
    error: "Error",
    skipped: "Skipped",
  };

  return (
    <span className={`illuminator-status-badge ${statusClass}`}>{labels[status] || status}</span>
  );
}

function EntityTaskGroup({
  entityId: _entityId,
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
  const completedCount = tasks.filter((t) => t.status === "complete").length;
  const hasError = tasks.some((t) => t.status === "error");

  return (
    <div className="eq-group">
      <button onClick={onToggleExpand} className="eq-group-header">
        <span className="eq-group-arrow">{expanded ? "▼" : "▶"}</span>
        <span className="eq-group-info">
          <span className="eq-group-name">{entityName}</span>
          <span className="eq-group-meta">
            {entityKind}/{entitySubtype} - {prominenceLabelFromScale(prominence, prominenceScale)}
          </span>
        </span>
        <span className="eq-group-count">
          {completedCount}/{tasks.length}
          {hasError && <span className="eq-group-error">!</span>}
        </span>
      </button>

      {expanded && (
        <div className="eq-group-tasks">
          {tasks.map((task) => (
            <div key={task.id} className="eq-task-row">
              <input
                type="checkbox"
                checked={selectedTasks.has(task.id)}
                onChange={() => onToggleTask(task.id)}
                className="illuminator-checkbox"
                disabled={task.status === "running"}
              />
              <span className="eq-task-label">
                {task.type === "description" && "Description"}
                {task.type === "image" && "Image"}
                {task.type === "entityChronicle" && "Chronicle"}
              </span>
              <TaskStatusBadge status={task.status} />
              {(task.status === "queued" || task.status === "error") && (
                <button onClick={() => onRunTask(task.id)} className="eq-task-run-btn">
                  {task.status === "error" ? "Retry" : "Run"}
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
  worldSchema: _worldSchema,
  hasRequiredKeys,
  prominenceScale,
}) {
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [expandedEntities, setExpandedEntities] = useState(new Set());
  const [filterKind, setFilterKind] = useState("all");
  const [filterProminence, setFilterProminence] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const effectiveProminenceScale = useMemo(() => {
    if (prominenceScale) return prominenceScale;
    const values = tasks
      .map((task) => task.prominence)
      .filter((value) => typeof value === "number" && Number.isFinite(value));
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
      if (filterKind !== "all" && group.entityKind !== filterKind) return false;
      if (filterProminence !== "all") {
        // Filter to entities with at least the selected prominence level
        const entityProminence = typeof group.prominence === "number" ? group.prominence : 0;
        const filterThreshold = prominenceThresholdFromScale(
          filterProminence,
          effectiveProminenceScale
        );
        if (entityProminence < filterThreshold) return false;
      }
      if (filterStatus !== "all") {
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

  const totalPending = tasks.filter((t) => t.status === "pending").length;
  return (
    <div>
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Enrichment Queue</h2>
          <div className="eq-header-actions">
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
          <div className="eq-api-warning">Set API keys in the sidebar to run enrichment tasks</div>
        )}

        {/* Filters */}
        <div className="eq-filters">
          <div>
            <label htmlFor="entity-kind" className="eq-filter-label">Entity Kind</label>
            <select id="entity-kind"
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              className="illuminator-select eq-filter-select"
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
            <label htmlFor="prominence" className="eq-filter-label">Prominence</label>
            <select id="prominence"
              value={filterProminence}
              onChange={(e) => setFilterProminence(e.target.value)}
              className="illuminator-select eq-filter-select"
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
            <label htmlFor="status" className="eq-filter-label">Status</label>
            <select id="status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="illuminator-select eq-filter-select"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="complete">Complete</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div className="eq-filter-summary">
            <span className="eq-filter-summary-text">
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
            <div className="eq-empty">No tasks match current filters</div>
          )}
        </div>
      </div>

      {/* Selection actions */}
      {selectedTasks.size > 0 && (
        <div className="eq-selection-bar">
          <span className="eq-selection-count">
            {selectedTasks.size} task{selectedTasks.size !== 1 ? "s" : ""} selected
          </span>
          <div className="eq-selection-actions">
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

TaskStatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
};

EntityTaskGroup.propTypes = {
  entityId: PropTypes.string.isRequired,
  entityName: PropTypes.string.isRequired,
  entityKind: PropTypes.string,
  entitySubtype: PropTypes.string,
  prominence: PropTypes.number,
  tasks: PropTypes.array.isRequired,
  selectedTasks: PropTypes.object.isRequired,
  onToggleTask: PropTypes.func.isRequired,
  onRunTask: PropTypes.func.isRequired,
  expanded: PropTypes.bool,
  onToggleExpand: PropTypes.func.isRequired,
  prominenceScale: PropTypes.object,
};

EnrichmentQueue.propTypes = {
  tasks: PropTypes.array.isRequired,
  onRunTasks: PropTypes.func.isRequired,
  onRunAll: PropTypes.func.isRequired,
  worldSchema: PropTypes.object,
  hasRequiredKeys: PropTypes.bool,
  prominenceScale: PropTypes.object,
};
