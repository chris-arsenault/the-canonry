/**
 * String distance metrics for name similarity analysis
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 */
export function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Create matrix
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate normalized Levenshtein distance (0 = identical, 1 = completely different)
 */
export function normalizedLevenshtein(a: string, b: string): number {
  const distance = levenshtein(a, b);
  const maxLength = Math.max(a.length, b.length);

  if (maxLength === 0) return 0;

  return distance / maxLength;
}

/**
 * Convert a name to a shape key for phonetic similarity detection
 * Collapses vowels to V, consonants to C, and removes repeated patterns
 *
 * Example: "Aeltharion" -> "VCCCVCVC"
 */
export function toShapeKey(name: string): string {
  // Lowercase and remove non-alphabetic characters
  let s = name.toLowerCase().replace(/[^a-z]/g, "");

  // Replace vowels with V
  s = s.replace(/[aeiou]+/g, "V");

  // Replace consonants with C
  s = s.replace(/[^V]+/g, "C");

  // Collapse repeated patterns (optional - can make distance less sensitive)
  // s = s.replace(/(.)\1+/g, "$1");

  return s;
}

/**
 * Calculate shape distance between two names
 * Uses Levenshtein on shape keys
 */
export function shapeDistance(a: string, b: string): number {
  const shapeA = toShapeKey(a);
  const shapeB = toShapeKey(b);

  return normalizedLevenshtein(shapeA, shapeB);
}

/**
 * Calculate distance between all pairs in a list of names
 * Returns a matrix where matrix[i][j] is the distance from names[i] to names[j]
 */
export function pairwiseDistances(
  names: string[],
  distanceFunc: (a: string, b: string) => number = normalizedLevenshtein
): number[][] {
  const n = names.length;
  const matrix: number[][] = Array(n)
    .fill(0)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = distanceFunc(names[i], names[j]);
      matrix[i][j] = dist;
      matrix[j][i] = dist; // Symmetric
    }
  }

  return matrix;
}

/**
 * Find the nearest neighbor for each name in a list
 * Returns array of {name, nearestName, distance}
 */
export function findNearestNeighbors(
  names: string[],
  distanceFunc: (a: string, b: string) => number = normalizedLevenshtein
): Array<{ name: string; nearestName: string; distance: number }> {
  const results: Array<{ name: string; nearestName: string; distance: number }> =
    [];

  for (let i = 0; i < names.length; i++) {
    let minDistance = Infinity;
    let nearestIndex = -1;

    for (let j = 0; j < names.length; j++) {
      if (i === j) continue;

      const dist = distanceFunc(names[i], names[j]);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = j;
      }
    }

    if (nearestIndex !== -1) {
      results.push({
        name: names[i],
        nearestName: names[nearestIndex],
        distance: minDistance,
      });
    }
  }

  return results;
}

/**
 * Calculate percentile statistics from a list of distances
 */
export function calculatePercentiles(
  values: number[]
): {
  min: number;
  p1: number;
  p5: number;
  median: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
} {
  if (values.length === 0) {
    return { min: 0, p1: 0, p5: 0, median: 0, p95: 0, p99: 0, max: 0, mean: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const percentile = (p: number) => {
    const index = Math.ceil((p / 100) * n) - 1;
    return sorted[Math.max(0, Math.min(index, n - 1))];
  };

  const mean = values.reduce((sum, v) => sum + v, 0) / n;

  return {
    min: sorted[0],
    p1: percentile(1),
    p5: percentile(5),
    median: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
    max: sorted[n - 1],
    mean,
  };
}

/**
 * Calculate Euclidean distance between two feature vectors
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Feature vectors must have same length");
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Calculate cosine similarity between two feature vectors
 * Returns value in [0, 1] where 1 = identical direction
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Feature vectors must have same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (normA * normB);
}
