/**
 * RoleSlot - Click target for assigning entities to roles
 *
 * Shows role name and assigned entities in a compact format.
 * Highlights when an entity is selected and can be assigned.
 */

import type { RoleDefinition } from '@canonry/world-schema';
import type { ChronicleRoleAssignment } from '../../../lib/chronicleTypes';

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
}: RoleSlotProps) {
  const canAccept = hasSelection && !isAtMax;
  const count = assignments.length;

  return (
    <div
      onClick={canAccept ? onAssign : undefined}
      style={{
        padding: '8px 10px',
        background: canAccept ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)',
        borderRadius: '6px',
        borderLeft: isUnderMin
          ? '3px solid var(--error)'
          : canAccept
          ? '3px solid var(--accent-color)'
          : '3px solid transparent',
        cursor: canAccept ? 'pointer' : 'default',
        transition: 'background 0.15s ease',
      }}
    >
      {/* Role header - single line */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: assignments.length > 0 || canAccept ? '6px' : 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontWeight: 600,
            fontSize: '11px',
            textTransform: 'capitalize',
            color: isUnderMin ? 'var(--error)' : 'var(--text-primary)',
          }}>
            {role.role}
          </span>
          <span style={{
            fontSize: '9px',
            color: isUnderMin ? 'var(--error)' : 'var(--text-muted)',
          }}>
            {count}/{role.count.max}
          </span>
        </div>

        {canAccept && (
          <span style={{
            fontSize: '9px',
            color: 'var(--accent-color)',
            fontWeight: 500,
          }}>
            + Add
          </span>
        )}
      </div>

      {/* Assigned entities - visually distinct from header */}
      {assignments.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          marginLeft: '8px',
          paddingLeft: '8px',
          borderLeft: '2px solid var(--border-color)',
        }}>
          {assignments.map(assignment => (
            <div
              key={assignment.entityId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 6px',
                background: 'var(--bg-tertiary)',
                borderRadius: '4px',
                fontSize: '10px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Entity name */}
              <span style={{ flex: 1, fontWeight: 500 }}>
                {assignment.entityName}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px', fontSize: '9px' }}>
                  {assignment.entityKind}
                </span>
              </span>

              {/* Primary/Support toggle - full text, more button-like */}
              <button
                onClick={() => onTogglePrimary(assignment.entityId)}
                style={{
                  padding: '2px 6px',
                  background: assignment.isPrimary ? 'var(--accent-color)' : 'var(--bg-secondary)',
                  color: assignment.isPrimary ? 'white' : 'var(--text-muted)',
                  border: '1px solid',
                  borderColor: assignment.isPrimary ? 'var(--accent-color)' : 'var(--border-color)',
                  borderRadius: '3px',
                  fontSize: '9px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
                title="Click to toggle primary/support"
              >
                {assignment.isPrimary ? 'Primary' : 'Support'}
              </button>

              {/* Remove button */}
              <button
                onClick={() => onRemove(assignment.entityId)}
                style={{
                  width: '16px',
                  height: '16px',
                  padding: 0,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '3px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
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
