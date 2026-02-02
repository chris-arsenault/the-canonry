/**
 * ApplicabilityTab - Configure when a generator is eligible to run
 */

import React from 'react';
import { ApplicabilityRuleCard } from './ApplicabilityRuleCard';
import { AddRuleButton } from './AddRuleButton';
import { createNewRule } from './createNewRule';

/**
 * @param {Object} props
 * @param {Object} props.generator - The generator being edited
 * @param {Function} props.onChange - Callback when generator changes
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.pressures - Available pressure definitions
 * @param {Array} props.eras - Available era definitions
 */
export function ApplicabilityTab({ generator, onChange, schema, pressures, eras }) {
  const rules = generator.applicability || [];

  return (
    <div>
      <div className="section">
        <div className="section-title">Applicability Rules</div>
        <div className="section-desc">
          Define when this generator is eligible to run. If no rules are defined, the generator will
          always be eligible. Multiple top-level rules are combined with AND logic.
        </div>

        {rules.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✓</div>
            <div className="empty-state-title">No applicability rules</div>
            <div className="empty-state-desc">
              This generator will always be eligible to run. Add rules to control when it activates.
            </div>
          </div>
        ) : (
          rules.map((rule, index) => (
            <ApplicabilityRuleCard
              key={index}
              rule={rule}
              onChange={(updated) => {
                const newRules = [...rules];
                newRules[index] = updated;
                onChange({ ...generator, applicability: newRules });
              }}
              onRemove={() => onChange({ ...generator, applicability: rules.filter((_, i) => i !== index) })}
              schema={schema}
              pressures={pressures}
              eras={eras}
            />
          ))
        )}

        <AddRuleButton onAdd={(type) => {
          const newRule = createNewRule(type, pressures);
          onChange({ ...generator, applicability: [...rules, newRule] });
        }} />
      </div>
    </div>
  );
}

export default ApplicabilityTab;
