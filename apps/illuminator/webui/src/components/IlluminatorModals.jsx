import PropTypes from "prop-types";
import ImageSettingsDrawer from "./ImageSettingsDrawer";
import DynamicsGenerationModal from "./DynamicsGenerationModal";
import RevisionFilterModal from "./RevisionFilterModal";
import SummaryRevisionModal from "./SummaryRevisionModal";
import BackportConfigModal from "./BackportConfigModal";
import BulkBackportModal from "./BulkBackportModal";
import BulkHistorianModal from "./BulkHistorianModal";
import HistorianReviewModal from "./HistorianReviewModal";
import EntityRenameModal from "./EntityRenameModal";
import CreateEntityModal from "./CreateEntityModal";
import BulkToneRankingModal from "./BulkToneRankingModal";
import ToneAssignmentPreviewModal from "./ToneAssignmentPreviewModal";
import BulkChronicleAnnotationModal from "./BulkChronicleAnnotationModal";
import InterleavedAnnotationModal from "./InterleavedAnnotationModal";
import { ThinkingViewer } from "./ThinkingViewer";
import { FloatingPills } from "./FloatingPills";
import { useIlluminatorModals } from "../lib/db/modalStore";
import { useIlluminatorConfigStore } from "../lib/db/illuminatorConfigStore";
import { useEraTemporalInfo } from "../lib/db/indexSelectors";
import { useToneRankingStore } from "../lib/db/toneRankingStore";
import { useBulkChronicleAnnotationStore } from "../lib/db/bulkChronicleAnnotationStore";
import { useInterleavedAnnotationStore } from "../lib/db/interleavedAnnotationStore";
import React from "react";

function ImageSettingsSection({
  imageGenSettings,
  updateImageGenSettings,
  styleLibrary,
  worldSchema,
  config,
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
      {backportFlow.showBulkBackportModal && (
        <BulkBackportModal
          progress={backportFlow.bulkBackportProgress}
          onConfirm={backportFlow.handleConfirmBulkBackport}
          onCancel={backportFlow.handleCancelBulkBackport}
          onClose={backportFlow.handleCloseBulkBackport}
        />
      )}
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
      {historianFlow.showBulkHistorianModal && (
        <BulkHistorianModal
          progress={historianFlow.bulkHistorianProgress}
          onConfirm={historianFlow.handleConfirmBulkHistorian}
          onCancel={historianFlow.handleCancelBulkHistorian}
          onClose={historianFlow.handleCloseBulkHistorian}
          onChangeTone={historianFlow.setBulkHistorianTone}
          editionMaxTokens={historianFlow.editionMaxTokens}
        />
      )}
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

function ToneAndAnnotationModals() {
  const toneRankingProgress = useToneRankingStore((s) => s.progress);
  const confirmToneRanking = useToneRankingStore((s) => s.confirmToneRanking);
  const cancelToneRanking = useToneRankingStore((s) => s.cancelToneRanking);
  const closeToneRanking = useToneRankingStore((s) => s.closeToneRanking);
  const toneAssignmentPreview = useToneRankingStore((s) => s.assignmentPreview);
  const applyToneAssignment = useToneRankingStore((s) => s.applyAssignment);
  const closeToneAssignment = useToneRankingStore((s) => s.closeAssignment);
  const bulkAnnotationProgress = useBulkChronicleAnnotationStore((s) => s.progress);
  const confirmBulkAnnotation = useBulkChronicleAnnotationStore((s) => s.confirmAnnotation);
  const cancelBulkAnnotation = useBulkChronicleAnnotationStore((s) => s.cancelAnnotation);
  const closeBulkAnnotation = useBulkChronicleAnnotationStore((s) => s.closeAnnotation);
  const interleavedProgress = useInterleavedAnnotationStore((s) => s.progress);
  const confirmInterleaved = useInterleavedAnnotationStore((s) => s.confirmInterleaved);
  const cancelInterleaved = useInterleavedAnnotationStore((s) => s.cancelInterleaved);
  const closeInterleaved = useInterleavedAnnotationStore((s) => s.closeInterleaved);
  return (
    <>
      <BulkToneRankingModal
        progress={toneRankingProgress}
        onConfirm={confirmToneRanking}
        onCancel={cancelToneRanking}
        onClose={closeToneRanking}
      />
      <ToneAssignmentPreviewModal
        preview={toneAssignmentPreview}
        onApply={applyToneAssignment}
        onClose={closeToneAssignment}
      />
      <BulkChronicleAnnotationModal
        progress={bulkAnnotationProgress}
        onConfirm={confirmBulkAnnotation}
        onCancel={cancelBulkAnnotation}
        onClose={closeBulkAnnotation}
      />
      <InterleavedAnnotationModal
        progress={interleavedProgress}
        onConfirm={confirmInterleaved}
        onCancel={cancelInterleaved}
        onClose={closeInterleaved}
      />
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
      <ToneAndAnnotationModals />
      <ThinkingViewer />
      <FloatingPills onNavigate={props.setActiveTab} />
    </>
  );
}
