import type { FeatureVector } from "../types/validation.js";

/**
 * Estimate syllable count based on vowel groups
 */
export function estimateSyllableCount(name: string): number {
  const vowelGroups = name.toLowerCase().match(/[aeiou]+/g);
  return vowelGroups ? vowelGroups.length : 1;
}

/**
 * Calculate vowel ratio (vowels / total length)
 */
export function calculateVowelRatio(name: string): number {
  if (name.length === 0) return 0;
  const vowelCount = (name.toLowerCase().match(/[aeiou]/g) || []).length;
  return vowelCount / name.length;
}

/**
 * Count apostrophes in a name
 */
export function countApostrophes(name: string): number {
  return (name.match(/'/g) || []).length;
}

/**
 * Count hyphens in a name
 */
export function countHyphens(name: string): number {
  return (name.match(/-/g) || []).length;
}

/**
 * Extract character bigrams (2-character sequences)
 */
export function extractBigrams(name: string): Map<string, number> {
  const bigrams = new Map<string, number>();
  const normalized = name.toLowerCase();

  for (let i = 0; i < normalized.length - 1; i++) {
    const bigram = normalized.substring(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
  }

  return bigrams;
}

/**
 * Get the ending (last 2 chars) of a name
 */
export function getEnding(name: string): string {
  return name.length >= 2
    ? name.substring(name.length - 2).toLowerCase()
    : name.toLowerCase();
}

/**
 * Extract feature vector from a name
 */
export function extractFeatures(
  name: string,
  domainId: string
): FeatureVector {
  const bigrams = extractBigrams(name);

  // Convert bigrams to frequency counts (top 10 most common)
  const bigramFreqs: Record<string, number> = {};
  const sortedBigrams = Array.from(bigrams.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [bigram, count] of sortedBigrams) {
    bigramFreqs[bigram] = count;
  }

  return {
    name,
    domainId,
    features: {
      length: name.length,
      syllableCount: estimateSyllableCount(name),
      vowelRatio: calculateVowelRatio(name),
      apostropheCount: countApostrophes(name),
      hyphenCount: countHyphens(name),
      bigrams: bigramFreqs,
      ending: getEnding(name),
    },
  };
}

/**
 * Convert a feature vector to a numeric array for ML
 * This flattens the structured features into a single vector
 */
export function featureVectorToArray(
  fv: FeatureVector,
  allBigrams: string[],
  allEndings: string[]
): number[] {
  const features: number[] = [];

  // Basic numeric features
  features.push(fv.features.length);
  features.push(fv.features.syllableCount);
  features.push(fv.features.vowelRatio);
  features.push(fv.features.apostropheCount);
  features.push(fv.features.hyphenCount);

  // Bigram features (one-hot-ish encoding)
  for (const bigram of allBigrams) {
    features.push(fv.features.bigrams[bigram] ?? 0);
  }

  // Ending feature (one-hot encoding)
  const endingIndex = allEndings.indexOf(fv.features.ending);
  for (let i = 0; i < allEndings.length; i++) {
    features.push(i === endingIndex ? 1 : 0);
  }

  return features;
}

/**
 * Build vocabulary of all bigrams and endings from a set of feature vectors
 */
export function buildVocabulary(featureVectors: FeatureVector[]): {
  bigrams: string[];
  endings: string[];
} {
  const bigramSet = new Set<string>();
  const endingSet = new Set<string>();

  for (const fv of featureVectors) {
    for (const bigram of Object.keys(fv.features.bigrams)) {
      bigramSet.add(bigram);
    }
    endingSet.add(fv.features.ending);
  }

  return {
    bigrams: Array.from(bigramSet).sort(),
    endings: Array.from(endingSet).sort(),
  };
}

/**
 * Calculate centroid (mean) of feature vectors
 */
export function calculateCentroid(
  featureVectors: FeatureVector[],
  allBigrams: string[],
  allEndings: string[]
): number[] {
  if (featureVectors.length === 0) {
    // Return zero vector
    return new Array(5 + allBigrams.length + allEndings.length).fill(0);
  }

  // Convert all to arrays
  const arrays = featureVectors.map((fv) =>
    featureVectorToArray(fv, allBigrams, allEndings)
  );

  // Calculate mean for each dimension
  const dimensions = arrays[0].length;
  const centroid: number[] = new Array(dimensions).fill(0);

  for (const arr of arrays) {
    for (let i = 0; i < dimensions; i++) {
      centroid[i] += arr[i];
    }
  }

  for (let i = 0; i < dimensions; i++) {
    centroid[i] /= arrays.length;
  }

  return centroid;
}

/**
 * Normalize feature vectors to [0, 1] range
 * Helps with distance calculations and classification
 */
export function normalizeFeatures(
  featureArrays: number[][]
): {
  normalized: number[][];
  min: number[];
  max: number[];
} {
  if (featureArrays.length === 0) {
    return { normalized: [], min: [], max: [] };
  }

  const dimensions = featureArrays[0].length;
  const min: number[] = new Array(dimensions).fill(Infinity);
  const max: number[] = new Array(dimensions).fill(-Infinity);

  // Find min/max for each dimension
  for (const arr of featureArrays) {
    for (let i = 0; i < dimensions; i++) {
      min[i] = Math.min(min[i], arr[i]);
      max[i] = Math.max(max[i], arr[i]);
    }
  }

  // Normalize
  const normalized = featureArrays.map((arr) => {
    return arr.map((val, i) => {
      const range = max[i] - min[i];
      if (range === 0) return 0;
      return (val - min[i]) / range;
    });
  });

  return { normalized, min, max };
}
