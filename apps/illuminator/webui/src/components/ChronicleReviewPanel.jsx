/**
 * ChronicleReviewPanel - Shared review/refinement UI for chronicles
 *
 * assembly_ready and complete statuses delegate to ChronicleWorkspace (tabbed UI).
 * validation_ready keeps its own inline layout since it's a different workflow.
 *
 * PROP CHAIN: ChroniclePanel → ChronicleReviewPanel (this file) → ChronicleWorkspace
 * This file is the middle layer — it must destructure AND forward every prop that
 * ChronicleWorkspace needs. When adding props, update all three files.
 */

import React, { useMemo, useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { diffWords } from "diff";
import CohesionReportViewer from "./CohesionReportViewer";
import ImageModal from "./ImageModal";
import ChronicleWorkspace from "./chronicle-workspace/ChronicleWorkspace";
import ChronicleVersionSelector from "./chronicle-workspace/ChronicleVersionSelector";
import "./ChronicleReviewPanel.css";

// ============================================================================
// Perspective Synthesis Viewer (kept for validation_ready)
// ============================================================================

function PerspectiveSynthesisViewer({ synthesis }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("output");

  if (!synthesis) return null;

  const formatCost = (cost) => `$${cost.toFixed(4)}`;
  const formatTimestamp = (ts) => new Date(ts).toLocaleString();

  const hasInputData =
    synthesis.coreTone ||
    synthesis.inputFacts ||
    synthesis.inputCulturalIdentities ||
    synthesis.constellation;

  return (
    <div className="crp-synth">
      <div
        className={`crp-synth-header ${isExpanded ? "crp-synth-header-expanded" : ""}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="crp-synth-toggle">{isExpanded ? "\u25BC" : "\u25B6"}</span>
        <span className="crp-synth-title">Perspective Synthesis</span>
        <span className="crp-synth-meta">
          {synthesis.facets?.length || 0} facets &bull; {synthesis.entityDirectives?.length || 0}{" "}
          directives &bull; {synthesis.suggestedMotifs?.length || 0} motifs &bull;{" "}
          {formatCost(synthesis.actualCost)}
        </span>
      </div>

      {isExpanded && (
        <div className="crp-synth-body">
          {hasInputData && (
            <div className="crp-synth-tabs">
              <button
                onClick={() => setActiveTab("output")}
                className={`crp-synth-tab ${activeTab === "output" ? "crp-synth-tab-active" : "crp-synth-tab-inactive"}`}
              >
                LLM Output
              </button>
              <button
                onClick={() => setActiveTab("input")}
                className={`crp-synth-tab ${activeTab === "input" ? "crp-synth-tab-active" : "crp-synth-tab-inactive"}`}
              >
                LLM Input
              </button>
            </div>
          )}
          {activeTab === "output" && (
            <>
              {synthesis.constellationSummary && (
                <div className="crp-synth-section">
                  <div className="crp-synth-section-label">CONSTELLATION SUMMARY</div>
                  <div className="crp-synth-section-text">{synthesis.constellationSummary}</div>
                </div>
              )}
              {synthesis.brief && (
                <div className="crp-synth-section">
                  <div className="crp-synth-section-label">PERSPECTIVE BRIEF</div>
                  <div className="crp-synth-block">{synthesis.brief}</div>
                </div>
              )}
            </>
          )}
          {activeTab === "input" && synthesis.coreTone && (
            <div className="crp-synth-section">
              <div className="crp-synth-section-label">CORE TONE</div>
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
// Assembled Content Viewer (kept for validation_ready)
// ============================================================================

function AssembledContentViewer({ content, wordCount, onCopy, compareContent, compareLabel }) {
  const diffParts = useMemo(() => {
    if (!compareContent) return null;
    return diffWords(compareContent, content);
  }, [content, compareContent]);

  return (
    <div className="crp-acv">
      <div className="crp-acv-header">
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
// Main Component
// ============================================================================

export default function ChronicleReviewPanel({
  item,

  // Actions
  onContinueToValidation,
  onValidate,
  onAddImages,
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
  entityGuidance,
  cultureIdentities,
  worldContext,
  eras,
  events,
  onNavigateToTab,
}) {
  if (!item) return null;

  // ---------------------------------------------------------------------------
  // Assembly Ready & Complete → Tabbed Workspace
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
  // Validation Ready → Inline layout (not tabbed)
  // ---------------------------------------------------------------------------
  if (item.status === "validation_ready") {
    return (
      <ValidationReadyView
        item={item}
        onExport={onExport}
        onRegenerateWithSampling={onRegenerateWithSampling}
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

// ============================================================================
// Validation Ready View (self-contained)
// ============================================================================

function ValidationReadyView({
  item,
  onExport,
  onRegenerateWithSampling,
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
}) {
  const entityMap = useMemo(() => {
    if (!entities) return new Map();
    return new Map(entities.map((e) => [e.id, e]));
  }, [entities]);

  const [imageModal, setImageModal] = useState({ open: false, imageId: "", title: "" });

  const wordCountFn = (content) => content?.split(/\s+/).filter(Boolean).length || 0;
  const copyToClipboard = (content) => navigator.clipboard.writeText(content);

  const versions = useMemo(() => {
    const sorted = [...(item.generationHistory || [])].sort(
      (a, b) => a.generatedAt - b.generatedAt
    );
    const seen = new Set();
    const unique = [];
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

  const activeVersionId = item.activeVersionId || versions[versions.length - 1]?.id;

  const [selectedVersionId, setSelectedVersionId] = useState(activeVersionId);
  const [compareToVersionId, setCompareToVersionId] = useState("");

  useEffect(() => {
    setSelectedVersionId(activeVersionId);
    setCompareToVersionId("");
  }, [activeVersionId, item.chronicleId]);

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
  }, [versions, selectedVersionId, compareToVersionId, activeVersionId]);

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || versions[versions.length - 1],
    [versions, selectedVersionId]
  );
  const compareToVersion = useMemo(
    () => (compareToVersionId ? versions.find((v) => v.id === compareToVersionId) : null),
    [versions, compareToVersionId]
  );

  const handleDeleteVersion = useCallback(
    (versionId) => {
      if (!versionId || versions.length === 0) return;

      const index = versions.findIndex((v) => v.id === versionId);
      let nextSelected = selectedVersionId;
      if (index !== -1) {
        nextSelected = versions[index + 1]?.id || versions[index - 1]?.id || selectedVersionId;
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
    [versions, selectedVersionId, activeVersionId, compareToVersionId, onDeleteVersion]
  );

  const versionContentMap = useMemo(() => {
    const map = new Map();
    for (const v of versions) map.set(v.id, v.content);
    return map;
  }, [versions]);

  const versionLabelMap = useMemo(() => {
    const map = new Map();
    for (const v of versions) map.set(v.id, v.shortLabel);
    return map;
  }, [versions]);

  const getVersionLabel = (versionId) => versionLabelMap.get(versionId) || "Unknown";
  const formatTargetIndicator = (targetVersionId) => {
    if (!targetVersionId) return null;
    if (targetVersionId === activeVersionId) return null;
    return `Targets ${getVersionLabel(targetVersionId)} \u2022 Active ${getVersionLabel(activeVersionId)}`;
  };

  const summaryIndicator = formatTargetIndicator(item.summaryTargetVersionId);
  const imageRefsIndicator = formatTargetIndicator(item.imageRefsTargetVersionId);
  const imageRefsTargetContent =
    versionContentMap.get(item.imageRefsTargetVersionId || activeVersionId) ||
    item.assembledContent;

  const seedData = {
    narrativeStyleId: item.narrativeStyleId || "",
    narrativeStyleName:
      item.narrativeStyle?.name ||
      styleLibrary?.narrativeStyles?.find((s) => s.id === item.narrativeStyleId)?.name,
    entrypointId: item.entrypointId,
    entrypointName: item.entrypointId
      ? entities?.find((e) => e.id === item.entrypointId)?.name
      : undefined,
    roleAssignments: item.roleAssignments || [],
    selectedEventIds: item.selectedEventIds || [],
    selectedRelationshipIds: item.selectedRelationshipIds || [],
  };

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
          chronicleTitle={item.title || item.name}
        />
      )}
      {item.assembledContent && (
        <div className="crp-preview-section">
          <div className="crp-preview-header">
            <h3 className="crp-preview-title">Preview</h3>
            <ChronicleVersionSelector
              versions={versions}
              selectedVersionId={selectedVersionId}
              activeVersionId={activeVersionId}
              compareToVersionId={compareToVersionId}
              onSelectVersion={(id) => {
                setSelectedVersionId(id);
                if (id === compareToVersionId) setCompareToVersionId("");
              }}
              onSelectCompareVersion={setCompareToVersionId}
              onSetActiveVersion={onUpdateChronicleActiveVersion}
              onDeleteVersion={handleDeleteVersion}
              disabled={isGenerating}
            />
          </div>
          <AssembledContentViewer
            content={selectedVersion?.content || item.assembledContent}
            wordCount={selectedVersion?.wordCount ?? wordCountFn(item.assembledContent)}
            onCopy={() => copyToClipboard(selectedVersion?.content || item.assembledContent)}
            compareContent={compareToVersion?.content}
            compareLabel={compareToVersion?.shortLabel}
          />
        </div>
      )}
      <ImageModal
        isOpen={imageModal.open}
        imageId={imageModal.imageId}
        title={imageModal.title}
        onClose={() => setImageModal({ open: false, imageId: "", title: "" })}
      />
    </div>
  );
}
