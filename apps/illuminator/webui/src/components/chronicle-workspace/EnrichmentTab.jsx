export default function EnrichmentTab({
  item,
  isGenerating,
  refinements,
  onGenerateTitle,
  onGenerateSummary,
}) {
  const titleState = refinements?.title || {};
  const summaryState = refinements?.summary || {};
  const formatTimestamp = (ts) => new Date(ts).toLocaleString();

  return (
    <div>
      <div
        style={{
          padding: '16px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Post-Publish Enrichment</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Title */}
          {onGenerateTitle && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>Title</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Regenerate the chronicle title using two-pass synthesis.
                </div>
                {item.titleGeneratedAt && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Last generated: {formatTimestamp(item.titleGeneratedAt)}
                  </div>
                )}
                {item.titleCandidates?.length > 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      &#x25C6; {item.title}
                    </span>
                    <br />
                    {item.titleCandidates.map((c, i) => (
                      <span key={i}>
                        <span style={{ opacity: 0.6 }}>&#x25C7;</span> {c}
                        {i < item.titleCandidates.length - 1 ? <br /> : null}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={onGenerateTitle}
                disabled={isGenerating || titleState.running}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: isGenerating || titleState.running ? 'not-allowed' : 'pointer',
                  color: 'var(--text-secondary)',
                  opacity: isGenerating || titleState.running ? 0.6 : 1,
                  height: '32px',
                  alignSelf: 'center',
                }}
              >
                {titleState.running ? 'Generating...' : 'Regenerate Title'}
              </button>
            </div>
          )}

          {/* Summary */}
          {onGenerateSummary && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>Summary</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Regenerate the short summary for chronicle listings.
                </div>
                {item.summaryGeneratedAt && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Last generated: {formatTimestamp(item.summaryGeneratedAt)}
                  </div>
                )}
              </div>
              <button
                onClick={onGenerateSummary}
                disabled={isGenerating || summaryState.running}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: isGenerating || summaryState.running ? 'not-allowed' : 'pointer',
                  color: 'var(--text-secondary)',
                  opacity: isGenerating || summaryState.running ? 0.6 : 1,
                  height: '32px',
                  alignSelf: 'center',
                }}
              >
                {summaryState.running ? 'Generating...' : 'Regenerate Summary'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
