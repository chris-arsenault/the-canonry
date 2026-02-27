/**
 * ChronicleSeedViewer - Displays chronicle generation context/seed data
 *
 * Used in:
 * - Validation UI (expandable section)
 * - Chronicler (modal view)
 */

import React from "react";
import type { ChronicleRoleAssignment } from "../lib/chronicleTypes";
import "./ChronicleSeedViewer.css";

export interface ChronicleSeedData {
  narrativeStyleId: string;
  narrativeStyleName?: string;
  entrypointId?: string;
  entrypointName?: string;
  narrativeDirection?: string;
  roleAssignments: ChronicleRoleAssignment[];
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
}

interface ChronicleSeedViewerProps {
  seed: ChronicleSeedData;
  // Optional: resolved names for display
  eventNames?: Map<string, string>;
  relationshipLabels?: Map<string, string>;
}

export default function ChronicleSeedViewer({
  seed,
  eventNames,
  relationshipLabels,
}: Readonly<ChronicleSeedViewerProps>) {
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
            {/* Primary roles first */}
            {primaryRoles.map((role, i) => (
              <div key={`primary-${i}`} className="csv-role-item">
                <span className="csv-primary-role-badge">{role.role}</span>
                <span className="csv-entity-name">{role.entityName}</span>
                <span className="csv-entity-kind">({role.entityKind})</span>
              </div>
            ))}
            {/* Supporting roles */}
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

/**
 * Expandable wrapper for use in validation UI
 */
interface ExpandableSeedSectionProps {
  seed: ChronicleSeedData;
  eventNames?: Map<string, string>;
  relationshipLabels?: Map<string, string>;
  defaultExpanded?: boolean;
}

export function ExpandableSeedSection({
  seed,
  eventNames,
  relationshipLabels,
  defaultExpanded = false,
}: Readonly<ExpandableSeedSectionProps>) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

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

/**
 * Modal wrapper for use in chronicler
 */
interface SeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  seed: ChronicleSeedData;
  eventNames?: Map<string, string>;
  relationshipLabels?: Map<string, string>;
  title?: string;
}

export function SeedModal({
  isOpen,
  onClose,
  seed,
  eventNames,
  relationshipLabels,
  title = "Generation Context",
}: Readonly<SeedModalProps>) {
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
        <div
          className="csv-modal-header"
        >
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
        <div
          className="csv-modal-footer"
        >
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
