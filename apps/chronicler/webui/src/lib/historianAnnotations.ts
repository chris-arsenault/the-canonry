/**
 * historianAnnotations - Constants and functions for historian annotation system
 *
 * Separated from WikiPageHistorian.tsx so that file exports only React components
 * (required by react-refresh/only-export-components for HMR).
 */

import type { WikiHistorianNote } from "../types/world.ts";
import { resolveAnchorPhrase } from "./fuzzyAnchor.ts";

export const HISTORIAN_NOTE_COLORS: Record<string, string> = {
  commentary: "#c49a5c",
  correction: "#c0392b",
  tangent: "#8b7355",
  skepticism: "#d4a017",
  pedantic: "#5b7a5e",
};

export const HISTORIAN_NOTE_ICONS: Record<string, string> = {
  commentary: "\u2726",
  correction: "!",
  tangent: "~",
  skepticism: "?",
  pedantic: "#",
};

export const HISTORIAN_NOTE_LABELS: Record<string, string> = {
  commentary: "Commentary",
  correction: "Correction",
  tangent: "Tangent",
  skepticism: "Skepticism",
  pedantic: "Pedantic",
};

/** Build an HTML superscript tag for a footnote marker. */
function buildFootnoteSup(noteIdx: number, noteType: string): string {
  const color = HISTORIAN_NOTE_COLORS[noteType] || "#8b7355";
  return `<sup class="historian-fn" data-note-idx="${noteIdx}" style="color:${color};cursor:pointer;font-weight:700;font-size:12px;margin-left:2px">${noteIdx + 1}</sup>`;
}

/**
 * Inject footnote-style superscript markers into markdown content for all notes.
 * Returns the modified content and the ordered list of matched notes (for tooltip lookup).
 */
export function injectFootnotes(
  content: string,
  notes: WikiHistorianNote[],
): { content: string; orderedNotes: WikiHistorianNote[] } {
  if (!notes || notes.length === 0) return { content, orderedNotes: [] };

  const resolved: Array<{ note: WikiHistorianNote; index: number; phraseLen: number }> = [];
  for (const note of notes) {
    const match = resolveAnchorPhrase(note.anchorPhrase, content);
    if (match) {
      resolved.push({ note, index: match.index, phraseLen: match.phrase.length });
    }
  }
  resolved.sort((a, b) => a.index - b.index);

  const orderedNotes = resolved.map((r) => r.note);

  let result = content;
  for (let i = resolved.length - 1; i >= 0; i--) {
    const { index, phraseLen } = resolved[i];
    const insertAt = index + phraseLen;
    const sup = buildFootnoteSup(i, resolved[i].note.type);
    result = result.slice(0, insertAt) + sup + result.slice(insertAt);
  }

  return { content: result, orderedNotes };
}

/**
 * Inject footnote superscripts into a text slice using global indices from orderedNotes.
 */
export function injectFootnotesWithGlobalIndex(
  slice: string,
  allNotes: WikiHistorianNote[],
  orderedNotes: WikiHistorianNote[],
): string {
  if (!allNotes || allNotes.length === 0) return slice;

  const resolved: Array<{
    note: WikiHistorianNote;
    index: number;
    phraseLen: number;
    globalIdx: number;
  }> = [];
  for (const note of allNotes) {
    const match = resolveAnchorPhrase(note.anchorPhrase, slice);
    if (match) {
      const globalIdx = orderedNotes.indexOf(note);
      if (globalIdx >= 0) {
        resolved.push({ note, index: match.index, phraseLen: match.phrase.length, globalIdx });
      }
    }
  }
  resolved.sort((a, b) => a.index - b.index);

  let result = slice;
  for (let i = resolved.length - 1; i >= 0; i--) {
    const { index, phraseLen, globalIdx, note } = resolved[i];
    const insertAt = index + phraseLen;
    const sup = buildFootnoteSup(globalIdx, note.type);
    result = result.slice(0, insertAt) + sup + result.slice(insertAt);
  }

  return result;
}
