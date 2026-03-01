/**
 * ActionProminenceFields - Fields for the "adjust_prominence" action type.
 */

import React, { useCallback } from "react";
import { NumberInput } from "../../../shared";

interface ActionProminenceFieldsProps {
  readonly delta: number | undefined;
  readonly onUpdateAction: (field: string, value: unknown) => void;
}

export function ActionProminenceFields({
  delta,
  onUpdateAction,
}: ActionProminenceFieldsProps) {
  const handleDeltaChange = useCallback(
    (v: number | undefined) => onUpdateAction("delta", v ?? 0),
    [onUpdateAction],
  );

  return (
    <div className="form-group">
      <label className="label">Delta
      <NumberInput
        value={delta}
        onChange={handleDeltaChange}
        placeholder="e.g., 0.25 or -0.15"
      />
      </label>
    </div>
  );
}
