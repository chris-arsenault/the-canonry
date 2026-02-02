/**
 * ActionListCard - Card display for an action in the list view
 */

import React, { useMemo } from 'react';
import { getElementValidation } from '../../shared';

export function ActionListCard({ action, onClick, onToggle, usageMap }) {
  const isEnabled = action.enabled !== false;
  const pressureMods = action.probability?.pressureModifiers || [];

  // Get validation info
  const validation = useMemo(() =>
    usageMap ? getElementValidation(usageMap, 'action', action.id) : { invalidRefs: [], compatibility: [], isOrphan: false },
    [usageMap, action.id]
  );

  const hasErrors = validation.invalidRefs.length > 0;
  const hasCompatibilityIssues = validation.compatibility?.length > 0;

  const formatActorKinds = () => {
    const selection = action.actor?.selection;
    if (!selection) return 'any';
    if (selection.kind) return selection.kind;
    if (selection.kinds?.length) return selection.kinds.join(', ');
    return selection.strategy || 'any';
  };

  const formatTargetKind = () => {
    const targeting = action.targeting;
    if (!targeting) return 'none';
    if (targeting.kind) return targeting.kind;
    if (targeting.kinds?.length) return targeting.kinds.join(', ');
    return targeting.strategy || 'none';
  };

  const cardClasses = [
    'card card-clickable',
    !isEnabled && 'card-disabled',
    hasErrors && 'card-error',
    hasCompatibilityIssues && !hasErrors && 'card-warning',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClasses}
      onClick={onClick}
    >
      <div className="card-header">
        <div>
          <div className="flex items-center gap-md">
            <span className="card-title">{action.name || action.id}</span>
            {hasErrors && (
              <span className="badge badge-validation badge-error">
                {validation.invalidRefs.length} error{validation.invalidRefs.length !== 1 ? 's' : ''}
              </span>
            )}
            {hasCompatibilityIssues && !hasErrors && (
              <span className="badge badge-validation badge-compatibility">
                {validation.compatibility.length} warning{validation.compatibility.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="card-id">{action.id}</div>
        </div>
        <div
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={isEnabled ? 'toggle toggle-on' : 'toggle'}
        >
          <div className="toggle-knob" />
        </div>
      </div>

      <div className="card-badges">
        <span className="badge badge-actor">
          {formatActorKinds()}
        </span>
        <span className="badge badge-target">
          → {formatTargetKind()}
        </span>
        {pressureMods.length > 0 && (
          <span className="badge badge-pressure">
            {pressureMods.length} pressure{pressureMods.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {action.description && (
        <div className="card-desc">{action.description}</div>
      )}
    </div>
  );
}
