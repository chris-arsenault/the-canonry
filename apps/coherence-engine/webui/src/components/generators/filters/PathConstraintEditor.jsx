/**
 * PathConstraintEditor - Edit a constraint on graph path traversal
 */

import React from "react";
import PropTypes from "prop-types";
import { PATH_DIRECTIONS, PATH_CONSTRAINT_TYPES } from "../constants";
import { ReferenceDropdown } from "../../shared";

/**
 * @param {Object} props
 * @param {Object} props.constraint - The path constraint configuration
 * @param {Function} props.onChange - Callback when constraint changes
 * @param {Function} props.onRemove - Callback to remove this constraint
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.availableRefs - Available entity references
 */
export function PathConstraintEditor({ constraint, onChange, onRemove, schema, availableRefs }) {
  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const entityKinds = schema?.entityKinds || [];
  const entityKindOptions = entityKinds.map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  // Gather all subtypes from all entity kinds for subtype_equals constraint
  const allSubtypeOptions = entityKinds.flatMap((ek) =>
    (ek.subtypes || []).map((st) => ({
      value: st.id,
      label: `${st.name || st.id} (${ek.kind})`,
    }))
  );

  const refOptions = (availableRefs || []).map((ref) => ({
    value: ref,
    label: ref,
  }));

  const updateConstraint = (field, value) => {
    onChange({ ...constraint, [field]: value || undefined });
  };

  const renderConstraintFields = () => {
    switch (constraint.type) {
      case "not_self":
        return <span className="text-muted text-small">Target cannot be the starting entity</span>;

      case "not_in":
      case "in":
        return (
          <div>
            <label className="label label-micro">Set Variable
            <ReferenceDropdown
              value={constraint.set || ""}
              onChange={(v) => updateConstraint("set", v)}
              options={refOptions}
              placeholder="e.g. $allies"
            />
            </label>
          </div>
        );

      case "kind_equals":
        return (
          <div>
            <label className="label label-micro">Entity Kind
            <ReferenceDropdown
              value={constraint.kind || ""}
              onChange={(v) => updateConstraint("kind", v)}
              options={entityKindOptions}
            />
            </label>
          </div>
        );

      case "subtype_equals":
        return (
          <div>
            <label className="label label-micro">Subtype
            <ReferenceDropdown
              value={constraint.subtype || ""}
              onChange={(v) => updateConstraint("subtype", v)}
              options={allSubtypeOptions}
              placeholder="Select subtype..."
            />
            </label>
          </div>
        );

      case "has_relationship":
      case "lacks_relationship":
        return (
          <div className="constraint-fields-grid">
            <div>
              <label className="label label-micro">Kind
              <ReferenceDropdown
                value={constraint.kind || ""}
                onChange={(v) => updateConstraint("kind", v)}
                options={relationshipKindOptions}
              />
              </label>
            </div>
            <div>
              <label className="label label-micro">With
              <ReferenceDropdown
                value={constraint.with || ""}
                onChange={(v) => updateConstraint("with", v)}
                options={refOptions}
              />
              </label>
            </div>
            <div>
              <label className="label label-micro">Direction
              <ReferenceDropdown
                value={constraint.direction || "any"}
                onChange={(v) => updateConstraint("direction", v)}
                options={PATH_DIRECTIONS}
              />
              </label>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const constraintLabel =
    PATH_CONSTRAINT_TYPES.find((c) => c.value === constraint.type)?.label || constraint.type;

  return (
    <div className="path-constraint-card">
      <div className="path-constraint-header">
        <span className="path-constraint-label">{constraintLabel}</span>
        <button onClick={onRemove} className="button button-remove-micro">
          ×
        </button>
      </div>
      {renderConstraintFields()}
    </div>
  );
}

PathConstraintEditor.propTypes = {
  constraint: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  schema: PropTypes.object,
  availableRefs: PropTypes.array,
};

export default PathConstraintEditor;
