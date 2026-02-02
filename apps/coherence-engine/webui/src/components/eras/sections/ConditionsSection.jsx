/**
 * ConditionsSection - Reusable section for entry/exit conditions
 */

import React from 'react';
import { SectionHeader, EmptyState, AddItemButton } from '../../shared';
import { TransitionConditionEditor } from '../shared';

const EMPTY_STATE_STYLES = Object.freeze({
  emptyState: {
    padding: '16px',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: '8px',
  },
});

const ADD_ITEM_STYLES = Object.freeze({
  addItemBtn: { marginTop: '10px', padding: '10px 16px' },
});

/**
 * @param {Object} props
 * @param {string} props.title - Section title
 * @param {string} props.icon - Section icon
 * @param {string} props.description - Section description
 * @param {string} props.emptyMessage - Message when no conditions
 * @param {Array} props.conditions - Array of condition objects
 * @param {Function} props.onUpdate - Called when a condition is updated
 * @param {Function} props.onRemove - Called to remove a condition
 * @param {Function} props.onAdd - Called to add a new condition
 * @param {string} props.addLabel - Label for add button
 * @param {Array} props.pressures - Available pressures
 * @param {Object} props.schema - Domain schema
 */
export function ConditionsSection({
  title,
  icon,
  description,
  emptyMessage,
  conditions,
  onUpdate,
  onRemove,
  onAdd,
  addLabel,
  pressures,
  schema,
}) {
  return (
    <div className="section">
      <SectionHeader
        icon={icon}
        title={title}
        count={`${conditions.length} condition${conditions.length !== 1 ? 's' : ''}`}
        description={description}
      />
      <div className="items-grid">
        {conditions.length === 0 ? (
          <EmptyState
            title={emptyMessage}
            styles={EMPTY_STATE_STYLES}
          />
        ) : (
          conditions.map((condition, index) => (
            <TransitionConditionEditor
              key={index}
              condition={condition}
              index={index}
              onChange={(updated) => onUpdate(index, updated)}
              onRemove={() => onRemove(index)}
              pressures={pressures || []}
              schema={schema}
            />
          ))
        )}
      </div>
      <AddItemButton
        onClick={onAdd}
        label={addLabel}
        styles={ADD_ITEM_STYLES}
      />
    </div>
  );
}
