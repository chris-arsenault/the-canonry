/**
 * Name Forge - Domain-aware procedural name generation
 *
 * Main library exports for programmatic use.
 */

// ============================================================================
// Core Generation API
// ============================================================================

export {
  generate,
  generateOne,
  generateFromDomain,
  testDomain,
  previewGrammar,
  type TestDomainResult,
  type PreviewGrammarOptions,
} from "./generate.js";

// ============================================================================
// Project Types (canonical schema matching UI)
// ============================================================================

export type {
  // Core types
  Culture,
  Grammar,
  Profile,
  Strategy,
  StrategyGroup,
  GroupConditions,
  LexemeList,
  // Project structure
  Project,
  WorldSchema,
  // Generation
  GenerateRequest,
  GenerateResult,
  // Markov (re-export from generate for backwards compat)
} from "./types/project.js";

// Re-export EntityKindDefinition from world-schema
export type { EntityKindDefinition } from "@canonry/world-schema";

export {
  // Zod schemas for validation
  LexemeListSchema,
  GrammarSchema,
  CapitalizationSchema,
  StrategySchema,
  StrategyGroupSchema,
  GroupConditionsSchema,
  ProfileSchema,
} from "./types/project.js";

// ============================================================================
// Domain Types (phonotactic configuration)
// ============================================================================

export type {
  NamingDomain,
  PhonologyProfile,
  MorphologyProfile,
  StyleRules,
  AppliesTo,
  Prominence,
} from "./types/domain.js";

// ============================================================================
// Low-level APIs (for advanced use / optimizer)
// ============================================================================

// Phonotactic generation
export { generatePhonotacticName, executePhonotacticPipeline } from "./phonotactic-pipeline.js";
export { generateWord, generateWords, generateWordWithDebug } from "./phonology.js";
export { applyMorphology } from "./morphology.js";
export { applyStyle } from "./style.js";

// Markov generation
export {
  generateFromMarkov,
  generateNamesFromMarkov,
  MARKOV_MODELS,
  type MarkovModelId,
  type MarkovModel,
} from "./markov.js";

// Markov model loading (for browser base URL configuration)
export { setMarkovBaseUrl } from "./markov-loader.js";

// Utilities
export { createRNG, pickRandom, pickWeighted } from "./utils/rng.js";
export {
  type Capitalization,
  applyCapitalization,
  capitalize,
  capitalizeWords,
  mixedCase,
} from "./utils/helpers.js";

// Morphological derivations (for grammar ~er, ~est, ~ing, ~ed, ~poss modifiers)
export {
  agentive,
  superlative,
  comparative,
  gerund,
  past,
  possessive,
  applyDerivation,
  isDerivationType,
  DERIVATION_TYPES,
  type DerivationType,
} from "./derivation.js";

// Validation schemas
export {
  NamingDomainSchema,
  PhonologyProfileSchema,
  MorphologyProfileSchema,
  StyleRulesSchema,
  DomainCollectionSchema,
} from "./types/schema.js";

// ============================================================================
// Validation (import from 'name-forge/validation' for tree-shaking)
// ============================================================================

export {
  // Metrics
  validateCapacity,
  validateDiffuseness,
  validateSeparation,
  calculateEntropy,
  estimateRequiredSamples,
  theoreticalCapacity,
  findSimilarClusters,
  analyzeDiversity,
  // Analysis
  extractFeatures,
  levenshtein,
  normalizedLevenshtein,
  euclideanDistance,
  cosineSimilarity,
  NearestCentroidClassifier,
  crossValidate,
  // Types
  type ValidationConfig,
  type CapacityReport,
  type DiffusenessReport,
  type SeparationReport,
} from "./validation/index.js";

// ============================================================================
// Optimizer (import from 'name-forge/optimizer' for tree-shaking)
// ============================================================================

export {
  // High-level API
  optimizeDomain,
  // Algorithms
  hillclimb,
  simulatedAnnealing,
  geneticAlgorithm,
  bayesianOptimization,
  analyzePhonemeImportance,
  // Fitness
  computeFitness,
  computeFitnessLight,
  // Parameter encoding
  encodeParameters,
  decodeParameters,
  perturbParameters,
  parameterDistance,
  // Mutations
  MUTATIONS,
  MUTATION_WEIGHTS,
  applyRandomMutation,
  applyMultipleMutations,
  applyWeightedMutation,
  // Settings and types
  ValidationSettingsSchema,
  FitnessWeightsSchema,
  OptimizationSettingsSchema,
  DEFAULT_BOUNDS,
  type ValidationSettings,
  type FitnessWeights,
  type OptimizationAlgorithm,
  type OptimizationSettings,
  type ParameterVector,
  type EvaluationResult,
  type OptimizationResult,
  type ParameterBounds,
  type MutationType,
} from "./optimizer/index.js";
