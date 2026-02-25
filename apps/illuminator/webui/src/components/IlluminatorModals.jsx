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
import { useToneRankingStore } from "../lib/db/toneRankingStore";
import { useBulkChronicleAnnotationStore } from "../lib/db/bulkChronicleAnnotationStore";
import { useInterleavedAnnotationStore } from "../lib/db/interleavedAnnotationStore";

function ImageSettingsSection({ imageGenSettings, updateImageGenSettings, styleLibrary, worldSchema, config }) {
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

function DynamicsSection({ dynamicsRun, isDynamicsActive, submitDynamicsFeedback, acceptDynamics, cancelDynamicsGeneration }) {
  return (
    <DynamicsGenerationModal
      run={dynamicsRun}
      isActive={isDynamicsActive}
      onSubmitFeedback={submitDynamicsFeedback}
      onAccept={acceptDynamics}
      onCancel={cancelDynamicsGeneration}
    />
  );
}

function RevisionSection({
  revisionFilter, setRevisionFilter, handleStartRevision,
  revisionRun, isRevisionActive, continueToNextBatch, autoContineAllRevision,
  togglePatchDecision, handleAcceptRevision, cancelRevision, getEntityContextsForRevision,
}) {
  return (
    <>
      <RevisionFilterModal
        isOpen={revisionFilter.open}
        totalEligible={revisionFilter.totalEligible}
        usedInChronicles={revisionFilter.usedInChronicles}
        onStart={handleStartRevision}
        onCancel={() => setRevisionFilter((prev) => ({ ...prev, open: false }))}
      />
      <SummaryRevisionModal
        run={revisionRun}
        isActive={isRevisionActive}
        onContinue={continueToNextBatch}
        onAutoContine={autoContineAllRevision}
        onTogglePatch={togglePatchDecision}
        onAccept={handleAcceptRevision}
        onCancel={cancelRevision}
        getEntityContexts={getEntityContextsForRevision}
      />
    </>
  );
}

function BackportSection({
  backportConfig, setBackportConfig, handleBackportConfigStart, handleMarkEntityNotNeeded,
  backportRun, isBackportActive, toggleBackportPatchDecision,
  handleAcceptBackport, cancelBackport, getEntityContextsForRevision, updateBackportAnchorPhrase,
  showBulkBackportModal, bulkBackportProgress,
  handleConfirmBulkBackport, handleCancelBulkBackport, handleCloseBulkBackport,
}) {
  return (
    <>
      <BackportConfigModal
        isOpen={backportConfig !== null}
        chronicleTitle={backportConfig?.chronicleTitle || ""}
        entities={backportConfig?.entities || []}
        perEntityStatus={backportConfig?.perEntityStatus || {}}
        onStart={handleBackportConfigStart}
        onMarkNotNeeded={handleMarkEntityNotNeeded}
        onCancel={() => setBackportConfig(null)}
      />
      {showBulkBackportModal && (
        <BulkBackportModal
          progress={bulkBackportProgress}
          onConfirm={handleConfirmBulkBackport}
          onCancel={handleCancelBulkBackport}
          onClose={handleCloseBulkBackport}
        />
      )}
      <SummaryRevisionModal
        run={backportRun}
        isActive={isBackportActive}
        onTogglePatch={toggleBackportPatchDecision}
        onAccept={handleAcceptBackport}
        onCancel={cancelBackport}
        getEntityContexts={getEntityContextsForRevision}
        onUpdateAnchorPhrase={updateBackportAnchorPhrase}
      />
    </>
  );
}

function HistorianSection({
  historianEditionRun, isHistorianEditionActive, toggleHistorianEditionPatchDecision,
  handleAcceptHistorianEdition, cancelHistorianEdition, getEntityContextsForRevision,
  historianRun, isHistorianActive, toggleHistorianNoteDecision,
  handleEditHistorianNoteText, handleAcceptHistorianNotes, cancelHistorianReview,
  showBulkHistorianModal, bulkHistorianProgress,
  handleConfirmBulkHistorian, handleCancelBulkHistorian, handleCloseBulkHistorian,
  setBulkHistorianTone, editionMaxTokens,
}) {
  return (
    <>
      {showBulkHistorianModal && (
        <BulkHistorianModal
          progress={bulkHistorianProgress}
          onConfirm={handleConfirmBulkHistorian}
          onCancel={handleCancelBulkHistorian}
          onClose={handleCloseBulkHistorian}
          onChangeTone={setBulkHistorianTone}
          editionMaxTokens={editionMaxTokens}
        />
      )}
      <SummaryRevisionModal
        run={historianEditionRun}
        isActive={isHistorianEditionActive}
        onTogglePatch={toggleHistorianEditionPatchDecision}
        onAccept={handleAcceptHistorianEdition}
        onCancel={cancelHistorianEdition}
        getEntityContexts={getEntityContextsForRevision}
        descriptionBaseline={historianEditionRun?.worldDynamicsContext}
      />
      <HistorianReviewModal
        run={historianRun}
        isActive={isHistorianActive}
        onToggleNote={toggleHistorianNoteDecision}
        onEditNoteText={handleEditHistorianNoteText}
        onAccept={handleAcceptHistorianNotes}
        onCancel={cancelHistorianReview}
      />
    </>
  );
}

function EntityModals({
  worldSchema, simulationRunId, handleRenameApplied,
  eraTemporalInfo, handleCreateEntity, handleEditEntity,
}) {
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
 * Each sub-component destructures only the props it needs from
 * the shared props bag, so we spread the full bag to each.
 */
export default function IlluminatorModals(props) {
  return (
    <>
      <ImageSettingsSection {...props} />
      <DynamicsSection {...props} />
      <RevisionSection {...props} />
      <BackportSection {...props} />
      <HistorianSection {...props} />
      <EntityModals {...props} />
      <ToneAndAnnotationModals />
      <ThinkingViewer />
      <FloatingPills onNavigate={props.setActiveTab} />
    </>
  );
}
