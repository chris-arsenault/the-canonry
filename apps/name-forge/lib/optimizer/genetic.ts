/**
 * Genetic Algorithm Optimizer
 *
 * Evolves domain configurations through selection, crossover, and mutation.
 * Particularly effective for optimizing discrete properties like phoneme sets.
 */

import { createRNG } from "../utils/rng.js";
import { computeFitness } from "./fitness.js";
import {
  applyMultipleMutations,
  applyWeightedMutation,
  MUTATION_WEIGHTS,
} from "./mutations.js";
import type { NamingDomain } from "../types/domain.js";
import type {
  OptimizationSettings,
  ValidationSettings,
  FitnessWeights,
  OptimizationResult,
  EvaluationResult,
} from "./optimization.js";

/**
 * Evaluate a batch of configs sequentially
 */
async function evaluateBatch(
  configs: NamingDomain[],
  validationSettings: ValidationSettings,
  fitnessWeights: FitnessWeights,
  siblingDomains: NamingDomain[],
  generation: number
): Promise<EvaluationResult[]> {
  const results: EvaluationResult[] = [];
  for (let i = 0; i < configs.length; i++) {
    const result = await computeFitness(
      configs[i],
      {
        consonantWeights: [],
        vowelWeights: [],
        templateWeights: [],
        structureWeights: [],
        apostropheRate: 0,
        hyphenRate: 0,
        lengthMin: 0,
        lengthMax: 0,
      },
      validationSettings,
      fitnessWeights,
      siblingDomains,
      generation * 1000 + i,
      false
    );
    results.push(result);
  }
  return results;
}

/**
 * Individual in the population
 */
interface Individual {
  genome: NamingDomain;
  fitness: number;
  scores: EvaluationResult["scores"];
}

/**
 * GA-specific settings
 */
interface GASettings {
  populationSize: number;
  eliteCount: number;
  mutationRate: number;
  crossoverRate: number;
  tournamentSize: number;
  mutationsPerIndividual: number;
}

const DEFAULT_GA_SETTINGS: GASettings = {
  populationSize: 16,
  eliteCount: 2,
  mutationRate: 0.8,
  crossoverRate: 0.6,
  tournamentSize: 3,
  mutationsPerIndividual: 2,
};

/**
 * Crossover two domain configurations
 * Swaps phoneme subsets between parents
 */
function crossover(
  parent1: NamingDomain,
  parent2: NamingDomain,
  rng: () => number
): [NamingDomain, NamingDomain] {
  // Crossover consonants
  const crossConsonants = (
    c1: string[],
    c2: string[],
    w1: number[],
    w2: number[]
  ): [string[], string[], number[], number[]] => {
    const crossPoint = Math.floor(rng() * Math.min(c1.length, c2.length));
    const newC1 = [...c1.slice(0, crossPoint), ...c2.slice(crossPoint)];
    const newC2 = [...c2.slice(0, crossPoint), ...c1.slice(crossPoint)];
    const newW1 = [...w1.slice(0, crossPoint), ...w2.slice(crossPoint)];
    const newW2 = [...w2.slice(0, crossPoint), ...w1.slice(crossPoint)];

    // Remove duplicates
    const dedupe = (arr: string[], weights: number[]): [string[], number[]] => {
      const seen = new Set<string>();
      const result: string[] = [];
      const resultW: number[] = [];
      for (let i = 0; i < arr.length; i++) {
        if (!seen.has(arr[i])) {
          seen.add(arr[i]);
          result.push(arr[i]);
          resultW.push(weights[i] ?? 1);
        }
      }
      return [result, resultW];
    };

    const [deduped1, dedupedW1] = dedupe(newC1, newW1);
    const [deduped2, dedupedW2] = dedupe(newC2, newW2);

    return [deduped1, deduped2, dedupedW1, dedupedW2];
  };

  // Get weights or defaults
  const cw1 = parent1.phonology.consonantWeights || parent1.phonology.consonants.map(() => 1);
  const cw2 = parent2.phonology.consonantWeights || parent2.phonology.consonants.map(() => 1);
  const vw1 = parent1.phonology.vowelWeights || parent1.phonology.vowels.map(() => 1);
  const vw2 = parent2.phonology.vowelWeights || parent2.phonology.vowels.map(() => 1);

  // Crossover consonants
  const [newCons1, newCons2, newConsW1, newConsW2] = crossConsonants(
    parent1.phonology.consonants,
    parent2.phonology.consonants,
    cw1,
    cw2
  );

  // Crossover vowels
  const [newVowels1, newVowels2, newVowelW1, newVowelW2] = crossConsonants(
    parent1.phonology.vowels,
    parent2.phonology.vowels,
    vw1,
    vw2
  );

  // Crossover templates (simple swap)
  const swapTemplates = rng() < 0.5;
  const templates1 = swapTemplates ? parent2.phonology.syllableTemplates : parent1.phonology.syllableTemplates;
  const templates2 = swapTemplates ? parent1.phonology.syllableTemplates : parent2.phonology.syllableTemplates;
  const templatesW1 = swapTemplates
    ? (parent2.phonology.templateWeights || parent2.phonology.syllableTemplates.map(() => 1))
    : (parent1.phonology.templateWeights || parent1.phonology.syllableTemplates.map(() => 1));
  const templatesW2 = swapTemplates
    ? (parent1.phonology.templateWeights || parent1.phonology.syllableTemplates.map(() => 1))
    : (parent2.phonology.templateWeights || parent2.phonology.syllableTemplates.map(() => 1));

  // Create offspring
  const child1: NamingDomain = {
    ...parent1,
    phonology: {
      ...parent1.phonology,
      consonants: newCons1,
      consonantWeights: newConsW1,
      vowels: newVowels1,
      vowelWeights: newVowelW1,
      syllableTemplates: templates1,
      templateWeights: templatesW1,
    },
  };

  const child2: NamingDomain = {
    ...parent2,
    phonology: {
      ...parent2.phonology,
      consonants: newCons2,
      consonantWeights: newConsW2,
      vowels: newVowels2,
      vowelWeights: newVowelW2,
      syllableTemplates: templates2,
      templateWeights: templatesW2,
    },
  };

  return [child1, child2];
}

