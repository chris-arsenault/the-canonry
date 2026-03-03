/**
 * Name Forge Optimizer
 *
 * Optimization algorithms for tuning domain parameters.
 */

import type { NamingDomain } from "../types/domain.js";

// Types and settings
export {
  ValidationSettingsSchema,
  FitnessWeightsSchema,
  OptimizationSettingsSchema,
  DEFAULT_BOUNDS,
  type ValidationSettings,
  type FitnessWeights,
  type OptimizationAlgorithm,
  type OptimizationSettings,
  type ParameterVector,
  type EvaluationResult,
  type OptimizationResult,
  type ParameterBounds,
} from "./optimization.js";

// Fitness computation
export {
  computeFitness,
  computeFitnessLight,
} from "./fitness.js";

// Optimization algorithms
import { hillclimb } from "./hillclimb.js";
import { simulatedAnnealing } from "./sim-anneal.js";
import { geneticAlgorithm } from "./genetic.js";
import { bayesianOptimization, analyzePhonemeImportance } from "./bayesian.js";

export { hillclimb, simulatedAnnealing, geneticAlgorithm, bayesianOptimization, analyzePhonemeImportance };

// Mutations
export {
  addConsonant,
  removeConsonant,
  swapConsonant,
  addVowel,
  removeVowel,
  swapVowel,
  addTemplate,
  removeTemplate,
  modifyTemplate,
  addCluster,
  removeCluster,
  synthesizeCluster,
  mutateApostropheRate,
  mutateHyphenRate,
  mutateLengthRange,
  MUTATIONS,
  MUTATION_WEIGHTS,
  applyRandomMutation,
  applyMultipleMutations,
  applyWeightedMutation,
  type MutationType,
} from "./mutations.js";

// Parameter encoding
export {
  encodeParameters,
  decodeParameters,
  perturbParameters,
  parameterDistance,
} from "../parameter-encoder.js";

// Re-import types for local use
import type {
  ValidationSettings,
  FitnessWeights,
  OptimizationSettings,
  OptimizationResult,
  ParameterBounds,
} from "./optimization.js";
import { DEFAULT_BOUNDS } from "./optimization.js";

/**
 * High-level optimize function that dispatches to the appropriate algorithm
 */
export async function optimizeDomain(
  initialDomain: NamingDomain,
  validationSettings: ValidationSettings,
  fitnessWeights: FitnessWeights,
  optimizationSettings: OptimizationSettings,
  siblingDomains: NamingDomain[] = [],
  bounds: ParameterBounds = DEFAULT_BOUNDS,
  seed: string
): Promise<OptimizationResult> {
  const algorithm = optimizationSettings.algorithm || 'hillclimb';
  const effectiveSeed = seed || `optimize-${algorithm}-${Date.now()}`;

  switch (algorithm) {
    case 'hillclimb':
      return hillclimb(initialDomain, validationSettings, fitnessWeights, optimizationSettings, bounds, effectiveSeed, siblingDomains);
    case 'sim_anneal':
      return simulatedAnnealing(initialDomain, validationSettings, fitnessWeights, optimizationSettings, bounds, effectiveSeed, siblingDomains);
    case 'ga':
      // GA doesn't use bounds parameter
      return geneticAlgorithm(initialDomain, validationSettings, fitnessWeights, optimizationSettings, effectiveSeed, siblingDomains);
    case 'bayes':
      // Bayesian doesn't use bounds parameter
      return bayesianOptimization(initialDomain, validationSettings, fitnessWeights, optimizationSettings, effectiveSeed, siblingDomains);
    default:
      throw new Error(`Unknown optimization algorithm: ${algorithm}`);
  }
}
