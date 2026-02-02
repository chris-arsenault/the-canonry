/**
 * AddItemButton - Dashed button for adding new items within a section
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {Function} props.onClick - Callback when button is clicked
 * @param {string} props.label - Button label text (default "Add Item")
 * @param {string} props.className - Optional CSS class name
 */
export function AddItemButton({ onClick, label = 'Add Item', className = '' }) {
  return (
    <button
      className={`btn-add ${className}`.trim()}
      onClick={onClick}
    >
      + {label}
    </button>
  );
}
