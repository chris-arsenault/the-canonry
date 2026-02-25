/**
 * IlluminatorRemote - Module Federation entry point for Illuminator
 *
 * Thin shell that wires extracted hooks and components together.
 * All state management lives in dedicated hooks under ./hooks/.
 * All rendering lives in dedicated components under ./components/.
 */

import { useState } from "react";
import "./App.css";
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
import { isHistorianConfigured } from "./lib/historianTypes";
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
      if (!simulationRunId) { console.error("[rebuildRunIndexes] simulationRunId required"); return; }
      const entities = await entityRepo.getEntitiesForRun(simulationRunId);
      if (!entities.length) { console.error("[rebuildRunIndexes] No entities for run", simulationRunId); return; }
      const record = computeRunIndexes(simulationRunId, entities);
      await upsertRunIndexes(record);
      await useIndexStore.getState().refresh();
    },
    repairFactCoverageWasFaceted,
  };
}

function useIlluminatorFlows({
  projectId, simulationRunId, navEntities, entityNavMap,
  relationshipsByEntity, relationships, prominenceScale, worldContext,
  worldSchema, entityGuidance, reloadEntities, setChronicleRefreshTrigger,
  historianConfig, updateWorldContext,
}) {
  const revision = useRevisionFlow({
    projectId, simulationRunId, navEntities, entityNavMap,
    relationshipsByEntity, prominenceScale, worldContext, worldSchema,
    entityGuidance, reloadEntities,
  });
  const backport = useBackportFlow({
    projectId, simulationRunId,
    getEntityContextsForRevision: revision.getEntityContextsForRevision,
    reloadEntities, setChronicleRefreshTrigger,
  });
  const historian = useHistorianCallbacks({
    projectId, simulationRunId, worldContext, historianConfig,
    reloadEntities, entityNavMap,
  });
  const dynamics = useDynamicsFlow({
    projectId, simulationRunId, worldContext,
    worldSchema, entityNavMap, relationships, updateWorldContext,
  });
  return { ...revision, ...backport, ...historian, ...dynamics };
}

function buildSharedProps({
  projectId, slot, activeTab, setActiveTab, worldData, worldContext, updateWorldContext,
  guidance, historianConfig, updateHistorianConfig, config, updateConfig,
  buildPrompt, getVisualConfig, navEntities, entityNavMap,
  chronicleRefreshTrigger, setChronicleRefreshTrigger, setup, dataSync, flows, apiKeys,
}) {
  return {
    projectId, simulationRunId: slot.simulationRunId, activeTab, setActiveTab,
    worldData, worldContext, updateWorldContext,
    entityGuidance: guidance.entityGuidance, updateEntityGuidance: guidance.updateEntityGuidance,
    cultureIdentities: guidance.cultureIdentities, updateCultureIdentities: guidance.updateCultureIdentities,
    historianConfig, updateHistorianConfig, config, updateConfig,
    buildPrompt, getVisualConfig, navEntities, entityNavMap,
    eraTemporalInfo: slot.eraTemporalInfo,
    chronicleRefreshTrigger, setChronicleRefreshTrigger,
    historianConfigured: isHistorianConfigured(historianConfig),
    ...setup, ...dataSync, ...flows, ...apiKeys,
  };
}

