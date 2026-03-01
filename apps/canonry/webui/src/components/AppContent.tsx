/**
 * AppContent - Tab-based content router for the Canonry shell.
 *
 * Extracted from App.jsx to reduce the main component's complexity.
 * Renders the appropriate MFE host based on the active tab.
 */

import React from "react";
import SchemaEditor from "./SchemaEditor";
import LandingPage from "./LandingPage";
import NameForgeHost from "../remotes/NameForgeHost";
import CosmographerHost from "../remotes/CosmographerHost";
import CoherenceEngineHost from "../remotes/CoherenceEngineHost";
import LoreWeaveHost from "../remotes/LoreWeaveHost";
import IlluminatorHost from "../remotes/IlluminatorHost";
import ArchivistHost from "../remotes/ArchivistHost";
import ChroniclerHost from "../remotes/ChroniclerHost";

/** Stable empty array to avoid creating new references in JSX props */
const EMPTY_ARRAY: never[] = [];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SchemaSlice {
  id: string;
  name: string;
  version: string;
  entityKinds: unknown[];
  relationshipKinds: unknown[];
  cultures: unknown[];
  tagRegistry: unknown[];
  axisDefinitions: unknown[];
  uiConfig?: unknown;
}

interface Project {
  id: string;
  name?: string;
  entityKinds?: unknown[];
  relationshipKinds?: unknown[];
  cultures?: unknown[];
  tagRegistry?: unknown[];
  axisDefinitions?: unknown[];
  seedEntities?: unknown[];
  seedRelationships?: unknown[];
  eras?: unknown[];
  pressures?: unknown[];
  generators?: unknown[];
  systems?: unknown[];
  actions?: unknown[];
  distributionTargets?: unknown;
  [key: string]: unknown;
}

interface ArchivistData {
  worldData: unknown;
  loreData: unknown;
}

interface AppContentProps {
  showHome: boolean;
  activeTab: string | null;
  activeSection: string | null;
  currentProject: Project | null;
  schema: SchemaSlice;
  // Schema update callbacks
  updateEntityKinds: (v: unknown[]) => void;
  updateRelationshipKinds: (v: unknown[]) => void;
  updateCultures: (v: unknown[]) => void;
  updateTagRegistry: (v: unknown[]) => void;
  updateAxisDefinitions: (v: unknown[]) => void;
  updateSeedEntities: (v: unknown[]) => void;
  updateSeedRelationships: (v: unknown[]) => void;
  updateDistributionTargets: (v: unknown) => void;
  updateCultureNaming: (cultureId: string, namingData: unknown) => void;
  addTag: (tag: unknown) => void;
  // Data props
  tagUsage: Record<string, unknown>;
  schemaUsage: Record<string, unknown>;
  namingData: Record<string, unknown>;
  // Simulation / enrichment
  simulationResults: unknown;
  setSimulationResults: (v: unknown) => void;
  simulationState: unknown;
  setSimulationState: (v: unknown) => void;
  archivistData: ArchivistData | null;
  worldContext: unknown;
  setWorldContext: (v: unknown) => void;
  entityGuidance: unknown;
  setEntityGuidance: (v: unknown) => void;
  cultureIdentities: unknown;
  setCultureIdentities: (v: unknown) => void;
  enrichmentConfig: unknown;
  setEnrichmentConfig: (v: unknown) => void;
  styleSelection: unknown;
  setStyleSelection: (v: unknown) => void;
  historianConfig: unknown;
  setHistorianConfig: (v: unknown) => void;
  // Coherence
  updateEras: (v: unknown[]) => void;
  updatePressures: (v: unknown[]) => void;
  updateGenerators: (v: unknown[]) => void;
  updateActions: (v: unknown[]) => void;
  updateSystems: (v: unknown[]) => void;
  // Slots / navigation
  activeSlotIndex: number;
  handleSearchRunScored: (payload: Record<string, unknown>) => Promise<void>;
  setActiveSection: (section: string) => void;
  // Chronicler
  chroniclerRequestedPage: string | null;
  clearChroniclerRequestedPage: () => void;
  // Landing
  handleLandingNavigate: (tab: string) => void;
}

// ---------------------------------------------------------------------------
// Sub-renderers (to keep switch branches small)
// ---------------------------------------------------------------------------

function EnumeristContent(props: AppContentProps) {
  return (
    <SchemaEditor
      project={props.schema}
      activeSection={props.activeSection}
      onSectionChange={props.setActiveSection}
      onUpdateEntityKinds={props.updateEntityKinds}
      onUpdateRelationshipKinds={props.updateRelationshipKinds}
      onUpdateCultures={props.updateCultures}
      onUpdateTagRegistry={props.updateTagRegistry}
      tagUsage={props.tagUsage}
      schemaUsage={props.schemaUsage}
      namingData={props.namingData}
    />
  );
}

function NamesContent(props: AppContentProps) {
  const p = props.currentProject;
  return (
    <NameForgeHost
      projectId={p?.id}
      schema={props.schema}
      onNamingDataChange={props.updateCultureNaming}
      onAddTag={props.addTag}
      activeSection={props.activeSection}
      onSectionChange={props.setActiveSection}
      generators={p?.generators || EMPTY_ARRAY}
    />
  );
}

