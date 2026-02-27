/**
 * HistorianReviewModal - Review UI for historian annotations
 *
 * Shows the source text with highlighted anchor phrases and margin callouts.
 * Users can accept/reject/edit individual notes before applying them.
 */

import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { TONE_META } from "./HistorianToneSelector";
import "./HistorianReviewModal.css";

// ============================================================================
// Note Type Icons & Colors
// ============================================================================

const NOTE_TYPE_META = {
  commentary: {
    icon: "\u2726",
    color: "#8b7355",
    label: "Commentary"
  },
  correction: {
    icon: "!",
    color: "#c0392b",
    label: "Correction"
  },
  tangent: {
    icon: "~",
    color: "#7d6b91",
    label: "Tangent"
  },
  skepticism: {
    icon: "?",
    color: "#d4a017",
    label: "Skepticism"
  },
  pedantic: {
    icon: "#",
    color: "#5b7a5e",
    label: "Pedantic"
  }
};

// ============================================================================
// Single Note Card
// ============================================================================

function NoteCard({
  note,
  accepted,
  onToggle,
  onEditText
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(note.text);
  const meta = NOTE_TYPE_META[note.type] || NOTE_TYPE_META.commentary;
  return <div className={`hrm-note ${accepted !== false ? "hrm-note-accepted" : "hrm-note-rejected"}`} style={{
    "--hrm-note-color": meta.color
  }}>
      {/* Header */}
      <div className="hrm-note-header">
        <div className="hrm-note-header-left">
          <span className="hrm-note-type-icon">
            {meta.icon}
          </span>
          <span className="hrm-note-type-label">
            {meta.label}
          </span>
        </div>
        <button onClick={() => onToggle(note.noteId, accepted === false)} className={`hrm-note-toggle ${accepted !== false ? "hrm-note-toggle-accepted" : "hrm-note-toggle-rejected"}`}>
          {accepted !== false ? "\u2713 Accepted" : "Rejected"}
        </button>
      </div>

      {/* Anchor phrase */}
      <div className="hrm-note-anchor">
        anchored to: &ldquo;
        {note.anchorPhrase.length > 60 ? note.anchorPhrase.slice(0, 60) + "\u2026" : note.anchorPhrase}
        &rdquo;
      </div>

      {/* Note text */}
      {editing ? <div>
          <textarea value={editValue} onChange={e => setEditValue(e.target.value)} className="hrm-note-textarea" />
          <div className="hrm-note-edit-actions">
            <button onClick={() => {
          onEditText(note.noteId, editValue);
          setEditing(false);
        }} className="hrm-note-edit-btn hrm-note-edit-btn-save">
              Save
            </button>
            <button onClick={() => {
          setEditValue(note.text);
          setEditing(false);
        }} className="hrm-note-edit-btn hrm-note-edit-btn-cancel">
              Cancel
            </button>
          </div>
        </div> : <div onClick={() => setEditing(true)} title="Click to edit" className="hrm-note-text" role="button" tabIndex={0} onKeyDown={e => {
      if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
    }}>
          {note.text}
        </div>}
    </div>;
}
NoteCard.propTypes = {
  note: PropTypes.object,
  accepted: PropTypes.any,
  onToggle: PropTypes.func,
  onEditText: PropTypes.func
};

// ============================================================================
// Annotated Text View
// ============================================================================

function AnnotatedText({
  sourceText,
  notes,
  noteDecisions
}) {
  // Build segments of text with note markers
  const segments = useMemo(() => {
    if (!notes || notes.length === 0) {
      return [{
        type: "text",
        content: sourceText
      }];
    }

    // Find anchor positions
    const anchors = [];
    for (const note of notes) {
      const idx = sourceText.indexOf(note.anchorPhrase);
      if (idx >= 0) {
        anchors.push({
          start: idx,
          end: idx + note.anchorPhrase.length,
          note
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
        segs.push({
          type: "text",
          content: sourceText.slice(cursor, anchor.start)
        });
      }
      if (anchor.start >= cursor) {
        const meta = NOTE_TYPE_META[anchor.note.type] || NOTE_TYPE_META.commentary;
        const accepted = noteDecisions[anchor.note.noteId] !== false;
        segs.push({
          type: "anchor",
          content: sourceText.slice(anchor.start, anchor.end),
          note: anchor.note,
          meta,
          accepted
        });
        cursor = anchor.end;
      }
    }
    if (cursor < sourceText.length) {
      segs.push({
        type: "text",
        content: sourceText.slice(cursor)
      });
    }
    return segs;
  }, [sourceText, notes, noteDecisions]);
  return <div className="hrm-annotated-text">
      {segments.map((seg, i) => {
      if (seg.type === "text") {
        return <span key={i}>{seg.content}</span>;
      }
      return <span key={i} title={`${seg.meta.label}: ${seg.note.text}`} className={`hrm-anchor-span ${seg.accepted ? "hrm-anchor-span-accepted" : "hrm-anchor-span-rejected"}`}
      style={{
        "--hrm-anchor-bg": seg.accepted ? `${seg.meta.color}22` : "transparent",
        "--hrm-anchor-border": seg.accepted ? seg.meta.color : "var(--border-color)",
        "--hrm-anchor-sup-color": seg.meta.color
      }}>
            {seg.content}
            <sup className="hrm-anchor-sup">
              {seg.meta.icon}
            </sup>
          </span>;
    })}
    </div>;
}
AnnotatedText.propTypes = {
  sourceText: PropTypes.string,
  notes: PropTypes.array,
  noteDecisions: PropTypes.object
};

// ============================================================================
// Main Modal
// ============================================================================

export default function HistorianReviewModal({
  run,
  isActive,
  onToggleNote,
  onEditNoteText,
  onAccept,
  onCancel
}) {
  if (!isActive || !run) return null;
  const isGenerating = run.status === "pending" || run.status === "generating";
  const isReviewing = run.status === "reviewing";
  const isFailed = run.status === "failed";
  const notes = run.notes || [];
  const acceptedCount = notes.filter(n => run.noteDecisions[n.noteId] !== false).length;
  return <div className="hrm-overlay">
      <div className="hrm-modal">
        {/* Header */}
        <div className="hrm-modal-header">
          <div>
            <div className="hrm-modal-title">Historian Review &mdash; {run.targetName}</div>
            <div className="hrm-modal-subtitle">
              {run.targetType === "entity" ? "Entity Description" : "Chronicle Narrative"}
              {run.tone && TONE_META[run.tone] && <span className="hrm-modal-tone">
                  {TONE_META[run.tone].symbol} {TONE_META[run.tone].label}
                </span>}
              {isReviewing && ` \u00b7 ${acceptedCount}/${notes.length} notes accepted`}
            </div>
          </div>
          <button onClick={onCancel} className="hrm-modal-cancel-btn">
            Cancel
          </button>
        </div>

        {/* Content */}
        <div className="hrm-modal-content">
          {isGenerating && <div className="hrm-generating-message">The historian is reviewing the text\u2026</div>}

          {isFailed && <div className="hrm-failed-message">Review failed: {run.error || "Unknown error"}</div>}

          {isReviewing && <div className="hrm-review-layout">
              {/* Annotated source text */}
              <div>
                <div className="hrm-section-label">Source Text (annotations highlighted)</div>
                <AnnotatedText sourceText={run.sourceText} notes={notes} noteDecisions={run.noteDecisions} />
              </div>

              {/* Notes list */}
              <div>
                <div className="hrm-section-label">Historian Notes ({notes.length})</div>
                {notes.map(note => <NoteCard key={note.noteId} note={note} accepted={run.noteDecisions[note.noteId]} onToggle={onToggleNote} onEditText={onEditNoteText} />)}
              </div>
            </div>}
        </div>

        {/* Footer */}
        {isReviewing && <div className="hrm-modal-footer">
            <button onClick={onCancel} className="hrm-discard-btn">
              Discard All
            </button>
            <button onClick={onAccept} disabled={acceptedCount === 0} className={`hrm-apply-btn ${acceptedCount > 0 ? "hrm-apply-btn-active" : "hrm-apply-btn-disabled"}`}>
              Apply {acceptedCount} Note{acceptedCount !== 1 ? "s" : ""}
            </button>
          </div>}
      </div>
    </div>;
}
HistorianReviewModal.propTypes = {
  run: PropTypes.object,
  isActive: PropTypes.bool,
  onToggleNote: PropTypes.func,
  onEditNoteText: PropTypes.func,
  onAccept: PropTypes.func,
  onCancel: PropTypes.func
};
