/**
 * ChronicleSeedViewer - Displays chronicle generation context/seed data
 *
 * Used in:
 * - Validation UI (expandable section)
 * - Chronicler (modal view)
 */

import React from "react";
import type { ChronicleRoleAssignment } from "../lib/chronicleTypes";

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

const styles = {
  container: {
    fontSize: "13px",
    color: "var(--text-secondary)",
  },
  section: {
    marginBottom: "16px",
  },
  sectionTitle: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    marginBottom: "8px",
  },
  field: {
    display: "flex",
    gap: "8px",
    marginBottom: "4px",
  },
  fieldLabel: {
    color: "var(--text-muted)",
    minWidth: "80px",
  },
  fieldValue: {
    color: "var(--text-primary)",
  },
  roleList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  },
  roleItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 10px",
    background: "var(--bg-tertiary)",
    borderRadius: "4px",
    fontSize: "12px",
  },
  roleBadge: {
    padding: "2px 6px",
    borderRadius: "3px",
    fontSize: "10px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
  },
  primaryBadge: {
    background: "var(--accent-color)",
    color: "white",
  },
  supportingBadge: {
    background: "var(--bg-secondary)",
    color: "var(--text-muted)",
    border: "1px solid var(--border-color)",
  },
  entityName: {
    fontWeight: 500,
  },
  entityKind: {
    color: "var(--text-muted)",
    fontSize: "11px",
  },
  idList: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "4px",
  },
  idTag: {
    padding: "2px 8px",
    background: "var(--bg-tertiary)",
    borderRadius: "3px",
    fontSize: "11px",
    fontFamily: "monospace",
  },
  emptyState: {
    color: "var(--text-muted)",
    fontStyle: "italic" as const,
  },
  narrativeDirectionWrapper: {
    marginTop: "8px",
  },
  narrativeDirectionLabel: {
    fontSize: "11px",
    color: "var(--text-muted)",
    marginBottom: "4px",
  },
  narrativeDirectionBody: {
    fontSize: "12px",
    lineHeight: 1.5,
    color: "var(--text-primary)",
    padding: "8px 10px",
    background: "var(--bg-tertiary)",
    borderRadius: "4px",
    borderLeft: "3px solid var(--accent-color)",
    whiteSpace: "pre-wrap" as const,
    cursor: "pointer",
  },
  primaryRoleBadge: {
    padding: "2px 6px",
    borderRadius: "3px",
    fontSize: "10px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    background: "var(--accent-color)",
    color: "white",
  },
  supportingRoleBadge: {
    padding: "2px 6px",
    borderRadius: "3px",
    fontSize: "10px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    background: "var(--bg-secondary)",
    color: "var(--text-muted)",
    border: "1px solid var(--border-color)",
  },
  expandableContainer: {
    marginBottom: "16px",
    background: "var(--bg-secondary)",
    borderRadius: "8px",
    border: "1px solid var(--border-color)",
    overflow: "hidden" as const,
  },
  expandableButton: {
    width: "100%",
    padding: "12px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--bg-tertiary)",
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--text-primary)",
  },
  expandableMeta: { fontSize: "11px", color: "var(--text-muted)" },
  expandableContent: { padding: "16px" },
  modalOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0, 0, 0, 0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalDialog: {
    background: "var(--bg-primary)",
    borderRadius: "12px",
    maxWidth: "600px",
    width: "90%",
    maxHeight: "80vh",
    overflow: "hidden" as const,
    display: "flex",
    flexDirection: "column" as const,
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid var(--border-color)",
  },
  modalTitle: { margin: 0, fontSize: "16px" },
  modalCloseButton: {
    background: "none",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    color: "var(--text-muted)",
    padding: "4px 8px",
  },
  modalBody: { padding: "20px", overflowY: "auto" as const },
  modalFooter: {
    padding: "12px 20px",
    borderTop: "1px solid var(--border-color)",
    display: "flex",
    justifyContent: "flex-end",
  },
  modalFooterButton: {
    padding: "8px 16px",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border-color)",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
  },
} as const;

