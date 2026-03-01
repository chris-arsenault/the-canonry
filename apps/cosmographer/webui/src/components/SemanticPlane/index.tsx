/**
 * SemanticPlaneEditor - View and edit semantic planes embedded in entity kinds.
 *
 * Schema v2: Each entityKind has a semanticPlane with axes and regions.
 * This editor lets you select a kind, view/place entities, and manage regions.
 */

import React, { useState, useCallback, useMemo } from "react";
import PlaneCanvas from "./PlaneCanvas.jsx";
import { TagSelector, NumberInput } from "@the-canonry/shared-components";
import "./SemanticPlane.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Point {
  x: number;
  y: number;
  z?: number;
}

interface Culture {
  id: string;
  name: string;
  color?: string;
}

interface TagEntry {
  tag: string;
  category: string;
  rarity: string;
  description?: string;
  isAxis?: boolean;
}

interface RegionBounds {
  shape: string;
  center: Point;
  radius: number;
}

interface Region {
  id: string;
  label: string;
  color: string;
  culture: string | null;
  tags: string[];
  bounds: RegionBounds;
}

interface AxisConfig {
  axisId?: string;
}

interface SemanticPlane {
  axes: Record<string, AxisConfig>;
  regions: Region[];
}

interface AxisDefinition {
  id: string;
  name: string;
  lowTag: string;
  highTag: string;
}

interface ResolvedAxis {
  axisId: string;
  name: string;
  lowTag: string;
  highTag: string;
}

interface EntityKind {
  kind: string;
  description?: string;
  isFramework?: boolean;
  semanticPlane?: SemanticPlane;
}

interface SeedEntity {
  id: string;
  kind: string;
  name: string;
  culture: string;
  coordinates?: Point;
}

interface Project {
  entityKinds?: EntityKind[];
  cultures?: Culture[];
  tagRegistry?: TagEntry[];
  seedEntities?: SeedEntity[];
}

interface NewRegionForm {
  label: string;
  x: number;
  y: number;
  radius: number;
  culture: string;
  tags: string[];
}

interface EditingAxis {
  key: string;
  axisId: string;
  name: string;
  lowTag: string;
  highTag: string;
}

interface EditingRegion {
  id: string;
  label: string;
  culture: string | null;
  tags: string[];
}

