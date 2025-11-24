import type { FeatureVector, Centroid, ClassificationResult } from "../types/validation.js";
import {
  featureVectorToArray,
  buildVocabulary,
  calculateCentroid,
  normalizeFeatures,
} from "./features.js";
import { euclideanDistance } from "./distance.js";

/**
 * Simple nearest-centroid classifier
 * Classifies names by finding the closest domain centroid
 */
export class NearestCentroidClassifier {
  private centroids: Map<string, number[]> = new Map();
  private vocabulary: { bigrams: string[]; endings: string[] } | null = null;
  private normalization: { min: number[]; max: number[] } | null = null;

  /**
   * Train the classifier on labeled feature vectors
   */
  train(featureVectors: FeatureVector[]): void {
    if (featureVectors.length === 0) {
      throw new Error("Cannot train on empty dataset");
    }

    // Build vocabulary from all samples
    this.vocabulary = buildVocabulary(featureVectors);

    // Group by domain
    const byDomain = new Map<string, FeatureVector[]>();
    for (const fv of featureVectors) {
      const domain = fv.domainId;
      if (!byDomain.has(domain)) {
        byDomain.set(domain, []);
      }
      byDomain.get(domain)!.push(fv);
    }

    // Calculate centroids for each domain
    const allArrays: number[][] = [];
    const domainArrays = new Map<string, number[][]>();

    for (const [domain, vectors] of byDomain) {
      const arrays = vectors.map((fv) =>
        featureVectorToArray(fv, this.vocabulary!.bigrams, this.vocabulary!.endings)
      );
      domainArrays.set(domain, arrays);
      allArrays.push(...arrays);
    }

    // Normalize features
    const { normalized, min, max } = normalizeFeatures(allArrays);
    this.normalization = { min, max };

    // Calculate normalized centroids
    let offset = 0;
    for (const [domain, arrays] of domainArrays) {
      const normalizedSubset = normalized.slice(offset, offset + arrays.length);
      const centroid = this.calculateMeanVector(normalizedSubset);
      this.centroids.set(domain, centroid);
      offset += arrays.length;
    }
  }

  /**
   * Predict the domain for a feature vector
   */
  predict(fv: FeatureVector): string {
    if (!this.vocabulary || !this.normalization) {
      throw new Error("Classifier not trained");
    }

    // Convert to array
    const array = featureVectorToArray(
      fv,
      this.vocabulary.bigrams,
      this.vocabulary.endings
    );

    // Normalize
    const normalized = this.normalizeVector(array);

    // Find nearest centroid
    let nearestDomain = "";
    let minDistance = Infinity;

    for (const [domain, centroid] of this.centroids) {
      const dist = euclideanDistance(normalized, centroid);
      if (dist < minDistance) {
        minDistance = dist;
        nearestDomain = domain;
      }
    }

    return nearestDomain;
  }

  /**
   * Get all centroids
   */
  getCentroids(): Centroid[] {
    const result: Centroid[] = [];

    for (const [domainId, features] of this.centroids) {
      result.push({
        domainId,
        features,
        sampleCount: 0, // Would need to track during training
      });
    }

    return result;
  }

  /**
   * Calculate distance from a feature vector to all centroids
   */
  getCentroidDistances(fv: FeatureVector): Map<string, number> {
    if (!this.vocabulary || !this.normalization) {
      throw new Error("Classifier not trained");
    }

    const array = featureVectorToArray(
      fv,
      this.vocabulary.bigrams,
      this.vocabulary.endings
    );
    const normalized = this.normalizeVector(array);

    const distances = new Map<string, number>();
    for (const [domain, centroid] of this.centroids) {
      distances.set(domain, euclideanDistance(normalized, centroid));
    }

    return distances;
  }

  private calculateMeanVector(vectors: number[][]): number[] {
    if (vectors.length === 0) {
      return [];
    }

    const dimensions = vectors[0].length;
    const mean = new Array(dimensions).fill(0);

    for (const vec of vectors) {
      for (let i = 0; i < dimensions; i++) {
        mean[i] += vec[i];
      }
    }

    for (let i = 0; i < dimensions; i++) {
      mean[i] /= vectors.length;
    }

    return mean;
  }

  private normalizeVector(vec: number[]): number[] {
    if (!this.normalization) {
      return vec;
    }

    return vec.map((val, i) => {
      const range = this.normalization!.max[i] - this.normalization!.min[i];
      if (range === 0) return 0;
      return (val - this.normalization!.min[i]) / range;
    });
  }
}

/**
 * Perform k-fold cross-validation on a classifier
 */
export function crossValidate(
  featureVectors: FeatureVector[],
  k: number = 5
): {
  accuracy: number;
  results: ClassificationResult[];
  confusionMatrix: Map<string, Map<string, number>>;
} {
  const n = featureVectors.length;
  const foldSize = Math.floor(n / k);
  const results: ClassificationResult[] = [];

  // Initialize confusion matrix
  const domains = new Set(featureVectors.map((fv) => fv.domainId));
  const confusionMatrix = new Map<string, Map<string, number>>();
  for (const domain of domains) {
    confusionMatrix.set(domain, new Map());
    for (const otherDomain of domains) {
      confusionMatrix.get(domain)!.set(otherDomain, 0);
    }
  }

  // Shuffle data
  const shuffled = [...featureVectors].sort(() => Math.random() - 0.5);

  // Perform k-fold CV
  for (let i = 0; i < k; i++) {
    const testStart = i * foldSize;
    const testEnd = i === k - 1 ? n : testStart + foldSize;

    const testSet = shuffled.slice(testStart, testEnd);
    const trainSet = [
      ...shuffled.slice(0, testStart),
      ...shuffled.slice(testEnd),
    ];

    // Train classifier
    const classifier = new NearestCentroidClassifier();
    classifier.train(trainSet);

    // Test on test set
    for (const fv of testSet) {
      const predicted = classifier.predict(fv);
      const actual = fv.domainId;
      const correct = predicted === actual;

      results.push({ predicted, actual, correct });

      // Update confusion matrix
      const actualCount = confusionMatrix.get(actual)!.get(predicted) ?? 0;
      confusionMatrix.get(actual)!.set(predicted, actualCount + 1);
    }
  }

  // Calculate accuracy
  const correctCount = results.filter((r) => r.correct).length;
  const accuracy = correctCount / results.length;

  return { accuracy, results, confusionMatrix };
}
