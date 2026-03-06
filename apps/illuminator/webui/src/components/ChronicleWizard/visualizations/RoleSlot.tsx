/**
 * RoleSlot - Click target for assigning entities to roles
 *
 * Shows role name and assigned entities in a compact format.
 * Highlights when an entity is selected and can be assigned.
 */

import type { RoleDefinition } from "@canonry/world-schema";
import type { ChronicleRoleAssignment } from "../../../lib/chronicleTypes";
import React from "react";
import "./RoleSlot.css";

interface RoleSlotProps {
  role: RoleDefinition;
  assignments: ChronicleRoleAssignment[];
  /** Is there a selected entity ready to assign? */
  hasSelection: boolean;
  /** Is the role at max capacity? */
  isAtMax: boolean;
  /** Is the role under minimum? */
  isUnderMin: boolean;
  /** Callback when role is clicked (to assign selected entity) */
  onAssign: () => void;
  /** Callback when assignment is removed */
  onRemove: (entityId: string) => void;
  /** Callback when primary is toggled */
  onTogglePrimary: (entityId: string) => void;
}

export default function RoleSlot({
  role,
  assignments,
  hasSelection,
  isAtMax,
  isUnderMin,
  onAssign,
  onRemove,
  onTogglePrimary,
}: Readonly<RoleSlotProps>) {
  const canAccept = hasSelection && !isAtMax;
  const count = assignments.length;

  const altStateClass = isUnderMin ? "rs-wrap-undermin" : "rs-wrap-default";
  const wrapStateClass = canAccept ? "rs-wrap-accept" : altStateClass;
  const wrapClass = `rs-wrap ${wrapStateClass}`;

  return (
    <div
      onClick={canAccept ? onAssign : undefined}
      className={wrapClass}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
    >
      {/* Role header - single line */}
      <div className={`rs-header ${assignments.length > 0 || canAccept ? "rs-header-mb" : ""}`}>
        <div className="rs-name-row">
          <span className={`rs-role-name ${isUnderMin ? "rs-role-name-error" : "rs-role-name-default"}`}>
            {role.role}
          </span>
          <span className={`rs-role-count ${isUnderMin ? "rs-role-count-error" : "rs-role-count-default"}`}>
            {count}/{role.count.max}
          </span>
        </div>

        {canAccept && (
          <span className="rs-add-label">
            + Add
          </span>
        )}
      </div>

      {/* Assigned entities - visually distinct from header */}
      {assignments.length > 0 && (
        <div className="rs-assignments">
          {assignments.map((assignment) => (
            <div
              key={assignment.entityId}
              className="rs-assignment-row"
              onClick={(e) => e.stopPropagation()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
            >
              {/* Entity name */}
              <span className="rs-entity-name">
                {assignment.entityName}
                <span className="rs-entity-kind">
                  {assignment.entityKind}
                </span>
              </span>

              {/* Primary/Support toggle - full text, more button-like */}
              <button
                onClick={() => onTogglePrimary(assignment.entityId)}
                className={`rs-toggle-btn ${assignment.isPrimary ? "rs-toggle-btn-primary" : "rs-toggle-btn-support"}`}
                title="Click to toggle primary/support"
              >
                {assignment.isPrimary ? "Primary" : "Support"}
              </button>

              {/* Remove button */}
              <button
                onClick={() => onRemove(assignment.entityId)}
                className="rs-remove-btn"
                title="Remove from role"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
