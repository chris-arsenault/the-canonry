/**
 * useLocalInputState - Hook for managing local input state with cursor-jumping prevention
 *
 * When editing text inputs bound to external state, React can cause cursor jumping
 * because the input value gets reset on every keystroke. This hook maintains a local
 * copy of the value that syncs on blur, preventing cursor jumping while keeping
 * the external state in sync.
 *
 * @param {string} externalValue - The value from external state (props)
 * @param {Function} onUpdate - Callback to update external state (called on blur if changed)
 * @returns {[string, Function, Function]} [localValue, setLocalValue, handleBlur]
 *
 * @example
 * const [localName, setLocalName, handleNameBlur] = useLocalInputState(
 *   item.name,
 *   (value) => updateItem('name', value)
 * );
 *
 * <input
 *   value={localName}
 *   onChange={(e) => setLocalName(e.target.value)}
 *   onBlur={handleNameBlur}
 * />
 */

import { useState, useEffect, useCallback } from 'react';

export function useLocalInputState(externalValue, onUpdate) {
  const [localValue, setLocalValue] = useState(externalValue || '');

  // Sync local value when external value changes
  useEffect(() => {
    setLocalValue(externalValue || '');
  }, [externalValue]);

  // Call onUpdate if value changed
  const handleBlur = useCallback(() => {
    if (localValue !== externalValue) {
      onUpdate(localValue);
    }
  }, [localValue, externalValue, onUpdate]);

  return [localValue, setLocalValue, handleBlur];
}
