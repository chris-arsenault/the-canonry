/**
 * EntityEditor - Create and manage seed entities.
 */

import React, { useState } from 'react';
import { generateEntityName } from '../../lib/name-generator.js';
import { TagSelector, ToolUsageBadges as UsageBadges, getEntityKindUsageSummary } from '@penguin-tales/shared-components';

// Arctic Blue base theme with frost blue accent (Cosmographer)
const ACCENT_COLOR = '#60a5fa';

const styles = {
  container: {
    display: 'flex',
    gap: '24px',
    height: '100%',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  listPanel: {
    width: '320px',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    marginBottom: '16px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#ffffff'
  },
  subtitle: {
    color: '#93c5fd',
    fontSize: '14px'
  },
  toolbar: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px'
  },
  addButton: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: ACCENT_COLOR,
    color: '#0a1929',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 500,
    fontFamily: 'inherit'
  },
  filterSelect: {
    padding: '8px 12px',
    fontSize: '13px',
    backgroundColor: '#2d4a6f',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '4px',
    color: '#ffffff',
    flex: 1,
    fontFamily: 'inherit'
  },
  entityList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  entityItem: {
    padding: '12px',
    backgroundColor: '#1e3a5f',
    borderRadius: '6px',
    cursor: 'pointer',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  entityItemSelected: {
    borderColor: ACCENT_COLOR
  },
  entityColor: {
    width: '10px',
    height: '10px',
    borderRadius: '50%'
  },
  entityInfo: {
    flex: 1
  },
  entityName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#ffffff'
  },
  entityMeta: {
    fontSize: '11px',
    color: '#60a5fa'
  },
  formPanel: {
    flex: 1,
    backgroundColor: '#1e3a5f',
    borderRadius: '8px',
    padding: '20px',
    overflowY: 'auto',
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },
  formTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '20px',
    color: '#ffffff'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    fontSize: '12px',
    color: '#93c5fd',
    marginBottom: '6px',
    display: 'block',
    fontWeight: 500
  },
  input: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    backgroundColor: '#2d4a6f',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '4px',
    color: '#ffffff',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    backgroundColor: '#2d4a6f',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '4px',
    color: '#ffffff',
    fontFamily: 'inherit'
  },
  textarea: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    backgroundColor: '#2d4a6f',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '4px',
    color: '#ffffff',
    minHeight: '80px',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
  },
  row: {
    display: 'flex',
    gap: '12px'
  },
  coordGroup: {
    flex: 1
  },
  deleteButton: {
    padding: '10px 20px',
    fontSize: '13px',
    backgroundColor: 'transparent',
    color: '#ef4444',
    border: '1px solid #ef4444',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '24px',
    fontFamily: 'inherit'
  },
  emptyState: {
    color: '#60a5fa',
    fontSize: '14px',
    textAlign: 'center',
    padding: '40px'
  },
  emptyForm: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#60a5fa'
  },
  nameRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-end'
  },
  nameInput: {
    flex: 1
  },
  generateButton: {
    padding: '10px 14px',
    fontSize: '13px',
    backgroundColor: ACCENT_COLOR,
    color: '#0a1929',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    fontFamily: 'inherit'
  },
  generateButtonDisabled: {
    backgroundColor: '#1e3a5f',
    color: '#60a5fa',
    cursor: 'not-allowed'
  },
  coordsDisplay: {
    display: 'flex',
    gap: '16px',
    padding: '10px 12px',
    backgroundColor: '#2d4a6f',
    borderRadius: '4px',
    fontSize: '12px',
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },
  coordItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  coordLabel: {
    fontWeight: 600,
    color: ACCENT_COLOR
  },
  coordValue: {
    color: '#ffffff'
  },
  coordHint: {
    fontSize: '11px',
    color: '#60a5fa',
    marginTop: '6px'
  }
};

