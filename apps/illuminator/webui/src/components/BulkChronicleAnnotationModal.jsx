/**
 * BulkChronicleAnnotationModal - Progress display for bulk chronicle annotation operations
 *
 * Handles both "Run Annotations" and "Clear Annotations" workflows.
 * Three phases: confirmation → processing → terminal.
 */

import { useEffect } from 'react';
import { useFloatingPillStore } from '../lib/db/floatingPillStore';

const PILL_ID = 'bulk-chronicle-annotation';

export default function BulkChronicleAnnotationModal({ progress, onConfirm, onCancel, onClose }) {
  const isMinimized = useFloatingPillStore((s) => s.isMinimized(PILL_ID));

  // Update pill status when progress changes while minimized
  useEffect(() => {
    if (!isMinimized || !progress) return;
    const statusColor = progress.status === 'running' ? '#f59e0b'
      : progress.status === 'complete' ? '#10b981'
      : progress.status === 'failed' ? '#ef4444'
      : '#6b7280';
    const statusText = progress.status === 'running'
      ? `${progress.processedChronicles}/${progress.totalChronicles}`
      : progress.status === 'complete' ? 'Complete'
      : progress.status === 'failed' ? 'Failed'
      : progress.status === 'cancelled' ? 'Cancelled'
      : '';
    useFloatingPillStore.getState().updatePill(PILL_ID, { statusText, statusColor });
  }, [isMinimized, progress?.status, progress?.processedChronicles]);

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
  const isClear = progress.operation === 'clear';
  const title = isClear ? 'Clear Annotations' : 'Run Annotations';
  const withNotes = progress.chronicles.filter((c) => c.hasNotes).length;
  const withTones = progress.chronicles.filter((c) => c.assignedTone).length;

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
              {title}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!isConfirming && (
                <button
                  onClick={() => useFloatingPillStore.getState().minimize({
                    id: PILL_ID,
                    label: title,
                    statusText: progress.status === 'running'
                      ? `${progress.processedChronicles}/${progress.totalChronicles}`
                      : progress.status,
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
                {progress.status === 'running' && `${progress.processedChronicles}/${progress.totalChronicles}`}
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
                {isClear ? (
                  <>
                    This will clear all historian annotations from {progress.totalChronicles} chronicle{progress.totalChronicles !== 1 ? 's' : ''}.
                    Annotations cannot be recovered after clearing.
                  </>
                ) : (
                  <>
                    Each chronicle gets a historian review using its assigned tone. Results are auto-applied
                    (no manual review step). Chronicles processed sequentially — one LLM call each.
                    {withTones < progress.totalChronicles && (
                      <span style={{ color: '#f59e0b' }}>
                        {' '}{progress.totalChronicles - withTones} chronicle{progress.totalChronicles - withTones !== 1 ? 's' : ''} have
                        no assigned tone and will default to "weary".
                      </span>
                    )}
                    {withNotes > 0 && (
                      <span style={{ color: '#f59e0b' }}>
                        {' '}{withNotes} chronicle{withNotes !== 1 ? 's' : ''} already have annotations — they will be replaced.
                      </span>
                    )}
                  </>
                )}
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
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {chron.title}
                      </span>
                      {!isClear && (
                        <span style={{
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                          marginLeft: '8px',
                          flexShrink: 0,
                        }}>
                          {chron.assignedTone || 'weary'}
                          {chron.hasNotes ? ' ✎' : ''}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ---- Processing / Terminal screen ---- */}
          {!isConfirming && (
            <>
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
                      <span style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {progress.currentTitle || (isClear ? 'Clearing...' : 'Annotating...')}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>{pct}%</span>
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

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        {progress.processedChronicles} / {progress.totalChronicles} {isClear ? 'cleared' : 'annotated'}
                      </span>
                      {!isClear && progress.currentTone && (
                        <span>tone: {progress.currentTone}</span>
                      )}
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
                  {isClear
                    ? `Cleared annotations from ${progress.processedChronicles} chronicle${progress.processedChronicles !== 1 ? 's' : ''}.`
                    : `Annotated ${progress.processedChronicles} of ${progress.totalChronicles} chronicles.`}
                  {progress.failedChronicles.length > 0 && ` (${progress.failedChronicles.length} failed)`}
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

              {/* Failed chronicles list */}
              {progress.failedChronicles.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    fontSize: '11px',
                    color: '#ef4444',
                    fontWeight: 600,
                    marginBottom: '4px',
                  }}>
                    Failed ({progress.failedChronicles.length})
                  </div>
                  {progress.failedChronicles.map((f) => (
                    <div key={f.chronicleId} style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                      {f.title}: {f.error}
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
                {isClear
                  ? `Clear (${progress.totalChronicles} chronicles)`
                  : `Annotate (${progress.totalChronicles} chronicles)`}
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
