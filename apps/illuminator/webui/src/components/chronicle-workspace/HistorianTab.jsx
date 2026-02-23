import { useMemo } from 'react';
import HistorianMarginNotes from '../HistorianMarginNotes';
import HistorianToneSelector, { TONE_META } from '../HistorianToneSelector';
import { computeBackportProgress } from '../../lib/chronicleTypes';

function BackportLoreButton({ item, onBackportLore, isGenerating }) {
  const { done, total } = useMemo(() => computeBackportProgress(item), [item.entityBackportStatus, item.roleAssignments, item.lens, item.tertiaryCast]);
  const allDone = done > 0 && done === total;
  const partial = done > 0 && done < total;

  let label = 'Backport Lore to Cast';
  let tooltip = 'Extract new lore from this chronicle and update cast member summaries/descriptions';
  if (allDone) {
    label = `Re-backport Lore (${done}/${total})`;
    tooltip = 'Re-run lore backport for this chronicle';
  } else if (partial) {
    label = `Continue Backport (${done}/${total})`;
    tooltip = `${total - done} entities remaining`;
  }

  return (
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
        title={tooltip}
      >
        {label}
      </button>
      {done > 0 && (
        <span
          style={{
            fontSize: '11px',
            color: allDone ? '#10b981' : '#f59e0b',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          title={`${done}/${total} entities backported`}
        >
          &#x21C4; {done}/{total}
        </span>
      )}
    </div>
  );
}

const ANNOTATION_TONES = ['witty', 'weary', 'elegiac', 'cantankerous', 'rueful', 'conspiratorial', 'bemused'];

export default function HistorianTab({
  item,
  isGenerating,
  isHistorianActive,
  onHistorianReview,
  onSetAssignedTone,
  onDetectTone,
  onUpdateHistorianNote,
  onBackportLore,
  onGeneratePrep,
}) {
  return (
    <div>
      {/* Tone Assignment */}
      {onSetAssignedTone && (
        <div
          style={{
            marginBottom: '20px',
            padding: '16px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Tone</div>
            {item.toneRanking?.ranking && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Ranked: {item.toneRanking.ranking.map((tone, i) => {
                  const meta = TONE_META[tone];
                  const perTone = item.toneRanking.rationales?.[tone];
                  return (
                    <span
                      key={i}
                      style={{ opacity: i === 0 ? 1 : i === 1 ? 0.6 : 0.4 }}
                      title={perTone || item.toneRanking.rationale || undefined}
                    >
                      {i > 0 ? ' > ' : ''}{meta?.label || tone}
                    </span>
                  );
                })}
              </div>
            )}
            {onDetectTone && (
              <button
                onClick={onDetectTone}
                disabled={isGenerating}
                style={{
                  padding: '2px 8px',
                  fontSize: '10px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '3px',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  color: 'var(--text-secondary)',
                  opacity: isGenerating ? 0.6 : 1,
                  marginLeft: 'auto',
                }}
                title="Run LLM tone detection for this chronicle"
              >
                Detect
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {ANNOTATION_TONES.map((tone) => {
              const meta = TONE_META[tone];
              const isAssigned = item.assignedTone === tone;
              const perTone = item.toneRanking?.rationales?.[tone];
              return (
                <button
                  key={tone}
                  onClick={() => onSetAssignedTone(tone)}
                  style={{
                    padding: '5px 12px',
                    fontSize: '12px',
                    background: isAssigned ? 'var(--bg-tertiary)' : 'transparent',
                    border: isAssigned ? '1px solid var(--text-muted)' : '1px solid var(--border-color)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: isAssigned ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: isAssigned ? 600 : 400,
                    opacity: isAssigned ? 1 : 0.7,
                  }}
                  title={perTone || meta?.description || tone}
                >
                  {meta?.symbol} {meta?.label || tone}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Annotate</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {item.assignedTone && (() => {
              const meta = TONE_META[item.assignedTone];
              return (
                <button
                  onClick={() => onHistorianReview(item.assignedTone)}
                  disabled={isGenerating || isHistorianActive}
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    cursor: (isGenerating || isHistorianActive) ? 'not-allowed' : 'pointer',
                    color: 'var(--text-secondary)',
                    opacity: (isGenerating || isHistorianActive) ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  title={`Run historian review with assigned tone: ${meta?.label || item.assignedTone}`}
                >
                  <span style={{ fontSize: '14px' }}>{meta?.symbol || '?'}</span>
                  {item.historianNotes?.length > 0 ? 'Re-annotate' : 'Annotate'} ({meta?.label || item.assignedTone})
                </button>
              );
            })()}
            <HistorianToneSelector
              onSelect={(tone) => onHistorianReview(tone)}
              disabled={isGenerating || isHistorianActive}
              hasNotes={item.historianNotes?.length > 0}
              style={{ display: 'inline-block' }}
              label={item.assignedTone ? 'Override' : undefined}
            />
            {!item.assignedTone && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Select a tone to generate historian margin notes.
              </div>
            )}
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

      {/* Historian Prep */}
      {onGeneratePrep && (
        <div
          style={{
            marginBottom: '20px',
            padding: '16px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Historian Prep</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Private reading notes in the historian's voice — observations and thematic threads for era narrative input.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onGeneratePrep}
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
              title={item.historianPrep
                ? "Regenerate historian reading notes for this chronicle"
                : "Generate historian reading notes for this chronicle"}
            >
              {item.historianPrep ? 'Regenerate Prep Brief' : 'Generate Prep Brief'}
            </button>
            {item.historianPrepGeneratedAt && (
              <span
                style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                title={`Generated ${new Date(item.historianPrepGeneratedAt).toLocaleString()}`}
              >
                Generated {new Date(item.historianPrepGeneratedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          {item.historianPrep && (
            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '13px',
                lineHeight: '1.6',
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                maxHeight: '300px',
                overflow: 'auto',
              }}
            >
              {item.historianPrep}
            </div>
          )}
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
          <BackportLoreButton item={item} onBackportLore={onBackportLore} isGenerating={isGenerating} />
        </div>
      )}

      {!onHistorianReview && !onBackportLore && !onGeneratePrep && !(item.historianNotes?.length > 0) && (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>
          No historian tools available for this chronicle.
        </div>
      )}
    </div>
  );
}
