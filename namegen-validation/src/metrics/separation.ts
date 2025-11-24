import type { NamingDomain } from "world-gen-naming";
import { testDomain } from "world-gen-naming";
import type {
  SeparationReport,
  ValidationConfig,
  FeatureVector,
  Centroid,
} from "../types/validation.js";
import { extractFeatures, calculateCentroid, buildVocabulary } from "../analysis/features.js";
import {
  NearestCentroidClassifier,
  crossValidate,
} from "../analysis/classifier.js";
import { euclideanDistance } from "../analysis/distance.js";

/**
 * Validate separation between multiple domains
 * Tests if names from different domains are distinguishable by shape
 */
export function validateSeparation(
  domains: NamingDomain[],
  config: Partial<ValidationConfig> = {}
): SeparationReport {
  if (domains.length < 2) {
    throw new Error("Need at least 2 domains to test separation");
  }

  const sampleSize = config.sampleSize ?? 200;
  const minCentroidDistance = config.minCentroidDistance ?? 0.2;
  const minClassifierAccuracy = config.minClassifierAccuracy ?? 0.7;

  // Generate samples for each domain
  const allFeatureVectors: FeatureVector[] = [];

  for (const domain of domains) {
    const testResult = testDomain(domain, sampleSize, config.seed);

    for (const name of testResult.samples) {
      const fv = extractFeatures(name, domain.id);
      allFeatureVectors.push(fv);
    }
  }

  // Build vocabulary and calculate centroids
  const vocabulary = buildVocabulary(allFeatureVectors);
  const centroids: Centroid[] = [];

  const byDomain = new Map<string, FeatureVector[]>();
  for (const fv of allFeatureVectors) {
    if (!byDomain.has(fv.domainId)) {
      byDomain.set(fv.domainId, []);
    }
    byDomain.get(fv.domainId)!.push(fv);
  }

  for (const [domainId, vectors] of byDomain) {
    const centroidFeatures = calculateCentroid(
      vectors,
      vocabulary.bigrams,
      vocabulary.endings
    );

    centroids.push({
      domainId,
      features: centroidFeatures,
      sampleCount: vectors.length,
    });
  }

  // Calculate pairwise centroid distances
  const pairwiseDistances: Record<string, number> = {};

  for (let i = 0; i < centroids.length; i++) {
    for (let j = i + 1; j < centroids.length; j++) {
      const c1 = centroids[i];
      const c2 = centroids[j];
      const dist = euclideanDistance(c1.features, c2.features);
      const key = `${c1.domainId}-${c2.domainId}`;
      pairwiseDistances[key] = dist;
    }
  }

  // Train and evaluate classifier with cross-validation
  const cvResult = crossValidate(allFeatureVectors, 5);

  // Build confusion matrix in the expected format
  const confusionMatrix: Record<string, Record<string, number>> = {};
  for (const [actual, predictions] of cvResult.confusionMatrix) {
    confusionMatrix[actual] = {};
    for (const [predicted, count] of predictions) {
      confusionMatrix[actual][predicted] = count;
    }
  }

  // Determine pass/fail
  const issues: string[] = [];
  let passed = true;

  // Check centroid distances
  for (const [pair, dist] of Object.entries(pairwiseDistances)) {
    if (dist < minCentroidDistance) {
      issues.push(
        `Centroid distance for ${pair} is ${dist.toFixed(3)}, below threshold ${minCentroidDistance}`
      );
      passed = false;
    }
  }

  // Check classifier accuracy
  if (cvResult.accuracy < minClassifierAccuracy) {
    issues.push(
      `Classifier accuracy ${(cvResult.accuracy * 100).toFixed(1)}% below threshold ${(minClassifierAccuracy * 100).toFixed(1)}%`
    );
    passed = false;
  }

  // Check for specific domain pairs with high confusion
  for (const [actual, predictions] of cvResult.confusionMatrix) {
    const totalActual = Array.from(predictions.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    for (const [predicted, count] of predictions) {
      if (actual !== predicted && count / totalActual > 0.3) {
        issues.push(
          `High confusion: ${actual} misclassified as ${predicted} ${((count / totalActual) * 100).toFixed(1)}% of the time`
        );
      }
    }
  }

  return {
    domains: domains.map((d) => d.id),
    sampleSize,
    centroids,
    pairwiseDistances,
    classifierAccuracy: cvResult.accuracy,
    confusionMatrix,
    passed,
    issues,
  };
}

/**
 * Calculate separation score between two specific domains
 */
export function compareDomains(
  domain1: NamingDomain,
  domain2: NamingDomain,
  sampleSize: number = 200,
  seed?: string
): {
  centroidDistance: number;
  classifierAccuracy: number;
  domain1MisclassifiedAs2: number;
  domain2MisclassifiedAs1: number;
} {
  const report = validateSeparation([domain1, domain2], { sampleSize, seed });

  const key = `${domain1.id}-${domain2.id}`;
  const centroidDistance = report.pairwiseDistances[key] ?? 0;

  const domain1Total =
    Object.values(report.confusionMatrix[domain1.id] ?? {}).reduce(
      (sum, count) => sum + count,
      0
    );
  const domain1MisclassifiedAs2 =
    (report.confusionMatrix[domain1.id]?.[domain2.id] ?? 0) / domain1Total;

  const domain2Total =
    Object.values(report.confusionMatrix[domain2.id] ?? {}).reduce(
      (sum, count) => sum + count,
      0
    );
  const domain2MisclassifiedAs1 =
    (report.confusionMatrix[domain2.id]?.[domain1.id] ?? 0) / domain2Total;

  return {
    centroidDistance,
    classifierAccuracy: report.classifierAccuracy,
    domain1MisclassifiedAs2,
    domain2MisclassifiedAs1,
  };
}
