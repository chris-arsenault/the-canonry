/**
 * AddCard - Card button for adding new items
 */

import React from 'react';
import type { Optional } from '../types/optionality.js';

interface AddCardProps {
  readonly onClick: (e: React.MouseEvent | React.KeyboardEvent) => void;
  readonly label: Optional<string>;
  readonly className: Optional<string>;
}

/**
 * @param {Object} props
 * @param {Function} props.onClick - Callback when card is clicked
 * @param {string} props.label - Button label (default "Add Item")
 * @param {string} props.className - Optional CSS class name
 */
export function AddCard({ onClick, label = 'Add Item', className = '' }: AddCardProps) {
  return (
    <div
      className={`add-card ${className}`.trim()}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(e); }}
    >
      <span className="add-card-icon">+</span>
      <span>{label}</span>
    </div>
  );
}
