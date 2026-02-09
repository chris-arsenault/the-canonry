import { useState, useMemo } from 'react';
import ChronicleVersionSelector from './ChronicleVersionSelector';
import { getCallConfig } from '../../lib/llmModelSettings';

/** Format LLM config for display */
function formatLLMConfig(config) {
  const parts = [];
  // Model (shortened)
  const modelShort = config.model?.replace('claude-', '').replace('-latest', '') || 'default';
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
  return parts.join(', ');
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
  const [combineInstructionsDraft, setCombineInstructionsDraft] = useState('');

  // Get current LLM settings for display
  const llmConfigDisplay = useMemo(() => {
    const perspectiveConfig = getCallConfig('perspective.synthesis');
    const generationConfig = getCallConfig('chronicle.generation');
    return {
      perspective: formatLLMConfig(perspectiveConfig),
      generation: formatLLMConfig(generationConfig),
    };
  }, []);

  return (
    <div>
      {/* Version Selector */}
      <div style={{ marginBottom: '16px' }}>
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
      <div
        style={{
          marginBottom: '16px',
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>
          Version Analysis
          <span style={{ marginLeft: '8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 400 }}>
            ({versions.length} version{versions.length !== 1 ? 's' : ''} available)
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={onCompareVersions}
            disabled={isGenerating || compareRunning || combineRunning || versions.length < 2}
            style={{
              padding: '8px 14px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              cursor: isGenerating || compareRunning || combineRunning || versions.length < 2 ? 'not-allowed' : 'pointer',
              opacity: isGenerating || compareRunning || combineRunning || versions.length < 2 ? 0.6 : 1,
              fontSize: '12px',
            }}
          >
            {compareRunning ? 'Comparing...' : 'Compare Versions'}
          </button>
          <button
            onClick={onCombineVersions}
            disabled={isGenerating || compareRunning || combineRunning || copyEditRunning || versions.length < 2}
            style={{
              padding: '8px 14px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              cursor: isGenerating || compareRunning || combineRunning || copyEditRunning || versions.length < 2 ? 'not-allowed' : 'pointer',
              opacity: isGenerating || compareRunning || combineRunning || copyEditRunning || versions.length < 2 ? 0.6 : 1,
              fontSize: '12px',
            }}
          >
            {combineRunning ? 'Combining...' : 'Combine Versions'}
          </button>
          <button
            onClick={onCopyEdit}
            disabled={isGenerating || compareRunning || combineRunning || copyEditRunning || !item.assembledContent}
            title="Polish pass — smooths voice, trims to word count target, tightens prose. Produces a new version."
            style={{
              padding: '8px 14px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              cursor: isGenerating || compareRunning || combineRunning || copyEditRunning || !item.assembledContent ? 'not-allowed' : 'pointer',
              opacity: isGenerating || compareRunning || combineRunning || copyEditRunning || !item.assembledContent ? 0.6 : 1,
              fontSize: '12px',
            }}
          >
            {copyEditRunning ? 'Copy-editing...' : 'Copy-edit'}
          </button>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
          {versions.length < 2
            ? 'Create a new version first to enable comparison and combination.'
            : 'Compare produces an analysis report. Combine synthesizes all drafts into a new version. Copy-edit polishes the active version.'}
          {item.comparisonReport && !item.combineInstructions && (
            <span style={{ color: 'var(--warning-color, #e6a700)' }}>
              {' '}Combine instructions missing — combine will use generic criteria.
              {onUpdateCombineInstructions && (
                <button
                  onClick={() => {
                    setCombineInstructionsDraft('');
                    setEditingCombineInstructions(true);
                  }}
                  style={{
                    marginLeft: '6px',
                    padding: '1px 6px',
                    background: 'none',
                    border: '1px solid var(--border-color)',
                    borderRadius: '3px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  Set manually
                </button>
              )}
            </span>
          )}
          {item.combineInstructions && (
            <span style={{ color: 'var(--success-color, #4caf50)' }}>
              {' '}Combine instructions ready.
              {onUpdateCombineInstructions && (
                <button
                  onClick={() => {
                    setCombineInstructionsDraft(item.combineInstructions);
                    setEditingCombineInstructions(true);
                  }}
                  style={{
                    marginLeft: '6px',
                    padding: '1px 6px',
                    background: 'none',
                    border: '1px solid var(--border-color)',
                    borderRadius: '3px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  Edit
                </button>
              )}
            </span>
          )}
        </div>

        {/* Combine Instructions Editor */}
        {editingCombineInstructions && (
          <div style={{ marginTop: '8px' }}>
            <textarea
              value={combineInstructionsDraft}
              onChange={(e) => setCombineInstructionsDraft(e.target.value)}
              placeholder="Enter combine instructions — editorial direction for how to merge versions..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '8px',
                fontSize: '12px',
                lineHeight: 1.5,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <button
                onClick={() => {
                  onUpdateCombineInstructions(combineInstructionsDraft.trim());
                  setEditingCombineInstructions(false);
                }}
                disabled={!combineInstructionsDraft.trim()}
                style={{
                  padding: '3px 10px',
                  background: combineInstructionsDraft.trim() ? 'var(--accent-color, #6366f1)' : 'var(--bg-tertiary)',
                  border: 'none',
                  borderRadius: '4px',
                  color: combineInstructionsDraft.trim() ? '#fff' : 'var(--text-muted)',
                  cursor: combineInstructionsDraft.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '11px',
                }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingCombineInstructions(false)}
                style={{
                  padding: '3px 10px',
                  background: 'none',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                Cancel
              </button>
              {item.combineInstructions && (
                <button
                  onClick={() => {
                    onUpdateCombineInstructions('');
                    setEditingCombineInstructions(false);
                  }}
                  style={{
                    padding: '3px 10px',
                    background: 'none',
                    border: '1px solid var(--error-color, #ef4444)',
                    borderRadius: '4px',
                    color: 'var(--error-color, #ef4444)',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create New Version */}
      <div
        style={{
          marginBottom: '16px',
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>
          Create New Version
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
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
            style={{
              padding: '8px 16px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              cursor:
                isGenerating ||
                compareRunning ||
                combineRunning ||
                !item.generationSystemPrompt ||
                !item.generationUserPrompt
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                isGenerating ||
                compareRunning ||
                combineRunning ||
                !item.generationSystemPrompt ||
                !item.generationUserPrompt
                  ? 0.6
                  : 1,
              fontSize: '12px',
            }}
          >
            {isGenerating ? 'Generating...' : 'Regenerate with existing perspective'}
          </button>

          {/* Regenerate with new perspective */}
          <button
            onClick={() => onRegenerateFull?.()}
            disabled={isGenerating || compareRunning || combineRunning || !onRegenerateFull}
            title="Run fresh perspective synthesis with current world facts & tone (slower, may differ significantly)"
            style={{
              padding: '8px 16px',
              background: 'var(--accent-primary)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor:
                isGenerating || compareRunning || combineRunning || !onRegenerateFull
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                isGenerating || compareRunning || combineRunning || !onRegenerateFull ? 0.6 : 1,
              fontSize: '12px',
            }}
          >
            {isGenerating ? 'Generating...' : 'Regenerate with new perspective'}
          </button>

          {/* Regenerate with creative freedom (story format only) */}
          {onRegenerateCreative && (
            <button
              onClick={() => onRegenerateCreative?.()}
              disabled={isGenerating || compareRunning || combineRunning}
              title="Same PS, different generation prompt — neutral framing, softened structure, no craft posture. Reuses existing perspective synthesis."
              style={{
                padding: '8px 16px',
                background: '#b45309',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor:
                  isGenerating || compareRunning || combineRunning
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  isGenerating || compareRunning || combineRunning ? 0.6 : 1,
                fontSize: '12px',
              }}
            >
              {isGenerating ? 'Generating...' : 'Creative freedom'}
            </button>
          )}
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          <span style={{ fontWeight: 500 }}>LLM Config:</span>{' '}
          <span title="perspective.synthesis">perspective: {llmConfigDisplay.perspective}</span>
          {' · '}
          <span title="chronicle.generation">generation: {llmConfigDisplay.generation}</span>
          {(!item.generationSystemPrompt || !item.generationUserPrompt) && (
            <span style={{ color: 'var(--warning-color, #e6a700)', marginLeft: '8px' }}>
              Existing perspective unavailable (legacy chronicle).
            </span>
          )}
          {!onRegenerateFull && (
            <span style={{ color: 'var(--warning-color, #e6a700)', marginLeft: '8px' }}>
              New perspective requires toneFragments and canonFactsWithMetadata.
            </span>
          )}
        </div>
      </div>

      {/* Comparison Report */}
      {item.comparisonReport && (
        <div
          style={{
            marginBottom: '16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 500 }}>Comparison Report</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {item.comparisonReportGeneratedAt && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {new Date(item.comparisonReportGeneratedAt).toLocaleString()}
                </span>
              )}
              <button
                onClick={() => {
                  const blob = new Blob([item.comparisonReport], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `comparison-report-${item.chronicleId.slice(0, 20)}-${Date.now()}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{
                  padding: '2px 8px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                Export
              </button>
            </div>
          </div>
          <div
            style={{
              padding: '16px',
              maxHeight: '400px',
              overflowY: 'auto',
              fontSize: '13px',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              color: 'var(--text-primary)',
            }}
          >
            {item.comparisonReport}
          </div>
        </div>
      )}
    </div>
  );
}
