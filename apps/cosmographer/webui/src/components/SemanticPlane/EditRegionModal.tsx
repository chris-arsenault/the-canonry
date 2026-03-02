/**
 * EditRegionModal - Modal for editing region label, culture, and tags.
 */

import React, { useCallback, useMemo } from "react";
import { TagSelector } from "@the-canonry/shared-components";
import type { EditingRegion, Culture, TagEntry } from "./types.ts";

interface EditRegionModalProps {
  editingRegion: EditingRegion;
  cultures: Culture[];
  tagRegistry: TagEntry[];
  onEditingRegionChange: (region: EditingRegion) => void;
  onSave: () => void;
  onClose: () => void;
}

// eslint-disable-next-line max-lines-per-function -- modal form with 3 controlled inputs (label, culture, tags) sharing one editing state; line count is from useCallback wrappers and TagSelector JSX boilerplate
export default function EditRegionModal({
  editingRegion,
  cultures,
  tagRegistry,
  onEditingRegionChange,
  onSave,
  onClose,
}: Readonly<EditRegionModalProps>) {
  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onEditingRegionChange({ ...editingRegion, label: e.target.value }),
    [editingRegion, onEditingRegionChange],
  );

  const handleCultureChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      onEditingRegionChange({ ...editingRegion, culture: e.target.value }),
    [editingRegion, onEditingRegionChange],
  );

  const handleTagsChange = useCallback(
    (tags: string[]) => onEditingRegionChange({ ...editingRegion, tags }),
    [editingRegion, onEditingRegionChange],
  );

  const tagValue = useMemo(() => editingRegion.tags || [], [editingRegion.tags]);

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
        <div className="sp-modal-title">Edit Region: {editingRegion.label}</div>

        <div className="sp-form-group">
          <label htmlFor="edit-region-label" className="sp-label">Label</label>
          <input
            id="edit-region-label"
            className="sp-input"
            placeholder="Region name"
            value={editingRegion.label}
            onChange={handleLabelChange}
          />
        </div>

        <div className="sp-form-group">
          <label htmlFor="edit-region-culture" className="sp-label">Culture Owner (optional)</label>
          <select
            id="edit-region-culture"
            className="sp-select"
            value={editingRegion.culture || ""}
            onChange={handleCultureChange}
          >
            <option value="">None</option>
            {cultures.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sp-form-group">
          <label className="sp-label">Tags
          <TagSelector
            tagRegistry={tagRegistry}
            value={tagValue}
            onChange={handleTagsChange}
            placeholder="Select tags..."
          />
          </label>
        </div>

        <div className="sp-modal-actions">
          <button className="sp-button" onClick={onClose}>
            Cancel
          </button>
          <button className="sp-add-button" onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
