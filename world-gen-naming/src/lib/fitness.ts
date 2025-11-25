/**
 * Fitness function for optimization
 *
 * Integrates validation metrics into a single scalar fitness score.
 */

import { generateNames } from "./generator.js";
import { batchScorePronounceability } from "./pronounceability.js";
import type { NamingDomain } from "../types/domain.js";
import type {
  FitnessWeights,
  ValidationSettings,
  EvaluationResult,
  ParameterVector,
} from "../types/optimization.js";

// Import validation metrics from the validation package
// Note: These will be imported at runtime
let validateCapacity: any;
let validateDiffuseness: any;
let validateSeparation: any;

// Dynamic import to avoid circular dependencies
async function loadValidationMetrics() {
  if (!validateCapacity) {
    const validation = await import("../../../namegen-validation/dist/index.js");
    validateCapacity = validation.validateCapacity;
    validateDiffuseness = validation.validateDiffuseness;
    validateSeparation = validation.validateSeparation;
  }
}

/**
 * Normalize capacity metrics to 0-1 score (higher is better)
 */
function normalizeCapacityScore(report: any, settings: ValidationSettings): number {
  // Lower collision rate is better
  const collisionScore = Math.max(0, 1 - report.collisionRate / 0.1);

  // Higher entropy is better (normalize to typical range 2-5 bits/char)
  const entropyScore = Math.min(1, Math.max(0, (report.entropy - 2) / 3));

  return (collisionScore + entropyScore) / 2;
}

/**
 * Normalize diffuseness metrics to 0-1 score (higher is better)
 */
function normalizeDiffusenessScore(report: any, settings: ValidationSettings): number {
  // Levenshtein NN distance (normalized)
  const levenshteinScore = Math.min(1, report.levenshteinNN.p5 / settings.minNN_p5);

  // Shape NN distance (normalized)
  const shapeScore = Math.min(1, report.shapeNN.p5 / settings.minShapeNN_p5);

  return (levenshteinScore + shapeScore) / 2;
}

/**
 * Normalize separation metrics to 0-1 score (higher is better)
 */
function normalizeSeparationScore(report: any, settings: ValidationSettings): number {
  // Classifier accuracy
  const classifierScore = report.classifierAccuracy;

  // Min pairwise centroid distance
  const distances = Object.values(report.pairwiseDistances) as number[];
  const minDistance = distances.length > 0 ? Math.min(...distances) : 1;
  const centroidScore = Math.min(1, minDistance / settings.minCentroidDistance);

  return (classifierScore + centroidScore) / 2;
}

/**
 * Compute pronounceability score for generated names
 * Returns 0-1 score (higher is better)
 */
function scorePronounceability(
  names: string[],
  config: NamingDomain
): number {
  // For now, use simple syllable decomposition (could be enhanced)
  // Split by common consonant clusters or just chunk by vowels
  const syllablesPerName = names.map((name) => {
    // Simple syllabification: split on vowel boundaries
    const syllables: string[] = [];
    let current = "";
    for (const char of name.toLowerCase()) {
      current += char;
      if (/[aeiouäöüæœ]/.test(char)) {
        syllables.push(current);
        current = "";
      }
    }
    if (current) syllables.push(current);
    return syllables;
  });

  // Convert to phonemes (simplified: treat graphemes as phonemes)
  const phonemesPerName = names.map((name) =>
    name.toLowerCase().split("").filter((c) => /[a-z]/.test(c))
  );

  // Batch score pronounceability
  const report = batchScorePronounceability(
    names,
    syllablesPerName,
    phonemesPerName,
    config.phonology
  );

  return report.avgScore;
}

/**
 * Compute length deviation penalty
 * Returns 0-1 score (1 = within tolerance, 0 = far from target)
 */
function scoreLengthDeviation(
  names: string[],
  config: NamingDomain
): number {
  const targetLength = config.style.targetLength;
  const tolerance = config.style.lengthTolerance ?? 3;

  // If no target length specified, return perfect score
  if (!targetLength) {
    return 1.0;
  }

  // Calculate average length
  const avgLength = names.reduce((sum, name) => sum + name.length, 0) / names.length;

  // Calculate deviation
  const deviation = Math.abs(avgLength - targetLength);

  // Normalize: 0 deviation = 1.0, deviation > tolerance = 0.0
  return Math.max(0, 1 - deviation / tolerance);
}

/**
 * Generate names and compute fitness score
 */
export async function computeFitness(
  config: NamingDomain,
  theta: ParameterVector,
  settings: ValidationSettings,
  weights: FitnessWeights,
  otherDomains: NamingDomain[] = [],
  iteration: number = 0
): Promise<EvaluationResult> {
  await loadValidationMetrics();

  // Calculate sample size
  const sampleSize = Math.min(
    settings.maxSampleSize,
    settings.requiredNames * settings.sampleFactor
  );

  // Compute validation metrics (they generate names internally)
  const capacityReport = await validateCapacity(config, {
    sampleSize,
    seed: `fitness-${iteration}-capacity`,
  });

  const diffusenessReport = await validateDiffuseness(config, {
    sampleSize,
    seed: `fitness-${iteration}-diffuseness`,
  });

  // For separation, we need multiple domains
  let separationScore = 1.0; // Default if no other domains
  if (otherDomains.length > 0) {
    const allDomains = [config, ...otherDomains];

    const separationReport = await validateSeparation(allDomains, {
      sampleSize: Math.floor(sampleSize / allDomains.length), // Split samples across domains
      seed: `fitness-${iteration}-separation`,
    });
    separationScore = normalizeSeparationScore(separationReport, settings);
  }

  // Normalize individual metrics to 0-1
  const capacityScore = normalizeCapacityScore(capacityReport, settings);
  const diffusenessScore = normalizeDiffusenessScore(diffusenessReport, settings);

  // Compute pronounceability and length scores if weighted
  let pronounceabilityScore = 1.0;
  let lengthScore = 1.0;
  if (weights.pronounceability > 0 || weights.length > 0) {
    // Generate sample names for these metrics
    const results = generateNames([config], {
      kind: "npc",
      tags: [],
      count: sampleSize,
      seed: `fitness-${iteration}-style`,
    });

    const names = results.map((r) => r.name);

    if (weights.pronounceability > 0) {
      pronounceabilityScore = scorePronounceability(names, config);
    }

    if (weights.length > 0) {
      lengthScore = scoreLengthDeviation(names, config);
    }
  }

  // Combine with weights
  const totalWeight =
    weights.capacity +
    weights.diffuseness +
    weights.separation +
    weights.pronounceability +
    weights.length +
    weights.style;

  const fitness =
    (weights.capacity * capacityScore +
      weights.diffuseness * diffusenessScore +
      weights.separation * separationScore +
      weights.pronounceability * pronounceabilityScore +
      weights.length * lengthScore) /
    totalWeight;

  return {
    config,
    theta,
    fitness,
    scores: {
      capacity: capacityScore,
      diffuseness: diffusenessScore,
      separation: separationScore,
      pronounceability: pronounceabilityScore,
      length: lengthScore,
    },
    iteration,
    timestamp: Date.now(),
  };
}

/**
 * Lightweight fitness function (without separation)
 *
 * Used for quick evaluations during optimization loop.
 * Only computes capacity and diffuseness.
 */
export async function computeFitnessLight(
  config: NamingDomain,
  theta: ParameterVector,
  settings: ValidationSettings,
  weights: FitnessWeights,
  iteration: number = 0
): Promise<EvaluationResult> {
  return computeFitness(config, theta, settings, weights, [], iteration);
}
