/**
 * AddItemButton - Dashed button for adding new items within a section
 */

import React from 'react';
import type { Optional } from '../types/optionality.js';

interface AddItemButtonProps {
  readonly onClick: (e: React.MouseEvent) => void;
  readonly label: Optional<string>;
  readonly className: Optional<string>;
}

/**
 * @param {Object} props
 * @param {Function} props.onClick - Callback when button is clicked
 * @param {string} props.label - Button label text (default "Add Item")
 * @param {string} props.className - Optional CSS class name
 */
export function AddItemButton({ onClick, label = 'Add Item', className = '' }: AddItemButtonProps) {
  return (
    <button
      className={`btn-add ${className}`.trim()}
      onClick={onClick}
    >
      + {label}
    </button>
  );
}
