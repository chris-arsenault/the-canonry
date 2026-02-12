/**
 * Chronicle Copy-Edit Prompt Builder
 *
 * Builds prompts for the copy-edit polish pass. Receives the text plus minimal
 * craft context: style name, craft posture, and PS voice textures/motifs.
 * No world facts, entity data, or generation prompts — the LLM edits the prose
 * as written, not the prose as intended. Voice textures and motifs help the
 * editor recognize what's intentional so it doesn't cut characterizing material.
 */

import type { NarrativeStyle, StoryNarrativeStyle, DocumentNarrativeStyle } from '@canonry/world-schema';

// =============================================================================
// Word count extraction (handles story vs document format)
// =============================================================================

function getWordCountRange(style: NarrativeStyle): { min: number; max: number } {
  if (style.format === 'story') {
    return (style as StoryNarrativeStyle).pacing.totalWordCount;
  }
  const docStyle = style as DocumentNarrativeStyle;
  if (docStyle.pacing?.wordCount) {
    return docStyle.pacing.wordCount;
  }
  // Legacy format fallback
  const legacy = docStyle as unknown as { documentConfig?: { wordCount?: { min: number; max: number } } };
  if (legacy.documentConfig?.wordCount) {
    return legacy.documentConfig.wordCount;
  }
  return { min: 400, max: 600 };
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// =============================================================================
// System prompt
// =============================================================================

export function buildCopyEditSystemPrompt(format: 'story' | 'document'): string {
  if (format === 'document') {
    return `You are a senior editor doing a final polish on an in-universe document that was assembled from multiple drafts. Your job is to burnish it — make it cleaner, tighter, more convincing as an artifact — not to rewrite it.

What you must preserve:
- Every piece of information the document conveys. If the same information appears in two sections that serve different purposes (e.g. a summary and a detailed account), both belong. If two sections serve the same purpose — a common artifact of combining drafts — merge them into one. Nothing the document *says* changes, but it shouldn't say the same thing twice for the same reason.
- The document's voice and register. A bureaucratic report should stay bureaucratic. A folk collection should stay collected. Do not normalize register across sections that are intentionally different (e.g. quoted material vs. editorial framing).
- World details. Names, places, customs, terminology, formatting conventions — leave them exactly as they are.

What you are here to do:

Smooth the seams. This text was stitched together from different drafts. Where the register, density, or level of formality shifts abruptly between sections, ease the transition. The document should read as a single coherent artifact.

Tighten. Every word should earn its place. Look for redundant framing ("it should be noted that"), bureaucratic padding that doesn't serve the document's voice, repeated information that appears in multiple sections for the same purpose, and explanations that duplicate what the document already establishes.

Cut what doesn't work. If a section catalogs information without purpose, repeats the same content in template form, or pads the document without adding substance, you have permission to compress or remove it. Machine-generation patterns — template repetition, list-like sequences, prompt content surfacing as document text — should be broken or cut.

Read for consistency. Formatting conventions (headers, dates, citations, marginalia) should be uniform throughout. Where a convention appears in one section but not another, extend it.

What you must not do:
- Do not add new content, information, sections, or world details.
- Do not impose a different voice on the document. Burnish the voice that is already there.
- Do not restructure sections unless they are genuinely confusing.
- Do not modernize or standardize language that is intentionally archaic or formal.

Your changes should be invisible. A reader should not be able to tell the document was edited.

Output only the edited text — no commentary, no tracked changes, no explanations.`;
  }

  return `You are a senior fiction editor doing a final polish on a piece that was assembled from multiple drafts. Your job is to burnish it — make it cleaner, clearer, more efficient — not to rewrite it.

What you must preserve:
- Every plot point and beat. If two scenes serve the same narrative purpose — a common artifact of combining drafts — merge them into one. Scenes that cover the same event from different perspectives or for different reasons each belong; scenes that do the same dramatic work twice do not. Nothing that *happens* in the story changes, but the reader shouldn't experience the same purpose served twice.
- Character voices. Where characters speak in distinct registers — dialect, formality, cultural cadence — that is intentional. Do not standardize dialogue or testimony into a uniform voice.
- World details. Names, places, customs, terminology — leave them exactly as they are.

What you are here to do:

Smooth the seams. This text was stitched together from different drafts. Where the prose rhythm changes abruptly — a shift in sentence length, descriptive density, or level of ornateness — ease the transition. The reader should never feel a bump between sections.

Tighten. Every word should earn its place. Look for filter words that create distance ("she noticed," "he felt"), redundant modifiers, stage directions that reveal nothing about character, and emotional explanations that duplicate what the prose already shows. Where the same detail appears twice because it was imported from two different drafts, keep whichever instance lands harder and cut the other.

Cut what doesn't work. If a passage catalogs names or events in sequence, repeats the same dramatic beat in parallel structure (e.g., three characters experiencing the same effect in the same paragraph shape), or reads as a report of what happened rather than lived experience, you have permission to compress or remove it. Machine-generation patterns — template repetition, list-like sequences, prompt content surfacing as narrative — should be broken or cut.

Read for rhythm. Where a sentence fights you or the prose stumbles, recast it — but preserve its content and intent. If a passage is deliberately languid or dense, that may be the style working as intended. Only intervene where the prose works against the effect it is trying to achieve.

What you must not do:
- Do not add new content, ideas, scenes, details, or metaphors.
- Do not impose a different voice on the narration. Burnish the voice that is already there.
- Do not restructure paragraphs unless they are genuinely confusing.
- Do not flatten distinctive character speech into standard grammar.

Your changes should be invisible. A reader should not be able to tell the text was edited.

Output only the edited text — no commentary, no tracked changes, no explanations.`;
}

// =============================================================================
// User prompt
// =============================================================================

export function buildCopyEditUserPrompt(
  text: string,
  style: NarrativeStyle,
  voiceContext?: {
    narrativeVoice?: Record<string, string>;
    motifs?: string[];
  },
): string {
  const target = getWordCountRange(style);
  const currentWords = countWords(text);
  const styleName = style.name;
  const craftPosture = 'craftPosture' in style ? (style.craftPosture as string | undefined) : undefined;

  const parts: string[] = [];

  parts.push(`## Format\n${styleName}`);

  parts.push(`## Length\nThe piece is ${currentWords} words. The natural range for this format is ${target.min}–${target.max}. Use this as context for what length feels natural, but your job is to improve the prose, not to hit a number. If the piece needs to be shorter, cut what doesn't work. If it needs room, let it breathe.`);

  if (craftPosture) {
    parts.push(`## Craft Posture\n${craftPosture}`);
  }

  // Voice textures help the editor recognize intentional prose choices
  const nv = voiceContext?.narrativeVoice;
  if (nv && Object.keys(nv).length > 0) {
    const voiceLines = Object.entries(nv)
      .map(([key, value]) => `**${key}**: ${value}`)
      .join('\n');
    parts.push(`## Voice Textures (preserve these — they are intentional)\n${voiceLines}`);
  }

  // Motifs help the editor recognize structural repetition vs draft artifacts
  const motifs = voiceContext?.motifs;
  if (motifs && motifs.length > 0) {
    const motifLines = motifs.map(m => `- "${m}"`).join('\n');
    parts.push(`## Recurring Motifs (these are structural — do not cut or collapse)\n${motifLines}`);
  }

  parts.push(`## Text\n\n${text}`);

  return parts.join('\n\n');
}
