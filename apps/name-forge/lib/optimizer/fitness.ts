/**
 * Fitness function for optimization
 *
 * Integrates validation metrics into a single scalar fitness score.
 */

import { generateFromDomain } from "../generate.js";
import { batchScorePronounceability } from "../pronounceability.js";
import type { NamingDomain } from "../types/domain.js";
import type {
  FitnessWeights,
  ValidationSettings,
  EvaluationResult,
  ParameterVector,
} from "./optimization.js";

// Import validation metrics
import { validateCapacity } from "../validation/metrics/capacity.js";
import { validateDiffuseness } from "../validation/metrics/diffuseness.js";
import { validateSeparation } from "../validation/metrics/separation.js";
import type { CapacityReport, DiffusenessReport, SeparationReport } from "../validation/validation.js";

// No longer need dynamic imports - metrics are now local
async function loadValidationMetrics() {
  // No-op - metrics are statically imported now
}

/**
 * Normalize capacity metrics to 0-1 score (higher is better)
 */
function normalizeCapacityScore(report: CapacityReport, _settings: ValidationSettings): number {
  // Lower collision rate is better
  const collisionRate = report.collisionRate ?? 0;
  const collisionScore = Math.max(0, 1 - collisionRate / 0.1);

  // Higher entropy is better (normalize to typical range 2-5 bits/char)
  const entropy = report.entropy ?? 3;
  const entropyScore = Math.min(1, Math.max(0, (entropy - 2) / 3));

  const score = (collisionScore + entropyScore) / 2;
  return isNaN(score) ? 0.5 : score;
}

/**
 * Normalize diffuseness metrics to 0-1 score (higher is better)
 */
function normalizeDiffusenessScore(report: DiffusenessReport, settings: ValidationSettings): number {
  // Levenshtein NN distance (normalized)
  const levenshteinP5 = report.levenshteinNN?.p5 ?? 0.3;
  const minNN = settings.minNN_p5 ?? 0.3;
  const levenshteinScore = minNN > 0 ? Math.min(1, levenshteinP5 / minNN) : 0.5;

  // Shape NN distance (normalized)
  const shapeP5 = report.shapeNN?.p5 ?? 0.2;
  const minShape = settings.minShapeNN_p5 ?? 0.2;
  const shapeScore = minShape > 0 ? Math.min(1, shapeP5 / minShape) : 0.5;

  const score = (levenshteinScore + shapeScore) / 2;
  return isNaN(score) ? 0.5 : score;
}

/**
 * Normalize separation metrics to 0-1 score (higher is better)
 */
