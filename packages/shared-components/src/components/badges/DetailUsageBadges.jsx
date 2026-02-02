/**
 * DetailUsageBadges - Context-specific usage badges
 *
 * Shows badges indicating which configuration elements reference an item:
 * - Generators (gen)
 * - Systems (sys)
 * - Actions (act)
 * - Pressures (pres)
 * - Eras (era)
 */

import React from 'react';

// Badge configurations for detail types
const BADGE_CONFIG = {
  generators: {
    label: 'gen',
    className: 'detail-badge-generator',
    tooltip: 'Referenced by generators',
  },
  systems: {
    label: 'sys',
    className: 'detail-badge-system',
    tooltip: 'Referenced by systems',
  },
  actions: {
    label: 'act',
    className: 'detail-badge-action',
    tooltip: 'Referenced by actions',
  },
  pressures: {
    label: 'pres',
    className: 'detail-badge-pressure',
    tooltip: 'Referenced by pressures',
  },
  eras: {
    label: 'era',
    labelPlural: 'eras',
    className: 'detail-badge-era',
    tooltip: 'Referenced in eras',
  },
};

/**
 * DetailUsageBadges component
 *
 * @param {Object} props
 * @param {Object} props.usage - Object with arrays of referencing items
 *   e.g., { generators: ['gen1', 'gen2'], systems: ['sys1'] }
 * @param {boolean} props.showOrphan - If true, show "Not used" when no usage (default: true)
 */
export function DetailUsageBadges({ usage = {}, showOrphan = true }) {
  const badges = [];

  for (const [type, config] of Object.entries(BADGE_CONFIG)) {
    const items = usage[type];
    if (items?.length > 0) {
      const count = items.length;
      const label = type === 'eras' && count !== 1 ? config.labelPlural : config.label;
      badges.push(
        <span
          key={type}
          className={`detail-badge ${config.className}`}
          title={`${config.tooltip}: ${items.join(', ')}`}
        >
          {count} {label}
        </span>
      );
    }
  }

  if (badges.length === 0) {
    if (showOrphan) {
      return <span className="detail-badge detail-badge-orphan">Not used</span>;
    }
    return null;
  }

  return <div className="detail-badge-container">{badges}</div>;
}

export default DetailUsageBadges;
