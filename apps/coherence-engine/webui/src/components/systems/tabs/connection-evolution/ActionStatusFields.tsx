/**
 * ActionStatusFields - Fields for the "change_status" action type.
 */

import React, { useCallback } from "react";

interface ActionStatusFieldsProps {
  readonly newStatus: string | undefined;
  readonly onUpdateAction: (field: string, value: unknown) => void;
}

export function ActionStatusFields({
  newStatus,
  onUpdateAction,
}: ActionStatusFieldsProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onUpdateAction("newStatus", e.target.value),
    [onUpdateAction],
  );

  return (
    <div className="form-group">
      <label htmlFor="new-status" className="label">New Status</label>
      <input
        id="new-status"
        type="text"
        value={newStatus || ""}
        onChange={handleChange}
        className="input"
      />
    </div>
  );
}
