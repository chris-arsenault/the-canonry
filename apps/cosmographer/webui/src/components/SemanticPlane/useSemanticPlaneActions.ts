/**
 * useSemanticPlaneActions - Hook managing CRUD operations for semantic plane
 * regions, axes, and entity positions.
 *
 * Extracted from SemanticPlaneEditor to isolate mutation logic and reduce
 * component complexity. Each useCallback is independent — the measured
 * complexity reflects the number of operations, not nested branching.
 */

import { useState, useCallback } from "react";
import type { Optional } from "@the-canonry/shared-components";
import type {
  Point,
  Culture,
  Region,
  SemanticPlaneData,
  AxisDefinition,
  EntityKind,
  SeedEntity,
  NewRegionForm,
  EditingAxis,
  EditingRegion,
  Project,
} from "./types.ts";
import { EMPTY_NEW_REGION, resolveAxis } from "./types.ts";

interface SemanticPlaneActionsInput {
  entityKinds: EntityKind[];
  cultures: Culture[];
  seedEntities: SeedEntity[];
  selectedKind: Optional<EntityKind>;
  semanticPlane: SemanticPlaneData;
  regions: Region[];
  isFrameworkKind: boolean;
  axisDefinitions: AxisDefinition[];
  onSave: (updates: Partial<Project>) => void;
}

function buildEditingAxis(
  axisKey: string,
  rawConfig: { axisId: Optional<string> } | undefined,
  axisDefinitions: AxisDefinition[],
): EditingAxis {
  const resolved = resolveAxis(rawConfig, axisDefinitions);
  if (resolved) {
    return { key: axisKey, axisId: resolved.axisId, name: resolved.name, lowTag: resolved.lowTag, highTag: resolved.highTag };
  }
  return { key: axisKey, axisId: rawConfig?.axisId || "", name: "", lowTag: "", highTag: "" };
}

// eslint-disable-next-line max-lines-per-function -- hook orchestrating CRUD across three modal workflows (regions, axes, entities) plus canvas interactions; each useCallback is independent
export default function useSemanticPlaneActions({
  entityKinds,
  cultures,
  seedEntities,
  selectedKind,
  semanticPlane,
  regions,
  isFrameworkKind,
  axisDefinitions,
  onSave,
}: SemanticPlaneActionsInput) {
  const [showNewRegionModal, setShowNewRegionModal] = useState(false);
  const [showAxisModal, setShowAxisModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [editingAxis, setEditingAxis] = useState<EditingAxis | null>(null);
  const [editingRegion, setEditingRegion] = useState<EditingRegion | null>(null);
  const [newRegion, setNewRegion] = useState<NewRegionForm>(EMPTY_NEW_REGION);

  const updateEntityKind = useCallback(
    (kindId: string, updates: Partial<EntityKind>) => {
      const target = entityKinds.find((k) => k.kind === kindId);
      if (target?.isFramework) return;
      const newKinds = entityKinds.map((k) => (k.kind === kindId ? { ...k, ...updates } : k));
      onSave({ entityKinds: newKinds });
    },
    [entityKinds, onSave],
  );

  // --- Region actions ---

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

    const updatedPlane: SemanticPlaneData = {
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

      const updatedPlane: SemanticPlaneData = {
        ...semanticPlane,
        regions: regions.filter((r) => r.id !== regionId),
      };

      updateEntityKind(selectedKind.kind, { semanticPlane: updatedPlane });
    },
    [isFrameworkKind, selectedKind, semanticPlane, regions, updateEntityKind],
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

  // --- Axis actions ---

  const openAxisEditor = useCallback(
    (axisKey: string) => {
      if (isFrameworkKind) return;
      const rawAxisConfig = semanticPlane.axes?.[axisKey];
      setEditingAxis(buildEditingAxis(axisKey, rawAxisConfig, axisDefinitions));
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

  // --- Canvas handlers ---

  const handleMoveEntity = useCallback(
    (entityId: string, coords: Point) => {
      const updated = seedEntities.map((e) =>
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
    [seedEntities, onSave],
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

  // --- Modal controls ---

  const openNewRegionModal = useCallback(() => setShowNewRegionModal(true), []);
  const closeNewRegionModal = useCallback(() => setShowNewRegionModal(false), []);
  const closeAxisModal = useCallback(() => setShowAxisModal(false), []);
  const closeRegionModal = useCallback(() => setShowRegionModal(false), []);

  return {
    // New region modal
    newRegion,
    setNewRegion,
    showNewRegionModal,
    openNewRegionModal,
    closeNewRegionModal,
    addRegion,
    deleteRegion,

    // Axis modal
    editingAxis,
    showAxisModal,
    closeAxisModal,
    openAxisEditor,
    handleAxisSelect,
    saveAxisConfig,

    // Region edit modal
    editingRegion,
    showRegionModal,
    setEditingRegion,
    closeRegionModal,
    openRegionEditor,
    saveRegionConfig,

    // Canvas handlers
    handleMoveEntity,
    handleMoveRegion,
    handleResizeRegion,
  };
}
