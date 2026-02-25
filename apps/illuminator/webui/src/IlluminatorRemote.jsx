/**
 * IlluminatorRemote - Module Federation entry point for Illuminator
 *
 * Thin shell that wires extracted hooks and components together.
 * All state management lives in dedicated hooks under ./hooks/.
 * All rendering lives in dedicated components under ./components/.
 */

import React, { useState } from "react";
import PropTypes from "prop-types";
import "./App.css";
import "./IlluminatorRemote.css";
import useApiKeys from "./hooks/useApiKeys";
import useConfigSync from "./hooks/useConfigSync";
import useWorldContextSync from "./hooks/useWorldContextSync";
import useEntityGuidanceSync from "./hooks/useEntityGuidanceSync";
import useHistorianConfigSync from "./hooks/useHistorianConfigSync";
import useSlotManagement from "./hooks/useSlotManagement";
import { useDataSync } from "./hooks/useDataSync";
import { usePromptBuilder } from "./hooks/usePromptBuilder";
import { useRevisionFlow } from "./hooks/useRevisionFlow";
import { useBackportFlow } from "./hooks/useBackportFlow";
import { useHistorianCallbacks } from "./hooks/useHistorianCallbacks";
import { useDynamicsFlow } from "./hooks/useDynamicsFlow";
import { useIlluminatorSetup } from "./hooks/useIlluminatorSetup";
import { useEntityNavList, useEntityNavItems } from "./lib/db/entitySelectors";
import { useRelationships, useRelationshipsByEntity } from "./lib/db/relationshipSelectors";
import { useNarrativeEvents } from "./lib/db/narrativeEventSelectors";
import { useProminenceScale } from "./lib/db/indexSelectors";
import { exportImagePrompts, downloadImagePromptExport } from "./lib/db/imageRepository";
import { repairFactCoverageWasFaceted } from "./lib/db/chronicleRepository";
import { computeRunIndexes } from "./lib/db/indexComputation";
import { upsertRunIndexes } from "./lib/db/indexRepository";
import { useIndexStore } from "./lib/db/indexStore";
import * as entityRepo from "./lib/db/entityRepository";
import IlluminatorTabContent from "./components/IlluminatorTabContent";
import IlluminatorEmptyState from "./components/IlluminatorEmptyState";
import IlluminatorSidebar from "./components/IlluminatorSidebar";
import IlluminatorModals from "./components/IlluminatorModals";

// Expose diagnostic functions on window for console access (Module Federation)
initWindowDebug();

function initWindowDebug() {
  if (typeof window === "undefined") return;
  window.illuminatorDebug = {
    exportImagePrompts,
    downloadImagePromptExport,
    async rebuildRunIndexes(simulationRunId) {
      if (!simulationRunId) {
        console.error("[rebuildRunIndexes] simulationRunId required");
        return;
      }
      const entities = await entityRepo.getEntitiesForRun(simulationRunId);
      if (!entities.length) {
        console.error("[rebuildRunIndexes] No entities for run", simulationRunId);
        return;
      }
      const record = computeRunIndexes(simulationRunId, entities);
      await upsertRunIndexes(record);
      await useIndexStore.getState().refresh();
    },
    repairFactCoverageWasFaceted,
  };
}

function useIlluminatorFlows({
  projectId,
  simulationRunId,
  navEntities,
  entityNavMap,
  relationshipsByEntity,
  relationships,
  prominenceScale,
  worldContext,
  worldSchema,
  entityGuidance,
  reloadEntities,
  setChronicleRefreshTrigger,
  historianConfig,
  updateWorldContext,
}) {
  const revisionFlow = useRevisionFlow({
    projectId,
    simulationRunId,
    navEntities,
    entityNavMap,
    relationshipsByEntity,
    prominenceScale,
    worldContext,
    worldSchema,
    entityGuidance,
    reloadEntities,
  });
  const backportFlow = useBackportFlow({
    projectId,
    simulationRunId,
    getEntityContextsForRevision: revisionFlow.getEntityContextsForRevision,
    reloadEntities,
    setChronicleRefreshTrigger,
  });
  const historianFlow = useHistorianCallbacks({
    projectId,
    simulationRunId,
    worldContext,
    historianConfig,
    reloadEntities,
    entityNavMap,
  });
  const dynamicsFlow = useDynamicsFlow({
    projectId,
    simulationRunId,
    worldContext,
    worldSchema,
    entityNavMap,
    relationships,
    updateWorldContext,
  });
  return { revisionFlow, backportFlow, historianFlow, dynamicsFlow };
}

