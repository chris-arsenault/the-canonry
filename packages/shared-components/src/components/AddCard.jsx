/**
 * AddCard - Card button for adding new items
 */

import React from 'react';
import PropTypes from 'prop-types';

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
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(e); }}
    >
      <span className="add-card-icon">+</span>
      <span>{label}</span>
    </div>
  );
}

AddCard.propTypes = {
  onClick: PropTypes.func.isRequired,
  label: PropTypes.string,
  className: PropTypes.string,
};
