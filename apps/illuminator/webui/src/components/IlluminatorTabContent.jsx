import EntityBrowser from "./EntityBrowser";
import ChroniclePanel from "./ChroniclePanel";
import WorldContextEditor from "./WorldContextEditor";
import EntityGuidanceEditor from "./EntityGuidanceEditor";
import VisualIdentityPanel from "./VisualIdentityPanel";
import ActivityPanel from "./ActivityPanel";
import ConfigPanel from "./ConfigPanel";
import CostsPanel from "./CostsPanel";
import StoragePanel from "./StoragePanel";
import TraitPaletteSection from "./TraitPaletteSection";
import StyleLibraryEditor from "./StyleLibraryEditor";
import StaticPagesPanel from "./StaticPagesPanel";
import CoveragePanel from "./CoveragePanel";
import FinalEditTab from "./FinalEditTab";
import EntityCoveragePanel from "./EntityCoveragePanel";
import HistorianConfigEditor from "./HistorianConfigEditor";
import PrePrintPanel from "./PrePrintPanel";
import { isHistorianConfigured } from "../lib/historianTypes";
import { useIlluminatorModals } from "../lib/db/modalStore";

function renderEntitiesTab(props) {
  return (
    <div className="illuminator-content">
      <EntityBrowser
        worldSchema={props.worldSchema}
        config={props.config}
        onConfigChange={props.updateConfig}
        buildPrompt={props.buildPrompt}
        getVisualConfig={props.getVisualConfig}
        styleLibrary={props.styleLibrary}
        imageGenSettings={props.imageGenSettings}
        onStartRevision={props.handleOpenRevisionFilter}
        isRevising={props.isRevisionActive}
        onBulkHistorianReview={props.onBulkHistorianReview}
        onBulkHistorianEdition={props.onBulkHistorianEdition}
        onBulkHistorianClear={props.onBulkHistorianClear}
        isBulkHistorianActive={props.isBulkHistorianActive}
        onNavigateToTab={props.setActiveTab}
      />
    </div>
  );
}

function renderChronicleTab(props) {
  return (
    <div className="illuminator-content">
      <ChroniclePanel
        worldData={props.worldData}
        queue={props.queue}
        onEnqueue={props.enqueue}
        onCancel={props.cancel}
        worldContext={props.worldContext}
        projectId={props.projectId}
        simulationRunId={props.simulationRunId}
        buildPrompt={props.buildPrompt}
        styleLibrary={props.styleLibrary}
        imageGenSettings={props.imageGenSettings}
        entityGuidance={props.entityGuidance}
        cultureIdentities={props.cultureIdentities}
        onBackportLore={props.handleBackportLore}
        onStartBulkBackport={props.handleStartBulkBackport}
        isBulkBackportActive={props.isBulkBackportActive}
        refreshTrigger={props.chronicleRefreshTrigger}
        imageModel={props.config.imageModel}
        onOpenImageSettings={() => useIlluminatorModals.getState().openImageSettings()}
        onHistorianReview={props.handleChronicleHistorianReview}
        isHistorianActive={props.isHistorianActive}
        historianConfigured={isHistorianConfigured(props.historianConfig)}
        historianConfig={props.historianConfig}
        onUpdateHistorianNote={props.handleUpdateHistorianNote}
        onRefreshEraSummaries={props.handleRefreshEraSummaries}
        onNavigateToTab={props.setActiveTab}
      />
    </div>
  );
}

function renderCoverageTab(props) {
  return (
    <div className="illuminator-content">
      <CoveragePanel
        worldContext={props.worldContext}
        simulationRunId={props.simulationRunId}
        onWorldContextChange={props.updateWorldContext}
      />
      <EntityCoveragePanel simulationRunId={props.simulationRunId} />
    </div>
  );
}

function renderContextTab(props) {
  return (
    <div className="illuminator-content">
      <WorldContextEditor
        worldContext={props.worldContext}
        onWorldContextChange={props.updateWorldContext}
        eras={props.eraTemporalInfo}
        onGenerateDynamics={props.handleGenerateDynamics}
        isGeneratingDynamics={props.isDynamicsActive}
      />
    </div>
  );
}

function renderGuidanceTab(props) {
  return (
    <div className="illuminator-content">
      <EntityGuidanceEditor
        entityGuidance={props.entityGuidance}
        onEntityGuidanceChange={props.updateEntityGuidance}
        worldContext={props.worldContext}
        worldSchema={props.worldSchema}
        simulationMetadata={props.simulationMetadata}
      />
    </div>
  );
}

function renderIdentityTab(props) {
  return (
    <div className="illuminator-content">
      <VisualIdentityPanel
        cultures={props.worldSchema?.cultures || []}
        entityKinds={props.worldSchema?.entityKinds || []}
        cultureIdentities={props.cultureIdentities}
        onCultureIdentitiesChange={props.updateCultureIdentities}
      />
    </div>
  );
}

