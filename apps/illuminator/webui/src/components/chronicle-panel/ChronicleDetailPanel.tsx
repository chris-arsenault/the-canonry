/**
 * ChronicleDetailPanel - Right-side detail view showing selected chronicle
 * or era narrative content.
 *
 * Renders pipeline-stage-specific UIs (failed, progress, review) and
 * delegates to ChronicleReviewPanel for assembly_ready/complete states.
 */

import React from "react";
import ChronicleReviewPanel from "../ChronicleReviewPanel";
import EraNarrativeViewer from "../EraNarrativeViewer";
import type {
  SelectedChronicleItem,
  RefinementState,
  StyleSelection,
  StyleLibrary,
  ImageGenSettings,
  WorldData,
  WorldContext,
  CultureIdentities,
  EntityNavItem,
  WizardEra,
  WizardEvent,
} from "./chroniclePanelTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChronicleDetailPanelProps {
  // Era narrative mode
  isEraNarrativeSelected: boolean;
  selectedEraNarrativeId: string | null;
  eraNarrativeViewerProps: EraNarrativeViewerProps | null;
  // Chronicle mode
  selectedItem: SelectedChronicleItem | undefined;
  // Progress/failed state handlers
  onRegenerate: () => void;
  onCancel: (chronicleId: string) => void;
  // Review panel props (only used when status is assembly_ready or complete)
  reviewPanelProps: ReviewPanelProps | null;
}

interface EraNarrativeViewerProps {
  narrativeId: string;
  onEnqueue: (items: Array<Record<string, unknown>>) => void;
  styleLibrary: StyleLibrary | null;
  styleSelection: StyleSelection;
  imageSize: string;
  imageQuality: string;
  imageModel: string;
  imageGenSettings: ImageGenSettings;
  onOpenImageSettings: () => void;
  cultures: WorldData["schema"];
  cultureIdentities: CultureIdentities;
  worldContext: WorldContext;
}

