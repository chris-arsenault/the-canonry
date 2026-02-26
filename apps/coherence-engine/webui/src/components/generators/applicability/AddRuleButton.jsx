/**
 * AddRuleButton - Button with type picker for adding applicability rules
 */

import React, { useState } from "react";
import PropTypes from "prop-types";
import { APPLICABILITY_TYPES } from "../constants";

/**
 * @param {Object} props
 * @param {Function} props.onAdd - Callback when a rule type is selected
 * @param {number} props.depth - Nesting depth (limits nested rule types at depth >= 2)
 */
export function AddRuleButton({ onAdd, depth = 0 }) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="dropdown">
      <button className="btn-add" onClick={() => setShowPicker(!showPicker)}>
        + Add Rule
      </button>

      {showPicker && (
        <div className="dropdown-menu" style={{ minWidth: "280px" }}>
          <div className="dropdown-options">
            {Object.entries(APPLICABILITY_TYPES)
              .filter(([type]) => depth < 2 || (type !== "or" && type !== "and"))
              .map(([type, config]) => (
                <div
                  key={type}
                  className="dropdown-menu-item"
                  onClick={() => {
                    onAdd(type);
                    setShowPicker(false);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                >
                  <div
                    className="dropdown-menu-icon"
                    style={{ backgroundColor: `${config.color}20` }}
                  >
                    {config.icon}
                  </div>
                  <div>
                    <div className="dropdown-menu-label">{config.label}</div>
                    <div
                      style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}
                    >
                      {config.desc}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

AddRuleButton.propTypes = {
  onAdd: PropTypes.func.isRequired,
  depth: PropTypes.number,
};

export default AddRuleButton;
