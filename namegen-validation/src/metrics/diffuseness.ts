import type { NamingDomain } from "world-gen-naming";
import { testDomain } from "world-gen-naming";
import type {
  DiffusenessReport,
  ValidationConfig,
  NearestNeighborStats,
} from "../types/validation.js";
import {
  findNearestNeighbors,
  normalizedLevenshtein,
  shapeDistance,
  calculatePercentiles,
} from "../analysis/distance.js";

/**
 * Validate diffuseness of a domain - are names within the domain distinct enough?
 */
export function validateDiffuseness(
  domain: NamingDomain,
  config: Partial<ValidationConfig> = {}
): DiffusenessReport {
  const sampleSize = config.sampleSize ?? 500;
  const minNN_p5 = config.minNN_p5 ?? 0.3;
  const minShapeNN_p5 = config.minShapeNN_p5 ?? 0.2;

  // Generate samples
  const testResult = testDomain(domain, sampleSize, config.seed);
  const samples = testResult.samples;

  // Find nearest neighbors using raw Levenshtein
  const levenshteinNN = findNearestNeighbors(samples, normalizedLevenshtein);
  const levenshteinDistances = levenshteinNN.map((nn) => nn.distance);
  const levenshteinStats = calculatePercentiles(levenshteinDistances);

  // Find nearest neighbors using shape distance
  const shapeNN = findNearestNeighbors(samples, shapeDistance);
  const shapeDistances = shapeNN.map((nn) => nn.distance);
  const shapeStats = calculatePercentiles(shapeDistances);

  // Determine pass/fail
  const issues: string[] = [];
  let passed = true;

  if (levenshteinStats.p5 < minNN_p5) {
    issues.push(
      `Levenshtein p5 distance ${levenshteinStats.p5.toFixed(3)} below threshold ${minNN_p5}`
    );
    passed = false;
  }

  if (shapeStats.p5 < minShapeNN_p5) {
    issues.push(
      `Shape p5 distance ${shapeStats.p5.toFixed(3)} below threshold ${minShapeNN_p5}`
    );
    passed = false;
  }

  // Additional checks
  if (levenshteinStats.min < 0.1) {
    const veryClose = levenshteinNN.filter((nn) => nn.distance < 0.1);
    issues.push(
      `${veryClose.length} name pairs are very similar (distance < 0.1). Examples: ${veryClose.slice(0, 3).map((nn) => `"${nn.name}" ↔ "${nn.nearestName}"`).join(", ")}`
    );
  }

  return {
    domainId: domain.id,
    sampleSize,
    levenshteinNN: levenshteinStats,
    shapeNN: shapeStats,
    passed,
    issues,
  };
}

/**
 * Find clusters of very similar names
 * Useful for identifying problematic groups
 */
export function findSimilarClusters(
  names: string[],
  threshold: number = 0.2,
  distanceFunc: (a: string, b: string) => number = normalizedLevenshtein
): string[][] {
  const clusters: string[][] = [];
  const visited = new Set<number>();

  for (let i = 0; i < names.length; i++) {
    if (visited.has(i)) continue;

    const cluster = [names[i]];
    visited.add(i);

    for (let j = i + 1; j < names.length; j++) {
      if (visited.has(j)) continue;

      const dist = distanceFunc(names[i], names[j]);
      if (dist <= threshold) {
        cluster.push(names[j]);
        visited.add(j);
      }
    }

    if (cluster.length > 1) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

/**
 * Analyze name diversity within a domain
 * Returns statistics about how varied the names are
 */
export function analyzeDiversity(
  domain: NamingDomain,
  sampleSize: number = 500,
  seed?: string
): {
  uniqueStarts: number;
  uniqueEndings: number;
  avgSimilarity: number;
  clusters: string[][];
} {
  const testResult = testDomain(domain, sampleSize, seed);
  const samples = testResult.samples;

  // Count unique starts (first 2 chars)
  const starts = new Set(samples.map((s) => s.substring(0, 2).toLowerCase()));

  // Count unique endings (last 2 chars)
  const endings = new Set(
    samples.map((s) => s.substring(s.length - 2).toLowerCase())
  );

  // Calculate average pairwise similarity (sample for efficiency)
  const maxPairs = Math.min(1000, (sampleSize * (sampleSize - 1)) / 2);
  let totalSimilarity = 0;
  let pairCount = 0;

  for (let i = 0; i < samples.length && pairCount < maxPairs; i++) {
    for (
      let j = i + 1;
      j < samples.length && pairCount < maxPairs;
      j++, pairCount++
    ) {
      const dist = normalizedLevenshtein(samples[i], samples[j]);
      totalSimilarity += 1 - dist; // Convert distance to similarity
    }
  }

  const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;

  // Find similar clusters
  const clusters = findSimilarClusters(samples, 0.2);

  return {
    uniqueStarts: starts.size,
    uniqueEndings: endings.size,
    avgSimilarity,
    clusters,
  };
}
