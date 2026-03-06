/**
 * ChronicleSeedViewer - Displays chronicle generation context/seed data
 *
 * Unified component used by:
 * - Chronicler wiki pages (modal view, with temporal context)
 * - Illuminator validation UI (expandable section, with narrative direction)
 */

import React, { useState } from "react";
import "./ChronicleSeedViewer.css";
import type { Optional } from '../types/optionality.js';

interface ChronicleRoleAssignment {
  role: string;
  entityId: string;
  entityName: string;
  entityKind: string;
  isPrimary: boolean;
}

interface ChronicleTemporalContext {
  focalEra: Optional<{ id: string; name: string; summary: Optional<string> }>;
  chronicleTickRange: Optional<[number, number]>;
  temporalScope: Optional<string>;
  isMultiEra: Optional<boolean>;
  touchedEraIds: Optional<string[]>;
  temporalDescription: Optional<string>;
}

interface ChronicleSeedData {
  narrativeStyleId: string;
  narrativeStyleName: Optional<string>;
  entrypointId: Optional<string>;
  entrypointName: Optional<string>;
  narrativeDirection: Optional<string>;
  roleAssignments: ChronicleRoleAssignment[];
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
  temporalContext: Optional<ChronicleTemporalContext>;
}

interface ChronicleSeedViewerProps {
  readonly seed: ChronicleSeedData;
  readonly eventNames: Optional<Map<string, string>>;
  readonly relationshipLabels: Optional<Map<string, string>>;
}

interface ExpandableSeedSectionProps {
  readonly seed: ChronicleSeedData;
  readonly eventNames: Optional<Map<string, string>>;
  readonly relationshipLabels: Optional<Map<string, string>>;
  readonly defaultExpanded: Optional<boolean>;
}

interface SeedModalProps {
  readonly isOpen: boolean;
  readonly onClose: (e?: React.MouseEvent | React.KeyboardEvent) => void;
  readonly seed: ChronicleSeedData;
  readonly eventNames: Optional<Map<string, string>>;
  readonly relationshipLabels: Optional<Map<string, string>>;
  readonly title: Optional<string>;
}
function SeedTemporalFields({ ctx }: { readonly ctx: ChronicleTemporalContext }) {
  return (
    <>
      {ctx.focalEra?.summary && (
        <div className="csv-field">
          <span className="csv-field-label">Era Summary:</span>
          <span className="csv-field-value">{ctx.focalEra.summary}</span>
        </div>
      )}
      {ctx.temporalDescription && (
        <div className="csv-field">
          <span className="csv-field-label">Scope:</span>
          <span className="csv-field-value">{ctx.temporalDescription}</span>
        </div>
      )}
      {ctx.chronicleTickRange && (
        <div className="csv-field">
          <span className="csv-field-label">Ticks:</span>
          <span className="csv-field-value">{ctx.chronicleTickRange[0]}&ndash;{ctx.chronicleTickRange[1]}</span>
        </div>
      )}
      {ctx.isMultiEra != null && (
        <div className="csv-field">
          <span className="csv-field-label">Multi-era:</span>
          <span className="csv-field-value">{ctx.isMultiEra ? "Yes" : "No"}</span>
        </div>
      )}
      {ctx.touchedEraIds?.length ? (
        <div>
          <div className="csv-field-label-spaced">Touched Eras:</div>
          <div className="csv-id-list">
            {ctx.touchedEraIds.map((id) => <span key={id} className="csv-id-tag">{id}</span>)}
          </div>
        </div>
      ) : null}
    </>
  );
}

function SeedTemporalContext({ ctx }: { readonly ctx: ChronicleTemporalContext }) {
  return (
    <div className="csv-block">
      <div className="csv-block-title">Temporal Context</div>
      <div className="csv-field">
        <span className="csv-field-label">Focal Era:</span>
        <span className="csv-field-value">{ctx.focalEra?.name || "Unknown"}</span>
      </div>
      <SeedTemporalFields ctx={ctx} />
    </div>
  );
}

function SeedRoleList({ roles }: { readonly roles: ChronicleRoleAssignment[] }) {
  if (roles.length === 0) return <div className="csv-no-data">No roles assigned</div>;
  const primary = roles.filter((r) => r.isPrimary);
  const supporting = roles.filter((r) => !r.isPrimary);
  return (
    <div className="csv-role-list">
      {primary.map((role, i) => (
        <div key={`primary-${i}`} className="csv-role-item">
          <span className="csv-primary-role-badge">{role.role}</span>
          <span className="csv-entity-name">{role.entityName}</span>
          <span className="csv-entity-kind">({role.entityKind})</span>
        </div>
      ))}
      {supporting.map((role, i) => (
        <div key={`supporting-${i}`} className="csv-role-item">
          <span className="csv-supporting-role-badge">{role.role}</span>
          <span className="csv-entity-name">{role.entityName}</span>
          <span className="csv-entity-kind">({role.entityKind})</span>
        </div>
      ))}
    </div>
  );
}

function SeedIdList({ ids, labels }: { readonly ids: string[]; readonly labels: Optional<Map<string, string>> }) {
  if (ids.length === 0) return <div className="csv-no-data">None selected</div>;
  return (
    <div className="csv-id-list">
      {ids.map((id, i) => <span key={i} className="csv-id-tag">{labels?.get(id) || id}</span>)}
    </div>
  );
}

export default function ChronicleSeedViewer({ seed, eventNames, relationshipLabels }: ChronicleSeedViewerProps) {
  return (
    <div className="csv-container">
      <div className="csv-block">
        <div className="csv-block-title">Generation Settings</div>
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
            <div className="csv-narrative-direction-label">Narrative Direction:</div>
            <div className="csv-narrative-direction-body" title="Click to copy"
              onClick={() => void navigator.clipboard.writeText(seed.narrativeDirection)}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}>
              {seed.narrativeDirection}
            </div>
          </div>
        )}
      </div>
      <div className="csv-block">
        <div className="csv-block-title">Cast ({seed.roleAssignments.length} entities)</div>
        <SeedRoleList roles={seed.roleAssignments} />
      </div>
      {seed.temporalContext && <SeedTemporalContext ctx={seed.temporalContext} />}
      <div className="csv-block">
        <div className="csv-block-title">Events ({seed.selectedEventIds.length})</div>
        <SeedIdList ids={seed.selectedEventIds} labels={eventNames} />
      </div>
      <div className="csv-block">
        <div className="csv-block-title">Relationships ({seed.selectedRelationshipIds.length})</div>
        <SeedIdList ids={seed.selectedRelationshipIds} labels={relationshipLabels} />
      </div>
    </div>
  );
}

/**
 * Expandable wrapper for use in validation UI
 */
export function ExpandableSeedSection({
  seed,
  eventNames,
  relationshipLabels,
  defaultExpanded = false,
}: ExpandableSeedSectionProps) {
  // eslint-disable-next-line local/no-manual-expand-state -- needs defaultExpanded prop; useExpandBoolean doesn't accept initial value
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

/**
 * Modal wrapper for use in chronicler wiki pages
 */
export function SeedModal({
  isOpen,
  onClose,
  seed,
  eventNames,
  relationshipLabels,
  title = "Generation Context",
}: SeedModalProps) {
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
