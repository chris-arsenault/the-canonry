/**
 * Simulated Annealing optimizer
 *
 * Enhanced hill-climbing that occasionally accepts worse moves
 * to escape local optima. Uses temperature schedule to control
 * acceptance probability.
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

/** Determine whether to accept a proposed move (better moves always, worse by probability). */
function shouldAcceptMove(delta: number, temperature: number, rng: () => number, verbose: boolean, iteration: number): boolean {
  if (delta > 0) return true;
  const acceptanceProbability = Math.exp(delta / temperature);
  const accept = rng() < acceptanceProbability;
  if (verbose && accept) {
    console.log(
      `[${iteration}] Accepting worse move: Δf = ${delta.toFixed(4)}, P = ${acceptanceProbability.toFixed(3)}, T = ${temperature.toFixed(3)}`
    );
  }
  return accept;
}

function logNewBest(verbose: boolean, i: number, iterations: number, bestFitness: number, initialFitness: number): void {
  if (!verbose) return;
  console.log(
    `[${i}/${iterations}] New best: ${bestFitness.toFixed(4)} (+${((bestFitness - initialFitness) * 100).toFixed(1)}%)`
  );
}

function checkSAConvergence(
  bestFitness: number, lastBestFitness: number, threshold: number,
  noImprovementCount: number, window: number, verbose: boolean, iteration: number
): { shouldBreak: boolean; noImprovementCount: number; lastBestFitness: number } {
  const improvement = bestFitness - lastBestFitness;
  if (improvement < threshold) {
    const newCount = noImprovementCount + 1;
    if (newCount >= window) {
      if (verbose) {
        console.log(`Converged after ${iteration} iterations (no significant improvement for ${newCount} iterations)`);
      }
      return { shouldBreak: true, noImprovementCount: newCount, lastBestFitness };
    }
    return { shouldBreak: false, noImprovementCount: newCount, lastBestFitness };
  }
  return { shouldBreak: false, noImprovementCount: 0, lastBestFitness: bestFitness };
}

function logSAProgress(
  verbose: boolean, i: number, iterations: number,
  bestEval: EvaluationResult, currentEval: EvaluationResult,
  temperature: number, acceptedMoves: number, rejectedMoves: number
): void {
  if (!verbose || i % 10 !== 0) return;
  const acceptanceRate = acceptedMoves / (acceptedMoves + rejectedMoves);
  console.log(
    `[${i}/${iterations}] Best: ${bestEval.fitness.toFixed(4)}, Current: ${currentEval.fitness.toFixed(4)}, ` +
    `T: ${temperature.toFixed(3)}, Accept rate: ${(acceptanceRate * 100).toFixed(1)}%`
  );
}

/**
 * Run simulated annealing optimization
 * @param siblingDomains - Other domains to compare against for separation metric
 */
