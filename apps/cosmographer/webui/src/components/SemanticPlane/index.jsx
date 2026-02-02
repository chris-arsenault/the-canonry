/**
 * SemanticPlaneEditor - View and edit semantic planes embedded in entity kinds.
 *
 * Schema v2: Each entityKind has a semanticPlane with axes and regions.
 * This editor lets you select a kind, view/place entities, and manage regions.
 */

import React, { useState } from 'react';
import PlaneCanvas from './PlaneCanvas.jsx';
import { TagSelector, NumberInput } from '@penguin-tales/shared-components';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0
  },
  header: {
    flexShrink: 0,
    marginBottom: '12px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '4px'
  },
  subtitle: {
    color: '#888',
    fontSize: '14px'
  },
  toolbar: {
    flexShrink: 0,
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '12px'
  },
  select: {
    padding: '8px 12px',
    fontSize: '14px',
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    minWidth: '200px'
  },
  addButton: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#e94560',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  mainArea: {
    display: 'flex',
    gap: '16px',
    flex: 1,
    minHeight: 0
  },
  canvasContainer: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column'
  },
  sidebar: {
    width: '260px',
    flexShrink: 0,
    backgroundColor: '#16213e',
    borderRadius: '8px',
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  sidebarSection: {},
  sidebarTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#888',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  axisInfo: {
    fontSize: '12px',
    color: '#aaa',
    marginBottom: '6px',
    display: 'flex',
    gap: '8px'
  },
  axisLabel: {
    color: '#e94560',
    fontWeight: 600,
    width: '16px'
  },
  axisRange: {
    color: '#666',
    fontSize: '11px'
  },
  regionItem: {
    padding: '8px 10px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    marginBottom: '6px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer'
  },
  regionItemSelected: {
    backgroundColor: '#0f3460'
  },
  regionColor: {
    width: '12px',
    height: '12px',
    borderRadius: '3px',
    flexShrink: 0
  },
  regionLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  deleteButton: {
    padding: '2px 6px',
    fontSize: '10px',
    backgroundColor: 'transparent',
    color: '#e94560',
    border: '1px solid #e94560',
    borderRadius: '3px',
    cursor: 'pointer',
    flexShrink: 0
  },
  entityItem: {
    padding: '8px 10px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    marginBottom: '4px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer'
  },
  entityItemSelected: {
    backgroundColor: '#0f3460'
  },
  entityDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0
  },
  entityName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  entityCoords: {
    fontSize: '10px',
    color: '#666',
    flexShrink: 0
  },
  emptyState: {
    color: '#666',
    fontSize: '13px',
    textAlign: 'center',
    padding: '40px'
  },
  emptyText: {
    color: '#666',
    fontSize: '12px'
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
    backgroundColor: '#1a1a2e',
    padding: '24px',
    borderRadius: '8px',
    width: '360px'
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '16px'
  },
  formGroup: {
    marginBottom: '12px'
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
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
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
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '16px'
  },
  button: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#0f3460',
    color: '#aaa',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};

