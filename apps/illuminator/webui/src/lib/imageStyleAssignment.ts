/**
 * Image Style Assignment — Deterministic corpus-level distribution
 *
 * Iteratively flattens the distribution across all candidates that appear in
 * any ranked position. Each round finds the most underrepresented candidate
 * and shifts the best donor (the item assigned to the most overrepresented
 * candidate that has the underrepresented one in its ranked list).
 *
 * After independent balancing of artistic/composition/palette dimensions,
 * a final pass checks for forbidden style×composition combinations and
 * swaps to the next-ranked alternative that isn't forbidden.
 */

import type { ArtisticStyle, CompositionStyle, StyleLibrary } from "@canonry/world-schema";
import { isExcludedPair, DEFAULT_RANDOM_EXCLUSIONS } from "@canonry/world-schema";

// ============================================================================
// Types
// ============================================================================

export interface ImageRefRanking {
  chronicleId: string;
  refId: string;
  rankedArtisticStyleIds: string[];
  rankedCompositionStyleIds: string[];
  rankedColorPaletteIds: string[];
}

export interface ImageStyleAssignmentEntry {
  chronicleId: string;
  refId: string;
  ranking: ImageRefRanking;
  assignedArtisticStyleId: string;
  assignedCompositionStyleId: string;
  assignedColorPaletteId: string;
  artisticShifted: boolean;
  compositionShifted: boolean;
  paletteShifted: boolean;
}

export interface ImageStyleAssignmentResult {
  entries: ImageStyleAssignmentEntry[];
  artisticDistribution: Map<string, number>;
  compositionDistribution: Map<string, number>;
  paletteDistribution: Map<string, number>;
}

// ============================================================================
// Core algorithm — diversity-targeting ranked distribution balancer
// ============================================================================

/**
 * Given items each with a ranked list of candidates, assign one candidate per
 * item targeting even distribution.
 *
 * Strategy: repeatedly find the most overrepresented candidate and shift one
 * of its assignments to the most underrepresented candidate that appears in
 * that item's ranked list. Skip candidates that can't be helped (no donors).
 * Continue until max - min <= 1 or no more shifts are possible.
 */
function balanceDistribution(
  rankedLists: string[][],
): Array<{ assigned: string; shifted: boolean }> {
  const n = rankedLists.length;
  if (n === 0) return [];

  // Start with rank-0 (top pick) for everyone
  const assignments = rankedLists.map((ranked) => ({
    assigned: ranked[0] || "",
    shifted: false,
  }));

  // Collect all candidates that appear in any ranking
  const allCandidates = new Set<string>();
  for (const ranked of rankedLists) {
    for (const id of ranked) allCandidates.add(id);
  }
  if (allCandidates.size <= 1) return assignments;

  // Build a reverse index: for each candidate, which items have it ranked?
  const candidateToItems = new Map<string, Array<{ itemIdx: number; rank: number }>>();
  for (let i = 0; i < n; i++) {
    for (let rank = 0; rank < rankedLists[i].length; rank++) {
      const id = rankedLists[i][rank];
      let list = candidateToItems.get(id);
      if (!list) {
        list = [];
        candidateToItems.set(id, list);
      }
      list.push({ itemIdx: i, rank });
    }
  }

  // Mutable counts — update incrementally instead of recomputing
  const counts = new Map<string, number>();
  for (const id of allCandidates) counts.set(id, 0);
  for (const a of assignments) {
    counts.set(a.assigned, (counts.get(a.assigned) || 0) + 1);
  }

  // Track candidates we've already tried and failed to shift to
  const stuck = new Set<string>();

  for (let round = 0; round < n * 5; round++) {
    // Find the most overrepresented candidate
    let overCandidate: string | null = null;
    let overCount = 0;
    for (const [id, count] of counts) {
      if (count > overCount) {
        overCandidate = id;
        overCount = count;
      }
    }

    // Find the most underrepresented candidate (excluding stuck ones)
    let underCandidate: string | null = null;
    let underCount = Infinity;
    for (const [id, count] of counts) {
      if (stuck.has(id)) continue;
      if (count < underCount) {
        underCandidate = id;
        underCount = count;
      }
    }

    // If spread is already tight, we're done
    if (!overCandidate || !underCandidate || overCount - underCount <= 1) break;

    // Find the best item to shift: currently assigned to an overrepresented
    // candidate, and has underCandidate in its ranked list.
    const donors = candidateToItems.get(underCandidate);
    if (!donors || donors.length === 0) {
      stuck.add(underCandidate);
      continue;
    }

    let bestIdx = -1;
    let bestScore = -Infinity;

    for (const { itemIdx, rank } of donors) {
      const currentAssigned = assignments[itemIdx].assigned;
      if (currentAssigned === underCandidate) continue;
      const donorCount = counts.get(currentAssigned) || 0;
      // Only take from candidates that are above the underrepresented count + 1
      // (otherwise we'd just swap one imbalance for another)
      if (donorCount <= underCount + 1) continue;
      // Score: prefer taking from the most overrepresented, with higher rank
      const score = donorCount * 100 - rank * 10;
      if (score > bestScore) {
        bestIdx = itemIdx;
        bestScore = score;
      }
    }

    if (bestIdx === -1) {
      stuck.add(underCandidate);
      continue;
    }

    // Perform the shift
    const oldAssigned = assignments[bestIdx].assigned;
    counts.set(oldAssigned, (counts.get(oldAssigned) || 0) - 1);
    counts.set(underCandidate, (counts.get(underCandidate) || 0) + 1);
    assignments[bestIdx].assigned = underCandidate;
    assignments[bestIdx].shifted = true;

    // The landscape changed — previously stuck candidates might now be shiftable
    stuck.clear();
  }

  return assignments;
}

