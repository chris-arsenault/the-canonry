import { useMemo, useState, useRef, useCallback } from 'react';
import { diffWords } from 'diff';
import ChronicleVersionSelector from './ChronicleVersionSelector';

// ============================================================================
// Assembled Content Viewer (local)
// ============================================================================

function AssembledContentViewer({ content, wordCount, onCopy, compareContent, compareLabel, onQuickCheck, quickCheckRunning, quickCheckReport, onShowQuickCheck, onFindReplace }) {
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
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {onQuickCheck && (
            <>
              <button
                onClick={onQuickCheck}
                disabled={quickCheckRunning || !content}
                title="Check for unanchored entity references (names not in cast or name bank)"
                style={{
                  padding: '4px 12px',
                  fontSize: '11px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: quickCheckRunning || !content ? 'not-allowed' : 'pointer',
                  color: 'var(--text-secondary)',
                  opacity: quickCheckRunning || !content ? 0.6 : 1,
                }}
              >
                {quickCheckRunning ? 'Checking...' : 'Quick Check'}
              </button>
              {quickCheckReport && (
                <span
                  onClick={onShowQuickCheck}
                  style={{
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: quickCheckReport.assessment === 'clean' ? '#22c55e'
                      : quickCheckReport.assessment === 'minor' ? '#f59e0b' : '#ef4444',
                  }}
                  title={`Quick check: ${quickCheckReport.assessment} (${quickCheckReport.suspects.length} suspects)`}
                >
                  {quickCheckReport.assessment === 'clean'
                    ? '\u2713'
                    : `\u26A0 ${quickCheckReport.suspects.length}`}
                </span>
              )}
            </>
          )}
          {onFindReplace && (
            <button
              onClick={onFindReplace}
              title="Find and replace text across all versions"
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
              Find/Replace
            </button>
          )}
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
  onDeleteVersion,
  isGenerating,
  onQuickCheck,
  quickCheckRunning,
  onShowQuickCheck,
  onFindReplace,
  onDetectTertiaryCast,
  onToggleTertiaryCast,
}) {
  const content = isComplete
    ? item.finalContent
    : (selectedVersion?.content || item.assembledContent);

  const wc = isComplete
    ? (item.finalContent?.split(/\s+/).filter(Boolean).length || 0)
    : (selectedVersion?.wordCount ?? (item.assembledContent?.split(/\s+/).filter(Boolean).length || 0));

  const copyToClipboard = (text) => navigator.clipboard.writeText(text);

  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [tertiaryCastExpanded, setTertiaryCastExpanded] = useState(false);
  const [hoveredTertiaryId, setHoveredTertiaryId] = useState(null);
  const hoverTimeoutRef = useRef(null);

  const handleTertiaryMouseEnter = useCallback((entityId) => {
    clearTimeout(hoverTimeoutRef.current);
    setHoveredTertiaryId(entityId);
  }, []);
  const handleTertiaryMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => setHoveredTertiaryId(null), 150);
  }, []);

  return (
    <div>
      {/* Summary (collapsible) */}
      {item.summary && (
        <div style={{
          marginBottom: '12px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          <div
            onClick={() => setSummaryExpanded(v => !v)}
            style={{
              padding: '8px 16px',
              background: 'var(--bg-tertiary)',
              borderBottom: summaryExpanded ? '1px solid var(--border-color)' : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'inline-block', width: '14px', fontSize: '10px' }}>
                {summaryExpanded ? '\u25BC' : '\u25B6'}
              </span>
              Summary
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.summary); }}
              style={{
                padding: '2px 10px',
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
          {summaryExpanded && (
            <div style={{
              padding: '12px 16px',
              fontSize: '13px',
              lineHeight: 1.6,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
            }}>
              {item.summary}
            </div>
          )}
        </div>
      )}

      {/* Tertiary cast — entities mentioned but not in declared cast (persisted) */}
      <div style={{
        marginBottom: '12px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        position: 'relative',
        zIndex: 10,
      }}>
        <div
          onClick={() => item.tertiaryCast?.length > 0 && setTertiaryCastExpanded(v => !v)}
          style={{
            padding: '8px 16px',
            background: 'var(--bg-tertiary)',
            borderBottom: tertiaryCastExpanded && item.tertiaryCast?.length > 0 ? '1px solid var(--border-color)' : 'none',
            borderRadius: tertiaryCastExpanded && item.tertiaryCast?.length > 0 ? '8px 8px 0 0' : '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: item.tertiaryCast?.length > 0 ? 'pointer' : 'default',
            userSelect: 'none',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {item.tertiaryCast?.length > 0 && (
              <span style={{ display: 'inline-block', width: '14px', fontSize: '10px' }}>
                {tertiaryCastExpanded ? '\u25BC' : '\u25B6'}
              </span>
            )}
            Tertiary Cast
            {item.tertiaryCast?.length > 0 && (
              <span style={{ marginLeft: '6px', color: 'var(--text-muted)' }}>
                {item.tertiaryCast.filter(e => e.accepted).length}/{item.tertiaryCast.length}
              </span>
            )}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDetectTertiaryCast?.(); }}
            disabled={!content}
            style={{
              padding: '2px 10px',
              fontSize: '11px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: content ? 'pointer' : 'not-allowed',
              color: 'var(--text-secondary)',
              opacity: content ? 1 : 0.5,
            }}
          >
            {item.tertiaryCast ? 'Re-detect' : 'Detect'}
          </button>
        </div>
        {tertiaryCastExpanded && item.tertiaryCast?.length > 0 && (
          <div style={{ padding: '8px 16px' }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
            }}>
              {item.tertiaryCast.map((entry) => {
                const isHovered = hoveredTertiaryId === entry.entityId;
                // Build context snippet from content if we have match positions
                let contextSnippet = null;
                if (isHovered && content && entry.matchStart != null && entry.matchEnd != null) {
                  const radius = 80;
                  const snippetStart = Math.max(0, entry.matchStart - radius);
                  const snippetEnd = Math.min(content.length, entry.matchEnd + radius);
                  const before = (snippetStart > 0 ? '\u2026' : '') + content.slice(snippetStart, entry.matchStart);
                  const matched = content.slice(entry.matchStart, entry.matchEnd);
                  const after = content.slice(entry.matchEnd, snippetEnd) + (snippetEnd < content.length ? '\u2026' : '');
                  contextSnippet = { before, matched, after };
                }
                return (
                  <span
                    key={entry.entityId}
                    style={{ position: 'relative', display: 'inline-block' }}
                    onMouseEnter={() => handleTertiaryMouseEnter(entry.entityId)}
                    onMouseLeave={handleTertiaryMouseLeave}
                  >
                    <span
                      onClick={() => onToggleTertiaryCast?.(entry.entityId)}
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        background: entry.accepted ? 'var(--bg-primary)' : 'transparent',
                        border: '1px solid var(--border-color)',
                        borderRadius: '3px',
                        color: entry.accepted ? 'var(--text-secondary)' : 'var(--text-muted)',
                        opacity: entry.accepted ? 1 : 0.5,
                        textDecoration: entry.accepted ? 'none' : 'line-through',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      {entry.name}
                      <span style={{ marginLeft: '4px', fontSize: '9px', color: 'var(--text-muted)' }}>
                        {entry.kind}
                      </span>
                    </span>
                    {isHovered && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginBottom: '6px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                        zIndex: 100,
                        minWidth: '200px',
                        maxWidth: '360px',
                        pointerEvents: 'none',
                      }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{entry.kind}</span>
                          <span>click to {entry.accepted ? 'reject' : 'accept'}</span>
                        </div>
                        {contextSnippet ? (
                          <div style={{
                            fontSize: '11px',
                            lineHeight: 1.5,
                            color: 'var(--text-secondary)',
                            wordBreak: 'break-word',
                          }}>
                            {contextSnippet.before}
                            <span style={{
                              background: 'rgba(245, 158, 11, 0.2)',
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                              borderRadius: '2px',
                              padding: '0 1px',
                            }}>{contextSnippet.matched}</span>
                            {contextSnippet.after}
                          </div>
                        ) : entry.matchedAs !== entry.name ? (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            matched as &ldquo;<span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{entry.matchedAs}</span>&rdquo;
                          </div>
                        ) : null}
                        <div style={{
                          position: 'absolute',
                          bottom: '-4px',
                          left: '50%',
                          transform: 'translateX(-50%) rotate(45deg)',
                          width: '8px',
                          height: '8px',
                          background: 'var(--bg-primary)',
                          borderRight: '1px solid var(--border-color)',
                          borderBottom: '1px solid var(--border-color)',
                        }} />
                      </div>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

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
            onDeleteVersion={onDeleteVersion}
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
        onQuickCheck={onQuickCheck}
        quickCheckRunning={quickCheckRunning}
        quickCheckReport={item.quickCheckReport}
        onShowQuickCheck={onShowQuickCheck}
        onFindReplace={onFindReplace}
      />
    </div>
  );
}
