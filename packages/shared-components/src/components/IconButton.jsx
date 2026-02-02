/**
 * IconButton - Small icon-only button
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {string} props.icon - Icon content (emoji or text)
 * @param {Function} props.onClick - Callback when button is clicked
 * @param {boolean} [props.danger] - Apply danger styling
 * @param {string} [props.title] - Tooltip text
 * @param {string} [props.className] - Optional additional class names
 */
export function IconButton({ icon, onClick, danger, title, className = '' }) {
  const classes = [
    'btn-icon',
    danger ? 'btn-icon-danger' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      title={title}
    >
      {icon}
    </button>
  );
}

export default IconButton;
