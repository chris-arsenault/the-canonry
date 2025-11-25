/**
 * Simulated Annealing optimizer
 *
 * Enhanced hill-climbing that occasionally accepts worse moves
 * to escape local optima. Uses temperature schedule to control
 * acceptance probability.
 */

import { createRNG } from "../../utils/rng.js";
import {
  encodeParameters,
  decodeParameters,
  perturbParameters,
  parameterDistance,
} from "../parameter-encoder.js";
import { computeFitnessLight } from "../fitness.js";
import type { NamingDomain } from "../../types/domain.js";
import type {
  OptimizationSettings,
  ValidationSettings,
  FitnessWeights,
  ParameterBounds,
  OptimizationResult,
  EvaluationResult,
} from "../../types/optimization.js";
import { DEFAULT_BOUNDS } from "../../types/optimization.js";

/**
 * Run simulated annealing optimization
 */
export async function simulatedAnnealing(
  initialDomain: NamingDomain,
  validationSettings: ValidationSettings,
  fitnessWeights: FitnessWeights,
  optimizationSettings: OptimizationSettings,
  bounds: ParameterBounds = DEFAULT_BOUNDS,
  seed: string = "sim-anneal"
): Promise<OptimizationResult> {
  const rng = createRNG(seed);

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
  let currentEval = await computeFitnessLight(
    currentDomain,
    currentTheta,
    validationSettings,
    fitnessWeights,
    0
  );

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
    // Propose perturbation
    const proposedTheta = perturbParameters(currentTheta, stepSizes, rng);
    const proposedDomain = decodeParameters(proposedTheta, initialDomain, bounds);

    // Evaluate proposed config
    const proposedEval = await computeFitnessLight(
      proposedDomain,
      proposedTheta,
      validationSettings,
      fitnessWeights,
      i
    );

    evaluations.push(proposedEval);

    // Calculate fitness delta
    const delta = proposedEval.fitness - currentEval.fitness;

    // Acceptance criterion
    let accept = false;
    if (delta > 0) {
      // Always accept improvements
      accept = true;
    } else {
      // Accept worse moves with probability exp(delta / T)
      const acceptanceProbability = Math.exp(delta / temperature);
      accept = rng() < acceptanceProbability;

      if (verbose && accept) {
        console.log(
          `[${i}] Accepting worse move: ` +
            `Δf = ${delta.toFixed(4)}, P = ${acceptanceProbability.toFixed(3)}, T = ${temperature.toFixed(3)}`
        );
      }
    }

    // Apply move if accepted
    if (accept) {
      currentTheta = proposedTheta;
      currentDomain = proposedDomain;
      currentEval = proposedEval;
      acceptedMoves++;

      // Track best ever seen
      if (proposedEval.fitness > bestEval.fitness) {
        bestEval = proposedEval;

        if (verbose) {
          console.log(
            `[${i}/${iterations}] New best: ${bestEval.fitness.toFixed(4)} ` +
              `(+${((bestEval.fitness - initialFitness) * 100).toFixed(1)}%)`
          );
        }
      }
    } else {
      rejectedMoves++;
    }

    convergenceHistory.push(bestEval.fitness);

    // Cool temperature
    temperature *= coolingRate;

    // Check for convergence
    const improvement = bestEval.fitness - lastBestFitness;
    if (improvement < convergenceThreshold) {
      noImprovementCount++;
      if (noImprovementCount >= convergenceWindow) {
        if (verbose) {
          console.log(
            `Converged after ${i} iterations (no significant improvement for ${noImprovementCount} iterations)`
          );
        }
        break;
      }
    } else {
      noImprovementCount = 0;
      lastBestFitness = bestEval.fitness;
    }

    // Progress logging
    if (verbose && i % 10 === 0) {
      const acceptanceRate = acceptedMoves / (acceptedMoves + rejectedMoves);
      console.log(
        `[${i}/${iterations}] ` +
          `Best: ${bestEval.fitness.toFixed(4)}, ` +
          `Current: ${currentEval.fitness.toFixed(4)}, ` +
          `T: ${temperature.toFixed(3)}, ` +
          `Accept rate: ${(acceptanceRate * 100).toFixed(1)}%`
      );
    }
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
