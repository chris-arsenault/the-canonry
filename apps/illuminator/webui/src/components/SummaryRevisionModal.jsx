/**
 * SummaryRevisionModal - Batch review UI for entity summary revisions
 *
 * Shows a modal with:
 * - Batch progress indicator
 * - Per-entity inline diff view (word-level, git-style)
 * - Accept/reject toggles per entity
 * - Export button for review
 * - Continue/cancel/apply controls
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { diffWords } from 'diff';
import { resolveAnchorPhrase } from '../lib/fuzzyAnchor';

// ============================================================================
// Inline Diff View (word-level, git-style)
// ============================================================================

function InlineDiff({ current, proposed, label }) {
  if (!proposed || proposed === current) return null;

  const changes = diffWords(current || '', proposed);

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 600,
        color: 'var(--text-muted)',
        marginBottom: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {label}
      </div>
      <div style={{
        padding: '10px 12px',
        background: 'var(--bg-tertiary)',
        borderRadius: '4px',
        border: '1px solid var(--border-color)',
        fontSize: '11px',
        lineHeight: '1.8',
        maxHeight: '300px',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {changes.map((part, i) => {
          if (part.added) {
            return (
              <span key={i} style={{
                background: 'rgba(34, 197, 94, 0.2)',
                color: 'var(--text-primary)',
                borderRadius: '2px',
                padding: '0 1px',
                textDecoration: 'none',
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
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Patch Card
// ============================================================================

// ============================================================================
// Anchor Phrase Editor (for chronicle backref linking)
// ============================================================================

function AnchorPhraseEditor({ patch, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(patch.anchorPhrase || '');

  // Sync when patch updates externally
  useEffect(() => {
    setValue(patch.anchorPhrase || '');
  }, [patch.anchorPhrase]);

  if (!patch.anchorPhrase && !editing) return null;

  const phraseInDescription = patch.anchorPhrase && patch.description &&
    resolveAnchorPhrase(patch.anchorPhrase, patch.description) !== null;

  if (editing) {
    return (
      <div style={{ marginBottom: '10px' }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 600,
          color: 'var(--text-muted)',
          marginBottom: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Anchor Phrase
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '11px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={() => {
              onUpdate(patch.entityId, value);
              setEditing(false);
            }}
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
          <button
            onClick={() => {
              setValue(patch.anchorPhrase || '');
              setEditing(false);
            }}
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 600,
        color: 'var(--text-muted)',
        marginBottom: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        Anchor Phrase
        {!phraseInDescription && (
          <span style={{ color: 'var(--warning, #f59e0b)', marginLeft: '6px', fontWeight: 400 }}>
            not found in description
          </span>
        )}
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 8px',
        background: 'var(--bg-tertiary)',
        borderRadius: '4px',
        border: '1px solid var(--border-color)',
        fontSize: '11px',
      }}>
        <span style={{
          flex: 1,
          fontStyle: 'italic',
          color: phraseInDescription ? 'var(--text-primary)' : 'var(--warning, #f59e0b)',
        }}>
          &ldquo;{patch.anchorPhrase}&rdquo;
        </span>
        <button
          onClick={() => setEditing(true)}
          style={{
            padding: '2px 6px',
            fontSize: '9px',
            border: '1px solid var(--border-color)',
            borderRadius: '3px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          Edit
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Patch Card
// ============================================================================

function PatchCard({ patch, currentEntity, accepted, onToggle, expanded, onToggleExpand, onUpdateAnchorPhrase }) {
  const hasSummaryChange = patch.summary && patch.summary !== currentEntity?.summary;
  const hasDescChange = patch.description && patch.description !== currentEntity?.description;

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: '6px',
      marginBottom: '6px',
      borderLeft: `3px solid ${accepted !== false ? 'var(--success-color, #22c55e)' : 'var(--text-muted)'}`,
      opacity: accepted === false ? 0.5 : 1,
    }}>
      {/* Header — always visible */}
      <div
        onClick={onToggleExpand}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {expanded ? '\u25BC' : '\u25B6'}
          </span>
          <span style={{ fontWeight: 600, fontSize: '12px' }}>{patch.entityName}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {patch.entityKind}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {[
              hasSummaryChange && 'summary',
              hasDescChange && 'description',
            ].filter(Boolean).join(' + ')}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(patch.entityId, accepted === false);
          }}
          style={{
            padding: '2px 8px',
            fontSize: '10px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            background: accepted !== false ? 'var(--success-color, #22c55e)' : 'var(--bg-tertiary)',
            color: accepted !== false ? '#fff' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          {accepted !== false ? 'Accepted' : 'Rejected'}
        </button>
      </div>

      {/* Expanded diff view */}
      {expanded && (
        <div style={{ padding: '0 12px 10px' }}>
          {hasSummaryChange && (
            <InlineDiff
              current={currentEntity?.summary || ''}
              proposed={patch.summary}
              label="Summary"
            />
          )}
          {hasDescChange && (
            <InlineDiff
              current={currentEntity?.description || ''}
              proposed={patch.description}
              label="Description"
            />
          )}
          {onUpdateAnchorPhrase && hasDescChange && (
            <AnchorPhraseEditor patch={patch} onUpdate={onUpdateAnchorPhrase} />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Export Helpers
// ============================================================================

function buildExportText(allPatches, entityLookup, patchDecisions) {
  const lines = [];
  for (const patch of allPatches) {
    const current = entityLookup.get(patch.entityId);
    const accepted = patchDecisions[patch.entityId] !== false;
    lines.push(`=== ${patch.entityName} (${patch.entityKind}) [${accepted ? 'ACCEPTED' : 'REJECTED'}] ===`);
    lines.push('');

    const hasSummaryChange = patch.summary && patch.summary !== current?.summary;
    const hasDescChange = patch.description && patch.description !== current?.description;

    if (hasSummaryChange) {
      lines.push('--- Summary ---');
      lines.push('CURRENT:');
      lines.push(current?.summary || '(empty)');
      lines.push('');
      lines.push('PROPOSED:');
      lines.push(patch.summary);
      lines.push('');
    }

    if (hasDescChange) {
      lines.push('--- Description ---');
      lines.push('CURRENT:');
      lines.push(current?.description || '(empty)');
      lines.push('');
      lines.push('PROPOSED:');
      lines.push(patch.description);
      lines.push('');
    }

    if (!hasSummaryChange && !hasDescChange) {
      lines.push('(no changes)');
      lines.push('');
    }

    lines.push('');
  }
  return lines.join('\n');
}

function downloadText(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// Main Modal
// ============================================================================

export default function SummaryRevisionModal({
  run,
  isActive,
  onContinue,
  onAutoContine,
  onTogglePatch,
  onAccept,
  onCancel,
  getEntityContexts,
  onUpdateAnchorPhrase,
}) {
  const scrollRef = useRef(null);
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Auto-scroll on new content
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [run?.batches?.length, run?.currentBatchIndex, run?.status]);

  // Reset expanded state when batch changes
  useEffect(() => {
    setExpandedIds(new Set());
  }, [run?.currentBatchIndex, run?.status]);

  // Build entity lookup from entity contexts
  const entityLookup = useMemo(() => {
    if (!run || !getEntityContexts) return new Map();
    const allIds = run.batches.flatMap((b) => b.entityIds);
    const contexts = getEntityContexts(allIds);
    const map = new Map();
    for (const ctx of contexts) {
      if (ctx) map.set(ctx.id, ctx);
    }
    return map;
  }, [run, getEntityContexts]);

  if (!isActive || !run) return null;

  const isGenerating = run.status === 'generating' || run.status === 'pending';
  const isBatchReviewing = run.status === 'batch_reviewing';
  const isRunReviewing = run.status === 'run_reviewing';
  const isFailed = run.status === 'failed';

  const currentBatch = run.batches[run.currentBatchIndex];
  const totalBatches = run.batches.length;
  const completedBatches = run.batches.filter((b) => b.status === 'complete' || b.status === 'failed').length;

  // Collect patches for display
  const allPatches = isRunReviewing
    ? run.batches.flatMap((b) => b.patches || [])
    : (currentBatch?.patches || []);

  const acceptedCount = allPatches.filter((p) => run.patchDecisions[p.entityId] !== false).length;

  const toggleExpand = (entityId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) next.delete(entityId);
      else next.add(entityId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(allPatches.map((p) => p.entityId)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleExport = () => {
    const text = buildExportText(allPatches, entityLookup, run.patchDecisions);
    const timestamp = Date.now();
    downloadText(text, `revision-patches-${timestamp}.txt`);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.6)',
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        width: '900px',
        maxWidth: '95vw',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px' }}>
              Batch Revision
              {currentBatch && !isRunReviewing && (
                <span style={{ fontWeight: 400, fontSize: '13px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  {currentBatch.culture}
                </span>
              )}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              {isRunReviewing
                ? `All ${totalBatches} batches complete. Review and apply patches.`
                : `Batch ${run.currentBatchIndex + 1} of ${totalBatches}`
              }
              {completedBatches > 0 && !isRunReviewing && ` (${completedBatches} complete)`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {run.totalActualCost > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                ${run.totalActualCost.toFixed(4)}
              </span>
            )}
            <button
              onClick={onCancel}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 12px', fontSize: '12px' }}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 20px',
          minHeight: 0,
        }}>
          {isGenerating && (
            <div style={{
              padding: '40px 12px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}>
              <div style={{ marginBottom: '8px' }}>Generating revisions for batch {run.currentBatchIndex + 1}...</div>
              {currentBatch && (
                <div style={{ fontSize: '10px' }}>
                  {currentBatch.culture} ({currentBatch.entityIds.length} entities)
                </div>
              )}
            </div>
          )}

          {isFailed && currentBatch?.error && (
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '6px',
              borderLeft: '3px solid var(--danger)',
              fontSize: '12px',
              color: 'var(--danger)',
              marginBottom: '8px',
            }}>
              {currentBatch.error}
            </div>
          )}

          {/* Patches */}
          {allPatches.length > 0 && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>
                  {allPatches.length} entities revised
                  <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    {acceptedCount} accepted
                  </span>
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleExport}
                    style={{
                      padding: '2px 8px',
                      fontSize: '10px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Export
                  </button>
                  <button
                    onClick={expandAll}
                    style={{
                      padding: '2px 8px',
                      fontSize: '10px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Expand all
                  </button>
                  <button
                    onClick={collapseAll}
                    style={{
                      padding: '2px 8px',
                      fontSize: '10px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Collapse all
                  </button>
                </div>
              </div>
              {allPatches.map((patch) => (
                <PatchCard
                  key={patch.entityId}
                  patch={patch}
                  currentEntity={entityLookup.get(patch.entityId)}
                  accepted={run.patchDecisions[patch.entityId]}
                  onToggle={onTogglePatch}
                  expanded={expandedIds.has(patch.entityId)}
                  onToggleExpand={() => toggleExpand(patch.entityId)}
                  onUpdateAnchorPhrase={onUpdateAnchorPhrase}
                />
              ))}
            </div>
          )}

          {(isBatchReviewing || isRunReviewing) && allPatches.length === 0 && (
            <div style={{
              padding: '20px 12px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}>
              No changes suggested for this batch.
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px 16px',
          borderTop: '1px solid var(--border-color)',
          flexShrink: 0,
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}>
          {isBatchReviewing && (
            <>
              <button
                onClick={onAutoContine}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                Auto-Continue All
              </button>
              <button
                onClick={onContinue}
                className="illuminator-button illuminator-button-primary"
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                {run.currentBatchIndex + 1 < totalBatches
                  ? `Continue to Batch ${run.currentBatchIndex + 2}`
                  : 'Finish Review'
                }
              </button>
            </>
          )}
          {isRunReviewing && (
            <button
              onClick={onAccept}
              className="illuminator-button illuminator-button-primary"
              style={{ padding: '6px 16px', fontSize: '12px' }}
            >
              Apply Accepted ({acceptedCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
