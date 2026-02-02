import HistorianMarginNotes from '../HistorianMarginNotes';
import HistorianToneSelector from '../HistorianToneSelector';

export default function HistorianTab({
  item,
  isGenerating,
  isHistorianActive,
  onHistorianReview,
  onUpdateHistorianNote,
  onBackportLore,
}) {
  return (
    <div>
      {/* Historian Review */}
      {onHistorianReview && (
        <div
          style={{
            marginBottom: '20px',
            padding: '16px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Historian Review</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <HistorianToneSelector
              onSelect={(tone) => onHistorianReview(tone)}
              disabled={isGenerating || isHistorianActive}
              hasNotes={item.historianNotes?.length > 0}
              style={{ display: 'inline-block' }}
            />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Select a tone to generate historian margin notes.
            </div>
          </div>
        </div>
      )}

      {/* Margin Notes */}
      {item.historianNotes?.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <HistorianMarginNotes
            notes={item.historianNotes}
            sourceText={item.finalContent}
            onUpdateNote={onUpdateHistorianNote
              ? (noteId, updates) => onUpdateHistorianNote('chronicle', item.chronicleId, noteId, updates)
              : undefined}
          />
        </div>
      )}

      {/* Lore Backport */}
      {onBackportLore && (
        <div
          style={{
            padding: '16px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Lore Integration</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onBackportLore}
              disabled={isGenerating}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                color: 'var(--text-secondary)',
                opacity: isGenerating ? 0.6 : 1,
              }}
              title={item.loreBackported
                ? "Re-run lore backport for this chronicle"
                : "Extract new lore from this chronicle and update cast member summaries/descriptions"}
            >
              {item.loreBackported ? 'Re-backport Lore' : 'Backport Lore to Cast'}
            </button>
            {item.loreBackported && (
              <span
                style={{
                  fontSize: '11px',
                  color: '#10b981',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Lore from this chronicle has been backported to cast"
              >
                &#x21C4; Backported
              </span>
            )}
          </div>
        </div>
      )}

      {!onHistorianReview && !onBackportLore && !(item.historianNotes?.length > 0) && (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>
          No historian tools available for this chronicle.
        </div>
      )}
    </div>
  );
}
