/**
 * AxisRegistryEditor - Manage reusable semantic plane axis definitions.
 *
 * Axis definitions are shared across entity kinds. When an axis is created/updated,
 * its tags are automatically configured in the tag registry (isAxis: true, mutually exclusive).
 */

import React, { useState, useMemo } from 'react';
import { TagSelector } from '@penguin-tales/shared-components';

const styles = {
  container: {
    maxWidth: '1000px'
  },
  header: {
    marginBottom: '16px'
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    marginBottom: '4px'
  },
  subtitle: {
    color: '#888',
    fontSize: '13px'
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  addButton: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#60a5fa',
    color: '#0a1929',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 500
  },
  axisList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  axisCard: {
    backgroundColor: '#0c1f2e',
    borderRadius: '6px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    padding: '14px 16px'
  },
  axisHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px'
  },
  axisName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#93c5fd'
  },
  axisDescription: {
    fontSize: '12px',
    color: '#888',
    marginTop: '2px'
  },
  axisRange: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '10px',
    padding: '8px 12px',
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderRadius: '4px'
  },
  tag: {
    padding: '3px 8px',
    fontSize: '11px',
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    color: '#93c5fd',
    borderRadius: '3px',
    fontFamily: 'monospace'
  },
  arrow: {
    color: '#60a5fa',
    fontSize: '14px'
  },
  usageInfo: {
    fontSize: '11px',
    color: '#666',
    marginTop: '8px'
  },
  usageKind: {
    color: '#93c5fd'
  },
  actions: {
    display: 'flex',
    gap: '6px'
  },
  editButton: {
    padding: '4px 10px',
    fontSize: '11px',
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    color: '#93c5fd',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer'
  },
  deleteButton: {
    padding: '4px 10px',
    fontSize: '11px',
    backgroundColor: 'transparent',
    color: '#f87171',
    border: '1px solid #f87171',
    borderRadius: '3px',
    cursor: 'pointer'
  },
  emptyState: {
    color: '#666',
    fontSize: '14px',
    textAlign: 'center',
    padding: '60px 20px'
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: '#0c1f2e',
    padding: '24px',
    borderRadius: '8px',
    width: '440px',
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '16px',
    color: '#93c5fd'
  },
  formGroup: {
    marginBottom: '14px'
  },
  label: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '4px',
    display: 'block'
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '14px',
    backgroundColor: '#0a1929',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '4px',
    color: '#eee',
    boxSizing: 'border-box'
  },
  inputRow: {
    display: 'flex',
    gap: '12px'
  },
  inputHalf: {
    flex: 1
  },
  hint: {
    fontSize: '11px',
    color: '#666',
    marginTop: '4px'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '20px'
  },
  cancelButton: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    color: '#93c5fd',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  saveButton: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#60a5fa',
    color: '#0a1929',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 500
  }
};