interface SemanticPlaneEditorProps {
  project: Project;
  onSave: (updates: Partial<Project>) => void;
  axisDefinitions: AxisDefinition[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_PLANE: SemanticPlane = { axes: {}, regions: [] };
const EMPTY_NEW_REGION: NewRegionForm = { label: "", x: 50, y: 50, radius: 15, culture: "", tags: [] };
const AXIS_KEYS = ["x", "y", "z"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveAxis(
  axisConfig: AxisConfig | undefined,
  axisDefinitions: AxisDefinition[],
): ResolvedAxis | null {
  if (!axisConfig?.axisId) return null;
  const registeredAxis = axisDefinitions.find((a) => a.id === axisConfig.axisId);
  if (!registeredAxis) return null;
  return {
    axisId: registeredAxis.id,
    name: registeredAxis.name,
    lowTag: registeredAxis.lowTag,
    highTag: registeredAxis.highTag,
  };
}

// ---------------------------------------------------------------------------
// NewRegionModal
// ---------------------------------------------------------------------------

interface NewRegionModalProps {
  selectedKind: EntityKind;
  cultures: Culture[];
  tagRegistry: TagEntry[];
  newRegion: NewRegionForm;
  onNewRegionChange: (region: NewRegionForm) => void;
  onAdd: () => void;
  onClose: () => void;
}

function NewRegionModal({
  selectedKind,
  cultures,
  tagRegistry,
  newRegion,
  onNewRegionChange,
  onAdd,
  onClose,
}: NewRegionModalProps) {
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

  return (
    <div className="sp-modal" onClick={onClose} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}>
      <div className="sp-modal-content" onClick={(e) => e.stopPropagation()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}>
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

// ---------------------------------------------------------------------------
// EditAxisModal
// ---------------------------------------------------------------------------

interface EditAxisModalProps {
  editingAxis: EditingAxis;
  selectedKind: EntityKind;
  axisDefinitions: AxisDefinition[];
  onAxisSelect: (axisId: string) => void;
  onSave: () => void;
  onClose: () => void;
}

function EditAxisModal({
  editingAxis,
  selectedKind,
  axisDefinitions,
  onAxisSelect,
  onSave,
  onClose,
}: EditAxisModalProps) {
  const handleAxisChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onAxisSelect(e.target.value),
    [onAxisSelect],
  );

  return (
    <div className="sp-modal" onClick={onClose} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}>
      <div
        className="sp-modal-content-wide"
        onClick={(e) => e.stopPropagation()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
      >
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

// ---------------------------------------------------------------------------
// EditRegionModal
// ---------------------------------------------------------------------------

interface EditRegionModalProps {
  editingRegion: EditingRegion;
  cultures: Culture[];
  tagRegistry: TagEntry[];
  onEditingRegionChange: (region: EditingRegion) => void;
  onSave: () => void;
  onClose: () => void;
}

function EditRegionModal({
  editingRegion,
  cultures,
  tagRegistry,
  onEditingRegionChange,
  onSave,
  onClose,
}: EditRegionModalProps) {
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

  return (
    <div className="sp-modal" onClick={onClose} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}>
      <div
        className="sp-modal-content-wide"
        onClick={(e) => e.stopPropagation()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
      >
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

// ---------------------------------------------------------------------------
// AxisSidebar - Axes section in the sidebar
// ---------------------------------------------------------------------------

interface AxisSidebarProps {
  semanticPlane: SemanticPlane;
  axisDefinitions: AxisDefinition[];
  isFrameworkKind: boolean;
  onEditAxis: (axisKey: string) => void;
}

function AxisSidebar({ semanticPlane, axisDefinitions, isFrameworkKind, onEditAxis }: AxisSidebarProps) {
  return (
    <div>
      <div className="sp-sidebar-title">Axes (click to edit)</div>
      {AXIS_KEYS.map((axis) => {
        const rawConfig = semanticPlane.axes?.[axis];
        const resolved = resolveAxis(rawConfig, axisDefinitions);
        return (
          <div
            key={axis}
            className={`sp-axis-info${isFrameworkKind ? " sp-axis-info-disabled" : " sp-axis-info-interactive"}`}
            onClick={() => onEditAxis(axis)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
          >
            <span className="sp-axis-label">{axis.toUpperCase()}</span>
            {resolved ? (
              <>
                <span className="sp-axis-name">{resolved.name}</span>
                <span className="sp-axis-range">
                  {resolved.lowTag} → {resolved.highTag}
                </span>
              </>
            ) : (
              <span className="sp-axis-unset">(not set)</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RegionSidebar - Regions section in the sidebar
// ---------------------------------------------------------------------------

interface RegionSidebarProps {
  regions: Region[];
  cultures: Culture[];
  selectedRegionId: string | null;
  isFrameworkKind: boolean;
  onSelectRegion: (regionId: string) => void;
  onEditRegion: (region: Region) => void;
  onDeleteRegion: (regionId: string) => void;
}

function RegionSidebar({
  regions,
  cultures,
  selectedRegionId,
  isFrameworkKind,
  onSelectRegion,
  onEditRegion,
  onDeleteRegion,
}: RegionSidebarProps) {
  return (
    <div>
      <div className="sp-sidebar-title">Regions ({regions.length})</div>
      {regions.length === 0 ? (
        <div className="sp-empty-text">No regions defined</div>
      ) : (
        regions.map((region) => (
          <div
            key={region.id}
            className={`sp-region-item${selectedRegionId === region.id ? " sp-region-item-selected" : ""}`}
            onClick={() => onSelectRegion(region.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
          >
            <div className="sp-region-row">
              <div className="sp-region-color" style={{ '--sp-region-color-bg': region.color } as React.CSSProperties} />
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
                  onEditRegion(region);
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
                  onDeleteRegion(region.id);
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
                  <span key={tag} className="sp-region-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntitySidebar - Entities section in the sidebar
// ---------------------------------------------------------------------------

interface EntitySidebarProps {
  entities: SeedEntity[];
  cultures: Culture[];
  selectedKind: EntityKind | undefined;
  selectedEntityId: string | null;
  onSelectEntity: (id: string) => void;
}

function EntitySidebar({
  entities,
  cultures,
  selectedKind,
  selectedEntityId,
  onSelectEntity,
}: EntitySidebarProps) {
  const getCultureColor = useCallback(
    (cultureId: string) => cultures.find((c) => c.id === cultureId)?.color || "#888",
    [cultures],
  );

  return (
    <div>
      <div className="sp-sidebar-title">Entities ({entities.length})</div>
      {entities.length === 0 ? (
        <div className="sp-empty-text">
          No {selectedKind?.description || selectedKind?.kind || "entities"} yet
        </div>
      ) : (
        <>
          {entities.slice(0, 15).map((entity) => (
            <div
              key={entity.id}
              className={`sp-entity-item${selectedEntityId === entity.id ? " sp-entity-item-selected" : ""}`}
              onClick={() => onSelectEntity(entity.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
            >
              <div
                className="sp-entity-dot"
                style={{ '--sp-entity-dot-bg': getCultureColor(entity.culture) } as React.CSSProperties}
              />
              <span className="sp-entity-name">{entity.name}</span>
              <span className="sp-entity-coords">
                ({Math.round(entity.coordinates?.x || 0)},{" "}
                {Math.round(entity.coordinates?.y || 0)})
              </span>
            </div>
          ))}
          {entities.length > 15 && (
            <div className="sp-more-text">
              +{entities.length - 15} more
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SemanticPlaneEditor - Main component
// ---------------------------------------------------------------------------

export default function SemanticPlaneEditor({
  project,
  onSave,
  axisDefinitions,
}: SemanticPlaneEditorProps) {
  const [selectedKindId, setSelectedKindId] = useState<string | null>(null);
  const [showNewRegionModal, setShowNewRegionModal] = useState(false);
  const [showAxisModal, setShowAxisModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [editingAxis, setEditingAxis] = useState<EditingAxis | null>(null);
  const [editingRegion, setEditingRegion] = useState<EditingRegion | null>(null);
  const [newRegion, setNewRegion] = useState<NewRegionForm>(EMPTY_NEW_REGION);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  const entityKinds = project.entityKinds || [];
  const cultures = project.cultures || [];
  const tagRegistry = project.tagRegistry || [];
  const seedEntities = project.seedEntities || [];

  const selectedKind = entityKinds.find((k) => k.kind === selectedKindId) || entityKinds[0];
  const semanticPlane = selectedKind?.semanticPlane || EMPTY_PLANE;
  const planeEntities = useMemo(
    () => seedEntities.filter((e) => e.kind === selectedKind?.kind),
    [seedEntities, selectedKind?.kind],
  );
  const isFrameworkKind = Boolean(selectedKind?.isFramework);
  const regions = useMemo(() => semanticPlane.regions || [], [semanticPlane.regions]);

  const updateEntityKind = useCallback(
    (kindId: string, updates: Partial<EntityKind>) => {
      const target = entityKinds.find((k) => k.kind === kindId);
      if (target?.isFramework) return;
      const newKinds = entityKinds.map((k) => (k.kind === kindId ? { ...k, ...updates } : k));
      onSave({ entityKinds: newKinds });
    },
    [entityKinds, onSave],
  );

  const addRegion = useCallback(() => {
    if (isFrameworkKind || !selectedKind || !newRegion.label.trim()) return;

    const selectedCulture = cultures.find((c) => c.id === newRegion.culture);
    const regionColor =
      selectedCulture?.color ||
      "#" +
        // eslint-disable-next-line sonarjs/pseudo-random -- non-security random color fallback
        Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, "0");

    const region: Region = {
      id: `region_${Date.now()}`,
      label: newRegion.label.trim(),
      color: regionColor,
      culture: newRegion.culture || null,
      tags: newRegion.tags || [],
      bounds: {
        shape: "circle",
        center: { x: newRegion.x, y: newRegion.y },
        radius: newRegion.radius,
      },
    };

    const updatedPlane: SemanticPlane = {
      ...semanticPlane,
      regions: [...regions, region],
    };

    updateEntityKind(selectedKind.kind, { semanticPlane: updatedPlane });
    setShowNewRegionModal(false);
    setNewRegion(EMPTY_NEW_REGION);
  }, [isFrameworkKind, selectedKind, newRegion, cultures, semanticPlane, regions, updateEntityKind]);

  const deleteRegion = useCallback(
    (regionId: string) => {
      if (isFrameworkKind || !selectedKind) return;

      const updatedPlane: SemanticPlane = {
        ...semanticPlane,
        regions: regions.filter((r) => r.id !== regionId),
      };

      updateEntityKind(selectedKind.kind, { semanticPlane: updatedPlane });
    },
    [isFrameworkKind, selectedKind, semanticPlane, regions, updateEntityKind],
  );

  const handleMoveEntity = useCallback(
    (entityId: string, coords: Point) => {
      const entities = project.seedEntities || [];
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
          : e,
      );
      onSave({ seedEntities: updated });
    },
    [project.seedEntities, onSave],
  );

  const handleMoveRegion = useCallback(
    (regionId: string, coords: Point) => {
      if (isFrameworkKind || !selectedKind) return;

      const updatedRegions = regions.map((r) =>
        r.id === regionId
          ? { ...r, bounds: { ...r.bounds, center: { x: Math.round(coords.x), y: Math.round(coords.y) } } }
          : r,
      );

      updateEntityKind(selectedKind.kind, {
        semanticPlane: { ...semanticPlane, regions: updatedRegions },
      });
    },
    [isFrameworkKind, selectedKind, regions, semanticPlane, updateEntityKind],
  );

  const handleResizeRegion = useCallback(
    (regionId: string, newRadius: number) => {
      if (isFrameworkKind || !selectedKind) return;

      const updatedRegions = regions.map((r) =>
        r.id === regionId
          ? { ...r, bounds: { ...r.bounds, radius: Math.round(newRadius) } }
          : r,
      );

      updateEntityKind(selectedKind.kind, {
        semanticPlane: { ...semanticPlane, regions: updatedRegions },
      });
    },
    [isFrameworkKind, selectedKind, regions, semanticPlane, updateEntityKind],
  );

  const openRegionEditor = useCallback(
    (region: Region) => {
      if (isFrameworkKind) return;
      setEditingRegion({ id: region.id, label: region.label, culture: region.culture, tags: region.tags || [] });
      setShowRegionModal(true);
    },
    [isFrameworkKind],
  );

  const saveRegionConfig = useCallback(() => {
    if (isFrameworkKind || !selectedKind || !editingRegion) return;

    const updatedRegions = regions.map((r) =>
      r.id === editingRegion.id
        ? { ...r, label: editingRegion.label, culture: editingRegion.culture || null, tags: editingRegion.tags || [] }
        : r,
    );

    updateEntityKind(selectedKind.kind, {
      semanticPlane: { ...semanticPlane, regions: updatedRegions },
    });
    setShowRegionModal(false);
    setEditingRegion(null);
  }, [isFrameworkKind, selectedKind, editingRegion, regions, semanticPlane, updateEntityKind]);

  const openAxisEditor = useCallback(
    (axisKey: string) => {
      if (isFrameworkKind) return;
      const rawAxisConfig = semanticPlane.axes?.[axisKey];
      const resolved = resolveAxis(rawAxisConfig, axisDefinitions);
      setEditingAxis({
        key: axisKey,
        axisId: rawAxisConfig?.axisId || "",
        name: resolved?.name || "",
        lowTag: resolved?.lowTag || "",
        highTag: resolved?.highTag || "",
      });
      setShowAxisModal(true);
    },
    [isFrameworkKind, semanticPlane.axes, axisDefinitions],
  );

  const handleAxisSelect = useCallback(
    (axisId: string) => {
      const axis = axisDefinitions.find((a) => a.id === axisId);
      if (axis && editingAxis) {
        setEditingAxis({
          ...editingAxis,
          axisId: axis.id,
          name: axis.name,
          lowTag: axis.lowTag,
          highTag: axis.highTag,
        });
      }
    },
    [axisDefinitions, editingAxis],
  );

  const saveAxisConfig = useCallback(() => {
    if (isFrameworkKind || !selectedKind || !editingAxis?.axisId) return;

    const updatedAxes = {
      ...semanticPlane.axes,
      [editingAxis.key]: { axisId: editingAxis.axisId },
    };

    updateEntityKind(selectedKind.kind, {
      semanticPlane: { ...semanticPlane, axes: updatedAxes },
    });
    setShowAxisModal(false);
    setEditingAxis(null);
  }, [isFrameworkKind, selectedKind, editingAxis, semanticPlane, updateEntityKind]);

  const handleKindChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedKindId(e.target.value);
      setSelectedEntityId(null);
      setSelectedRegionId(null);
    },
    [],
  );

  const handleSelectRegion = useCallback((regionId: string) => {
    setSelectedRegionId(regionId);
    setSelectedEntityId(null);
  }, []);

  const handleOpenNewRegion = useCallback(() => setShowNewRegionModal(true), []);
  const handleCloseNewRegion = useCallback(() => setShowNewRegionModal(false), []);
  const handleCloseAxisModal = useCallback(() => setShowAxisModal(false), []);
  const handleCloseRegionModal = useCallback(() => setShowRegionModal(false), []);

  if (entityKinds.length === 0) {
    return (
      <div className="sp-container">
        <div className="sp-header">
          <div className="sp-title">Semantic Planes</div>
          <div className="sp-subtitle">
            View and edit the coordinate space for each entity kind.
          </div>
        </div>
        <div className="viewer-empty-state">
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
          onChange={handleKindChange}
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
          onClick={handleOpenNewRegion}
          disabled={isFrameworkKind}
        >
          + Add Region
        </button>
      </div>

      <div className="sp-main-area">
        <div className="sp-canvas-container">
          <PlaneCanvas
            plane={semanticPlane}
            regions={regions}
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
          <AxisSidebar
            semanticPlane={semanticPlane}
            axisDefinitions={axisDefinitions}
            isFrameworkKind={isFrameworkKind}
            onEditAxis={openAxisEditor}
          />

          <RegionSidebar
            regions={regions}
            cultures={cultures}
            selectedRegionId={selectedRegionId}
            isFrameworkKind={isFrameworkKind}
            onSelectRegion={handleSelectRegion}
            onEditRegion={openRegionEditor}
            onDeleteRegion={deleteRegion}
          />

          <EntitySidebar
            entities={planeEntities}
            cultures={cultures}
            selectedKind={selectedKind}
            selectedEntityId={selectedEntityId}
            onSelectEntity={setSelectedEntityId}
          />
        </div>
      </div>

      {showNewRegionModal && selectedKind && (
        <NewRegionModal
          selectedKind={selectedKind}
          cultures={cultures}
          tagRegistry={tagRegistry}
          newRegion={newRegion}
          onNewRegionChange={setNewRegion}
          onAdd={addRegion}
          onClose={handleCloseNewRegion}
        />
      )}

      {showAxisModal && editingAxis && selectedKind && (
        <EditAxisModal
          editingAxis={editingAxis}
          selectedKind={selectedKind}
          axisDefinitions={axisDefinitions}
          onAxisSelect={handleAxisSelect}
          onSave={saveAxisConfig}
          onClose={handleCloseAxisModal}
        />
      )}

      {showRegionModal && editingRegion && (
        <EditRegionModal
          editingRegion={editingRegion}
          cultures={cultures}
          tagRegistry={tagRegistry}
          onEditingRegionChange={setEditingRegion}
          onSave={saveRegionConfig}
          onClose={handleCloseRegionModal}
        />
      )}
    </div>
  );
}
