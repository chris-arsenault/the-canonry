import ChronicleImagePanel from "../ChronicleImagePanel";
import { CoverImageControls } from "../CoverImageControls";

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
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "13px", fontWeight: 500 }}>
          <span style={{ marginRight: "8px", color: done ? "#10b981" : "var(--text-muted)" }}>
            {done ? "\u2611" : "\u2610"}
          </span>
          {label}
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "24px" }}>
          {description}
        </div>
        {done && (
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              marginTop: "4px",
              marginLeft: "24px",
            }}
          >
            Done - {formatTimestamp(done)}
            {state.model ? ` - ${state.model}` : ""}
          </div>
        )}
        {indicator && done && (
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              marginTop: "2px",
              marginLeft: "24px",
            }}
          >
            {indicator}
          </div>
        )}
        {!done && !running && (
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              marginTop: "4px",
              marginLeft: "24px",
            }}
          >
            Not run yet
          </div>
        )}
        {running && (
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              marginTop: "4px",
              marginLeft: "24px",
            }}
          >
            Running...
          </div>
        )}
      </div>
      {onAction && (
        <button
          onClick={onAction}
          disabled={isGenerating || running}
          style={{
            padding: "8px 14px",
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            color: "var(--text-secondary)",
            cursor: isGenerating || running ? "not-allowed" : "pointer",
            opacity: isGenerating || running ? 0.6 : 1,
            fontSize: "12px",
            height: "32px",
            alignSelf: "center",
          }}
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
  onRegenerateWithSampling,
  entityMap,
  styleLibrary,
  styleSelection,
  cultures,
  cultureIdentities,
  worldContext,
  summaryIndicator,
  imageRefsIndicator,
  imageRefsTargetContent,
  imageSize,
  imageQuality,
  imageModel,
  imageGenSettings,
  onOpenImageSettings,
  onGenerateChronicleImage,
  onResetChronicleImage,
  onRegenerateDescription,
  onUpdateChronicleAnchorText,
  onUpdateChronicleImageSize,
  onUpdateChronicleImageJustification,
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
      <div
        style={{
          marginBottom: "24px",
          padding: "16px",
          background: "var(--bg-secondary)",
          borderRadius: "8px",
          border: "1px solid var(--border-color)",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            marginBottom: "12px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Refinements</span>
          <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--text-muted)" }}>
            {completedCount}/5 complete
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <RefinementRow
            label="Summary"
            description="Generate a short summary for chronicle listings."
            state={summaryState}
            indicator={summaryIndicator}
            onAction={onGenerateSummary}
            isGenerating={isGenerating}
          />

          {/* Title - with candidates display */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "13px", fontWeight: 500 }}>
                <span
                  style={{
                    marginRight: "8px",
                    color: titleState.generatedAt ? "#10b981" : "var(--text-muted)",
                  }}
                >
                  {titleState.generatedAt ? "\u2611" : "\u2610"}
                </span>
                Title
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "24px" }}>
                Generate an evocative title using single-pass candidate generation.
              </div>
              {titleState.generatedAt && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    marginTop: "4px",
                    marginLeft: "24px",
                  }}
                >
                  Done - {new Date(titleState.generatedAt).toLocaleString()}
                  {titleState.model ? ` - ${titleState.model}` : ""}
                </div>
              )}
              {item.titleCandidates?.length > 0 && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    marginTop: "4px",
                    lineHeight: 1.5,
                    marginLeft: "24px",
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>&#x25C6; {item.title}</span>
                  <br />
                  {item.titleCandidates.map((c, i) => (
                    <span key={i}>
                      <span style={{ opacity: 0.6 }}>&#x25C7;</span> {c}
                      {i < item.titleCandidates.length - 1 ? <br /> : null}
                    </span>
                  ))}
                </div>
              )}
              {item.titleFragments?.length > 0 && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    marginTop: "4px",
                    marginLeft: "24px",
                    fontStyle: "italic",
                  }}
                >
                  ~ {item.titleFragments.join(" \u00b7 ")}
                </div>
              )}
              {!titleState.generatedAt && !titleState.running && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    marginTop: "4px",
                    marginLeft: "24px",
                  }}
                >
                  Not run yet
                </div>
              )}
              {titleState.running && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    marginTop: "4px",
                    marginLeft: "24px",
                  }}
                >
                  Running...
                </div>
              )}
            </div>
            {onGenerateTitle && (
              <button
                onClick={onGenerateTitle}
                disabled={isGenerating || titleState.running}
                style={{
                  padding: "8px 14px",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  color: "var(--text-secondary)",
                  cursor: isGenerating || titleState.running ? "not-allowed" : "pointer",
                  opacity: isGenerating || titleState.running ? 0.6 : 1,
                  fontSize: "12px",
                  height: "32px",
                  alignSelf: "center",
                }}
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
            <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 500 }}>
                  <span
                    style={{
                      marginRight: "8px",
                      color: item.cohesionReport ? "#10b981" : "var(--text-muted)",
                    }}
                  >
                    {item.cohesionReport ? "\u2611" : "\u2610"}
                  </span>
                  Validate
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "24px" }}>
                  Run quality validation to check narrative coherence.
                </div>
                {item.cohesionReport && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      marginTop: "4px",
                      marginLeft: "24px",
                    }}
                  >
                    Done - Score: {item.cohesionReport.overallScore}/100
                  </div>
                )}
              </div>
              <button
                onClick={onValidate}
                disabled={isGenerating}
                style={{
                  padding: "8px 14px",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  color: "var(--text-secondary)",
                  cursor: isGenerating ? "not-allowed" : "pointer",
                  opacity: isGenerating ? 0.6 : 1,
                  fontSize: "12px",
                  height: "32px",
                  alignSelf: "center",
                }}
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
