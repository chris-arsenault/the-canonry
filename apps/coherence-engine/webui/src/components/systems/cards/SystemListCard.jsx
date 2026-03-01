/**
 * SystemListCard - Card display for a system in the list view
 */

import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { SYSTEM_TYPES } from "../constants";
import { ErrorBadge, OrphanBadge, EraBadges, EnableToggle } from "../../shared";
import { getElementValidation } from "../../shared";

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
  const validation = useMemo(
    () =>
      usageMap
        ? getElementValidation(usageMap, "system", sysId)
        : { invalidRefs: [], isOrphan: false },
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
    "card card-clickable",
    !isEnabled && "card-disabled",
    hasErrors && "card-error",
    isOrphan && !hasErrors && "card-warning",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClassName} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(e); }} >
      <div className="card-header">
        <div>
          <div className="flex items-center gap-md">
            <span className="card-title">{config.name || config.id}</span>
            <ErrorBadge count={errorCount} />
          </div>
          <div className="card-id">{config.id}</div>
        </div>
        <EnableToggle
          enabled={isEnabled}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        />
      </div>

      <div className="card-badges">
        {/* eslint-disable-next-line local/no-inline-styles -- dynamic type color from config */}
        <span
          className="type-badge"
          style={{ '--slc-type-bg': `${typeConfig.color}30`, '--slc-type-color': typeConfig.color, backgroundColor: 'var(--slc-type-bg)', color: 'var(--slc-type-color)' }}
        >
          {typeConfig.icon} {typeConfig.label}
        </span>
      </div>

      {config.description && <div className="card-desc">{config.description}</div>}

      <EraBadges eras={eraUsage} />
      {isOrphan && (
        <div className="mt-md">
          <OrphanBadge isOrphan={isOrphan} />
        </div>
      )}
    </div>
  );
}

SystemListCard.propTypes = {
  system: PropTypes.object.isRequired,
  onClick: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
  usageMap: PropTypes.object,
};
