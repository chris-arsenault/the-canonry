/**
 * ChronicleReviewPanel - Shared review/refinement UI for chronicles
 *
 * assembly_ready and complete statuses delegate to ChronicleWorkspace (tabbed UI).
 * validation_ready keeps its own inline layout since it's a different workflow.
 *
 * PROP CHAIN: ChroniclePanel -> ChronicleReviewPanel (this file) -> ChronicleWorkspace
 * This file is the middle layer -- it must destructure AND forward every prop that
 * ChronicleWorkspace needs. When adding props, update all three files.
 */

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { diffWords } from "diff";
import type { Change } from "diff";
import { useExpandBoolean } from "@the-canonry/shared-components";
import CohesionReportViewer from "./CohesionReportViewer";
import ImageModal from "./ImageModal";
import ChronicleWorkspace from "./chronicle-workspace/ChronicleWorkspace";
import ChronicleVersionSelector from "./chronicle-workspace/ChronicleVersionSelector";
import type { ChronicleRecord, ChronicleRoleAssignment } from "../lib/chronicleTypes";
import type {
  StyleSelection,
  RefinementState,
  WorldContext,
  CultureIdentities,
  EntityNavItem,
} from "./chronicle-panel/chroniclePanelTypes";
import type { StyleLibrary } from "@canonry/world-schema";
import type { ImageGenSettings } from "../hooks/useImageGenSettings";
import "./ChronicleReviewPanel.css";

// ============================================================================
// Types
// ============================================================================

/** Minimal version info derived from generation history */
interface VersionEntry {
  id: string;
  content: string;
  wordCount: number;
  shortLabel: string;
  label: string;
}

interface PerspectiveSynthesisViewerProps {
  synthesis: ChronicleRecord["perspectiveSynthesis"];
}

interface AssembledContentViewerProps {
  content: string;
  wordCount: number;
  onCopy: () => void;
  compareContent?: string;
  compareLabel?: string;
}

interface WorkspaceRouteProps {
  item: ChronicleRecord;
  onAccept: () => void;
  onRegenerate: () => void;
  onRegenerateWithSampling: () => void;
  onRegenerateFull: () => void;
  onRegenerateCreative: () => void;
  onCompareVersions: () => void;
  onCombineVersions: () => void;
  onCopyEdit: () => void;
  onTemporalCheck: () => void;
  onQuickCheck: () => void;
  onValidate: () => void;
  onGenerateSummary: () => void;
  onGenerateTitle: () => void;
  onAcceptPendingTitle: () => void;
  onRejectPendingTitle: () => void;
  onGenerateImageRefs: () => void;
  onGenerateChronicleImage: (refId: string) => void;
  onResetChronicleImage: (refId: string) => void;
  onRegenerateDescription: () => void;
  onUpdateChronicleAnchorText: (refId: string, text: string) => void;
  onUpdateChronicleTemporalContext: (context: Record<string, unknown>) => void;
  onUpdateChronicleActiveVersion: (versionId: string) => void;
  onDeleteVersion: (versionId: string) => void;
  onUpdateCombineInstructions: (instructions: string) => void;
  onUnpublish: () => void;
  onGenerateCoverImageScene: () => void;
  onGenerateCoverImage: () => void;
  styleSelection: StyleSelection;
  imageSize: string;
  imageQuality: string;
  imageModel: string;
  imageGenSettings: ImageGenSettings;
  onOpenImageSettings: () => void;
  onUpdateChronicleImageSize: (refId: string, size: string) => void;
  onUpdateChronicleImageJustification: (refId: string, justification: string) => void;
  onApplyImageRefSelections: (selections: unknown[]) => void;
  onSelectExistingImage: (refId: string) => void;
  onSelectExistingCoverImage: () => void;
  onExport: () => void;
  onBackportLore: () => void;
  onHistorianReview: (tone: string) => void;
  onSetAssignedTone: (tone: string) => void;
  onDetectTone: () => void;
  isHistorianActive: boolean;
  onUpdateHistorianNote: (
    targetType: string,
    chronicleId: string,
    noteId: string,
    updates: Record<string, unknown>,
  ) => void;
  onGeneratePrep: () => void;
  isGenerating: boolean;
  refinements: RefinementState;
  simulationRunId: string;
  worldSchema: Record<string, unknown>;
  entities: EntityNavItem[];
  styleLibrary: StyleLibrary | null;
  cultures: Array<{ id: string; name: string }>;
  cultureIdentities: CultureIdentities;
  worldContext: WorldContext;
  eras: Array<{ id: string; name: string }>;
  events: Array<Record<string, unknown>>;
  onNavigateToTab: (tab: string) => void;
}

