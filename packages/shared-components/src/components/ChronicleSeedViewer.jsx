/**
 * ChronicleSeedViewer - Displays chronicle generation context/seed data
 *
 * Unified component used by:
 * - Chronicler wiki pages (modal view, with temporal context)
 * - Illuminator validation UI (expandable section, with narrative direction)
 */

import React, { useState } from "react";
import PropTypes from "prop-types";
import "./ChronicleSeedViewer.css";

/**
 * @typedef {Object} ChronicleRoleAssignment
 * @property {string} role
 * @property {string} entityId
 * @property {string} entityName
 * @property {string} entityKind
 * @property {boolean} isPrimary
 */

/**
 * @typedef {Object} ChronicleTemporalContext
 * @property {{ id: string, name: string, summary?: string }} [focalEra]
 * @property {[number, number]} [chronicleTickRange]
 * @property {string} [temporalScope]
 * @property {boolean} [isMultiEra]
 * @property {string[]} [touchedEraIds]
 * @property {string} [temporalDescription]
 */

/**
 * @typedef {Object} ChronicleSeedData
 * @property {string} narrativeStyleId
 * @property {string} [narrativeStyleName]
 * @property {string} [entrypointId]
 * @property {string} [entrypointName]
 * @property {string} [narrativeDirection]
 * @property {ChronicleRoleAssignment[]} roleAssignments
 * @property {string[]} selectedEventIds
 * @property {string[]} selectedRelationshipIds
 * @property {ChronicleTemporalContext} [temporalContext]
 */

/**
 * @param {Object} props
 * @param {ChronicleSeedData} props.seed
 * @param {Map<string, string>} [props.eventNames] - Resolved display names for event IDs
 * @param {Map<string, string>} [props.relationshipLabels] - Resolved display labels for relationship IDs
 */
