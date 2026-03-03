/**
 * Hill-climbing optimizer
 *
 * Simple baseline optimizer that proposes random perturbations
 * and accepts improvements.
 */

import { createRNG } from "../utils/rng.js";
import {
  encodeParameters,
  decodeParameters,
  perturbParameters,
} from "../parameter-encoder.js";
import { computeFitness, computeFitnessLight } from "./fitness.js";
import type { NamingDomain } from "../types/domain.js";
import type {
  OptimizationSettings,
  ValidationSettings,
  FitnessWeights,
  ParameterBounds,
  OptimizationResult,
  EvaluationResult,
} from "./optimization.js";
import { DEFAULT_BOUNDS } from "./optimization.js";

/** Update best evaluation if proposed is better, logging improvement. */
function maybeUpdateBest(
  proposed: EvaluationResult,
  best: EvaluationResult,
  initialFitness: number
): EvaluationResult {
  if (proposed.fitness > best.fitness) {
    console.log(
      `  -> New best! ${proposed.fitness.toFixed(4)} (+${((proposed.fitness - initialFitness) * 100).toFixed(1)}%)`
    );
    return proposed;
  }
  return best;
}

/** Check convergence: returns updated counters and whether to break. */
function checkConvergence(
  bestFitness: number,
  lastBestFitness: number,
  threshold: number,
  noImprovementCount: number,
  window: number,
  iteration: number
): { shouldBreak: boolean; noImprovementCount: number; lastBestFitness: number } {
  const improvement = bestFitness - lastBestFitness;
  if (improvement < threshold) {
    const newCount = noImprovementCount + 1;
    if (newCount >= window) {
      console.log(`\nConverged after ${iteration} iterations (no improvement for ${newCount} iterations)`);
      return { shouldBreak: true, noImprovementCount: newCount, lastBestFitness };
    }
    return { shouldBreak: false, noImprovementCount: newCount, lastBestFitness };
  }
  return { shouldBreak: false, noImprovementCount: 0, lastBestFitness: bestFitness };
}

/**
 * Run hill-climbing optimization
 * @param siblingDomains - Other domains to compare against for separation metric
 */
function resolveHillclimbSettings(s: OptimizationSettings) {
  return {
    iterations: s.iterations ?? 100,
    verbose: s.verbose ?? false,
    convergenceThreshold: s.convergenceThreshold ?? 0.001,
    convergenceWindow: s.convergenceWindow ?? 10,
    stepSizes: s.stepSizes ?? { weights: 0.1, apostropheRate: 0.05, hyphenRate: 0.05, lengthRange: 1 },
  };
}

export async function hillclimb(
  initialDomain: NamingDomain,
  validationSettings: ValidationSettings,
  fitnessWeights: FitnessWeights,
  optimizationSettings: OptimizationSettings,
  bounds: ParameterBounds = DEFAULT_BOUNDS,
  seed: string = "hillclimb",
  siblingDomains: NamingDomain[] = []
): Promise<OptimizationResult> {
  const rng = createRNG(seed);

  const useSeparation = siblingDomains.length > 0 && fitnessWeights.separation > 0;
  const { iterations, verbose, convergenceThreshold, convergenceWindow, stepSizes } = resolveHillclimbSettings(optimizationSettings);

  let currentTheta = encodeParameters(initialDomain);
  let currentDomain = initialDomain;

  let currentEval = useSeparation
    ? await computeFitness(currentDomain, currentTheta, validationSettings, fitnessWeights, siblingDomains, 0, verbose)
    : await computeFitnessLight(currentDomain, currentTheta, validationSettings, fitnessWeights, 0, verbose);
  const initialFitness = currentEval.fitness;
  console.log(`Initial fitness: ${initialFitness.toFixed(4)}`);
  let bestEval = currentEval;
  const evaluations: EvaluationResult[] = [currentEval];
  const convergenceHistory: number[] = [currentEval.fitness];

  // Track convergence
  let noImprovementCount = 0;
  let lastBestFitness = initialFitness;

  // Hill-climbing loop
  for (let i = 1; i <= iterations; i++) {
    const iterStart = Date.now();
    console.log(`\n[${i}/${iterations}] Evaluating...`);

    const proposedTheta = perturbParameters(currentTheta, stepSizes, rng);
    const proposedDomain = decodeParameters(proposedTheta, initialDomain, bounds);

    const proposedEval = useSeparation
      ? await computeFitness(proposedDomain, proposedTheta, validationSettings, fitnessWeights, siblingDomains, i, verbose)
      : await computeFitnessLight(proposedDomain, proposedTheta, validationSettings, fitnessWeights, i, verbose);

    const iterElapsed = ((Date.now() - iterStart) / 1000).toFixed(1);
    console.log(`[${i}/${iterations}] Fitness: ${proposedEval.fitness.toFixed(4)} (${iterElapsed}s)`);
    evaluations.push(proposedEval);

    // Accept if better
    if (proposedEval.fitness > currentEval.fitness) {
      currentTheta = proposedTheta;
      currentDomain = proposedDomain; // eslint-disable-line sonarjs/no-dead-store -- loop-carried variable
      currentEval = proposedEval;
      bestEval = maybeUpdateBest(proposedEval, bestEval, initialFitness);
    }

    convergenceHistory.push(bestEval.fitness);

    const converged = checkConvergence(
      bestEval.fitness, lastBestFitness, convergenceThreshold,
      noImprovementCount, convergenceWindow, i
    );
    if (converged.shouldBreak) break;
    noImprovementCount = converged.noImprovementCount;
    lastBestFitness = converged.lastBestFitness;
  }

  const finalFitness = bestEval.fitness;
  const finalImprovement = finalFitness - initialFitness;

  console.log("\n=== Optimization complete ===");
  console.log(`Initial fitness: ${initialFitness.toFixed(4)}`);
  console.log(`Final fitness: ${finalFitness.toFixed(4)}`);
  console.log(`Improvement: +${(finalImprovement * 100).toFixed(1)}%`);
  console.log(`Total evaluations: ${evaluations.length}`);

  return {
    initialConfig: initialDomain,
    optimizedConfig: bestEval.config,
    initialFitness,
    finalFitness,
    improvement: finalImprovement,
    iterations: evaluations.length,
    evaluations,
    convergenceHistory,
    settings: optimizationSettings,
  };
}
