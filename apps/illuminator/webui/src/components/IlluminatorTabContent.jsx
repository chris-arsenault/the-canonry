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
import { useIlluminatorConfigStore } from "../lib/db/illuminatorConfigStore";
import { useEnrichmentQueueStore } from "../lib/db/enrichmentQueueStore";
import { useEraTemporalInfo } from "../lib/db/indexSelectors";

function EntitiesTab({ revisionFlow, historianFlow, ...props }) {
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
        onStartRevision={revisionFlow.handleOpenRevisionFilter}
        isRevising={revisionFlow.isRevisionActive}
        onBulkHistorianReview={historianFlow.handleStartBulkHistorianReview}
        onBulkHistorianEdition={historianFlow.handleStartBulkHistorianEdition}
        onBulkHistorianClear={historianFlow.handleStartBulkHistorianClear}
        isBulkHistorianActive={historianFlow.isBulkHistorianActive}
        onNavigateToTab={props.setActiveTab}
      />
    </div>
  );
}

function ChronicleTab({ backportFlow, historianFlow, ...props }) {
  const { projectId, simulationRunId, worldContext, entityGuidance, cultureIdentities, historianConfig } = useIlluminatorConfigStore();
  const queue = useEnrichmentQueueStore((s) => s.queue);
  return (
    <div className="illuminator-content">
      <ChroniclePanel
        worldData={props.worldData}
        queue={queue}
        onEnqueue={props.enqueue}
        onCancel={props.cancel}
        worldContext={worldContext}
        projectId={projectId}
        simulationRunId={simulationRunId}
        buildPrompt={props.buildPrompt}
        styleLibrary={props.styleLibrary}
        imageGenSettings={props.imageGenSettings}
        entityGuidance={entityGuidance}
        cultureIdentities={cultureIdentities}
        onBackportLore={backportFlow.handleBackportLore}
        onStartBulkBackport={backportFlow.handleStartBulkBackport}
        isBulkBackportActive={backportFlow.isBulkBackportActive}
        refreshTrigger={props.chronicleRefreshTrigger}
        imageModel={props.config.imageModel}
        onOpenImageSettings={() => useIlluminatorModals.getState().openImageSettings()}
        onHistorianReview={historianFlow.handleChronicleHistorianReview}
        isHistorianActive={historianFlow.isHistorianActive}
        historianConfigured={isHistorianConfigured(historianConfig)}
        historianConfig={historianConfig}
        onUpdateHistorianNote={historianFlow.handleUpdateHistorianNote}
        onRefreshEraSummaries={props.handleRefreshEraSummaries}
        onNavigateToTab={props.setActiveTab}
      />
    </div>
  );
}

function CoverageTab(props) {
  const { worldContext, simulationRunId } = useIlluminatorConfigStore();
  return (
    <div className="illuminator-content">
      <CoveragePanel
        worldContext={worldContext}
        simulationRunId={simulationRunId}
        onWorldContextChange={props.updateWorldContext}
      />
      <EntityCoveragePanel simulationRunId={simulationRunId} />
    </div>
  );
}

function ContextTab({ dynamicsFlow, ...props }) {
  const worldContext = useIlluminatorConfigStore((s) => s.worldContext);
  const eraTemporalInfo = useEraTemporalInfo();
  return (
    <div className="illuminator-content">
      <WorldContextEditor
        worldContext={worldContext}
        onWorldContextChange={props.updateWorldContext}
        eras={eraTemporalInfo}
        onGenerateDynamics={dynamicsFlow.handleGenerateDynamics}
        isGeneratingDynamics={dynamicsFlow.isDynamicsActive}
      />
    </div>
  );
}

function GuidanceTab(props) {
  const { worldContext, entityGuidance } = useIlluminatorConfigStore();
  return (
    <div className="illuminator-content">
      <EntityGuidanceEditor
        entityGuidance={entityGuidance}
        onEntityGuidanceChange={props.updateEntityGuidance}
        worldContext={worldContext}
        worldSchema={props.worldSchema}
        simulationMetadata={props.simulationMetadata}
      />
    </div>
  );
}

