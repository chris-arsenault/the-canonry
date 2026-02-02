/**
 * ActorTab - Actor requirements configuration
 */

import React from 'react';
import { AddRuleButton } from '../../generators/applicability/AddRuleButton';
import { ApplicabilityRuleCard } from '../../generators/applicability/ApplicabilityRuleCard';
import { createNewRule } from '../../generators/applicability/createNewRule';
import SelectionRuleEditor from '../../shared/SelectionRuleEditor';

export function ActorTab({ action, onChange, schema, pressures }) {
  const actor = action.actor || {};
  const selection = actor.selection || { strategy: 'by_kind' };
  const conditions = actor.conditions || [];

  const updateActor = (field, value) => {
    onChange({
      ...action,
      actor: { ...actor, [field]: value },
    });
  };

  const availableRefs = ['$actor'];

  return (
    <div>
      <div className="info-box">
        <div className="info-box-title">Actor Configuration</div>
        <div className="info-box-text">
          The actor is the primary entity that performs the action on the target.
          Optional instigator rules can provide richer context.
        </div>
      </div>

      <div className="section">
        <div className="section-title">🎭 Actor Selection</div>
        <SelectionRuleEditor
          value={selection}
          onChange={(updated) => updateActor('selection', updated)}
          schema={schema}
          availableRefs={availableRefs}
          showPickStrategy={false}
          showMaxResults={false}
        />
      </div>

      <div className="section">
        <div className="section-title">✅ Actor Conditions ({conditions.length})</div>
        <div className="section-desc">
          Additional rules that must pass for the actor to perform this action.
        </div>

        {conditions.length === 0 ? (
          <div className="empty-state-compact">No conditions defined.</div>
        ) : (
          conditions.map((condition, index) => (
            <ApplicabilityRuleCard
              key={index}
              rule={condition}
              onChange={(updated) => {
                const next = [...conditions];
                next[index] = updated;
                updateActor('conditions', next);
              }}
              onRemove={() => updateActor('conditions', conditions.filter((_, i) => i !== index))}
              schema={schema}
              pressures={pressures}
            />
          ))
        )}

        <AddRuleButton
          onAdd={(type) => {
            const newRule = createNewRule(type, pressures);
            updateActor('conditions', [...conditions, newRule]);
          }}
        />
      </div>
    </div>
  );
}
