/**
 * InterleavedAnnotationModal — Progress display for interleaved chronicle + entity annotation.
 *
 * Three phases: confirmation → processing → terminal.
 * Confirmation shows grouped work list: chronicles with entity clusters indented below.
 */

import { useEffect } from 'react';
import { TONE_META } from './HistorianToneSelector';
import { useFloatingPillStore } from '../lib/db/floatingPillStore';

const PILL_ID = 'interleaved-annotation';

export default function InterleavedAnnotationModal({ progress, onConfirm, onCancel, onClose }) {
  const isMinimized = useFloatingPillStore((s) => s.isMinimized(PILL_ID));

  useEffect(() => {
    if (!isMinimized || !progress) return;
    const statusColor = progress.status === 'running' ? '#f59e0b'
      : progress.status === 'complete' ? '#10b981'
      : progress.status === 'failed' ? '#ef4444'
      : '#6b7280';
    const statusText = progress.status === 'running'
      ? `${progress.processedItems}/${progress.totalItems}`
      : progress.status;
    useFloatingPillStore.getState().updatePill(PILL_ID, { statusText, statusColor });
  }, [isMinimized, progress?.status, progress?.processedItems]);

  useEffect(() => {
    if (!progress || progress.status === 'idle') {
      useFloatingPillStore.getState().remove(PILL_ID);
    }
  }, [progress?.status]);

  if (!progress || progress.status === 'idle') return null;
  if (isMinimized) return null;

  const isConfirming = progress.status === 'confirming';
  const isTerminal = progress.status === 'complete' || progress.status === 'cancelled' || progress.status === 'failed';

  const globalPercent = progress.totalItems > 0
    ? Math.round((progress.processedItems / progress.totalItems) * 100)
    : 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        width: isConfirming ? '560px' : '480px',
        maxWidth: '95vw',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '16px' }}>
              Interleaved Annotation
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!isConfirming && (
                <button
                  onClick={() => useFloatingPillStore.getState().minimize({
                    id: PILL_ID,
                    label: 'Interleaved Annotation',
                    statusText: progress.status === 'running'
                      ? `${progress.processedItems}/${progress.totalItems}`
                      : progress.status,
                    statusColor: progress.status === 'running' ? '#f59e0b' : progress.status === 'complete' ? '#10b981' : '#ef4444',
                  })}
                  className="illuminator-button"
                  style={{ padding: '2px 8px', fontSize: '11px' }}
                  title="Minimize to pill"
                >
                  —
                </button>
              )}
              <span style={{
                fontSize: '12px',
                fontWeight: 500,
                color: progress.status === 'complete' ? '#10b981'
                  : progress.status === 'failed' ? '#ef4444'
                  : progress.status === 'cancelled' ? '#f59e0b'
                  : 'var(--text-muted)',
              }}>
                {isConfirming && `${progress.totalItems} items`}
                {progress.status === 'running' && `${progress.processedItems}/${progress.totalItems}`}
                {progress.status === 'complete' && 'Complete'}
                {progress.status === 'cancelled' && 'Cancelled'}
                {progress.status === 'failed' && 'Failed'}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{
          padding: '20px',
          overflowY: isConfirming ? 'auto' : 'visible',
          flex: isConfirming ? 1 : undefined,
          minHeight: 0,
        }}>

          {/* ---- Confirmation screen ---- */}
          {isConfirming && (
            <>
              <div style={{
                padding: '10px 12px',
                marginBottom: '12px',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                Chronicles in chronological order, each followed by its referenced entities.
                Results auto-applied. Voice digest accumulates across both types.
                <div style={{ marginTop: '4px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {progress.chronicleCount} chronicles + {progress.entityCount} entities = {progress.totalItems} total
                </div>
              </div>

              {/* Work list — grouped */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginBottom: '8px',
                }}>
                  Work List
                </div>

                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  maxHeight: '400px',
                  overflowY: 'auto',
                }}>
                  {progress.workItems.map((item, i) => {
                    const isChronicle = item.type === 'chronicle';
                    const toneMeta = TONE_META[item.tone];
                    return (
                      <div
                        key={isChronicle ? `c-${item.chronicleId}` : `e-${item.entityId}`}
                        style={{
                          padding: isChronicle ? '6px 12px' : '4px 12px 4px 28px',
                          borderBottom: i < progress.workItems.length - 1 ? '1px solid var(--border-color)' : 'none',
                          fontSize: isChronicle ? '12px' : '11px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: isChronicle ? 'transparent' : 'var(--bg-secondary)',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          minWidth: 0,
                          flex: 1,
                        }}>
                          <span style={{
                            fontSize: '10px',
                            flexShrink: 0,
                            color: isChronicle ? '#6b8cae' : '#8b7355',
                          }}>
                            {isChronicle ? '\u25a0' : '\u25cb'}
                          </span>
                          <span style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: isChronicle ? 500 : 400,
                            color: isChronicle ? 'var(--text-primary)' : 'var(--text-secondary)',
                          }}>
                            {isChronicle ? item.title : item.entityName}
                          </span>
                          {!isChronicle && (
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', flexShrink: 0 }}>
                              {item.entityKind}
                            </span>
                          )}
                        </div>
                        <span style={{
                          fontSize: '10px',
                          color: '#8b7355',
                          flexShrink: 0,
                          marginLeft: '8px',
                        }}
                          title={toneMeta?.label || item.tone}
                        >
                          {toneMeta?.symbol || item.tone}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ---- Processing screen ---- */}
          {!isConfirming && (
            <>
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '6px',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>
                    Item {Math.min(progress.processedItems + 1, progress.totalItems)} / {progress.totalItems}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {globalPercent}%
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{
                  height: '8px',
                  borderRadius: '4px',
                  background: 'var(--bg-secondary)',
                  overflow: 'hidden',
                  marginBottom: '6px',
                }}>
                  <div style={{
                    height: '100%',
                    borderRadius: '4px',
                    background: progress.status === 'failed' ? '#ef4444'
                      : progress.status === 'cancelled' ? '#f59e0b'
                      : '#10b981',
                    width: `${globalPercent}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>

                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                  <span>
                    Chronicles: {progress.processedChronicles}/{progress.chronicleCount}
                    {' \u00b7 '}
                    Entities: {progress.processedEntities}/{progress.entityCount}
                  </span>
                  {progress.failedItems.length > 0 && (
                    <span style={{ color: '#ef4444' }}>
                      {progress.failedItems.length} failed
                    </span>
                  )}
                </div>
              </div>

              {/* Current item */}
              {progress.currentItem && !isTerminal && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--bg-secondary)',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <span style={{
                      fontSize: '10px',
                      color: progress.currentItem.type === 'chronicle' ? '#6b8cae' : '#8b7355',
                    }}>
                      {progress.currentItem.type === 'chronicle' ? '\u25a0' : '\u25cb'}
                    </span>
                    {progress.currentItem.type === 'chronicle'
                      ? progress.currentItem.title
                      : progress.currentItem.entityName}
                    {TONE_META[progress.currentItem.tone] && (
                      <span style={{ color: '#8b7355', fontSize: '13px' }}>
                        {TONE_META[progress.currentItem.tone].symbol}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {progress.currentItem.type === 'chronicle'
                      ? 'Annotating chronicle...'
                      : 'Annotating entity...'}
                  </div>
                </div>
              )}

              {/* Terminal state messages */}
              {progress.status === 'complete' && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  marginBottom: '16px',
                  fontSize: '12px',
                }}>
                  Annotated {progress.processedChronicles} chronicles and {progress.processedEntities} entities.
                  {progress.failedItems.length > 0 && (
                    <span style={{ color: '#ef4444' }}> {progress.failedItems.length} failed.</span>
                  )}
                </div>
              )}

              {progress.status === 'cancelled' && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  marginBottom: '16px',
                  fontSize: '12px',
                }}>
                  Cancelled after {progress.processedItems} of {progress.totalItems} items
                  ({progress.processedChronicles} chronicles, {progress.processedEntities} entities).
                </div>
              )}

              {progress.status === 'failed' && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  marginBottom: '16px',
                  fontSize: '12px',
                }}>
                  {progress.error || 'An unexpected error occurred.'}
                </div>
              )}

              {/* Failed items list */}
              {isTerminal && progress.failedItems.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '11px',
                    color: '#ef4444',
                    fontWeight: 600,
                    marginBottom: '4px',
                  }}>
                    Failed ({progress.failedItems.length})
                  </div>
                  {progress.failedItems.map((f, i) => (
                    <div key={i} style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                      {f.item.type === 'chronicle' ? f.item.title : f.item.entityName}: {f.error}
                    </div>
                  ))}
                </div>
              )}

              {/* Cost */}
              {progress.totalCost > 0 && (
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  textAlign: 'right',
                }}>
                  Cost: ${progress.totalCost.toFixed(4)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          flexShrink: 0,
        }}>
          {isConfirming && (
            <>
              <button
                onClick={onCancel}
                className="illuminator-button"
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="illuminator-button illuminator-button-primary"
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                Start ({progress.totalItems} items)
              </button>
            </>
          )}
          {!isConfirming && !isTerminal && (
            <button
              onClick={onCancel}
              className="illuminator-button"
              style={{ padding: '6px 16px', fontSize: '12px' }}
            >
              Cancel
            </button>
          )}
          {isTerminal && (
            <button
              onClick={onClose}
              className="illuminator-button"
              style={{ padding: '6px 16px', fontSize: '12px' }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
