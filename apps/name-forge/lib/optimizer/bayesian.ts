/**
 * Bayesian Optimization with Tree-structured Parzen Estimators (TPE)
 *
 * Efficient optimization for discrete/categorical parameters by modeling
 * the probability of good vs bad configurations.
 */

import { createRNG } from "../utils/rng.js";
import { computeFitness } from "./fitness.js";
import {
  getAllConsonants,
  getAllVowels,
  getAllTemplates,
  getAllClusters,
} from "../phoneme-library.js";
import type { NamingDomain } from "../types/domain.js";
import type {
  OptimizationSettings,
  ValidationSettings,
  FitnessWeights,
  OptimizationResult,
  EvaluationResult,
} from "./optimization.js";

/**
 * Configuration point in the search space
 */
interface ConfigPoint {
  // Phoneme inclusion flags (true = included)
  consonants: Map<string, boolean>;
  vowels: Map<string, boolean>;
  templates: Map<string, boolean>;
  clusters: Map<string, boolean>;

  // Continuous parameters
  apostropheRate: number;
  hyphenRate: number;
  lengthMin: number;
  lengthMax: number;
}

/**
 * Observation for TPE modeling
 */
interface Observation {
  point: ConfigPoint;
  fitness: number;
  domain: NamingDomain;
}

/**
 * TPE-specific settings
 */
interface TPESettings {
  nInitial: number; // Initial random samples
  gamma: number; // Quantile for good/bad split (typically 0.25)
  nCandidates: number; // EI candidates to evaluate per iteration
  minObservations: number; // Minimum before using TPE model
}

const DEFAULT_TPE_SETTINGS: TPESettings = {
  nInitial: 10,
  gamma: 0.25,
  nCandidates: 24,
  minObservations: 15,
};

/**
 * Encode a domain configuration as a ConfigPoint
 */
function encodeConfig(domain: NamingDomain): ConfigPoint {
  const allConsonants = getAllConsonants();
  const allVowels = getAllVowels();
  const allTemplates = getAllTemplates();
  const allClusters = getAllClusters();

  const consonants = new Map<string, boolean>();
  const vowels = new Map<string, boolean>();
  const templates = new Map<string, boolean>();
  const clusters = new Map<string, boolean>();

  // Encode consonant inclusion
  for (const c of allConsonants) {
    consonants.set(c, domain.phonology.consonants.includes(c));
  }

  // Encode vowel inclusion
  for (const v of allVowels) {
    vowels.set(v, domain.phonology.vowels.includes(v));
  }

  // Encode template inclusion
  for (const t of allTemplates) {
    templates.set(t, domain.phonology.syllableTemplates.includes(t));
  }

  // Encode cluster inclusion
  const domainClusters = domain.phonology.favoredClusters || [];
  for (const c of allClusters) {
    clusters.set(c, domainClusters.includes(c));
  }

  return {
    consonants,
    vowels,
    templates,
    clusters,
    apostropheRate: domain.style?.apostropheRate ?? 0,
    hyphenRate: domain.style?.hyphenRate ?? 0,
    lengthMin: domain.phonology.lengthRange?.[0] ?? 4,
    lengthMax: domain.phonology.lengthRange?.[1] ?? 12,
  };
}

/** Collect enabled items from a boolean map. */
function collectEnabled(map: Map<string, boolean>): string[] {
  const result: string[] = [];
  map.forEach((included, item) => { if (included) result.push(item); });
  return result;
}

/** Pad an array with items from a source until it reaches minCount. */
function ensureMinimum(arr: string[], source: string[], minCount: number): void {
  for (const item of source) {
    if (arr.length >= minCount) break;
    if (!arr.includes(item)) arr.push(item);
  }
}

/**
 * Decode a ConfigPoint back to a domain configuration
 */
