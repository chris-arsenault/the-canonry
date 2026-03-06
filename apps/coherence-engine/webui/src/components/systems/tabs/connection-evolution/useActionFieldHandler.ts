/**
 * useActionFieldHandler - Creates memoized handlers for individual action fields.
 *
 * Reduces per-component useCallback boilerplate by providing a single hook
 * that returns field-specific callbacks derived from a shared onUpdateAction.
 */

import React, { useCallback } from "react";

type UpdateAction = (field: string, value: unknown) => void;

export function useActionFieldHandler(onUpdateAction: UpdateAction) {
  const handleString = useCallback(
    (field: string) => (v: string | undefined) => onUpdateAction(field, v),
    [onUpdateAction],
  );

  const handleNumber = useCallback(
    (field: string) => (v: number | undefined) => onUpdateAction(field, v),
    [onUpdateAction],
  );

  const handleInputText = useCallback(
    (field: string, emptyAsUndefined = false) =>
      (e: React.ChangeEvent<HTMLInputElement>) =>
        onUpdateAction(field, emptyAsUndefined && !e.target.value ? undefined : e.target.value),
    [onUpdateAction],
  );

  const handleCheckbox = useCallback(
    (field: string) =>
      (e: React.ChangeEvent<HTMLInputElement>) =>
        onUpdateAction(field, e.target.checked || undefined),
    [onUpdateAction],
  );

  return { handleString, handleNumber, handleInputText, handleCheckbox };
}
