/**
 * EraCard - Expandable card for editing an era
 */

import React, { useState, useCallback, useMemo } from 'react';
import { createNewRule } from '../generators/applicability/createNewRule';
import {
  BasicInfoSection,
  TransitionsGrid,
} from './sections';

/**
 * @param {Object} props
 * @param {Object} props.era - The era object
 * @param {boolean} props.expanded - Whether the card is expanded
 * @param {Function} props.onToggle - Called to toggle expansion
 * @param {Function} props.onChange - Called when era changes
 * @param {Function} props.onDelete - Called to delete the era
 * @param {Array} props.pressures - Available pressures
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.allEras - All eras for nextEra selection
 */
export function EraCard({
  era,
  expanded,
  onToggle,
  onChange,
  onDelete,
  pressures,
  schema,
  allEras,
}) {
  const [hovering, setHovering] = useState(false);

  // Field change handler
  const handleFieldChange = useCallback((field, value) => {
    onChange({ ...era, [field]: value });
  }, [era, onChange]);

  // Entry condition handlers
  const handleAddEntryCondition = useCallback(() => {
    const newRule = createNewRule('pressure', pressures);
    onChange({
      ...era,
      entryConditions: [...(era.entryConditions || []), newRule],
    });
  }, [era, onChange, pressures]);

  const handleUpdateEntryCondition = useCallback((index, updated) => {
    const newConditions = [...(era.entryConditions || [])];
    newConditions[index] = updated;
    onChange({ ...era, entryConditions: newConditions });
  }, [era, onChange]);

  const handleRemoveEntryCondition = useCallback((index) => {
    onChange({
      ...era,
      entryConditions: (era.entryConditions || []).filter((_, i) => i !== index),
    });
  }, [era, onChange]);

  // Exit condition handlers
  const handleAddExitCondition = useCallback(() => {
    const newRule = createNewRule('growth_phases_complete', pressures);
    onChange({
      ...era,
      exitConditions: [...(era.exitConditions || []), newRule],
    });
  }, [era, onChange, pressures]);

  const handleUpdateExitCondition = useCallback((index, updated) => {
    const newConditions = [...(era.exitConditions || [])];
    newConditions[index] = updated;
    onChange({ ...era, exitConditions: newConditions });
  }, [era, onChange]);

  const handleRemoveExitCondition = useCallback((index) => {
    onChange({
      ...era,
      exitConditions: (era.exitConditions || []).filter((_, i) => i !== index),
    });
  }, [era, onChange]);

  const updateEffectMutations = useCallback((key, nextMutations) => {
    onChange({
      ...era,
      [key]: { ...(era[key] || {}), mutations: nextMutations },
    });
  }, [era, onChange]);

  // Entry effect handlers
  const handleAddEntryEffect = useCallback((pressureId) => {
    const existing = era.entryEffects?.mutations || [];
    const hasExisting = existing.some((m) => m.type === 'modify_pressure' && m.pressureId === pressureId);
    if (hasExisting) return;
    updateEffectMutations('entryEffects', [
      ...existing,
      { type: 'modify_pressure', pressureId, delta: 10 },
    ]);
  }, [era, updateEffectMutations]);

  const handleUpdateEntryEffect = useCallback((pressureId, value) => {
    const existing = era.entryEffects?.mutations || [];
    const next = existing.map((mutation) => (
      mutation.type === 'modify_pressure' && mutation.pressureId === pressureId
        ? { ...mutation, delta: value }
        : mutation
    ));
    updateEffectMutations('entryEffects', next);
  }, [era, updateEffectMutations]);

  const handleRemoveEntryEffect = useCallback((pressureId) => {
    const existing = era.entryEffects?.mutations || [];
    const next = existing.filter((mutation) => !(
      mutation.type === 'modify_pressure' && mutation.pressureId === pressureId
    ));
    updateEffectMutations('entryEffects', next);
  }, [era, updateEffectMutations]);

  // Exit effect handlers
  const handleAddExitEffect = useCallback((pressureId) => {
    const existing = era.exitEffects?.mutations || [];
    const hasExisting = existing.some((m) => m.type === 'modify_pressure' && m.pressureId === pressureId);
    if (hasExisting) return;
    updateEffectMutations('exitEffects', [
      ...existing,
      { type: 'modify_pressure', pressureId, delta: 10 },
    ]);
  }, [era, updateEffectMutations]);

  const handleUpdateExitEffect = useCallback((pressureId, value) => {
    const existing = era.exitEffects?.mutations || [];
    const next = existing.map((mutation) => (
      mutation.type === 'modify_pressure' && mutation.pressureId === pressureId
        ? { ...mutation, delta: value }
        : mutation
    ));
    updateEffectMutations('exitEffects', next);
  }, [era, updateEffectMutations]);

  const handleRemoveExitEffect = useCallback((pressureId) => {
    const existing = era.exitEffects?.mutations || [];
    const next = existing.filter((mutation) => !(
      mutation.type === 'modify_pressure' && mutation.pressureId === pressureId
    ));
    updateEffectMutations('exitEffects', next);
  }, [era, updateEffectMutations]);

  const entryMutations = useMemo(
    () => (era.entryEffects?.mutations || []).filter((m) => m.type === 'modify_pressure'),
    [era.entryEffects]
  );
  const exitMutations = useMemo(
    () => (era.exitEffects?.mutations || []).filter((m) => m.type === 'modify_pressure'),
    [era.exitEffects]
  );

  const availablePressuresForEntry = useMemo(() => {
    const currentIds = new Set(entryMutations.map((mutation) => mutation.pressureId));
    return (pressures || []).filter(p => !currentIds.has(p.id)).map(p => ({ id: p.id, name: p.name || p.id }));
  }, [pressures, entryMutations]);

  const availablePressuresForExit = useMemo(() => {
    const currentIds = new Set(exitMutations.map((mutation) => mutation.pressureId));
    return (pressures || []).filter(p => !currentIds.has(p.id)).map(p => ({ id: p.id, name: p.name || p.id }));
  }, [pressures, exitMutations]);

  // Counts
  const entryConditions = era.entryConditions || [];
  const exitConditions = era.exitConditions || [];
  const entryPressureChanges = entryMutations.map((mutation) => [mutation.pressureId, mutation.delta]);
  const exitPressureChanges = exitMutations.map((mutation) => [mutation.pressureId, mutation.delta]);

  return (
    <div className="expandable-card">
      {/* Header */}
      <div
        className="expandable-card-header"
        onClick={onToggle}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="expandable-card-left">
          <div className="expandable-card-title">
            <span className="expandable-card-name">{era.name}</span>
            <span className="expandable-card-id">{era.id}</span>
          </div>
          <div className="expandable-card-desc">{era.summary}</div>
        </div>
        <div className="expandable-card-stats">
          <div className="stat">
            <span className="stat-label">Entry</span>
            <span className="stat-value">{entryConditions.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Exit</span>
            <span className="stat-value">{exitConditions.length}</span>
          </div>
          <span className={`expand-icon ${expanded ? 'open' : ''}`}>▼</span>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="expandable-card-content">
          <BasicInfoSection era={era} onFieldChange={handleFieldChange} />

          {/* Two-column transitions grid: Entry (left) | Exit (right) */}
          <TransitionsGrid
            entryConditions={entryConditions}
            exitConditions={exitConditions}
            entryPressureChanges={entryPressureChanges}
            exitPressureChanges={exitPressureChanges}
            onUpdateEntryCondition={handleUpdateEntryCondition}
            onRemoveEntryCondition={handleRemoveEntryCondition}
            onAddEntryCondition={handleAddEntryCondition}
            onUpdateExitCondition={handleUpdateExitCondition}
            onRemoveExitCondition={handleRemoveExitCondition}
            onAddExitCondition={handleAddExitCondition}
            onUpdateEntryEffect={handleUpdateEntryEffect}
            onRemoveEntryEffect={handleRemoveEntryEffect}
            onAddEntryEffect={handleAddEntryEffect}
            onUpdateExitEffect={handleUpdateExitEffect}
            onRemoveExitEffect={handleRemoveExitEffect}
            onAddExitEffect={handleAddExitEffect}
            availablePressuresForEntry={availablePressuresForEntry}
            availablePressuresForExit={availablePressuresForExit}
            pressures={pressures}
            schema={schema}
            eras={allEras}
          />

          {/* Delete button */}
          <div className="card-footer">
            <button className="btn btn-danger" onClick={onDelete}>
              Delete Era
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
