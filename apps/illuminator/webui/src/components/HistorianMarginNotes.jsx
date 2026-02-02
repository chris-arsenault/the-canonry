/**
 * HistorianMarginNotes - Renders a flat list of historian notes with display mode
 * toggle and editable anchor text.
 *
 * Notes maintain their original order (no regrouping on state change).
 * Each note has three display modes: full | popout | disabled.
 * Anchor text can be edited; resolution uses the shared fuzzyAnchor module.
 */

import { useMemo, useState, useCallback } from 'react';
import { resolveAnchorPhrase } from '../lib/fuzzyAnchor';

// ============================================================================
// Note Type Metadata
// ============================================================================

const NOTE_TYPE_META = {
  commentary: { icon: '\u2726', color: '#8b7355', label: 'Commentary' },
  correction: { icon: '!', color: '#c0392b', label: 'Correction' },
  tangent: { icon: '~', color: '#7d6b91', label: 'Tangent' },
  skepticism: { icon: '?', color: '#d4a017', label: 'Skepticism' },
  pedantic: { icon: '#', color: '#5b7a5e', label: 'Pedantic' },
};

const DISPLAY_MODES = ['full', 'popout', 'disabled'];
const DISPLAY_ICONS = { full: '\u25C9', popout: '\u25CE', disabled: '\u25CB' };
const DISPLAY_LABELS = { full: 'Full', popout: 'Popout', disabled: 'Disabled' };

/** Resolve effective display from note (handles legacy `enabled` field) */
function noteDisplayMode(note) {
  if (note.display) return note.display;
  if (note.enabled === false) return 'disabled';
  return 'full';
}

// ============================================================================
// Anchor Editor
// ============================================================================

