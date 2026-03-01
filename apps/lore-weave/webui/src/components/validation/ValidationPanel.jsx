/**
 * ValidationPanel - Structure Validation UI
 */

import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { validateAllConfigs } from "../../../../lib/engine/configSchemaValidator";
import { ErrorMessage } from "@the-canonry/shared-components";
import "./ValidationPanel.css";

function ErrorCard({ error }) {
  return (
    <div className="validation-panel-error-card">
      <ErrorMessage
        title={error.path}
        message={error.message}
        className="validation-panel-error-header"
      />
      <div className="validation-panel-error-body">
        <div className="validation-panel-error-row">
          <span className="validation-panel-error-label">Expected:</span>
          <code className="validation-panel-error-value">{error.expected}</code>
        </div>
        <div className="validation-panel-error-row">
          <span className="validation-panel-error-label">Got:</span>
          <code className="validation-panel-error-value">{JSON.stringify(error.value)}</code>
        </div>
        {error.suggestion && (
          <div className="validation-panel-suggestion">
            <div className="validation-panel-suggestion-label">Suggestion</div>
            <div className="validation-panel-suggestion-text">{error.suggestion}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function WarningCard({ warning }) {
  return (
    <div className="validation-panel-warning-card">
      <div className="validation-panel-warning-header">
        <div className="validation-panel-warning-path">{warning.path}</div>
        <div className="validation-panel-error-message">{warning.message}</div>
      </div>
      {warning.suggestion && (
        <div className="validation-panel-error-body">
          <div className="validation-panel-suggestion">
            <div className="validation-panel-suggestion-label">Suggestion</div>
            <div className="validation-panel-suggestion-text">{warning.suggestion}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ValidationPanel({
  schema,
  eras,
  generators,
  pressures,
  systems,
  actions,
  seedEntities,
}) {
  const validationResult = useMemo(() => {
    const cultures = schema?.cultures?.map((c) => c.id) || [];
    const entityKinds = schema?.entityKinds?.map((k) => k.kind) || [];
    const relationshipKinds = schema?.relationshipKinds?.map((k) => k.kind) || [];

    return validateAllConfigs({
      templates: generators,
      pressures,
      systems,
      eras,
      actions,
      seedEntities,
      schema: { cultures, entityKinds, relationshipKinds },
    });
  }, [schema, eras, generators, pressures, systems, actions, seedEntities]);

  const { valid, errors, warnings } = validationResult;

  return (
    <div className="validation-panel-container">
      <div className="validation-panel-header">
        <h1 className="validation-panel-title">Structure Validation</h1>
        <p className="validation-panel-subtitle">
          Validates JSON config structure (types, required fields, shapes). This is a hard gate
          before simulation. For semantic validation (references, balance, orphans), see the
          Coherence Engine tab.
        </p>
      </div>

      <div
        className={`validation-panel-status-banner ${
          valid ? "validation-panel-status-valid" : "validation-panel-status-invalid"
        }`}
      >
        <span className="validation-panel-status-icon">{valid ? "✓" : "✗"}</span>
        <div className="validation-panel-status-text">
          <div className="validation-panel-status-title">
            {valid ? "Configuration is valid" : "Configuration has errors"}
          </div>
          <div className="validation-panel-status-subtitle">
            {errors.length} error{errors.length !== 1 ? "s" : ""}, {warnings.length} warning
            {warnings.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="validation-panel-section">
          <h2 className="validation-panel-section-title">
            Errors
            <span className="validation-panel-section-count validation-panel-section-count-error">
              {errors.length}
            </span>
          </h2>
          <div className="validation-panel-list">
            {errors.map((error, i) => (
              <ErrorCard key={i} error={error} />
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="validation-panel-section">
          <h2 className="validation-panel-section-title">
            Warnings
            <span className="validation-panel-section-count validation-panel-section-count-warning">
              {warnings.length}
            </span>
          </h2>
          <div className="validation-panel-list">
            {warnings.map((warning, i) => (
              <WarningCard key={i} warning={warning} />
            ))}
          </div>
        </div>
      )}

      {valid && warnings.length === 0 && (
        <div className="validation-panel-empty-state">
          <div className="validation-panel-empty-icon">✓</div>
          <div>All configuration files are valid and ready for simulation.</div>
        </div>
      )}

      <div className="validation-panel-stats">
        <div className="validation-panel-stat-card">
          <div className="validation-panel-stat-value">{generators?.length || 0}</div>
          <div className="validation-panel-stat-label">Generators</div>
        </div>
        <div className="validation-panel-stat-card">
          <div className="validation-panel-stat-value">{pressures?.length || 0}</div>
          <div className="validation-panel-stat-label">Pressures</div>
        </div>
        <div className="validation-panel-stat-card">
          <div className="validation-panel-stat-value">{systems?.length || 0}</div>
          <div className="validation-panel-stat-label">Systems</div>
        </div>
        <div className="validation-panel-stat-card">
          <div className="validation-panel-stat-value">{actions?.length || 0}</div>
          <div className="validation-panel-stat-label">Actions</div>
        </div>
        <div className="validation-panel-stat-card">
          <div className="validation-panel-stat-value">{eras?.length || 0}</div>
          <div className="validation-panel-stat-label">Eras</div>
        </div>
        <div className="validation-panel-stat-card">
          <div className="validation-panel-stat-value">{seedEntities?.length || 0}</div>
          <div className="validation-panel-stat-label">Seed Entities</div>
        </div>
      </div>
    </div>
  );
}

ErrorCard.propTypes = {
  error: PropTypes.object,
};

WarningCard.propTypes = {
  warning: PropTypes.object,
};

ValidationPanel.propTypes = {
  schema: PropTypes.object,
  eras: PropTypes.array,
  generators: PropTypes.array,
  pressures: PropTypes.array,
  systems: PropTypes.array,
  actions: PropTypes.array,
  seedEntities: PropTypes.array,
};
