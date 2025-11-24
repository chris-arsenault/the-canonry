import { z } from "zod";
import {
  ValidationConfigSchema,
  CapacityReportSchema,
  DiffusenessReportSchema,
  SeparationReportSchema,
  ValidationReportSchema,
  NearestNeighborStatsSchema,
  FeatureVectorSchema,
  CentroidSchema,
} from "./schema.js";

/**
 * TypeScript types derived from Zod schemas
 */

export type ValidationConfig = z.infer<typeof ValidationConfigSchema>;
export type CapacityReport = z.infer<typeof CapacityReportSchema>;
export type DiffusenessReport = z.infer<typeof DiffusenessReportSchema>;
export type SeparationReport = z.infer<typeof SeparationReportSchema>;
export type ValidationReport = z.infer<typeof ValidationReportSchema>;
export type NearestNeighborStats = z.infer<typeof NearestNeighborStatsSchema>;
export type FeatureVector = z.infer<typeof FeatureVectorSchema>;
export type Centroid = z.infer<typeof CentroidSchema>;

/**
 * Distance matrix result
 */
export interface DistanceMatrix {
  names: string[];
  distances: number[][];
}

/**
 * Nearest neighbor result for a single name
 */
export interface NearestNeighbor {
  name: string;
  nearestName: string;
  distance: number;
}

/**
 * Classification result for separation testing
 */
export interface ClassificationResult {
  predicted: string;
  actual: string;
  correct: boolean;
  confidence?: number;
}
