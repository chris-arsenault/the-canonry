/**
 * The Canonry - Unified World-Building Suite
 *
 * Shell application that hosts name-forge, cosmographer, and lore-weave
 * as module federation remotes with a unified WorldSeedProject schema.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useProjectStorage } from "./storage/useProjectStorage";
import { useCanonryUiStore, selectActiveSection } from "./stores/useCanonryUiStore";
import { useCanonryAwsStore } from "./stores/useCanonryAwsStore";
import { useImageStore, IndexedDBBackend } from "@the-canonry/image-store";
import { computeTagUsage, computeSchemaUsage, ErrorMessage } from "@the-canonry/shared-components";
import { validateAllConfigs } from "../../../lore-weave/lib/engine/configSchemaValidator";
import {
  mergeFrameworkSchemaSlice,
  FRAMEWORK_ENTITY_KIND_VALUES,
  FRAMEWORK_RELATIONSHIP_KIND_VALUES,
  FRAMEWORK_CULTURES,
  FRAMEWORK_CULTURE_DEFINITIONS,
  FRAMEWORK_TAG_VALUES,
} from "@canonry/world-schema";
import { isTokenValid } from "./aws/awsConfigStorage";
import ProjectManager from "./components/ProjectManager";
import Navigation from "./components/Navigation";
import HelpModal from "./components/HelpModal";
import ExportModal from "./components/ExportModal";
import AwsSyncModal from "./components/AwsSyncModal";
import AppContent from "./components/AppContent";
import { useAwsCallbacks } from "./hooks/useAwsCallbacks";
import { useSlotOperations } from "./hooks/useSlotOperations";
import { useProjectPersistence } from "./hooks/useProjectPersistence";
import { useSchemaUpdaters } from "./hooks/useSchemaUpdaters";
import { useExportCallbacks } from "./hooks/useExportCallbacks";
import { useAppEffects } from "./hooks/useAppEffects";

/** Stable empty array to avoid creating new references in JSX props */
const EMPTY_ARRAY: never[] = [];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function App() {
  // UI state from zustand stores
  const activeTab = useCanonryUiStore((s) => s.activeTab);
  const showHome = useCanonryUiStore((s) => s.showHome);
  const helpModalOpen = useCanonryUiStore((s) => s.helpModalOpen);
  const chroniclerRequestedPage = useCanonryUiStore((s) => s.chroniclerRequestedPage);
  const activeSection = useCanonryUiStore(selectActiveSection);

  // UI actions from zustand store (stable references)
  const setActiveSection = useCanonryUiStore((s) => s.setActiveSection);
  const setActiveSectionForTab = useCanonryUiStore((s) => s.setActiveSectionForTab);
  const handleTabChange = useCanonryUiStore((s) => s.setActiveTab);
  const handleGoHome = useCanonryUiStore((s) => s.goHome);
  const handleLandingNavigate = useCanonryUiStore((s) => s.setActiveTab);
  const clearChroniclerRequestedPage = useCanonryUiStore((s) => s.clearChroniclerRequestedPage);
  const openHelpModal = useCanonryUiStore((s) => s.openHelpModal);
  const closeHelpModal = useCanonryUiStore((s) => s.closeHelpModal);

  // AWS store
  const awsModalOpen = useCanonryAwsStore((s) => s.modalOpen);
  const awsConfig = useCanonryAwsStore((s) => s.config);
  const awsTokens = useCanonryAwsStore((s) => s.tokens);
  const awsStatus = useCanonryAwsStore((s) => s.status);
  const awsBrowseState = useCanonryAwsStore((s) => s.browseState);
  const awsUsername = useCanonryAwsStore((s) => s.username);
  const awsPassword = useCanonryAwsStore((s) => s.password);
  const awsUserLabel = useCanonryAwsStore((s) => s.userLabel);
  const awsSyncProgress = useCanonryAwsStore((s) => s.syncProgress);
  const awsUploadPlan = useCanonryAwsStore((s) => s.uploadPlan);
  const snapshotStatus = useCanonryAwsStore((s) => s.snapshotStatus);
  const updateAwsConfig = useCanonryAwsStore((s) => s.updateConfig);
  const setAwsUsername = useCanonryAwsStore((s) => s.setUsername);
  const setAwsPassword = useCanonryAwsStore((s) => s.setPassword);
  const openAwsModal = useCanonryAwsStore((s) => s.openModal);
  const closeAwsModal = useCanonryAwsStore((s) => s.closeModal);

  // Local state
  const [archivistData, setArchivistData] = useState<{ worldData: unknown; loreData: unknown } | null>(null);
  const [worldContext, setWorldContext] = useState<unknown>(null);
  const [entityGuidance, setEntityGuidance] = useState<unknown>(null);
  const [cultureIdentities, setCultureIdentities] = useState<unknown>(null);
  const [enrichmentConfig, setEnrichmentConfig] = useState<unknown>(null);
  const [styleSelection, setStyleSelection] = useState<unknown>(null);
  const [historianConfig, setHistorianConfig] = useState<unknown>(null);
  const [simulationResults, setSimulationResults] = useState<unknown>(null);
  const [simulationState, setSimulationState] = useState<unknown>(null);
  const [slots, setSlots] = useState<Record<number, Record<string, unknown>>>({});
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [exportModalSlotIndex, setExportModalSlotIndex] = useState<number | null>(null);
  const [exportBundleStatus, setExportBundleStatus] = useState<{
    state: "idle" | "working" | "error";
    detail: string;
  }>({ state: "idle", detail: "" });

  const exportCancelRef = useRef(false);
  const simulationOwnerRef = useRef<string | null>(null);
  const currentProjectRef = useRef<Record<string, unknown> | null>(null);
  const isLoadingSlotRef = useRef(false);
  const lastSavedResultsRef = useRef<unknown>(null);
  const bestRunScoreRef = useRef(-Infinity);
  const bestRunSaveQueueRef = useRef(Promise.resolve());

  // Project storage
  const {
    projects, currentProject, loading, error,
    createProject, openProject, save, removeProject, duplicateProject,
    exportProject, importProject, reloadProjectFromDefaults, DEFAULT_PROJECT_ID,
  } = useProjectStorage();

  // Derived values
  const hasAwsToken = isTokenValid(awsTokens);
  const awsLoginConfigured = Boolean(awsConfig?.cognitoUserPoolId && awsConfig?.cognitoClientId);
  const awsReady = Boolean(awsConfig?.identityPoolId && awsConfig?.region && (!awsLoginConfigured || hasAwsToken));

  // Configure shared image store
  useEffect(() => {
    const backend = new IndexedDBBackend();
    useImageStore.getState().configure(backend);
    return () => useImageStore.getState().cleanup();
  }, []);

  // Keep currentProjectRef in sync
  useEffect(() => {
    currentProjectRef.current = currentProject as Record<string, unknown> | null;
  }, [currentProject]);

  // App lifecycle effects (Cognito tokens, cross-MFE navigation, hash routing, etc.)
  useAppEffects({ activeTab, handleTabChange, awsConfig, awsTokens });

  // AWS callbacks (login, logout, S3 sync, snapshot, etc.)
  const awsCallbacks = useAwsCallbacks({ currentProjectRef });

  // Slot operations
  const slotOps = useSlotOperations({
    currentProject, slots, setSlots, activeSlotIndex, setActiveSlotIndex,
    setSimulationResults, setSimulationState, setArchivistData,
    setWorldContext, setEntityGuidance, setCultureIdentities,
    isLoadingSlotRef, lastSavedResultsRef, exportCancelRef,
    setExportBundleStatus, setExportModalSlotIndex,
    worldContext, entityGuidance, cultureIdentities,
    archivistData, awsConfig,
  });

  // Project data persistence effects
  useProjectPersistence({
    currentProject, slots, setSlots, activeSlotIndex, setActiveSlotIndex,
    simulationResults, setSimulationResults, simulationState, setSimulationState,
    archivistData, setArchivistData,
    worldContext, setWorldContext, entityGuidance, setEntityGuidance,
    cultureIdentities, setCultureIdentities,
    enrichmentConfig, setEnrichmentConfig, styleSelection, setStyleSelection,
    historianConfig, setHistorianConfig,
    simulationOwnerRef, isLoadingSlotRef, lastSavedResultsRef,
    bestRunScoreRef, bestRunSaveQueueRef,
    reloadProjectFromDefaults, save,
  });

  // Schema updaters
  const updaters = useSchemaUpdaters({ currentProject, save });

  // Export callbacks (slot download, bundle export, import)
  const exportCallbacks = useExportCallbacks({
    currentProject, slots, activeSlotIndex, archivistData,
    awsConfig, exportCancelRef, setExportBundleStatus,
    worldContext, entityGuidance, cultureIdentities,
    slotOps,
  });

  // Validation
  const schema = useMemo(() => {
    const baseSchema = currentProject
      ? {
          id: (currentProject as Record<string, unknown>).id as string,
          name: (currentProject as Record<string, unknown>).name as string,
          version: (currentProject as Record<string, unknown>).version as string,
          entityKinds: (currentProject as Record<string, unknown>).entityKinds as unknown[] || [],
          relationshipKinds: (currentProject as Record<string, unknown>).relationshipKinds as unknown[] || [],
          cultures: (currentProject as Record<string, unknown>).cultures as unknown[] || [],
          tagRegistry: (currentProject as Record<string, unknown>).tagRegistry as unknown[] || [],
          axisDefinitions: (currentProject as Record<string, unknown>).axisDefinitions as unknown[] || [],
          uiConfig: (currentProject as Record<string, unknown>).uiConfig,
        }
      : {
          id: "", name: "", version: "",
          entityKinds: [], relationshipKinds: [], cultures: [],
          tagRegistry: [], axisDefinitions: [], uiConfig: undefined,
        };
    return mergeFrameworkSchemaSlice(baseSchema);
  }, [currentProject]);

  const namingData = useMemo(() => {
    if (!currentProject) return {};
    const data: Record<string, unknown> = {};
    const cultures = (currentProject as Record<string, unknown>).cultures as Array<Record<string, unknown>> | undefined;
    (cultures || []).forEach((culture) => {
      if (culture.naming) data[culture.id as string] = culture.naming;
    });
    return data;
  }, [currentProject]);

  const tagUsage = useMemo(() => {
    if (!currentProject) return {};
    const p = currentProject as Record<string, unknown>;
    return computeTagUsage({
      cultures: p.cultures, seedEntities: p.seedEntities, generators: p.generators,
      systems: p.systems, pressures: p.pressures, entityKinds: p.entityKinds,
      axisDefinitions: p.axisDefinitions,
    });
  }, [currentProject]);

  const schemaUsage = useMemo(() => {
    if (!currentProject) return {};
    const p = currentProject as Record<string, unknown>;
    return computeSchemaUsage({
      generators: (p.generators as unknown[]) || [],
      systems: (p.systems as unknown[]) || [],
      actions: (p.actions as unknown[]) || [],
      pressures: (p.pressures as unknown[]) || [],
      seedEntities: (p.seedEntities as unknown[]) || [],
    });
  }, [currentProject]);

  const validationResult = useMemo(() => {
    if (!currentProject) return { valid: true, errors: [], warnings: [] };
    const p = currentProject as Record<string, unknown>;
    const sCultures = (schema.cultures as Array<{ id: string }>)?.map((c) => c.id) || [];
    const sEntityKinds = (schema.entityKinds as Array<{ kind: string }>)?.map((k) => k.kind) || [];
    const sRelKinds = (schema.relationshipKinds as Array<{ kind: string }>)?.map((k) => k.kind) || [];
    return validateAllConfigs({
      templates: (p.generators as unknown[]) || [],
      pressures: (p.pressures as unknown[]) || [],
      systems: (p.systems as unknown[]) || [],
      eras: (p.eras as unknown[]) || [],
      actions: (p.actions as unknown[]) || [],
      seedEntities: (p.seedEntities as unknown[]) || [],
      schema: { cultures: sCultures, entityKinds: sEntityKinds, relationshipKinds: sRelKinds },
    });
  }, [currentProject, schema]);

  const handleNavigateToValidation = useCallback(() => {
    handleTabChange("simulation");
    setActiveSectionForTab("simulation", "validate");
  }, [handleTabChange, setActiveSectionForTab]);

  // Derived modal state
  const hasDataInScratch = Boolean((slots[0] as Record<string, unknown>)?.simulationResults);
  const exportModalSlot = exportModalSlotIndex !== null ? slots[exportModalSlotIndex] : null;
  const exportModalFallbackTitle = exportModalSlotIndex === 0 ? "Scratch" : `Slot ${exportModalSlotIndex}`;
  const exportModalTitle = exportModalSlot
    ? (exportModalSlot.title as string) || exportModalFallbackTitle
    : "Slot";

  if (loading) {
    return (
      <div className="canonry-app-loading">
        <div className="inline-extracted-3">Loading...</div>
      </div>
    );
  }

  return (
    <div className="inline-extracted-4">
      <ProjectManager
        projects={projects}
        currentProject={currentProject}
        onCreateProject={createProject}
        onOpenProject={openProject}
        onDeleteProject={removeProject}
        onDuplicateProject={duplicateProject}
        onExportProject={exportProject}
        onImportProject={importProject}
        onReloadFromDefaults={slotOps.handleReloadFromDefaults}
        defaultProjectId={DEFAULT_PROJECT_ID}
        onGoHome={handleGoHome}
        validationResult={validationResult}
        onNavigateToValidation={handleNavigateToValidation}
        onRemoveProperty={updaters.handleRemoveProperty}
        simulationState={simulationState}
        systems={(currentProject as Record<string, unknown>)?.systems || EMPTY_ARRAY}
        slots={slots}
        activeSlotIndex={activeSlotIndex}
        onLoadSlot={slotOps.handleLoadSlot}
        onSaveToSlot={slotOps.handleSaveToSlot}
        onClearSlot={slotOps.handleClearSlot}
        onUpdateSlotTitle={slotOps.handleUpdateSlotTitle}
        onExportSlot={exportCallbacks.handleExportSlot}
        onImportSlot={exportCallbacks.handleImportSlot}
        onLoadExampleOutput={exportCallbacks.handleLoadExampleOutput}
        hasDataInScratch={hasDataInScratch}
      />
      {currentProject && !showHome && (
        <Navigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onAwsClick={openAwsModal}
          onHelpClick={openHelpModal}
        />
      )}
      <div className="inline-extracted-1">
        <AppContent
          showHome={showHome}
          activeTab={activeTab}
          activeSection={activeSection}
          currentProject={currentProject as Record<string, unknown> | null}
          schema={schema}
          updateEntityKinds={updaters.updateEntityKinds}
          updateRelationshipKinds={updaters.updateRelationshipKinds}
          updateCultures={updaters.updateCultures}
          updateTagRegistry={updaters.updateTagRegistry}
          updateAxisDefinitions={updaters.updateAxisDefinitions}
          updateSeedEntities={updaters.updateSeedEntities}
          updateSeedRelationships={updaters.updateSeedRelationships}
          updateDistributionTargets={updaters.updateDistributionTargets}
          updateCultureNaming={updaters.updateCultureNaming}
          addTag={updaters.addTag}
          tagUsage={tagUsage}
          schemaUsage={schemaUsage}
          namingData={namingData}
          simulationResults={simulationResults}
          setSimulationResults={setSimulationResults}
          simulationState={simulationState}
          setSimulationState={setSimulationState}
          archivistData={archivistData}
          worldContext={worldContext}
          setWorldContext={setWorldContext}
          entityGuidance={entityGuidance}
          setEntityGuidance={setEntityGuidance}
          cultureIdentities={cultureIdentities}
          setCultureIdentities={setCultureIdentities}
          enrichmentConfig={enrichmentConfig}
          setEnrichmentConfig={setEnrichmentConfig}
          styleSelection={styleSelection}
          setStyleSelection={setStyleSelection}
          historianConfig={historianConfig}
          setHistorianConfig={setHistorianConfig}
          updateEras={updaters.updateEras}
          updatePressures={updaters.updatePressures}
          updateGenerators={updaters.updateGenerators}
          updateActions={updaters.updateActions}
          updateSystems={updaters.updateSystems}
          activeSlotIndex={activeSlotIndex}
          handleSearchRunScored={slotOps.handleSearchRunScored}
          setActiveSection={setActiveSection}
          chroniclerRequestedPage={chroniclerRequestedPage}
          clearChroniclerRequestedPage={clearChroniclerRequestedPage}
          handleLandingNavigate={handleLandingNavigate}
        />
      </div>
      <footer className="inline-extracted-5">
        <span>Copyright &copy; 2026</span>
        <a href="https://ahara.io" target="_blank" rel="noopener noreferrer">
          <img src="/tsonu-combined.png" alt="tsonu" height="14" />
        </a>
      </footer>
      {error && <ErrorMessage message={error} />}
      {exportModalSlotIndex !== null && (
        <ExportModal
          slotIndex={exportModalSlotIndex}
          title={exportModalTitle}
          bundleStatus={exportBundleStatus}
          onClose={slotOps.closeExportModal}
          onExportSlotDownload={exportCallbacks.handleExportSlotDownload}
          onExportBundle={exportCallbacks.handleExportBundle}
          onCancelExport={slotOps.handleCancelExportBundle}
          useS3Images={Boolean(awsConfig?.useS3Images)}
        />
      )}
      {awsModalOpen && (
        <AwsSyncModal
          config={awsConfig}
          status={awsStatus}
          browseState={awsBrowseState}
          syncProgress={awsSyncProgress}
          uploadPlan={awsUploadPlan}
          snapshotStatus={snapshotStatus}
          hasAwsToken={hasAwsToken}
          awsReady={awsReady}
          awsLoginConfigured={awsLoginConfigured}
          userLabel={awsUserLabel}
          username={awsUsername}
          password={awsPassword}
          onUpdateConfig={updateAwsConfig}
          onSetUsername={setAwsUsername}
          onSetPassword={setAwsPassword}
          onClose={closeAwsModal}
          onLogin={awsCallbacks.handleAwsLogin}
          onLogout={awsCallbacks.handleAwsLogout}
          onBrowsePrefixes={awsCallbacks.handleAwsBrowsePrefixes}
          onTestSetup={awsCallbacks.handleAwsTestSetup}
          onPreviewUploads={awsCallbacks.handleAwsPreviewUploads}
          onPullImages={awsCallbacks.handlePullImages}
          onSyncImages={awsCallbacks.handleAwsSyncImages}
          onExportSnapshot={awsCallbacks.handleExportSnapshot}
          onImportSnapshot={awsCallbacks.handleImportSnapshot}
        />
      )}
      <HelpModal isOpen={helpModalOpen} onClose={closeHelpModal} activeTab={activeTab} />
    </div>
  );
}
