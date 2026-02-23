/**
 * HistoryCompressionPreviewModal - Shows description archive compression
 * effects before dispatching a historian edition (copy edit) LLM call.
 *
 * Displayed when an entity has enough history versions that compression
 * applies (>8 entries). Shows what the LLM will receive: which versions
 * were consolidated and which were kept as distinct milestones.
 */

export default function HistoryCompressionPreviewModal({
  entityName,
  originalCount,
  compressed,
  onProceed,
  onCancel,
}) {
  if (!compressed || compressed.length === 0) return null;

  const removedCount = originalCount - compressed.length;

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
        width: '700px',
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
              Description Archive
              <span style={{ fontWeight: 400, fontSize: '13px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                {entityName}
              </span>
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              {removedCount > 0
                ? `${originalCount} versions → ${compressed.length} milestones (${removedCount} near-duplicate passes consolidated)`
                : `${originalCount} versions — no compression needed`
              }
            </p>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 20px',
          minHeight: 0,
        }}>
          {compressed.map((entry, i) => {
            const date = new Date(entry.replacedAt).toISOString().split('T')[0];
            const isConsolidated = entry.consolidatedCount > 1;
            const earliestDate = entry.earliestDate
              ? new Date(entry.earliestDate).toISOString().split('T')[0]
              : null;

            return (
              <div
                key={i}
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  marginBottom: '6px',
                  borderLeft: `3px solid ${isConsolidated ? '#f59e0b' : 'var(--border-color)'}`,
                }}
              >
                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
                      [{i + 1}]
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {entry.source}
                    </span>
                    {isConsolidated && (
                      <span style={{
                        fontSize: '10px',
                        color: '#f59e0b',
                        fontWeight: 500,
                      }}>
                        {entry.consolidatedCount} passes consolidated
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {isConsolidated && earliestDate
                      ? `${earliestDate} → ${date}`
                      : date
                    }
                  </span>
                </div>

                {/* Preview */}
                <div style={{
                  padding: '0 12px 8px',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                  maxHeight: '60px',
                  overflow: 'hidden',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                }}>
                  {entry.description.slice(0, 300)}
                </div>
              </div>
            );
          })}
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
          <button
            onClick={onCancel}
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: '6px 16px', fontSize: '12px' }}
          >
            Cancel
          </button>
          <button
            onClick={onProceed}
            className="illuminator-button illuminator-button-primary"
            style={{ padding: '6px 16px', fontSize: '12px' }}
          >
            Proceed with Copy Edit
          </button>
        </div>
      </div>
    </div>
  );
}
