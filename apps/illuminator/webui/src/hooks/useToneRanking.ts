/**
 * useToneRanking — Bulk tone ranking + corpus assignment for chronicle historian reviews
 *
 * Two-phase workflow:
 * 1. LLM Ranking: Haiku reads each chronicle's summary and ranks top 3 tones.
 *    Results stored on chronicle record as toneRanking.
 * 2. Corpus Assignment: Algorithmic pass that assigns actual tones with strong
 *    rank-1 preference but shifts to rank-2/3 to balance distribution.
 *    Result stored as assignedTone.
 *
 * State lives in toneRankingStore (Zustand) so it survives component unmounts.
 * This hook is a thin accessor for components.
 */

import { useToneRankingStore } from '../lib/db/toneRankingStore';
import type { HistorianTone } from '../lib/historianTypes';

// ============================================================================
// Types (re-exported for consumers)
// ============================================================================

export interface ToneRankingChronicleSummary {
  chronicleId: string;
  title: string;
}

export interface ToneRankingProgress {
  status: 'idle' | 'confirming' | 'running' | 'complete' | 'cancelled' | 'failed';
  chronicles: ToneRankingChronicleSummary[];
  totalChronicles: number;
  processedChronicles: number;
  currentTitle: string;
  totalCost: number;
  error?: string;
  failedChronicles: Array<{ chronicleId: string; title: string; error: string }>;
}

export interface ToneAssignmentEntry {
  chronicleId: string;
  title: string;
  ranking: [HistorianTone, HistorianTone, HistorianTone];
  assignedTone: HistorianTone;
  wasShifted: boolean;
}

export interface ToneAssignmentPreview {
  entries: ToneAssignmentEntry[];
  distribution: Record<HistorianTone, number>;
}

export interface UseToneRankingReturn {
  // Phase 1: LLM ranking
  progress: ToneRankingProgress;
  isActive: boolean;
  prepareToneRanking: (chronicleItems: import('../lib/db/chronicleNav').ChronicleNavItem[]) => void;
  confirmToneRanking: () => void;
  cancelToneRanking: () => void;
  closeToneRanking: () => void;

  // Phase 2: Corpus assignment
  assignmentPreview: ToneAssignmentPreview | null;
  prepareAssignment: () => Promise<void>;
  applyAssignment: (entries: ToneAssignmentEntry[]) => Promise<void>;
  closeAssignment: () => void;
}

// ============================================================================
// Assignment Algorithm (pure functions, used by store)
// ============================================================================

const ANNOTATION_TONES: HistorianTone[] = ['witty', 'weary', 'elegiac', 'cantankerous', 'rueful', 'conspiratorial', 'bemused'];

/**
 * Assign tones to chronicles with strong rank-1 preference but distribution balancing.
 * Chronicles only shift from rank-1 if their preferred tone is heavily overrepresented
 * AND they have a good alternative that fills an underrepresented slot.
 */
export function assignCorpusTones(
  chronicles: Array<{ chronicleId: string; title: string; ranking: [HistorianTone, HistorianTone, HistorianTone] }>,
): ToneAssignmentEntry[] {
  const entries: ToneAssignmentEntry[] = chronicles.map((c) => ({
    chronicleId: c.chronicleId,
    title: c.title,
    ranking: c.ranking,
    assignedTone: c.ranking[0],
    wasShifted: false,
  }));

  const target = entries.length / ANNOTATION_TONES.length;
  const ceiling = Math.ceil(target * 1.2);

  for (let round = 0; round < 50; round++) {
    const counts = countDistribution(entries);

    let overTone: HistorianTone | null = null;
    let overCount = ceiling;
    for (const t of ANNOTATION_TONES) {
      if (counts[t] > overCount) {
        overTone = t;
        overCount = counts[t];
      }
    }
    if (!overTone) break;

    let shifted = false;
    const candidates = entries
      .filter((e) => e.assignedTone === overTone)
      .map((e) => {
        for (const altRank of [1, 2] as const) {
          const alt = e.ranking[altRank];
          if (alt && counts[alt] < counts[overTone!]) {
            return { entry: e, alt, priority: altRank * 100 + counts[alt] };
          }
        }
        return null;
      })
      .filter((c): c is { entry: ToneAssignmentEntry; alt: HistorianTone; priority: number } => c !== null)
      .sort((a, b) => a.priority - b.priority);

    if (candidates.length > 0) {
      const best = candidates[0];
      best.entry.assignedTone = best.alt;
      best.entry.wasShifted = true;
      shifted = true;
    }

    if (!shifted) break;
  }

  return entries;
}

export function countDistribution(entries: ToneAssignmentEntry[]): Record<HistorianTone, number> {
  const counts = Object.fromEntries(ANNOTATION_TONES.map((t) => [t, 0])) as Record<HistorianTone, number>;
  for (const e of entries) {
    if (counts[e.assignedTone] !== undefined) counts[e.assignedTone]++;
  }
  return counts;
}

// ============================================================================
// Hook — thin accessor over toneRankingStore
// ============================================================================

export function useToneRanking(): UseToneRankingReturn {
  const progress = useToneRankingStore((s) => s.progress);
  const assignmentPreview = useToneRankingStore((s) => s.assignmentPreview);
  const prepareToneRanking = useToneRankingStore((s) => s.prepareToneRanking);
  const confirmToneRanking = useToneRankingStore((s) => s.confirmToneRanking);
  const cancelToneRanking = useToneRankingStore((s) => s.cancelToneRanking);
  const closeToneRanking = useToneRankingStore((s) => s.closeToneRanking);
  const prepareAssignment = useToneRankingStore((s) => s.prepareAssignment);
  const applyAssignment = useToneRankingStore((s) => s.applyAssignment);
  const closeAssignment = useToneRankingStore((s) => s.closeAssignment);

  const isActive = progress.status === 'running' || progress.status === 'confirming';

  return {
    progress,
    isActive,
    prepareToneRanking,
    confirmToneRanking,
    cancelToneRanking,
    closeToneRanking,
    assignmentPreview,
    prepareAssignment,
    applyAssignment,
    closeAssignment,
  };
}
