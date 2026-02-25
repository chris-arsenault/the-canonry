import { useState, useMemo } from "react";
import ChronicleVersionSelector from "./ChronicleVersionSelector";
import { getCallConfig } from "../../lib/llmModelSettings";
import "./VersionsTab.css";

/** Format LLM config for display */
function formatLLMConfig(config) {
  const parts = [];
  // Model (shortened)
  const modelShort = config.model?.replace("claude-", "").replace("-latest", "") || "default";
  parts.push(modelShort);
  // Thinking
  if (config.thinkingBudget > 0) {
    parts.push(`think:${config.thinkingBudget}`);
    // Show topP when thinking is enabled
    parts.push(`top_p:${config.topP ?? 1.0}`);
  } else {
    // Show temperature when thinking is disabled
    parts.push(`temp:${config.temperature ?? 1.0}`);
  }
  return parts.join(", ");
}

export default function VersionsTab({
  item,
  versions,
  selectedVersionId,
  compareToVersionId,
  activeVersionId,
  isGenerating,
  onSelectVersion,
  onSelectCompareVersion,
  onSetActiveVersion,
  onDeleteVersion,
  onCompareVersions,
  onCombineVersions,
  onRegenerateFull,
  onRegenerateCreative,
  onRegenerateWithSampling,
  onUpdateCombineInstructions,
  onCopyEdit,
  compareRunning,
  combineRunning,
  copyEditRunning,
}) {
  const [editingCombineInstructions, setEditingCombineInstructions] = useState(false);
  const [combineInstructionsDraft, setCombineInstructionsDraft] = useState("");

  // Get current LLM settings for display
  const llmConfigDisplay = useMemo(() => {
    const perspectiveConfig = getCallConfig("perspective.synthesis");
    const generationConfig = getCallConfig("chronicle.generation");
    return {
      perspective: formatLLMConfig(perspectiveConfig),
      generation: formatLLMConfig(generationConfig),
    };
  }, []);

  return (
    <div>
      {/* Version Selector */}
      <div className="vtab-selector-wrap">
        <ChronicleVersionSelector
          versions={versions}
          selectedVersionId={selectedVersionId}
          activeVersionId={activeVersionId}
          compareToVersionId={compareToVersionId}
          onSelectVersion={onSelectVersion}
          onSelectCompareVersion={onSelectCompareVersion}
          onSetActiveVersion={onSetActiveVersion}
          onDeleteVersion={onDeleteVersion}
          disabled={isGenerating}
        />
      </div>

      {/* Compare & Combine */}
      <div className="vtab-section">
        <div className="vtab-section-title">
          Version Analysis
          <span className="vtab-section-title-count">
            ({versions.length} version{versions.length !== 1 ? "s" : ""} available)
          </span>
        </div>
        <div className="vtab-button-row">
          <button
            onClick={onCompareVersions}
            disabled={isGenerating || compareRunning || combineRunning || versions.length < 2}
            className="vtab-action-btn"
          >
            {compareRunning ? "Comparing..." : "Compare Versions"}
          </button>
          <button
            onClick={onCombineVersions}
            disabled={
              isGenerating ||
              compareRunning ||
              combineRunning ||
              copyEditRunning ||
              versions.length < 2
            }
            className="vtab-action-btn"
          >
            {combineRunning ? "Combining..." : "Combine Versions"}
          </button>
          <button
            onClick={onCopyEdit}
            disabled={
              isGenerating ||
              compareRunning ||
              combineRunning ||
              copyEditRunning ||
              !item.assembledContent
            }
            title="Polish pass — smooths voice, trims to word count target, tightens prose. Produces a new version."
            className="vtab-action-btn"
          >
            {copyEditRunning ? "Copy-editing..." : "Copy-edit"}
          </button>
          <button
            onClick={() => {
              const list = item.generationHistory || [];
              const byId = new Map();
              for (const v of list) {
                const arr = byId.get(v.versionId) || [];
                arr.push(v);
                byId.set(v.versionId, arr);
              }
              const duplicates = Array.from(byId.entries())
                .filter(([, arr]) => arr.length > 1)
                .map(([id, arr]) => ({ id, count: arr.length }));
              console.warn("[Chronicle][Debug] Version dump", {
                chronicleId: item.chronicleId,
                activeVersionId: item.activeVersionId,
                acceptedVersionId: item.acceptedVersionId,
                assembledAt: item.assembledAt,
                assembledContentLength: item.assembledContent?.length || 0,
                versionCount: list.length,
                duplicates,
                versions: list.map((v, i) => ({
                  index: i,
                  versionId: v.versionId,
                  generatedAt: v.generatedAt,
                  step: v.step,
                  sampling: v.sampling,
                  model: v.model,
                  wordCount: v.wordCount,
                  contentLength: v.content?.length || 0,
                })),
              });
            }}
            disabled={isGenerating}
            title="Dump generationHistory to console"
            className="vtab-action-btn"
          >
            Dump Versions
          </button>
        </div>
        <div className="vtab-hint-text">
          {versions.length < 2
            ? "Create a new version first to enable comparison and combination."
            : "Compare produces an analysis report. Combine synthesizes all drafts into a new version. Copy-edit polishes the active version."}
          {item.comparisonReport && !item.combineInstructions && (
            <span className="vtab-warning-text">
              {" "}
              Combine instructions missing — combine will use generic criteria.
              {onUpdateCombineInstructions && (
                <button
                  onClick={() => {
                    setCombineInstructionsDraft("");
                    setEditingCombineInstructions(true);
                  }}
                  className="vtab-inline-btn"
                >
                  Set manually
                </button>
              )}
            </span>
          )}
          {item.combineInstructions && (
            <span className="vtab-success-text">
              {" "}
              Combine instructions ready.
              {onUpdateCombineInstructions && (
                <button
                  onClick={() => {
                    setCombineInstructionsDraft(item.combineInstructions);
                    setEditingCombineInstructions(true);
                  }}
                  className="vtab-inline-btn"
                >
                  Edit
                </button>
              )}
            </span>
          )}
        </div>

        {/* Combine Instructions Editor */}
        {editingCombineInstructions && (
          <div className="vtab-instructions-editor">
            <textarea
              value={combineInstructionsDraft}
              onChange={(e) => setCombineInstructionsDraft(e.target.value)}
              placeholder="Enter combine instructions — editorial direction for how to merge versions..."
              className="vtab-textarea"
            />
            <div className="vtab-editor-actions">
              <button
                onClick={() => {
                  onUpdateCombineInstructions(combineInstructionsDraft.trim());
                  setEditingCombineInstructions(false);
                }}
                disabled={!combineInstructionsDraft.trim()}
                className="vtab-save-btn"
                // eslint-disable-next-line local/no-inline-styles -- dynamic save button appearance from draft state
                style={{ '--vtab-save-bg': combineInstructionsDraft.trim() ? 'var(--accent-color, #6366f1)' : 'var(--bg-tertiary)', '--vtab-save-color': combineInstructionsDraft.trim() ? '#fff' : 'var(--text-muted)', '--vtab-save-cursor': combineInstructionsDraft.trim() ? 'pointer' : 'not-allowed' }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingCombineInstructions(false)}
                className="vtab-cancel-btn"
              >
                Cancel
              </button>
              {item.combineInstructions && (
                <button
                  onClick={() => {
                    onUpdateCombineInstructions("");
                    setEditingCombineInstructions(false);
                  }}
                  className="vtab-clear-btn"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create New Version */}
      <div className="vtab-section">
        <div className="vtab-section-title">
          Create New Version
        </div>

        <div className="vtab-button-row-mb">
          {/* Regenerate with existing perspective */}
          <button
            onClick={() => onRegenerateWithSampling?.()}
            disabled={
              isGenerating ||
              compareRunning ||
              combineRunning ||
              !item.generationSystemPrompt ||
              !item.generationUserPrompt
            }
            title="Reuse stored prompts with current LLM sampling settings (fast, same perspective)"
            className="vtab-regen-btn"
          >
            {isGenerating ? "Generating..." : "Regenerate with existing perspective"}
          </button>

          {/* Regenerate with new perspective */}
          <button
            onClick={() => onRegenerateFull?.()}
            disabled={isGenerating || compareRunning || combineRunning || !onRegenerateFull}
            title="Run fresh perspective synthesis with current world facts & tone (slower, may differ significantly)"
            className="vtab-regen-primary-btn"
          >
            {isGenerating ? "Generating..." : "Regenerate with new perspective"}
          </button>

          {/* Regenerate with creative freedom (story format only) */}
          {onRegenerateCreative && (
            <button
              onClick={() => onRegenerateCreative?.()}
              disabled={isGenerating || compareRunning || combineRunning}
              title="Same PS, different generation prompt — neutral framing, softened structure, no craft posture. Reuses existing perspective synthesis."
              className="vtab-regen-creative-btn"
            >
              {isGenerating ? "Generating..." : "Creative freedom"}
            </button>
          )}
        </div>

        <div className="vtab-llm-config">
          <span className="vtab-llm-config-label">LLM Config:</span>{" "}
          <span title="perspective.synthesis">perspective: {llmConfigDisplay.perspective}</span>
          {" · "}
          <span title="chronicle.generation">generation: {llmConfigDisplay.generation}</span>
          {(!item.generationSystemPrompt || !item.generationUserPrompt) && (
            <span className="vtab-warning-inline">
              Existing perspective unavailable (legacy chronicle).
            </span>
          )}
          {!onRegenerateFull && (
            <span className="vtab-warning-inline">
              New perspective requires toneFragments and canonFactsWithMetadata.
            </span>
          )}
        </div>
      </div>

      {/* Comparison Report */}
      {item.comparisonReport && (
        <div className="vtab-report-section">
          <div className="vtab-report-header">
            <span className="vtab-report-title">Comparison Report</span>
            <div className="vtab-report-actions">
              {item.comparisonReportGeneratedAt && (
                <span className="vtab-report-timestamp">
                  {new Date(item.comparisonReportGeneratedAt).toLocaleString()}
                </span>
              )}
              <button
                onClick={() => {
                  const blob = new Blob([item.comparisonReport], { type: "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `comparison-report-${item.chronicleId.slice(0, 20)}-${Date.now()}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="vtab-export-btn"
              >
                Export
              </button>
            </div>
          </div>
          <div className="vtab-report-body">
            {item.comparisonReport}
          </div>
        </div>
      )}
    </div>
  );
}
