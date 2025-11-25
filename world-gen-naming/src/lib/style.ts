import type { StyleRules } from "../types/domain.js";
import { chance } from "../utils/rng.js";
import {
  applyCapitalization,
  findSyllableBoundaries,
  insertAtBoundary,
  endsWithAny,
} from "../utils/helpers.js";

/**
 * Apply stylistic transforms to a name
 */
export function applyStyle(
  rng: () => number,
  name: string,
  style: StyleRules,
  syllables?: string[]
): { result: string; transforms: string[] } {
  let result = name;
  const transforms: string[] = [];

  // Apply defaults for optional fields
  const apostropheRate = style.apostropheRate ?? 0;
  const hyphenRate = style.hyphenRate ?? 0;
  const capitalization = style.capitalization ?? "title";

  // 1. Apply apostrophes
  if (
    apostropheRate > 0 &&
    chance(rng, apostropheRate) &&
    syllables &&
    syllables.length > 1
  ) {
    const boundaries = findSyllableBoundaries(result, syllables);
    if (boundaries.length > 0) {
      result = insertAtBoundary(result, "'", boundaries, rng);
      transforms.push("apostrophe");
    }
  }

  // 2. Apply hyphens
  if (
    hyphenRate > 0 &&
    chance(rng, hyphenRate) &&
    syllables &&
    syllables.length > 1
  ) {
    const boundaries = findSyllableBoundaries(result, syllables);
    if (boundaries.length > 0) {
      result = insertAtBoundary(result, "-", boundaries, rng);
      transforms.push("hyphen");
    }
  }

  // 3. Apply capitalization
  result = applyCapitalization(result, capitalization);
  transforms.push(`cap:${capitalization}`);

  return { result, transforms };
}

/**
 * Check if a name has a preferred ending
 */
export function hasPreferredEnding(
  name: string,
  preferredEndings?: string[]
): boolean {
  if (!preferredEndings || preferredEndings.length === 0) {
    return false;
  }
  return endsWithAny(name, preferredEndings);
}

/**
 * Generate multiple candidates and boost those with preferred endings
 */
export function selectWithPreferredEndings<T>(
  rng: () => number,
  candidates: T[],
  nameExtractor: (candidate: T) => string,
  preferredEndings?: string[],
  boost: number = 2.0
): T {
  if (
    !preferredEndings ||
    preferredEndings.length === 0 ||
    candidates.length === 0
  ) {
    // No preference, pick uniformly
    return candidates[Math.floor(rng() * candidates.length)];
  }

  // Calculate weights
  const weights = candidates.map((candidate) => {
    const name = nameExtractor(candidate);
    return hasPreferredEnding(name, preferredEndings) ? boost : 1.0;
  });

  // Weighted selection
  const total = weights.reduce((sum, w) => sum + w, 0);
  const r = rng() * total;
  let cumulative = 0;

  for (let i = 0; i < candidates.length; i++) {
    cumulative += weights[i];
    if (r < cumulative) {
      return candidates[i];
    }
  }

  // Fallback
  return candidates[candidates.length - 1];
}

/**
 * Apply rhythm-based adjustments to a name
 * This is a placeholder for future enhancement
 */
export function applyRhythmBias(
  name: string,
  rhythmBias?: "soft" | "harsh" | "staccato" | "flowing" | "neutral"
): string {
  // For now, rhythm bias is primarily enforced during phonology generation
  // This could be extended to do post-processing transformations
  switch (rhythmBias) {
    case "soft":
      // Could soften harsh consonant clusters
      return name;
    case "harsh":
      // Could emphasize consonants
      return name;
    case "staccato":
      // Could add more syllable breaks
      return name;
    case "flowing":
      // Could smooth transitions
      return name;
    case "neutral":
    default:
      return name;
  }
}

/**
 * Validate that a name meets style constraints
 */
export function validateStyle(name: string, style: StyleRules): boolean {
  // Basic validation
  if (name.length === 0) {
    return false;
  }

  // Could add more complex validation:
  // - Check apostrophe/hyphen placement
  // - Verify capitalization
  // - Ensure no double apostrophes, etc.

  return true;
}

/**
 * Apply all stylistic transforms and select best candidate
 */
export function applyStyleWithCandidates(
  rng: () => number,
  candidates: string[],
  style: StyleRules,
  syllablesPerCandidate?: string[][]
): string {
  if (candidates.length === 0) {
    throw new Error("No candidates provided");
  }

  // Generate styled versions
  const styledCandidates = candidates.map((name, index) => {
    const syllables = syllablesPerCandidate?.[index];
    const { result } = applyStyle(rng, name, style, syllables);
    return result;
  });

  // Select with preferred endings boost
  return selectWithPreferredEndings(
    rng,
    styledCandidates,
    (name) => name,
    style.preferredEndings,
    style.preferredEndingBoost
  );
}

/**
 * Strip style markers for comparison
 * Useful for validation and deduplication
 */
export function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/['\-\s]/g, "") // Remove apostrophes, hyphens, spaces
    .trim();
}

/**
 * Check if two names are too similar (considering style variations)
 */
export function areTooSimilar(name1: string, name2: string): boolean {
  const norm1 = normalizeForComparison(name1);
  const norm2 = normalizeForComparison(name2);
  return norm1 === norm2;
}
