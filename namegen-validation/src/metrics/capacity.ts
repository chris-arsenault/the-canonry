import type { NamingDomain } from "world-gen-naming";
import { testDomain } from "world-gen-naming";
import type { CapacityReport, ValidationConfig } from "../types/validation.js";

/**
 * Calculate Shannon entropy for a set of names
 * Measures information density - higher entropy = more variety in character usage
 *
 * H = -Σ p(c) * log2(p(c))
 */
export function calculateEntropy(names: string[]): number {
  if (names.length === 0) return 0;

  // Count character frequencies
  const freq = new Map<string, number>();
  let total = 0;

  for (const name of names) {
    for (const char of name.toLowerCase()) {
      total++;
      freq.set(char, (freq.get(char) ?? 0) + 1);
    }
  }

  if (total === 0) return 0;

  // Calculate entropy
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Validate capacity of a domain - can it generate enough unique names?
 */
export function validateCapacity(
  domain: NamingDomain,
  config: Partial<ValidationConfig> = {}
): CapacityReport {
  const sampleSize = config.sampleSize ?? 1000;
  const maxCollisionRate = config.maxCollisionRate ?? 0.05;
  const minEntropy = config.minEntropy ?? 3.0;

  // Generate samples using the name generator's test function
  const testResult = testDomain(domain, sampleSize, config.seed);

  // Calculate metrics
  const uniqueCount = testResult.uniqueCount;
  const collisionRate = 1 - uniqueCount / sampleSize;
  const entropy = calculateEntropy(testResult.samples);

  // Determine pass/fail
  const issues: string[] = [];
  let passed = true;

  if (collisionRate > maxCollisionRate) {
    issues.push(
      `Collision rate ${(collisionRate * 100).toFixed(2)}% exceeds threshold ${(maxCollisionRate * 100).toFixed(2)}%`
    );
    passed = false;
  }

  if (entropy < minEntropy) {
    issues.push(
      `Entropy ${entropy.toFixed(2)} bits/char below threshold ${minEntropy} bits/char`
    );
    passed = false;
  }

  if (uniqueCount < sampleSize * 0.8) {
    issues.push(
      `Only ${uniqueCount} unique names from ${sampleSize} samples (${((uniqueCount / sampleSize) * 100).toFixed(1)}%)`
    );
    passed = false;
  }

  return {
    domainId: domain.id,
    sampleSize,
    uniqueCount,
    collisionRate,
    entropy,
    avgLength: testResult.avgLength,
    minLength: testResult.minLength,
    maxLength: testResult.maxLength,
    passed,
    issues,
  };
}

/**
 * Estimate required sample size for target collision rate
 * Uses birthday paradox approximation
 */
export function estimateRequiredSamples(
  domain: NamingDomain,
  targetCollisionRate: number = 0.01,
  probeSampleSize: number = 100
): number {
  // Generate a small probe sample to estimate capacity
  const probe = testDomain(domain, probeSampleSize);

  // Estimate total capacity from probe collision rate
  const probeCollisionRate = 1 - probe.uniqueCount / probeSampleSize;

  if (probeCollisionRate === 0) {
    // No collisions in probe - domain is large
    // Use conservative estimate
    return Math.floor(probeSampleSize / targetCollisionRate);
  }

  // Rough estimate: if probe has X% collision rate with N samples,
  // extrapolate to target collision rate
  const scaleFactor = Math.sqrt(probeCollisionRate / targetCollisionRate);
  return Math.floor(probeSampleSize / scaleFactor);
}

/**
 * Calculate theoretical capacity using combinatorics
 * This is an upper bound - actual capacity may be lower due to forbidden clusters
 */
export function theoreticalCapacity(domain: NamingDomain): {
  minCapacity: number;
  maxCapacity: number;
} {
  const phonology = domain.phonology;
  const [minSyllables, maxSyllables] = phonology.lengthRange;

  // Count phonemes
  const numConsonants = phonology.consonants.length;
  const numVowels = phonology.vowels.length;

  // Estimate syllables per template (rough average)
  const avgPhonemes = phonology.syllableTemplates.reduce((sum, template) => {
    return sum + template.replace(/[^CV]/g, "").length;
  }, 0) / phonology.syllableTemplates.length;

  // Calculate capacity for min and max syllable counts
  const capacityPerSyllable = Math.pow(
    (numConsonants + numVowels) / 2,
    avgPhonemes
  );

  const minCapacity = Math.pow(capacityPerSyllable, minSyllables);
  const maxCapacity = Math.pow(capacityPerSyllable, maxSyllables);

  return {
    minCapacity: Math.floor(minCapacity),
    maxCapacity: Math.floor(maxCapacity),
  };
}
