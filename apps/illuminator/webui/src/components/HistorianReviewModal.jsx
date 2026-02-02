/**
 * HistorianReviewModal - Review UI for historian annotations
 *
 * Shows the source text with highlighted anchor phrases and margin callouts.
 * Users can accept/reject/edit individual notes before applying them.
 */

import { useState, useMemo } from 'react';
import { TONE_META } from './HistorianToneSelector';

// ============================================================================
// Note Type Icons & Colors
// ============================================================================

const NOTE_TYPE_META = {
  commentary: { icon: '✦', color: '#8b7355', label: 'Commentary' },
  correction: { icon: '!', color: '#c0392b', label: 'Correction' },
  tangent: { icon: '~', color: '#7d6b91', label: 'Tangent' },
  skepticism: { icon: '?', color: '#d4a017', label: 'Skepticism' },
  pedantic: { icon: '#', color: '#5b7a5e', label: 'Pedantic' },
};

// ============================================================================
// Single Note Card
// ============================================================================

function NoteCard({ note, accepted, onToggle, onEditText }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(note.text);
  const meta = NOTE_TYPE_META[note.type] || NOTE_TYPE_META.commentary;

  return (
    <div style={{
      padding: '10px 12px',
      marginBottom: '8px',
      background: accepted !== false ? 'rgba(139, 115, 85, 0.08)' : 'var(--bg-tertiary)',
      borderLeft: `3px solid ${accepted !== false ? meta.color : 'var(--border-color)'}`,
      borderRadius: '0 4px 4px 0',
      opacity: accepted === false ? 0.5 : 1,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '6px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            color: meta.color,
          }}>
            {meta.icon}
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: 600,
            color: meta.color,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {meta.label}
          </span>
        </div>
        <button
          onClick={() => onToggle(note.noteId, accepted === false)}
          style={{
            padding: '2px 8px',
            fontSize: '10px',
            border: '1px solid var(--border-color)',
            borderRadius: '3px',
            background: accepted !== false ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-tertiary)',
            color: accepted !== false ? '#22c55e' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          {accepted !== false ? '✓ Accepted' : 'Rejected'}
        </button>
      </div>

      {/* Anchor phrase */}
      <div style={{
        fontSize: '10px',
        color: 'var(--text-muted)',
        marginBottom: '4px',
        fontStyle: 'italic',
      }}>
        anchored to: "{note.anchorPhrase.length > 60 ? note.anchorPhrase.slice(0, 60) + '…' : note.anchorPhrase}"
      </div>

      {/* Note text */}
      {editing ? (
        <div>
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            style={{
              width: '100%',
              minHeight: '60px',
              padding: '6px 8px',
              fontSize: '12px',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontStyle: 'italic',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <button
              onClick={() => {
                onEditText(note.noteId, editValue);
                setEditing(false);
              }}
              style={{
                padding: '2px 8px',
                fontSize: '10px',
                border: '1px solid var(--border-color)',
                borderRadius: '3px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditValue(note.text);
                setEditing(false);
              }}
              style={{
                padding: '2px 8px',
                fontSize: '10px',
                border: '1px solid var(--border-color)',
                borderRadius: '3px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setEditing(true)}
          title="Click to edit"
          style={{
            fontSize: '12px',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontStyle: 'italic',
            color: 'var(--text-primary)',
            lineHeight: '1.6',
            cursor: 'text',
          }}
        >
          {note.text}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Annotated Text View
// ============================================================================

function AnnotatedText({ sourceText, notes, noteDecisions }) {
  // Build segments of text with note markers
  const segments = useMemo(() => {
    if (!notes || notes.length === 0) {
      return [{ type: 'text', content: sourceText }];
    }

    // Find anchor positions
    const anchors = [];
    for (const note of notes) {
      const idx = sourceText.indexOf(note.anchorPhrase);
      if (idx >= 0) {
        anchors.push({
          start: idx,
          end: idx + note.anchorPhrase.length,
          note,
        });
      }
    }

    // Sort by position
    anchors.sort((a, b) => a.start - b.start);

    // Build segments
    const segs = [];
    let cursor = 0;

    for (const anchor of anchors) {
      if (anchor.start > cursor) {
        segs.push({ type: 'text', content: sourceText.slice(cursor, anchor.start) });
      }
      if (anchor.start >= cursor) {
        const meta = NOTE_TYPE_META[anchor.note.type] || NOTE_TYPE_META.commentary;
        const accepted = noteDecisions[anchor.note.noteId] !== false;
        segs.push({
          type: 'anchor',
          content: sourceText.slice(anchor.start, anchor.end),
          note: anchor.note,
          meta,
          accepted,
        });
        cursor = anchor.end;
      }
    }

    if (cursor < sourceText.length) {
      segs.push({ type: 'text', content: sourceText.slice(cursor) });
    }

    return segs;
  }, [sourceText, notes, noteDecisions]);

  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--bg-tertiary)',
      borderRadius: '4px',
      border: '1px solid var(--border-color)',
      fontSize: '12px',
      lineHeight: '1.8',
      maxHeight: '400px',
      overflow: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <span key={i}>{seg.content}</span>;
        }
        return (
          <span
            key={i}
            title={`${seg.meta.label}: ${seg.note.text}`}
            style={{
              background: seg.accepted
                ? `${seg.meta.color}22`
                : 'transparent',
              borderBottom: `2px solid ${seg.accepted ? seg.meta.color : 'var(--border-color)'}`,
              borderRadius: '2px',
              padding: '0 1px',
              cursor: 'help',
              textDecoration: seg.accepted ? 'none' : 'line-through',
              opacity: seg.accepted ? 1 : 0.5,
            }}
          >
            {seg.content}
            <sup style={{
              fontSize: '9px',
              color: seg.meta.color,
              fontWeight: 700,
              marginLeft: '1px',
            }}>
              {seg.meta.icon}
            </sup>
          </span>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Modal
// ============================================================================

export default function HistorianReviewModal({
  run,
  isActive,
  onToggleNote,
  onEditNoteText,
  onAccept,
  onCancel,
}) {
  if (!isActive || !run) return null;

  const isGenerating = run.status === 'pending' || run.status === 'generating';
  const isReviewing = run.status === 'reviewing';
  const isFailed = run.status === 'failed';
  const notes = run.notes || [];

  const acceptedCount = notes.filter((n) => run.noteDecisions[n.noteId] !== false).length;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '900px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Historian Review — {run.targetName}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {run.targetType === 'entity' ? 'Entity Description' : 'Chronicle Narrative'}
              {run.tone && TONE_META[run.tone] && (
                <span style={{ marginLeft: '6px', color: '#8b7355' }}>
                  {TONE_META[run.tone].symbol} {TONE_META[run.tone].label}
                </span>
              )}
              {isReviewing && ` · ${acceptedCount}/${notes.length} notes accepted`}
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{
              padding: '4px 12px',
              fontSize: '11px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 20px',
        }}>
          {isGenerating && (
            <div style={{
              textAlign: 'center',
              padding: '40px 0',
              color: 'var(--text-muted)',
              fontSize: '13px',
            }}>
              The historian is reviewing the text…
            </div>
          )}

          {isFailed && (
            <div style={{
              textAlign: 'center',
              padding: '40px 0',
              color: '#ef4444',
              fontSize: '13px',
            }}>
              Review failed: {run.error || 'Unknown error'}
            </div>
          )}

          {isReviewing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Annotated source text */}
              <div>
                <div style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Source Text (annotations highlighted)
                </div>
                <AnnotatedText
                  sourceText={run.sourceText}
                  notes={notes}
                  noteDecisions={run.noteDecisions}
                />
              </div>

              {/* Notes list */}
              <div>
                <div style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Historian Notes ({notes.length})
                </div>
                {notes.map((note) => (
                  <NoteCard
                    key={note.noteId}
                    note={note}
                    accepted={run.noteDecisions[note.noteId]}
                    onToggle={onToggleNote}
                    onEditText={onEditNoteText}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {isReviewing && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}>
            <button
              onClick={onCancel}
              style={{
                padding: '6px 16px',
                fontSize: '12px',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Discard All
            </button>
            <button
              onClick={onAccept}
              disabled={acceptedCount === 0}
              style={{
                padding: '6px 16px',
                fontSize: '12px',
                border: '1px solid transparent',
                borderRadius: '4px',
                background: acceptedCount > 0 ? '#8b7355' : 'var(--bg-tertiary)',
                color: acceptedCount > 0 ? '#fff' : 'var(--text-muted)',
                cursor: acceptedCount > 0 ? 'pointer' : 'not-allowed',
                fontWeight: 600,
              }}
            >
              Apply {acceptedCount} Note{acceptedCount !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
