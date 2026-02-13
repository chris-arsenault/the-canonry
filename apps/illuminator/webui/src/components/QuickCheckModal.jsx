/**
 * QuickCheckModal - Display results from the unanchored entity reference check.
 *
 * Informational only — no accept/reject workflow. The user reads the report
 * and manually edits the chronicle text if needed.
 */

const ASSESSMENT_COLORS = {
  clean: '#22c55e',
  minor: '#f59e0b',
  flagged: '#ef4444',
};

const ASSESSMENT_LABELS = {
  clean: 'Clean',
  minor: 'Minor issues',
  flagged: 'Flagged',
};

const CONFIDENCE_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
};

export default function QuickCheckModal({ report, onClose }) {
  if (!report) return null;

  const { suspects, assessment, summary } = report;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.5)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          width: '650px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>
              Quick Check — Unanchored References
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              <span style={{ color: ASSESSMENT_COLORS[assessment] || 'var(--text-muted)' }}>
                {ASSESSMENT_LABELS[assessment] || assessment}
              </span>
              {' '}&bull;{' '}
              {suspects.length} suspect{suspects.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              color: 'var(--text-muted)',
              padding: '4px',
            }}
          >
            {'\u2715'}
          </button>
        </div>

        {/* Summary */}
        <div
          style={{
            padding: '10px 20px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            borderBottom: '1px solid var(--border-color)',
            lineHeight: '1.5',
          }}
        >
          {summary}
        </div>

        {/* Suspects list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {suspects.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 0',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
              No unanchored references detected.
            </div>
          ) : (
            suspects.map((suspect, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 12px',
                  marginBottom: '8px',
                  background: 'var(--bg-primary)',
                  borderLeft: `3px solid ${CONFIDENCE_COLORS[suspect.confidence] || '#6b7280'}`,
                  borderRadius: '0 6px 6px 0',
                  border: '1px solid var(--border-color)',
                  borderLeftWidth: '3px',
                  borderLeftColor: CONFIDENCE_COLORS[suspect.confidence] || '#6b7280',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>
                    &ldquo;{suspect.phrase}&rdquo;
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: CONFIDENCE_COLORS[suspect.confidence] || '#6b7280',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    {suspect.confidence}
                  </span>
                </div>
                {suspect.context && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                      marginBottom: '4px',
                      lineHeight: '1.4',
                    }}
                  >
                    ...{suspect.context}...
                  </div>
                )}
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.4',
                  }}
                >
                  {suspect.reasoning}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            className="illuminator-button"
            style={{ padding: '6px 16px', fontSize: '12px' }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
