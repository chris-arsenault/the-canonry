/**
 * OverviewTab - Profile ID, stats, and groups overview with drag-to-reorder
 */

import { useState, useRef } from 'react';
import MultiSelectPills from '../MultiSelectPills';

export default function OverviewTab({
  profile,
  onChange,
  onDelete,
  onDuplicate,
  onNavigateToGroup,
  generatorUsage,
  entityKinds = [],
}) {
  const matchCount = generatorUsage?.totalMatches || 0;
  const groups = profile.strategyGroups || [];

  // Drag state
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragNodeRef = useRef(null);

  const handleDragStart = (e, idx) => {
    setDraggedIdx(idx);
    dragNodeRef.current = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idx);
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
    setDraggedIdx(null);
    setDragOverIdx(null);
    dragNodeRef.current = null;
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    setDragOverIdx(idx);
  };

  const handleDragLeave = () => {
    setDragOverIdx(null);
  };

  const handleDrop = (e, dropIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIdx) return;

    const newGroups = [...groups];
    const [draggedGroup] = newGroups.splice(draggedIdx, 1);
    newGroups.splice(dropIdx, 0, draggedGroup);

    onChange({ ...profile, strategyGroups: newGroups });
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const getStrategyTypeCounts = (group) => {
    const counts = { phonotactic: 0, grammar: 0 };
    (group.strategies || []).forEach((s) => {
      if (counts[s.type] !== undefined) counts[s.type]++;
    });
    return counts;
  };

  return (
    <div className="profile-overview-tab">
      {/* Profile ID */}
      <div className="form-group">
        <label>Profile ID</label>
        <input
          value={profile.id || ''}
          onChange={(e) => onChange({ ...profile, id: e.target.value })}
          placeholder="e.g., culture_default"
        />
        <small className="text-muted">
          Unique identifier used to reference this profile in generators
        </small>
      </div>

      {/* Default Profile Toggle */}
      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={profile.isDefault || false}
            onChange={(e) => onChange({ ...profile, isDefault: e.target.checked })}
          />
          <span>Default Profile</span>
        </label>
        <small className="text-muted">
          Use this profile when no entity kind matches. Only one profile should be marked as default.
        </small>
      </div>

      {/* Entity Kinds Binding */}
      <div className="form-group">
        <label>Entity Kinds</label>
        <MultiSelectPills
          options={entityKinds}
          selected={profile.entityKinds || []}
          onChange={(kinds) => onChange({ ...profile, entityKinds: kinds })}
          allLabel="Any"
        />
        <small className="text-muted">
          Profile applies when generating names for these entity kinds. "Any" means use default profile logic.
        </small>
      </div>

      {/* Stats */}
      <div className="profile-stats">
        <div className="stat-card">
          <div className="stat-value">{groups.length}</div>
          <div className="stat-label">Strategy Groups</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {groups.reduce((sum, g) => sum + (g.strategies?.length || 0), 0)}
          </div>
          <div className="stat-label">Total Strategies</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {groups.filter((g) => g.conditions).length}
          </div>
          <div className="stat-label">Conditional</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{matchCount}</div>
          <div className="stat-label">Generator Matches</div>
        </div>
      </div>

      {/* Groups Overview */}
      <div className="groups-overview">
        <div className="groups-header">
          <h4>Strategy Groups</h4>
          <span className="text-muted text-small">Drag to reorder priority</span>
        </div>

        {groups.length === 0 ? (
          <div className="empty-groups">
            <p>No strategy groups yet. Add one using the buttons below the sidebar.</p>
          </div>
        ) : (
          <div className="groups-list">
            {groups.map((group, idx) => {
              const isConditional = !!group.conditions;
              const counts = getStrategyTypeCounts(group);
              const isDragOver = dragOverIdx === idx && draggedIdx !== idx;

              return (
                <div
                  key={idx}
                  className={`group-row ${isDragOver ? 'drag-over' : ''} ${draggedIdx === idx ? 'dragging' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, idx)}
                  onClick={() => onNavigateToGroup?.(idx)}
                >
                  <div className="drag-handle" title="Drag to reorder">
                    <span>⋮⋮</span>
                  </div>

                  <div className="group-info">
                    <span className="group-name">{group.name || `Group ${idx + 1}`}</span>
                    <span className={`group-type-badge ${isConditional ? 'conditional' : 'default'}`}>
                      {isConditional ? '🎯 Conditional' : '📦 Default'}
                    </span>
                  </div>

                  <div className="group-meta">
                    <span className="priority-badge" title="Priority">
                      P{group.priority || 0}
                    </span>
                    {counts.phonotactic > 0 && (
                      <span className="strategy-count phonotactic" title="Phonotactic strategies">
                        {counts.phonotactic}
                      </span>
                    )}
                    {counts.grammar > 0 && (
                      <span className="strategy-count grammar" title="Grammar strategies">
                        {counts.grammar}
                      </span>
                    )}
                    {counts.phonotactic === 0 && counts.grammar === 0 && (
                      <span className="no-strategies">No strategies</span>
                    )}
                  </div>

                  <div className="group-arrow">→</div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-muted text-xs mt-sm">
          Groups are evaluated by priority (highest first). First matching group's strategies are used.
        </p>
      </div>

      {/* Actions */}
      <div className="profile-actions">
        <button className="secondary" onClick={onDuplicate}>
          Duplicate Profile
        </button>
      </div>

      {/* Danger Zone */}
      <div className="danger-zone">
        <h4>Danger Zone</h4>
        <button className="danger" onClick={onDelete}>
          Delete Profile
        </button>
      </div>
    </div>
  );
}