export async function simulatedAnnealing(
  initialDomain: NamingDomain,
  validationSettings: ValidationSettings,
  fitnessWeights: FitnessWeights,
  optimizationSettings: OptimizationSettings,
  bounds: ParameterBounds = DEFAULT_BOUNDS,
  seed: string = "sim-anneal",
  siblingDomains: NamingDomain[] = []
): Promise<OptimizationResult> {
  const rng = createRNG(seed);

  // Use full fitness (with separation) if we have sibling domains, otherwise lightweight
  const useSeparation = siblingDomains.length > 0 && fitnessWeights.separation > 0;

  // Apply defaults
  const iterations = optimizationSettings.iterations ?? 100;
  const verbose = optimizationSettings.verbose ?? false;
  const convergenceThreshold = optimizationSettings.convergenceThreshold ?? 0.001;
  const convergenceWindow = optimizationSettings.convergenceWindow ?? 10;
  const stepSizes = optimizationSettings.stepSizes ?? {
    weights: 0.1,
    apostropheRate: 0.05,
    hyphenRate: 0.05,
    lengthRange: 1,
  };

  // Annealing parameters
  let temperature = optimizationSettings.initialTemperature ?? 1.0;
  const coolingRate = optimizationSettings.coolingRate ?? 0.95;

  // Encode initial parameters
  let currentTheta = encodeParameters(initialDomain);
  let currentDomain = initialDomain;

  // Evaluate initial fitness
  console.log("Evaluating initial configuration...");
  let currentEval = useSeparation
    ? await computeFitness(currentDomain, currentTheta, validationSettings, fitnessWeights, siblingDomains, 0)
    : await computeFitnessLight(currentDomain, currentTheta, validationSettings, fitnessWeights, 0);

  const initialFitness = currentEval.fitness;
  let bestEval = currentEval;
  const evaluations: EvaluationResult[] = [currentEval];
  const convergenceHistory: number[] = [currentEval.fitness];

  if (verbose) {
    console.log(`Initial fitness: ${initialFitness.toFixed(4)}`);
    console.log(`Initial temperature: ${temperature.toFixed(3)}`);
    console.log(
      `  Capacity: ${currentEval.scores.capacity.toFixed(3)}, ` +
        `Diffuseness: ${currentEval.scores.diffuseness.toFixed(3)}, ` +
        `Separation: ${currentEval.scores.separation.toFixed(3)}`
    );
  }

  // Track convergence
  let noImprovementCount = 0;
  let lastBestFitness = initialFitness;
  let acceptedMoves = 0;
  let rejectedMoves = 0;

  // Simulated annealing loop
  for (let i = 1; i <= iterations; i++) {
    const proposedTheta = perturbParameters(currentTheta, stepSizes, rng);
    const proposedDomain = decodeParameters(proposedTheta, initialDomain, bounds);

    const proposedEval = useSeparation
      ? await computeFitness(proposedDomain, proposedTheta, validationSettings, fitnessWeights, siblingDomains, i)
      : await computeFitnessLight(proposedDomain, proposedTheta, validationSettings, fitnessWeights, i);

    evaluations.push(proposedEval);

    const delta = proposedEval.fitness - currentEval.fitness;
    const accept = shouldAcceptMove(delta, temperature, rng, verbose, i);

    if (accept) {
      currentTheta = proposedTheta;
      currentDomain = proposedDomain; // eslint-disable-line sonarjs/no-dead-store -- loop-carried variable
      currentEval = proposedEval;
      acceptedMoves++;

      if (proposedEval.fitness > bestEval.fitness) {
        bestEval = proposedEval;
        logNewBest(verbose, i, iterations, bestEval.fitness, initialFitness);
      }
    } else {
      rejectedMoves++;
    }

    convergenceHistory.push(bestEval.fitness);
    temperature *= coolingRate;

    const converged = checkSAConvergence(
      bestEval.fitness, lastBestFitness, convergenceThreshold,
      noImprovementCount, convergenceWindow, verbose, i
    );
    if (converged.shouldBreak) break;
    noImprovementCount = converged.noImprovementCount;
    lastBestFitness = converged.lastBestFitness;

    logSAProgress(verbose, i, iterations, bestEval, currentEval, temperature, acceptedMoves, rejectedMoves);
  }

  const finalFitness = bestEval.fitness;
  const improvement = finalFitness - initialFitness;
  const acceptanceRate = acceptedMoves / (acceptedMoves + rejectedMoves);

  if (verbose) {
    console.log("\nOptimization complete!");
    console.log(`Initial fitness: ${initialFitness.toFixed(4)}`);
    console.log(`Final fitness: ${finalFitness.toFixed(4)}`);
    console.log(`Improvement: +${(improvement * 100).toFixed(1)}%`);
    console.log(`Total evaluations: ${evaluations.length}`);
    console.log(`Acceptance rate: ${(acceptanceRate * 100).toFixed(1)}%`);
    console.log(`Final temperature: ${temperature.toFixed(3)}`);
  }

  return {
    initialConfig: initialDomain,
    optimizedConfig: bestEval.config,
    initialFitness,
    finalFitness,
    improvement,
    iterations: evaluations.length,
    evaluations,
    convergenceHistory,
    settings: optimizationSettings,
  };
}
