/**
 * Fields for "change_status" and "adjust_prominence" mutation types
 */

import React, { useCallback } from "react";
import { ReferenceDropdown, NumberInput } from "../index";
import type { Mutation, EntityRefOption } from "../mutationUtils";

interface ChangeStatusFieldsProps {
  readonly mutation: Mutation;
  readonly update: (field: string, value: string | number | undefined) => void;
  readonly entityRefs: EntityRefOption[];
}

export function ChangeStatusFields({
  mutation,
  update,
  entityRefs,
}: ChangeStatusFieldsProps) {
  const handleEntityChange = useCallback(
    (v: string | undefined) => update("entity", v),
    [update],
  );
  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      update("newStatus", e.target.value || undefined),
    [update],
  );

  return (
    <>
      <ReferenceDropdown
        label="Entity"
        value={mutation.entity || ""}
        onChange={handleEntityChange}
        options={entityRefs}
        placeholder="Select entity..."
      />
      <div className="form-group">
        <label htmlFor="new-status" className="label">
          New Status
        </label>
        <input
          id="new-status"
          type="text"
          value={mutation.newStatus || ""}
          onChange={handleStatusChange}
          className="input"
          placeholder="e.g., active"
        />
      </div>
    </>
  );
}

interface AdjustProminenceFieldsProps {
  readonly mutation: Mutation;
  readonly update: (field: string, value: number | string | undefined) => void;
  readonly entityRefs: EntityRefOption[];
}

export function AdjustProminenceFields({
  mutation,
  update,
  entityRefs,
}: AdjustProminenceFieldsProps) {
  const handleEntityChange = useCallback(
    (v: string | undefined) => update("entity", v),
    [update],
  );
  const handleDeltaChange = useCallback(
    (v: number | undefined) => update("delta", v ?? 0),
    [update],
  );

  return (
    <>
      <ReferenceDropdown
        label="Entity"
        value={mutation.entity || ""}
        onChange={handleEntityChange}
        options={entityRefs}
        placeholder="Select entity..."
      />
      <div className="form-group">
        <label className="label">
          Delta
          <NumberInput
            value={mutation.delta}
            onChange={handleDeltaChange}
            placeholder="e.g., 0.25 or -0.15"
          />
        </label>
      </div>
    </>
  );
}

export default ChangeStatusFields;