export default function ChronicleSeedViewer({
  seed,
  eventNames,
  relationshipLabels,
}: Readonly<ChronicleSeedViewerProps>) {
  const primaryRoles = seed.roleAssignments.filter((r) => r.isPrimary);
  const supportingRoles = seed.roleAssignments.filter((r) => !r.isPrimary);

  return (
    <div style={styles.container}>
      {/* Style & Entry Point */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Generation Settings</div>
        <div style={styles.field}>
          <span style={styles.fieldLabel}>Style:</span>
          <span style={styles.fieldValue}>{seed.narrativeStyleName || seed.narrativeStyleId}</span>
        </div>
        {seed.entrypointId && (
          <div style={styles.field}>
            <span style={styles.fieldLabel}>Entry Point:</span>
            <span style={styles.fieldValue}>{seed.entrypointName || seed.entrypointId}</span>
          </div>
        )}
        {seed.narrativeDirection && (
          <div style={styles.narrativeDirectionWrapper}>
            <div style={styles.narrativeDirectionLabel}>
              Narrative Direction:
            </div>
            <div
              style={styles.narrativeDirectionBody}
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
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Cast ({seed.roleAssignments.length} entities)</div>
        {seed.roleAssignments.length === 0 ? (
          <div style={styles.emptyState}>No roles assigned</div>
        ) : (
          <div style={styles.roleList}>
            {/* Primary roles first */}
            {primaryRoles.map((role, i) => (
              <div key={`primary-${i}`} style={styles.roleItem}>
                <span style={styles.primaryRoleBadge}>{role.role}</span>
                <span style={styles.entityName}>{role.entityName}</span>
                <span style={styles.entityKind}>({role.entityKind})</span>
              </div>
            ))}
            {/* Supporting roles */}
            {supportingRoles.map((role, i) => (
              <div key={`supporting-${i}`} style={styles.roleItem}>
                <span style={styles.supportingRoleBadge}>{role.role}</span>
                <span style={styles.entityName}>{role.entityName}</span>
                <span style={styles.entityKind}>({role.entityKind})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Events */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Events ({seed.selectedEventIds.length})</div>
        {seed.selectedEventIds.length === 0 ? (
          <div style={styles.emptyState}>No events selected</div>
        ) : (
          <div style={styles.idList}>
            {seed.selectedEventIds.map((id, i) => (
              <span key={i} style={styles.idTag}>
                {eventNames?.get(id) || id}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Selected Relationships */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Relationships ({seed.selectedRelationshipIds.length})</div>
        {seed.selectedRelationshipIds.length === 0 ? (
          <div style={styles.emptyState}>No relationships selected</div>
        ) : (
          <div style={styles.idList}>
            {seed.selectedRelationshipIds.map((id, i) => (
              <span key={i} style={styles.idTag}>
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
      style={styles.expandableContainer}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={styles.expandableButton}
      >
        <span>Generation Context</span>
        <span style={styles.expandableMeta}>
          {expanded ? "▼" : "▶"} {seed.roleAssignments.length} roles, {seed.selectedEventIds.length}{" "}
          events
        </span>
      </button>
      {expanded && (
        <div style={styles.expandableContent}>
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
      style={styles.modalOverlay}
      onClick={onClose}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClose(e); }}
    >
      <div
        style={styles.modalDialog}
        onClick={(e) => e.stopPropagation()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
      >
        {/* Header */}
        <div
          style={styles.modalHeader}
        >
          <h3 style={styles.modalTitle}>{title}</h3>
          <button
            onClick={onClose}
            style={styles.modalCloseButton}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={styles.modalBody}>
          <ChronicleSeedViewer
            seed={seed}
            eventNames={eventNames}
            relationshipLabels={relationshipLabels}
          />
        </div>

        {/* Footer */}
        <div
          style={styles.modalFooter}
        >
          <button
            onClick={onClose}
            style={styles.modalFooterButton}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
