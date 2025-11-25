/**
 * Optimization types for ML-based domain parameter tuning
 *
 * Separates:
 * - Symbolic inventory (from LLM, mostly fixed)
 * - Numeric knobs (optimized by ML)
 */

import { z } from "zod";
import type { NamingDomain } from "./domain.js";

/**
 * Settings for validation during optimization
 */
export const ValidationSettingsSchema = z.object({
  requiredNames: z.number().int().positive(),
  sampleFactor: z.number().positive().default(20),
  maxSampleSize: z.number().int().positive().default(20_000),

  // Diffuseness thresholds (normalized Levenshtein)
  minNN_p5: z.number().min(0).max(1).default(0.3),
  minShapeNN_p5: z.number().min(0).max(1).default(0.2),

  // Separation thresholds
  minCentroidDistance: z.number().min(0).max(1).default(0.2),
});

export type ValidationSettings = z.infer<typeof ValidationSettingsSchema>;

/**
 * Weights for combining validation metrics into fitness score
 */
export const FitnessWeightsSchema = z.object({
  capacity: z.number().min(0).default(1.0),
  diffuseness: z.number().min(0).default(1.0),
  separation: z.number().min(0).default(1.0),
  pronounceability: z.number().min(0).default(0.0),
  length: z.number().min(0).default(0.0),
  style: z.number().min(0).default(0.0), // Optional LLM-based style check
});

export type FitnessWeights = z.infer<typeof FitnessWeightsSchema>;

/**
 * Available optimization algorithms
 */
export type OptimizationAlgorithm = "hillclimb" | "sim_anneal" | "cma-es" | "ga" | "bayes";

/**
 * Settings for the optimization process
 */
export const OptimizationSettingsSchema = z.object({
  algorithm: z.enum(["hillclimb", "sim_anneal", "cma-es", "ga", "bayes"]).optional(),
  iterations: z.number().int().positive().optional(),
  populationSize: z.number().int().positive().optional(),

  // Hill-climbing / Simulated Annealing settings
  stepSizes: z
    .object({
      weights: z.number().positive(),
      apostropheRate: z.number().positive(),
      hyphenRate: z.number().positive(),
      lengthRange: z.number().int().positive(),
    })
    .optional(),

  // Simulated Annealing settings
  initialTemperature: z.number().positive().optional(),
  coolingRate: z.number().min(0).max(1).optional(),

  // Early stopping
  convergenceThreshold: z.number().positive().optional(),
  convergenceWindow: z.number().int().positive().optional(),

  // Logging
  verbose: z.boolean().optional(),
});

export type OptimizationSettings = z.infer<typeof OptimizationSettingsSchema>;

/**
 * Parameter vector for optimization
 * Encoded representation of numeric knobs
 */
export interface ParameterVector {
  // Log-transformed weights (to keep positive)
  consonantWeights: number[];
  vowelWeights: number[];
  templateWeights: number[];
  structureWeights: number[];

  // Logit-transformed probabilities (to keep in [0,1])
  apostropheRate: number;
  hyphenRate: number;

  // Length range (continuous)
  lengthMin: number;
  lengthMax: number;

  // Optional: favored cluster boost
  favoredClusterBoost?: number;
}

/**
 * Result of a single optimization evaluation
 */
export interface EvaluationResult {
  config: NamingDomain;
  theta: ParameterVector;
  fitness: number;
  scores: {
    capacity: number;
    diffuseness: number;
    separation: number;
    pronounceability?: number;
    length?: number;
    style?: number;
  };
  iteration: number;
  timestamp: number;
}

/**
 * Final result of optimization run
 */
export interface OptimizationResult {
  initialConfig: NamingDomain;
  optimizedConfig: NamingDomain;
  initialFitness: number;
  finalFitness: number;
  improvement: number;
  iterations: number;
  evaluations: EvaluationResult[];
  convergenceHistory: number[];
  settings: OptimizationSettings;
}

/**
 * Bounds for parameter constraints
 */
export interface ParameterBounds {
  lengthMin: { min: number; max: number };
  lengthMax: { min: number; max: number };
  apostropheRate: { min: number; max: number };
  hyphenRate: { min: number; max: number };
  favoredClusterBoost?: { min: number; max: number };
}

export const DEFAULT_BOUNDS: ParameterBounds = {
  lengthMin: { min: 1, max: 5 },
  lengthMax: { min: 2, max: 10 },
  apostropheRate: { min: 0, max: 1 },
  hyphenRate: { min: 0, max: 1 },
  favoredClusterBoost: { min: 0, max: 20 },
};
