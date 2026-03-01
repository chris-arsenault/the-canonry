/**
 * SemanticPlaneEditor - View and edit semantic planes embedded in entity kinds.
 *
 * Schema v2: Each entityKind has a semanticPlane with axes and regions.
 * This editor lets you select a kind, view/place entities, and manage regions.
 */

import React, { useState } from "react";
import PropTypes from "prop-types";
import PlaneCanvas from "./PlaneCanvas.jsx";
import { TagSelector, NumberInput } from "@the-canonry/shared-components";
import "./SemanticPlane.css";

export default function SemanticPlaneEditor({ project, onSave, axisDefinitions = [] }) {
  const [selectedKindId, setSelectedKindId] = useState(null);
  const [showNewRegionModal, setShowNewRegionModal] = useState(false);
  const [showAxisModal, setShowAxisModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [editingAxis, setEditingAxis] = useState(null);
  const [editingRegion, setEditingRegion] = useState(null);
  const [newRegion, setNewRegion] = useState({
    label: "",
    x: 50,
    y: 50,
    radius: 15,
    culture: "",
    tags: [],
  });
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
    const registeredAxis = axisDefinitions.find((a) => a.id === axisConfig.axisId);
    if (!registeredAxis) return null;
    return {
      axisId: registeredAxis.id,
      name: registeredAxis.name,
      lowTag: registeredAxis.lowTag,
      highTag: registeredAxis.highTag,
    };
  };

  // Select first kind by default
  const selectedKind = entityKinds.find((k) => k.kind === selectedKindId) || entityKinds[0];
  const semanticPlane = selectedKind?.semanticPlane || {
    axes: {},
    regions: [],
  };
  const planeEntities = seedEntities.filter((e) => e.kind === selectedKind?.kind);
  const isFrameworkKind = Boolean(selectedKind?.isFramework);

  const updateEntityKind = (kindId, updates) => {
    const target = entityKinds.find((k) => k.kind === kindId);
    if (target?.isFramework) return;
    const newKinds = entityKinds.map((k) => (k.kind === kindId ? { ...k, ...updates } : k));
    onSave({ entityKinds: newKinds });
  };

  const addRegion = () => {
    if (isFrameworkKind) return;
    if (!selectedKind || !newRegion.label.trim()) return;

    // Use culture color if culture is selected, otherwise random color
    const selectedCulture = cultures.find((c) => c.id === newRegion.culture);
    const regionColor =
      selectedCulture?.color ||
      "#" +
        // eslint-disable-next-line sonarjs/pseudo-random -- non-security random color fallback
        Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, "0");

    const region = {
      id: `region_${Date.now()}`,
      label: newRegion.label.trim(),
      color: regionColor,
      culture: newRegion.culture || null,
      tags: newRegion.tags || [],
      bounds: {
        shape: "circle",
        center: { x: parseFloat(newRegion.x), y: parseFloat(newRegion.y) },
        radius: parseFloat(newRegion.radius),
      },
    };

    const updatedPlane = {
      ...semanticPlane,
      regions: [...(semanticPlane.regions || []), region],
    };

    updateEntityKind(selectedKind.kind, { semanticPlane: updatedPlane });
    setShowNewRegionModal(false);
    setNewRegion({ label: "", x: 50, y: 50, radius: 15, culture: "" });
  };

  const deleteRegion = (regionId) => {
    if (isFrameworkKind) return;
    if (!selectedKind) return;

    const updatedPlane = {
      ...semanticPlane,
      regions: (semanticPlane.regions || []).filter((r) => r.id !== regionId),
    };

    updateEntityKind(selectedKind.kind, { semanticPlane: updatedPlane });
  };

  const handleMoveEntity = (entityId, coords) => {
    const entities = project?.seedEntities || [];
    const updated = entities.map((e) =>
      e.id === entityId
        ? {
            ...e,
            coordinates: {
              x: Math.round(coords.x),
              y: Math.round(coords.y),
              z: e.coordinates?.z || 50,
            },
          }
        : e
    );
    onSave({ seedEntities: updated });
  };

  const handleMoveRegion = (regionId, coords) => {
    if (isFrameworkKind) return;
    if (!selectedKind) return;

    const updatedRegions = (semanticPlane.regions || []).map((r) =>
      r.id === regionId
        ? {
            ...r,
            bounds: {
              ...r.bounds,
              center: { x: Math.round(coords.x), y: Math.round(coords.y) },
            },
          }
        : r
    );

    const updatedPlane = {
      ...semanticPlane,
      regions: updatedRegions,
    };

    updateEntityKind(selectedKind.kind, { semanticPlane: updatedPlane });
  };

  const handleResizeRegion = (regionId, newRadius) => {
    if (isFrameworkKind) return;
    if (!selectedKind) return;

    const updatedRegions = (semanticPlane.regions || []).map((r) =>
      r.id === regionId
        ? {
            ...r,
            bounds: {
              ...r.bounds,
              radius: Math.round(newRadius),
            },
          }
        : r
    );

    const updatedPlane = {
      ...semanticPlane,
      regions: updatedRegions,
    };

    updateEntityKind(selectedKind.kind, { semanticPlane: updatedPlane });
  };

  const getCultureColor = (cultureId) => {
    return cultures.find((c) => c.id === cultureId)?.color || "#888";
  };

  const openRegionEditor = (region) => {
    if (isFrameworkKind) return;
    setEditingRegion({
      ...region,
      tags: region.tags || [],
    });
    setShowRegionModal(true);
  };

  const saveRegionConfig = () => {
    if (isFrameworkKind) return;
    if (!selectedKind || !editingRegion) return;

    const updatedRegions = (semanticPlane.regions || []).map((r) =>
      r.id === editingRegion.id
        ? {
            ...r,
            label: editingRegion.label,
            culture: editingRegion.culture || null,
            tags: editingRegion.tags || [],
          }
        : r
    );

    const updatedPlane = {
      ...semanticPlane,
      regions: updatedRegions,
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
      axisId: rawAxisConfig?.axisId || "",
      name: resolved?.name || "",
      lowTag: resolved?.lowTag || "",
      highTag: resolved?.highTag || "",
    });
    setShowAxisModal(true);
  };

  const handleAxisSelect = (axisId) => {
    const axis = axisDefinitions.find((a) => a.id === axisId);
    if (axis) {
      setEditingAxis({
        ...editingAxis,
        axisId: axis.id,
        name: axis.name,
        lowTag: axis.lowTag,
        highTag: axis.highTag,
      });
    }
  };

  const saveAxisConfig = () => {
    if (isFrameworkKind) return;
    if (!selectedKind || !editingAxis?.axisId) return;

    const updatedAxes = {
      ...semanticPlane.axes,
      [editingAxis.key]: { axisId: editingAxis.axisId },
    };

    const updatedPlane = {
      ...semanticPlane,
      axes: updatedAxes,
    };

    updateEntityKind(selectedKind.kind, { semanticPlane: updatedPlane });
    setShowAxisModal(false);
    setEditingAxis(null);
  };

  if (entityKinds.length === 0) {
    return (
      <div className="sp-container">
        <div className="sp-header">
          <div className="sp-title">Semantic Planes</div>
          <div className="sp-subtitle">
            View and edit the coordinate space for each entity kind.
          </div>
        </div>
        <div className="sp-empty-state">
          Define entity kinds in the Enumerist tab first to view their semantic planes.
        </div>
      </div>
    );
  }

  return (
    <div className="sp-container">
      <div className="sp-header">
        <div className="sp-title">Semantic Planes</div>
        <div className="sp-subtitle">
          Drag entities to reposition. Scroll to zoom, drag background to pan.
        </div>
      </div>

      <div className="sp-toolbar">
        <select
          className="sp-select"
          value={selectedKind?.kind || ""}
          onChange={(e) => {
            setSelectedKindId(e.target.value);
            setSelectedEntityId(null);
            setSelectedRegionId(null);
          }}
        >
          {entityKinds.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.description || k.kind} ({seedEntities.filter((e) => e.kind === k.kind).length}{" "}
              entities)
            </option>
          ))}
        </select>
        <button
          className={`sp-add-button${isFrameworkKind ? " sp-add-button-disabled" : ""}`}
          onClick={() => setShowNewRegionModal(true)}
          disabled={isFrameworkKind}
        >
          + Add Region
        </button>
      </div>

      <div className="sp-main-area">
        <div className="sp-canvas-container">
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

        <div className="sp-sidebar">
          <div>
            <div className="sp-sidebar-title">Axes (click to edit)</div>
            {["x", "y", "z"].map((axis) => {
              const rawConfig = semanticPlane.axes?.[axis];
              const config = resolveAxis(rawConfig);
              return (
                <div
                  key={axis}
                  className={`sp-axis-info${isFrameworkKind ? " sp-axis-info-disabled" : " sp-axis-info-interactive"}`}
                  onClick={() => openAxisEditor(axis)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                >
                  <span className="sp-axis-label">{axis.toUpperCase()}</span>
                  {config ? (
                    <>
                      <span className="sp-axis-name">{config.name}</span>
                      <span className="sp-axis-range">
                        {config.lowTag} → {config.highTag}
                      </span>
                    </>
                  ) : (
                    <span className="sp-axis-unset">(not set)</span>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <div className="sp-sidebar-title">Regions ({semanticPlane.regions?.length || 0})</div>
            {(semanticPlane.regions || []).length === 0 ? (
              <div className="sp-empty-text">No regions defined</div>
            ) : (
              semanticPlane.regions.map((region) => (
                <div
                  key={region.id}
                  className={`sp-region-item${selectedRegionId === region.id ? " sp-region-item-selected" : ""}`}
                  onClick={() => {
                    setSelectedRegionId(region.id);
                    setSelectedEntityId(null);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                >
                  <div className="sp-region-row">
                    <div className="sp-region-color" style={{ '--sp-region-color-bg': region.color }} />
                    <div className="sp-region-info">
                      <span className="sp-region-label">{region.label}</span>
                      {region.culture && (
                        <div className="sp-region-culture">
                          {cultures.find((c) => c.id === region.culture)?.name || region.culture}
                        </div>
                      )}
                    </div>
                    <button
                      className={`sp-region-edit-btn${isFrameworkKind ? " sp-region-edit-btn-disabled" : ""}`}
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
                      className={`sp-delete-button${isFrameworkKind ? " sp-delete-button-disabled" : ""}`}
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
                    <div className="sp-region-tags">
                      {region.tags.map((tag) => (
                        <span
                          key={tag}
                          className="sp-region-tag"
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

          <div>
            <div className="sp-sidebar-title">Entities ({planeEntities.length})</div>
            {planeEntities.length === 0 ? (
              <div className="sp-empty-text">
                No {selectedKind?.description || selectedKind?.kind || "entities"} yet
              </div>
            ) : (
              <>
                {planeEntities.slice(0, 15).map((entity) => (
                  <div
                    key={entity.id}
                    className={`sp-entity-item${selectedEntityId === entity.id ? " sp-entity-item-selected" : ""}`}
                    onClick={() => setSelectedEntityId(entity.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                  >
                    <div
                      className="sp-entity-dot"
                      style={{ '--sp-entity-dot-bg': getCultureColor(entity.culture) }}
                    />
                    <span className="sp-entity-name">{entity.name}</span>
                    <span className="sp-entity-coords">
                      ({Math.round(entity.coordinates?.x || 0)},{" "}
                      {Math.round(entity.coordinates?.y || 0)})
                    </span>
                  </div>
                ))}
                {planeEntities.length > 15 && (
                  <div className="sp-more-text">
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
        <div className="sp-modal" onClick={() => setShowNewRegionModal(false)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
          <div className="sp-modal-content" onClick={(e) => e.stopPropagation()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
            <div className="sp-modal-title">
              Add Region to {selectedKind?.description || selectedKind?.kind}
            </div>

            <div className="sp-form-group">
              <label htmlFor="label" className="sp-label">Label</label>
              <input id="label"
                className="sp-input"
                placeholder="Region name"
                value={newRegion.label}
                onChange={(e) => setNewRegion({ ...newRegion, label: e.target.value })}
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
                    onChange={(v) => setNewRegion({ ...newRegion, x: v ?? 0 })}
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
                    onChange={(v) => setNewRegion({ ...newRegion, y: v ?? 0 })}
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
                onChange={(v) => setNewRegion({ ...newRegion, radius: v ?? 10 })}
                integer
              />
              </label>
            </div>

            <div className="sp-form-group">
              <label htmlFor="culture-owner-optional" className="sp-label">Culture Owner (optional)</label>
              <select id="culture-owner-optional"
                className="sp-select"
                value={newRegion.culture}
                onChange={(e) => setNewRegion({ ...newRegion, culture: e.target.value })}
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
                value={newRegion.tags || []}
                onChange={(tags) => setNewRegion({ ...newRegion, tags })}
                placeholder="Select tags..."
              />
              </label>
            </div>

            <div className="sp-modal-actions">
              <button className="sp-button" onClick={() => setShowNewRegionModal(false)}>
                Cancel
              </button>
              <button className="sp-add-button" onClick={addRegion}>
                Add Region
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Axis Modal */}
      {showAxisModal && editingAxis && (
        <div className="sp-modal" onClick={() => setShowAxisModal(false)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
          <div
            className="sp-modal-content-wide"
            onClick={(e) => e.stopPropagation()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
          >
            <div className="sp-modal-title">
              Select {editingAxis.key.toUpperCase()} Axis for{" "}
              {selectedKind?.description || selectedKind?.kind}
            </div>

            <div className="sp-form-group">
              <label htmlFor="axis-from-registry" className="sp-label">Axis from Registry</label>
              <select id="axis-from-registry"
                className="sp-select"
                value={editingAxis.axisId || ""}
                onChange={(e) => handleAxisSelect(e.target.value)}
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
                <div className="sp-axis-preview-name">
                  {editingAxis.name}
                </div>
                <div className="sp-axis-preview-range">
                  <span className="sp-axis-preview-tag">
                    {editingAxis.lowTag}
                  </span>
                  <span>→</span>
                  <span className="sp-axis-preview-tag">
                    {editingAxis.highTag}
                  </span>
                </div>
              </div>
            )}

            {axisDefinitions.length === 0 && (
              <div className="sp-no-axes-warning">
                No axes defined. Create axes in the Axis Registry first.
              </div>
            )}

            <div className="sp-modal-actions">
              <button className="sp-button" onClick={() => setShowAxisModal(false)}>
                Cancel
              </button>
              <button
                className="sp-add-button"
                style={{ '--sp-save-opacity': editingAxis.axisId ? 1 : 0.5 }}
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
        <div className="sp-modal" onClick={() => setShowRegionModal(false)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
          <div
            className="sp-modal-content-wide"
            onClick={(e) => e.stopPropagation()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
          >
            <div className="sp-modal-title">Edit Region: {editingRegion.label}</div>

            <div className="sp-form-group">
              <label htmlFor="label" className="sp-label">Label</label>
              <input id="label"
                className="sp-input"
                placeholder="Region name"
                value={editingRegion.label}
                onChange={(e) => setEditingRegion({ ...editingRegion, label: e.target.value })}
              />
            </div>

            <div className="sp-form-group">
              <label htmlFor="culture-owner-optional" className="sp-label">Culture Owner (optional)</label>
              <select id="culture-owner-optional"
                className="sp-select"
                value={editingRegion.culture || ""}
                onChange={(e) => setEditingRegion({ ...editingRegion, culture: e.target.value })}
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
                value={editingRegion.tags || []}
                onChange={(tags) => setEditingRegion({ ...editingRegion, tags })}
                placeholder="Select tags..."
              />
              </label>
            </div>

            <div className="sp-modal-actions">
              <button className="sp-button" onClick={() => setShowRegionModal(false)}>
                Cancel
              </button>
              <button className="sp-add-button" onClick={saveRegionConfig}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

SemanticPlaneEditor.propTypes = {
  project: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  axisDefinitions: PropTypes.array,
};
