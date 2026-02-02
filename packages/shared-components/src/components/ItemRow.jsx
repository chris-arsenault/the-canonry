/**
 * ItemRow - Flexible row layout for list items with remove button
 *
 * Provides consistent styling for rows in item lists with:
 * - Name/label on left
 * - Custom controls in middle (passed as children)
 * - Remove button on right
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {string} props.name - Display name
 * @param {boolean} [props.muted] - Apply muted styling to name
 * @param {Function} [props.onRemove] - Called when remove button clicked
 * @param {string} [props.removeTitle] - Tooltip for remove button
 * @param {React.ReactNode} props.children - Controls to render between name and remove
 * @param {string} [props.className] - Additional class names
 */
export function ItemRow({
  name,
  muted,
  onRemove,
  removeTitle = 'Remove',
  children,
  className = '',
}) {
  return (
    <div className={`item-row ${className}`.trim()}>
      <span className={`item-row-name ${muted ? 'item-row-name-muted' : ''}`}>
        {name}
      </span>
      {children}
      {onRemove && (
        <button
          className="item-row-remove"
          onClick={onRemove}
          title={removeTitle}
        >
          ×
        </button>
      )}
    </div>
  );
}
