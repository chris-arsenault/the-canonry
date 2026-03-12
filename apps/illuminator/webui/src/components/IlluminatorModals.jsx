import PropTypes from "prop-types";
import ImageSettingsDrawer from "./ImageSettingsDrawer";
import DynamicsGenerationModal from "./DynamicsGenerationModal";
import RevisionFilterModal from "./RevisionFilterModal";
import SummaryRevisionModal from "./SummaryRevisionModal";
import BackportConfigModal from "./BackportConfigModal";
import HistorianReviewModal from "./HistorianReviewModal";
import EntityRenameModal from "./EntityRenameModal";
import CreateEntityModal from "./CreateEntityModal";
import { ThinkingViewer } from "./ThinkingViewer";
import { FloatingPills } from "./FloatingPills";
import { useIlluminatorModals } from "../lib/db/modalStore";
import { useIlluminatorConfigStore } from "../lib/db/illuminatorConfigStore";
import { useEraTemporalInfo } from "../lib/db/indexSelectors";
import React from "react";

function ImageSettingsSection({
  imageGenSettings,
  updateImageGenSettings,
  styleLibrary,
  worldSchema,
  config,
  updateConfig,
}) {
  const imageSettingsOpen = useIlluminatorModals((s) => s.imageSettingsOpen);
  return (
    <ImageSettingsDrawer
      isOpen={imageSettingsOpen}
      onClose={() => useIlluminatorModals.getState().closeImageSettings()}
      settings={imageGenSettings}
      onSettingsChange={updateImageGenSettings}
      styleLibrary={styleLibrary}
      cultures={worldSchema?.cultures}
      imageModel={config.imageModel}
      onImageModelChange={(model) => updateConfig({ imageModel: model })}
    />
  );
}

function DynamicsSection({ dynamicsFlow }) {
  return (
    <DynamicsGenerationModal
      run={dynamicsFlow.dynamicsRun}
      isActive={dynamicsFlow.isDynamicsActive}
      onSubmitFeedback={dynamicsFlow.submitDynamicsFeedback}
      onAccept={dynamicsFlow.acceptDynamics}
      onCancel={dynamicsFlow.cancelDynamicsGeneration}
    />
  );
}

function RevisionSection({ revisionFlow }) {
  return (
    <>
      <RevisionFilterModal
        isOpen={revisionFlow.revisionFilter.open}
        totalEligible={revisionFlow.revisionFilter.totalEligible}
        usedInChronicles={revisionFlow.revisionFilter.usedInChronicles}
        onStart={revisionFlow.handleStartRevision}
        onCancel={() => revisionFlow.setRevisionFilter((prev) => ({ ...prev, open: false }))}
      />
      <SummaryRevisionModal
        run={revisionFlow.revisionRun}
        isActive={revisionFlow.isRevisionActive}
        onContinue={revisionFlow.continueToNextBatch}
        onAutoContine={revisionFlow.autoContineAllRevision}
        onTogglePatch={revisionFlow.togglePatchDecision}
        onAccept={revisionFlow.handleAcceptRevision}
        onCancel={revisionFlow.cancelRevision}
        getEntityContexts={revisionFlow.getEntityContextsForRevision}
      />
    </>
  );
}

function BackportSection({ backportFlow, revisionFlow }) {
  return (
    <>
      <BackportConfigModal
        isOpen={backportFlow.backportConfig !== null}
        chronicleTitle={backportFlow.backportConfig?.chronicleTitle || ""}
        entities={backportFlow.backportConfig?.entities || []}
        perEntityStatus={backportFlow.backportConfig?.perEntityStatus || {}}
        onStart={backportFlow.handleBackportConfigStart}
        onMarkNotNeeded={backportFlow.handleMarkEntityNotNeeded}
        onCancel={() => backportFlow.setBackportConfig(null)}
      />
      <SummaryRevisionModal
        run={backportFlow.backportRun}
        isActive={backportFlow.isBackportActive}
        onTogglePatch={backportFlow.toggleBackportPatchDecision}
        onAccept={backportFlow.handleAcceptBackport}
        onCancel={backportFlow.cancelBackport}
        getEntityContexts={revisionFlow.getEntityContextsForRevision}
        onUpdateAnchorPhrase={backportFlow.updateBackportAnchorPhrase}
      />
    </>
  );
}

function HistorianSection({ historianFlow, revisionFlow }) {
  return (
    <>
      <SummaryRevisionModal
        run={historianFlow.historianEditionRun}
        isActive={historianFlow.isHistorianEditionActive}
        onTogglePatch={historianFlow.toggleHistorianEditionPatchDecision}
        onAccept={historianFlow.handleAcceptHistorianEdition}
        onCancel={historianFlow.cancelHistorianEdition}
        getEntityContexts={revisionFlow.getEntityContextsForRevision}
        descriptionBaseline={historianFlow.historianEditionRun?.worldDynamicsContext}
      />
      <HistorianReviewModal
        run={historianFlow.historianRun}
        isActive={historianFlow.isHistorianActive}
        onToggleNote={historianFlow.toggleHistorianNoteDecision}
        onEditNoteText={historianFlow.handleEditHistorianNoteText}
        onAccept={historianFlow.handleAcceptHistorianNotes}
        onCancel={historianFlow.cancelHistorianReview}
      />
    </>
  );
}