function normalizeSeparationScore(report: SeparationReport, settings: ValidationSettings): number {
  // Classifier accuracy
  const classifierScore = report.classifierAccuracy ?? 0.5;

  // Min pairwise centroid distance
  const distances = Object.values(report.pairwiseDistances ?? {});
  const minDistance = distances.length > 0 ? Math.min(...distances) : 1;
  const minCentroid = settings.minCentroidDistance ?? 0.2;
  const centroidScore = minCentroid > 0 ? Math.min(1, minDistance / minCentroid) : 0.5;

  const score = (classifierScore + centroidScore) / 2;
  return isNaN(score) ? 0.5 : score;
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
  iteration: number = 0,
  verbose: boolean = false
): Promise<EvaluationResult> {
  const startTime = Date.now();
  const log = (msg: string) => {
    if (verbose || iteration === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  [fitness ${iteration}] ${msg} (${elapsed}s)`);
    }
  };

  log("Loading validation metrics...");
  await loadValidationMetrics();

  // Apply defaults for validation settings
  const requiredNames = settings.requiredNames ?? 500;
  const sampleFactor = settings.sampleFactor ?? 20;
  const maxSampleSize = settings.maxSampleSize ?? 20_000;
  const minNN_p5 = settings.minNN_p5 ?? 0.3;
  const minShapeNN_p5 = settings.minShapeNN_p5 ?? 0.2;
  const minCentroidDistance = settings.minCentroidDistance ?? 0.2;

  // Merge defaults into settings for downstream use
  const mergedSettings: ValidationSettings = {
    ...settings,
    requiredNames,
    sampleFactor,
    maxSampleSize,
    minNN_p5,
    minShapeNN_p5,
    minCentroidDistance,
  };

  // Calculate sample size
  const sampleSize = Math.min(
    maxSampleSize,
    requiredNames * sampleFactor
  );

  // Run capacity and diffuseness in parallel (they're independent)
  log(`Computing metrics in parallel (${sampleSize} names)...`);

  const capacityReport = validateCapacity(config, {
    sampleSize,
    seed: `fitness-${iteration}-capacity`,
  });
  const diffusenessReport = validateDiffuseness(config, {
    sampleSize,
    seed: `fitness-${iteration}-diffuseness`,
  });

  // For separation, we need multiple domains (run after parallel metrics)
  let separationScore = 1.0; // Default if no other domains
  if (otherDomains.length > 0) {
    const allDomains = [config, ...otherDomains];
    const perDomainSample = Math.floor(sampleSize / allDomains.length);

    log(`Computing separation (${allDomains.length} domains, ${perDomainSample} names each)...`);
    const separationReport = validateSeparation(allDomains, {
      sampleSize: perDomainSample,
      seed: `fitness-${iteration}-separation`,
    });
    separationScore = normalizeSeparationScore(separationReport, mergedSettings);
  }

  log("Done computing metrics.");

  // Normalize individual metrics to 0-1
  const capacityScore = normalizeCapacityScore(capacityReport, mergedSettings);
  const diffusenessScore = normalizeDiffusenessScore(diffusenessReport, mergedSettings);

  // Compute pronounceability and length scores if weighted
  let pronounceabilityScore = 1.0;
  let lengthScore = 1.0;
  if (weights.pronounceability > 0 || weights.length > 0) {
    // Generate sample names for these metrics
    const names = generateFromDomain(config, sampleSize, `fitness-${iteration}-style`);

    if (weights.pronounceability > 0) {
      pronounceabilityScore = scorePronounceability(names, config);
    }

    if (weights.length > 0) {
      lengthScore = scoreLengthDeviation(names, config);
    }
  }

  // Combine with weights (warn on undefined weights)
  const warnUndefined = (name: string, value: number | undefined): number => {
    if (value === undefined) {
      console.warn(`[fitness] WARNING: weight '${name}' is undefined, using 0. Check caller is passing all required weights.`);
      return 0;
    }
    return value;
  };

  const w = {
    capacity: warnUndefined("capacity", weights.capacity),
    diffuseness: warnUndefined("diffuseness", weights.diffuseness),
    separation: warnUndefined("separation", weights.separation),
    pronounceability: warnUndefined("pronounceability", weights.pronounceability),
    length: warnUndefined("length", weights.length),
    style: warnUndefined("style", weights.style),
  };

  const totalWeight =
    w.capacity + w.diffuseness + w.separation + w.pronounceability + w.length + w.style;

  // Debug: check for NaN values
  if (isNaN(capacityScore) || isNaN(diffusenessScore) || isNaN(separationScore)) {
    console.error("NaN detected in scores:", {
      capacityScore,
      diffusenessScore,
      separationScore,
      totalWeight,
    });
  }

  const fitness =
    totalWeight > 0
      ? (w.capacity * capacityScore +
          w.diffuseness * diffusenessScore +
          w.separation * separationScore +
          w.pronounceability * pronounceabilityScore +
          w.length * lengthScore) /
        totalWeight
      : 0;

  log(`Fitness: ${fitness.toFixed(4)} (weights: cap=${w.capacity}, diff=${w.diffuseness}, sep=${w.separation})`);

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
  iteration: number = 0,
  verbose: boolean = false
): Promise<EvaluationResult> {
  return computeFitness(config, theta, settings, weights, [], iteration, verbose);
}
