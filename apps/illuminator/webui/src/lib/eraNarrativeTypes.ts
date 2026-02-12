/**
 * Era Narrative Types
 *
 * Data structures for the multi-chapter era narrative system.
 * The historian writes long-form narrative history for an era,
 * drawing on per-chronicle prep briefs as source material.
 *
 * Pipeline: threads → chapter → chapter_edit → title
 * Each step pauses for review before advancing.
 */

import type { HistorianTone } from './historianTypes';

// =============================================================================
// Steps & Status
// =============================================================================

export type EraNarrativeStep = 'threads' | 'chapter' | 'chapter_edit' | 'title';

export type EraNarrativeStatus =
  | 'pending'
  | 'generating'
  | 'step_complete'
  | 'complete'
  | 'cancelled'
  | 'failed';

// =============================================================================
// Thread Synthesis Output
// =============================================================================

export interface EraNarrativeThread {
  threadId: string;
  name: string;
  description: string;
  chronicleIds: string[];
  keyCharacters: string[];
  arc: string;
}

export interface EraNarrativeChapterPlan {
  chapterIndex: number;
  title: string;
  yearRange: [number, number];
  chronicleIds: string[];
  threadIds: string[];
  beats: string;
  historianAngle: string;
}

export interface EraNarrativeThreadSynthesis {
  threads: EraNarrativeThread[];
  chapterPlan: EraNarrativeChapterPlan[];
  thesis: string;
  motifs: string[];
  openingImage: string;
  closingImage: string;
  generatedAt: number;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  inputTokens: number;
  outputTokens: number;
  actualCost: number;
}

// =============================================================================
// Chapter Data
// =============================================================================

export interface EraNarrativeChapter {
  chapterIndex: number;
  title: string;
  content: string;
  editedContent?: string;
  wordCount: number;
  editedWordCount?: number;
  generatedAt: number;
  editedAt?: number;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  inputTokens: number;
  outputTokens: number;
  actualCost: number;
  editSystemPrompt?: string;
  editUserPrompt?: string;
  editInputTokens?: number;
  editOutputTokens?: number;
  editActualCost?: number;
}

// =============================================================================
// Prep Brief (per-chronicle input to thread synthesis)
// =============================================================================

export interface EraNarrativePrepBrief {
  chronicleId: string;
  chronicleTitle: string;
  eraYear?: number;
  prep: string;
}

// =============================================================================
// Era Narrative Record (persisted to IndexedDB)
// =============================================================================

export interface EraNarrativeRecord {
  narrativeId: string;
  projectId: string;
  simulationRunId: string;
  eraId: string;
  eraName: string;

  status: EraNarrativeStatus;
  error?: string;

  tone: HistorianTone;
  historianConfigJson: string;

  currentStep: EraNarrativeStep;
  currentChapterIndex: number;

  prepBriefs: EraNarrativePrepBrief[];
  threadSynthesis?: EraNarrativeThreadSynthesis;
  chapters: EraNarrativeChapter[];

  titleCandidates?: string[];
  titleFragments?: string[];
  selectedTitle?: string;

  totalInputTokens: number;
  totalOutputTokens: number;
  totalActualCost: number;

  createdAt: number;
  updatedAt: number;
}