export default function ChronicleSeedViewer({
  seed,
  eventNames,
  relationshipLabels,
}) {
  const primaryRoles = seed.roleAssignments.filter((r) => r.isPrimary);
  const supportingRoles = seed.roleAssignments.filter((r) => !r.isPrimary);

  return (
    <div className="csv-container">
      {/* Style & Entry Point */}
      <div className="csv-section">
        <div className="csv-section-title">Generation Settings</div>
        <div className="csv-field">
          <span className="csv-field-label">Style:</span>
          <span className="csv-field-value">{seed.narrativeStyleName || seed.narrativeStyleId}</span>
        </div>
        {seed.entrypointId && (
          <div className="csv-field">
            <span className="csv-field-label">Entry Point:</span>
            <span className="csv-field-value">{seed.entrypointName || seed.entrypointId}</span>
          </div>
        )}
        {seed.narrativeDirection && (
          <div className="csv-narrative-direction-wrapper">
            <div className="csv-narrative-direction-label">
              Narrative Direction:
            </div>
            <div
              className="csv-narrative-direction-body"
              title="Click to copy"
              onClick={() => void navigator.clipboard.writeText(seed.narrativeDirection)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
            >
              {seed.narrativeDirection}
            </div>
          </div>
        )}
      </div>

      {/* Role Assignments */}
      <div className="csv-section">
        <div className="csv-section-title">Cast ({seed.roleAssignments.length} entities)</div>
        {seed.roleAssignments.length === 0 ? (
          <div className="csv-empty-state">No roles assigned</div>
        ) : (
          <div className="csv-role-list">
            {primaryRoles.map((role, i) => (
              <div key={`primary-${i}`} className="csv-role-item">
                <span className="csv-primary-role-badge">{role.role}</span>
                <span className="csv-entity-name">{role.entityName}</span>
                <span className="csv-entity-kind">({role.entityKind})</span>
              </div>
            ))}
            {supportingRoles.map((role, i) => (
              <div key={`supporting-${i}`} className="csv-role-item">
                <span className="csv-supporting-role-badge">{role.role}</span>
                <span className="csv-entity-name">{role.entityName}</span>
                <span className="csv-entity-kind">({role.entityKind})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Temporal Context (optional, used by chronicler) */}
      {seed.temporalContext && (
        <div className="csv-section">
          <div className="csv-section-title">Temporal Context</div>
          <div className="csv-field">
            <span className="csv-field-label">Focal Era:</span>
            <span className="csv-field-value">
              {seed.temporalContext.focalEra?.name || "Unknown"}
            </span>
          </div>
          {seed.temporalContext.focalEra?.summary && (
            <div className="csv-field">
              <span className="csv-field-label">Era Summary:</span>
              <span className="csv-field-value">{seed.temporalContext.focalEra.summary}</span>
            </div>
          )}
          {seed.temporalContext.temporalDescription && (
            <div className="csv-field">
              <span className="csv-field-label">Scope:</span>
              <span className="csv-field-value">
                {seed.temporalContext.temporalDescription}
              </span>
            </div>
          )}
          {seed.temporalContext.chronicleTickRange && (
            <div className="csv-field">
              <span className="csv-field-label">Ticks:</span>
              <span className="csv-field-value">
                {seed.temporalContext.chronicleTickRange[0]}&ndash;
                {seed.temporalContext.chronicleTickRange[1]}
              </span>
            </div>
          )}
          {typeof seed.temporalContext.isMultiEra === "boolean" && (
            <div className="csv-field">
              <span className="csv-field-label">Multi-era:</span>
              <span className="csv-field-value">
                {seed.temporalContext.isMultiEra ? "Yes" : "No"}
              </span>
            </div>
          )}
          {seed.temporalContext.touchedEraIds?.length ? (
            <div>
              <div className="csv-field-label-spaced">Touched Eras:</div>
              <div className="csv-id-list">
                {seed.temporalContext.touchedEraIds.map((id) => (
                  <span key={id} className="csv-id-tag">
                    {id}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Selected Events */}
      <div className="csv-section">
        <div className="csv-section-title">Events ({seed.selectedEventIds.length})</div>
        {seed.selectedEventIds.length === 0 ? (
          <div className="csv-empty-state">No events selected</div>
        ) : (
          <div className="csv-id-list">
            {seed.selectedEventIds.map((id, i) => (
              <span key={i} className="csv-id-tag">
                {eventNames?.get(id) || id}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Selected Relationships */}
      <div className="csv-section">
        <div className="csv-section-title">Relationships ({seed.selectedRelationshipIds.length})</div>
        {seed.selectedRelationshipIds.length === 0 ? (
          <div className="csv-empty-state">No relationships selected</div>
        ) : (
          <div className="csv-id-list">
            {seed.selectedRelationshipIds.map((id, i) => (
              <span key={i} className="csv-id-tag">
                {relationshipLabels?.get(id) || id}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

ChronicleSeedViewer.propTypes = {
  seed: PropTypes.shape({
    narrativeStyleId: PropTypes.string.isRequired,
    narrativeStyleName: PropTypes.string,
    entrypointId: PropTypes.string,
    entrypointName: PropTypes.string,
    narrativeDirection: PropTypes.string,
    roleAssignments: PropTypes.arrayOf(
      PropTypes.shape({
        role: PropTypes.string.isRequired,
        entityId: PropTypes.string.isRequired,
        entityName: PropTypes.string.isRequired,
        entityKind: PropTypes.string.isRequired,
        isPrimary: PropTypes.bool.isRequired,
      })
    ).isRequired,
    selectedEventIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    selectedRelationshipIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    temporalContext: PropTypes.shape({
      focalEra: PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        summary: PropTypes.string,
      }),
      chronicleTickRange: PropTypes.arrayOf(PropTypes.number),
      temporalScope: PropTypes.string,
      isMultiEra: PropTypes.bool,
      touchedEraIds: PropTypes.arrayOf(PropTypes.string),
      temporalDescription: PropTypes.string,
    }),
  }).isRequired,
  eventNames: PropTypes.instanceOf(Map),
  relationshipLabels: PropTypes.instanceOf(Map),
};

/**
 * Expandable wrapper for use in validation UI
 *
 * @param {Object} props
 * @param {ChronicleSeedData} props.seed
 * @param {Map<string, string>} [props.eventNames]
 * @param {Map<string, string>} [props.relationshipLabels]
 * @param {boolean} [props.defaultExpanded]
 */
export function ExpandableSeedSection({
  seed,
  eventNames,
  relationshipLabels,
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className="csv-expandable-container"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="csv-expandable-button"
      >
        <span>Generation Context</span>
        <span className="csv-expandable-meta">
          {expanded ? "\u25BC" : "\u25B6"} {seed.roleAssignments.length} roles, {seed.selectedEventIds.length}{" "}
          events
        </span>
      </button>
      {expanded && (
        <div className="csv-expandable-content">
          <ChronicleSeedViewer
            seed={seed}
            eventNames={eventNames}
            relationshipLabels={relationshipLabels}
          />
        </div>
      )}
    </div>
  );
}

ExpandableSeedSection.propTypes = {
  seed: ChronicleSeedViewer.propTypes.seed,
  eventNames: PropTypes.instanceOf(Map),
  relationshipLabels: PropTypes.instanceOf(Map),
  defaultExpanded: PropTypes.bool,
};

/**
 * Modal wrapper for use in chronicler wiki pages
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {ChronicleSeedData} props.seed
 * @param {Map<string, string>} [props.eventNames]
 * @param {Map<string, string>} [props.relationshipLabels]
 * @param {string} [props.title]
 */
export function SeedModal({
  isOpen,
  onClose,
  seed,
  eventNames,
  relationshipLabels,
  title = "Generation Context",
}) {
  if (!isOpen) return null;

  return (
    <div
      className="csv-modal-overlay"
      onClick={onClose}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClose(e); }}
    >
      <div
        className="csv-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
      >
        {/* Header */}
        <div className="csv-modal-header">
          <h3 className="csv-modal-title">{title}</h3>
          <button
            onClick={onClose}
            className="csv-modal-close-button"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="csv-modal-body">
          <ChronicleSeedViewer
            seed={seed}
            eventNames={eventNames}
            relationshipLabels={relationshipLabels}
          />
        </div>

        {/* Footer */}
        <div className="csv-modal-footer">
          <button
            onClick={onClose}
            className="csv-modal-footer-button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

SeedModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  seed: ChronicleSeedViewer.propTypes.seed,
  eventNames: PropTypes.instanceOf(Map),
  relationshipLabels: PropTypes.instanceOf(Map),
  title: PropTypes.string,
};