export default function EntityEditor({ project, onSave, onAddTag, schemaUsage = {} }) {
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [filterKind, setFilterKind] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  const entities = project?.seedEntities || [];
  // Schema v2: entityKinds at project root
  const entityKinds = project?.entityKinds || [];
  const cultures = project?.cultures || [];
  const tagRegistry = project?.tagRegistry || [];

  const filteredEntities = filterKind
    ? entities.filter(e => e.kind === filterKind)
    : entities;

  const selectedEntity = entities.find(e => e.id === selectedEntityId);
  const selectedKindDef = entityKinds.find(k => k.kind === selectedEntity?.kind);

  const updateEntities = (newEntities) => {
    onSave({ seedEntities: newEntities });
  };

  const addEntity = () => {
    const defaultKind = entityKinds[0];
    if (!defaultKind) {
      alert('Define entity kinds in Schema first');
      return;
    }

    const newEntity = {
      id: `entity_${Date.now()}`,
      kind: defaultKind.kind,
      subtype: defaultKind.subtypes[0]?.id || '',
      name: 'New Entity',
      summary: '',
      narrativeHint: '',
      description: '',
      status: defaultKind.statuses[0]?.id || 'active',
      prominence: 'recognized',
      culture: cultures[0]?.id || '',
      tags: {},  // Key-value pairs for semantic tagging
      links: [], // Relationships are stored separately, populated at load time
      coordinates: { x: 50, y: 50, z: 50 },
      createdAt: 0,
      updatedAt: 0
    };

    updateEntities([...entities, newEntity]);
    setSelectedEntityId(newEntity.id);
  };

  const updateEntity = (updates) => {
    if (!selectedEntity) return;

    // If kind changed, reset subtype and status
    if (updates.kind && updates.kind !== selectedEntity.kind) {
      const newKind = entityKinds.find(k => k.kind === updates.kind);
      updates.subtype = newKind?.subtypes[0]?.id || '';
      updates.status = newKind?.statuses[0]?.id || 'active';
    }

    updateEntities(entities.map(e =>
      e.id === selectedEntityId ? { ...e, ...updates } : e
    ));
  };

  const deleteEntity = () => {
    if (!selectedEntity) return;
    if (!confirm(`Delete "${selectedEntity.name}"?`)) return;

    updateEntities(entities.filter(e => e.id !== selectedEntityId));
    setSelectedEntityId(null);
  };

  const getCultureColor = (cultureId) => {
    return cultures.find(c => c.id === cultureId)?.color || '#707080';
  };

  const handleGenerateName = async () => {
    if (!selectedEntity) return;

    const culture = cultures.find(c => c.id === selectedEntity.culture);
    if (!culture) {
      setGenerateError('Select a culture first');
      return;
    }

    // Check if culture has naming profiles
    if (!culture.naming?.profiles || culture.naming.profiles.length === 0) {
      setGenerateError(`Culture "${culture.name || culture.id}" has no naming profiles. Configure naming in Name Forge first.`);
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    try {
      const name = await generateEntityName(culture, {
        kind: selectedEntity.kind,
        subtype: selectedEntity.subtype,
        prominence: selectedEntity.prominence,
        tags: Object.keys(selectedEntity.tags || {}),
      });
      updateEntity({ name });
    } catch (err) {
      console.error('Name generation error:', err);
      setGenerateError(err.message || 'Failed to generate name');
    } finally {
      setGenerating(false);
    }
  };

  // Check if current entity can have names generated
  const canGenerateName = () => {
    if (!selectedEntity) return false;
    const culture = cultures.find(c => c.id === selectedEntity.culture);
    return culture && culture.naming?.profiles && culture.naming.profiles.length > 0;
  };

  // Convert tags from object format { tag: true } to array format ['tag']
  const getTagsAsArray = () => {
    const tags = selectedEntity?.tags || {};
    return Object.keys(tags);
  };

  // Update tags from array format back to object format
  const handleTagsChange = (tagArray) => {
    if (!selectedEntity) return;
    const tagsObj = {};
    tagArray.forEach(tag => {
      tagsObj[tag] = true;
    });
    updateEntity({ tags: tagsObj });
  };

  return (
    <div style={styles.container}>
      <div style={styles.listPanel}>
        <div style={styles.header}>
          <div style={styles.title}>Entities</div>
          <div style={styles.subtitle}>
            Create seed entities to populate your world.
          </div>
        </div>

        <div style={styles.toolbar}>
          <select
            style={styles.filterSelect}
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
          >
            <option value="">All kinds ({entities.length})</option>
            {entityKinds.map(k => (
              <option key={k.kind} value={k.kind}>
                {k.description || k.kind} ({entities.filter(e => e.kind === k.kind).length})
              </option>
            ))}
          </select>
          <button style={styles.addButton} onClick={addEntity}>
            + Add
          </button>
        </div>

        <div style={styles.entityList}>
          {filteredEntities.length === 0 ? (
            <div style={styles.emptyState}>
              {entities.length === 0
                ? 'No entities yet. Create one to get started.'
                : 'No entities match the filter.'}
            </div>
          ) : (
            filteredEntities.map(entity => (
              <div
                key={entity.id}
                style={{
                  ...styles.entityItem,
                  ...(selectedEntityId === entity.id ? styles.entityItemSelected : {})
                }}
                onClick={() => setSelectedEntityId(entity.id)}
              >
                <div style={{ ...styles.entityColor, backgroundColor: getCultureColor(entity.culture) }} />
                <div style={styles.entityInfo}>
                  <div style={styles.entityName}>{entity.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={styles.entityMeta}>
                      {entity.kind} / {entity.subtype || 'no subtype'}
                    </span>
                    <UsageBadges usage={getEntityKindUsageSummary(schemaUsage, entity.kind)} compact />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={styles.formPanel}>
        {!selectedEntity ? (
          <div style={styles.emptyForm}>
            Select an entity to edit, or create a new one.
          </div>
        ) : (
          <>
            <div style={styles.formTitle}>Edit Entity</div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Name</label>
              <div style={styles.nameRow}>
                <input
                  style={{ ...styles.input, ...styles.nameInput }}
                  value={selectedEntity.name}
                  onChange={(e) => updateEntity({ name: e.target.value })}
                />
                <button
                  style={{
                    ...styles.generateButton,
                    ...((!canGenerateName() || generating) ? styles.generateButtonDisabled : {})
                  }}
                  onClick={handleGenerateName}
                  disabled={!canGenerateName() || generating}
                  title={!selectedEntity.culture ? 'Select a culture first' : !canGenerateName() ? 'Configure naming in Name Forge first' : 'Generate a culturally-appropriate name'}
                >
                  {generating ? 'Generating...' : 'Generate'}
                </button>
              </div>
              {generateError && (
                <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px' }}>
                  {generateError}
                </div>
              )}
            </div>

            <div style={styles.row}>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Kind</label>
                <select
                  style={styles.select}
                  value={selectedEntity.kind}
                  onChange={(e) => updateEntity({ kind: e.target.value })}
                >
                  {entityKinds.map(k => (
                    <option key={k.kind} value={k.kind}>{k.description || k.kind}</option>
                  ))}
                </select>
              </div>

              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Subtype</label>
                <select
                  style={styles.select}
                  value={selectedEntity.subtype || ''}
                  onChange={(e) => updateEntity({ subtype: e.target.value })}
                >
                  <option value="">None</option>
                  {selectedKindDef?.subtypes?.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.row}>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Status</label>
                <select
                  style={styles.select}
                  value={selectedEntity.status}
                  onChange={(e) => updateEntity({ status: e.target.value })}
                >
                  {selectedKindDef?.statuses?.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Culture</label>
                <select
                  style={styles.select}
                  value={selectedEntity.culture || ''}
                  onChange={(e) => updateEntity({ culture: e.target.value })}
                >
                  <option value="">None</option>
                  {cultures.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Prominence</label>
              <select
                style={styles.select}
                value={selectedEntity.prominence ?? 2.0}
                onChange={(e) => updateEntity({ prominence: parseFloat(e.target.value) })}
              >
                <option value="0.5">Forgotten</option>
                <option value="1.5">Marginal</option>
                <option value="2.5">Recognized</option>
                <option value="3.5">Renowned</option>
                <option value="4.5">Mythic</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Tags</label>
              <TagSelector
                value={getTagsAsArray()}
                onChange={handleTagsChange}
                tagRegistry={tagRegistry}
                placeholder="Select tags..."
                onAddToRegistry={onAddTag}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Summary</label>
              <textarea
                style={styles.textarea}
                value={selectedEntity.summary ?? selectedEntity.narrativeHint ?? selectedEntity.description ?? ''}
                onChange={(e) => updateEntity({ summary: e.target.value, narrativeHint: e.target.value })}
                placeholder="Optional summary..."
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Coordinates</label>
              <div style={styles.coordsDisplay}>
                {['x', 'y', 'z'].map((axis) => (
                  <div key={axis} style={styles.coordItem}>
                    <span style={styles.coordLabel}>{axis.toUpperCase()}:</span>
                    <span style={styles.coordValue}>{selectedEntity.coordinates?.[axis] ?? 50}</span>
                  </div>
                ))}
              </div>
              <div style={styles.coordHint}>
                Edit coordinates by dragging entities on the Semantic Planes view
              </div>
            </div>

            <button style={styles.deleteButton} onClick={deleteEntity}>
              Delete Entity
            </button>
          </>
        )}
      </div>
    </div>
  );
}
