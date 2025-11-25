/**
 * Main optimizer module
 *
 * Dispatches to appropriate optimization algorithm based on settings.
 */

import { hillclimb } from "./optimizers/hillclimb.js";
import { simulatedAnnealing } from "./optimizers/sim-anneal.js";
import type { NamingDomain } from "../types/domain.js";
import type {
  OptimizationSettings,
  ValidationSettings,
  FitnessWeights,
  ParameterBounds,
  OptimizationResult,
} from "../types/optimization.js";
import { DEFAULT_BOUNDS } from "../types/optimization.js";

/**
 * Run optimization on a domain config
 */
export async function optimizeDomain(
  initialDomain: NamingDomain,
  validationSettings: ValidationSettings,
  fitnessWeights: FitnessWeights,
  optimizationSettings: OptimizationSettings,
  bounds: ParameterBounds = DEFAULT_BOUNDS,
  seed?: string
): Promise<OptimizationResult> {
  const algorithm = optimizationSettings.algorithm;
  const optimizationSeed = seed ?? `optimize-${initialDomain.id}`;

  console.log(`\nOptimizing domain: ${initialDomain.id}`);
  console.log(`Algorithm: ${algorithm}`);
  console.log(`Iterations: ${optimizationSettings.iterations}`);
  console.log(`Fitness weights: capacity=${fitnessWeights.capacity}, diffuseness=${fitnessWeights.diffuseness}, separation=${fitnessWeights.separation}`);
  console.log("");

  switch (algorithm) {
    case "hillclimb":
      return hillclimb(
        initialDomain,
        validationSettings,
        fitnessWeights,
        optimizationSettings,
        bounds,
        optimizationSeed
      );

    case "sim_anneal":
      return simulatedAnnealing(
        initialDomain,
        validationSettings,
        fitnessWeights,
        optimizationSettings,
        bounds,
        optimizationSeed
      );

    case "cma-es":
      throw new Error("CMA-ES not yet implemented");

    case "ga":
      throw new Error("Genetic Algorithm not yet implemented");

    case "bayes":
      throw new Error("Bayesian Optimization not yet implemented");

    default:
      throw new Error(`Unknown optimization algorithm: ${algorithm}`);
  }
}

/**
 * Optimize multiple domains sequentially
 */
export async function optimizeBatch(
  domains: NamingDomain[],
  validationSettings: ValidationSettings,
  fitnessWeights: FitnessWeights,
  optimizationSettings: OptimizationSettings,
  bounds: ParameterBounds = DEFAULT_BOUNDS
): Promise<OptimizationResult[]> {
  const results: OptimizationResult[] = [];

  for (const domain of domains) {
    const result = await optimizeDomain(
      domain,
      validationSettings,
      fitnessWeights,
      optimizationSettings,
      bounds
    );

    results.push(result);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`Domain ${domain.id} optimization complete`);
    console.log(`Improvement: +${(result.improvement * 100).toFixed(1)}%`);
    console.log(`${"=".repeat(60)}\n`);
  }

  return results;
}
