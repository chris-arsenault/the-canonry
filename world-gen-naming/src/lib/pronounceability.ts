/**
 * Pronounceability metrics
 *
 * Implements academically-grounded pronounceability scoring:
 * - Template legality (syllable structure matching)
 * - Sonority sequencing (natural sound flow)
 * - Harmonic constraints (phonotactic rules)
 */

import type { PhonologyProfile } from "../types/domain.js";

/**
 * Default sonority ranks (0=lowest, 5=highest)
 */
const DEFAULT_SONORITY: Record<string, number> = {
  // Stops (lowest)
  p: 0,
  b: 0,
  t: 0,
  d: 0,
  k: 0,
  g: 0,
  // Fricatives
  f: 1,
  v: 1,
  s: 1,
  z: 1,
  th: 1,
  sh: 1,
  // Nasals
  m: 2,
  n: 2,
  ng: 2,
  // Liquids
  l: 3,
  r: 3,
  // Glides
  w: 4,
  y: 4,
  j: 4,
  // Vowels (highest)
  a: 5,
  e: 5,
  i: 5,
  o: 5,
  u: 5,
  ae: 5,
  oo: 5,
};

/**
 * Check if a character/phoneme is a vowel
 */
function isVowel(phoneme: string): boolean {
  const vowelPattern = /[aeiouäöüæœ]/i;
  return vowelPattern.test(phoneme);
}

/**
 * Get sonority rank for a phoneme
 */
function getSonority(phoneme: string, customRanks?: Record<string, number>): number {
  if (customRanks && phoneme in customRanks) {
    return customRanks[phoneme];
  }
  if (phoneme in DEFAULT_SONORITY) {
    return DEFAULT_SONORITY[phoneme];
  }
  // Default heuristic: if contains vowel, it's high sonority
  return isVowel(phoneme) ? 5 : 1;
}

/**
 * Count maximum consecutive consonants in a name
 */
export function countMaxConsonantCluster(name: string): number {
  let maxCluster = 0;
  let currentCluster = 0;

  for (const char of name.toLowerCase()) {
    if (isVowel(char)) {
      maxCluster = Math.max(maxCluster, currentCluster);
      currentCluster = 0;
    } else if (char.match(/[a-z]/)) {
      // Only count letters, skip apostrophes/hyphens
      currentCluster++;
    }
  }

  return Math.max(maxCluster, currentCluster);
}

/**
 * Check vowel spacing (max consonants between vowels)
 */
export function checkVowelSpacing(name: string): number {
  const chars = name.toLowerCase().split("");
  let maxGap = 0;
  let currentGap = 0;
  let foundVowel = false;

  for (const char of chars) {
    if (isVowel(char)) {
      maxGap = Math.max(maxGap, currentGap);
      currentGap = 0;
      foundVowel = true;
    } else if (char.match(/[a-z]/)) {
      if (foundVowel) {
        currentGap++;
      }
    }
  }

  return maxGap;
}

/**
 * Score sonority sequencing violations
 *
 * Checks if syllables follow natural sonority rises/falls:
 * - Onsets should have rising sonority
 * - Codas should have falling sonority
 *
 * Returns: normalized score 0-1 (1 = perfect, 0 = many violations)
 */
export function scoreSonoritySequencing(
  name: string,
  phonemes: string[],
  customRanks?: Record<string, number>
): number {
  if (phonemes.length === 0) return 1.0;

  let violations = 0;
  let transitions = 0;

  // Scan through phoneme sequence
  for (let i = 0; i < phonemes.length - 1; i++) {
    const current = phonemes[i];
    const next = phonemes[i + 1];

    const currentSonority = getSonority(current, customRanks);
    const nextSonority = getSonority(next, customRanks);

    transitions++;

    // If we're going from consonant to consonant
    if (currentSonority < 5 && nextSonority < 5) {
      // In onset (start of syllable), sonority should rise
      // In coda (end of syllable), sonority should fall
      // We penalize plateaus or inversions in consonant clusters
      if (nextSonority < currentSonority) {
        violations++;
      }
    }
  }

  if (transitions === 0) return 1.0;
  return Math.max(0, 1 - violations / transitions);
}