function AnchorEditor({ anchorPhrase, sourceText, onSave, onCancel }) {
  const [value, setValue] = useState(anchorPhrase);
  const resolved = useMemo(() => {
    if (!value.trim() || !sourceText) return null;
    return resolveAnchorPhrase(value, sourceText);
  }, [value, sourceText]);

  return (
    <div style={{
      padding: '6px 0',
      borderTop: '1px solid rgba(139, 115, 85, 0.15)',
      marginTop: '4px',
    }}>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{
            flex: 1,
            fontSize: '11px',
            padding: '3px 6px',
            border: '1px solid var(--border-color)',
            borderRadius: '3px',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
          }}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && resolved) {
              onSave(resolved.phrase);
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
        />
        <button
          onClick={() => resolved && onSave(resolved.phrase)}
          disabled={!resolved}
          style={{
            fontSize: '10px',
            padding: '2px 8px',
            border: '1px solid var(--border-color)',
            borderRadius: '3px',
            background: resolved ? '#8b7355' : 'transparent',
            color: resolved ? '#fff' : 'var(--text-muted)',
            cursor: resolved ? 'pointer' : 'default',
            opacity: resolved ? 1 : 0.5,
          }}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          style={{
            fontSize: '10px',
            padding: '2px 8px',
            border: '1px solid var(--border-color)',
            borderRadius: '3px',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
      {/* Resolution status */}
      <div style={{
        fontSize: '10px',
        marginTop: '3px',
        color: resolved ? '#5b7a5e' : '#c0392b',
      }}>
        {!value.trim() ? '' :
          resolved
            ? `${resolved.method === 'exact' ? 'Exact' : 'Fuzzy'} match: "${resolved.phrase.length > 60 ? resolved.phrase.slice(0, 60) + '\u2026' : resolved.phrase}"`
            : 'No match found in source text'}
      </div>
    </div>
  );
}

// ============================================================================
// Note Item
// ============================================================================

function NoteItem({ note, sourceText, onUpdateNote }) {
  const meta = NOTE_TYPE_META[note.type] || NOTE_TYPE_META.commentary;
  const display = noteDisplayMode(note);
  const [expanded, setExpanded] = useState(false);
  const [editingAnchor, setEditingAnchor] = useState(false);

  const anchorMissing = useMemo(() => {
    if (!sourceText || !note.anchorPhrase) return false;
    return !resolveAnchorPhrase(note.anchorPhrase, sourceText);
  }, [note.anchorPhrase, sourceText]);

  const cycleDisplay = useCallback(() => {
    if (!onUpdateNote) return;
    const idx = DISPLAY_MODES.indexOf(display);
    const next = DISPLAY_MODES[(idx + 1) % DISPLAY_MODES.length];
    onUpdateNote(note.noteId, { display: next });
  }, [onUpdateNote, note.noteId, display]);

  const handleSaveAnchor = useCallback((newPhrase) => {
    if (!onUpdateNote) return;
    onUpdateNote(note.noteId, { anchorPhrase: newPhrase });
    setEditingAnchor(false);
  }, [onUpdateNote, note.noteId]);

  const isDisabled = display === 'disabled';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '6px 10px',
        background: isDisabled ? 'rgba(139, 115, 85, 0.03)' : 'rgba(139, 115, 85, 0.08)',
        borderLeft: `3px solid ${isDisabled ? 'var(--border-color)' : meta.color}`,
        borderRadius: '0 4px 4px 0',
        opacity: isDisabled ? 0.5 : 1,
        marginBottom: '4px',
        transition: 'opacity 0.15s',
      }}
    >
      {/* Display mode toggle */}
      {onUpdateNote && (
        <button
          onClick={cycleDisplay}
          title={`${DISPLAY_LABELS[display]} \u2014 click to cycle (full \u2192 popout \u2192 disabled)`}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            padding: 0,
            color: isDisabled ? '#8b735560' : meta.color,
            lineHeight: 1,
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          {DISPLAY_ICONS[display]}
        </button>
      )}

      {/* Note content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Type label + anchor + edit button */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '6px',
          marginBottom: '2px',
        }}>
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            color: meta.color,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            flexShrink: 0,
            opacity: isDisabled ? 0.6 : 1,
          }}>
            {meta.icon} {meta.label}
          </span>
          {display !== 'full' && (
            <span style={{
              fontSize: '9px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
            }}>
              {DISPLAY_LABELS[display]}
            </span>
          )}
          <span
            onClick={() => !editingAnchor && setEditingAnchor(true)}
            style={{
              fontSize: '10px',
              color: anchorMissing ? '#ef4444' : 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              cursor: onUpdateNote ? 'pointer' : 'default',
            }}
            title={`Anchor: "${note.anchorPhrase}"${anchorMissing ? ' (not found in source text)' : ''}${onUpdateNote ? ' — click to edit' : ''}`}
          >
            "{note.anchorPhrase}"
          </span>
        </div>

        {/* Anchor not found warning */}
        {anchorMissing && !editingAnchor && (
          <div style={{
            fontSize: '11px',
            color: '#ef4444',
            marginTop: '4px',
          }}>
            Anchor text not found in source
          </div>
        )}

        {/* Anchor editor */}
        {editingAnchor && onUpdateNote && (
          <AnchorEditor
            anchorPhrase={note.anchorPhrase}
            sourceText={sourceText}
            onSave={handleSaveAnchor}
            onCancel={() => setEditingAnchor(false)}
          />
        )}

        {/* Note text */}
        <div
          style={{
            fontSize: '12px',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontStyle: 'italic',
            color: isDisabled ? 'var(--text-muted)' : 'var(--text-secondary)',
            lineHeight: '1.5',
            cursor: 'pointer',
          }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded || note.text.length <= 120
            ? note.text
            : note.text.slice(0, 120) + '\u2026'}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function HistorianMarginNotes({ notes, sourceText, style, onUpdateNote }) {
  if (!notes || notes.length === 0) return null;

  const counts = useMemo(() => {
    let full = 0, popout = 0, disabled = 0;
    for (const n of notes) {
      const d = noteDisplayMode(n);
      if (d === 'full') full++;
      else if (d === 'popout') popout++;
      else disabled++;
    }
    return { full, popout, disabled };
  }, [notes]);

  const summaryParts = [];
  if (counts.full > 0) summaryParts.push(`${counts.full} full`);
  if (counts.popout > 0) summaryParts.push(`${counts.popout} popout`);
  if (counts.disabled > 0) summaryParts.push(`${counts.disabled} disabled`);

  return (
    <div style={style}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '6px',
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          color: '#8b7355',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Historian Notes
        </span>
        <span style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
        }}>
          {summaryParts.join(', ')}
        </span>
      </div>

      {/* All notes in original order — no regrouping */}
      {notes.map((note) => (
        <NoteItem
          key={note.noteId}
          note={note}
          sourceText={sourceText}
          onUpdateNote={onUpdateNote}
        />
      ))}
    </div>
  );
}
