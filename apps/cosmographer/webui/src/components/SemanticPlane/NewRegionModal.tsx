/**
 * NewRegionModal - Modal for adding a new region to a semantic plane.
 */

import React, { useCallback, useMemo } from "react";
import { TagSelector, NumberInput } from "@the-canonry/shared-components";
import type { EntityKind, Culture, TagEntry, NewRegionForm } from "./types.ts";

interface NewRegionModalProps {
  selectedKind: EntityKind;
  cultures: Culture[];
  tagRegistry: TagEntry[];
  newRegion: NewRegionForm;
  onNewRegionChange: (region: NewRegionForm) => void;
  onAdd: () => void;
  onClose: () => void;
}

// eslint-disable-next-line max-lines-per-function -- modal form with 6 controlled inputs (label, x, y, radius, culture, tags) sharing one form state object; splitting fragments a single logical form
export default function NewRegionModal({
  selectedKind,
  cultures,
  tagRegistry,
  newRegion,
  onNewRegionChange,
  onAdd,
  onClose,
}: Readonly<NewRegionModalProps>) {
  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onNewRegionChange({ ...newRegion, label: e.target.value }),
    [newRegion, onNewRegionChange],
  );

  const handleXChange = useCallback(
    (v: number | undefined) => onNewRegionChange({ ...newRegion, x: v ?? 0 }),
    [newRegion, onNewRegionChange],
  );

  const handleYChange = useCallback(
    (v: number | undefined) => onNewRegionChange({ ...newRegion, y: v ?? 0 }),
    [newRegion, onNewRegionChange],
  );

  const handleRadiusChange = useCallback(
    (v: number | undefined) => onNewRegionChange({ ...newRegion, radius: v ?? 10 }),
    [newRegion, onNewRegionChange],
  );

  const handleCultureChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      onNewRegionChange({ ...newRegion, culture: e.target.value }),
    [newRegion, onNewRegionChange],
  );

  const handleTagsChange = useCallback(
    (tags: string[]) => onNewRegionChange({ ...newRegion, tags }),
    [newRegion, onNewRegionChange],
  );

  const regionTagValue = useMemo(() => newRegion.tags || [], [newRegion.tags]);

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
      <div className="sp-modal-content" onClick={handleContentClick} role="presentation">
        <div className="sp-modal-title">
          Add Region to {selectedKind.description || selectedKind.kind}
        </div>

        <div className="sp-form-group">
          <label htmlFor="label" className="sp-label">Label</label>
          <input
            id="label"
            className="sp-input"
            placeholder="Region name"
            value={newRegion.label}
            onChange={handleLabelChange}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </div>

        <div className="sp-input-row">
          <div className="sp-input-half">
            <div className="sp-form-group">
              <label className="sp-label">Center X (0-100)
              <NumberInput
                className="sp-input"
                min={0}
                max={100}
                value={newRegion.x}
                onChange={handleXChange}
                integer
              />
              </label>
            </div>
          </div>
          <div className="sp-input-half">
            <div className="sp-form-group">
              <label className="sp-label">Center Y (0-100)
              <NumberInput
                className="sp-input"
                min={0}
                max={100}
                value={newRegion.y}
                onChange={handleYChange}
                integer
              />
              </label>
            </div>
          </div>
        </div>

        <div className="sp-form-group">
          <label className="sp-label">Radius
          <NumberInput
            className="sp-input"
            min={1}
            max={50}
            value={newRegion.radius}
            onChange={handleRadiusChange}
            integer
          />
          </label>
        </div>

        <div className="sp-form-group">
          <label htmlFor="culture-owner-optional" className="sp-label">Culture Owner (optional)</label>
          <select
            id="culture-owner-optional"
            className="sp-select"
            value={newRegion.culture}
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
            value={regionTagValue}
            onChange={handleTagsChange}
            placeholder="Select tags..."
          />
          </label>
        </div>

        <div className="sp-modal-actions">
          <button className="sp-button" onClick={onClose}>
            Cancel
          </button>
          <button className="sp-add-button" onClick={onAdd}>
            Add Region
          </button>
        </div>
      </div>
    </div>
  );
}
