/**
 * EraNarrativeViewer — Read-only viewer for a completed era narrative.
 *
 * Loads the full EraNarrativeRecord from IndexedDB and displays:
 * 1. Header: title, era name, tone, word count, cost
 * 2. Narrative prose (primary content, dominates the view)
 * 3. Thread Synthesis (collapsible): thesis, threads, movements, motifs, images
 * 4. Source Briefs (collapsible): per-chronicle prep inputs
 * 5. Cost/model metadata footer
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getEraNarrative } from '../lib/db/eraNarrativeRepository';
import { downloadEraNarrativeExport } from '../lib/chronicleExport';
import type { EraNarrativeRecord } from '../lib/eraNarrativeTypes';

interface EraNarrativeViewerProps {
  narrativeId: string;
}

export default function EraNarrativeViewer({ narrativeId }: EraNarrativeViewerProps) {
  const [record, setRecord] = useState<EraNarrativeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showThreads, setShowThreads] = useState(false);
  const [showBriefs, setShowBriefs] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getEraNarrative(narrativeId).then((r) => {
      if (cancelled) return;
      setRecord(r ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [narrativeId]);

  const threadNameMap = useMemo(() => {
    if (!record?.threadSynthesis) return {};
    const map: Record<string, string> = {};
    for (const t of record.threadSynthesis.threads) {
      map[t.threadId] = t.name;
    }
    return map;
  }, [record?.threadSynthesis]);

  const handleExport = useCallback(() => {
    console.log('[EraNarrativeViewer] Export clicked, record:', !!record);
    if (!record) return;
    try {
      downloadEraNarrativeExport(record);
      console.log('[EraNarrativeViewer] Export completed');
    } catch (err) {
      console.error('[EraNarrativeViewer] Export failed:', err);
    }
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
  const narrativeContent = record.narrative;
  const displayContent = narrativeContent?.editedContent || narrativeContent?.content;
  const wordCount = narrativeContent?.editedWordCount || narrativeContent?.wordCount || 0;

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
            {wordCount > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {wordCount.toLocaleString()} words
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

      {/* Narrative Prose — primary content */}
      {displayContent ? (
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
          {displayContent}
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
        {narrativeContent && narrativeContent.model !== synthesis?.model && (
          <span title="Narrative model">{narrativeContent.model}</span>
        )}
        <span style={{ marginLeft: 'auto' }}>
          {new Date(record.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
