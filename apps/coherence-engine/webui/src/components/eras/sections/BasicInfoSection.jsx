/**
 * BasicInfoSection - Era basic information (ID, name, description)
 */

import React from "react";
import PropTypes from "prop-types";
import { SectionHeader, LocalTextArea } from "../../shared";

/**
 * @param {Object} props
 * @param {Object} props.era - The era object
 * @param {Function} props.onFieldChange - Called when a field changes
 */
export function BasicInfoSection({ era, onFieldChange }) {
  return (
    <div className="section">
      <SectionHeader icon="📝" title="Basic Information" />
      <div className="input-grid">
        <div className="form-group">
          <label htmlFor="id" className="label">ID</label>
          <input id="id"
            type="text"
            value={era.id}
            onChange={(e) => onFieldChange("id", e.target.value)}
            className="input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="name" className="label">Name</label>
          <input id="name"
            type="text"
            value={era.name}
            onChange={(e) => onFieldChange("name", e.target.value)}
            className="input"
          />
        </div>
      </div>
      <div className="form-group" style={{ marginTop: "16px" }}>
        <label className="label">Summary
        <LocalTextArea value={era.summary} onChange={(value) => onFieldChange("summary", value)} />
        </label>
      </div>
    </div>
  );
}

BasicInfoSection.propTypes = {
  era: PropTypes.object.isRequired,
  onFieldChange: PropTypes.func.isRequired,
};