/**
 * Tournament selection
 */
function tournamentSelect(
  population: Individual[],
  tournamentSize: number,
  rng: () => number
): Individual {
  const tournament: Individual[] = [];

  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(rng() * population.length);
    tournament.push(population[idx]);
  }

  tournament.sort((a, b) => b.fitness - a.fitness);
  return tournament[0];
}

/**
 * Determine primary optimization goal from weights
 */
function getPrimaryGoal(weights: FitnessWeights): keyof typeof MUTATION_WEIGHTS {
  const goals: Array<{ goal: keyof typeof MUTATION_WEIGHTS; weight: number }> = [
    { goal: "capacity", weight: weights.capacity ?? 0 },
    { goal: "separation", weight: weights.separation ?? 0 },
    { goal: "pronounceability", weight: weights.pronounceability ?? 0 },
  ];

  goals.sort((a, b) => b.weight - a.weight);
  return goals[0].goal;
}

/** Optionally mutate a child genome based on mutation rate. */
function maybeApplyMutation(
  child: NamingDomain,
  mutationRate: number,
  mutationsPerIndividual: number,
  primaryGoal: string,
  rng: () => number
): NamingDomain {
  if (rng() >= mutationRate) return child;
  let result = child;
  for (let m = 0; m < mutationsPerIndividual; m++) {
    result = applyWeightedMutation(result, primaryGoal, rng);
  }
  return result;
}

/** Generate child genomes from a population via selection, crossover, and mutation. */
function generateChildren(
  population: Individual[],
  gaSettings: GASettings,
  primaryGoal: string,
  rng: () => number,
  targetCount: number
): NamingDomain[] {
  const childGenomes: NamingDomain[] = [];

  while (childGenomes.length < targetCount) {
    const parent1 = tournamentSelect(population, gaSettings.tournamentSize, rng);
    const parent2 = tournamentSelect(population, gaSettings.tournamentSize, rng);

    let child1: NamingDomain;
    let child2: NamingDomain;

    if (rng() < gaSettings.crossoverRate) {
      [child1, child2] = crossover(parent1.genome, parent2.genome, rng);
    } else {
      child1 = { ...parent1.genome };
      child2 = { ...parent2.genome };
    }

    child1 = maybeApplyMutation(child1, gaSettings.mutationRate, gaSettings.mutationsPerIndividual, primaryGoal, rng);
    child2 = maybeApplyMutation(child2, gaSettings.mutationRate, gaSettings.mutationsPerIndividual, primaryGoal, rng);

    childGenomes.push(child1);
    if (childGenomes.length < targetCount) {
      childGenomes.push(child2);
    }
  }

  return childGenomes;
}

/**
 * Run genetic algorithm optimization
 */
