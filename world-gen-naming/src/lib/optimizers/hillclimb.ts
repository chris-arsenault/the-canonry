/**
 * Hill-climbing optimizer
 *
 * Simple baseline optimizer that proposes random perturbations
 * and accepts improvements.
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
 * Run hill-climbing optimization
 */
export async function hillclimb(
  initialDomain: NamingDomain,
  validationSettings: ValidationSettings,
  fitnessWeights: FitnessWeights,
  optimizationSettings: OptimizationSettings,
  bounds: ParameterBounds = DEFAULT_BOUNDS,
  seed: string = "hillclimb"
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
    console.log(
      `  Capacity: ${currentEval.scores.capacity.toFixed(3)}, ` +
        `Diffuseness: ${currentEval.scores.diffuseness.toFixed(3)}, ` +
        `Separation: ${currentEval.scores.separation.toFixed(3)}`
    );
  }

  // Track convergence
  let noImprovementCount = 0;
  let lastBestFitness = initialFitness;

  // Hill-climbing loop
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

    // Accept if better
    if (proposedEval.fitness > currentEval.fitness) {
      currentTheta = proposedTheta;
      currentDomain = proposedDomain;
      currentEval = proposedEval;

      if (proposedEval.fitness > bestEval.fitness) {
        bestEval = proposedEval;

        if (verbose) {
          console.log(
            `[${i}/${iterations}] New best: ${bestEval.fitness.toFixed(4)} ` +
              `(+${((bestEval.fitness - initialFitness) * 100).toFixed(1)}%)`
          );
        }
      }
    }

    convergenceHistory.push(bestEval.fitness);

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
      console.log(
        `[${i}/${iterations}] Current best: ${bestEval.fitness.toFixed(4)}`
      );
    }
  }

  const finalFitness = bestEval.fitness;
  const improvement = finalFitness - initialFitness;

  if (verbose) {
    console.log("\nOptimization complete!");
    console.log(`Initial fitness: ${initialFitness.toFixed(4)}`);
    console.log(`Final fitness: ${finalFitness.toFixed(4)}`);
    console.log(`Improvement: +${(improvement * 100).toFixed(1)}%`);
    console.log(`Total evaluations: ${evaluations.length}`);
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
