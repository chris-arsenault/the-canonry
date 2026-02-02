/**
 * Name Forge Project Types
 *
 * Canonical types for name-forge projects, matching the UI data model.
 * These types are used by:
 * - The web UI for editing/storing projects
 * - The lib for name generation
 * - External consumers (lore-weave) for integration
 */

import { z } from "zod";
import type { NamingDomain } from "./domain.js";
import type { Capitalization } from "../utils/helpers.js";
import type { EntityKindDefinition } from "@canonry/world-schema";

// ============================================================================
// Lexeme Types
// ============================================================================

/**
 * Word style specification for structural lexeme generation
 *
 * Enables generation of lexemes with specific etymological and phonetic
 * characteristics, such as "hard words" (short, concrete, Anglo-Saxon roots).
 */
export interface WordStyleSpec {
  /** Etymology/register: Germanic roots vs Latinate derivatives */
  etymology?: "germanic" | "latinate" | "mixed";

  /** Syllable constraints */
  syllables?: {
    min?: number; // default 1
    max?: number; // default 4
  };

  /** Phonetic character */
  phonetics?: {
    /** Consonant heaviness: 'hard' (plosives k,t,p,d,g,b) | 'soft' (fricatives) | 'mixed' */
    consonants?: "hard" | "soft" | "mixed";
    /** Vowel openness: 'open' (a, o) | 'close' (i, u) | 'mixed' */
    vowels?: "open" | "close" | "mixed";
  };

  /** Prefer words that work as both noun and verb (e.g., "hunt", "storm") */
  dualUse?: boolean;

  /** Semantic register */
  register?: "visceral" | "abstract" | "technical" | "poetic" | "neutral";
}

export const WordStyleSpecSchema = z.object({
  etymology: z.enum(["germanic", "latinate", "mixed"]).optional(),
  syllables: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
  phonetics: z
    .object({
      consonants: z.enum(["hard", "soft", "mixed"]).optional(),
      vowels: z.enum(["open", "close", "mixed"]).optional(),
    })
    .optional(),
  dualUse: z.boolean().optional(),
  register: z
    .enum(["visceral", "abstract", "technical", "poetic", "neutral"])
    .optional(),
});

/**
 * Lexeme list - a collection of words for use in grammars
 */
export interface LexemeList {
  id: string;
  description?: string;
  entries: string[];
  source?: string;
}

export const LexemeListSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  entries: z.array(z.string()),
  source: z.string().optional(),
});

// ============================================================================
// Grammar Types
// ============================================================================

/**
 * Grammar rule - a context-free grammar for name generation
 *
 * Format:
 * - start: starting symbol (e.g., "name")
 * - rules: maps symbols to productions (each production is an array of tokens)
 *
 * Token types:
 * - "slot:listId" - pick from lexeme list
 * - "domain:domainId" - generate phonotactic name
 * - "markov:modelId" - generate from Markov chain
 * - "context:key" - use context value (passed at generation time)
 * - "symbol" - expand another rule
 * - "literal" - use as-is
 * - "^suffix" - append suffix (e.g., "domain:tech^'s")
 */
export interface Grammar {
  id: string;
  description?: string;
  start: string;
  rules: Record<string, string[][]>;
  /** Capitalization style to apply to final output */
  capitalization?: Capitalization;
}

export const CapitalizationSchema = z.enum([
  "title",
  "titleWords",
  "allcaps",
  "lowercase",
  "mixed",
]);

export const GrammarSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  start: z.string(),
  rules: z.record(z.array(z.array(z.string()))),
  capitalization: CapitalizationSchema.optional(),
});

// ============================================================================
// Strategy Types
// ============================================================================

/**
 * Naming strategy - how to generate a single name
 */
export interface Strategy {
  /** Strategy type */
  type: "grammar" | "phonotactic";
  /** Relative weight for random selection */
  weight: number;
  /** Grammar ID (for grammar type) */
  grammarId?: string;
  /** Domain ID (for phonotactic type) */
  domainId?: string;
}

export const StrategySchema = z.object({
  type: z.enum(["grammar", "phonotactic"]),
  weight: z.number().min(0),
  grammarId: z.string().optional(),
  domainId: z.string().optional(),
});

/**
 * Conditions for strategy group activation
 */
export interface GroupConditions {
  /** Entity kinds that activate this group */
  entityKinds?: string[];
  /** Subtypes that activate this group */
  subtypes?: string[];
  /** If true, ALL subtypes must match (default: ANY) */
  subtypeMatchAll?: boolean;
  /** Prominence levels that activate this group */
  prominence?: string[];
  /** Tags that activate this group */
  tags?: string[];
  /** If true, ALL tags must match (default: ANY) */
  tagMatchAll?: boolean;
}