interface ValidationReadyViewProps {
  item: ChronicleRecord;
  onExport?: () => void;
  onAccept: () => void;
  onRegenerate: () => void;
  onCorrectSuggestions: () => void;
  onGenerateSummary: () => void;
  onGenerateImageRefs: () => void;
  onRevalidate: () => void;
  onGenerateChronicleImage: (refId: string) => void;
  onResetChronicleImage: (refId: string) => void;
  onUpdateChronicleAnchorText: (refId: string, text: string) => void;
  onUpdateChronicleImageSize: (refId: string, size: string) => void;
  onUpdateChronicleImageJustification: (refId: string, justification: string) => void;
  onUpdateChronicleActiveVersion: (versionId: string) => void;
  onDeleteVersion?: (versionId: string) => void;
  isGenerating: boolean;
  refinements: RefinementState;
  entities: EntityNavItem[];
  styleLibrary: StyleLibrary | null;
  cultures: Array<{ id: string; name: string }>;
  cultureIdentities: CultureIdentities;
  worldContext: WorldContext;
}

type ChronicleReviewPanelProps = WorkspaceRouteProps & {
  onCorrectSuggestions: () => void;
  onRevalidate: () => void;
};

// ============================================================================
// PerspectiveSynthesisViewer (kept for validation_ready)
// ============================================================================

