import { CoverImageControls } from "../CoverImageControls";
import "./PipelineTab.css";
import React from "react";
import PropTypes from "prop-types";

// ============================================================================
// Refinement Checklist Row
// ============================================================================

function RefinementRow({
  label,
  description,
  state,
  indicator,
  onAction,
  actionLabel,
  isGenerating,
}) {
  const running = state?.running;
  const done = state?.generatedAt;
  const formatTimestamp = (ts) => new Date(ts).toLocaleString();

  return (
    <div className="pt-refrow">
      <div className="pt-refrow-content">
        <div className="pt-refrow-title">
          <span
            className={`pt-refrow-checkbox ${done ? "pt-refrow-checkbox-done" : "pt-refrow-checkbox-pending"}`}
          >
            {done ? "\u2611" : "\u2610"}
          </span>
          {label}
        </div>
        <div className="pt-refrow-description">{description}</div>
        {done && (
          <div className="pt-refrow-meta">
            Done - {formatTimestamp(done)}
            {state.model ? ` - ${state.model}` : ""}
          </div>
        )}
        {indicator && done && <div className="pt-refrow-indicator">{indicator}</div>}
        {!done && !running && <div className="pt-refrow-meta">Not run yet</div>}
        {running && <div className="pt-refrow-meta">Running...</div>}
      </div>
      {onAction && (
        <button
          onClick={onAction}
          disabled={isGenerating || running}
          className={`ilu-action-btn pt-refrow-btn ${isGenerating || running ? "pt-refrow-btn-disabled" : "pt-refrow-btn-enabled"}`}
        >
          {actionLabel || (done ? "Regenerate" : "Generate")}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Pipeline Tab
// ============================================================================

export default function PipelineTab({
  item,
  isGenerating,
  refinements,
  onValidate,
  onGenerateSummary,
  onGenerateTitle,
  onGenerateImageRefs,
  onGenerateCoverImageScene,
  onGenerateCoverImage,
  onImageClick,
  onRegenerateWithSampling: _onRegenerateWithSampling,
  entityMap: _entityMap,
  styleLibrary: _styleLibrary,
  styleSelection: _styleSelection,
  cultures: _cultures,
  cultureIdentities: _cultureIdentities,
  worldContext: _worldContext,
  summaryIndicator,
  imageRefsIndicator,
  imageRefsTargetContent: _imageRefsTargetContent,
  imageSize: _imageSize,
  imageQuality: _imageQuality,
  imageModel: _imageModel,
  imageGenSettings: _imageGenSettings,
  onOpenImageSettings: _onOpenImageSettings,
  onGenerateChronicleImage: _onGenerateChronicleImage,
  onResetChronicleImage: _onResetChronicleImage,
  onRegenerateDescription: _onRegenerateDescription,
  onUpdateChronicleAnchorText: _onUpdateChronicleAnchorText,
  onUpdateChronicleImageSize: _onUpdateChronicleImageSize,
  onUpdateChronicleImageJustification: _onUpdateChronicleImageJustification,
}) {
  const summaryState = refinements?.summary || {};
  const titleState = refinements?.title || {};
  const imageRefsState = refinements?.imageRefs || {};

  const completedCount = [
    summaryState.generatedAt,
    titleState.generatedAt,
    item.coverImage?.status === "complete",
    imageRefsState.generatedAt,
    item.cohesionReport,
  ].filter(Boolean).length;

  return (
    <div>
      {/* Refinement Checklist */}
      <div className="ilu-section pt-checklist">
        <div className="pt-checklist-header">
          <span>Refinements</span>
          <span className="pt-checklist-count">{completedCount}/5 complete</span>
        </div>
        <div className="pt-checklist-items">
          <RefinementRow
            label="Summary"
            description="Generate a short summary for chronicle listings."
            state={summaryState}
            indicator={summaryIndicator}
            onAction={onGenerateSummary}
            isGenerating={isGenerating}
          />

          {/* Title - with candidates display */}
          <div className="pt-refrow">
            <div className="pt-refrow-content">
              <div className="pt-refrow-title">
                <span
                  className={`pt-refrow-checkbox ${titleState.generatedAt ? "pt-refrow-checkbox-done" : "pt-refrow-checkbox-pending"}`}
                >
                  {titleState.generatedAt ? "\u2611" : "\u2610"}
                </span>
                Title
              </div>
              <div className="pt-refrow-description">
                Generate an evocative title using single-pass candidate generation.
              </div>
              {titleState.generatedAt && (
                <div className="pt-refrow-meta">
                  Done - {new Date(titleState.generatedAt).toLocaleString()}
                  {titleState.model ? ` - ${titleState.model}` : ""}
                </div>
              )}
              {item.titleCandidates?.length > 0 && (
                <div className="pt-title-candidates">
                  <span className="pt-title-selected">&#x25C6; {item.title}</span>
                  <br />
                  {item.titleCandidates.map((c, i) => (
                    <span key={i}>
                      <span className="pt-title-candidate-icon">&#x25C7;</span> {c}
                      {i < item.titleCandidates.length - 1 ? <br /> : null}
                    </span>
                  ))}
                </div>
              )}
              {item.titleFragments?.length > 0 && (
                <div className="pt-title-fragments">~ {item.titleFragments.join(" \u00b7 ")}</div>
              )}
              {!titleState.generatedAt && !titleState.running && (
                <div className="pt-refrow-meta">Not run yet</div>
              )}
              {titleState.running && <div className="pt-refrow-meta">Running...</div>}
            </div>
            {onGenerateTitle && (
              <button
                onClick={onGenerateTitle}
                disabled={isGenerating || titleState.running}
                className={`ilu-action-btn pt-refrow-btn ${isGenerating || titleState.running ? "pt-refrow-btn-disabled" : "pt-refrow-btn-enabled"}`}
              >
                {titleState.generatedAt ? "Regenerate" : "Generate"}
              </button>
            )}
          </div>

          <CoverImageControls
            item={item}
            onGenerateCoverImageScene={onGenerateCoverImageScene}
            onGenerateCoverImage={onGenerateCoverImage}
            isGenerating={isGenerating}
            onImageClick={onImageClick}
          />

          <RefinementRow
            label="Image Refs"
            description="Generate image placement suggestions for this chronicle."
            state={imageRefsState}
            indicator={imageRefsIndicator}
            onAction={onGenerateImageRefs}
            isGenerating={isGenerating}
          />

          {onValidate && (
            <div className="pt-refrow">
              <div>
                <div className="pt-refrow-title">
                  <span
                    className={`pt-refrow-checkbox ${item.cohesionReport ? "pt-refrow-checkbox-done" : "pt-refrow-checkbox-pending"}`}
                  >
                    {item.cohesionReport ? "\u2611" : "\u2610"}
                  </span>
                  Validate
                </div>
                <div className="pt-refrow-description">
                  Run quality validation to check narrative coherence.
                </div>
                {item.cohesionReport && (
                  <div className="pt-refrow-meta">
                    Done - Score: {item.cohesionReport.overallScore}/100
                  </div>
                )}
              </div>
              <button
                onClick={onValidate}
                disabled={isGenerating}
                className={`ilu-action-btn pt-refrow-btn ${isGenerating ? "pt-refrow-btn-disabled" : "pt-refrow-btn-enabled"}`}
              >
                {item.cohesionReport ? "Revalidate" : "Validate"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

RefinementRow.propTypes = {
  label: PropTypes.string.isRequired,
  description: PropTypes.string,
  state: PropTypes.object,
  indicator: PropTypes.node,
  onAction: PropTypes.func,
  actionLabel: PropTypes.string,
  isGenerating: PropTypes.bool,
};

PipelineTab.propTypes = {
  item: PropTypes.object.isRequired,
  isGenerating: PropTypes.bool,
  refinements: PropTypes.object,
  onValidate: PropTypes.func,
  onGenerateSummary: PropTypes.func,
  onGenerateTitle: PropTypes.func,
  onGenerateImageRefs: PropTypes.func,
  onGenerateCoverImageScene: PropTypes.func,
  onGenerateCoverImage: PropTypes.func,
  onImageClick: PropTypes.func,
  onRegenerateWithSampling: PropTypes.func,
  entityMap: PropTypes.object,
  styleLibrary: PropTypes.object,
  styleSelection: PropTypes.object,
  cultures: PropTypes.array,
  cultureIdentities: PropTypes.object,
  worldContext: PropTypes.object,
  summaryIndicator: PropTypes.node,
  imageRefsIndicator: PropTypes.node,
  imageRefsTargetContent: PropTypes.string,
  imageSize: PropTypes.string,
  imageQuality: PropTypes.string,
  imageModel: PropTypes.string,
  imageGenSettings: PropTypes.object,
  onOpenImageSettings: PropTypes.func,
  onGenerateChronicleImage: PropTypes.func,
  onResetChronicleImage: PropTypes.func,
  onRegenerateDescription: PropTypes.func,
  onUpdateChronicleAnchorText: PropTypes.func,
  onUpdateChronicleImageSize: PropTypes.func,
  onUpdateChronicleImageJustification: PropTypes.func,
};
