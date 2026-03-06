/**
 * EditAxisModal - Modal for selecting/changing an axis assignment on a semantic plane.
 */

import React, { useCallback } from "react";
import type { EditingAxis, EntityKind, AxisDefinition } from "./types.ts";

interface EditAxisModalProps {
  editingAxis: EditingAxis;
  selectedKind: EntityKind;
  axisDefinitions: AxisDefinition[];
  onAxisSelect: (axisId: string) => void;
  onSave: () => void;
  onClose: () => void;
}

// eslint-disable-next-line max-lines-per-function -- modal form with select input, preview section, and action buttons; 3 useCallback wrappers for event handlers inflate line count
export default function EditAxisModal({
  editingAxis,
  selectedKind,
  axisDefinitions,
  onAxisSelect,
  onSave,
  onClose,
}: Readonly<EditAxisModalProps>) {
  const handleAxisChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onAxisSelect(e.target.value),
    [onAxisSelect],
  );

  const handleBackdropKeyDown = useCallback(
    (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") onClose(); },
    [onClose],
  );

  const handleContentClick = useCallback(
    (e: React.MouseEvent) => e.stopPropagation(),
    [],
  );

  return (
    <div className="sp-modal" onClick={onClose} role="button" tabIndex={0} onKeyDown={handleBackdropKeyDown}>
      <div className="sp-modal-content-wide" onClick={handleContentClick} role="presentation">
        <div className="sp-modal-title">
          Select {editingAxis.key.toUpperCase()} Axis for{" "}
          {selectedKind.description || selectedKind.kind}
        </div>

        <div className="sp-form-group">
          <label htmlFor="axis-from-registry" className="sp-label">Axis from Registry</label>
          <select
            id="axis-from-registry"
            className="sp-select"
            value={editingAxis.axisId || ""}
            onChange={handleAxisChange}
          >
            <option value="" disabled>
              Select an axis...
            </option>
            {axisDefinitions.map((axis) => (
              <option key={axis.id} value={axis.id}>
                {axis.name} ({axis.lowTag} → {axis.highTag})
              </option>
            ))}
          </select>
        </div>

        {editingAxis.axisId && (
          <div className="sp-axis-preview">
            <div className="sp-axis-preview-name">{editingAxis.name}</div>
            <div className="sp-axis-preview-range">
              <span className="sp-axis-preview-tag">{editingAxis.lowTag}</span>
              <span>→</span>
              <span className="sp-axis-preview-tag">{editingAxis.highTag}</span>
            </div>
          </div>
        )}

        {axisDefinitions.length === 0 && (
          <div className="sp-no-axes-warning">
            No axes defined. Create axes in the Axis Registry first.
          </div>
        )}

        <div className="sp-modal-actions">
          <button className="sp-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="sp-add-button"
            style={{ '--sp-save-opacity': editingAxis.axisId ? 1 : 0.5 } as React.CSSProperties}
            onClick={onSave}
            disabled={!editingAxis.axisId}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