function PerspectiveSynthesisViewer({ synthesis }: PerspectiveSynthesisViewerProps) {
  const { expanded, headerProps } = useExpandBoolean();
  const [activeTab, setActiveTab] = useState<"output" | "input">("output");

  const handleOutputTab = useCallback(() => setActiveTab("output"), []);
  const handleInputTab = useCallback(() => setActiveTab("input"), []);

  if (!synthesis) return null;

  const formatCost = (cost: number) => `$${cost.toFixed(4)}`;
  const formatTimestamp = (ts: number) => new Date(ts).toLocaleString();

  const hasInputData =
    synthesis.coreTone ||
    synthesis.inputFacts ||
    synthesis.inputCulturalIdentities ||
    synthesis.constellation;

  return (
    <div className="ilu-container crp-synth">
      <div
        className={`ilu-container-header crp-synth-header ${expanded ? "crp-synth-header-expanded" : ""}`}
        {...headerProps}
      >
        <span className="crp-synth-toggle">{expanded ? "\u25BC" : "\u25B6"}</span>
        <span className="crp-synth-title">Perspective Synthesis</span>
        <span className="crp-synth-meta">
          {synthesis.facets?.length ?? 0} facets &bull; {synthesis.entityDirectives?.length ?? 0}{" "}
          directives &bull; {synthesis.suggestedMotifs?.length ?? 0} motifs &bull;{" "}
          {formatCost(synthesis.actualCost)}
        </span>
      </div>

      {expanded && (
        <div className="crp-synth-body">
          {hasInputData && (
            <div className="crp-synth-tabs">
              <button
                onClick={handleOutputTab}
                className={`crp-synth-tab ${activeTab === "output" ? "crp-synth-tab-active" : "crp-synth-tab-inactive"}`}
              >
                LLM Output
              </button>
              <button
                onClick={handleInputTab}
                className={`crp-synth-tab ${activeTab === "input" ? "crp-synth-tab-active" : "crp-synth-tab-inactive"}`}
              >
                LLM Input
              </button>
            </div>
          )}
          {activeTab === "output" && (
            <>
              {synthesis.constellationSummary && (
                <div className="crp-synth-subsection">
                  <div className="crp-synth-subsection-label">CONSTELLATION SUMMARY</div>
                  <div className="crp-synth-subsection-text">{synthesis.constellationSummary}</div>
                </div>
              )}
              {synthesis.brief && (
                <div className="crp-synth-subsection">
                  <div className="crp-synth-subsection-label">PERSPECTIVE BRIEF</div>
                  <div className="crp-synth-block">{synthesis.brief}</div>
                </div>
              )}
            </>
          )}
          {activeTab === "input" && synthesis.coreTone && (
            <div className="crp-synth-subsection">
              <div className="crp-synth-subsection-label">CORE TONE</div>
              <div className="crp-synth-block">{synthesis.coreTone}</div>
            </div>
          )}
          <div className="crp-synth-footer">
            <span>Model: {synthesis.model}</span>
            <span>
              Tokens: {synthesis.inputTokens} in / {synthesis.outputTokens} out
            </span>
            <span>Generated: {formatTimestamp(synthesis.generatedAt)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AssembledContentViewer (kept for validation_ready)
// ============================================================================

function AssembledContentViewer({
  content,
  wordCount,
  onCopy,
  compareContent,
  compareLabel,
}: AssembledContentViewerProps) {
  const diffParts = useMemo<Change[] | null>(() => {
    if (!compareContent) return null;
    return diffWords(compareContent, content);
  }, [content, compareContent]);

  return (
    <div className="ilu-container crp-acv">
      <div className="ilu-container-header crp-acv-header">
        <span className="crp-acv-word-count">
          {wordCount.toLocaleString()} words
          {diffParts && (
            <span className="crp-acv-diff-label">
              &mdash; diff vs {compareLabel}
              <span className="crp-acv-diff-added">
                +
                {diffParts
                  .filter((p) => p.added)
                  .reduce((n, p) => n + p.value.split(/\s+/).filter(Boolean).length, 0)}
              </span>
              <span className="crp-acv-diff-removed">
                -
                {diffParts
                  .filter((p) => p.removed)
                  .reduce((n, p) => n + p.value.split(/\s+/).filter(Boolean).length, 0)}
              </span>
            </span>
          )}
        </span>
        <button onClick={onCopy} className="crp-acv-copy-btn">
          Copy
        </button>
      </div>
      <div className="crp-acv-content">
        {diffParts
          ? diffParts.map((part, i) => {
              if (part.added)
                return (
                  <span key={i} className="crp-acv-diff-part-added">
                    {part.value}
                  </span>
                );
              if (part.removed)
                return (
                  <span key={i} className="crp-acv-diff-part-removed">
                    {part.value}
                  </span>
                );
              return <span key={i}>{part.value}</span>;
            })
          : content}
      </div>
    </div>
  );
}

// ============================================================================
// useVersionManagement — version selection + comparison state for
// ValidationReadyView, extracted to tame line count and complexity.
// ============================================================================

function useVersionManagement(
  item: ChronicleRecord,
  onDeleteVersion?: (versionId: string) => void,
) {
  const versions = useMemo<VersionEntry[]>(() => {
    const sorted = [...(item.generationHistory ?? [])].sort(
      (a, b) => a.generatedAt - b.generatedAt,
    );
    const seen = new Set<string>();
    const unique: typeof sorted = [];
    for (const version of sorted) {
      if (seen.has(version.versionId)) continue;
      seen.add(version.versionId);
      unique.push(version);
    }
    return unique.map((version, index) => {
      const samplingLabel = version.sampling ?? "unspecified";
      return {
        id: version.versionId,
        content: version.content,
        wordCount: version.wordCount,
        shortLabel: `V${index + 1}`,
        label: `Version ${index + 1} \u2022 ${new Date(version.generatedAt).toLocaleString()} \u2022 sampling ${samplingLabel}`,
      };
    });
  }, [item.generationHistory]);

  const activeVersionId = item.activeVersionId ?? versions[versions.length - 1]?.id;

  const [selectedVersionId, setSelectedVersionId] = useState(activeVersionId);
  const [compareToVersionId, setCompareToVersionId] = useState("");

  // Reset selections when chronicle or active version changes
  const activeKey = `${activeVersionId}|${item.chronicleId}`;
  useEffect(() => {
    setSelectedVersionId(activeVersionId);
    setCompareToVersionId("");
  }, [activeKey, activeVersionId]);

  // Keep selected/compare versions valid when version list changes
  const versionIds = useMemo(() => versions.map((v) => v.id), [versions]);
  useEffect(() => {
    if (versions.length === 0) return;

    const hasSelected = versions.some((v) => v.id === selectedVersionId);
    let nextSelected = selectedVersionId;
    if (!hasSelected) {
      const hasActive = versions.some((v) => v.id === activeVersionId);
      nextSelected = hasActive ? activeVersionId : versions[versions.length - 1].id;
      setSelectedVersionId(nextSelected);
    }

    if (compareToVersionId) {
      const hasCompare = versions.some((v) => v.id === compareToVersionId);
      if (!hasCompare || compareToVersionId === nextSelected) {
        setCompareToVersionId("");
      }
    }
  }, [versionIds, versions, selectedVersionId, activeVersionId, compareToVersionId]);

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) ?? versions[versions.length - 1],
    [versions, selectedVersionId],
  );
  const compareToVersion = useMemo(
    () => (compareToVersionId ? versions.find((v) => v.id === compareToVersionId) : null),
    [versions, compareToVersionId],
  );

  const handleDeleteVersion = useCallback(
    (versionId: string) => {
      if (!versionId || versions.length === 0) return;

      const index = versions.findIndex((v) => v.id === versionId);
      let nextSelected = selectedVersionId;
      if (index !== -1) {
        nextSelected = versions[index + 1]?.id ?? versions[index - 1]?.id ?? selectedVersionId;
      }
      if (nextSelected === versionId) {
        const hasActive = versions.some((v) => v.id === activeVersionId);
        nextSelected = hasActive ? activeVersionId : versions[versions.length - 1].id;
      }

      if (nextSelected && nextSelected !== selectedVersionId) {
        setSelectedVersionId(nextSelected);
      }
      if (compareToVersionId === versionId || compareToVersionId === nextSelected) {
        setCompareToVersionId("");
      }

      onDeleteVersion?.(versionId);
    },
    [versions, selectedVersionId, activeVersionId, compareToVersionId, onDeleteVersion],
  );

  const versionContentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of versions) map.set(v.id, v.content);
    return map;
  }, [versions]);

  const versionLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of versions) map.set(v.id, v.shortLabel);
    return map;
  }, [versions]);

  return {
    versions,
    activeVersionId,
    selectedVersionId,
    compareToVersionId,
    selectedVersion,
    compareToVersion,
    versionContentMap,
    versionLabelMap,
    setSelectedVersionId,
    setCompareToVersionId,
    handleDeleteVersion,
  };
}