function decodeConfig(point: ConfigPoint, baseDomain: NamingDomain): NamingDomain {
  const consonants = collectEnabled(point.consonants);
  const vowels = collectEnabled(point.vowels);
  const templates = collectEnabled(point.templates);
  const clusters = collectEnabled(point.clusters);

  // Ensure minimum viable configuration
  ensureMinimum(consonants, baseDomain.phonology.consonants, 5);
  ensureMinimum(vowels, baseDomain.phonology.vowels, 3);
  ensureMinimum(templates, baseDomain.phonology.syllableTemplates, 3);

  return {
    ...baseDomain,
    phonology: {
      ...baseDomain.phonology,
      consonants,
      vowels,
      syllableTemplates: templates,
      favoredClusters: clusters.length > 0 ? clusters : undefined,
      lengthRange: [Math.round(point.lengthMin), Math.round(point.lengthMax)] as [number, number],
    },
    style: {
      ...baseDomain.style,
      apostropheRate: point.apostropheRate,
      hyphenRate: point.hyphenRate,
    },
  };
}

/** Sample boolean inclusion for a set of items, biasing toward keeping existing domain items. */
function sampleBooleanMap(
  allItems: string[], domainItems: Set<string>,
  keepRate: number, addRate: number, rng: () => number
): Map<string, boolean> {
  const result = new Map<string, boolean>();
  for (const item of allItems) {
    result.set(item, domainItems.has(item) ? rng() < keepRate : rng() < addRate);
  }
  return result;
}

/**
 * Sample a random configuration point
 */
function sampleRandom(baseDomain: NamingDomain, rng: () => number): ConfigPoint {
  const consonants = sampleBooleanMap(
    getAllConsonants(), new Set(baseDomain.phonology.consonants), 0.8, 0.15, rng
  );
  const vowels = sampleBooleanMap(
    getAllVowels(), new Set(baseDomain.phonology.vowels), 0.8, 0.15, rng
  );
  const templates = sampleBooleanMap(
    getAllTemplates(), new Set(baseDomain.phonology.syllableTemplates), 0.7, 0.2, rng
  );
  const clusters = sampleBooleanMap(
    getAllClusters(), new Set(baseDomain.phonology.favoredClusters || []), 0.7, 0.1, rng
  );

  return {
    consonants,
    vowels,
    templates,
    clusters,
    apostropheRate: rng() * 0.15,
    hyphenRate: rng() * 0.1,
    lengthMin: 3 + Math.floor(rng() * 4),
    lengthMax: 8 + Math.floor(rng() * 8),
  };
}

/**
 * Estimate probability of phoneme inclusion being good
 * Based on frequency in good vs bad observations
 */
function estimateInclusionProbability(
  phoneme: string,
  goodObs: Observation[],
  badObs: Observation[],
  accessor: (point: ConfigPoint) => Map<string, boolean>,
  _prior: number = 0.5
): number {
  // Count inclusions in good vs bad
  let goodIncluded = 0;
  let badIncluded = 0;

  for (const obs of goodObs) {
    if (accessor(obs.point).get(phoneme)) goodIncluded++;
  }
  for (const obs of badObs) {
    if (accessor(obs.point).get(phoneme)) badIncluded++;
  }

  // Laplace smoothing
  const goodProb = (goodIncluded + 1) / (goodObs.length + 2);
  const badProb = (badIncluded + 1) / (badObs.length + 2);

  // Expected improvement ratio
  const ratio = goodProb / (badProb + 0.001);

  // Convert to probability (sigmoid)
  return 1 / (1 + Math.exp(-Math.log(ratio)));
}

/**
 * Sample from TPE model
 */
