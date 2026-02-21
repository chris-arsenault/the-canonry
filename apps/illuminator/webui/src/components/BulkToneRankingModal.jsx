/**
 * BulkToneRankingModal - Progress display for bulk tone ranking analysis
 *
 * Three phases:
 * 1. Confirmation: chronicle list with count
 * 2. Processing: single LLM call in progress (no per-chronicle tracking)
 * 3. Terminal: completion/cancellation/failure message
 */

import { useEffect } from 'react';
import { useFloatingPillStore } from '../lib/db/floatingPillStore';

const PILL_ID = 'bulk-tone-ranking';

export default function BulkToneRankingModal({ progress, onConfirm, onCancel, onClose }) {
  const isMinimized = useFloatingPillStore((s) => s.isMinimized(PILL_ID));

  // Update pill status when progress changes while minimized
  useEffect(() => {
    if (!isMinimized || !progress) return;
    const statusColor = progress.status === 'running' ? '#f59e0b'
      : progress.status === 'complete' ? '#10b981'
      : progress.status === 'failed' ? '#ef4444'
      : '#6b7280';
    const statusText = progress.status === 'running' ? 'Ranking...'
      : progress.status === 'complete' ? 'Complete'
      : progress.status === 'failed' ? 'Failed'
      : progress.status === 'cancelled' ? 'Cancelled'
      : '';
    useFloatingPillStore.getState().updatePill(PILL_ID, { statusText, statusColor });
  }, [isMinimized, progress?.status]);

  // Clean up pill when process resets to idle
  useEffect(() => {
    if (!progress || progress.status === 'idle') {
      useFloatingPillStore.getState().remove(PILL_ID);
    }
  }, [progress?.status]);

  if (!progress || progress.status === 'idle') return null;
  if (isMinimized) return null;

  const isConfirming = progress.status === 'confirming';
  const isTerminal = progress.status === 'complete' || progress.status === 'cancelled' || progress.status === 'failed';

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
              Tone Ranking
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!isConfirming && (
                <button
                  onClick={() => useFloatingPillStore.getState().minimize({
                    id: PILL_ID,
                    label: 'Tone Ranking',
                    statusText: progress.status === 'running' ? 'Ranking...' : progress.status,
                    statusColor: progress.status === 'running' ? '#f59e0b' : progress.status === 'complete' ? '#10b981' : '#ef4444',
                    tabId: 'chronicle',
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
                {isConfirming && `${progress.totalChronicles} chronicles`}
                {progress.status === 'running' && (progress.processedChronicles > 0
                ? `${progress.processedChronicles}/${progress.totalChronicles}`
                : 'Ranking...')}
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
                Chronicles are split into batches of ~35-45. Each batch gets its own LLM call
                so the model maintains attention across all entries.
              </div>

              {/* Chronicle list */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginBottom: '8px',
                }}>
                  Chronicles ({progress.chronicles.length})
                </div>

                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  maxHeight: '400px',
                  overflowY: 'auto',
                }}>
                  {progress.chronicles.map((chron, i) => (
                    <div
                      key={chron.chronicleId}
                      style={{
                        padding: '6px 12px',
                        borderBottom: i < progress.chronicles.length - 1 ? '1px solid var(--border-color)' : 'none',
                        fontSize: '12px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {chron.title}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ---- Processing / Terminal screen ---- */}
          {!isConfirming && (
            <>
              {/* Batch processing status */}
              {progress.status === 'running' && (() => {
                const pct = progress.totalChronicles > 0
                  ? Math.round((progress.processedChronicles / progress.totalChronicles) * 100)
                  : 0;
                return (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: '6px',
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>
                        {progress.currentTitle || `Ranking ${progress.totalChronicles} chronicles...`}
                      </span>
                      {progress.processedChronicles > 0 && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{pct}%</span>
                      )}
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
                        background: '#10b981',
                        width: `${pct}%`,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {progress.processedChronicles} / {progress.totalChronicles} chronicles ranked
                    </div>
                  </div>
                );
              })()}

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
                  Ranked {progress.processedChronicles} of {progress.totalChronicles} chronicles.
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
                  Cancelled after {progress.processedChronicles} of {progress.totalChronicles} chronicles.
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
                Rank ({progress.totalChronicles} chronicles)
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
