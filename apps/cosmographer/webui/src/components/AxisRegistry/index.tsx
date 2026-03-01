/**
 * AxisRegistryEditor - Manage reusable semantic plane axis definitions.
 *
 * Axis definitions are shared across entity kinds. When an axis is created/updated,
 * its tags are automatically configured in the tag registry (isAxis: true, mutually exclusive).
 */

import React, { useState, useMemo, useCallback } from "react";
import { TagSelector } from "@the-canonry/shared-components";
import "./AxisRegistry.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TagEntry {
  tag: string;
  description?: string;
  category?: string;
  isAxis?: boolean;
  mutuallyExclusiveWith?: string[];
}

interface AxisDefinition {
  id: string;
  name: string;
  description?: string;
  lowTag: string;
  highTag: string;
}

interface AxisUsageEntry {
  kind: string;
  description?: string;
  axis: string;
}

interface EntityKind {
  kind: string;
  description?: string;
  semanticPlane?: {
    axes?: Record<string, { axisId?: string }>;
  };
}

interface AxisFormData {
  id: string;
  name: string;
  description: string;
  lowTag: string;
  highTag: string;
}

interface AxisRegistryEditorProps {
  axisDefinitions: AxisDefinition[];
  entityKinds: EntityKind[];
  tagRegistry: TagEntry[];
  onAxisDefinitionsChange: (defs: AxisDefinition[]) => void;
  onTagRegistryChange: (registry: TagEntry[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const EMPTY_FORM: AxisFormData = {
  id: "",
  name: "",
  description: "",
  lowTag: "",
  highTag: "",
};

// ---------------------------------------------------------------------------
// AxisCard - Single axis card in the list
// ---------------------------------------------------------------------------

interface AxisCardProps {
  axis: AxisDefinition;
  usage: AxisUsageEntry[];
  onEdit: (axis: AxisDefinition) => void;
  onDelete: (axisId: string) => void;
}

function AxisCard({ axis, usage, onEdit, onDelete }: AxisCardProps) {
  const handleEdit = useCallback(() => onEdit(axis), [onEdit, axis]);
  const handleDelete = useCallback(() => onDelete(axis.id), [onDelete, axis.id]);

  return (
    <div className="axr-axis-card">
      <div className="axr-axis-header">
        <div>
          <div className="axr-axis-name">{axis.name}</div>
          {axis.description && (
            <div className="axr-axis-description">{axis.description}</div>
          )}
        </div>
        <div className="cosmo-actions">
          <button className="cosmo-edit-btn" onClick={handleEdit}>
            Edit
          </button>
          <button className="cosmo-delete-btn" onClick={handleDelete}>
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
}

// ---------------------------------------------------------------------------
// AxisModal - Create/Edit modal
// ---------------------------------------------------------------------------

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

function AxisModal({
  editingAxis,
  formData,
  tagRegistry,
  onNameChange,
  onFormDataChange,
  onSave,
  onClose,
  onTagRegistryChange,
}: AxisModalProps) {
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
    (newTag: { tag: string; category: string; rarity: string; description?: string }) =>
      onTagRegistryChange([...tagRegistry, newTag]),
    [tagRegistry, onTagRegistryChange],
  );

  const isValid = formData.name && formData.lowTag && formData.highTag;

  return (
    <div className="cosmo-modal" onClick={onClose} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClose(); }}>
      <div className="cosmo-modal-content axr-modal-content" onClick={(e) => e.stopPropagation()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}>
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

// ---------------------------------------------------------------------------
// AxisRegistryEditor - Main component
// ---------------------------------------------------------------------------

export default function AxisRegistryEditor({
  axisDefinitions,
  entityKinds,
  tagRegistry,
  onAxisDefinitionsChange,
  onTagRegistryChange,
}: AxisRegistryEditorProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingAxis, setEditingAxis] = useState<AxisDefinition | null>(null);
  const [formData, setFormData] = useState<AxisFormData>(EMPTY_FORM);

  // Compute which entity kinds use each axis
  const axisUsage = useMemo(() => {
    const usage: Record<string, AxisUsageEntry[]> = {};
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

  const openNewModal = useCallback(() => {
    setEditingAxis(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((axis: AxisDefinition) => {
    setEditingAxis(axis);
    setFormData({
      id: axis.id,
      name: axis.name,
      description: axis.description || "",
      lowTag: axis.lowTag,
      highTag: axis.highTag,
    });
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingAxis(null);
  }, []);

  const handleNameChange = useCallback(
    (name: string) => {
      setFormData((prev) => ({
        ...prev,
        name,
        id: !editingAxis ? generateId(name) : prev.id,
      }));
    },
    [editingAxis],
  );

  const ensureTagExists = useCallback(
    (tagId: string): TagEntry => {
      const existing = tagRegistry.find((t) => t.tag === tagId);
      if (existing) {
        if (!existing.isAxis) {
          return { ...existing, isAxis: true };
        }
        return existing;
      }
      return {
        tag: tagId,
        description: "",
        category: "trait",
        isAxis: true,
      };
    },
    [tagRegistry],
  );

  const saveAxis = useCallback(() => {
    if (!formData.name.trim() || !formData.lowTag.trim() || !formData.highTag.trim()) {
      return;
    }

    const axisId = formData.id || generateId(formData.name);
    const newAxis: AxisDefinition = {
      id: axisId,
      name: formData.name.trim(),
      description: formData.description.trim(),
      lowTag: formData.lowTag.trim(),
      highTag: formData.highTag.trim(),
    };

    let newDefinitions: AxisDefinition[];
    if (editingAxis) {
      newDefinitions = axisDefinitions.map((a) => (a.id === editingAxis.id ? newAxis : a));
    } else {
      newDefinitions = [...axisDefinitions, newAxis];
    }

    onAxisDefinitionsChange(newDefinitions);

    // Auto-manage tags
    const lowTagEntry = ensureTagExists(newAxis.lowTag);
    const highTagEntry = ensureTagExists(newAxis.highTag);

    const lowWithExclusive: TagEntry = {
      ...lowTagEntry,
      mutuallyExclusiveWith: [
        ...new Set([...(lowTagEntry.mutuallyExclusiveWith || []), newAxis.highTag]),
      ],
    };
    const highWithExclusive: TagEntry = {
      ...highTagEntry,
      mutuallyExclusiveWith: [
        ...new Set([...(highTagEntry.mutuallyExclusiveWith || []), newAxis.lowTag]),
      ],
    };

    const newRegistry = [...tagRegistry];

    const lowIdx = newRegistry.findIndex((t) => t.tag === newAxis.lowTag);
    if (lowIdx >= 0) {
      newRegistry[lowIdx] = lowWithExclusive;
    } else {
      newRegistry.push(lowWithExclusive);
    }

    const highIdx = newRegistry.findIndex((t) => t.tag === newAxis.highTag);
    if (highIdx >= 0) {
      newRegistry[highIdx] = highWithExclusive;
    } else {
      newRegistry.push(highWithExclusive);
    }

    onTagRegistryChange(newRegistry);

    closeModal();
  }, [
    formData,
    editingAxis,
    axisDefinitions,
    tagRegistry,
    onAxisDefinitionsChange,
    onTagRegistryChange,
    ensureTagExists,
    closeModal,
  ]);

  const deleteAxis = useCallback(
    (axisId: string) => {
      const usage = axisUsage[axisId] || [];
      if (usage.length > 0) {
        const kindList = usage.map((u) => u.description || u.kind).join(", ");
        if (!window.confirm(`This axis is used by: ${kindList}. Delete anyway?`)) {
          return;
        }
      }

      const newDefinitions = axisDefinitions.filter((a) => a.id !== axisId);
      onAxisDefinitionsChange(newDefinitions);
    },
    [axisUsage, axisDefinitions, onAxisDefinitionsChange],
  );

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
        <div className="viewer-empty-state">
          No axes defined yet. Create your first axis to start building semantic planes.
        </div>
      ) : (
        <div className="axr-axis-list">
          {axisDefinitions.map((axis) => (
            <AxisCard
              key={axis.id}
              axis={axis}
              usage={axisUsage[axis.id] || []}
              onEdit={openEditModal}
              onDelete={deleteAxis}
            />
          ))}
        </div>
      )}

      {showModal && (
        <AxisModal
          editingAxis={editingAxis}
          formData={formData}
          tagRegistry={tagRegistry}
          onNameChange={handleNameChange}
          onFormDataChange={setFormData}
          onSave={saveAxis}
          onClose={closeModal}
          onTagRegistryChange={onTagRegistryChange}
        />
      )}
    </div>
  );
}