// ============================================================================
// PreviewSection — version selector + diff viewer for ValidationReadyView
// ============================================================================

interface PreviewSectionProps {
  item: ChronicleRecord;
  versions: VersionEntry[];
  selectedVersionId: string;
  activeVersionId: string;
  compareToVersionId: string;
  selectedVersion: VersionEntry | undefined;
  compareToVersion: VersionEntry | null | undefined;
  isGenerating: boolean;
  onSelectVersion: (id: string) => void;
  onSelectCompareVersion: (id: string) => void;
  onSetActiveVersion: (versionId: string) => void;
  onDeleteVersion: (versionId: string) => void;
}

function PreviewSection({
  item,
  versions,
  selectedVersionId,
  activeVersionId,
  compareToVersionId,
  selectedVersion,
  compareToVersion,
  isGenerating,
  onSelectVersion,
  onSelectCompareVersion,
  onSetActiveVersion,
  onDeleteVersion,
}: PreviewSectionProps) {
  const wordCountFn = useCallback(
    (text: string) => text?.split(/\s+/).filter(Boolean).length ?? 0,
    [],
  );

  const copyToClipboard = useCallback(
    (text: string) => navigator.clipboard.writeText(text),
    [],
  );

  const handleSelectVersion = useCallback(
    (id: string) => {
      onSelectVersion(id);
      if (id === compareToVersionId) onSelectCompareVersion("");
    },
    [onSelectVersion, compareToVersionId, onSelectCompareVersion],
  );

  const handleCopy = useCallback(() => {
    copyToClipboard(selectedVersion?.content ?? item.assembledContent ?? "");
  }, [copyToClipboard, selectedVersion, item.assembledContent]);

  if (!item.assembledContent) return null;

  return (
    <div className="crp-preview-area">
      <div className="crp-preview-header">
        <h3 className="crp-preview-title">Preview</h3>
        <ChronicleVersionSelector
          versions={versions}
          selectedVersionId={selectedVersionId}
          activeVersionId={activeVersionId}
          compareToVersionId={compareToVersionId}
          onSelectVersion={handleSelectVersion}
          onSelectCompareVersion={onSelectCompareVersion}
          onSetActiveVersion={onSetActiveVersion}
          onDeleteVersion={onDeleteVersion}
          disabled={isGenerating}
        />
      </div>
      <AssembledContentViewer
        content={selectedVersion?.content ?? item.assembledContent}
        wordCount={selectedVersion?.wordCount ?? wordCountFn(item.assembledContent)}
        onCopy={handleCopy}
        compareContent={compareToVersion?.content}
        compareLabel={compareToVersion?.shortLabel}
      />
    </div>
  );
}