function sampleFromTPE(
  goodObs: Observation[],
  badObs: Observation[],
  baseDomain: NamingDomain,
  rng: () => number
): ConfigPoint {
  const allConsonants = getAllConsonants();
  const allVowels = getAllVowels();
  const allTemplates = getAllTemplates();
  const allClusters = getAllClusters();

  const consonants = new Map<string, boolean>();
  const vowels = new Map<string, boolean>();
  const templates = new Map<string, boolean>();
  const clusters = new Map<string, boolean>();

  // Sample consonants based on TPE model
  for (const c of allConsonants) {
    const prob = estimateInclusionProbability(
      c,
      goodObs,
      badObs,
      (p) => p.consonants
    );
    consonants.set(c, rng() < prob);
  }

  // Sample vowels
  for (const v of allVowels) {
    const prob = estimateInclusionProbability(
      v,
      goodObs,
      badObs,
      (p) => p.vowels
    );
    vowels.set(v, rng() < prob);
  }

  // Sample templates
  for (const t of allTemplates) {
    const prob = estimateInclusionProbability(
      t,
      goodObs,
      badObs,
      (p) => p.templates
    );
    templates.set(t, rng() < prob);
  }

  // Sample clusters
  for (const c of allClusters) {
    const prob = estimateInclusionProbability(
      c,
      goodObs,
      badObs,
      (p) => p.clusters
    );
    clusters.set(c, rng() < prob);
  }

  // Sample continuous parameters from good distribution
  const goodApostrophe = goodObs.map((o) => o.point.apostropheRate);
  const goodHyphen = goodObs.map((o) => o.point.hyphenRate);
  const goodLengthMin = goodObs.map((o) => o.point.lengthMin);
  const goodLengthMax = goodObs.map((o) => o.point.lengthMax);

  // Sample from kernel density estimate of good observations
  const sampleFromGood = (values: number[], noise: number): number => {
    if (values.length === 0) return rng();
    const base = values[Math.floor(rng() * values.length)];
    return base + (rng() - 0.5) * noise;
  };

  return {
    consonants,
    vowels,
    templates,
    clusters,
    apostropheRate: Math.max(0, Math.min(0.3, sampleFromGood(goodApostrophe, 0.05))),
    hyphenRate: Math.max(0, Math.min(0.2, sampleFromGood(goodHyphen, 0.03))),
    lengthMin: Math.max(2, Math.min(8, sampleFromGood(goodLengthMin, 1))),
    lengthMax: Math.max(6, Math.min(20, sampleFromGood(goodLengthMax, 2))),
  };
}

/**
 * Compute expected improvement score for a candidate
 */
function computeEI(
  point: ConfigPoint,
  goodObs: Observation[],
  badObs: Observation[]
): number {
  // Simplified EI: ratio of likelihood under good vs bad model

  let logGood = 0;
  let logBad = 0;

  // For each phoneme, compute log likelihood
  const computeLogLikelihood = (
    included: boolean,
    phoneme: string,
    obs: Observation[],
    accessor: (p: ConfigPoint) => Map<string, boolean>
  ): number => {
    let count = 0;
    for (const o of obs) {
      if (accessor(o.point).get(phoneme) === included) count++;
    }
    const prob = (count + 1) / (obs.length + 2); // Laplace smoothing
    return Math.log(prob);
  };

  // Consonants
  point.consonants.forEach((included, phoneme) => {
    logGood += computeLogLikelihood(included, phoneme, goodObs, (p) => p.consonants);
    logBad += computeLogLikelihood(included, phoneme, badObs, (p) => p.consonants);
  });

  // Vowels
  point.vowels.forEach((included, phoneme) => {
    logGood += computeLogLikelihood(included, phoneme, goodObs, (p) => p.vowels);
    logBad += computeLogLikelihood(included, phoneme, badObs, (p) => p.vowels);
  });

  // Templates (weighted more heavily)
  point.templates.forEach((included, template) => {
    logGood += 2 * computeLogLikelihood(included, template, goodObs, (p) => p.templates);
    logBad += 2 * computeLogLikelihood(included, template, badObs, (p) => p.templates);
  });

  // EI approximation: exp(logGood) / exp(logBad)
  // In log space: logGood - logBad
  return logGood - logBad;
}

