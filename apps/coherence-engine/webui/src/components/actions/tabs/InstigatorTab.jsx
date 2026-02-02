/**
 * InstigatorTab - Instigator configuration
 */

import React from 'react';
import VariableSelectionEditor from '../../shared/VariableSelectionEditor';

export function InstigatorTab({ action, onChange, schema }) {
  const actor = action.actor || {};

  const updateActor = (field, value) => {
    onChange({
      ...action,
      actor: { ...actor, [field]: value },
    });
  };

  const instigator = actor.instigator;
  const hasInstigator = Boolean(instigator);

  const addInstigator = () => {
    updateActor('instigator', { from: 'graph', kind: '', pickStrategy: 'random', required: false });
  };

  const updateInstigator = (updated) => {
    updateActor('instigator', updated);
  };

  const removeInstigator = () => {
    updateActor('instigator', undefined);
  };

  return (
    <div>
      <div className="info-box">
        <div className="info-box-title">Instigator</div>
        <div className="info-box-text">
          Configure optional instigator selection for this action.
        </div>
      </div>

      <div className="section">
        <div className="section-title">👤 Instigator (Optional)</div>
        <div className="section-desc">
          An instigator can trigger the action on behalf of the actor (e.g., NPC leader acts for their faction).
        </div>

        {!hasInstigator ? (
          <div>
            <div className="text-muted text-small mb-md">
              No instigator configured. The actor performs the action directly.
            </div>
            <button className="btn btn-add" onClick={addInstigator}>
              + Add Instigator
            </button>
          </div>
        ) : (
          <div>
            <label className="checkbox-label" style={{ marginBottom: '12px' }}>
              <input
                type="checkbox"
                checked={instigator.required || false}
                onChange={(e) => updateInstigator({ ...instigator, required: e.target.checked || undefined })}
                className="checkbox"
              />
              Instigator required
            </label>
            <VariableSelectionEditor
              value={instigator}
              onChange={(updated) => updateInstigator({ ...updated, required: instigator.required })}
              schema={schema}
              availableRefs={['$actor']}
            />
            <button className="btn btn-danger-outline" style={{ marginTop: '12px' }} onClick={removeInstigator}>
              Remove Instigator
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default InstigatorTab;
