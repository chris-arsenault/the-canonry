/**
 * AxisRegistryEditor - Manage reusable semantic plane axis definitions.
 *
 * Axis definitions are shared across entity kinds. When an axis is created/updated,
 * its tags are automatically configured in the tag registry (isAxis: true, mutually exclusive).
 */

import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { TagSelector } from "@the-canonry/shared-components";
import "./AxisRegistry.css";

export default function AxisRegistryEditor({
  axisDefinitions = [],
  entityKinds = [],
  tagRegistry = [],
  onAxisDefinitionsChange,
  onTagRegistryChange,
}) {
  const [showModal, setShowModal] = useState(false);
  const [editingAxis, setEditingAxis] = useState(null);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    description: "",
    lowTag: "",
    highTag: "",
  });

  // Compute which entity kinds use each axis
  const axisUsage = useMemo(() => {
    const usage = {};
    for (const axis of axisDefinitions) {
      usage[axis.id] = [];
    }

    for (const ek of entityKinds) {
      const axes = ek.semanticPlane?.axes || {};
      for (const [axisKey, axisConfig] of Object.entries(axes)) {
        if (axisConfig.axisId && usage[axisConfig.axisId]) {
          usage[axisConfig.axisId].push({
            kind: ek.kind,
            description: ek.description,
            axis: axisKey.toUpperCase(),
          });
        }
      }
    }

    return usage;
  }, [axisDefinitions, entityKinds]);

  const openNewModal = () => {
    setEditingAxis(null);
    setFormData({
      id: "",
      name: "",
      description: "",
      lowTag: "",
      highTag: "",
    });
    setShowModal(true);
  };

  const openEditModal = (axis) => {
    setEditingAxis(axis);
    setFormData({
      id: axis.id,
      name: axis.name,
      description: axis.description || "",
      lowTag: axis.lowTag,
      highTag: axis.highTag,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAxis(null);
  };

  const generateId = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  };

  const handleNameChange = (name) => {
    setFormData((prev) => ({
      ...prev,
      name,
      // Auto-generate ID only if creating new or ID hasn't been manually edited
      id: !editingAxis ? generateId(name) : prev.id,
    }));
  };

  const ensureTagExists = (tagId, isAxis = true) => {
    const existing = tagRegistry.find((t) => t.tag === tagId);
    if (existing) {
      // Update existing tag to be an axis tag
      if (!existing.isAxis) {
        return { ...existing, isAxis: true };
      }
      return existing;
    }
    // Create new tag
    return {
      tag: tagId,
      description: "",
      category: "trait",
      isAxis: true,
    };
  };

  const saveAxis = () => {
    if (!formData.name.trim() || !formData.lowTag.trim() || !formData.highTag.trim()) {
      return;
    }

    if (!onAxisDefinitionsChange) {
      return;
    }

    const axisId = formData.id || generateId(formData.name);
    const newAxis = {
      id: axisId,
      name: formData.name.trim(),
      description: formData.description.trim(),
      lowTag: formData.lowTag.trim(),
      highTag: formData.highTag.trim(),
    };

    // Update axis definitions
    let newDefinitions;
    if (editingAxis) {
      newDefinitions = axisDefinitions.map((a) => (a.id === editingAxis.id ? newAxis : a));
    } else {
      newDefinitions = [...axisDefinitions, newAxis];
    }

    onAxisDefinitionsChange(newDefinitions);

    // Auto-manage tags if callback is provided
    if (onTagRegistryChange) {
      const lowTagEntry = ensureTagExists(newAxis.lowTag);
      const highTagEntry = ensureTagExists(newAxis.highTag);

      // Set mutual exclusivity between the tags
      const lowWithExclusive = {
        ...lowTagEntry,
        mutuallyExclusiveWith: [
          ...new Set([...(lowTagEntry.mutuallyExclusiveWith || []), newAxis.highTag]),
        ],
      };
      const highWithExclusive = {
        ...highTagEntry,
        mutuallyExclusiveWith: [
          ...new Set([...(highTagEntry.mutuallyExclusiveWith || []), newAxis.lowTag]),
        ],
      };

      // Update tag registry
      let newRegistry = [...tagRegistry];

      // Update or add low tag
      const lowIdx = newRegistry.findIndex((t) => t.tag === newAxis.lowTag);
      if (lowIdx >= 0) {
        newRegistry[lowIdx] = lowWithExclusive;
      } else {
        newRegistry.push(lowWithExclusive);
      }

      // Update or add high tag
      const highIdx = newRegistry.findIndex((t) => t.tag === newAxis.highTag);
      if (highIdx >= 0) {
        newRegistry[highIdx] = highWithExclusive;
      } else {
        newRegistry.push(highWithExclusive);
      }

      onTagRegistryChange(newRegistry);
    }

    closeModal();
  };

  const deleteAxis = (axisId) => {
    const usage = axisUsage[axisId] || [];
    if (usage.length > 0) {
      const kindList = usage.map((u) => u.description || u.kind).join(", ");
      if (!window.confirm(`This axis is used by: ${kindList}. Delete anyway?`)) {
        return;
      }
    }

    const newDefinitions = axisDefinitions.filter((a) => a.id !== axisId);
    onAxisDefinitionsChange(newDefinitions);
  };

  return (
    <div className="cosmo-editor-container">
      <div className="cosmo-editor-header">
        <div className="cosmo-editor-title">Axis Registry</div>
        <div className="cosmo-editor-subtitle">
          Define reusable semantic axes. Tags are auto-configured when you save.
        </div>
      </div>

      <div className="cosmo-toolbar">
        <span className="cosmo-count">
          {axisDefinitions.length} {axisDefinitions.length === 1 ? "axis" : "axes"} defined
        </span>
        <button className="cosmo-add-btn" onClick={openNewModal}>
          + New Axis
        </button>
      </div>

      {axisDefinitions.length === 0 ? (
        <div className="cosmo-empty-state">
          No axes defined yet. Create your first axis to start building semantic planes.
        </div>
      ) : (
        <div className="axr-axis-list">
          {axisDefinitions.map((axis) => {
            const usage = axisUsage[axis.id] || [];
            return (
              <div key={axis.id} className="axr-axis-card">
                <div className="axr-axis-header">
                  <div>
                    <div className="axr-axis-name">{axis.name}</div>
                    {axis.description && (
                      <div className="axr-axis-description">{axis.description}</div>
                    )}
                  </div>
                  <div className="cosmo-actions">
                    <button className="cosmo-edit-btn" onClick={() => openEditModal(axis)}>
                      Edit
                    </button>
                    <button className="cosmo-delete-btn" onClick={() => deleteAxis(axis.id)}>
                      Delete
                    </button>
                  </div>
                </div>

                <div className="axr-axis-range">
                  <span className="axr-tag">{axis.lowTag}</span>
                  <span className="cosmo-arrow">←―――→</span>
                  <span className="axr-tag">{axis.highTag}</span>
                </div>

                {usage.length > 0 && (
                  <div className="axr-usage-info">
                    Used in:{" "}
                    {usage.map((u, i) => (
                      <span key={u.kind}>
                        {i > 0 && ", "}
                        <span className="axr-usage-kind">
                          {u.description || u.kind} ({u.axis})
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="cosmo-modal" onClick={closeModal} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") closeModal(); }} >
          <div className="cosmo-modal-content axr-modal-content" onClick={(e) => e.stopPropagation()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
            <div className="cosmo-modal-title">
              {editingAxis ? `Edit Axis: ${editingAxis.name}` : "New Axis Definition"}
            </div>

            <div className="cosmo-form-group">
              <label htmlFor="name" className="cosmo-label">Name</label>
              <input id="name"
                className="cosmo-input"
                placeholder="e.g., Power, Alignment, Element"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
            </div>

            <div className="cosmo-form-group">
              <label htmlFor="id" className="cosmo-label">ID</label>
              <input id="id"
                className="cosmo-input"
                placeholder="e.g., power, alignment, element"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                disabled={!!editingAxis}
              />
              <div className="cosmo-hint">
                {editingAxis ? "ID cannot be changed" : "Auto-generated from name"}
              </div>
            </div>

            <div className="cosmo-form-group">
              <label htmlFor="description-optional" className="cosmo-label">Description (optional)</label>
              <input id="description-optional"
                className="cosmo-input"
                placeholder="Brief description of this axis"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="axr-input-row">
              <div className="axr-input-half">
                <div className="cosmo-form-group">
                  <label className="cosmo-label">Low Tag (0)
                  <TagSelector
                    tagRegistry={tagRegistry}
                    value={formData.lowTag ? [formData.lowTag] : []}
                    onChange={(tags) => setFormData({ ...formData, lowTag: tags[0] || "" })}
                    onAddToRegistry={(newTag) => onTagRegistryChange([...tagRegistry, newTag])}
                    placeholder="Select or create tag..."
                    singleSelect
                  />
                  </label>
                </div>
              </div>
              <div className="axr-input-half">
                <div className="cosmo-form-group">
                  <label className="cosmo-label">High Tag (100)
                  <TagSelector
                    tagRegistry={tagRegistry}
                    value={formData.highTag ? [formData.highTag] : []}
                    onChange={(tags) => setFormData({ ...formData, highTag: tags[0] || "" })}
                    onAddToRegistry={(newTag) => onTagRegistryChange([...tagRegistry, newTag])}
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
              <button className="cosmo-cancel-btn" onClick={closeModal}>
                Cancel
              </button>
              <button
                className="cosmo-save-btn axr-save-button"
                style={{ '--axr-save-opacity': formData.name && formData.lowTag && formData.highTag ? 1 : 0.5 }}
                onClick={saveAxis}
                disabled={!formData.name || !formData.lowTag || !formData.highTag}
              >
                {editingAxis ? "Save Changes" : "Create Axis"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

AxisRegistryEditor.propTypes = {
  axisDefinitions: PropTypes.array,
  entityKinds: PropTypes.array,
  tagRegistry: PropTypes.array,
  onAxisDefinitionsChange: PropTypes.func,
  onTagRegistryChange: PropTypes.func,
};
