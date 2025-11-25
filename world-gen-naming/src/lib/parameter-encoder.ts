/**
 * Parameter encoding/decoding for optimization
 *
 * Converts between NamingDomain configs and numeric parameter vectors (θ).
 * Uses transformations to keep parameters in valid ranges:
 * - Log for weights (must be positive)
 * - Logit for rates (must be in [0,1])
 * - Direct for length ranges (with bounds checking)
 */

import type { NamingDomain } from "../types/domain.js";
import type { ParameterVector, ParameterBounds } from "../types/optimization.js";

/**
 * Transform weight to log space (for optimization)
 */
function toLogSpace(weight: number): number {
  return Math.log(Math.max(weight, 1e-10));
}

/**
 * Transform from log space back to weight
 */
function fromLogSpace(logWeight: number): number {
  return Math.exp(logWeight);
}

/**
 * Transform probability to logit space
 */
function toLogit(p: number): number {
  const clamped = Math.max(1e-10, Math.min(1 - 1e-10, p));
  return Math.log(clamped / (1 - clamped));
}

/**
 * Transform from logit space back to probability
 */
function fromLogit(logit: number): number {
  const exp = Math.exp(logit);
  return exp / (1 + exp);
}

/**
 * Normalize weights to sum to 1
 */
function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) return weights.map(() => 1 / weights.length);
  return weights.map((w) => w / sum);
}

/**
 * Encode domain config to parameter vector
 */
export function encodeParameters(domain: NamingDomain): ParameterVector {
  const { phonology, morphology, style } = domain;

  // Get weights or create uniform defaults
  const consonantWeights =
    phonology.consonantWeights && phonology.consonantWeights.length > 0
      ? phonology.consonantWeights
      : Array(phonology.consonants.length).fill(1);

  const vowelWeights =
    phonology.vowelWeights && phonology.vowelWeights.length > 0
      ? phonology.vowelWeights
      : Array(phonology.vowels.length).fill(1);

  const templateWeights =
    phonology.templateWeights && phonology.templateWeights.length > 0
      ? phonology.templateWeights
      : Array(phonology.syllableTemplates.length).fill(1);

  const structureWeights =
    morphology.structureWeights && morphology.structureWeights.length > 0
      ? morphology.structureWeights
      : Array(morphology.structure.length).fill(1);

  return {
    consonantWeights: normalizeWeights(consonantWeights).map(toLogSpace),
    vowelWeights: normalizeWeights(vowelWeights).map(toLogSpace),
    templateWeights: normalizeWeights(templateWeights).map(toLogSpace),
    structureWeights: normalizeWeights(structureWeights).map(toLogSpace),

    apostropheRate: toLogit(style.apostropheRate ?? 0),
    hyphenRate: toLogit(style.hyphenRate ?? 0),

    lengthMin: phonology.lengthRange[0],
    lengthMax: phonology.lengthRange[1],

    favoredClusterBoost: phonology.favoredClusterBoost,
  };
}

/**
 * Decode parameter vector back to domain config
 */
export function decodeParameters(
  theta: ParameterVector,
  baseDomain: NamingDomain,
  bounds: ParameterBounds
): NamingDomain {
  // Transform back from log/logit space
  const consonantWeights = normalizeWeights(theta.consonantWeights.map(fromLogSpace));
  const vowelWeights = normalizeWeights(theta.vowelWeights.map(fromLogSpace));
  const templateWeights = normalizeWeights(theta.templateWeights.map(fromLogSpace));
  const structureWeights = normalizeWeights(theta.structureWeights.map(fromLogSpace));

  const apostropheRate = fromLogit(theta.apostropheRate);
  const hyphenRate = fromLogit(theta.hyphenRate);

  // Clamp length range to bounds
  const lengthMin = Math.max(
    bounds.lengthMin.min,
    Math.min(bounds.lengthMin.max, Math.round(theta.lengthMin))
  );
  const lengthMax = Math.max(
    bounds.lengthMax.min,
    Math.min(bounds.lengthMax.max, Math.round(theta.lengthMax))
  );

  // Ensure lengthMax >= lengthMin
  const finalLengthMax = Math.max(lengthMax, lengthMin);

  return {
    ...baseDomain,
    phonology: {
      ...baseDomain.phonology,
      consonantWeights,
      vowelWeights,
      templateWeights,
      lengthRange: [lengthMin, finalLengthMax],
      favoredClusterBoost: theta.favoredClusterBoost,
    },
    morphology: {
      ...baseDomain.morphology,
      structureWeights,
    },
    style: {
      ...baseDomain.style,
      apostropheRate,
      hyphenRate,
    },
  };
}

/**
 * Create a perturbed copy of parameter vector
 */
export function perturbParameters(
  theta: ParameterVector,
  stepSizes: {
    weights: number;
    apostropheRate: number;
    hyphenRate: number;
    lengthRange: number;
  },
  rng: () => number
): ParameterVector {
  // Add Gaussian noise (using Box-Muller transform)
  const gaussian = (): number => {
    const u1 = rng();
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  return {
    consonantWeights: theta.consonantWeights.map((w) => w + gaussian() * stepSizes.weights),
    vowelWeights: theta.vowelWeights.map((w) => w + gaussian() * stepSizes.weights),
    templateWeights: theta.templateWeights.map((w) => w + gaussian() * stepSizes.weights),
    structureWeights: theta.structureWeights.map((w) => w + gaussian() * stepSizes.weights),

    apostropheRate: theta.apostropheRate + gaussian() * stepSizes.apostropheRate,
    hyphenRate: theta.hyphenRate + gaussian() * stepSizes.hyphenRate,

    lengthMin: theta.lengthMin + Math.round(gaussian() * stepSizes.lengthRange),
    lengthMax: theta.lengthMax + Math.round(gaussian() * stepSizes.lengthRange),

    favoredClusterBoost: theta.favoredClusterBoost
      ? theta.favoredClusterBoost + gaussian() * 1.0
      : undefined,
  };
}

/**
 * Calculate distance between two parameter vectors (L2 norm)
 */
export function parameterDistance(theta1: ParameterVector, theta2: ParameterVector): number {
  const allParams1 = [
    ...theta1.consonantWeights,
    ...theta1.vowelWeights,
    ...theta1.templateWeights,
    ...theta1.structureWeights,
    theta1.apostropheRate,
    theta1.hyphenRate,
    theta1.lengthMin,
    theta1.lengthMax,
  ];

  const allParams2 = [
    ...theta2.consonantWeights,
    ...theta2.vowelWeights,
    ...theta2.templateWeights,
    ...theta2.structureWeights,
    theta2.apostropheRate,
    theta2.hyphenRate,
    theta2.lengthMin,
    theta2.lengthMax,
  ];

  const squaredDiffs = allParams1.map((p1, i) => Math.pow(p1 - allParams2[i], 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0));
}