export async function geneticAlgorithm(
  initialDomain: NamingDomain,
  validationSettings: ValidationSettings,
  fitnessWeights: FitnessWeights,
  optimizationSettings: OptimizationSettings,
  seed: string = "ga",
  siblingDomains: NamingDomain[] = []
): Promise<OptimizationResult> {
  const rng = createRNG(seed);

  const gaSettings: GASettings = {
    ...DEFAULT_GA_SETTINGS,
    populationSize: optimizationSettings.populationSize || DEFAULT_GA_SETTINGS.populationSize,
  };

  const generations = optimizationSettings.iterations ?? 50;
  const useSeparation = siblingDomains.length > 0 && (fitnessWeights.separation ?? 0) > 0;
  const primaryGoal = getPrimaryGoal(fitnessWeights);

  console.log(`\n=== Genetic Algorithm ===`);
  console.log(`Population: ${gaSettings.populationSize}, Generations: ${generations}`);
  console.log(`Primary goal: ${primaryGoal}`);
  const geneticSeparationLabel = useSeparation ? `yes (${siblingDomains.length} siblings)` : "no";
  console.log(`Separation: ${geneticSeparationLabel}`);

  // Initialize population with mutations of initial domain
  console.log("\nInitializing population...");

  // Create all genomes first
  const genomes: NamingDomain[] = [];
  for (let i = 0; i < gaSettings.populationSize; i++) {
    const mutationCount = i === 0 ? 0 : Math.floor(rng() * 5) + 1;
    genomes.push(applyMultipleMutations(initialDomain, mutationCount, rng));
  }

  // Evaluate all individuals
  console.log(`  Evaluating ${genomes.length} individuals...`);

  const evalResults = await evaluateBatch(
    genomes,
    validationSettings,
    fitnessWeights,
    useSeparation ? siblingDomains : [],
    0
  );

  // Build population from results
  const population: Individual[] = genomes.map((genome, i) => ({
    genome,
    fitness: evalResults[i].fitness,
    scores: evalResults[i].scores,
  }));

  console.log(`  Population initialized.`);

  // Sort by fitness
  population.sort((a, b) => b.fitness - a.fitness);

  const initialFitness = population[0].fitness;
  console.log(`Initial best fitness: ${initialFitness.toFixed(4)}`);

  const evaluations: EvaluationResult[] = [];
  const convergenceHistory: number[] = [initialFitness];

  // Evolution loop
  for (let gen = 0; gen < generations; gen++) {
    const genStart = Date.now();

    const newPopulation: Individual[] = [];

    // Elitism: keep best individuals
    for (let i = 0; i < gaSettings.eliteCount; i++) {
      newPopulation.push(population[i]);
    }

    // Generate children through selection, crossover, mutation
    const childGenomes = generateChildren(
      population, gaSettings, primaryGoal, rng,
      gaSettings.populationSize - newPopulation.length
    );

    // Evaluate all children in parallel
    const childEvaluations = await evaluateBatch(
      childGenomes,
      validationSettings,
      fitnessWeights,
      useSeparation ? siblingDomains : [],
      gen + 1
    );

    // Add children to population
    for (let i = 0; i < childGenomes.length; i++) {
      newPopulation.push({
        genome: childGenomes[i],
        fitness: childEvaluations[i].fitness,
        scores: childEvaluations[i].scores,
      });
      evaluations.push(childEvaluations[i]);
    }

    // Replace population
    newPopulation.sort((a, b) => b.fitness - a.fitness);
    population.length = 0;
    population.push(...newPopulation.slice(0, gaSettings.populationSize));

    const genElapsed = ((Date.now() - genStart) / 1000).toFixed(1);
    const bestFitness = population[0].fitness;
    const avgFitness = population.reduce((sum, ind) => sum + ind.fitness, 0) / population.length;

    convergenceHistory.push(bestFitness);

    console.log(
      `[Gen ${gen + 1}/${generations}] ` +
      `Best: ${bestFitness.toFixed(4)}, Avg: ${avgFitness.toFixed(4)} ` +
      `(${genElapsed}s)`
    );

    if (bestFitness > initialFitness * 1.001) {
      const improvement = ((bestFitness - initialFitness) / initialFitness) * 100;
      console.log(`  -> Improvement: +${improvement.toFixed(1)}%`);
    }
  }

  const bestIndividual = population[0];
  const finalFitness = bestIndividual.fitness;
  const improvement = finalFitness - initialFitness;

  console.log("\n=== GA Complete ===");
  console.log(`Initial: ${initialFitness.toFixed(4)}`);
  console.log(`Final: ${finalFitness.toFixed(4)}`);
  console.log(`Improvement: +${(improvement * 100).toFixed(1)}%`);
  console.log(`Phonemes: ${bestIndividual.genome.phonology.consonants.length}C + ${bestIndividual.genome.phonology.vowels.length}V`);

  return {
    initialConfig: initialDomain,
    optimizedConfig: bestIndividual.genome,
    initialFitness,
    finalFitness,
    improvement,
    iterations: generations,
    evaluations,
    convergenceHistory,
    settings: optimizationSettings,
  };
}
