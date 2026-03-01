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

import React, { useState, useCallback } from 'react';

interface LocalTextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  readonly value?: string;
  readonly onChange: (value: string) => void;
  readonly className?: string;
  readonly placeholder?: string;
  readonly rows?: number;
}

export function LocalTextArea({
  value,
  onChange,
  className = 'textarea',
  placeholder,
  rows,
  ...rest
}: LocalTextAreaProps) {
  const externalValue = value || '';
  const [localValue, setLocalValue] = useState(externalValue);
  // Track focus in state so render can safely choose between local draft vs external value
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setLocalValue(externalValue);
    setIsFocused(true);
  }, [externalValue]);

  // Call onChange on blur if value changed
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (localValue !== externalValue) {
      onChange(localValue);
    }
  }, [externalValue, localValue, onChange]);

  return (
    <textarea
      value={isFocused ? localValue : externalValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
      rows={rows}
      {...rest}
    />
  );
}
