/**
 * EnableToggle - Toggle switch component
 */

import React from 'react';
import type { Optional } from '../types/optionality.js';

interface EnableToggleProps {
  readonly enabled: boolean;
  readonly onChange: Optional<(value: boolean) => void>;
  readonly onClick: Optional<(e: React.MouseEvent | React.KeyboardEvent) => void>;
  readonly label: Optional<string>;
  readonly className: Optional<string>;
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