export default function AxisRegistryEditor({
  axisDefinitions = [],
  entityKinds = [],
  tagRegistry = [],
  onAxisDefinitionsChange,
  onTagRegistryChange
}) {
  const [showModal, setShowModal] = useState(false);
  const [editingAxis, setEditingAxis] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    lowTag: '',
    highTag: ''
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
            axis: axisKey.toUpperCase()
          });
        }
      }
    }

    return usage;
  }, [axisDefinitions, entityKinds]);

  const openNewModal = () => {
    setEditingAxis(null);
    setFormData({
      id: '',
      name: '',
      description: '',
      lowTag: '',
      highTag: ''
    });
    setShowModal(true);
  };

  const openEditModal = (axis) => {
    setEditingAxis(axis);
    setFormData({
      id: axis.id,
      name: axis.name,
      description: axis.description || '',
      lowTag: axis.lowTag,
      highTag: axis.highTag
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAxis(null);
  };

  const generateId = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  };

  const handleNameChange = (name) => {
    setFormData(prev => ({
      ...prev,
      name,
      // Auto-generate ID only if creating new or ID hasn't been manually edited
      id: !editingAxis ? generateId(name) : prev.id
    }));
  };

  const ensureTagExists = (tagId, isAxis = true) => {
    const existing = tagRegistry.find(t => t.tag === tagId);
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
      description: '',
      category: 'trait',
      isAxis: true
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
      highTag: formData.highTag.trim()
    };

    // Update axis definitions
    let newDefinitions;
    if (editingAxis) {
      newDefinitions = axisDefinitions.map(a =>
        a.id === editingAxis.id ? newAxis : a
      );
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
          ...new Set([...(lowTagEntry.mutuallyExclusiveWith || []), newAxis.highTag])
        ]
      };
      const highWithExclusive = {
        ...highTagEntry,
        mutuallyExclusiveWith: [
          ...new Set([...(highTagEntry.mutuallyExclusiveWith || []), newAxis.lowTag])
        ]
      };

      // Update tag registry
      let newRegistry = [...tagRegistry];

      // Update or add low tag
      const lowIdx = newRegistry.findIndex(t => t.tag === newAxis.lowTag);
      if (lowIdx >= 0) {
        newRegistry[lowIdx] = lowWithExclusive;
      } else {
        newRegistry.push(lowWithExclusive);
      }

      // Update or add high tag
      const highIdx = newRegistry.findIndex(t => t.tag === newAxis.highTag);
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
      const kindList = usage.map(u => u.description || u.kind).join(', ');
      if (!window.confirm(`This axis is used by: ${kindList}. Delete anyway?`)) {
        return;
      }
    }

    const newDefinitions = axisDefinitions.filter(a => a.id !== axisId);
    onAxisDefinitionsChange(newDefinitions);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Axis Registry</div>
        <div style={styles.subtitle}>
          Define reusable semantic axes. Tags are auto-configured when you save.
        </div>
      </div>

      <div style={styles.toolbar}>
        <span style={{ color: '#888', fontSize: '13px' }}>
          {axisDefinitions.length} {axisDefinitions.length === 1 ? 'axis' : 'axes'} defined
        </span>
        <button style={styles.addButton} onClick={openNewModal}>
          + New Axis
        </button>
      </div>

      {axisDefinitions.length === 0 ? (
        <div style={styles.emptyState}>
          No axes defined yet. Create your first axis to start building semantic planes.
        </div>
      ) : (
        <div style={styles.axisList}>
          {axisDefinitions.map(axis => {
            const usage = axisUsage[axis.id] || [];
            return (
              <div key={axis.id} style={styles.axisCard}>
                <div style={styles.axisHeader}>
                  <div>
                    <div style={styles.axisName}>{axis.name}</div>
                    {axis.description && (
                      <div style={styles.axisDescription}>{axis.description}</div>
                    )}
                  </div>
                  <div style={styles.actions}>
                    <button style={styles.editButton} onClick={() => openEditModal(axis)}>
                      Edit
                    </button>
                    <button style={styles.deleteButton} onClick={() => deleteAxis(axis.id)}>
                      Delete
                    </button>
                  </div>
                </div>

                <div style={styles.axisRange}>
                  <span style={styles.tag}>{axis.lowTag}</span>
                  <span style={styles.arrow}>←―――→</span>
                  <span style={styles.tag}>{axis.highTag}</span>
                </div>

                {usage.length > 0 && (
                  <div style={styles.usageInfo}>
                    Used in:{' '}
                    {usage.map((u, i) => (
                      <span key={u.kind}>
                        {i > 0 && ', '}
                        <span style={styles.usageKind}>
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
        <div style={styles.modal} onClick={closeModal}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>
              {editingAxis ? `Edit Axis: ${editingAxis.name}` : 'New Axis Definition'}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Name</label>
              <input
                style={styles.input}
                placeholder="e.g., Power, Alignment, Element"
                value={formData.name}
                onChange={e => handleNameChange(e.target.value)}
                autoFocus
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>ID</label>
              <input
                style={styles.input}
                placeholder="e.g., power, alignment, element"
                value={formData.id}
                onChange={e => setFormData({ ...formData, id: e.target.value })}
                disabled={!!editingAxis}
              />
              <div style={styles.hint}>
                {editingAxis ? 'ID cannot be changed' : 'Auto-generated from name'}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Description (optional)</label>
              <input
                style={styles.input}
                placeholder="Brief description of this axis"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div style={styles.inputRow}>
              <div style={styles.inputHalf}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Low Tag (0)</label>
                  <TagSelector
                    tagRegistry={tagRegistry}
                    value={formData.lowTag ? [formData.lowTag] : []}
                    onChange={(tags) => setFormData({ ...formData, lowTag: tags[0] || '' })}
                    onAddToRegistry={(newTag) => onTagRegistryChange([...tagRegistry, newTag])}
                    placeholder="Select or create tag..."
                    singleSelect
                  />
                </div>
              </div>
              <div style={styles.inputHalf}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>High Tag (100)</label>
                  <TagSelector
                    tagRegistry={tagRegistry}
                    value={formData.highTag ? [formData.highTag] : []}
                    onChange={(tags) => setFormData({ ...formData, highTag: tags[0] || '' })}
                    onAddToRegistry={(newTag) => onTagRegistryChange([...tagRegistry, newTag])}
                    placeholder="Select or create tag..."
                    singleSelect
                  />
                </div>
              </div>
            </div>

            <div style={styles.hint}>
              Tags will be auto-created in the registry with isAxis=true and set as mutually exclusive.
            </div>

            <div style={styles.modalActions}>
              <button style={styles.cancelButton} onClick={closeModal}>
                Cancel
              </button>
              <button
                style={{
                  ...styles.saveButton,
                  opacity: formData.name && formData.lowTag && formData.highTag ? 1 : 0.5
                }}
                onClick={saveAxis}
                disabled={!formData.name || !formData.lowTag || !formData.highTag}
              >
                {editingAxis ? 'Save Changes' : 'Create Axis'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
