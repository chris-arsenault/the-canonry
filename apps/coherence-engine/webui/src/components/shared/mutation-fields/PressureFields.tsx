/**
 * Fields for the "modify_pressure" mutation type
 */

import React, { useCallback } from "react";
import { ReferenceDropdown, NumberInput } from "../index";
import type { Mutation } from "../mutationUtils";

interface PressureFieldsProps {
  readonly mutation: Mutation;
  readonly update: (field: string, value: number | string | undefined) => void;
  readonly pressureOptions: ReadonlyArray<{ value: string; label: string }>;
}

export function PressureFields({
  mutation,
  update,
  pressureOptions,
}: PressureFieldsProps) {
  const handlePressureChange = useCallback(
    (v: string | undefined) => update("pressureId", v),
    [update],
  );
  const handleDeltaChange = useCallback(
    (v: number | undefined) => update("delta", v ?? 0),
    [update],
  );

  return (
    <>
      <ReferenceDropdown
        label="Pressure"
        value={mutation.pressureId || ""}
        onChange={handlePressureChange}
        options={pressureOptions}
        placeholder="Select pressure..."
      />
      <div className="form-group">
        <label className="label">
          Delta
          <NumberInput value={mutation.delta} onChange={handleDeltaChange} />
        </label>
      </div>
    </>
  );
}

export default PressureFields;