export const GroupConditionsSchema = z.object({
  entityKinds: z.array(z.string()).optional(),
  subtypes: z.array(z.string()).optional(),
  subtypeMatchAll: z.boolean().optional(),
  prominence: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  tagMatchAll: z.boolean().optional(),
});

/**
 * Strategy group - a set of strategies with shared activation conditions
 *
 * Selection algorithm:
 * 1. Find all groups whose conditions match the generation context
 * 2. Select the group with highest priority (lowest number)
 * 3. Use weighted random selection among that group's strategies
 */
export interface StrategyGroup {
  /** Display name */
  name?: string;
  /** Priority (lower = higher priority, checked first) */
  priority: number;
  /** Activation conditions (null = always active) */
  conditions: GroupConditions | null;
  /** Available strategies */
  strategies: Strategy[];
}

export const StrategyGroupSchema = z.object({
  name: z.string().optional(),
  priority: z.number(),
  conditions: GroupConditionsSchema.nullable(),
  strategies: z.array(StrategySchema),
});

// ============================================================================
// Profile Types
// ============================================================================

/**
 * Naming profile - defines how to generate names for a culture
 *
 * Profile selection order:
 * 1. First profile with matching entityKind (concrete match)
 * 2. Fall back to profile marked isDefault: true
 * 3. Error if no match and no default
 */
export interface Profile {
  id: string;
  name?: string;
  /** Entity kinds this profile applies to (empty = use isDefault logic) */
  entityKinds?: string[];
  /** Mark as default fallback profile */
  isDefault?: boolean;
  strategyGroups: StrategyGroup[];
}

export const ProfileSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  entityKinds: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
  strategyGroups: z.array(StrategyGroupSchema),
});

// ============================================================================
// Culture Types
// ============================================================================

/**
 * Culture - owns all naming resources for a cultural group
 */
export interface Culture {
  id: string;
  name: string;
  description?: string;
  /** Phonotactic domains */
  domains: NamingDomain[];
  /** Lexeme lists keyed by ID */
  lexemeLists: Record<string, LexemeList>;
  /** Lexeme specs for LLM generation (UI feature) */
  lexemeSpecs?: Record<string, unknown>;
  /** Grammar rules */
  grammars: Grammar[];
  /** Naming profiles */
  profiles: Profile[];
}

// ============================================================================
// World Schema Types
// ============================================================================

/**
 * World schema - defines the entity types in the world
 */
export interface WorldSchema {
  entityKinds: EntityKindDefinition[];
}

// ============================================================================
// Project Types
// ============================================================================

/**
 * Name Forge project - complete project data
 */
export interface Project {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  worldSchema: WorldSchema;
  cultures: Record<string, Culture>;
}

// ============================================================================
// Generation Types
// ============================================================================

/**
 * Generation request - input for name generation
 */
export interface GenerateRequest {
  /** Culture to use */
  cultureId: string;
  /** Profile ID (optional, uses first profile if not specified) */
  profileId?: string;
  /** Entity kind for condition matching */
  kind?: string;
  /** Entity subtype for condition matching */
  subtype?: string;
  /** Prominence level for condition matching */
  prominence?: string;
  /** Tags for condition matching */
  tags?: string[];
  /** Context values for context: slots */
  context?: Record<string, string>;
  /** Number of names to generate */
  count?: number;
  /** Random seed for reproducibility */
  seed?: string;
}

/**
 * Debug info for why a strategy group matched or didn't match
 */
export interface GroupMatchDebug {
  groupName: string;
  matched: boolean;
  reason?: string;
  priority?: number;
}

/**
 * Debug info for a single generated name
 */
export interface NameDebugInfo {
  /** Which strategy group was used */
  groupUsed: string;
  /** Which strategy within the group was selected */
  strategyUsed: string;
  /** What type of strategy (grammar, phonotactic, fallback) */
  strategyType: string;
  /** For grammar strategies, which grammar ID */
  grammarId?: string;
  /** For phonotactic strategies, which domain ID */
  domainId?: string;
  /** Debug info for all groups showing match status */
  groupMatching: GroupMatchDebug[];
}

/**
 * Generation result - output from name generation
 */
export interface GenerateResult {
  names: string[];
  strategyUsage: Record<string, number>;
  /** Debug info for each name (same length as names array) */
  debugInfo?: NameDebugInfo[];
}
