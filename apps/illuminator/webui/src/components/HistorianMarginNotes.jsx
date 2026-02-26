/**
 * HistorianMarginNotes - Renders a flat list of historian notes with display mode
 * toggle and editable anchor text.
 *
 * Notes maintain their original order (no regrouping on state change).
 * Each note has three display modes: full | popout | disabled.
 * Anchor text can be edited; resolution uses the shared fuzzyAnchor module.
 */

import React, { useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { resolveAnchorPhrase } from "../lib/fuzzyAnchor";
import "./HistorianMarginNotes.css";

// ============================================================================
// Note Type Metadata
// ============================================================================

const NOTE_TYPE_META = {
  commentary: { icon: "\u2726", color: "#8b7355", label: "Commentary" },
  correction: { icon: "!", color: "#c0392b", label: "Correction" },
  tangent: { icon: "~", color: "#7d6b91", label: "Tangent" },
  skepticism: { icon: "?", color: "#d4a017", label: "Skepticism" },
  pedantic: { icon: "#", color: "#5b7a5e", label: "Pedantic" },
  temporal: { icon: "\u27F3", color: "#4a8b9e", label: "Temporal" },
};

const DISPLAY_MODES = ["full", "popout", "disabled"];
const DISPLAY_ICONS = { full: "\u25C9", popout: "\u25CE", disabled: "\u25CB" };
const DISPLAY_LABELS = { full: "Full", popout: "Popout", disabled: "Disabled" };

/** Resolve effective display from note (handles legacy `enabled` field) */
function noteDisplayMode(note) {
  if (note.display) return note.display;
  if (note.enabled === false) return "disabled";
  return "full";
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
    <div className="hmn-anchor-editor">
      <div className="hmn-anchor-editor-row">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="hmn-anchor-input"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && resolved) {
              onSave(resolved.phrase);
            } else if (e.key === "Escape") {
              onCancel();
            }
          }}
        />
        <button
          onClick={() => resolved && onSave(resolved.phrase)}
          disabled={!resolved}
          className={`hmn-anchor-save-btn${resolved ? " hmn-anchor-save-btn-resolved" : ""}`}
        >
          Save
        </button>
        <button onClick={onCancel} className="hmn-anchor-cancel-btn">
          Cancel
        </button>
      </div>
      {/* Resolution status */}
      <div
        className={`hmn-anchor-status ${resolved ? "hmn-anchor-status-resolved" : "hmn-anchor-status-unresolved"}`}
      >
        {(() => {
          if (!value.trim()) return "";
          if (!resolved) return "No match found in source text";
          const methodLabel = resolved.method === "exact" ? "Exact" : "Fuzzy";
          const phrasePreview = resolved.phrase.length > 60 ? resolved.phrase.slice(0, 60) + "\u2026" : resolved.phrase;
          return `${methodLabel} match: "${phrasePreview}"`;
        })()}
      </div>
    </div>
  );
}

AnchorEditor.propTypes = {
  anchorPhrase: PropTypes.string,
  sourceText: PropTypes.string,
  onSave: PropTypes.func,
  onCancel: PropTypes.func,
};

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

  const handleSaveAnchor = useCallback(
    (newPhrase) => {
      if (!onUpdateNote) return;
      onUpdateNote(note.noteId, { anchorPhrase: newPhrase });
      setEditingAnchor(false);
    },
    [onUpdateNote, note.noteId]
  );

  const isDisabled = display === "disabled";

  return (
    <div
      className={`hmn-note-item${isDisabled ? " hmn-note-item-disabled" : ""}`}
      // eslint-disable-next-line local/no-inline-styles -- dynamic border-left color from note type metadata
      style={{ borderLeft: `3px solid ${isDisabled ? "var(--border-color)" : meta.color}` }}
    >
      {/* Display mode toggle */}
      {onUpdateNote && (
        <button
          onClick={cycleDisplay}
          title={`${DISPLAY_LABELS[display]} \u2014 click to cycle (full \u2192 popout \u2192 disabled)`}
          className="hmn-display-toggle"
          // eslint-disable-next-line local/no-inline-styles -- dynamic color from note type metadata
          style={{ color: isDisabled ? "#8b735560" : meta.color }}
        >
          {DISPLAY_ICONS[display]}
        </button>
      )}

      {/* Note content */}
      <div className="hmn-note-content">
        {/* Type label + anchor + edit button */}
        <div className="hmn-note-header">
          <span
            className={`hmn-type-label${isDisabled ? " hmn-type-label-disabled" : ""}`}
            // eslint-disable-next-line local/no-inline-styles -- dynamic color from note type metadata
            style={{ color: meta.color }}
          >
            {meta.icon} {meta.label}
          </span>
          {display !== "full" && (
            <span className="hmn-display-label">{DISPLAY_LABELS[display]}</span>
          )}
          <span
            onClick={() => !editingAnchor && setEditingAnchor(true)}
            className={`hmn-anchor-text ${anchorMissing ? "hmn-anchor-text-missing" : "hmn-anchor-text-normal"} ${onUpdateNote ? "hmn-anchor-text-editable" : "hmn-anchor-text-readonly"}`}
            title={`Anchor: "${note.anchorPhrase}"${anchorMissing ? " (not found in source text)" : ""}${onUpdateNote ? " — click to edit" : ""}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
          >
            &quot;{note.anchorPhrase}&quot;
          </span>
        </div>

        {/* Anchor not found warning */}
        {anchorMissing && !editingAnchor && (
          <div className="hmn-anchor-warning">Anchor text not found in source</div>
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
          className={`hmn-note-text ${isDisabled ? "hmn-note-text-disabled" : "hmn-note-text-active"}`}
          onClick={() => setExpanded(!expanded)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
        >
          {expanded || note.text.length <= 120 ? note.text : note.text.slice(0, 120) + "\u2026"}
        </div>
      </div>
    </div>
  );
}

NoteItem.propTypes = {
  note: PropTypes.object,
  sourceText: PropTypes.string,
  onUpdateNote: PropTypes.func,
};

// ============================================================================
// Main Component
// ============================================================================

export default function HistorianMarginNotes({ notes, sourceText, style, onUpdateNote }) {
  const counts = useMemo(() => {
    if (!notes || notes.length === 0) return { full: 0, popout: 0, disabled: 0 };
    let full = 0,
      popout = 0,
      disabled = 0;
    for (const n of notes) {
      const d = noteDisplayMode(n);
      if (d === "full") full++;
      else if (d === "popout") popout++;
      else disabled++;
    }
    return { full, popout, disabled };
  }, [notes]);

  if (!notes || notes.length === 0) return null;

  const summaryParts = [];
  if (counts.full > 0) summaryParts.push(`${counts.full} full`);
  if (counts.popout > 0) summaryParts.push(`${counts.popout} popout`);
  if (counts.disabled > 0) summaryParts.push(`${counts.disabled} disabled`);

  return (
    // eslint-disable-next-line local/no-inline-styles -- dynamic style prop passed from parent
    <div style={style}>
      <div className="hmn-header">
        <span className="hmn-title">Historian Notes</span>
        <span className="hmn-summary">{summaryParts.join(", ")}</span>
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

HistorianMarginNotes.propTypes = {
  notes: PropTypes.array,
  sourceText: PropTypes.string,
  style: PropTypes.object,
  onUpdateNote: PropTypes.func,
};