/** Generate TPE candidates and return the one with highest expected improvement. */
function selectBestTPECandidate(
  goodObs: Observation[], badObs: Observation[],
  baseDomain: NamingDomain, rng: () => number, nCandidates: number
): { point: ConfigPoint; ei: number } {
  const candidates: { point: ConfigPoint; ei: number }[] = [];
  for (let c = 0; c < nCandidates; c++) {
    const point = sampleFromTPE(goodObs, badObs, baseDomain, rng);
    candidates.push({ point, ei: computeEI(point, goodObs, badObs) });
  }
  candidates.sort((a, b) => b.ei - a.ei);
  return candidates[0];
}

/**
 * Run Bayesian optimization with TPE
 */
export async function bayesianOptimization(
  initialDomain: NamingDomain,
  validationSettings: ValidationSettings,
  fitnessWeights: FitnessWeights,
  optimizationSettings: OptimizationSettings,
  seed: string = "tpe",
  siblingDomains: NamingDomain[] = []
): Promise<OptimizationResult> {
  const rng = createRNG(seed);

  const tpeSettings: TPESettings = {
    ...DEFAULT_TPE_SETTINGS,
    nInitial: Math.min(optimizationSettings.iterations ?? 50, 15),
  };

  const totalIterations = optimizationSettings.iterations ?? 50;
  const useSeparation = siblingDomains.length > 0 && (fitnessWeights.separation ?? 0) > 0;

  console.log("\n=== Bayesian Optimization (TPE) ===");
  console.log(`Initial samples: ${tpeSettings.nInitial}`);
  console.log(`Total iterations: ${totalIterations}`);
  console.log(`Gamma (quantile): ${tpeSettings.gamma}`);
  const separationLabel = useSeparation ? `yes (${siblingDomains.length} siblings)` : "no";
  console.log(`Separation: ${separationLabel}`);

  const observations: Observation[] = [];
  const evaluations: EvaluationResult[] = [];
  const convergenceHistory: number[] = [];

  // Evaluate initial domain
  const initialEval = await computeFitness(
    initialDomain,
    { consonantWeights: [], vowelWeights: [], templateWeights: [], structureWeights: [], apostropheRate: 0, hyphenRate: 0, lengthMin: 0, lengthMax: 0 },
    validationSettings,
    fitnessWeights,
    useSeparation ? siblingDomains : [],
    0,
    false
  );

  const initialFitness = initialEval.fitness;
  console.log(`Initial fitness: ${initialFitness.toFixed(4)}`);

  observations.push({
    point: encodeConfig(initialDomain),
    fitness: initialFitness,
    domain: initialDomain,
  });
  evaluations.push(initialEval);
  convergenceHistory.push(initialFitness);

  let bestFitness = initialFitness;
  let bestDomain = initialDomain;

  // Phase 1: Random exploration
  console.log("\nPhase 1: Random exploration...");
  for (let i = 0; i < tpeSettings.nInitial - 1; i++) {
    const point = sampleRandom(initialDomain, rng);
    const domain = decodeConfig(point, initialDomain);

    const evalResult = await computeFitness(
      domain,
      { consonantWeights: [], vowelWeights: [], templateWeights: [], structureWeights: [], apostropheRate: 0, hyphenRate: 0, lengthMin: 0, lengthMax: 0 },
      validationSettings,
      fitnessWeights,
      useSeparation ? siblingDomains : [],
      i + 1,
      false
    );

    observations.push({ point, fitness: evalResult.fitness, domain });
    evaluations.push(evalResult);
    convergenceHistory.push(Math.max(bestFitness, evalResult.fitness));

    if (evalResult.fitness > bestFitness) {
      bestFitness = evalResult.fitness;
      bestDomain = domain;
      console.log(`  [${i + 1}] New best: ${bestFitness.toFixed(4)}`);
    }

    process.stdout.write(`\r  Exploring ${i + 1}/${tpeSettings.nInitial - 1}`);
  }
  console.log();

  // Phase 2: TPE-guided search
  console.log("\nPhase 2: TPE-guided optimization...");
  for (let iter = tpeSettings.nInitial; iter < totalIterations; iter++) {
    const sorted = [...observations].sort((a, b) => b.fitness - a.fitness);
    const splitIdx = Math.max(1, Math.floor(sorted.length * tpeSettings.gamma));
    const goodObs = sorted.slice(0, splitIdx);
    const badObs = sorted.slice(splitIdx);

    const bestCandidate = selectBestTPECandidate(goodObs, badObs, initialDomain, rng, tpeSettings.nCandidates);
    const domain = decodeConfig(bestCandidate.point, initialDomain);

    const evalResult = await computeFitness(
      domain,
      { consonantWeights: [], vowelWeights: [], templateWeights: [], structureWeights: [], apostropheRate: 0, hyphenRate: 0, lengthMin: 0, lengthMax: 0 },
      validationSettings,
      fitnessWeights,
      useSeparation ? siblingDomains : [],
      iter,
      false
    );

    observations.push({ point: bestCandidate.point, fitness: evalResult.fitness, domain });
    evaluations.push(evalResult);
    convergenceHistory.push(Math.max(bestFitness, evalResult.fitness));

    if (evalResult.fitness > bestFitness) {
      bestFitness = evalResult.fitness;
      bestDomain = domain;
      console.log(`[${iter + 1}/${totalIterations}] New best: ${bestFitness.toFixed(4)} (EI: ${bestCandidate.ei.toFixed(2)})`);
    } else if ((iter + 1) % 10 === 0) {
      console.log(`[${iter + 1}/${totalIterations}] Best: ${bestFitness.toFixed(4)}, Current: ${evalResult.fitness.toFixed(4)}`);
    }
  }

  const improvement = bestFitness - initialFitness;

  console.log("\n=== TPE Complete ===");
  console.log(`Initial: ${initialFitness.toFixed(4)}`);
  console.log(`Final: ${bestFitness.toFixed(4)}`);
  console.log(`Improvement: ${improvement >= 0 ? "+" : ""}${(improvement * 100).toFixed(1)}%`);
  console.log(`Phonemes: ${bestDomain.phonology.consonants.length}C + ${bestDomain.phonology.vowels.length}V`);
  console.log(`Templates: ${bestDomain.phonology.syllableTemplates.length}`);

  return {
    initialConfig: initialDomain,
    optimizedConfig: bestDomain,
    initialFitness,
    finalFitness: bestFitness,
    improvement,
    iterations: totalIterations,
    evaluations,
    convergenceHistory,
    settings: optimizationSettings,
  };
}