export default function IlluminatorRemote({
  projectId, schema, worldData,
  worldContext: externalWorldContext, onWorldContextChange,
  entityGuidance: externalEntityGuidance, onEntityGuidanceChange,
  cultureIdentities: externalCultureIdentities, onCultureIdentitiesChange,
  enrichmentConfig: externalEnrichmentConfig, onEnrichmentConfigChange,
  onStyleSelectionChange, historianConfig: externalHistorianConfig, onHistorianConfigChange,
  activeSection, onSectionChange, activeSlotIndex = 0,
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
  const { config, updateConfig } = useConfigSync({ externalEnrichmentConfig, onEnrichmentConfigChange });
  const { worldContext, updateWorldContext } = useWorldContextSync({ externalWorldContext, onWorldContextChange });
  const guidance = useEntityGuidanceSync({ externalEntityGuidance, onEntityGuidanceChange, externalCultureIdentities, onCultureIdentitiesChange });
  const { historianConfig, updateHistorianConfig } = useHistorianConfigSync({ externalHistorianConfig, onHistorianConfigChange });
  const slot = useSlotManagement({ projectId, activeSlotIndex, navEntities });
  const dataSync = useDataSync({
    projectId, activeSlotIndex, worldData, hasHardState: Boolean(worldData?.hardState?.length),
    slotRecord: slot.slotRecord, setSlotRecord: slot.setSlotRecord,
    simulationRunId: slot.simulationRunId, eraTemporalInfo: slot.eraTemporalInfo,
  });
  const setup = useIlluminatorSetup({
    projectId, worldData, schema, onStyleSelectionChange, config, apiKeys,
    slotRecord: slot.slotRecord, currentEra: slot.currentEra, simulationRunId: slot.simulationRunId,
    handleEntityUpdate: dataSync.handleEntityUpdate, reloadEntities: dataSync.reloadEntities,
    reloadEntitiesAndEvents: dataSync.reloadEntitiesAndEvents,
    worldContext, historianConfig, entityGuidance: guidance.entityGuidance,
    cultureIdentities: guidance.cultureIdentities, navEntities, setChronicleRefreshTrigger,
  });
  const { buildPrompt, getVisualConfig } = usePromptBuilder({
    entityGuidance: guidance.entityGuidance, cultureIdentities: guidance.cultureIdentities,
    worldContext, relationshipsByEntity, entityNavMap,
    currentEra: slot.currentEra, narrativeEvents, prominentByCulture: slot.prominentByCulture,
    styleSelection: setup.styleSelection, worldSchema: setup.worldSchema, config, prominenceScale,
    styleLibrary: setup.styleLibrary, eraTemporalInfo: slot.eraTemporalInfo,
    eraTemporalInfoByKey: slot.eraTemporalInfoByKey,
  });
  const flows = useIlluminatorFlows({
    projectId, simulationRunId: slot.simulationRunId, navEntities, entityNavMap, relationshipsByEntity, relationships, prominenceScale, worldContext, worldSchema: setup.worldSchema, entityGuidance: guidance.entityGuidance, reloadEntities: dataSync.reloadEntities, setChronicleRefreshTrigger, historianConfig, updateWorldContext,
  });
  if (!setup.hasWorldData) {
    return <IlluminatorEmptyState canImport={setup.canImport} isDataSyncing={dataSync.isDataSyncing} handleDataSync={dataSync.handleDataSync} dataSyncStatus={dataSync.dataSyncStatus} />;
  }
  const sharedProps = buildSharedProps({
    projectId, slot, activeTab, setActiveTab, worldData, worldContext, updateWorldContext, guidance, historianConfig, updateHistorianConfig, config, updateConfig, buildPrompt, getVisualConfig, navEntities, entityNavMap, chronicleRefreshTrigger, setChronicleRefreshTrigger, setup, dataSync, flows, apiKeys,
  });
  return (
    <div className="illuminator-container">
      <IlluminatorSidebar activeTab={activeTab} setActiveTab={setActiveTab} stats={setup.stats} imageGenSettings={setup.imageGenSettings} styleLibrary={setup.styleLibrary} {...apiKeys} />
      <div className="illuminator-main">
        {setup.isTemporarySlot && (
          <div className="illuminator-temp-slot-warning">
            <span className="illuminator-temp-slot-warning-icon">&#x26A0;</span>
            <span>You are enriching data in a <strong>temporary slot</strong>, which will be automatically deleted when a new Lore Weave simulation is run.</span>
          </div>
        )}
        {!apiKeys.hasRequiredKeys && activeTab === "entities" && (
          <div style={{ padding: "12px 16px", marginBottom: "16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "6px", fontSize: "13px" }}>
            Set your API keys in the sidebar to enable enrichment.
          </div>
        )}
        <IlluminatorTabContent {...sharedProps} />
      </div>
      <IlluminatorModals {...sharedProps} />
    </div>
  );
}
