/**
 * Naming Types
 *
 * Types for name generation configuration (Name Forge).
 * These define how names are generated for entities in a culture.
 */

/**
 * Phonology profile controls sound inventory and allowed sequences
 */
export interface PhonologyProfile {
  consonants: string[];
  vowels: string[];
  syllableTemplates: string[];
  lengthRange: [number, number];
  forbiddenClusters?: string[];
  favoredClusters?: string[];
  favoredClusterBoost?: number;
  consonantWeights?: number[];
  vowelWeights?: number[];
  templateWeights?: number[];
  maxConsonantCluster?: number;
  minVowelSpacing?: number;
  sonorityRanks?: Record<string, number>;
}

/**
 * Morphology profile controls prefixes, suffixes, and word structure
 */
export interface MorphologyProfile {
  prefixes?: string[];
  suffixes?: string[];
  infixes?: string[];
  wordRoots?: string[];
  honorifics?: string[];
  structure: string[];
  prefixWeights?: number[];
  suffixWeights?: number[];
  structureWeights?: number[];
}

/**
 * Capitalization style
 */
export type Capitalization = 'title' | 'titleWords' | 'allcaps' | 'lowercase' | 'mixed';

/**
 * Rhythm bias for phonetic style
 */
export type RhythmBias = 'soft' | 'harsh' | 'staccato' | 'flowing' | 'neutral';

/**
 * Style rules control fine-grained stylistic transforms
 */
export interface StyleRules {
  apostropheRate?: number;
  hyphenRate?: number;
  capitalization?: Capitalization;
  preferredEndings?: string[];
  preferredEndingBoost?: number;
  rhythmBias?: RhythmBias;
  targetLength?: number;
  lengthTolerance?: number;
}

/**
 * A naming domain defines phonotactic rules for generating names
 */
export interface NamingDomain {
  id: string;
  phonology: PhonologyProfile;
  morphology: MorphologyProfile;
  style: StyleRules;
}

/**
 * A lexeme list is a collection of words for use in grammars
 */
export interface LexemeList {
  id: string;
  description?: string;
  entries: string[];
  source?: string;
}

/**
 * Lexeme generation spec used for LLM-based lexeme creation.
 */
export interface LexemeSpec {
  id: string;
  [key: string]: unknown;
}

/**
 * Grammar rules for name generation
 */
export interface Grammar {
  id: string;
  description?: string;
  start: string;
  rules: Record<string, string[][]>;
  capitalization?: Capitalization;
}

/**
 * A naming strategy defines how to generate a single name
 */
export interface NamingStrategy {
  type: 'grammar' | 'phonotactic';
  weight: number;
  grammarId?: string;
  domainId?: string;
}

/**
 * Conditions for strategy group activation
 */
export interface StrategyGroupConditions {
  entityKinds?: string[];
  subtypes?: string[];
  subtypeMatchAll?: boolean;
  prominence?: string[];
  tags?: string[];
  tagMatchAll?: boolean;
}

/**
 * A strategy group is a set of strategies with shared activation conditions
 */
export interface StrategyGroup {
  name?: string;
  priority: number;
  conditions: StrategyGroupConditions | null;
  strategies: NamingStrategy[];
}

/**
 * A naming profile defines how to generate names for a culture
 */
export interface NamingProfile {
  id: string;
  name?: string;
  strategyGroups: StrategyGroup[];
}

/**
 * Complete naming configuration for a culture
 */
export interface CultureNamingData {
  domains: NamingDomain[];
  lexemeLists: Record<string, LexemeList>;
  lexemeSpecs?: LexemeSpec[];
  grammars: Grammar[];
  profiles: NamingProfile[];
}