function EntityModals({ worldSchema, handleRenameApplied, handleCreateEntity, handleEditEntity }) {
  const simulationRunId = useIlluminatorConfigStore((s) => s.simulationRunId);
  const eraTemporalInfo = useEraTemporalInfo();
  const renameModal = useIlluminatorModals((s) => s.renameModal);
  const createEntityModal = useIlluminatorModals((s) => s.createEntityModal);
  const editEntityModal = useIlluminatorModals((s) => s.editEntityModal);
  return (
    <>
      {renameModal && (
        <EntityRenameModal
          entityId={renameModal.entityId}
          cultures={worldSchema?.cultures || []}
          simulationRunId={simulationRunId || ""}
          mode={renameModal.mode}
          onApply={handleRenameApplied}
          onClose={() => useIlluminatorModals.getState().closeRename()}
        />
      )}
      {createEntityModal && (
        <CreateEntityModal
          worldSchema={worldSchema}
          eras={eraTemporalInfo}
          onSubmit={handleCreateEntity}
          onClose={() => useIlluminatorModals.getState().closeCreateEntity()}
        />
      )}
      {editEntityModal && (
        <CreateEntityModal
          worldSchema={worldSchema}
          eras={eraTemporalInfo}
          editEntity={editEntityModal}
          onSubmit={handleEditEntity}
          onClose={() => useIlluminatorModals.getState().closeEditEntity()}
        />
      )}
    </>
  );
}


/**
 * Orchestrator component for all Illuminator modal dialogs.
 *
 * Flow objects (revisionFlow, backportFlow, etc.) are passed as grouped props
 * rather than flat-spreading ~100 properties.
 */
export default function IlluminatorModals({
  revisionFlow,
  backportFlow,
  historianFlow,
  dynamicsFlow,
  ...props
}) {
  return (
    <>
      <ImageSettingsSection
        imageGenSettings={props.imageGenSettings}
        updateImageGenSettings={props.updateImageGenSettings}
        styleLibrary={props.styleLibrary}
        worldSchema={props.worldSchema}
        config={props.config}
        updateConfig={props.updateConfig}
      />
      <DynamicsSection dynamicsFlow={dynamicsFlow} />
      <RevisionSection revisionFlow={revisionFlow} />
      <BackportSection backportFlow={backportFlow} revisionFlow={revisionFlow} />
      <HistorianSection historianFlow={historianFlow} revisionFlow={revisionFlow} />
      <EntityModals
        worldSchema={props.worldSchema}
        handleRenameApplied={props.handleRenameApplied}
        handleCreateEntity={props.handleCreateEntity}
        handleEditEntity={props.handleEditEntity}
      />
      <ThinkingViewer />
      <FloatingPills onNavigate={props.setActiveTab} />
    </>
  );
}

ImageSettingsSection.propTypes = {
  imageGenSettings: PropTypes.object,
  updateImageGenSettings: PropTypes.func,
  styleLibrary: PropTypes.object,
  worldSchema: PropTypes.object,
  config: PropTypes.object,
  updateConfig: PropTypes.func,
};

DynamicsSection.propTypes = {
  dynamicsFlow: PropTypes.object.isRequired,
};

RevisionSection.propTypes = {
  revisionFlow: PropTypes.object.isRequired,
};

BackportSection.propTypes = {
  backportFlow: PropTypes.object.isRequired,
  revisionFlow: PropTypes.object.isRequired,
};

HistorianSection.propTypes = {
  historianFlow: PropTypes.object.isRequired,
  revisionFlow: PropTypes.object.isRequired,
};

EntityModals.propTypes = {
  worldSchema: PropTypes.object,
  handleRenameApplied: PropTypes.func,
  handleCreateEntity: PropTypes.func,
  handleEditEntity: PropTypes.func,
};

IlluminatorModals.propTypes = {
  revisionFlow: PropTypes.object,
  backportFlow: PropTypes.object,
  historianFlow: PropTypes.object,
  dynamicsFlow: PropTypes.object,
  imageGenSettings: PropTypes.object,
  updateImageGenSettings: PropTypes.func,
  styleLibrary: PropTypes.object,
  worldSchema: PropTypes.object,
  config: PropTypes.object,
  updateConfig: PropTypes.func,
  handleRenameApplied: PropTypes.func,
  handleCreateEntity: PropTypes.func,
  handleEditEntity: PropTypes.func,
  setActiveTab: PropTypes.func,
};
