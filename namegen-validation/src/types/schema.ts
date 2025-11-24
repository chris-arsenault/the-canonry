import { z } from "zod";

/**
 * Validation Configuration Schema
 */
export const ValidationConfigSchema = z.object({
  sampleSize: z
    .number()
    .int()
    .min(1)
    .default(1000)
    .describe("Number of names to generate for validation"),
  seed: z.string().optional().describe("Random seed for deterministic testing"),

  // Capacity thresholds
  maxCollisionRate: z
    .number()
    .min(0)
    .max(1)
    .default(0.05)
    .describe("Maximum acceptable collision rate (0-1)"),
  minEntropy: z
    .number()
    .min(0)
    .default(3.0)
    .describe("Minimum Shannon entropy (bits/char)"),

  // Diffuseness thresholds
  minNN_p5: z
    .number()
    .min(0)
    .max(1)
    .default(0.3)
    .describe("Minimum 5th percentile nearest-neighbor distance"),
  minShapeNN_p5: z
    .number()
    .min(0)
    .max(1)
    .default(0.2)
    .describe("Minimum 5th percentile shape distance"),

  // Separation thresholds
  minCentroidDistance: z
    .number()
    .min(0)
    .default(0.2)
    .describe("Minimum distance between domain centroids"),
  minClassifierAccuracy: z
    .number()
    .min(0)
    .max(1)
    .default(0.7)
    .describe("Minimum classifier accuracy (0-1)"),
});

/**
 * Capacity Report Schema
 */
export const CapacityReportSchema = z.object({
  domainId: z.string(),
  sampleSize: z.number(),
  uniqueCount: z.number(),
  collisionRate: z.number().describe("Fraction of duplicates (0-1)"),
  entropy: z.number().describe("Shannon entropy (bits/char)"),
  avgLength: z.number(),
  minLength: z.number(),
  maxLength: z.number(),
  passed: z.boolean(),
  issues: z.array(z.string()),
});

/**
 * Nearest Neighbor Statistics Schema
 */
export const NearestNeighborStatsSchema = z.object({
  min: z.number(),
  p1: z.number().describe("1st percentile"),
  p5: z.number().describe("5th percentile"),
  median: z.number(),
  p95: z.number().describe("95th percentile"),
  p99: z.number().describe("99th percentile"),
  max: z.number(),
  mean: z.number(),
});

/**
 * Diffuseness Report Schema
 */
export const DiffusenessReportSchema = z.object({
  domainId: z.string(),
  sampleSize: z.number(),
  levenshteinNN: NearestNeighborStatsSchema.describe(
    "Nearest-neighbor Levenshtein distances"
  ),
  shapeNN: NearestNeighborStatsSchema.describe(
    "Nearest-neighbor shape distances"
  ),
  passed: z.boolean(),
  issues: z.array(z.string()),
});

/**
 * Feature Vector Schema
 */
export const FeatureVectorSchema = z.object({
  name: z.string(),
  domainId: z.string(),
  features: z.object({
    length: z.number(),
    syllableCount: z.number(),
    vowelRatio: z.number(),
    apostropheCount: z.number(),
    hyphenCount: z.number(),
    // Bigram frequencies (top 10)
    bigrams: z.record(z.string(), z.number()),
    // Last 2 chars
    ending: z.string(),
  }),
});

/**
 * Centroid Schema
 */
export const CentroidSchema = z.object({
  domainId: z.string(),
  features: z.array(z.number()).describe("Average feature vector"),
  sampleCount: z.number(),
});

/**
 * Separation Report Schema
 */
export const SeparationReportSchema = z.object({
  domains: z.array(z.string()),
  sampleSize: z.number(),
  centroids: z.array(CentroidSchema),
  pairwiseDistances: z.record(
    z.string(),
    z.number().describe("Distance between domain pairs")
  ),
  classifierAccuracy: z.number().describe("Overall accuracy (0-1)"),
  confusionMatrix: z.record(
    z.string(),
    z.record(z.string(), z.number().describe("Count"))
  ),
  passed: z.boolean(),
  issues: z.array(z.string()),
});

/**
 * Combined Validation Report Schema
 */
export const ValidationReportSchema = z.object({
  timestamp: z.string(),
  capacity: CapacityReportSchema.optional(),
  diffuseness: DiffusenessReportSchema.optional(),
  separation: SeparationReportSchema.optional(),
  overallPassed: z.boolean(),
});
