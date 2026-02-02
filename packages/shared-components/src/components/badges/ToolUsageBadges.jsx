/**
 * ToolUsageBadges - Cross-tool usage badges
 *
 * Shows badges indicating where an item is used across different tools:
 * - Name Forge (naming profiles)
 * - Seed (seed entities)
 * - Coherence (coherence engine)
 * - Lore Weave (simulation)
 */

import React from 'react';

// Badge configurations for different tool types
const BADGE_CONFIG = {
  nameforge: {
    label: 'Name Forge',
    icon: '\u270E',
    className: 'tool-badge-nameforge',
    tooltip: 'Used in Name Forge profiles',
  },
  seed: {
    label: 'Seed',
    icon: '\u25C9',
    className: 'tool-badge-seed',
    tooltip: 'Used in seed entities',
  },
  generators: {
    label: 'Gen',
    icon: '\u2728', // sparkles
    className: 'tool-badge-generators',
    tooltip: 'Used in generators (creation, applicability, effects)',
  },
  systems: {
    label: 'Sys',
    icon: '\u2699', // gear
    className: 'tool-badge-systems',
    tooltip: 'Used in systems (tag diffusion, triggers)',
  },
  pressures: {
    label: 'Pres',
    icon: '\u2191', // up arrow
    className: 'tool-badge-pressures',
    tooltip: 'Used in pressure feedback factors',
  },
  axis: {
    label: 'Axis',
    icon: '\u2194', // left-right arrow
    className: 'tool-badge-axis',
    tooltip: 'Semantic plane axis label',
  },
  coherence: {
    label: 'Coherence',
    icon: '\u2699',
    className: 'tool-badge-coherence',
    tooltip: 'Used in Coherence Engine',
  },
  loreweave: {
    label: 'Lore Weave',
    icon: '\u25C8',
    className: 'tool-badge-loreweave',
    tooltip: 'Used in Lore Weave',
  },
};

/**
 * ToolUsageBadges component
 *
 * @param {Object} props
 * @param {Object} props.usage - Object with usage counts by tool
 *   e.g., { nameforge: 3, coherence: 1 }
 * @param {boolean} props.compact - If true, show only icons without labels
 * @param {boolean} props.showZero - If true, show badges even when count is 0
 */
export function ToolUsageBadges({ usage = {}, compact = false, showZero = false }) {
  const badges = Object.entries(usage)
    .filter(([type, count]) => showZero || count > 0)
    .filter(([type]) => BADGE_CONFIG[type]);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="tool-badge-container">
      {badges.map(([type, count]) => {
        const config = BADGE_CONFIG[type];
        return (
          <span
            key={type}
            className={`tool-badge ${config.className}`}
            title={`${config.tooltip}${count > 1 ? ` (${count} uses)` : ''}`}
          >
            <span className="tool-badge-icon">{config.icon}</span>
            {!compact && <span className="tool-badge-label">{config.label}</span>}
            {count > 1 && <span className="tool-badge-count">&times;{count}</span>}
          </span>
        );
      })}
    </div>
  );
}

export default ToolUsageBadges;
