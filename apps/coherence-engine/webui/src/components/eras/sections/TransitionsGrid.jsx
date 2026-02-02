/**
 * TransitionsGrid - Two-column layout for entry/exit conditions and effects
 *
 * Displays Entry (left) and Exit (right) side by side for better use of screen width.
 * Each column has conditions and effects stacked vertically.
 */

import React from 'react';
import { EmptyState, AddItemButton, SearchableDropdown } from '../../shared';
import { TransitionConditionEditor, TransitionEffectItem } from '../shared';

const ADD_ITEM_STYLES = Object.freeze({
  addItemBtn: { marginTop: '8px', padding: '6px 12px', fontSize: '12px' },
});

/**
 * Compact section within the grid
 */
function MiniSection({ title, icon, count, children, isEmpty, emptyMessage }) {
  return (
    <div className="transitions-mini-section">
      <div className="transitions-mini-header">
        <span className="transitions-mini-icon">{icon}</span>
        <span className="transitions-mini-title">{title}</span>
        <span className="transitions-mini-count">{count}</span>
      </div>
      <div className="transitions-mini-content">
        {isEmpty && (
          <div className="transitions-mini-empty">{emptyMessage}</div>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {Array} props.entryConditions - Entry condition array
 * @param {Array} props.exitConditions - Exit condition array
 * @param {Array} props.entryPressureChanges - Entry effect tuples
 * @param {Array} props.exitPressureChanges - Exit effect tuples
 * @param {Function} props.onUpdateEntryCondition
 * @param {Function} props.onRemoveEntryCondition
 * @param {Function} props.onAddEntryCondition
 * @param {Function} props.onUpdateExitCondition
 * @param {Function} props.onRemoveExitCondition
 * @param {Function} props.onAddExitCondition
 * @param {Function} props.onUpdateEntryEffect
 * @param {Function} props.onRemoveEntryEffect
 * @param {Function} props.onAddEntryEffect
 * @param {Function} props.onUpdateExitEffect
 * @param {Function} props.onRemoveExitEffect
 * @param {Function} props.onAddExitEffect
 * @param {Array} props.availablePressuresForEntry
 * @param {Array} props.availablePressuresForExit
 * @param {Array} props.pressures - All pressures for display
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.eras - All eras for era-specific conditions
 */
export function TransitionsGrid({
  entryConditions = [],
  exitConditions = [],
  entryPressureChanges = [],
  exitPressureChanges = [],
  onUpdateEntryCondition,
  onRemoveEntryCondition,
  onAddEntryCondition,
  onUpdateExitCondition,
  onRemoveExitCondition,
  onAddExitCondition,
  onUpdateEntryEffect,
  onRemoveEntryEffect,
  onAddEntryEffect,
  onUpdateExitEffect,
  onRemoveExitEffect,
  onAddExitEffect,
  availablePressuresForEntry = [],
  availablePressuresForExit = [],
  pressures = [],
  schema,
  eras = [],
}) {
  return (
    <div className="transitions-grid">
      {/* Entry Column */}
      <div className="transitions-column transitions-entry">
        <div className="transitions-column-header">
          <span className="transitions-column-icon">🚪</span>
          <span className="transitions-column-title">Entry</span>
          <span className="transitions-column-subtitle">When era starts</span>
        </div>

        <MiniSection
          title="Conditions"
          icon="?"
          count={entryConditions.length}
          isEmpty={entryConditions.length === 0}
          emptyMessage="No entry conditions — starts immediately"
        >
          {entryConditions.map((condition, index) => (
            <TransitionConditionEditor
              key={index}
              condition={condition}
              index={index}
              onChange={(updated) => onUpdateEntryCondition(index, updated)}
              onRemove={() => onRemoveEntryCondition(index)}
              pressures={pressures}
              schema={schema}
              eras={eras}
            />
          ))}
          <AddItemButton
            onClick={onAddEntryCondition}
            label="+ Condition"
            styles={ADD_ITEM_STYLES}
          />
        </MiniSection>

        <MiniSection
          title="Effects"
          icon="✨"
          count={entryPressureChanges.length}
          isEmpty={entryPressureChanges.length === 0}
          emptyMessage="No pressure changes on entry"
        >
          {entryPressureChanges.map(([pressureId, value]) => (
            <TransitionEffectItem
              key={pressureId}
              pressureId={pressureId}
              value={value}
              onChange={(newValue) => onUpdateEntryEffect(pressureId, newValue)}
              onRemove={() => onRemoveEntryEffect(pressureId)}
              pressures={pressures}
            />
          ))}
          <div className="transitions-add-effect">
            <SearchableDropdown
              items={availablePressuresForEntry}
              onSelect={onAddEntryEffect}
              placeholder="+ Add effect..."
              emptyMessage="All pressures added"
            />
          </div>
        </MiniSection>
      </div>

      {/* Arrow divider */}
      <div className="transitions-divider">
        <span className="transitions-arrow">→</span>
      </div>

      {/* Exit Column */}
      <div className="transitions-column transitions-exit">
        <div className="transitions-column-header">
          <span className="transitions-column-icon">🔄</span>
          <span className="transitions-column-title">Exit</span>
          <span className="transitions-column-subtitle">When era ends</span>
        </div>

        <MiniSection
          title="Conditions"
          icon="?"
          count={exitConditions.length}
          isEmpty={exitConditions.length === 0}
          emptyMessage="No exit conditions — transitions immediately"
        >
          {exitConditions.map((condition, index) => (
            <TransitionConditionEditor
              key={index}
              condition={condition}
              index={index}
              onChange={(updated) => onUpdateExitCondition(index, updated)}
              onRemove={() => onRemoveExitCondition(index)}
              pressures={pressures}
              schema={schema}
              eras={eras}
            />
          ))}
          <AddItemButton
            onClick={onAddExitCondition}
            label="+ Condition"
            styles={ADD_ITEM_STYLES}
          />
        </MiniSection>

        <MiniSection
          title="Effects"
          icon="💫"
          count={exitPressureChanges.length}
          isEmpty={exitPressureChanges.length === 0}
          emptyMessage="No pressure changes on exit"
        >
          {exitPressureChanges.map(([pressureId, value]) => (
            <TransitionEffectItem
              key={pressureId}
              pressureId={pressureId}
              value={value}
              onChange={(newValue) => onUpdateExitEffect(pressureId, newValue)}
              onRemove={() => onRemoveExitEffect(pressureId)}
              pressures={pressures}
            />
          ))}
          <div className="transitions-add-effect">
            <SearchableDropdown
              items={availablePressuresForExit}
              onSelect={onAddExitEffect}
              placeholder="+ Add effect..."
              emptyMessage="All pressures added"
            />
          </div>
        </MiniSection>
      </div>
    </div>
  );
}
