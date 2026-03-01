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

interface BadgeConfig {
  label: string;
  labelPlural?: string;
  className: string;
  tooltip: string;
}

interface DetailUsageBadgesProps {
  usage?: Record<string, string[]>;
  showOrphan?: boolean;
}

// Badge configurations for detail types
const BADGE_CONFIG: Record<string, BadgeConfig> = {
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

export function DetailUsageBadges({ usage = {}, showOrphan = true }: DetailUsageBadgesProps) {
  const badges: React.ReactNode[] = [];

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
