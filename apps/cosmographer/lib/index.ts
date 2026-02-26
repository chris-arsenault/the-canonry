/**
 * Cosmographer - Semantic Plane Hierarchy Generator
 *
 * A standalone utility for generating plane hierarchies based on
 * semantic analysis of plane specifications. Uses an extensible
 * ontology system and word embeddings for classification.
 *
 * @example
 * ```typescript
 * import { generateManifold, parseInput } from 'cosmographer';
 *
 * const input = parseInput('./my-domain.yaml');
 * const output = await generateManifold(input);
 *
 * // Write to file for lore-weave consumption
 * writeFileSync('./manifold.json', JSON.stringify(output, null, 2));
 * ```
 */

import type {
  CosmographerInput,
  CosmographerOutput,
  PlaneClassification,
} from './types/index.js';

import { classifyPlanes, getMatchedKeywords } from './analysis/index.js';
import {
  generateHierarchy,
  generateDistances,
  generateAxisWeights
} from './generator/index.js';
import { registerCustomCategory } from './ontology/index.js';

// Re-export types
export type {
  // Input types
  CosmographerInput,
  PlaneSpecification,
  PlaneHints,
  DistanceHint,
  CustomCategoryDefinition,
  GenerationOptions,

  // Output types
  CosmographerOutput,
  GeneratedPlaneHierarchy,
  GeneratedAxisWeights,
  PlaneClassification,

  // Internal types
  CategoryDefinition,
  CategoryId,
  DomainClass,
  SemanticAnalysisResult
} from './types/index.js';

// Re-export ontology utilities
export {
  getCategory,
  getCategoriesForDomain,
  getAllCategoryIds,
  registerCustomCategory,
  PHYSICAL_CATEGORIES,
  METAPHYSICAL_CATEGORIES,
  LEGAL_CATEGORIES,
  MAGICAL_CATEGORIES,
  SOCIAL_CATEGORIES
} from './ontology/index.js';

// Re-export analysis utilities
export {
  classifyPlane,
  classifyPlanes,
  getMatchedKeywords
} from './analysis/index.js';

// Re-export generator utilities
export {
  generateHierarchy,
  generateDistances,
  generateAxisWeights
} from './generator/index.js';

// Re-export embedding utilities
export {
  hasEmbeddings,
  getEmbedding,
  getEmbeddingSimilarity,
  findMostSimilar,
  getVocabularyStats
} from './embeddings/loader.js';

/**
 * Generator version for output metadata.
 */
export const VERSION = '0.1.0';

/**
 * Generate a complete manifold configuration from input.
 *
 * This is the main entry point for the library.
 *
 * @param input - Domain specification with planes and hints
 * @returns Complete manifold configuration for lore-weave
 */
export function generateManifold(
  input: CosmographerInput
): CosmographerOutput {
  const options = input.options ?? {};

  // Register any custom categories
  if (input.customCategories) {
    for (const custom of input.customCategories) {
      registerCustomCategory({
        ...custom,
        domainClass: input.spaceType === 'hybrid' ? 'conceptual' : input.spaceType
      });
    }
  }

  // Classify all planes
  const classifications = classifyPlanes(input.planes, {
    domainClass: input.spaceType,
    keywordWeight: options.weights?.semantic ?? 0.5,
    embeddingWeight: options.weights?.embedding ?? 0.3,
    fuzzyWeight: 1 - (options.weights?.semantic ?? 0.5) - (options.weights?.embedding ?? 0.3)
  });

  // Generate hierarchy
  const planeHierarchy = generateHierarchy(input, classifications);

  // Generate distances
  const crossPlaneDistances = generateDistances(input, classifications);

  // Generate axis weights
  const defaultAxisWeights = generateAxisWeights(input);

  // Build classification metadata if requested
  let classificationMetadata: Record<string, PlaneClassification> | undefined;

  if (options.includeMetadata !== false) {
    classificationMetadata = {};

    for (const [planeId, result] of classifications) {
      const matchedPatterns = getMatchedKeywords(
        input.planes.find(p => p.id === planeId)!,
        result.bestMatch
      );

      classificationMetadata[planeId] = {
        category: result.bestMatch,
        confidence: result.confidence,
        matchedPatterns,
        candidates: Array.from(result.scores.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([category, score]) => ({ category, score }))
      };
    }
  }

  return {
    domainId: input.domainId,
    generatedAt: new Date().toISOString(),
    generator: `cosmographer@${VERSION}`,
    planeHierarchy,
    defaultAxisWeights,
    crossPlaneDistances,
    saturationStrategy: options.saturationStrategy ?? 'density',
    densityThreshold: options.densityThreshold ?? 0.7,
    classifications: classificationMetadata
  };
}

/**
 * Analyze a single term and return its likely categories.
 *
 * Useful for exploring the ontology interactively.
 *
 * @param term - Term to analyze (e.g., "underwater cavern")
 * @param domainClass - Domain class to search within
 * @returns Array of category matches with confidence scores
 */
export function analyzeTerm(
  term: string,
  domainClass: import('./types/index.js').DomainClass = 'hybrid'
): Array<{ category: string; confidence: number }> {
  const fakeSpec = {
    id: term.toLowerCase().replace(/\s+/g, '_'),
    label: term,
    description: term
  };

  const result = classifyPlanes([fakeSpec], { domainClass });
  const classification = result.get(fakeSpec.id);

  if (!classification) {
    return [];
  }

  return Array.from(classification.scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, score]) => ({
      category,
      confidence: score
    }));
}
