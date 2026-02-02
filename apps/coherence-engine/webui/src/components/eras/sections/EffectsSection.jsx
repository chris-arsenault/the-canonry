/**
 * EffectsSection - Reusable section for entry/exit effects (pressure changes)
 */

import React from 'react';
import { SectionHeader, EmptyState, SearchableDropdown } from '../../shared';
import { TransitionEffectItem } from '../shared';

const EMPTY_STATE_STYLES = Object.freeze({
  emptyState: {
    padding: '16px',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: '8px',
  },
});

/**
 * @param {Object} props
 * @param {string} props.title - Section title
 * @param {string} props.icon - Section icon
 * @param {string} props.description - Section description
 * @param {string} props.emptyMessage - Message when no effects
 * @param {Array} props.pressureChanges - Array of [pressureId, value] tuples
 * @param {Function} props.onUpdate - Called when an effect value changes
 * @param {Function} props.onRemove - Called to remove an effect
 * @param {Array} props.availablePressures - Pressures that can be added
 * @param {Function} props.onAdd - Called to add an effect
 * @param {string} props.addPlaceholder - Placeholder for add dropdown
 * @param {Array} props.pressures - All pressure definitions for display
 */
export function EffectsSection({
  title,
  icon,
  description,
  emptyMessage,
  pressureChanges,
  onUpdate,
  onRemove,
  availablePressures,
  onAdd,
  addPlaceholder,
  pressures,
}) {
  return (
    <div className="section">
      <SectionHeader
        icon={icon}
        title={title}
        count={`${pressureChanges.length} effect${pressureChanges.length !== 1 ? 's' : ''}`}
        description={description}
      />
      <div className="items-grid">
        {pressureChanges.length === 0 ? (
          <EmptyState
            title={emptyMessage}
            styles={EMPTY_STATE_STYLES}
          />
        ) : (
          pressureChanges.map(([pressureId, value]) => (
            <TransitionEffectItem
              key={pressureId}
              pressureId={pressureId}
              value={value}
              onChange={(newValue) => onUpdate(pressureId, newValue)}
              onRemove={() => onRemove(pressureId)}
              pressures={pressures || []}
            />
          ))
        )}
      </div>
      <div className="add-container">
        <SearchableDropdown
          items={availablePressures}
          onSelect={onAdd}
          placeholder={addPlaceholder}
          emptyMessage="All pressures added"
        />
      </div>
    </div>
  );
}
