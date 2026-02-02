/**
 * AddCard - Card button for adding new items
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {Function} props.onClick - Callback when card is clicked
 * @param {string} props.label - Button label (default "Add Item")
 * @param {string} props.className - Optional CSS class name
 */
export function AddCard({ onClick, label = 'Add Item', className = '' }) {
  return (
    <div
      className={`add-card ${className}`.trim()}
      onClick={onClick}
    >
      <span className="add-card-icon">+</span>
      <span>{label}</span>
    </div>
  );
}
