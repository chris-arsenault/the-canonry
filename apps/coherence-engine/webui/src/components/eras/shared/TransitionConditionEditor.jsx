/**
 * TransitionConditionEditor - Editor for era transition conditions
 */

import React from 'react';
import { ApplicabilityRuleCard } from '../../generators/applicability/ApplicabilityRuleCard';

/**
 * @param {Object} props
 * @param {Object} props.condition - The condition object
 * @param {number} props.index - Index in the conditions array
 * @param {Function} props.onChange - Called when condition changes
 * @param {Function} props.onRemove - Called to remove condition
 * @param {Array} props.pressures - Available pressure definitions
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.eras - Era definitions (optional)
 */
export function TransitionConditionEditor({ condition, index, onChange, onRemove, pressures, schema, eras }) {
  return (
    <ApplicabilityRuleCard
      rule={condition}
      onChange={(updated) => onChange(updated)}
      onRemove={onRemove}
      schema={schema}
      pressures={pressures}
      eras={eras}
      depth={0}
    />
  );
}
