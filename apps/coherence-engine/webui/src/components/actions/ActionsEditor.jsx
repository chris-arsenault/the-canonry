/**
 * ActionsEditor - Main component for editing action configurations
 */

import React from 'react';
import { useEditorState } from '../shared';
import { buildStorageKey } from '../../utils/persistence';
import { ActionListCard } from './cards';
import { ActionModal } from './modals';

const createAction = () => ({
  id: `action_${Date.now()}`,
  name: 'New Action',
  description: '',
  actor: { kinds: [] },
  targeting: { kind: '' },
  outcome: { descriptionTemplate: '' },
  probability: {
    baseSuccessChance: 0.5,
    baseWeight: 1.0,
    pressureModifiers: [],
  },
});

export default function ActionsEditor({ projectId, actions = [], onChange, schema, pressures = [], usageMap }) {
  const selectionKey = buildStorageKey(projectId, 'actions:selected');
  const {
    selectedItem: selectedAction,
    handleItemChange: handleActionChange,
    handleToggle,
    handleDelete,
    handleAdd: handleAddAction,
    handleSelect,
    handleClose,
  } = useEditorState(actions, onChange, { createItem: createAction, persistKey: selectionKey });

  // Collect unique pressures across all actions
  const uniquePressures = new Set();
  actions.forEach(action => {
    (action.probability?.pressureModifiers || []).forEach(mod => {
      if (mod.pressure) uniquePressures.add(mod.pressure);
    });
  });

  return (
    <div className="actions-editor">
      <div className="actions-header">
        <h1 className="actions-title">Actions</h1>
        <p className="actions-subtitle">
          Actions define what agents can do during the simulation via the universal catalyst system. Click an action to edit.
        </p>
        <div className="actions-stats">
          <div className="actions-stat">
            <span className="actions-stat-label">Total Actions</span>
            <span className="actions-stat-value">{actions.length}</span>
          </div>
          <div className="actions-stat">
            <span className="actions-stat-label">Pressures Referenced</span>
            <span className="actions-stat-value">{uniquePressures.size}</span>
          </div>
        </div>
      </div>

      <div className="actions-grid">
        {actions.map((action, index) => (
          <ActionListCard
            key={action.id}
            action={action}
            onClick={() => handleSelect(index)}
            onToggle={() => handleToggle(action)}
            usageMap={usageMap}
          />
        ))}

        <div
          className="actions-add-card"
          onClick={() => handleAddAction()}
        >
          <span className="text-2xl">+</span>
          <span>Add Action</span>
        </div>
      </div>

      {selectedAction && (
        <ActionModal
          action={selectedAction}
          onChange={handleActionChange}
          onClose={handleClose}
          onDelete={handleDelete}
          schema={schema}
          pressures={pressures}
        />
      )}
    </div>
  );
}

export { ActionsEditor };