export interface ReviewPanelProps {
  item: SelectedChronicleItem;
  onAddImages: () => void;
  onAccept: () => void;
  onRegenerate: () => void;
  onGenerateSummary: () => void;
  onGenerateTitle: () => void;
  onAcceptPendingTitle: (title: string) => void;
  onRejectPendingTitle: () => void;
  onGenerateImageRefs: () => void;
  onGenerateCoverImageScene: () => void;
  onGenerateCoverImage: () => void;
  styleSelection: StyleSelection;
  imageSize: string;
  imageQuality: string;
  imageModel: string;
  imageGenSettings: ImageGenSettings;
  onOpenImageSettings: () => void;
  onRegenerateWithSampling: () => void;
  onRegenerateFull: () => void;
  onRegenerateCreative: (() => void) | undefined;
  onCompareVersions: () => void;
  onCombineVersions: () => void;
  onCopyEdit: () => void;
  onTemporalCheck: () => void;
  onQuickCheck: () => void;
  onGenerateChronicleImage: (ref: Record<string, unknown>, prompt: string, styleInfo: Record<string, unknown>) => void;
  onResetChronicleImage: (ref: Record<string, unknown>) => void;
  onRegenerateDescription: (ref: Record<string, unknown>) => void;
  onUpdateChronicleAnchorText: (ref: Record<string, unknown>, anchorText: string) => void;
  onUpdateChronicleImageSize: (ref: Record<string, unknown>, size: string) => void;
  onUpdateChronicleImageJustification: (ref: Record<string, unknown>, justification: string) => void;
  onApplyImageRefSelections: (selections: Record<string, unknown>, newTargetVersionId: string) => void;
  onSelectExistingImage: (ref: Record<string, unknown>, imageId: string) => void;
  onSelectExistingCoverImage: (imageId: string) => void;
  onUpdateChronicleTemporalContext: (focalEraId: string) => void;
  onUpdateChronicleActiveVersion: (versionId: string) => void;
  onDeleteVersion: (versionId: string) => void;
  onUpdateCombineInstructions: (instructions: string) => void;
  onUnpublish: () => void;
  onExport: () => void;
  onBackportLore: (() => void) | undefined;
  onHistorianReview: ((tone: string) => void) | undefined;
  onSetAssignedTone: (tone: string) => void;
  onDetectTone: (() => void) | undefined;
  isHistorianActive: boolean;
  onUpdateHistorianNote: (noteId: string) => void;
  onGeneratePrep: (() => void) | undefined;
  isGenerating: boolean;
  refinements: RefinementState | null;
  simulationRunId: string;
  worldSchema: { entityKinds: Array<Record<string, unknown>>; cultures: Array<Record<string, unknown>> };
  entities: EntityNavItem[];
  styleLibrary: StyleLibrary | null;
  cultures: WorldData["schema"];
  entityGuidance: Record<string, Record<string, unknown>>;
  cultureIdentities: CultureIdentities;
  worldContext: WorldContext;
  eras: WizardEra[];
  events: WizardEvent[];
  onNavigateToTab: (tab: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChronicleDetailPanel({
  isEraNarrativeSelected,
  selectedEraNarrativeId,
  eraNarrativeViewerProps,
  selectedItem,
  onRegenerate,
  onCancel,
  reviewPanelProps,
}: ChronicleDetailPanelProps) {
  return (
    <div className="chron-detail">
      {/* Era narrative viewer */}
      {isEraNarrativeSelected && selectedEraNarrativeId && eraNarrativeViewerProps && (
        <EraNarrativeViewer {...eraNarrativeViewerProps} />
      )}

      {/* Empty state */}
      {!(isEraNarrativeSelected && selectedEraNarrativeId) && !selectedItem && (
        <div className="chron-detail-empty">Select an item to begin generation</div>
      )}

      {/* Chronicle detail */}
      {!(isEraNarrativeSelected && selectedEraNarrativeId) && selectedItem && (
        <>
          {/* Not started = generation failed before producing content */}
          {selectedItem.status === "not_started" && (
            <FailedState
              reason={selectedItem.failureReason || "Chronicle generation failed before producing content."}
              onRegenerate={onRegenerate}
              buttonLabel="Delete &amp; Restart"
            />
          )}

          {/* In-progress states */}
          {(selectedItem.status === "validating" ||
            selectedItem.status === "editing" ||
            selectedItem.status === "generating") && (
            <ProgressState
              status={selectedItem.status}
              onCancel={() => onCancel(selectedItem.chronicleId)}
            />
          )}

          {/* Failed state */}
          {selectedItem.status === "failed" && (
            <FailedState
              reason={selectedItem.failureReason || "Chronicle generation failed. Please regenerate to try again."}
              onRegenerate={onRegenerate}
              buttonLabel="Regenerate"
            />
          )}

          {/* Review states */}
          {(selectedItem.status === "assembly_ready" || selectedItem.status === "complete") &&
            reviewPanelProps && <ChronicleReviewPanel {...reviewPanelProps} />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FailedStateProps {
  reason: string;
  onRegenerate: () => void;
  buttonLabel: string;
}

function FailedState({ reason, onRegenerate, buttonLabel }: FailedStateProps) {
  return (
    <div className="chron-detail-aborted">
      <h3 className="chron-detail-aborted-title">Generation Failed</h3>
      <p className="chron-detail-aborted-msg">{reason}</p>
      <button
        onClick={onRegenerate}
        className="illuminator-button illuminator-button-primary chron-detail-aborted-btn"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

interface ProgressStateProps {
  status: string;
  onCancel: () => void;
}

function ProgressState({ status, onCancel }: ProgressStateProps) {
  const titles: Record<string, string> = {
    validating: "Validating Cohesion...",
    editing: "Applying Suggestions...",
    generating: "Generating Chronicle...",
  };

  return (
    <div className="chron-detail-progress">
      <div className="chron-detail-spinner" />
      <h3 className="chron-detail-progress-title">{titles[status] || "Processing..."}</h3>
      <div className="chron-detail-progress-hint">
        <p>Generation in progress. This typically takes 30-60 seconds.</p>
      </div>
      <button onClick={onCancel} className="illuminator-button chron-detail-cancel-btn">
        Cancel
      </button>
    </div>
  );
}

export default ChronicleDetailPanel;
