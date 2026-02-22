/**
 * EraNarrativeViewer — Workspace viewer for a completed era narrative.
 *
 * Loads the full EraNarrativeRecord from IndexedDB and displays:
 * 1. Header: title, era name, tone, word count, cost
 * 2. Version selector: switch between generate/edit versions, delete, set active
 * 3. Narrative prose (primary content, dominates the view)
 * 4. Thread Synthesis (collapsible): thesis, threads, movements, motifs, images
 * 5. Source Briefs (collapsible): per-chronicle prep inputs
 * 6. Cost/model metadata footer
 * 7. Actions: re-run copy edit, export
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  getEraNarrative,
  updateEraNarrative,
  resolveActiveContent,
  deleteEraNarrativeVersion,
  setEraNarrativeActiveVersion,
} from '../lib/db/eraNarrativeRepository';
import { downloadEraNarrativeExport } from '../lib/chronicleExport';
import type { EraNarrativeRecord } from '../lib/eraNarrativeTypes';
import type { EnrichmentType } from '../lib/enrichmentTypes';

interface EraNarrativeViewerProps {
  narrativeId: string;
  onEnqueue: (items: Array<{
    entity: { id: string; name: string; kind: string; subtype: string; prominence: string; culture: string; status: string; description: string; tags: Record<string, unknown> };
    type: EnrichmentType;
    prompt: string;
    chronicleId?: string;
  }>) => void;
}

const POLL_INTERVAL_MS = 2000;

export default function EraNarrativeViewer({ narrativeId, onEnqueue }: EraNarrativeViewerProps) {
  const [record, setRecord] = useState<EraNarrativeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showThreads, setShowThreads] = useState(false);
  const [showBriefs, setShowBriefs] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load record from IndexedDB
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getEraNarrative(narrativeId).then((r) => {
      if (cancelled) return;
      setRecord(r ?? null);
      setLoading(false);
      setSelectedVersionId('');
      setConfirmingDeleteId(null);
    });
    return () => { cancelled = true; };
  }, [narrativeId]);

  // Stop polling helper
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  // Poll while generating (for re-run copy edit)
  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const updated = await getEraNarrative(narrativeId);
      if (!updated) return;
      setRecord(updated);

      if (updated.status === 'complete' || updated.status === 'failed' || updated.status === 'step_complete') {
        // If step_complete from edit, mark complete automatically
        if (updated.status === 'step_complete' && updated.currentStep === 'edit') {
          await updateEraNarrative(updated.narrativeId, { status: 'complete' });
          const final = await getEraNarrative(narrativeId);
          if (final) setRecord(final);
        }
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [narrativeId, stopPolling]);

  const threadNameMap = useMemo(() => {
    if (!record?.threadSynthesis) return {};
    const map: Record<string, string> = {};
    for (const t of record.threadSynthesis.threads) {
      map[t.threadId] = t.name;
    }
    return map;
  }, [record?.threadSynthesis]);

  // Resolve versioned content
  const resolved = useMemo(() => {
    if (!record) return { content: undefined, versions: [], activeVersionId: undefined };
    return resolveActiveContent(record);
  }, [record]);

  // Sync selectedVersionId to activeVersionId
  useEffect(() => {
    if (resolved.activeVersionId) {
      if (!selectedVersionId || !resolved.versions.some((v) => v.versionId === selectedVersionId)) {
        setSelectedVersionId(resolved.activeVersionId);
      }
    }
  }, [resolved.activeVersionId, resolved.versions.length]);

  const viewedVersion = resolved.versions.find((v) => v.versionId === selectedVersionId)
    || resolved.versions[resolved.versions.length - 1];
  const viewedContent = viewedVersion?.content || resolved.content;
  const viewedWordCount = viewedVersion?.wordCount || 0;

  // Actions
  const handleExport = useCallback(() => {
    if (!record) return;
    try {
      downloadEraNarrativeExport(record);
    } catch (err) {
      console.error('[EraNarrativeViewer] Export failed:', err);
    }
  }, [record]);

  const handleRerunCopyEdit = useCallback(async () => {
    if (!record) return;
    await updateEraNarrative(record.narrativeId, {
      status: 'pending',
      currentStep: 'edit',
    });
    setSelectedVersionId('');

    // Dispatch worker task
    const sentinelEntity = {
      id: '__era_narrative__',
      name: 'Era Narrative',
      kind: 'system',
      subtype: '',
      prominence: '',
      culture: '',
      status: 'active',
      description: '',
      tags: {},
    };
    onEnqueue([{
      entity: sentinelEntity,
      type: 'eraNarrative' as EnrichmentType,
      prompt: '',
      chronicleId: record.narrativeId,
    }]);

    // Refresh record and start polling
    const updated = await getEraNarrative(record.narrativeId);
    if (updated) setRecord(updated);
    startPolling();
  }, [record, onEnqueue, startPolling]);

  const handleDeleteVersion = useCallback(async (versionId: string) => {
    if (!record) return;
    const updated = await deleteEraNarrativeVersion(record.narrativeId, versionId);
    setRecord(updated);
    setConfirmingDeleteId(null);
    if (updated.activeVersionId) setSelectedVersionId(updated.activeVersionId);
  }, [record]);

  const handleSetActiveVersion = useCallback(async (versionId: string) => {
    if (!record) return;
    const updated = await setEraNarrativeActiveVersion(record.narrativeId, versionId);
    setRecord(updated);
  }, [record]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)' }}>
        Loading era narrative...
      </div>
    );
  }

  if (!record) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)' }}>
        Era narrative not found
      </div>
    );
  }

  const synthesis = record.threadSynthesis;
  const isGenerating = record.status === 'pending' || record.status === 'generating';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%' }}>

      {/* Header */}
      <div style={{
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600 }}>
              {record.eraName}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
            <span style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'rgba(217, 119, 6, 0.12)',
              color: '#d97706',
              fontWeight: 500,
            }}>
              {record.tone}
            </span>
            {viewedWordCount > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {viewedWordCount.toLocaleString()} words
              </span>
            )}
            <button
              onClick={handleExport}
              title="Export era narrative as JSON (threads, quotes, briefs, draft & edited versions)"
              style={{
                background: 'none',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '3px 10px',
                fontSize: '11px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Version Selector + Actions */}
      {resolved.versions.length > 0 && !isGenerating && (
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={selectedVersionId || resolved.activeVersionId || ''}
            onChange={(e) => {
              setSelectedVersionId(e.target.value);
              setConfirmingDeleteId(null);
            }}
            className="illuminator-select"
            style={{ width: 'auto', minWidth: '240px', fontSize: '12px', padding: '4px 6px' }}
          >
            {resolved.versions.map((v) => {
              const date = new Date(v.generatedAt);
              const timeStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                + ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
              const stepLabel = v.step === 'generate' ? 'Draft' : 'Edit';
              return (
                <option key={v.versionId} value={v.versionId}>
                  {stepLabel} — {v.wordCount.toLocaleString()} words — {timeStr}
                </option>
              );
            })}
          </select>

          {/* Active badge or Make Active button */}
          {viewedVersion && viewedVersion.versionId === resolved.activeVersionId ? (
            <span style={{
              fontSize: '11px', padding: '2px 8px',
              background: 'rgba(16, 185, 129, 0.15)', color: '#10b981',
              borderRadius: '999px', fontWeight: 500,
            }}>
              Active
            </span>
          ) : viewedVersion ? (
            <button
              onClick={() => {
                handleSetActiveVersion(viewedVersion.versionId);
                setConfirmingDeleteId(null);
              }}
              className="illuminator-button"
              style={{ padding: '2px 8px', fontSize: '11px' }}
            >
              Make Active
            </button>
          ) : null}

          {/* Delete version button (cannot delete generate versions) */}
          {viewedVersion && viewedVersion.step !== 'generate' && (() => {
            const isConfirming = confirmingDeleteId === viewedVersion.versionId;
            return (
              <button
                onClick={() => {
                  if (isConfirming) {
                    handleDeleteVersion(viewedVersion.versionId);
                  } else {
                    setConfirmingDeleteId(viewedVersion.versionId);
                  }
                }}
                onBlur={() => setConfirmingDeleteId(null)}
                className="illuminator-button"
                style={{
                  padding: '2px 8px', fontSize: '11px',
                  background: isConfirming ? '#ef4444' : undefined,
                  color: isConfirming ? '#fff' : 'var(--text-muted)',
                  borderColor: isConfirming ? '#ef4444' : undefined,
                }}
                title={isConfirming ? 'Click again to confirm' : 'Delete this version'}
              >
                {isConfirming ? 'Confirm Delete' : 'Delete'}
              </button>
            );
          })()}

          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={handleRerunCopyEdit}
              className="illuminator-button"
              style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 500 }}
              title="Re-run copy edit on the latest version"
            >
              Re-run Copy Edit
            </button>
          </div>
        </div>
      )}

      {/* Generating indicator */}
      {isGenerating && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '12px',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '6px',
          fontSize: '13px',
          color: '#d97706',
          textAlign: 'center',
        }}>
          {record.currentStep === 'edit' ? 'Running copy edit...' : `Running ${record.currentStep} step...`}
        </div>
      )}

      {/* Narrative Prose — primary content */}
      {viewedContent ? (
        <div style={{
          padding: '20px 24px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          fontSize: '14px',
          lineHeight: '1.75',
          whiteSpace: 'pre-wrap',
          color: 'var(--text-secondary)',
          marginBottom: '20px',
          overflow: 'auto',
          flex: '1 1 0',
          minHeight: '200px',
        }}>
          {viewedContent}
        </div>
      ) : (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          marginBottom: '20px',
        }}>
          No narrative content generated yet.
        </div>
      )}

      {/* Thread Synthesis — collapsible */}
      {synthesis && (
        <div style={{ marginBottom: '16px' }}>
          <div
            onClick={() => setShowThreads(!showThreads)}
            style={{
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid var(--border-color)',
              marginBottom: showThreads ? '12px' : '0',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              Thread Synthesis ({synthesis.threads.length} threads{synthesis.movements?.length ? `, ${synthesis.movements.length} movements` : ''})
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {showThreads ? '\u25B4' : '\u25BE'}
            </span>
          </div>

          {showThreads && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Thesis */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Thesis</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6 }}>
                  {synthesis.thesis}
                </div>
              </div>

              {/* Threads */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Threads
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {synthesis.threads.map((t) => (
                    <div key={t.threadId} style={{
                      padding: '10px 12px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{t.name}</span>
                        {t.register && (
                          <span style={{ fontSize: '11px', color: '#8b7355', fontStyle: 'italic' }}>{t.register}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {t.description}
                      </div>
                      {t.arc && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                          {t.arc}
                        </div>
                      )}
                      {t.culturalActors?.length > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Cultural actors: {t.culturalActors.join(', ')}
                        </div>
                      )}
                      {t.material && (
                        <details style={{ marginTop: '6px' }}>
                          <summary style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            Material
                          </summary>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5, paddingLeft: '10px', borderLeft: '2px solid var(--border-color)' }}>
                            {t.material}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Counterweight */}
              {synthesis.counterweight && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Counterweight</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {synthesis.counterweight}
                  </div>
                </div>
              )}

              {/* Strategic Dynamics */}
              {synthesis.strategicDynamics && synthesis.strategicDynamics.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Strategic Dynamics ({synthesis.strategicDynamics.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {synthesis.strategicDynamics.map((sd, i) => (
                      <div key={i} style={{
                        padding: '8px 12px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                      }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {sd.interaction} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '12px' }}>[{sd.actors?.join(', ')}]</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                          {sd.dynamic}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quotes */}
              {synthesis.quotes && synthesis.quotes.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Quotes ({synthesis.quotes.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {synthesis.quotes.map((q, i) => (
                      <div key={i} style={{
                        padding: '8px 12px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                      }}>
                        <div style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                          &ldquo;{q.text}&rdquo;
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {q.origin}. {q.context}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Movement Plan */}
              {synthesis.movements && synthesis.movements.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Movement Plan
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {synthesis.movements.map((m) => (
                      <div key={m.movementIndex} style={{
                        padding: '8px 12px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 500 }}>Movement {m.movementIndex + 1}</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            Y{m.yearRange[0]}&ndash;Y{m.yearRange[1]}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                          {m.threadFocus.map(id => threadNameMap[id] || id).join(', ')}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                          {m.beats}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Motifs */}
              {(synthesis.motifs?.length ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Motifs
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {(synthesis.motifs || []).join(' \u00B7 ')}
                  </div>
                </div>
              )}

              {/* Opening / Closing Images */}
              {(synthesis.openingImage || synthesis.closingImage) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {synthesis.openingImage && (
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Opening Image</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        {synthesis.openingImage}
                      </div>
                    </div>
                  )}
                  {synthesis.closingImage && (
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Closing Image</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        {synthesis.closingImage}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Source Briefs — collapsible */}
      {record.prepBriefs.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div
            onClick={() => setShowBriefs(!showBriefs)}
            style={{
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid var(--border-color)',
              marginBottom: showBriefs ? '12px' : '0',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              Source Briefs ({record.prepBriefs.length} chronicles)
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {showBriefs ? '\u25B4' : '\u25BE'}
            </span>
          </div>

          {showBriefs && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {record.prepBriefs.map((brief) => (
                <div key={brief.chronicleId} style={{
                  padding: '10px 12px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>
                      {brief.chronicleTitle}
                    </span>
                    {brief.eraYear != null && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Y{brief.eraYear}
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    maxHeight: '120px',
                    overflow: 'auto',
                  }}>
                    {brief.prep}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cost / Model Metadata */}
      <div style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        padding: '8px 0',
        fontSize: '11px',
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border-color)',
        marginTop: 'auto',
      }}>
        {record.totalActualCost > 0 && (
          <span title="Total cost">${record.totalActualCost.toFixed(4)}</span>
        )}
        {record.totalInputTokens > 0 && (
          <span title="Total input tokens">{record.totalInputTokens.toLocaleString()} in</span>
        )}
        {record.totalOutputTokens > 0 && (
          <span title="Total output tokens">{record.totalOutputTokens.toLocaleString()} out</span>
        )}
        {synthesis && (
          <span title="Thread synthesis model">{synthesis.model}</span>
        )}
        <span style={{ marginLeft: 'auto' }}>
          {new Date(record.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
