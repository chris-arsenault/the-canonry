/**
 * EraBadges - Displays era usage badges for items
 */

import React from 'react';

const ERA_ICON = '🕰️';

/**
 * @param {Object} props
 * @param {Array} props.eras - Array of era objects with id and name
 * @param {number} props.maxVisible - Maximum number of badges to show (default 3)
 * @param {string} [props.className] - Additional class names
 */
export function EraBadges({ eras = [], maxVisible = 3, className = '' }) {
  if (!eras.length) return null;

  const visible = eras.slice(0, maxVisible);
  const remaining = eras.length - maxVisible;

  return (
    <div className={`chip-container mt-md ${className}`.trim()}>
      {visible.map((era) => (
        <span key={era.id} className="badge badge-era">
          <span style={{ opacity: 0.7 }}>{ERA_ICON}</span> {era.name || era.id}
        </span>
      ))}
      {remaining > 0 && (
        <span className="badge badge-era" style={{ backgroundColor: 'transparent' }}>
          +{remaining} more
        </span>
      )}
    </div>
  );
}
