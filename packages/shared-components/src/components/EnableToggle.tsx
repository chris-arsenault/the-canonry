/**
 * EnableToggle - Toggle switch component
 */

import React from 'react';

interface EnableToggleProps {
  enabled: boolean;
  onChange?: (value: boolean) => void;
  onClick?: (e: React.MouseEvent | React.KeyboardEvent) => void;
  label?: string;
  className?: string;
}

/**
 * @param {Object} props
 * @param {boolean} props.enabled - Current toggle state
 * @param {Function} props.onChange - Callback when toggle changes (receives new value)
 * @param {Function} [props.onClick] - Optional raw click handler (receives event, takes priority)
 * @param {string} [props.label] - Optional label beside the toggle
 * @param {string} [props.className] - Optional additional class names
 */
export function EnableToggle({ enabled, onChange, onClick, label, className = '' }: EnableToggleProps) {
  const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
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