/**
 * Score template legality
 *
 * Checks if the name can be decomposed into allowed syllable templates.
 * Uses the phonology profile's syllable templates.
 *
 * Returns: 0-1 score (1 = fully legal, 0 = no templates match)
 */
export function scoreTemplateLegality(
  name: string,
  syllables: string[],
  allowedTemplates: string[]
): number {
  if (syllables.length === 0) return 0;

  let matchedSyllables = 0;

  for (const syllable of syllables) {
    // Convert syllable to template pattern (C/V)
    const pattern = syllable
      .split("")
      .map((char) => (isVowel(char) ? "V" : "C"))
      .join("");

    // Check if pattern matches any allowed template
    if (allowedTemplates.includes(pattern)) {
      matchedSyllables++;
    }
  }

  return matchedSyllables / syllables.length;
}

/**
 * Compute harmonic constraint violations
 *
 * Checks culture-specific phonotactic rules:
 * - Max consonant cluster size
 * - Vowel spacing requirements
 *
 * Returns: 0-1 score (1 = no violations, 0 = many violations)
 */
export function scoreHarmonicConstraints(
  name: string,
  profile: PhonologyProfile
): number {
  const maxConsonantCluster = profile.maxConsonantCluster ?? 3;
  const minVowelSpacing = profile.minVowelSpacing ?? 3;

  const actualMaxCluster = countMaxConsonantCluster(name);
  const actualVowelGap = checkVowelSpacing(name);

  let violations = 0;

  // Penalize exceeding max consonant cluster
  if (actualMaxCluster > maxConsonantCluster) {
    violations += actualMaxCluster - maxConsonantCluster;
  }

  // Penalize exceeding vowel spacing
  if (actualVowelGap > minVowelSpacing) {
    violations += actualVowelGap - minVowelSpacing;
  }

  // Normalize: assume max 5 violations is very bad
  return Math.max(0, 1 - violations / 5);
}

/**
 * Combined pronounceability score
 *
 * Weights:
 * - 30% template legality (structural correctness)
 * - 30% sonority sequencing (natural flow)
 * - 40% harmonic constraints (culture-specific rules)
 *
 * Returns: 0-1 score (1 = highly pronounceable)
 */
export function scorePronounceability(
  name: string,
  syllables: string[],
  phonemes: string[],
  profile: PhonologyProfile
): number {
  const templateScore = scoreTemplateLegality(name, syllables, profile.syllableTemplates);
  const sonorityScore = scoreSonoritySequencing(name, phonemes, profile.sonorityRanks);
  const harmonicScore = scoreHarmonicConstraints(name, profile);

  // Weighted combination
  return 0.3 * templateScore + 0.3 * sonorityScore + 0.4 * harmonicScore;
}

/**
 * Batch pronounceability scoring for a set of names
 */
export interface PronounceabilityReport {
  avgScore: number;
  minScore: number;
  maxScore: number;
  p5: number; // 5th percentile
  p95: number; // 95th percentile
  violations: {
    tooManyConsonants: number; // Count of names with excessive consonant clusters
    poorVowelSpacing: number; // Count of names with poor vowel spacing
  };
}

export function batchScorePronounceability(
  names: string[],
  syllablesPerName: string[][],
  phonemesPerName: string[][],
  profile: PhonologyProfile
): PronounceabilityReport {
  const scores = names.map((name, i) =>
    scorePronounceability(name, syllablesPerName[i] ?? [], phonemesPerName[i] ?? [], profile)
  );

  scores.sort((a, b) => a - b);

  const maxConsonantCluster = profile.maxConsonantCluster ?? 3;
  const minVowelSpacing = profile.minVowelSpacing ?? 3;

  let tooManyConsonants = 0;
  let poorVowelSpacing = 0;

  for (const name of names) {
    if (countMaxConsonantCluster(name) > maxConsonantCluster) {
      tooManyConsonants++;
    }
    if (checkVowelSpacing(name) > minVowelSpacing) {
      poorVowelSpacing++;
    }
  }

  return {
    avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    minScore: scores[0],
    maxScore: scores[scores.length - 1],
    p5: scores[Math.floor(scores.length * 0.05)],
    p95: scores[Math.floor(scores.length * 0.95)],
    violations: {
      tooManyConsonants,
      poorVowelSpacing,
    },
  };
}
