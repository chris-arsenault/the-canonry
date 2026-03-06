/**
 * useLocalInputState - Hook for managing local input state with cursor-jumping prevention
 *
 * When editing text inputs bound to external state, React can cause cursor jumping
 * because the input value gets reset on every keystroke. This hook maintains a local
 * copy of the value that syncs on blur, preventing cursor jumping while keeping
 * the external state in sync.
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

import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';

export function useLocalInputState(
  externalValue: string | undefined,
  onUpdate: (value: string) => void,
): [string, Dispatch<SetStateAction<string>>, () => void] {
  const [localValue, setLocalValue] = useState(externalValue || '');

  // Sync local value when external value changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional prop->draft sync for controlled inputs
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
