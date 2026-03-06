/**
 * EraBadges - Displays era usage badges for items
 */

import React from 'react';
import type { Optional } from '../types/optionality.js';

interface Era {
  id: string;
  name: Optional<string>;
}

interface EraBadgesProps {
  readonly eras: Optional<Era[]>;
  readonly maxVisible: Optional<number>;
  readonly className: Optional<string>;
}

const ERA_ICON = '🕰️';

/**
 * @param {Object} props
 * @param {Array} props.eras - Array of era objects with id and name
 * @param {number} props.maxVisible - Maximum number of badges to show (default 3)
 * @param {string} [props.className] - Additional class names
 */
export function EraBadges({ eras = [], maxVisible = 3, className = '' }: EraBadgesProps) {
  if (!eras.length) return null;

  const visible = eras.slice(0, maxVisible);
  const remaining = eras.length - maxVisible;

  return (
    <div className={`chip-container mt-md ${className}`.trim()}>
      {visible.map((era) => (
        <span key={era.id} className="badge badge-era">
          <span className="badge-era-icon">{ERA_ICON}</span> {era.name || era.id}
        </span>
      ))}
      {remaining > 0 && (
        <span className="badge badge-era badge-era-remaining">
          +{remaining} more
        </span>
      )}
    </div>
  );
}
