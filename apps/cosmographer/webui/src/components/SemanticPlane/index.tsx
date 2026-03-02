/**
 * SemanticPlaneEditor - View and edit semantic planes embedded in entity kinds.
 *
 * Schema v2: Each entityKind has a semanticPlane with axes and regions.
 * This editor lets you select a kind, view/place entities, and manage regions.
 */

import React, { useState, useCallback, useMemo } from "react";
import PlaneCanvas from "./PlaneCanvas.tsx";
import NewRegionModal from "./NewRegionModal.tsx";
import EditAxisModal from "./EditAxisModal.tsx";
import EditRegionModal from "./EditRegionModal.tsx";
import { AxisSidebar, RegionSidebar, EntitySidebar } from "./SidebarPanels.tsx";
import useSemanticPlaneActions from "./useSemanticPlaneActions.ts";
import type {
  AxisDefinition,
  Project,
} from "./types.ts";
import { EMPTY_PLANE } from "./types.ts";
import "./SemanticPlane.css";

// ---------------------------------------------------------------------------
// usePlaneData - Derive stable, memoized data from project + selection state
// ---------------------------------------------------------------------------

function usePlaneData(project: Project, selectedKindId: string | null) {
  const entityKinds = useMemo(() => project.entityKinds || [], [project.entityKinds]);
  const cultures = useMemo(() => project.cultures || [], [project.cultures]);
  const tagRegistry = useMemo(() => project.tagRegistry || [], [project.tagRegistry]);
  const seedEntities = useMemo(() => project.seedEntities || [], [project.seedEntities]);

  const selectedKind = entityKinds.find((k) => k.kind === selectedKindId) || entityKinds[0];
  const semanticPlane = selectedKind?.semanticPlane || EMPTY_PLANE;
  const planeEntities = useMemo(
    () => seedEntities.filter((e) => e.kind === selectedKind?.kind),
    [seedEntities, selectedKind?.kind],
  );
  const isFrameworkKind = Boolean(selectedKind?.isFramework);
  const regions = useMemo(() => semanticPlane.regions || [], [semanticPlane.regions]);

  return { entityKinds, cultures, tagRegistry, seedEntities, selectedKind, semanticPlane, planeEntities, isFrameworkKind, regions };
}

// ---------------------------------------------------------------------------
// SemanticPlaneModals - Conditional rendering of all editor modals
// ---------------------------------------------------------------------------

interface SemanticPlaneModalsProps {
  data: ReturnType<typeof usePlaneData>;
  actions: ReturnType<typeof useSemanticPlaneActions>;
  axisDefinitions: AxisDefinition[];
}

function SemanticPlaneModals({ data, actions, axisDefinitions }: Readonly<SemanticPlaneModalsProps>) {
  return (
    <>
      {actions.showNewRegionModal && data.selectedKind && (
        <NewRegionModal
          selectedKind={data.selectedKind}
          cultures={data.cultures}
          tagRegistry={data.tagRegistry}
          newRegion={actions.newRegion}
          onNewRegionChange={actions.setNewRegion}
          onAdd={actions.addRegion}
          onClose={actions.closeNewRegionModal}
        />
      )}

      {actions.showAxisModal && actions.editingAxis && data.selectedKind && (
        <EditAxisModal
          editingAxis={actions.editingAxis}
          selectedKind={data.selectedKind}
          axisDefinitions={axisDefinitions}
          onAxisSelect={actions.handleAxisSelect}
          onSave={actions.saveAxisConfig}
          onClose={actions.closeAxisModal}
        />
      )}

      {actions.showRegionModal && actions.editingRegion && (
        <EditRegionModal
          editingRegion={actions.editingRegion}
          cultures={data.cultures}
          tagRegistry={data.tagRegistry}
          onEditingRegionChange={actions.setEditingRegion}
          onSave={actions.saveRegionConfig}
          onClose={actions.closeRegionModal}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// SemanticPlaneEditor - Main component
// ---------------------------------------------------------------------------

interface SemanticPlaneEditorProps {
  project: Project;
  onSave: (updates: Partial<Project>) => void;
  axisDefinitions: AxisDefinition[];
}

// eslint-disable-next-line max-lines-per-function -- editor rendering toolbar, canvas, sidebar panels, and modal overlays; line count is from JSX structure after all logic was extracted to hooks
export default function SemanticPlaneEditor({
  project,
  onSave,
  axisDefinitions,
}: Readonly<SemanticPlaneEditorProps>) {
  const [selectedKindId, setSelectedKindId] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  const data = usePlaneData(project, selectedKindId);
  const actions = useSemanticPlaneActions({ ...data, axisDefinitions, onSave });

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

  if (data.entityKinds.length === 0) {
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
          value={data.selectedKind?.kind || ""}
          onChange={handleKindChange}
        >
          {data.entityKinds.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.description || k.kind} ({data.seedEntities.filter((e) => e.kind === k.kind).length}{" "}
              entities)
            </option>
          ))}
        </select>
        <button
          className={`sp-add-button${data.isFrameworkKind ? " sp-add-button-disabled" : ""}`}
          onClick={actions.openNewRegionModal}
          disabled={data.isFrameworkKind}
        >
          + Add Region
        </button>
      </div>

      <div className="sp-main-area">
        <div className="sp-canvas-container">
          <PlaneCanvas
            plane={data.semanticPlane}
            regions={data.regions}
            entities={data.planeEntities}
            cultures={data.cultures}
            axisDefinitions={axisDefinitions}
            selectedEntityId={selectedEntityId}
            selectedRegionId={selectedRegionId}
            onSelectEntity={setSelectedEntityId}
            onSelectRegion={setSelectedRegionId}
            onMoveEntity={actions.handleMoveEntity}
            onMoveRegion={actions.handleMoveRegion}
            onResizeRegion={actions.handleResizeRegion}
          />
        </div>

        <div className="sp-sidebar">
          <AxisSidebar
            semanticPlane={data.semanticPlane}
            axisDefinitions={axisDefinitions}
            isFrameworkKind={data.isFrameworkKind}
            onEditAxis={actions.openAxisEditor}
          />

          <RegionSidebar
            regions={data.regions}
            cultures={data.cultures}
            selectedRegionId={selectedRegionId}
            isFrameworkKind={data.isFrameworkKind}
            onSelectRegion={handleSelectRegion}
            onEditRegion={actions.openRegionEditor}
            onDeleteRegion={actions.deleteRegion}
          />

          <EntitySidebar
            entities={data.planeEntities}
            cultures={data.cultures}
            selectedKind={data.selectedKind}
            selectedEntityId={selectedEntityId}
            onSelectEntity={setSelectedEntityId}
          />
        </div>
      </div>

      <SemanticPlaneModals
        data={data}
        actions={actions}
        axisDefinitions={axisDefinitions}
      />
    </div>
  );
}
