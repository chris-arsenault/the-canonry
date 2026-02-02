/**
 * SystemListCard - Card display for a system in the list view
 */

import React, { useMemo } from 'react';
import { SYSTEM_TYPES } from '../constants';
import { ErrorBadge, OrphanBadge, EraBadges, EnableToggle } from '../../shared';
import { getElementValidation } from '../../shared';

/**
 * @param {Object} props
 * @param {Object} props.system - The system to display
 * @param {Function} props.onClick - Called when card is clicked
 * @param {Function} props.onToggle - Called to toggle enabled state
 * @param {Object} props.usageMap - Schema usage map for validation
 */
export function SystemListCard({ system, onClick, onToggle, usageMap }) {
  const config = system.config;
  const sysId = config.id;
  const isEnabled = system.enabled !== false;
  const typeConfig = SYSTEM_TYPES[system.systemType] || {};

  // Get validation and usage info
  const validation = useMemo(() =>
    usageMap ? getElementValidation(usageMap, 'system', sysId) : { invalidRefs: [], isOrphan: false },
    [usageMap, sysId]
  );

  const eraUsage = useMemo(() => {
    if (!usageMap?.systems?.[sysId]) return [];
    return usageMap.systems[sysId].eras || [];
  }, [usageMap, sysId]);

  const errorCount = validation.invalidRefs.length;
  const hasErrors = errorCount > 0;
  const isOrphan = validation.isOrphan;

  const cardClassName = [
    'card card-clickable',
    !isEnabled && 'card-disabled',
    hasErrors && 'card-error',
    isOrphan && !hasErrors && 'card-warning',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClassName}
      onClick={onClick}
    >
      <div className="card-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="card-title">{config.name || config.id}</span>
            <ErrorBadge count={errorCount} />
          </div>
          <div className="card-id">{config.id}</div>
        </div>
        <EnableToggle
          enabled={isEnabled}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        />
      </div>

      <div className="card-badges">
        <span className="type-badge" style={{ backgroundColor: `${typeConfig.color}30`, color: typeConfig.color }}>
          {typeConfig.icon} {typeConfig.label}
        </span>
      </div>

      {config.description && (
        <div className="card-desc">{config.description}</div>
      )}

      <EraBadges eras={eraUsage} />
      {isOrphan && (
        <div style={{ marginTop: '8px' }}>
          <OrphanBadge isOrphan={isOrphan} />
        </div>
      )}
    </div>
  );
}