function CosmographyContent(props: AppContentProps) {
  const p = props.currentProject;
  if (!p) return null;
  return (
    <CosmographerHost
      schema={props.schema}
      axisDefinitions={p.axisDefinitions || EMPTY_ARRAY}
      seedEntities={p.seedEntities}
      seedRelationships={p.seedRelationships}
      onEntityKindsChange={props.updateEntityKinds}
      onCulturesChange={props.updateCultures}
      onAxisDefinitionsChange={props.updateAxisDefinitions}
      onTagRegistryChange={props.updateTagRegistry}
      onSeedEntitiesChange={props.updateSeedEntities}
      onSeedRelationshipsChange={props.updateSeedRelationships}
      onAddTag={props.addTag}
      activeSection={props.activeSection}
      onSectionChange={props.setActiveSection}
      schemaUsage={props.schemaUsage}
    />
  );
}

function CoherenceContent(props: AppContentProps) {
  const p = props.currentProject;
  return (
    <CoherenceEngineHost
      projectId={p?.id}
      schema={props.schema}
      eras={p?.eras || EMPTY_ARRAY}
      onErasChange={props.updateEras}
      pressures={p?.pressures || EMPTY_ARRAY}
      onPressuresChange={props.updatePressures}
      generators={p?.generators || EMPTY_ARRAY}
      onGeneratorsChange={props.updateGenerators}
      actions={p?.actions || EMPTY_ARRAY}
      onActionsChange={props.updateActions}
      systems={p?.systems || EMPTY_ARRAY}
      onSystemsChange={props.updateSystems}
      activeSection={props.activeSection}
      onSectionChange={props.setActiveSection}
    />
  );
}

function SimulationClusterContent(props: AppContentProps) {
  const p = props.currentProject;
  if (!p) return null;
  return (
    <>
      <div className={props.activeTab === "simulation" ? "canonry-remote-pane canonry-remote-pane-visible" : "canonry-remote-pane canonry-remote-pane-hidden"}>
        <LoreWeaveHost
          projectId={p.id}
          schema={props.schema}
          eras={p.eras || EMPTY_ARRAY}
          pressures={p.pressures || EMPTY_ARRAY}
          generators={p.generators || EMPTY_ARRAY}
          systems={p.systems || EMPTY_ARRAY}
          actions={p.actions || EMPTY_ARRAY}
          seedEntities={p.seedEntities || EMPTY_ARRAY}
          seedRelationships={p.seedRelationships || EMPTY_ARRAY}
          distributionTargets={p.distributionTargets || null}
          onDistributionTargetsChange={props.updateDistributionTargets}
          activeSection={props.activeSection}
          onSectionChange={props.setActiveSection}
          simulationResults={props.simulationResults}
          onSimulationResultsChange={props.setSimulationResults}
          simulationState={props.simulationState}
          onSimulationStateChange={props.setSimulationState}
          onSearchRunScored={props.handleSearchRunScored}
        />
      </div>
      <div className={props.activeTab === "illuminator" ? "canonry-remote-pane canonry-remote-pane-visible" : "canonry-remote-pane canonry-remote-pane-hidden"}>
        <IlluminatorHost
          projectId={p.id}
          schema={props.schema}
          worldData={props.archivistData?.worldData}
          worldContext={props.worldContext}
          onWorldContextChange={props.setWorldContext}
          entityGuidance={props.entityGuidance}
          onEntityGuidanceChange={props.setEntityGuidance}
          cultureIdentities={props.cultureIdentities}
          onCultureIdentitiesChange={props.setCultureIdentities}
          enrichmentConfig={props.enrichmentConfig}
          onEnrichmentConfigChange={props.setEnrichmentConfig}
          styleSelection={props.styleSelection}
          onStyleSelectionChange={props.setStyleSelection}
          historianConfig={props.historianConfig}
          onHistorianConfigChange={props.setHistorianConfig}
          activeSection={props.activeSection}
          onSectionChange={props.setActiveSection}
          activeSlotIndex={props.activeSlotIndex}
        />
      </div>
      <div className={props.activeTab === "archivist" ? "canonry-remote-pane canonry-remote-pane-visible" : "canonry-remote-pane canonry-remote-pane-hidden"}>
        <ArchivistHost projectId={p.id} activeSlotIndex={props.activeSlotIndex} />
      </div>
      <div className={props.activeTab === "chronicler" ? "canonry-remote-pane canonry-remote-pane-visible" : "canonry-remote-pane canonry-remote-pane-hidden"}>
        <ChroniclerHost
          projectId={p.id}
          activeSlotIndex={props.activeSlotIndex}
          requestedPageId={props.chroniclerRequestedPage}
          onRequestedPageConsumed={props.clearChroniclerRequestedPage}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AppContent(props: AppContentProps) {
  if (props.showHome || !props.currentProject) {
    return (
      <LandingPage
        onNavigate={props.handleLandingNavigate}
        hasProject={!!props.currentProject}
      />
    );
  }

  switch (props.activeTab) {
    case "enumerist":
      return <EnumeristContent {...props} />;
    case "names":
      return <NamesContent {...props} />;
    case "cosmography":
      return <CosmographyContent {...props} />;
    case "coherence":
      return <CoherenceContent {...props} />;
    case "simulation":
    case "illuminator":
    case "archivist":
    case "chronicler":
      return <SimulationClusterContent {...props} />;
    default:
      return null;
  }
}