function buildSharedProps({
  activeTab,
  setActiveTab,
  worldData,
  updateWorldContext,
  guidance,
  updateHistorianConfig,
  config,
  updateConfig,
  buildPrompt,
  getVisualConfig,
  chronicleRefreshTrigger,
  setChronicleRefreshTrigger,
  setup,
  dataSync,
  flows,
  apiKeys,
}) {
  return {
    activeTab,
    setActiveTab,
    worldData,
    updateWorldContext,
    updateEntityGuidance: guidance.updateEntityGuidance,
    updateCultureIdentities: guidance.updateCultureIdentities,
    updateHistorianConfig,
    config,
    updateConfig,
    buildPrompt,
    getVisualConfig,
    chronicleRefreshTrigger,
    setChronicleRefreshTrigger,
    ...setup,
    ...dataSync,
    ...apiKeys,
    ...flows,
  };
}

export default function IlluminatorRemote({
  projectId,
  schema,
  worldData,
  worldContext: externalWorldContext,
  onWorldContextChange,
  entityGuidance: externalEntityGuidance,
  onEntityGuidanceChange,
  cultureIdentities: externalCultureIdentities,
  onCultureIdentitiesChange,
  enrichmentConfig: externalEnrichmentConfig,
  onEnrichmentConfigChange,
  onStyleSelectionChange,
  historianConfig: externalHistorianConfig,
  onHistorianConfigChange,
  activeSection,
  onSectionChange,
  activeSlotIndex = 0,
}) {
  const activeTab = activeSection || "entities";
  const setActiveTab = onSectionChange || (() => {});
  const [chronicleRefreshTrigger, setChronicleRefreshTrigger] = useState(0);
  const navEntities = useEntityNavList();
  const entityNavMap = useEntityNavItems();
  const narrativeEvents = useNarrativeEvents();
  const relationships = useRelationships();
  const relationshipsByEntity = useRelationshipsByEntity();
  const prominenceScale = useProminenceScale();
  const apiKeys = useApiKeys();
  const { config, updateConfig } = useConfigSync({
    externalEnrichmentConfig,
    onEnrichmentConfigChange,
  });
  const { worldContext, updateWorldContext } = useWorldContextSync({
    externalWorldContext,
    onWorldContextChange,
  });
  const guidance = useEntityGuidanceSync({
    externalEntityGuidance,
    onEntityGuidanceChange,
    externalCultureIdentities,
    onCultureIdentitiesChange,
  });
  const { historianConfig, updateHistorianConfig } = useHistorianConfigSync({
    externalHistorianConfig,
    onHistorianConfigChange,
  });
  const slot = useSlotManagement({ projectId, activeSlotIndex, navEntities });
  const dataSync = useDataSync({
    projectId,
    activeSlotIndex,
    worldData,
    hasHardState: Boolean(worldData?.hardState?.length),
    slotRecord: slot.slotRecord,
    setSlotRecord: slot.setSlotRecord,
    simulationRunId: slot.simulationRunId,
    eraTemporalInfo: slot.eraTemporalInfo,
  });
  const setup = useIlluminatorSetup({
    projectId,
    worldData,
    schema,
    onStyleSelectionChange,
    config,
    apiKeys,
    slotRecord: slot.slotRecord,
    currentEra: slot.currentEra,
    simulationRunId: slot.simulationRunId,
    handleEntityUpdate: dataSync.handleEntityUpdate,
    reloadEntities: dataSync.reloadEntities,
    reloadEntitiesAndEvents: dataSync.reloadEntitiesAndEvents,
    worldContext,
    historianConfig,
    entityGuidance: guidance.entityGuidance,
    cultureIdentities: guidance.cultureIdentities,
    navEntities,
    setChronicleRefreshTrigger,
  });
  const { buildPrompt, getVisualConfig } = usePromptBuilder({
    entityGuidance: guidance.entityGuidance,
    cultureIdentities: guidance.cultureIdentities,
    worldContext,
    relationshipsByEntity,
    entityNavMap,
    currentEra: slot.currentEra,
    narrativeEvents,
    prominentByCulture: slot.prominentByCulture,
    styleSelection: setup.styleSelection,
    worldSchema: setup.worldSchema,
    config,
    prominenceScale,
    styleLibrary: setup.styleLibrary,
    eraTemporalInfo: slot.eraTemporalInfo,
    eraTemporalInfoByKey: slot.eraTemporalInfoByKey,
  });
  const flows = useIlluminatorFlows({
    projectId,
    simulationRunId: slot.simulationRunId,
    navEntities,
    entityNavMap,
    relationshipsByEntity,
    relationships,
    prominenceScale,
    worldContext,
    worldSchema: setup.worldSchema,
    entityGuidance: guidance.entityGuidance,
    reloadEntities: dataSync.reloadEntities,
    setChronicleRefreshTrigger,
    historianConfig,
    updateWorldContext,
  });
  if (!setup.hasWorldData) {
    return (
      <IlluminatorEmptyState
        canImport={setup.canImport}
        isDataSyncing={dataSync.isDataSyncing}
        handleDataSync={dataSync.handleDataSync}
        dataSyncStatus={dataSync.dataSyncStatus}
      />
    );
  }
  const sharedProps = buildSharedProps({
    activeTab,
    setActiveTab,
    worldData,
    updateWorldContext,
    guidance,
    updateHistorianConfig,
    config,
    updateConfig,
    buildPrompt,
    getVisualConfig,
    chronicleRefreshTrigger,
    setChronicleRefreshTrigger,
    setup,
    dataSync,
    flows,
    apiKeys,
  });
  return (
    <div className="illuminator-container">
      <IlluminatorSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={setup.stats}
        imageGenSettings={setup.imageGenSettings}
        styleLibrary={setup.styleLibrary}
        {...apiKeys}
      />
      <div className="illuminator-main">
        {setup.isTemporarySlot && (
          <div className="illuminator-temp-slot-warning">
            <span className="illuminator-temp-slot-warning-icon">&#x26A0;</span>
            <span>
              You are enriching data in a <strong>temporary slot</strong>, which will be
              automatically deleted when a new Lore Weave simulation is run.
            </span>
          </div>
        )}
        {!apiKeys.hasRequiredKeys && activeTab === "entities" && (
          <div className="ilr-api-key-warning">
            Set your API keys in the sidebar to enable enrichment.
          </div>
        )}
        <IlluminatorTabContent {...sharedProps} />
      </div>
      <IlluminatorModals {...sharedProps} />
    </div>
  );
}

IlluminatorRemote.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  schema: PropTypes.object,
  worldData: PropTypes.object,
  worldContext: PropTypes.object,
  onWorldContextChange: PropTypes.func,
  entityGuidance: PropTypes.object,
  onEntityGuidanceChange: PropTypes.func,
  cultureIdentities: PropTypes.object,
  onCultureIdentitiesChange: PropTypes.func,
  enrichmentConfig: PropTypes.object,
  onEnrichmentConfigChange: PropTypes.func,
  onStyleSelectionChange: PropTypes.func,
  historianConfig: PropTypes.object,
  onHistorianConfigChange: PropTypes.func,
  activeSection: PropTypes.string,
  onSectionChange: PropTypes.func,
  activeSlotIndex: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
