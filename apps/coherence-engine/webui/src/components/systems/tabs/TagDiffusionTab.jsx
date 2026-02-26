/**
 * TagDiffusionTab - Configuration for tag diffusion systems
 */

import React from "react";
import PropTypes from "prop-types";
import { DIRECTIONS } from "../constants";
import { ReferenceDropdown, NumberInput } from "../../shared";
import TagSelector from "@penguin-tales/shared-components/TagSelector";

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 * @param {Object} props.schema - Domain schema
 */
export function TagDiffusionTab({ system, onChange, schema }) {
  const config = system.config;
  const tagRegistry = schema?.tagRegistry || [];

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const updateConvergence = (field, value) => {
    updateConfig("convergence", { ...config.convergence, [field]: value });
  };

  const updateDivergence = (field, value) => {
    updateConfig("divergence", { ...config.divergence, [field]: value });
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Connection</div>
        <div className="form-grid">
          <ReferenceDropdown
            label="Connection Kind"
            value={config.connectionKind}
            onChange={(v) => updateConfig("connectionKind", v)}
            options={relationshipKindOptions}
          />
          <ReferenceDropdown
            label="Direction"
            value={config.connectionDirection || "both"}
            onChange={(v) => updateConfig("connectionDirection", v)}
            options={DIRECTIONS}
          />
          <div className="form-group">
            <label className="label">Max Tags
            <NumberInput
              value={config.maxTags}
              onChange={(v) => updateConfig("maxTags", v)}
              min={1}
              integer
              allowEmpty
            />
            </label>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Convergence</div>
        <div className="section-desc">Connected entities become more similar.</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Tags
            <TagSelector
              value={config.convergence?.tags || []}
              onChange={(tags) => updateConvergence("tags", tags)}
              tagRegistry={tagRegistry}
              placeholder="Select tags..."
            />
            </label>
          </div>
          <div className="form-group">
            <label className="label">Min Connections
            <NumberInput
              value={config.convergence?.minConnections}
              onChange={(v) => updateConvergence("minConnections", v)}
              min={0}
              integer
              allowEmpty
            />
            </label>
          </div>
          <div className="form-group">
            <label className="label">Probability
            <NumberInput
              value={config.convergence?.probability}
              onChange={(v) => updateConvergence("probability", v)}
              min={0}
              max={1}
              allowEmpty
            />
            </label>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Divergence</div>
        <div className="section-desc">Isolated entities become more unique.</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Tags
            <TagSelector
              value={config.divergence?.tags || []}
              onChange={(tags) => updateDivergence("tags", tags)}
              tagRegistry={tagRegistry}
              placeholder="Select tags..."
            />
            </label>
          </div>
          <div className="form-group">
            <label className="label">Max Connections
            <NumberInput
              value={config.divergence?.maxConnections}
              onChange={(v) => updateDivergence("maxConnections", v)}
              min={0}
              integer
              allowEmpty
            />
            </label>
          </div>
          <div className="form-group">
            <label className="label">Probability
            <NumberInput
              value={config.divergence?.probability}
              onChange={(v) => updateDivergence("probability", v)}
              min={0}
              max={1}
              allowEmpty
            />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

TagDiffusionTab.propTypes = {
  system: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  schema: PropTypes.object,
};
