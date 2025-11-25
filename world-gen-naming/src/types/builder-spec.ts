/**
 * Builder Spec Types (Phase 5)
 *
 * Meta-schema for automated lexeme and template generation.
 * These specs describe WHAT to generate, not the generated content itself.
 */

/**
 * Source mode for generation
 */
export type SourceMode = "llm" | "corpus" | "mixed";

/**
 * Part of speech tags
 * Based on Penn Treebank POS tags, simplified for game content
 */
export type PosTag =
  | "noun" // Common noun
  | "noun_proper" // Proper noun
  | "noun_abstract" // Abstract noun
  | "verb" // Base form verb
  | "verb_3sg" // Third person singular present (walks, runs)
  | "verb_past" // Past tense
  | "verb_gerund" // -ing form
  | "adj" // Adjective
  | "adv" // Adverb
  | "prep" // Preposition
  | "ordinal" // First, second, third
  | "any"; // No POS restriction

/**
 * Quality filter configuration
 */
export interface QualityFilter {
  minLength?: number; // Minimum character length
  maxLength?: number; // Maximum character length
  forbiddenSubstrings?: string[]; // Substrings to reject
  bannedWords?: string[]; // Exact words to reject
  allowedPattern?: string; // Regex pattern (entries must match)
  requireCapitalized?: boolean; // Must start with capital
  llmCritic?: boolean; // Use LLM to filter out-of-place entries
}

/**
 * Specification for generating a lexeme list
 *
 * This describes HOW to generate a list, not the list itself.
 */
export interface LexemeSlotSpec {
  id: string; // Unique identifier, e.g., "argo_verbs_3sg"
  cultureId: string; // Culture identifier, e.g., "argonian"
  pos: PosTag; // Part of speech constraint
  style: string; // Natural language style description
  targetCount: number; // How many entries to generate
  sourceMode: SourceMode; // How to generate
  corpusPath?: string; // Path to corpus file (if sourceMode includes "corpus")
  qualityFilter?: QualityFilter; // Automatic quality filters
  examples?: string[]; // Seed examples to guide generation
  description?: string; // Human-readable description
}

/**
 * Slot hint for template generation
 * Maps slot names to their types
 */
export interface SlotHint {
  name: string; // Slot name in template, e.g., "VERB_3SG"
  kind: "phonotactic" | "lexemeList" | "grammar" | "entityName" | "subGenerator";
  description: string; // What this slot represents
  domainId?: string; // For phonotactic slots
  listId?: string; // For lexemeList slots
  grammarId?: string; // For grammar slots
}

/**
 * Specification for generating templates
 *
 * This describes HOW to generate templates, not the templates themselves.
 */
export interface TemplateSpec {
  id: string; // Unique identifier, e.g., "elf_battle"
  cultureId: string; // Culture identifier
  type: string; // Entity type: "person", "battle", "spell", etc.
  style: string; // Natural language style description
  slotHints: SlotHint[]; // Available slots for templates
  targetCount: number; // How many templates to generate
  sourceMode: SourceMode; // How to generate
  corpusPath?: string; // Path to corpus (if sourceMode includes "corpus")
  examples?: string[]; // Example templates to guide generation
  description?: string; // Human-readable description
}

/**
 * Profile specification
 * Combines templates with strategy weights
 */
export interface ProfileSpec {
  id: string; // Profile ID, e.g., "argonian:person"
  cultureId: string; // Culture identifier
  type: string; // Entity type
  description?: string; // Human-readable description
  templateSpecs: string[]; // IDs of TemplateSpecs to use
  strategyWeights?: Record<string, number>; // Weight overrides for specific strategies
}

/**
 * Batch generation spec
 * Allows generating multiple lexeme lists, templates, and profiles at once
 */
export interface BatchSpec {
  name: string; // Batch name, e.g., "argonian_complete"
  description?: string;
  lexemeSpecs: LexemeSlotSpec[];
  templateSpecs: TemplateSpec[];
  profileSpecs: ProfileSpec[];
}

/**
 * LLM provider configuration
 */
export interface LLMConfig {
  provider: "anthropic" | "openai";
  apiKey?: string; // If not provided, reads from env
  model?: string; // Model name (defaults to claude-3-5-sonnet for anthropic)
  maxTokens?: number;
  temperature?: number;
}

/**
 * Generation options
 */
export interface GenerationOptions {
  llmConfig: LLMConfig;
  dryRun?: boolean; // If true, don't actually call LLM
  verbose?: boolean; // If true, log detailed progress
  validateOutputs?: boolean; // Run validation metrics on generated content
  outputDir?: string; // Where to write generated files
}

/**
 * Generation result for a single lexeme list
 */
export interface LexemeGenerationResult {
  spec: LexemeSlotSpec;
  entries: string[];
  filtered: number; // How many entries were filtered out
  source: "llm" | "corpus" | "mixed";
  metadata?: {
    promptUsed?: string;
    tokensUsed?: number;
    durationMs?: number;
  };
}

/**
 * Generation result for a single template
 */
export interface TemplateGenerationResult {
  spec: TemplateSpec;
  templates: Array<{
    id: string;
    template: string;
    slots: Record<string, { kind: string; description: string }>;
  }>;
  filtered: number;
  source: "llm" | "corpus" | "mixed";
  metadata?: {
    promptUsed?: string;
    tokensUsed?: number;
    durationMs?: number;
  };
}

/**
 * Generation result for a batch
 */
export interface BatchGenerationResult {
  batchName: string;
  lexemeResults: LexemeGenerationResult[];
  templateResults: TemplateGenerationResult[];
  errors: Array<{ spec: string; error: string }>;
  totalDurationMs: number;
}