// ============================================================================
// ValidationReadyView (self-contained)
// ============================================================================

function ValidationReadyView({
  item,
  onExport,
  onAccept,
  onRegenerate,
  onCorrectSuggestions,
  onGenerateSummary,
  onGenerateImageRefs,
  onRevalidate,
  onGenerateChronicleImage,
  onResetChronicleImage,
  onUpdateChronicleAnchorText,
  onUpdateChronicleImageSize,
  onUpdateChronicleImageJustification,
  onUpdateChronicleActiveVersion,
  onDeleteVersion,
  isGenerating,
  refinements,
  entities,
  styleLibrary,
  cultures,
  cultureIdentities,
  worldContext,
}: ValidationReadyViewProps) {
  const entityMap = useMemo(() => {
    if (!entities) return new Map<string, EntityNavItem>();
    return new Map(entities.map((e) => [e.id, e]));
  }, [entities]);

  const [imageModal, setImageModal] = useState({ open: false, imageId: "", title: "" });
  const handleCloseImageModal = useCallback(
    () => setImageModal({ open: false, imageId: "", title: "" }),
    [],
  );

  const vm = useVersionManagement(item, onDeleteVersion);

  const getVersionLabel = useCallback(
    (versionId: string) => vm.versionLabelMap.get(versionId) ?? "Unknown",
    [vm.versionLabelMap],
  );

  const formatTargetIndicator = useCallback(
    (targetVersionId: string | undefined) => {
      if (!targetVersionId) return null;
      if (targetVersionId === vm.activeVersionId) return null;
      return `Targets ${getVersionLabel(targetVersionId)} \u2022 Active ${getVersionLabel(vm.activeVersionId)}`;
    },
    [vm.activeVersionId, getVersionLabel],
  );

  const summaryIndicator = formatTargetIndicator(item.summaryTargetVersionId);
  const imageRefsIndicator = formatTargetIndicator(item.imageRefsTargetVersionId);
  const imageRefsTargetContent =
    vm.versionContentMap.get(item.imageRefsTargetVersionId ?? vm.activeVersionId) ??
    item.assembledContent;

  const seedData = useMemo(
    () => ({
      narrativeStyleId: item.narrativeStyleId ?? "",
      narrativeStyleName:
        item.narrativeStyle?.name ??
        styleLibrary?.narrativeStyles?.find(
          (s: { id: string; name: string }) => s.id === item.narrativeStyleId,
        )?.name,
      entrypointId: item.entrypointId,
      entrypointName: item.entrypointId
        ? entities?.find((e) => e.id === item.entrypointId)?.name
        : undefined,
      roleAssignments: (item.roleAssignments ?? []) as ChronicleRoleAssignment[],
      selectedEventIds: item.selectedEventIds ?? [],
      selectedRelationshipIds: item.selectedRelationshipIds ?? [],
    }),
    [item, entities, styleLibrary],
  );

  return (
    <div>
      <div className="crp-export-row">
        {onExport && (
          <button
            onClick={onExport}
            className="crp-export-btn"
            title="Export chronicle with full generation context as JSON"
          >
            Export
          </button>
        )}
      </div>
      {item.perspectiveSynthesis && (
        <PerspectiveSynthesisViewer synthesis={item.perspectiveSynthesis} />
      )}
      {item.cohesionReport && (
        <CohesionReportViewer
          report={item.cohesionReport}
          seedData={seedData}
          onAccept={onAccept}
          onRegenerate={onRegenerate}
          onCorrectSuggestions={onCorrectSuggestions}
          onGenerateSummary={onGenerateSummary}
          onGenerateImageRefs={onGenerateImageRefs}
          onRevalidate={onRevalidate}
          refinements={refinements}
          isValidationStale={Boolean(item.validationStale)}
          editVersion={item.editVersion}
          isGenerating={isGenerating}
          imageRefs={item.imageRefs}
          entityMap={entityMap}
          onGenerateChronicleImage={onGenerateChronicleImage}
          onResetChronicleImage={onResetChronicleImage}
          onUpdateChronicleAnchorText={onUpdateChronicleAnchorText}
          onUpdateChronicleImageSize={onUpdateChronicleImageSize}
          onUpdateChronicleImageJustification={onUpdateChronicleImageJustification}
          chronicleText={imageRefsTargetContent}
          summaryIndicator={summaryIndicator}
          imageRefsIndicator={imageRefsIndicator}
          styleLibrary={styleLibrary}
          cultures={cultures}
          cultureIdentities={cultureIdentities}
          worldContext={worldContext}
          chronicleTitle={item.title ?? item.narrativeStyleId}
        />
      )}
      <PreviewSection
        item={item}
        versions={vm.versions}
        selectedVersionId={vm.selectedVersionId}
        activeVersionId={vm.activeVersionId}
        compareToVersionId={vm.compareToVersionId}
        selectedVersion={vm.selectedVersion}
        compareToVersion={vm.compareToVersion}
        isGenerating={isGenerating}
        onSelectVersion={vm.setSelectedVersionId}
        onSelectCompareVersion={vm.setCompareToVersionId}
        onSetActiveVersion={onUpdateChronicleActiveVersion}
        onDeleteVersion={vm.handleDeleteVersion}
      />
      <ImageModal
        isOpen={imageModal.open}
        imageId={imageModal.imageId}
        title={imageModal.title}
        onClose={handleCloseImageModal}
      />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ChronicleReviewPanel({
  item,

  // Actions
  onValidate,
  onAccept,
  onRegenerate,
  onRegenerateWithSampling,
  onRegenerateFull,
  onRegenerateCreative,
  onCompareVersions,
  onCombineVersions,
  onCopyEdit,
  onTemporalCheck,
  onQuickCheck,
  onCorrectSuggestions,
  onGenerateSummary,
  onGenerateTitle,
  onAcceptPendingTitle,
  onRejectPendingTitle,
  onGenerateImageRefs,
  onRevalidate,
  onGenerateChronicleImage,
  onResetChronicleImage,
  onRegenerateDescription,
  onUpdateChronicleAnchorText,
  onUpdateChronicleTemporalContext,
  onUpdateChronicleActiveVersion,
  onDeleteVersion,
  onUpdateCombineInstructions,
  onUnpublish,

  // Cover image
  onGenerateCoverImageScene,
  onGenerateCoverImage,
  styleSelection,
  imageSize,
  imageQuality,
  imageModel,
  imageGenSettings,
  onOpenImageSettings,

  // Image layout edits
  onUpdateChronicleImageSize,
  onUpdateChronicleImageJustification,

  // Image ref selections (version migration)
  onApplyImageRefSelections,

  // Select existing image for a ref
  onSelectExistingImage,

  // Select existing image for cover
  onSelectExistingCoverImage,

  // Export
  onExport,

  // Lore backport
  onBackportLore,

  // Historian review
  onHistorianReview,
  onSetAssignedTone,
  onDetectTone,
  isHistorianActive,
  onUpdateHistorianNote,
  onGeneratePrep,

  // State
  isGenerating,
  refinements,

  // Data for refinements
  simulationRunId,
  worldSchema,
  entities,
  styleLibrary,
  cultures,
  cultureIdentities,
  worldContext,
  eras,
  events,
  onNavigateToTab,
}: ChronicleReviewPanelProps) {

  if (!item) return null;

  // ---------------------------------------------------------------------------
  // Assembly Ready & Complete -> Tabbed Workspace
  // ---------------------------------------------------------------------------
  if (
    (item.status === "assembly_ready" && item.assembledContent) ||
    (item.status === "complete" && item.finalContent)
  ) {
    return (
      <ChronicleWorkspace
        item={item}
        onAccept={onAccept}
        onRegenerate={onRegenerate}
        onRegenerateWithSampling={onRegenerateWithSampling}
        onRegenerateFull={onRegenerateFull}
        onRegenerateCreative={onRegenerateCreative}
        onCompareVersions={onCompareVersions}
        onCombineVersions={onCombineVersions}
        onCopyEdit={onCopyEdit}
        onTemporalCheck={onTemporalCheck}
        onQuickCheck={onQuickCheck}
        onValidate={onValidate}
        onGenerateSummary={onGenerateSummary}
        onGenerateTitle={onGenerateTitle}
        onAcceptPendingTitle={onAcceptPendingTitle}
        onRejectPendingTitle={onRejectPendingTitle}
        onGenerateImageRefs={onGenerateImageRefs}
        onGenerateChronicleImage={onGenerateChronicleImage}
        onResetChronicleImage={onResetChronicleImage}
        onRegenerateDescription={onRegenerateDescription}
        onUpdateChronicleAnchorText={onUpdateChronicleAnchorText}
        onUpdateChronicleTemporalContext={onUpdateChronicleTemporalContext}
        onUpdateChronicleActiveVersion={onUpdateChronicleActiveVersion}
        onDeleteVersion={onDeleteVersion}
        onUpdateCombineInstructions={onUpdateCombineInstructions}
        onUnpublish={onUnpublish}
        onGenerateCoverImageScene={onGenerateCoverImageScene}
        onGenerateCoverImage={onGenerateCoverImage}
        styleSelection={styleSelection}
        imageSize={imageSize}
        imageQuality={imageQuality}
        imageModel={imageModel}
        imageGenSettings={imageGenSettings}
        onOpenImageSettings={onOpenImageSettings}
        onUpdateChronicleImageSize={onUpdateChronicleImageSize}
        onUpdateChronicleImageJustification={onUpdateChronicleImageJustification}
        onApplyImageRefSelections={onApplyImageRefSelections}
        onSelectExistingImage={onSelectExistingImage}
        onSelectExistingCoverImage={onSelectExistingCoverImage}
        onExport={onExport}
        onBackportLore={onBackportLore}
        onHistorianReview={onHistorianReview}
        onSetAssignedTone={onSetAssignedTone}
        onDetectTone={onDetectTone}
        isHistorianActive={isHistorianActive}
        onUpdateHistorianNote={onUpdateHistorianNote}
        onGeneratePrep={onGeneratePrep}
        isGenerating={isGenerating}
        refinements={refinements}
        simulationRunId={simulationRunId}
        worldSchema={worldSchema}
        entities={entities}
        styleLibrary={styleLibrary}
        cultures={cultures}
        cultureIdentities={cultureIdentities}
        worldContext={worldContext}
        eras={eras}
        events={events}
        onNavigateToTab={onNavigateToTab}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Validation Ready -> Inline layout (not tabbed)
  // ---------------------------------------------------------------------------
  if (item.status === "validation_ready") {
    return (
      <ValidationReadyView
        item={item}
        onExport={onExport}
        onAccept={onAccept}
        onRegenerate={onRegenerate}
        onCorrectSuggestions={onCorrectSuggestions}
        onGenerateSummary={onGenerateSummary}
        onGenerateImageRefs={onGenerateImageRefs}
        onRevalidate={onRevalidate}
        onGenerateChronicleImage={onGenerateChronicleImage}
        onResetChronicleImage={onResetChronicleImage}
        onUpdateChronicleAnchorText={onUpdateChronicleAnchorText}
        onUpdateChronicleImageSize={onUpdateChronicleImageSize}
        onUpdateChronicleImageJustification={onUpdateChronicleImageJustification}
        onUpdateChronicleActiveVersion={onUpdateChronicleActiveVersion}
        onDeleteVersion={onDeleteVersion}
        isGenerating={isGenerating}
        refinements={refinements}
        entities={entities}
        styleLibrary={styleLibrary}
        cultures={cultures}
        cultureIdentities={cultureIdentities}
        worldContext={worldContext}
      />
    );
  }

  return null;
}
