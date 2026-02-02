/**
 * NumberInput - Reusable number input that properly handles negative numbers
 *
 * Fixes the common bug where typing a minus sign is blocked because the
 * onChange handler immediately parses and rejects "-" as invalid.
 *
 * Uses internal string state during editing, only parsing to number on blur
 * or when the full value is valid. Tracks focus state to prevent parent
 * re-renders from disrupting user input.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * @param {Object} props
 * @param {number|undefined|null} props.value - The numeric value
 * @param {Function} props.onChange - Called with the parsed number when valid
 * @param {string} [props.className] - CSS class for the input
 * @param {number} [props.min] - Minimum value
 * @param {number} [props.max] - Maximum value
 * @param {number|string} [props.step] - Step value for increment/decrement
 * @param {string} [props.placeholder] - Placeholder text
 * @param {boolean} [props.allowEmpty] - If true, empty string calls onChange(undefined)
 * @param {boolean} [props.integer] - If true, only allow integers
 * @param {boolean} [props.disabled] - Disable the input
 */
export function NumberInput({
  value,
  onChange,
  className = 'input',
  min,
  max,
  step,
  placeholder,
  allowEmpty = false,
  integer = false,
  disabled = false,
  ...rest
}) {
  // Internal string state for editing
  const [localValue, setLocalValue] = useState(() => formatValue(value));
  // Track whether user is actively editing to prevent external value sync
  const isFocusedRef = useRef(false);

  // Sync from parent when value changes externally, but NOT while user is editing
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(formatValue(value));
    }
  }, [value]);

  function formatValue(val) {
    if (val === undefined || val === null || val === '') return '';
    return String(val);
  }

  function parseValue(str) {
    if (str === '' || str === '-' || str === '.' || str === '-.') {
      return null; // Intermediate state, not a valid number yet
    }
    const parsed = integer ? parseInt(str, 10) : parseFloat(str);
    if (isNaN(parsed)) return null;
    return parsed;
  }

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;
  }, []);

  const handleChange = useCallback((e) => {
    const newValue = e.target.value;

    // Allow empty, minus sign, decimal point, or any numeric pattern
    // This regex allows intermediate states like "-", ".", "-.", "1.", "-1."
    const validPattern = integer
      ? /^-?\d*$/  // Integer: optional minus, digits only
      : /^-?\d*\.?\d*$/; // Float: optional minus, digits, optional decimal, more digits

    if (!validPattern.test(newValue)) {
      return; // Reject invalid characters
    }

    setLocalValue(newValue);

    // Try to parse and update parent if it's a complete valid number
    const parsed = parseValue(newValue);
    if (parsed !== null) {
      // Apply min/max constraints
      let constrained = parsed;
      if (min !== undefined && constrained < min) constrained = min;
      if (max !== undefined && constrained > max) constrained = max;
      onChange(constrained);
    } else if (allowEmpty && newValue === '') {
      onChange(undefined);
    }
  }, [onChange, min, max, allowEmpty, integer]);

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;

    // On blur, ensure the display value matches the actual value
    const parsed = parseValue(localValue);
    if (parsed !== null) {
      // Apply constraints and update
      let constrained = parsed;
      if (min !== undefined && constrained < min) constrained = min;
      if (max !== undefined && constrained > max) constrained = max;
      setLocalValue(formatValue(constrained));
      onChange(constrained);
    } else if (allowEmpty && localValue === '') {
      onChange(undefined);
    } else {
      // Revert to the parent's value if local is invalid
      setLocalValue(formatValue(value));
    }
  }, [localValue, value, onChange, min, max, allowEmpty]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      {...rest}
    />
  );
}

export default NumberInput;
