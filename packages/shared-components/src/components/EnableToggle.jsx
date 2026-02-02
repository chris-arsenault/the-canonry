/**
 * EnableToggle - Toggle switch component
 */

import React from 'react';

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
    <div className={`flex gap-lg ${className}`.trim()} style={{ alignItems: 'center' }}>
      <div
        onClick={handleClick}
        className={`toggle ${enabled ? 'toggle-on' : ''}`}
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
