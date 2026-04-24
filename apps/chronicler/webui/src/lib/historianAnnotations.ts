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

/** Section separator used when concatenating sections for global resolution. */
const SECTION_SEPARATOR = "\n\n---SECTION---\n\n";

/**
 * Resolve all historian notes against the full page content (all sections concatenated).
 * Returns per-section resolved entries with globally consistent indices.
 */
export function resolveGlobalFootnotes(
  sections: Array<{ content: string }>,
  notes: WikiHistorianNote[],
): { perSection: ResolvedFootnote[][]; globalOrderedNotes: WikiHistorianNote[] } {
  if (!notes || notes.length === 0 || sections.length === 0) {
    return { perSection: sections.map(() => []), globalOrderedNotes: [] };
  }

  // Build concatenated content with tracked section boundaries
  const sectionOffsets: Array<{ start: number; end: number }> = [];
  let fullContent = "";
  for (const section of sections) {
    const start = fullContent.length;
    fullContent += section.content;
    sectionOffsets.push({ start, end: fullContent.length });
    fullContent += SECTION_SEPARATOR;
  }

  // Resolve all notes against the full content
  const resolved: Array<{ note: WikiHistorianNote; index: number; phraseLen: number }> = [];
  for (const note of notes) {
    const match = resolveAnchorPhrase(note.anchorPhrase, fullContent);
    if (match) {
      resolved.push({ note, index: match.index, phraseLen: match.phrase.length });
    }
  }
  resolved.sort((a, b) => a.index - b.index);

  const globalOrderedNotes = resolved.map((r) => r.note);

  // Assign global indices and partition into sections
  const perSection: ResolvedFootnote[][] = sections.map(() => []);
  for (let globalIdx = 0; globalIdx < resolved.length; globalIdx++) {
    const r = resolved[globalIdx];
    // Find which section this note falls in
    for (let si = 0; si < sectionOffsets.length; si++) {
      const { start, end } = sectionOffsets[si];
      if (r.index >= start && r.index < end) {
        perSection[si].push({
          note: r.note,
          index: r.index - start, // local index within the section
          phraseLen: r.phraseLen,
          globalIdx,
        });
        break;
      }
    }
  }

  return { perSection, globalOrderedNotes };
}

export interface ResolvedFootnote {
  note: WikiHistorianNote;
  /** Character index of the anchor in the source content */
  index: number;
  /** Length of the matched anchor phrase */
  phraseLen: number;
  /** Global footnote number (0-based) */
  globalIdx: number;
}

/**
 * Inject footnote-style superscript markers into markdown content for all notes.
 * Returns the modified content, the ordered list of matched notes (for tooltip lookup),
 * and the resolved entries with positions (for flow-mode fragment injection).
 */
export function injectFootnotes(
  content: string,
  notes: WikiHistorianNote[],
): { content: string; orderedNotes: WikiHistorianNote[]; resolvedEntries: ResolvedFootnote[] } {
  if (!notes || notes.length === 0) return { content, orderedNotes: [], resolvedEntries: [] };

  const resolved: Array<{ note: WikiHistorianNote; index: number; phraseLen: number }> = [];
  for (const note of notes) {
    const match = resolveAnchorPhrase(note.anchorPhrase, content);
    if (match) {
      resolved.push({ note, index: match.index, phraseLen: match.phrase.length });
    }
  }
  resolved.sort((a, b) => a.index - b.index);

  const orderedNotes = resolved.map((r) => r.note);
  const resolvedEntries: ResolvedFootnote[] = resolved.map((r, i) => ({
    ...r,
    globalIdx: i,
  }));

  let result = content;
  for (let i = resolved.length - 1; i >= 0; i--) {
    const { index, phraseLen } = resolved[i];
    const insertAt = index + phraseLen;
    const sup = buildFootnoteSup(i, resolved[i].note.type);
    result = result.slice(0, insertAt) + sup + result.slice(insertAt);
  }

  return { content: result, orderedNotes, resolvedEntries };
}

