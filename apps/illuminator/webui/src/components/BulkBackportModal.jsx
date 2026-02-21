/**
 * BulkBackportModal - Progress display for automatic multi-chronicle bulk backport
 *
 * Two phases:
 * 1. Confirmation: entity list with chronicle counts, confirm/cancel buttons
 * 2. Processing: progress bars, current chronicle, entity count, cost
 */

import { useEffect, useMemo } from 'react';
import { useFloatingPillStore } from '../lib/db/floatingPillStore';

const PILL_ID = 'bulk-backport';

export default function BulkBackportModal({ progress, onConfirm, onCancel, onClose }) {
  const isMinimized = useFloatingPillStore((s) => s.isMinimized(PILL_ID));

  useEffect(() => {
    if (!isMinimized || !progress) return;
    const statusColor = progress.status === 'running' ? '#f59e0b'
      : progress.status === 'complete' ? '#10b981'
      : progress.status === 'failed' ? '#ef4444' : '#6b7280';
    const statusText = progress.status === 'running'
      ? `${progress.processedEntities}/${progress.totalEntities}`
      : progress.status;
    useFloatingPillStore.getState().updatePill(PILL_ID, { statusText, statusColor });
  }, [isMinimized, progress?.status, progress?.processedEntities]);

  useEffect(() => {
    if (!progress || progress.status === 'idle') {
      useFloatingPillStore.getState().remove(PILL_ID);
    }
  }, [progress?.status]);

  if (!progress || progress.status === 'idle') return null;
  if (isMinimized) return null;

  const isConfirming = progress.status === 'confirming';
  const isTerminal = progress.status === 'complete' || progress.status === 'cancelled' || progress.status === 'failed';
  const currentChronicle = progress.chronicles[progress.currentChronicleIndex];

  const globalPercent = progress.totalEntities > 0
    ? Math.round((progress.processedEntities / progress.totalEntities) * 100)
    : 0;

  const completedChronicles = progress.chronicles.filter((c) => c.status === 'complete').length;
  const failedChronicles = progress.chronicles.filter((c) => c.status === 'failed').length;

  const realTotal = useMemo(
    () => progress.chronicles.reduce((sum, c) => sum + c.totalEntities, 0),
    [progress.chronicles],
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
        width: isConfirming ? '540px' : '480px',
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
              Bulk Backport
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!isConfirming && (
                <button
                  onClick={() => useFloatingPillStore.getState().minimize({
                    id: PILL_ID,
                    label: 'Bulk Backport',
                    statusText: progress.status === 'running' ? `${progress.processedEntities}/${progress.totalEntities}` : progress.status,
                    statusColor: progress.status === 'running' ? '#f59e0b' : progress.status === 'complete' ? '#10b981' : '#ef4444',
                  })}
                  className="illuminator-button"
                  style={{ padding: '2px 8px', fontSize: '11px' }}
                  title="Minimize to pill"
                >
                  ―
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
                {isConfirming && `${progress.chronicles.length} chronicles`}
                {progress.status === 'running' && 'Processing...'}
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
          {isConfirming && progress.entitySummary && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '8px',
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Entities ({progress.entitySummary.length})
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {progress.totalEntities} updates across {progress.chronicles.length} chronicles
                  </span>
                </div>

                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}>
                  {progress.entitySummary.map((entity, i) => (
                    <div
                      key={entity.entityId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 12px',
                        borderBottom: i < progress.entitySummary.length - 1 ? '1px solid var(--border-color)' : 'none',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {entity.entityName}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {entity.entityKind}{entity.entitySubtype ? ` / ${entity.entitySubtype}` : ''}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                        marginLeft: '8px',
                      }}
                        title={`${entity.chronicleCount} chronicle${entity.chronicleCount !== 1 ? 's' : ''} will update this entity`}
                      >
                        {entity.chronicleCount} chr
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ---- Processing screen ---- */}
          {!isConfirming && (
            <>
              {/* Global progress */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '6px',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>
                    Chronicle {Math.min(progress.currentChronicleIndex + 1, progress.chronicles.length)} / {progress.chronicles.length}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {globalPercent}%
                  </span>
                </div>

                {/* Global progress bar */}
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
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                }}>
                  <span>{progress.processedEntities} / {realTotal || progress.totalEntities} entities</span>
                  <span>{completedChronicles} / {progress.chronicles.length} chronicles</span>
                </div>
              </div>

              {/* Current chronicle detail */}
              {currentChronicle && !isTerminal && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--bg-secondary)',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    marginBottom: '8px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {currentChronicle.chronicleTitle}
                  </div>

                  {currentChronicle.totalBatches > 1 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                    }}>
                      <span>Batch {Math.min(currentChronicle.completedBatches + 1, currentChronicle.totalBatches)} / {currentChronicle.totalBatches}</span>
                      <span>{currentChronicle.processedEntities} / {currentChronicle.totalEntities} entities</span>
                    </div>
                  )}

                  {currentChronicle.totalBatches <= 1 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {currentChronicle.totalEntities} entities
                    </div>
                  )}
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
                  Backported {progress.processedEntities} entities across {completedChronicles} chronicles.
                  {failedChronicles > 0 && (
                    <span style={{ color: '#ef4444' }}> {failedChronicles} chronicle(s) failed.</span>
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
                  Cancelled after processing {progress.processedEntities} entities across {completedChronicles} chronicles.
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
                Start Backport ({progress.totalEntities} entities)
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
