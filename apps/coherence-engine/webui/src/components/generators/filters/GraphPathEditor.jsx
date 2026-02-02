/**
 * GraphPathEditor - Edit a graph path assertion for filtering
 */

import React, { useState } from 'react';
import { PATH_CHECK_TYPES, PATH_CONSTRAINT_TYPES } from '../constants';
import { ReferenceDropdown, NumberInput } from '../../shared';
import { PathStepEditor } from './PathStepEditor';
import { PathConstraintEditor } from './PathConstraintEditor';

/**
 * @param {Object} props
 * @param {Object} props.assert - The path assertion configuration
 * @param {Function} props.onChange - Callback when assertion changes
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.availableRefs - Available entity references
 */
export function GraphPathEditor({ assert, onChange, schema, availableRefs }) {
  const [showConstraintMenu, setShowConstraintMenu] = useState(false);

  const assertion = assert || { check: 'exists', path: [] };

  const updateAssertion = (field, value) => {
    onChange({ ...assertion, [field]: value });
  };

  const addStep = () => {
    // Create with empty required fields - validation will flag them
    const newStep = { via: '', direction: '', targetKind: '', targetSubtype: '' };
    updateAssertion('path', [...(assertion.path || []), newStep]);
  };

  const updateStep = (index, updated) => {
    const newPath = [...(assertion.path || [])];
    newPath[index] = updated;
    updateAssertion('path', newPath);
  };

  const removeStep = (index) => {
    updateAssertion('path', (assertion.path || []).filter((_, i) => i !== index));
  };

  const addConstraint = (type) => {
    const newConstraint = { type };
    if (type === 'has_relationship' || type === 'lacks_relationship') {
      newConstraint.direction = 'any';
    }
    updateAssertion('where', [...(assertion.where || []), newConstraint]);
    setShowConstraintMenu(false);
  };

  const updateConstraint = (index, updated) => {
    const newWhere = [...(assertion.where || [])];
    newWhere[index] = updated;
    updateAssertion('where', newWhere);
  };

  const removeConstraint = (index) => {
    const newWhere = (assertion.where || []).filter((_, i) => i !== index);
    updateAssertion('where', newWhere.length > 0 ? newWhere : undefined);
  };

  // Collect variables from path steps for constraint references
  const pathVars = (assertion.path || [])
    .filter(s => s.as)
    .map(s => s.as);
  const allRefs = [...(availableRefs || []), ...pathVars];

  return (
    <div className="graph-path-editor">
      {/* Check type and count */}
      <div className="path-editor-grid">
        <div>
          <label className="label label-tiny">Check Type</label>
          <ReferenceDropdown
            value={assertion.check || 'exists'}
            onChange={(v) => updateAssertion('check', v)}
            options={PATH_CHECK_TYPES}
          />
        </div>
        {(assertion.check === 'count_min' || assertion.check === 'count_max') && (
          <div>
            <label className="label label-tiny">Count</label>
            <NumberInput
              value={assertion.count ?? 1}
              onChange={(v) => updateAssertion('count', v ?? 1)}
              min={0}
              integer
              className="input input-compact"
            />
          </div>
        )}
      </div>

      {/* Path steps */}
      <div>
        <label className="label label-tiny">
          Path Steps (traverse relationships)
        </label>
        <div className="path-steps-list">
          {(assertion.path || []).map((step, index) => (
            <PathStepEditor
              key={index}
              step={step}
              onChange={(updated) => updateStep(index, updated)}
              onRemove={() => removeStep(index)}
              schema={schema}
              stepIndex={index}
            />
          ))}
          {(assertion.path || []).length < 2 && (
            <button onClick={addStep} className="button button-add-step">
              + Add Step {(assertion.path || []).length === 0 ? '(required)' : '(optional)'}
            </button>
          )}
        </div>
      </div>

      {/* Where constraints */}
      <div>
        <label className="label label-tiny">
          Where Constraints (optional)
        </label>
        <div className="path-constraints-list">
          {(assertion.where || []).map((constraint, index) => (
            <PathConstraintEditor
              key={index}
              constraint={constraint}
              onChange={(updated) => updateConstraint(index, updated)}
              onRemove={() => removeConstraint(index)}
              schema={schema}
              availableRefs={allRefs}
            />
          ))}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowConstraintMenu(!showConstraintMenu)}
              className="button button-add-constraint"
            >
              + Add Constraint
            </button>
            {showConstraintMenu && (
              <div className="dropdown-menu">
                {PATH_CONSTRAINT_TYPES.map(({ value, label }) => (
                  <div
                    key={value}
                    onClick={() => addConstraint(value)}
                    className="dropdown-menu-item"
                  >
                    {label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GraphPathEditor;
