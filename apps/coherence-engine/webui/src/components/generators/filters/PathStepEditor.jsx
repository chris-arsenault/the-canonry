/**
 * PathStepEditor - Edit a single step in a graph path traversal
 */

import React from "react";
import PropTypes from "prop-types";
import { PATH_DIRECTIONS } from "../constants";
import { ReferenceDropdown } from "../../shared";

/**
 * @param {Object} props
 * @param {Object} props.step - The path step configuration
 * @param {Function} props.onChange - Callback when step changes
 * @param {Function} props.onRemove - Callback to remove this step
 * @param {Object} props.schema - Domain schema
 * @param {number} props.stepIndex - Index of this step in the path
 */
export function PathStepEditor({ step, onChange, onRemove, schema, stepIndex }) {
  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const entityKindOptions = [
    { value: "any", label: "Any kind" },
    ...(schema?.entityKinds || []).map((ek) => ({
      value: ek.kind,
      label: ek.description || ek.kind,
    })),
  ];

  const getSubtypeOptions = (kind) => {
    if (!kind || kind === "any") return [{ value: "any", label: "Any subtype" }];
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.subtypes) return [{ value: "any", label: "Any subtype" }];
    return [
      { value: "any", label: "Any subtype" },
      ...ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id })),
    ];
  };

  const updateStep = (field, value) => {
    onChange({ ...step, [field]: value });
  };

  return (
    <div className="path-step-card">
      <div className="path-step-header">
        <span className="path-step-label">Step {stepIndex + 1}</span>
        <button onClick={onRemove} className="button button-remove-micro">
          ×
        </button>
      </div>
      <div className="path-step-grid">
        <div>
          <label className="label label-micro">Via Relationship
          <ReferenceDropdown
            value={step.via || ""}
            onChange={(v) => updateStep("via", v)}
            options={relationshipKindOptions}
            placeholder="Select..."
          />
          </label>
        </div>
        <div>
          <label className="label label-micro">Direction
          <ReferenceDropdown
            value={step.direction || "any"}
            onChange={(v) => updateStep("direction", v)}
            options={PATH_DIRECTIONS}
          />
          </label>
        </div>
        <div>
          <label className="label label-micro">Target Kind
          <ReferenceDropdown
            value={step.targetKind}
            onChange={(v) => updateStep("targetKind", v)}
            options={entityKindOptions}
            placeholder="Select..."
          />
          </label>
        </div>
        <div>
          <label className="label label-micro">Target Subtype
          <ReferenceDropdown
            value={step.targetSubtype}
            onChange={(v) => updateStep("targetSubtype", v)}
            options={getSubtypeOptions(step.targetKind)}
            placeholder="Select..."
          />
          </label>
        </div>
        <div className="path-step-full-width">
          <label htmlFor="store-as-variable-optional" className="label label-micro">Store As Variable (optional)</label>
          <input id="store-as-variable-optional"
            type="text"
            value={step.as || ""}
            onChange={(e) => updateStep("as", e.target.value)}
            className="input input-micro"
            placeholder="e.g. $allies"
          />
        </div>
      </div>
    </div>
  );
}

PathStepEditor.propTypes = {
  step: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  schema: PropTypes.object,
  stepIndex: PropTypes.number.isRequired,
};

export default PathStepEditor;