function renderStylesTab(props) {
  return (
    <div className="illuminator-content">
      <StyleLibraryEditor
        styleLibrary={props.styleLibrary}
        loading={props.styleLibraryLoading}
        isCustom={props.hasCustomStyleLibrary}
        onAddArtisticStyle={props.addArtisticStyle}
        onUpdateArtisticStyle={props.updateArtisticStyle}
        onDeleteArtisticStyle={props.deleteArtisticStyle}
        onAddCompositionStyle={props.addCompositionStyle}
        onUpdateCompositionStyle={props.updateCompositionStyle}
        onDeleteCompositionStyle={props.deleteCompositionStyle}
        onAddNarrativeStyle={props.addNarrativeStyle}
        onUpdateNarrativeStyle={props.updateNarrativeStyle}
        onDeleteNarrativeStyle={props.deleteNarrativeStyle}
        onReset={props.resetStyleLibrary}
        entityKinds={(props.worldSchema?.entityKinds || []).map((k) => k.kind)}
      />
    </div>
  );
}

function renderActivityTab(props) {
  return (
    <div className="illuminator-content">
      <ActivityPanel
        queue={props.queue}
        stats={props.stats}
        onCancel={props.cancel}
        onRetry={props.retry}
        onCancelAll={props.cancelAll}
        onClearCompleted={props.clearCompleted}
      />
    </div>
  );
}

function renderTraitsTab(props) {
  return (
    <div className="illuminator-content">
      <TraitPaletteSection
        projectId={props.projectId}
        simulationRunId={props.simulationRunId}
        worldContext={props.worldContext?.description || ""}
        entityKinds={(props.worldSchema?.entityKinds || []).map((k) => k.kind)}
        subtypesByKind={props.subtypesByKind}
        eras={props.eraEntities}
        cultures={(props.worldSchema?.cultures || []).map((c) => ({
          name: c.name,
          description: c.description,
          visualIdentity: c.visualIdentity,
        }))}
        enqueue={props.enqueue}
        queue={props.queue}
        isWorkerReady={props.isWorkerReady}
      />
    </div>
  );
}

function renderConfigureTab(props) {
  return (
    <div className="illuminator-content">
      <ConfigPanel config={props.config} onConfigChange={props.updateConfig} worldSchema={props.worldSchema} />
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Data Sync</h2>
        </div>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
          Import simulation output into Dexie. This is manual by design.
        </p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="illuminator-btn illuminator-btn-primary"
            disabled={props.isDataSyncing || !props.hasHardState}
            onClick={() => props.handleDataSync("patch")}
          >
            {props.isDataSyncing ? "Importing..." : "Patch from Hard State"}
          </button>
          <button
            type="button"
            className="illuminator-btn illuminator-btn-danger"
            disabled={props.isDataSyncing || !props.hasHardState}
            onClick={() => props.handleDataSync("overwrite")}
          >
            Overwrite from Hard State
          </button>
        </div>
        <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-muted)" }}>
          {props.hardStateSummary}
        </div>
        {props.dataSyncStatus && (
          <div
            style={{
              marginTop: "10px",
              fontSize: "12px",
              color: props.dataSyncStatus.type === "error" ? "#ef4444" : "#10b981",
            }}
          >
            {props.dataSyncStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}

function renderFinalEditTab() {
  return (
    <div className="illuminator-content">
      <FinalEditTab />
    </div>
  );
}

function renderPagesTab(props) {
  return (
    <div className="illuminator-content">
      <StaticPagesPanel projectId={props.projectId} />
    </div>
  );
}

function renderCostsTab(props) {
  return (
    <div className="illuminator-content">
      <CostsPanel queue={props.queue} projectId={props.projectId} simulationRunId={props.simulationRunId} />
    </div>
  );
}

function renderStorageTab(props) {
  return (
    <div className="illuminator-content">
      <StoragePanel projectId={props.projectId} />
    </div>
  );
}

function renderHistorianTab(props) {
  return (
    <div className="illuminator-content">
      <HistorianConfigEditor config={props.historianConfig} onChange={props.updateHistorianConfig} />
    </div>
  );
}

function renderPreprintTab(props) {
  return (
    <div className="illuminator-content">
      <PrePrintPanel projectId={props.projectId} simulationRunId={props.simulationRunId} />
    </div>
  );
}

const TAB_RENDERERS = {
  entities: renderEntitiesTab,
  chronicle: renderChronicleTab,
  coverage: renderCoverageTab,
  finaledit: renderFinalEditTab,
  pages: renderPagesTab,
  context: renderContextTab,
  guidance: renderGuidanceTab,
  identity: renderIdentityTab,
  styles: renderStylesTab,
  activity: renderActivityTab,
  costs: renderCostsTab,
  storage: renderStorageTab,
  traits: renderTraitsTab,
  configure: renderConfigureTab,
  historian: renderHistorianTab,
  preprint: renderPreprintTab,
};

export default function IlluminatorTabContent({ activeTab, ...props }) {
  const renderer = TAB_RENDERERS[activeTab];
  return renderer ? renderer(props) : null;
}
