/**
 * AxisModal - Create/Edit modal for axis definitions.
 */

import React, { useMemo, useCallback } from "react";
import type { Optional } from "@the-canonry/shared-components";
import { TagSelector } from "@the-canonry/shared-components";
import type { AxisDefinition, AxisFormData, TagEntry } from "./types.ts";

interface AxisModalProps {
  editingAxis: AxisDefinition | null;
  formData: AxisFormData;
  tagRegistry: TagEntry[];
  onNameChange: (name: string) => void;
  onFormDataChange: (data: AxisFormData) => void;
  onSave: () => void;
  onClose: () => void;
  onTagRegistryChange: (registry: TagEntry[]) => void;
}

// eslint-disable-next-line max-lines-per-function -- modal form with 5 controlled inputs, tag selectors, and validation; splitting further would fragment a single logical form
export default function AxisModal({
  editingAxis,
  formData,
  tagRegistry,
  onNameChange,
  onFormDataChange,
  onSave,
  onClose,
  onTagRegistryChange,
}: Readonly<AxisModalProps>) {
  const handleIdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onFormDataChange({ ...formData, id: e.target.value }),
    [formData, onFormDataChange],
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onFormDataChange({ ...formData, description: e.target.value }),
    [formData, onFormDataChange],
  );

  const lowTagValue = useMemo(
    () => (formData.lowTag ? [formData.lowTag] : []),
    [formData.lowTag],
  );

  const highTagValue = useMemo(
    () => (formData.highTag ? [formData.highTag] : []),
    [formData.highTag],
  );

  const handleLowTagChange = useCallback(
    (tags: string[]) => onFormDataChange({ ...formData, lowTag: tags[0] || "" }),
    [formData, onFormDataChange],
  );

  const handleHighTagChange = useCallback(
    (tags: string[]) => onFormDataChange({ ...formData, highTag: tags[0] || "" }),
    [formData, onFormDataChange],
  );

  const handleAddToRegistry = useCallback(
    (newTag: { tag: string; category: string; rarity: string; description: Optional<string> }) =>
      onTagRegistryChange([...tagRegistry, newTag]),
    [tagRegistry, onTagRegistryChange],
  );

  const handleBackdropKeyDown = useCallback(
    (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") onClose(); },
    [onClose],
  );

  const handleContentClick = useCallback(
    (e: React.MouseEvent) => e.stopPropagation(),
    [],
  );

  const isValid = formData.name && formData.lowTag && formData.highTag;

  return (
    <div className="cosmo-modal" onClick={onClose} role="button" tabIndex={0} onKeyDown={handleBackdropKeyDown}>
      <div className="cosmo-modal-content" onClick={handleContentClick} role="presentation">
        <div className="cosmo-modal-title">
          {editingAxis ? `Edit Axis: ${editingAxis.name}` : "New Axis Definition"}
        </div>

        <div className="cosmo-form-group">
          <label htmlFor="name" className="cosmo-label">Name</label>
          <input
            id="name"
            className="cosmo-input"
            placeholder="e.g., Power, Alignment, Element"
            value={formData.name}
            onChange={(e) => onNameChange(e.target.value)}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </div>

        <div className="cosmo-form-group">
          <label htmlFor="id" className="cosmo-label">ID</label>
          <input
            id="id"
            className="cosmo-input"
            placeholder="e.g., power, alignment, element"
            value={formData.id}
            onChange={handleIdChange}
            disabled={!!editingAxis}
          />
          <div className="cosmo-hint">
            {editingAxis ? "ID cannot be changed" : "Auto-generated from name"}
          </div>
        </div>

        <div className="cosmo-form-group">
          <label htmlFor="description-optional" className="cosmo-label">Description (optional)</label>
          <input
            id="description-optional"
            className="cosmo-input"
            placeholder="Brief description of this axis"
            value={formData.description}
            onChange={handleDescriptionChange}
          />
        </div>

        <div className="cosmo-input-row">
          <div className="cosmo-input-half">
            <div className="cosmo-form-group">
              <label className="cosmo-label">Low Tag (0)
              <TagSelector
                tagRegistry={tagRegistry}
                value={lowTagValue}
                onChange={handleLowTagChange}
                onAddToRegistry={handleAddToRegistry}
                placeholder="Select or create tag..."
                singleSelect
              />
              </label>
            </div>
          </div>
          <div className="cosmo-input-half">
            <div className="cosmo-form-group">
              <label className="cosmo-label">High Tag (100)
              <TagSelector
                tagRegistry={tagRegistry}
                value={highTagValue}
                onChange={handleHighTagChange}
                onAddToRegistry={handleAddToRegistry}
                placeholder="Select or create tag..."
                singleSelect
              />
              </label>
            </div>
          </div>
        </div>

        <div className="cosmo-hint">
          Tags will be auto-created in the registry with isAxis=true and set as mutually
          exclusive.
        </div>

        <div className="cosmo-modal-actions">
          <button className="cosmo-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="cosmo-save-btn axr-save-button"
            style={{ '--axr-save-opacity': isValid ? 1 : 0.5 } as React.CSSProperties}
            onClick={onSave}
            disabled={!isValid}
          >
            {editingAxis ? "Save Changes" : "Create Axis"}
          </button>
        </div>
      </div>
    </div>
  );
}