/**
 * Analyze phoneme importance from TPE observations
 */
export function analyzePhonemeImportance(
  observations: Observation[],
  gamma: number = 0.25
): {
  consonants: Array<{ phoneme: string; importance: number }>;
  vowels: Array<{ phoneme: string; importance: number }>;
  templates: Array<{ template: string; importance: number }>;
} {
  const sorted = [...observations].sort((a, b) => b.fitness - a.fitness);
  const splitIdx = Math.max(1, Math.floor(sorted.length * gamma));
  const goodObs = sorted.slice(0, splitIdx);
  const badObs = sorted.slice(splitIdx);

  const analyzeCategory = (
    accessor: (p: ConfigPoint) => Map<string, boolean>
  ): Array<{ phoneme: string; importance: number }> => {
    const results: Array<{ phoneme: string; importance: number }> = [];

    // Get all keys from first observation
    const firstPoint = observations[0].point;
    const keys = Array.from(accessor(firstPoint).keys());

    for (const key of keys) {
      const importance = estimateInclusionProbability(
        key,
        goodObs,
        badObs,
        accessor
      );
      results.push({ phoneme: key, importance });
    }

    return results.sort((a, b) => b.importance - a.importance);
  };

  return {
    consonants: analyzeCategory((p) => p.consonants),
    vowels: analyzeCategory((p) => p.vowels),
    templates: analyzeCategory((p) => p.templates).map((r) => ({
      template: r.phoneme,
      importance: r.importance,
    })),
  };
}
