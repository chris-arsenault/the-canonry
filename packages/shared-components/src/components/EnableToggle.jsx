/**
 * EnableToggle - Toggle switch component
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * @param {Object} props
 * @param {boolean} props.enabled - Current toggle state
 * @param {Function} props.onChange - Callback when toggle changes (receives new value)
 * @param {Function} [props.onClick] - Optional raw click handler (receives event, takes priority)
 * @param {string} [props.label] - Optional label beside the toggle
 * @param {string} [props.className] - Optional additional class names
 */
export function EnableToggle({ enabled, onChange, onClick, label, className = '' }) {
  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    } else if (onChange) {
      onChange(!enabled);
    }
  };

  return (
    <div className={`flex items-center gap-lg ${className}`.trim()}>
      <div
        onClick={handleClick}
        className={`toggle ${enabled ? 'toggle-on' : ''}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(e); }}
      >
        <div className="toggle-knob" />
      </div>
      {label && (
        <span className="text-md text-muted">{label}</span>
      )}
    </div>
  );
}

export default EnableToggle;

EnableToggle.propTypes = {
  enabled: PropTypes.bool.isRequired,
  onChange: PropTypes.func,
  onClick: PropTypes.func,
  label: PropTypes.string,
  className: PropTypes.string,
};
