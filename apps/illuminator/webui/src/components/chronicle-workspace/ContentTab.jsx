import { useMemo } from 'react';
import { diffWords } from 'diff';
import ChronicleVersionSelector from './ChronicleVersionSelector';

// ============================================================================
// Assembled Content Viewer (local)
// ============================================================================

function AssembledContentViewer({ content, wordCount, onCopy, compareContent, compareLabel }) {
  const diffParts = useMemo(() => {
    if (!compareContent) return null;
    return diffWords(compareContent, content);
  }, [content, compareContent]);

  return (
    <div
      style={{
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
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {wordCount.toLocaleString()} words
          {diffParts && (
            <span style={{ marginLeft: '8px' }}>
              &mdash; diff vs {compareLabel}
              <span style={{ marginLeft: '6px', color: 'rgba(34, 197, 94, 0.8)' }}>
                +{diffParts.filter(p => p.added).reduce((n, p) => n + p.value.split(/\s+/).filter(Boolean).length, 0)}
              </span>
              <span style={{ marginLeft: '4px', color: 'rgba(239, 68, 68, 0.8)' }}>
                -{diffParts.filter(p => p.removed).reduce((n, p) => n + p.value.split(/\s+/).filter(Boolean).length, 0)}
              </span>
            </span>
          )}
        </span>
        <button
          onClick={onCopy}
          style={{
            padding: '4px 12px',
            fontSize: '11px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
        >
          Copy
        </button>
      </div>
      <div
        style={{
          padding: '20px',
          maxHeight: '600px',
          overflowY: 'auto',
          fontSize: '14px',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          color: 'var(--text-primary)',
        }}
      >
        {diffParts ? (
          diffParts.map((part, i) => {
            if (part.added) {
              return (
                <span key={i} style={{
                  background: 'rgba(34, 197, 94, 0.2)',
                  color: 'var(--text-primary)',
                  borderRadius: '2px',
                  padding: '0 1px',
                }}>
                  {part.value}
                </span>
              );
            }
            if (part.removed) {
              return (
                <span key={i} style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: 'var(--text-secondary)',
                  borderRadius: '2px',
                  padding: '0 1px',
                  textDecoration: 'line-through',
                }}>
                  {part.value}
                </span>
              );
            }
            return <span key={i}>{part.value}</span>;
          })
        ) : (
          content
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Content Tab
// ============================================================================

export default function ContentTab({
  item,
  isComplete,
  versions,
  selectedVersion,
  compareToVersion,
  selectedVersionId,
  compareToVersionId,
  activeVersionId,
  onSelectVersion,
  onSelectCompareVersion,
  onSetActiveVersion,
  isGenerating,
}) {
  const content = isComplete
    ? item.finalContent
    : (selectedVersion?.content || item.assembledContent);

  const wc = isComplete
    ? (item.finalContent?.split(/\s+/).filter(Boolean).length || 0)
    : (selectedVersion?.wordCount ?? (item.assembledContent?.split(/\s+/).filter(Boolean).length || 0));

  const copyToClipboard = (text) => navigator.clipboard.writeText(text);

  return (
    <div>
      {/* Version selector for assembly mode */}
      {!isComplete && versions && versions.length > 1 && (
        <div style={{ marginBottom: '16px' }}>
          <ChronicleVersionSelector
            versions={versions}
            selectedVersionId={selectedVersionId}
            activeVersionId={activeVersionId}
            compareToVersionId={compareToVersionId}
            onSelectVersion={onSelectVersion}
            onSelectCompareVersion={onSelectCompareVersion}
            onSetActiveVersion={onSetActiveVersion}
            disabled={isGenerating}
          />
        </div>
      )}

      <AssembledContentViewer
        content={content}
        wordCount={wc}
        onCopy={() => copyToClipboard(content)}
        compareContent={!isComplete ? compareToVersion?.content : undefined}
        compareLabel={!isComplete ? compareToVersion?.shortLabel : undefined}
      />
    </div>
  );
}
