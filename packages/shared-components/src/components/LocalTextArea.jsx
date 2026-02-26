/**
 * LocalTextArea - Textarea with cursor-jumping prevention
 *
 * When editing textareas bound to external state, React can cause cursor jumping
 * because the input value gets reset on every keystroke. This component maintains
 * a local copy of the value that syncs on blur, preventing cursor jumping.
 * Tracks focus state to prevent parent re-renders from disrupting user input.
 *
 * @param {Object} props
 * @param {string} props.value - The value from external state
 * @param {Function} props.onChange - Callback when value changes (called on blur)
 * @param {string} [props.className] - CSS class name
 * @param {string} [props.placeholder] - Placeholder text
 * @param {number} [props.rows] - Number of rows
 * @param {Object} [props.style] - Additional inline styles
 *
 * @example
 * <LocalTextArea
 *   value={item.description || ''}
 *   onChange={(value) => updateItem('description', value || undefined)}
 *   className="textarea"
 *   placeholder="Enter description..."
 *   rows={3}
 * />
 */

import React, { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';

export function LocalTextArea({
  value,
  onChange,
  className = 'textarea',
  placeholder,
  rows,
  style,
  ...rest
}) {
  const [localValue, setLocalValue] = useState(value || '');
  // Track whether user is actively editing to prevent external value sync
  const isFocusedRef = useRef(false);

  // Sync local value when external value changes, but NOT while user is editing
  const prevValueRef = useRef(value);
  if (prevValueRef.current !== value) {
    prevValueRef.current = value;
    if (!isFocusedRef.current) {
      setLocalValue(value || '');
    }
  }

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;
  }, []);

  // Call onChange on blur if value changed
  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
    if (localValue !== (value || '')) {
      onChange(localValue);
    }
  }, [localValue, value, onChange]);

  return (
    <textarea
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
      rows={rows}
      style={style}
      {...rest}
    />
  );
}

LocalTextArea.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
  placeholder: PropTypes.string,
  rows: PropTypes.number,
  style: PropTypes.object,
};