function IdentityTab(props) {
  const cultureIdentities = useIlluminatorConfigStore((s) => s.cultureIdentities);
  return (
    <div className="illuminator-content">
      <VisualIdentityPanel
        cultures={props.worldSchema?.cultures || []}
        entityKinds={props.worldSchema?.entityKinds || []}
        cultureIdentities={cultureIdentities}
        onCultureIdentitiesChange={props.updateCultureIdentities}
      />
    </div>
  );
}

function StylesTab(props) {
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

function ActivityTab(props) {
  const { queue, stats } = useEnrichmentQueueStore();
  return (
    <div className="illuminator-content">
      <ActivityPanel
        queue={queue}
        stats={stats}
        onCancel={props.cancel}
        onRetry={props.retry}
        onCancelAll={props.cancelAll}
        onClearCompleted={props.clearCompleted}
      />
    </div>
  );
}

function TraitsTab(props) {
  const { projectId, simulationRunId, worldContext } = useIlluminatorConfigStore();
  const queue = useEnrichmentQueueStore((s) => s.queue);
  return (
    <div className="illuminator-content">
      <TraitPaletteSection
        projectId={projectId}
        simulationRunId={simulationRunId}
        worldContext={worldContext?.description || ""}
        entityKinds={(props.worldSchema?.entityKinds || []).map((k) => k.kind)}
        subtypesByKind={props.subtypesByKind}
        eras={props.eraEntities}
        cultures={(props.worldSchema?.cultures || []).map((c) => ({
          name: c.name,
          description: c.description,
          visualIdentity: c.visualIdentity,
        }))}
        enqueue={props.enqueue}
        queue={queue}
        isWorkerReady={props.isWorkerReady}
      />
    </div>
  );
}

function ConfigureTab(props) {
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

function FinalEditTabWrapper() {
  return (
    <div className="illuminator-content">
      <FinalEditTab />
    </div>
  );
}

function PagesTab() {
  const projectId = useIlluminatorConfigStore((s) => s.projectId);
  return (
    <div className="illuminator-content">
      <StaticPagesPanel projectId={projectId} />
    </div>
  );
}

function CostsTab() {
  const { projectId, simulationRunId } = useIlluminatorConfigStore();
  const queue = useEnrichmentQueueStore((s) => s.queue);
  return (
    <div className="illuminator-content">
      <CostsPanel queue={queue} projectId={projectId} simulationRunId={simulationRunId} />
    </div>
  );
}

function StorageTab() {
  const projectId = useIlluminatorConfigStore((s) => s.projectId);
  return (
    <div className="illuminator-content">
      <StoragePanel projectId={projectId} />
    </div>
  );
}

function HistorianTab(props) {
  const historianConfig = useIlluminatorConfigStore((s) => s.historianConfig);
  return (
    <div className="illuminator-content">
      <HistorianConfigEditor config={historianConfig} onChange={props.updateHistorianConfig} />
    </div>
  );
}

function PreprintTab() {
  const { projectId, simulationRunId } = useIlluminatorConfigStore();
  return (
    <div className="illuminator-content">
      <PrePrintPanel projectId={projectId} simulationRunId={simulationRunId} />
    </div>
  );
}

const TAB_COMPONENTS = {
  entities: EntitiesTab,
  chronicle: ChronicleTab,
  coverage: CoverageTab,
  finaledit: FinalEditTabWrapper,
  pages: PagesTab,
  context: ContextTab,
  guidance: GuidanceTab,
  identity: IdentityTab,
  styles: StylesTab,
  activity: ActivityTab,
  costs: CostsTab,
  storage: StorageTab,
  traits: TraitsTab,
  configure: ConfigureTab,
  historian: HistorianTab,
  preprint: PreprintTab,
};

export default function IlluminatorTabContent({ activeTab, ...props }) {
  const TabComponent = TAB_COMPONENTS[activeTab];
  return TabComponent ? <TabComponent {...props} /> : null;
}
