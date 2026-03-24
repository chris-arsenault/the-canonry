/**
 * WikiPageHistorian - Historian annotation React components
 *
 * Provides callout rendering and tooltip display for historian notes
 * embedded in chronicle content.
 */

import React from "react";
import type { Optional } from "@the-canonry/shared-components";
import type { WikiHistorianNote } from "../types/world.ts";
import type { LayoutMode } from "./WikiPageLayout.ts";
import {
  HISTORIAN_NOTE_COLORS,
  HISTORIAN_NOTE_ICONS,
  HISTORIAN_NOTE_LABELS,
} from "../lib/historianAnnotations.ts";

/**
 * HistorianCallout - Callout box for 'full' display notes.
 * - 'flow': Floated right, text wraps around
 * - 'margin': Compact callout for side column in 3-column grid
 */
export function HistorianCallout({
  note,
  noteIndex,
  layoutMode = "flow",
}: Readonly<{
  note: WikiHistorianNote;
  noteIndex: Optional<number>;
  layoutMode: Optional<LayoutMode>;
}>) {
  const color = HISTORIAN_NOTE_COLORS[note.type] || HISTORIAN_NOTE_COLORS.commentary;
  const icon = HISTORIAN_NOTE_ICONS[note.type] || "\u2726";
  const label = HISTORIAN_NOTE_LABELS[note.type] || "Commentary";
  const indexLabel = noteIndex != null ? `${noteIndex + 1}` : "";

  if (layoutMode === "margin") {
    return (
      <aside
        className="margin-callout"
        data-note-id={note.noteId}
        style={{ "--note-color": color } as React.CSSProperties}
      >
        <div className="margin-callout-label">
          {indexLabel && <span className="note-index-label">{indexLabel}</span>}
          {icon} {label}
        </div>
        {note.text}
      </aside>
    );
  }

  // Flow mode: floated right callout
  return (
    <aside className="flow-callout" data-note-id={note.noteId} style={{ "--note-color": color } as React.CSSProperties}>
      <div className="note-type-label">
        {indexLabel && <span className="note-index-label">{indexLabel}</span>}
        {icon} {label}
      </div>
      {note.text}
    </aside>
  );
}

/**
 * HistorianFootnoteTooltip - Positioned callout box shown on hover of footnote markers
 */
export function HistorianFootnoteTooltip({
  note,
  noteIndex,
  position,
}: Readonly<{
  note: WikiHistorianNote;
  noteIndex: Optional<number>;
  position: { x: number; y: number };
}>) {
  const color = HISTORIAN_NOTE_COLORS[note.type] || HISTORIAN_NOTE_COLORS.commentary;
  const icon = HISTORIAN_NOTE_ICONS[note.type] || "\u2726";
  const label = HISTORIAN_NOTE_LABELS[note.type] || "Commentary";
  const indexLabel = noteIndex != null ? `${noteIndex + 1}` : "";

  // Position below the footnote marker
  const tooltipWidth = 340;
  let left = position.x - tooltipWidth / 2;
  if (left < 10) left = 10;
  if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10;

  return (
    <div
      className="footnote-tooltip"
      style={
        {
          "--tooltip-left": `${left}px`,
          "--tooltip-top": `${position.y + 8}px`,
          "--note-color": color,
        } as React.CSSProperties
      }
    >
      <div className="note-type-label">
        {indexLabel && <span className="note-index-label">{indexLabel}</span>}
        {icon} {label}
      </div>
      {note.text}
    </div>
  );
}
