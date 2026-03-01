/**
 * Semantic Classifier
 *
 * Classifies plane specifications into categories using:
 * 1. Keyword pattern matching
 * 2. Fuzzy string matching
 * 3. Word embedding similarity (when available)
 */

import type {
  PlaneSpecification,
  CategoryId,
  DomainClass,
  SemanticAnalysisResult,
  CategoryDefinition
} from '../types/index.js';

import {
  getCategoriesForDomain,
  getCategory,
} from '../ontology/index.js';

import { getEmbeddingSimilarity, hasEmbeddings } from '../embeddings/loader.js';

/**
 * Configuration for classification.
 */
export interface ClassifierConfig {
  /** Weight for keyword matching (0-1) */
  keywordWeight: number;

  /** Weight for fuzzy matching (0-1) */
  fuzzyWeight: number;

  /** Weight for embedding similarity (0-1) */
  embeddingWeight: number;

  /** Minimum score to consider a match */
  minConfidence: number;

  /** Domain class to restrict category search */
  domainClass: DomainClass;
}

const DEFAULT_CONFIG: ClassifierConfig = {
  keywordWeight: 0.5,
  fuzzyWeight: 0.2,
  embeddingWeight: 0.3,
  minConfidence: 0.1,
  domainClass: 'hybrid'
};

/**
 * Normalize a string for matching.
 */
function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * Tokenize a string into words.
 */
function tokenize(s: string): string[] {
  return normalize(s).split(/\s+/).filter(w => w.length > 0);
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate fuzzy similarity between two strings (0-1).
 */
function fuzzySimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(normalize(a), normalize(b));
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - (distance / maxLen);
}

/**
 * Score a plane against a single category using keyword matching.
 */
function keywordScore(
  plane: PlaneSpecification,
  category: CategoryDefinition
): number {
  const planeTokens = new Set([
    ...tokenize(plane.id),
    ...tokenize(plane.label),
    ...(plane.description ? tokenize(plane.description) : [])
  ]);

  const allKeywords = [...category.keywords, ...(category.synonyms ?? [])];

  let matches = 0;
  let totalWeight = 0;

  for (const keyword of allKeywords) {
    const keywordTokens = tokenize(keyword);
    const weight = 1 / Math.sqrt(keywordTokens.length); // Longer keywords = less weight per match

    for (const kt of keywordTokens) {
      totalWeight += weight;
      if (planeTokens.has(kt)) {
        matches += weight;
      }
    }
  }

  // Also check if plane tokens appear in keywords
  for (const pt of planeTokens) {
    for (const keyword of allKeywords) {
      if (normalize(keyword).includes(pt) && pt.length >= 3) {
        matches += 0.5;
        totalWeight += 0.5;
      }
    }
  }

  return totalWeight > 0 ? matches / totalWeight : 0;
}

/**
 * Score a plane against a category using fuzzy matching.
 */
function fuzzyScore(
  plane: PlaneSpecification,
  category: CategoryDefinition
): number {
  const planeTerms = [plane.id, plane.label];
  if (plane.description) {
    planeTerms.push(...plane.description.split(/\s+/).filter(w => w.length > 4));
  }

  const allKeywords = [...category.keywords, ...(category.synonyms ?? [])];

  let bestScore = 0;

  for (const term of planeTerms) {
    for (const keyword of allKeywords) {
      const sim = fuzzySimilarity(term, keyword);
      if (sim > bestScore) {
        bestScore = sim;
      }
    }
  }

  return bestScore;
}

/**
 * Score a plane against a category using word embeddings.
 */
function embeddingScore(
  plane: PlaneSpecification,
  category: CategoryDefinition
): number {
  if (!hasEmbeddings()) {
    return 0;
  }

  const planeTerms = [plane.id, plane.label];
  const categoryTerms = category.keywords.slice(0, 5); // Use top 5 keywords

  let totalSim = 0;
  let count = 0;

  for (const pt of planeTerms) {
    for (const ct of categoryTerms) {
      const sim = getEmbeddingSimilarity(pt, ct);
      if (sim !== null) {
        totalSim += sim;
        count++;
      }
    }
  }

  return count > 0 ? totalSim / count : 0;
}

/**
 * Classify a plane specification into a category.
 */
export function classifyPlane(
  plane: PlaneSpecification,
  config: Partial<ClassifierConfig> = {}
): SemanticAnalysisResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // If plane has explicit category hint, use it
  if (plane.hints?.category) {
    const hintedCategory = getCategory(plane.hints.category);
    if (hintedCategory) {
      return {
        planeId: plane.id,
        scores: new Map([[plane.hints.category, 1.0]]),
        bestMatch: plane.hints.category,
        confidence: 1.0
      };
    }
  }

  const categories = getCategoriesForDomain(cfg.domainClass);
  const scores = new Map<CategoryId, number>();

  for (const category of categories) {
    const kw = keywordScore(plane, category) * cfg.keywordWeight;
    const fz = fuzzyScore(plane, category) * cfg.fuzzyWeight;
    const em = cfg.embeddingWeight > 0
      ? embeddingScore(plane, category) * cfg.embeddingWeight
      : 0;

    const totalScore = kw + fz + em;
    if (totalScore >= cfg.minConfidence) {
      scores.set(category.id, totalScore);
    }
  }

  // Find best match
  let bestMatch: CategoryId = 'surface'; // Default fallback
  let bestScore = 0;

  for (const [categoryId, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestMatch = categoryId;
    }
  }

  // Normalize confidence (max possible is sum of weights)
  const maxPossible = cfg.keywordWeight + cfg.fuzzyWeight + cfg.embeddingWeight;
  const confidence = bestScore / maxPossible;

  return {
    planeId: plane.id,
    scores,
    bestMatch,
    confidence
  };
}

/**
 * Classify multiple planes.
 */
export function classifyPlanes(
  planes: PlaneSpecification[],
  config: Partial<ClassifierConfig> = {}
): Map<string, SemanticAnalysisResult> {
  const results = new Map<string, SemanticAnalysisResult>();

  for (const plane of planes) {
    const result = classifyPlane(plane, config);
    results.set(plane.id, result);
  }

  return results;
}

/**
 * Get all keywords that matched for a plane.
 */
export function getMatchedKeywords(
  plane: PlaneSpecification,
  categoryId: CategoryId
): string[] {
  const category = getCategory(categoryId);
  if (!category) return [];

  const planeTokens = new Set([
    ...tokenize(plane.id),
    ...tokenize(plane.label),
    ...(plane.description ? tokenize(plane.description) : [])
  ]);

  const allKeywords = [...category.keywords, ...(category.synonyms ?? [])];
  const matched: string[] = [];

  for (const keyword of allKeywords) {
    const keywordTokens = tokenize(keyword);
    if (keywordTokens.some(kt => planeTokens.has(kt))) {
      matched.push(keyword);
    }
  }

  return matched;
}