// ============================================================================
// Forbidden combination enforcement
// ============================================================================

/**
 * After independent balancing, check each entry for forbidden
 * artistic×composition pairs. When found, try swapping the artistic style
 * to the next-ranked alternative that isn't forbidden with the assigned
 * composition. If no artistic alternative works, try swapping the composition.
 */
function enforceForbiddenCombinations(
  entries: ImageStyleAssignmentEntry[],
  rankings: ImageRefRanking[],
  artisticStyles: ArtisticStyle[],
  compositionStyles: CompositionStyle[],
): void {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!isExcludedPair(entry.assignedArtisticStyleId, entry.assignedCompositionStyleId, DEFAULT_RANDOM_EXCLUSIONS, artisticStyles, compositionStyles)) {
      continue;
    }

    // Try swapping artistic style first
    let swapped = false;
    for (const altStyleId of rankings[i].rankedArtisticStyleIds) {
      if (altStyleId === entry.assignedArtisticStyleId) continue;
      if (!isExcludedPair(altStyleId, entry.assignedCompositionStyleId, DEFAULT_RANDOM_EXCLUSIONS, artisticStyles, compositionStyles)) {
        entry.assignedArtisticStyleId = altStyleId;
        entry.artisticShifted = true;
        swapped = true;
        break;
      }
    }
    if (swapped) continue;

    // Try swapping composition
    for (const altCompId of rankings[i].rankedCompositionStyleIds) {
      if (altCompId === entry.assignedCompositionStyleId) continue;
      if (!isExcludedPair(entry.assignedArtisticStyleId, altCompId, DEFAULT_RANDOM_EXCLUSIONS, artisticStyles, compositionStyles)) {
        entry.assignedCompositionStyleId = altCompId;
        entry.compositionShifted = true;
        break;
      }
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

// ============================================================================
// Secondary assignment — pair-novelty greedy with shuffled iteration
// ============================================================================

export interface SecondaryAssignmentEntry {
  chronicleId: string;
  refId: string;
  secondaryArtisticStyleId: string;
  secondaryCompositionStyleId: string;
  secondaryColorPaletteId: string;
}

export interface SecondaryAssignmentResult {
  entries: SecondaryAssignmentEntry[];
  novelPairs: number;
  totalPairs: number;
}

/**
 * Assign secondary styles by picking from remaining ranked options (excluding
 * primary) and maximizing pairwise novelty across the corpus.
 *
 * Scoring: for a candidate combo (a, c, p), count how many of the 3 pairs
 * (a|c, a|p, c|p) have NOT been used yet. Higher = better. Ties broken randomly.
 *
 * The used-pairs set is seeded from all primary assignments, then updated as
 * each secondary is assigned.
 */
export function assignSecondaryStyles(
  rankings: ImageRefRanking[],
  primaryAssignments: Array<{
    chronicleId: string;
    refId: string;
    artisticStyleId: string;
    compositionStyleId: string;
    colorPaletteId: string;
  }>,
): SecondaryAssignmentResult {
  if (rankings.length === 0) {
    return { entries: [], novelPairs: 0, totalPairs: 0 };
  }

  // Build primary assignment lookup
  const primaryMap = new Map<string, typeof primaryAssignments[0]>();
  for (const p of primaryAssignments) {
    primaryMap.set(`${p.chronicleId}:${p.refId}`, p);
  }

  // Seed used-pairs set from primary assignments
  const usedPairs = new Set<string>();
  for (const p of primaryAssignments) {
    usedPairs.add(`a:${p.artisticStyleId}|c:${p.compositionStyleId}`);
    usedPairs.add(`a:${p.artisticStyleId}|p:${p.colorPaletteId}`);
    usedPairs.add(`c:${p.compositionStyleId}|p:${p.colorPaletteId}`);
  }

  // Shuffle iteration order to avoid systematic bias
  const indices = rankings.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const entries: SecondaryAssignmentEntry[] = new Array(rankings.length);
  let novelPairs = 0;
  let totalPairs = 0;

  for (const idx of indices) {
    const ranking = rankings[idx];
    const key = `${ranking.chronicleId}:${ranking.refId}`;
    const primary = primaryMap.get(key);
    if (!primary) continue;

    // Candidate pools: ranked options excluding primary
    const artCandidates = ranking.rankedArtisticStyleIds.filter(
      (id) => id !== primary.artisticStyleId,
    );
    const compCandidates = ranking.rankedCompositionStyleIds.filter(
      (id) => id !== primary.compositionStyleId,
    );
    const palCandidates = ranking.rankedColorPaletteIds.filter(
      (id) => id !== primary.colorPaletteId,
    );

    // Fallback: if filtering removed everything, use the full list
    const arts = artCandidates.length > 0 ? artCandidates : ranking.rankedArtisticStyleIds;
    const comps = compCandidates.length > 0 ? compCandidates : ranking.rankedCompositionStyleIds;
    const pals = palCandidates.length > 0 ? palCandidates : ranking.rankedColorPaletteIds;

    // Enumerate all combos, score by novel pair count
    let bestCombo = { a: arts[0], c: comps[0], p: pals[0] };
    let bestScore = -1;

    for (const a of arts) {
      for (const c of comps) {
        for (const p of pals) {
          let score = 0;
          if (!usedPairs.has(`a:${a}|c:${c}`)) score++;
          if (!usedPairs.has(`a:${a}|p:${p}`)) score++;
          if (!usedPairs.has(`c:${c}|p:${p}`)) score++;
          // Tie-break: add small random jitter
          if (score > bestScore || (score === bestScore && Math.random() > 0.5)) {
            bestScore = score;
            bestCombo = { a, c, p };
          }
        }
      }
    }

    // Record and update used pairs
    usedPairs.add(`a:${bestCombo.a}|c:${bestCombo.c}`);
    usedPairs.add(`a:${bestCombo.a}|p:${bestCombo.p}`);
    usedPairs.add(`c:${bestCombo.c}|p:${bestCombo.p}`);
    novelPairs += bestScore;
    totalPairs += 3;

    entries[idx] = {
      chronicleId: ranking.chronicleId,
      refId: ranking.refId,
      secondaryArtisticStyleId: bestCombo.a,
      secondaryCompositionStyleId: bestCombo.c,
      secondaryColorPaletteId: bestCombo.p,
    };
  }

  return { entries: entries.filter(Boolean), novelPairs, totalPairs };
}

// ============================================================================
// Primary assignment — diversity-targeting ranked distribution balancer
// ============================================================================

export function assignImageStyles(
  rankings: ImageRefRanking[],
  styleLibrary?: StyleLibrary | null,
): ImageStyleAssignmentResult {
  if (rankings.length === 0) {
    return {
      entries: [],
      artisticDistribution: new Map(),
      compositionDistribution: new Map(),
      paletteDistribution: new Map(),
    };
  }

  // Run independent distribution balancing for each dimension
  const artisticResults = balanceDistribution(
    rankings.map((r) => r.rankedArtisticStyleIds),
  );
  const compositionResults = balanceDistribution(
    rankings.map((r) => r.rankedCompositionStyleIds),
  );
  const paletteResults = balanceDistribution(
    rankings.map((r) => r.rankedColorPaletteIds),
  );

  // Build entries
  const entries: ImageStyleAssignmentEntry[] = rankings.map((r, i) => ({
    chronicleId: r.chronicleId,
    refId: r.refId,
    ranking: r,
    assignedArtisticStyleId: artisticResults[i].assigned,
    assignedCompositionStyleId: compositionResults[i].assigned,
    assignedColorPaletteId: paletteResults[i].assigned,
    artisticShifted: artisticResults[i].shifted,
    compositionShifted: compositionResults[i].shifted,
    paletteShifted: paletteResults[i].shifted,
  }));

  // Enforce forbidden style×composition combinations
  if (styleLibrary) {
    enforceForbiddenCombinations(
      entries, rankings,
      styleLibrary.artisticStyles, styleLibrary.compositionStyles,
    );
  }

  // Build distribution summaries
  const artisticDistribution = new Map<string, number>();
  const compositionDistribution = new Map<string, number>();
  const paletteDistribution = new Map<string, number>();
  for (const e of entries) {
    artisticDistribution.set(e.assignedArtisticStyleId, (artisticDistribution.get(e.assignedArtisticStyleId) || 0) + 1);
    compositionDistribution.set(e.assignedCompositionStyleId, (compositionDistribution.get(e.assignedCompositionStyleId) || 0) + 1);
    paletteDistribution.set(e.assignedColorPaletteId, (paletteDistribution.get(e.assignedColorPaletteId) || 0) + 1);
  }

  return { entries, artisticDistribution, compositionDistribution, paletteDistribution };
}
