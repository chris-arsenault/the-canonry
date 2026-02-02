/**
 * Random Utilities
 *
 * Functions for random selection and probability.
 */

/**
 * Fisher-Yates shuffle - produces unbiased random permutation.
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function pickMultiple<T>(array: T[], count: number): T[] {
  const shuffled = shuffle(array);
  return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Weighted random selection
 */
export function weightedRandom<T>(
  items: T[],
  weights: number[]
): T | undefined {
  if (items.length === 0 || items.length !== weights.length) return undefined;

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }

  return items[items.length - 1];
}

/**
 * Check if a probabilistic event should occur, scaled by an era modifier.
 *
 * @param baseProbability - Base chance of the event occurring (0.0 to 1.0)
 *                         e.g., 0.3 = 30% chance
 * @param eraModifier - Era-based multiplier for the probability
 *                      > 1 increases likelihood, < 1 decreases it
 * @returns true if the event should occur
 *
 * @example
 * // 30% base chance, doubled in conflict era (modifier = 2)
 * if (rollProbability(0.3, eraModifier)) {
 *   createConflict();
 * }
 */
export function rollProbability(baseProbability: number, eraModifier: number = 1.0): boolean {
  const p = baseProbability;

  // Edge cases: probability of 0 or 1 should be deterministic
  if (p <= 0) return false;
  if (p >= 1) return true;

  // odds scaling
  const odds = p / (1 - p);
  const scaledOdds = Math.pow(odds, eraModifier);
  const scaledP = scaledOdds / (1 + scaledOdds);

  return Math.random() < scaledP;
}