export default function SemanticPlaneEditor({ project, onSave, axisDefinitions = [] }) {
  const [selectedKindId, setSelectedKindId] = useState(null);
  const [showNewRegionModal, setShowNewRegionModal] = useState(false);
  const [showAxisModal, setShowAxisModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [editingAxis, setEditingAxis] = useState(null);
  const [editingRegion, setEditingRegion] = useState(null);
  const [newRegion, setNewRegion] = useState({ label: '', x: 50, y: 50, radius: 15, culture: '', tags: [] });
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [selectedRegionId, setSelectedRegionId] = useState(null);

  // Schema v2: entityKinds at project root
  const entityKinds = project?.entityKinds || [];
  const cultures = project?.cultures || [];
  const tagRegistry = project?.tagRegistry || [];
  const seedEntities = project?.seedEntities || [];

  // Helper to resolve axis config - looks up from registry by axisId
  const resolveAxis = (axisConfig) => {
    if (!axisConfig?.axisId) return null;
    const registeredAxis = axisDefinitions.find(a => a.id === axisConfig.axisId);
    if (!registeredAxis) return null;
    return {
      axisId: registeredAxis.id,
      name: registeredAxis.name,
      lowTag: registeredAxis.lowTag,
      highTag: registeredAxis.highTag
    };
  };

  // Select first kind by default
  const selectedKind = entityKinds.find(k => k.kind === selectedKindId) || entityKinds[0];
  const semanticPlane = selectedKind?.semanticPlane || {
    axes: {},
    regions: []
  };
  const planeEntities = seedEntities.filter(e => e.kind === selectedKind?.kind);
  const isFrameworkKind = Boolean(selectedKind?.isFramework);

  const updateEntityKind = (kindId, updates) => {
    const target = entityKinds.find(k => k.kind === kindId);
    if (target?.isFramework) return;
    const newKinds = entityKinds.map(k =>
      k.kind === kindId ? { ...k, ...updates } : k
    );
    onSave({ entityKinds: newKinds });
  };

  const addRegion = () => {
    if (isFrameworkKind) return;
    if (!selectedKind || !newRegion.label.trim()) return;

    // Use culture color if culture is selected, otherwise random color
    const selectedCulture = cultures.find(c => c.id === newRegion.culture);
    const regionColor = selectedCulture?.color ||
      '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

    const region = {
      id: `region_${Date.now()}`,
      label: newRegion.label.trim(),
      color: regionColor,
      culture: newRegion.culture || null,
      tags: newRegion.tags || [],
      bounds: {
        shape: 'circle',
        center: { x: parseFloat(newRegion.x), y: parseFloat(newRegion.y) },
        radius: parseFloat(newRegion.radius)
      }
    };

    const updatedPlane = {
      ...semanticPlane,
      regions: [...(semanticPlane.regions || []), region]
    };

    updateEntityKind(selectedKind.kind, { semanticPlane: updatedPlane });
    setShowNewRegionModal(false);
    setNewRegion({ label: '', x: 50, y: 50, radius: 15, culture: '' });
  };

  const deleteRegion = (regionId) => {
    if (isFrameworkKind) return;
    if (!selectedKind) return;

    const updatedPlane = {
      ...semanticPlane,
      regions: (semanticPlane.regions || []).filter(r => r.id !== regionId)
    };

    updateEntityKind(selectedKind.kind, { semanticPlane: updatedPlane });
  };

  const handleMoveEntity = (entityId, coords) => {
    const entities = project?.seedEntities || [];
    const updated = entities.map(e =>
      e.id === entityId
        ? { ...e, coordinates: { x: Math.round(coords.x), y: Math.round(coords.y), z: e.coordinates?.z || 50 } }
        : e
    );
    onSave({ seedEntities: updated });
  };

  const handleMoveRegion = (regionId, coords) => {
    if (isFrameworkKind) return;
    if (!selectedKind) return;

    const updatedRegions = (semanticPlane.regions || []).map(r =>
      r.id === regionId
        ? {
            ...r,
            bounds: {
              ...r.bounds,
              center: { x: Math.round(coords.x), y: Math.round(coords.y) }
            }
          }
        : r
    );

    const updatedPlane = {
      ...semanticPlane,
      regions: updatedRegions
    };

    updateEntityKind(selectedKind.kind, { semanticPlane: updatedPlane });
  };

  const handleResizeRegion = (regionId, newRadius) => {
    if (isFrameworkKind) return;
    if (!selectedKind) return;

    const updatedRegions = (semanticPlane.regions || []).map(r =>
      r.id === regionId
        ? {
            ...r,
            bounds: {
              ...r.bounds,
              radius: Math.round(newRadius)
            }
          }
        : r
    );

    const updatedPlane = {
      ...semanticPlane,
      regions: updatedRegions
    };

    updateEntityKind(selectedKind.kind, { semanticPlane: updatedPlane });
  };

  const getCultureColor = (cultureId) => {
    return cultures.find(c => c.id === cultureId)?.color || '#888';
  };

  const openRegionEditor = (region) => {
    if (isFrameworkKind) return;
    setEditingRegion({
      ...region,
      tags: region.tags || []
    });
    setShowRegionModal(true);
  };

  const saveRegionConfig = () => {
    if (isFrameworkKind) return;
    if (!selectedKind || !editingRegion) return;

    const updatedRegions = (semanticPlane.regions || []).map(r =>
      r.id === editingRegion.id
        ? {
            ...r,
            label: editingRegion.label,
            culture: editingRegion.culture || null,
            tags: editingRegion.tags || []
          }
        : r
    );

    const updatedPlane = {
      ...semanticPlane,
      regions: updatedRegions
    };

    updateEntityKind(selectedKind.kind, { semanticPlane: updatedPlane });
    setShowRegionModal(false);
    setEditingRegion(null);
  };

  const openAxisEditor = (axisKey) => {
    if (isFrameworkKind) return;
    const rawAxisConfig = semanticPlane.axes?.[axisKey];
    const resolved = resolveAxis(rawAxisConfig);
    setEditingAxis({
      key: axisKey,
      axisId: rawAxisConfig?.axisId || '',
      name: resolved?.name || '',
      lowTag: resolved?.lowTag || '',
      highTag: resolved?.highTag || ''
    });
    setShowAxisModal(true);
  };

  const handleAxisSelect = (axisId) => {
    const axis = axisDefinitions.find(a => a.id === axisId);
    if (axis) {
      setEditingAxis({
        ...editingAxis,
        axisId: axis.id,
        name: axis.name,
        lowTag: axis.lowTag,
        highTag: axis.highTag
      });
    }
  };

  const saveAxisConfig = () => {
    if (isFrameworkKind) return;
    if (!selectedKind || !editingAxis?.axisId) return;

    const updatedAxes = {
      ...semanticPlane.axes,
      [editingAxis.key]: { axisId: editingAxis.axisId }
    };

    const updatedPlane = {
      ...semanticPlane,
      axes: updatedAxes
    };

    updateEntityKind(selectedKind.kind, { semanticPlane: updatedPlane });
    setShowAxisModal(false);
    setEditingAxis(null);
  };

  if (entityKinds.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.title}>Semantic Planes</div>
          <div style={styles.subtitle}>
            View and edit the coordinate space for each entity kind.
          </div>
        </div>
        <div style={styles.emptyState}>
          Define entity kinds in the Enumerist tab first to view their semantic planes.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Semantic Planes</div>
        <div style={styles.subtitle}>
          Drag entities to reposition. Scroll to zoom, drag background to pan.
        </div>
      </div>

      <div style={styles.toolbar}>
        <select
          style={styles.select}
          value={selectedKind?.kind || ''}
          onChange={(e) => {
            setSelectedKindId(e.target.value);
            setSelectedEntityId(null);
            setSelectedRegionId(null);
          }}
        >
          {entityKinds.map(k => (
            <option key={k.kind} value={k.kind}>
              {k.description || k.kind} ({seedEntities.filter(e => e.kind === k.kind).length} entities)
            </option>
          ))}
        </select>
        <button
          style={{
            ...styles.addButton,
            opacity: isFrameworkKind ? 0.6 : 1,
            pointerEvents: isFrameworkKind ? 'none' : 'auto'
          }}
          onClick={() => setShowNewRegionModal(true)}
          disabled={isFrameworkKind}
        >
          + Add Region
        </button>
      </div>

      <div style={styles.mainArea}>
        <div style={styles.canvasContainer}>
          <PlaneCanvas
            plane={semanticPlane}
            regions={semanticPlane.regions || []}
            entities={planeEntities}
            cultures={cultures}
            axisDefinitions={axisDefinitions}
            selectedEntityId={selectedEntityId}
            selectedRegionId={selectedRegionId}
            onSelectEntity={setSelectedEntityId}
            onSelectRegion={setSelectedRegionId}
            onMoveEntity={handleMoveEntity}
            onMoveRegion={handleMoveRegion}
            onResizeRegion={handleResizeRegion}
          />
        </div>

        <div style={styles.sidebar}>
          <div style={styles.sidebarSection}>
            <div style={styles.sidebarTitle}>Axes (click to edit)</div>
            {['x', 'y', 'z'].map(axis => {
              const rawConfig = semanticPlane.axes?.[axis];
              const config = resolveAxis(rawConfig);
              return (
                <div
                  key={axis}
                  style={{
                    ...styles.axisInfo,
                    cursor: isFrameworkKind ? 'default' : 'pointer',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#1a1a2e',
                    marginBottom: '4px',
                    opacity: isFrameworkKind ? 0.6 : 1,
                    pointerEvents: isFrameworkKind ? 'none' : 'auto'
                  }}
                  onClick={() => openAxisEditor(axis)}
                >
                  <span style={styles.axisLabel}>{axis.toUpperCase()}</span>
                  {config ? (
                    <>
                      <span style={{ flex: 1 }}>{config.name}</span>
                      <span style={styles.axisRange}>
                        {config.lowTag} → {config.highTag}
                      </span>
                    </>
                  ) : (
                    <span style={{ flex: 1, color: '#666', fontStyle: 'italic' }}>(not set)</span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={styles.sidebarSection}>
            <div style={styles.sidebarTitle}>
              Regions ({semanticPlane.regions?.length || 0})
            </div>
            {(semanticPlane.regions || []).length === 0 ? (
              <div style={styles.emptyText}>No regions defined</div>
            ) : (
              semanticPlane.regions.map(region => (
                <div
                  key={region.id}
                  style={{
                    ...styles.regionItem,
                    ...(selectedRegionId === region.id ? styles.regionItemSelected : {}),
                    flexDirection: 'column',
                    alignItems: 'stretch'
                  }}
                  onClick={() => {
                    setSelectedRegionId(region.id);
                    setSelectedEntityId(null);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ ...styles.regionColor, backgroundColor: region.color }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={styles.regionLabel}>{region.label}</span>
                      {region.culture && (
                        <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                          {cultures.find(c => c.id === region.culture)?.name || region.culture}
                        </div>
                      )}
                    </div>
                    <button
                      style={{
                        ...styles.deleteButton,
                        backgroundColor: '#0f3460',
                        color: '#aaa',
                        border: 'none',
                        opacity: isFrameworkKind ? 0.5 : 1,
                        pointerEvents: isFrameworkKind ? 'none' : 'auto'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openRegionEditor(region);
                      }}
                      title="Edit region"
                      disabled={isFrameworkKind}
                    >
                      ✎
                    </button>
                    <button
                      style={{
                        ...styles.deleteButton,
                        opacity: isFrameworkKind ? 0.5 : 1,
                        pointerEvents: isFrameworkKind ? 'none' : 'auto'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRegion(region.id);
                      }}
                      title="Delete region"
                      disabled={isFrameworkKind}
                    >
                      ×
                    </button>
                  </div>
                  {region.tags && region.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                      {region.tags.map(tag => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            backgroundColor: '#0f3460',
                            borderRadius: '3px',
                            color: '#aaa'
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div style={styles.sidebarSection}>
            <div style={styles.sidebarTitle}>
              Entities ({planeEntities.length})
            </div>
            {planeEntities.length === 0 ? (
              <div style={styles.emptyText}>
                No {selectedKind?.description || selectedKind?.kind || 'entities'} yet
              </div>
            ) : (
              <>
                {planeEntities.slice(0, 15).map(entity => (
                  <div
                    key={entity.id}
                    style={{
                      ...styles.entityItem,
                      ...(selectedEntityId === entity.id ? styles.entityItemSelected : {})
                    }}
                    onClick={() => setSelectedEntityId(entity.id)}
                  >
                    <div style={{
                      ...styles.entityDot,
                      backgroundColor: getCultureColor(entity.culture)
                    }} />
                    <span style={styles.entityName}>{entity.name}</span>
                    <span style={styles.entityCoords}>
                      ({Math.round(entity.coordinates?.x || 0)}, {Math.round(entity.coordinates?.y || 0)})
                    </span>
                  </div>
                ))}
                {planeEntities.length > 15 && (
                  <div style={{ ...styles.emptyText, marginTop: '4px' }}>
                    +{planeEntities.length - 15} more
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* New Region Modal */}
      {showNewRegionModal && (
        <div style={styles.modal} onClick={() => setShowNewRegionModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>Add Region to {selectedKind?.description || selectedKind?.kind}</div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Label</label>
              <input
                style={styles.input}
                placeholder="Region name"
                value={newRegion.label}
                onChange={e => setNewRegion({ ...newRegion, label: e.target.value })}
                autoFocus
              />
            </div>

            <div style={styles.inputRow}>
              <div style={styles.inputHalf}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Center X (0-100)</label>
                  <NumberInput
                    style={styles.input}
                    min={0}
                    max={100}
                    value={newRegion.x}
                    onChange={v => setNewRegion({ ...newRegion, x: v ?? 0 })}
                    integer
                  />
                </div>
              </div>
              <div style={styles.inputHalf}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Center Y (0-100)</label>
                  <NumberInput
                    style={styles.input}
                    min={0}
                    max={100}
                    value={newRegion.y}
                    onChange={v => setNewRegion({ ...newRegion, y: v ?? 0 })}
                    integer
                  />
                </div>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Radius</label>
              <NumberInput
                style={styles.input}
                min={1}
                max={50}
                value={newRegion.radius}
                onChange={v => setNewRegion({ ...newRegion, radius: v ?? 10 })}
                integer
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Culture Owner (optional)</label>
              <select
                style={styles.select}
                value={newRegion.culture}
                onChange={e => setNewRegion({ ...newRegion, culture: e.target.value })}
              >
                <option value="">None</option>
                {cultures.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Tags</label>
              <TagSelector
                tagRegistry={tagRegistry}
                value={newRegion.tags || []}
                onChange={(tags) => setNewRegion({ ...newRegion, tags })}
                placeholder="Select tags..."
              />
            </div>

            <div style={styles.modalActions}>
              <button style={styles.button} onClick={() => setShowNewRegionModal(false)}>
                Cancel
              </button>
              <button style={styles.addButton} onClick={addRegion}>
                Add Region
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Axis Modal */}
      {showAxisModal && editingAxis && (
        <div style={styles.modal} onClick={() => setShowAxisModal(false)}>
          <div style={{ ...styles.modalContent, width: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>
              Select {editingAxis.key.toUpperCase()} Axis for {selectedKind?.description || selectedKind?.kind}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Axis from Registry</label>
              <select
                style={styles.select}
                value={editingAxis.axisId || ''}
                onChange={e => handleAxisSelect(e.target.value)}
              >
                <option value="" disabled>Select an axis...</option>
                {axisDefinitions.map(axis => (
                  <option key={axis.id} value={axis.id}>
                    {axis.name} ({axis.lowTag} → {axis.highTag})
                  </option>
                ))}
              </select>
            </div>

            {editingAxis.axisId && (
              <div style={{
                padding: '12px',
                backgroundColor: '#1a1a2e',
                borderRadius: '6px',
                marginBottom: '12px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
                  {editingAxis.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#888' }}>
                  <span style={{ padding: '2px 6px', backgroundColor: '#0f3460', borderRadius: '3px', color: '#93c5fd' }}>
                    {editingAxis.lowTag}
                  </span>
                  <span>→</span>
                  <span style={{ padding: '2px 6px', backgroundColor: '#0f3460', borderRadius: '3px', color: '#93c5fd' }}>
                    {editingAxis.highTag}
                  </span>
                </div>
              </div>
            )}

            {axisDefinitions.length === 0 && (
              <div style={{ fontSize: '12px', color: '#f87171', marginBottom: '12px' }}>
                No axes defined. Create axes in the Axis Registry first.
              </div>
            )}

            <div style={styles.modalActions}>
              <button style={styles.button} onClick={() => setShowAxisModal(false)}>
                Cancel
              </button>
              <button
                style={{ ...styles.addButton, opacity: editingAxis.axisId ? 1 : 0.5 }}
                onClick={saveAxisConfig}
                disabled={!editingAxis.axisId}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Region Modal */}
      {showRegionModal && editingRegion && (
        <div style={styles.modal} onClick={() => setShowRegionModal(false)}>
          <div style={{ ...styles.modalContent, width: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>
              Edit Region: {editingRegion.label}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Label</label>
              <input
                style={styles.input}
                placeholder="Region name"
                value={editingRegion.label}
                onChange={e => setEditingRegion({ ...editingRegion, label: e.target.value })}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Culture Owner (optional)</label>
              <select
                style={styles.select}
                value={editingRegion.culture || ''}
                onChange={e => setEditingRegion({ ...editingRegion, culture: e.target.value })}
              >
                <option value="">None</option>
                {cultures.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Tags</label>
              <TagSelector
                tagRegistry={tagRegistry}
                value={editingRegion.tags || []}
                onChange={(tags) => setEditingRegion({ ...editingRegion, tags })}
                placeholder="Select tags..."
              />
            </div>

            <div style={styles.modalActions}>
              <button style={styles.button} onClick={() => setShowRegionModal(false)}>
                Cancel
              </button>
              <button style={styles.addButton} onClick={saveRegionConfig}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
