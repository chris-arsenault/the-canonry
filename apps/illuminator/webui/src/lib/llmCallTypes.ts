/**
 * LLM Call Types - Per-call model and thinking configuration
 *
 * Defines all distinct LLM call types in Illuminator and their default configurations.
 * Settings are stored in localStorage (not per-project) for cross-project consistency.
 */

export type LLMCallType =
  // Entity Description Chain
  | 'description.narrative'      // Step 1: summary/description/aliases
  | 'description.visualThesis'   // Step 2: visual thesis
  | 'description.visualTraits'   // Step 3: visual traits

  // Image Generation
  | 'image.promptFormatting'     // Claude reformats prompt for image model
  | 'image.chronicleFormatting'  // Synthesize chronicle scene/montage prompts for image model

  // Perspective Synthesis
  | 'perspective.synthesis'      // Synthesize world perspective from entity constellation

  // Chronicle Generation
  | 'chronicle.generation'       // Single-shot V2 generation
  | 'chronicle.compare'          // Comparative analysis of multiple drafts (report only)
  | 'chronicle.combine'          // Synthesize multiple drafts into one
  | 'chronicle.summary'          // Summary only
  | 'chronicle.title'            // Two-pass title generation (candidates + synthesis)
  | 'chronicle.imageRefs'        // Image reference extraction
  | 'chronicle.coverImageScene'  // Cover image scene/montage description

  // Palette
  | 'palette.expansion'          // Trait palette curation

  // Dynamics Generation
  | 'dynamics.generation'        // Multi-turn world dynamics synthesis

  // Summary Revision
  | 'revision.summary'           // Batch summary/description revision

  // Chronicle Lore Backport
  | 'revision.loreBackport'      // Extract lore from chronicle and backport to cast entities

  // Description Copy Edit
  | 'description.copyEdit'       // Readability copy edit for a single entity description

  // Historian Review
  | 'historian.entityReview'     // Historian annotations for entity description
  | 'historian.chronicleReview'; // Historian annotations for chronicle narrative

export const ALL_LLM_CALL_TYPES: LLMCallType[] = [
  'description.narrative',
  'description.visualThesis',
  'description.visualTraits',
  'image.promptFormatting',
  'image.chronicleFormatting',
  'perspective.synthesis',
  'chronicle.generation',
  'chronicle.compare',
  'chronicle.combine',
  'chronicle.summary',
  'chronicle.title',
  'chronicle.imageRefs',
  'chronicle.coverImageScene',
  'palette.expansion',
  'dynamics.generation',
  'revision.summary',
  'revision.loreBackport',
  'description.copyEdit',
  'historian.entityReview',
  'historian.chronicleReview',
];

export type LLMCallCategory = 'description' | 'image' | 'perspective' | 'chronicle' | 'palette' | 'dynamics' | 'revision' | 'historian';

export interface LLMCallDefaults {
  model: string;
  thinkingBudget: number;  // 0 = disabled
  maxTokens: number;       // 0 = auto (style-derived)
}

export interface LLMCallMetadata {
  label: string;
  description: string;
  category: LLMCallCategory;
  defaults: LLMCallDefaults;
  recommendedModels: string[];
}

/**
 * Per-call configuration (partial - undefined means use default)
 */
export interface LLMCallConfig {
  model?: string;
  thinkingBudget?: number;  // 0 = disabled
  maxTokens?: number;       // 0 = auto (style-derived)
}

// Available models
export const AVAILABLE_MODELS = [
  { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5', tier: 'premium' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', tier: 'standard' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', tier: 'fast' },
] as const;

// Models that support extended thinking
export const THINKING_CAPABLE_MODELS = [
  'claude-opus-4-5-20251101',
  'claude-sonnet-4-5-20250929',
];

export const THINKING_BUDGET_OPTIONS = [
  { value: 0, label: 'Disabled' },
  { value: 4096, label: '4K tokens (light)' },
  { value: 8192, label: '8K tokens (moderate)' },
  { value: 16384, label: '16K tokens (deep)' },
  { value: 32768, label: '32K tokens (maximum)' },
];

export const MAX_TOKENS_OPTIONS = [
  { value: 256, label: '256' },
  { value: 512, label: '512' },
  { value: 1024, label: '1K' },
  { value: 2048, label: '2K' },
  { value: 4096, label: '4K' },
  { value: 8192, label: '8K' },
  { value: 16384, label: '16K' },
  { value: 32768, label: '32K' },
  { value: 65536, label: '64K' },
];

export const LLM_CALL_METADATA: Record<LLMCallType, LLMCallMetadata> = {
  'description.narrative': {
    label: 'Narrative',
    description: 'Generates summary, description, and aliases for an entity',
    category: 'description',
    defaults: {
      model: 'claude-haiku-4-5-20251001',
      thinkingBudget: 0,
      maxTokens: 1024,
    },
    recommendedModels: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929'],
  },
  'description.visualThesis': {
    label: 'Visual Thesis',
    description: 'Creates the core visual silhouette from narrative description',
    category: 'description',
    defaults: {
      model: 'claude-sonnet-4-5-20250929',
      thinkingBudget: 4096,
      maxTokens: 256,
    },
    recommendedModels: ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101'],
  },
  'description.visualTraits': {
    label: 'Visual Traits',
    description: 'Generates distinctive visual details that complement the thesis',
    category: 'description',
    defaults: {
      model: 'claude-haiku-4-5-20251001',
      thinkingBudget: 0,
      maxTokens: 512,
    },
    recommendedModels: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929'],
  },
  'image.promptFormatting': {
    label: 'Prompt Formatting',
    description: 'Reformats description for the image generation model',
    category: 'image',
    defaults: {
      model: 'claude-haiku-4-5-20251001',
      thinkingBudget: 0,
      maxTokens: 1024,
    },
    recommendedModels: ['claude-haiku-4-5-20251001'],
  },
  'image.chronicleFormatting': {
    label: 'Chronicle Prompt Formatting',
    description: 'Synthesizes chronicle scene/montage prompts for the image generation model',
    category: 'image',
    defaults: {
      model: 'claude-haiku-4-5-20251001',
      thinkingBudget: 0,
      maxTokens: 1024,
    },
    recommendedModels: ['claude-haiku-4-5-20251001'],
  },
  'perspective.synthesis': {
    label: 'Perspective Synthesis',
    description: 'Synthesizes a world perspective brief from entity constellation analysis',
    category: 'perspective',
    defaults: {
      model: 'claude-sonnet-4-5-20250929',
      thinkingBudget: 4096,
      maxTokens: 1024,
    },
    recommendedModels: ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101'],
  },
  'chronicle.generation': {
    label: 'Generation',
    description: 'Creates the initial chronicle narrative content',
    category: 'chronicle',
    defaults: {
      model: 'claude-sonnet-4-5-20250929',
      thinkingBudget: 0,
      maxTokens: 0,
    },
    recommendedModels: ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101'],
  },
  'chronicle.compare': {
    label: 'Compare Versions',
    description: 'Comparative analysis of multiple chronicle drafts (report only)',
    category: 'chronicle',
    defaults: {
      model: 'claude-sonnet-4-5-20250929',
      thinkingBudget: 4096,
      maxTokens: 4096,
    },
    recommendedModels: ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101'],
  },
  'chronicle.combine': {
    label: 'Combine Versions',
    description: 'Synthesizes multiple chronicle drafts into one final version',
    category: 'chronicle',
    defaults: {
      model: 'claude-opus-4-5-20251101',
      thinkingBudget: 4096,
      maxTokens: 8192,
    },
    recommendedModels: ['claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929'],
  },
  'chronicle.summary': {
    label: 'Summary',
    description: 'Generates a concise summary for the chronicle',
    category: 'chronicle',
    defaults: {
      model: 'claude-haiku-4-5-20251001',
      thinkingBudget: 0,
      maxTokens: 512,
    },
    recommendedModels: ['claude-haiku-4-5-20251001'],
  },
  'chronicle.title': {
    label: 'Title',
    description: 'Two-pass title generation: candidates then synthesis',
    category: 'chronicle',
    defaults: {
      model: 'claude-haiku-4-5-20251001',
      thinkingBudget: 0,
      maxTokens: 256,
    },
    recommendedModels: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929'],
  },
  'chronicle.imageRefs': {
    label: 'Image References',
    description: 'Extracts image-worthy moments from the narrative',
    category: 'chronicle',
    defaults: {
      model: 'claude-haiku-4-5-20251001',
      thinkingBudget: 0,
      maxTokens: 2048,
    },
    recommendedModels: ['claude-haiku-4-5-20251001'],
  },
  'chronicle.coverImageScene': {
    label: 'Cover Image Scene',
    description: 'Generates a montage-style scene description for the chronicle cover image',
    category: 'chronicle',
    defaults: {
      model: 'claude-haiku-4-5-20251001',
      thinkingBudget: 0,
      maxTokens: 512,
    },
    recommendedModels: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929'],
  },
  'palette.expansion': {
    label: 'Palette Expansion',
    description: 'Curates visual trait categories with extended reasoning',
    category: 'palette',
    defaults: {
      model: 'claude-sonnet-4-5-20250929',
      thinkingBudget: 8192,
      maxTokens: 4096,
    },
    recommendedModels: ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101'],
  },
  'dynamics.generation': {
    label: 'Dynamics Generation',
    description: 'Multi-turn world dynamics synthesis from lore and entity data',
    category: 'dynamics',
    defaults: {
      model: 'claude-sonnet-4-5-20250929',
      thinkingBudget: 4096,
      maxTokens: 4096,
    },
    recommendedModels: ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101'],
  },
  'revision.summary': {
    label: 'Summary Revision',
    description: 'Batch revision of entity summaries/descriptions using world dynamics',
    category: 'revision',
    defaults: {
      model: 'claude-opus-4-5-20251101',
      thinkingBudget: 4096,
      maxTokens: 8192,
    },
    recommendedModels: ['claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929'],
  },
  'revision.loreBackport': {
    label: 'Lore Backport',
    description: 'Extracts lore from published chronicles and backports to entity summaries/descriptions',
    category: 'revision',
    defaults: {
      model: 'claude-sonnet-4-5-20250929',
      thinkingBudget: 4096,
      maxTokens: 8192,
    },
    recommendedModels: ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101'],
  },
  'description.copyEdit': {
    label: 'Copy Edit',
    description: 'Readability copy edit for a single entity description — fixes pronoun ambiguity, unexplained references, dense prose',
    category: 'description',
    defaults: {
      model: 'claude-sonnet-4-5-20250929',
      thinkingBudget: 4096,
      maxTokens: 4096,
    },
    recommendedModels: ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101'],
  },
  'historian.entityReview': {
    label: 'Entity Review',
    description: 'Historian annotations for an entity description — scholarly commentary, factual corrections, tongue-in-cheek observations',
    category: 'historian',
    defaults: {
      model: 'claude-sonnet-4-5-20250929',
      thinkingBudget: 4096,
      maxTokens: 4096,
    },
    recommendedModels: ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101'],
  },
  'historian.chronicleReview': {
    label: 'Chronicle Review',
    description: 'Historian annotations for a chronicle narrative — scholarly footnotes, disputed accounts, color commentary',
    category: 'historian',
    defaults: {
      model: 'claude-sonnet-4-5-20250929',
      thinkingBudget: 4096,
      maxTokens: 8192,
    },
    recommendedModels: ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101'],
  },
};

export const CATEGORY_LABELS: Record<LLMCallCategory, string> = {
  description: 'Entity Descriptions',
  image: 'Image Generation',
  perspective: 'Perspective Synthesis',
  chronicle: 'Chronicle Generation',
  palette: 'Trait Palette',
  dynamics: 'Dynamics Generation',
  revision: 'Summary Revision',
  historian: 'Historian Review',
};

export const CATEGORY_DESCRIPTIONS: Record<LLMCallCategory, string> = {
  description: 'Three-step chain for generating entity narrative and visual details',
  image: 'Preprocessing for image generation prompts',
  perspective: 'Synthesize world perspective from entity constellation for chronicles',
  chronicle: 'Multi-step pipeline for long-form narrative documents',
  palette: 'AI-assisted curation of visual trait categories',
  dynamics: 'Multi-turn synthesis of world dynamics from lore and entity data',
  revision: 'Batch revision of entity summaries and descriptions using world dynamics',
  historian: 'Scholarly annotations with personality — commentary, corrections, and tongue-in-cheek observations',
};

// Group call types by category
export function getCallTypesByCategory(): Record<LLMCallCategory, LLMCallType[]> {
  return {
    description: ['description.narrative', 'description.visualThesis', 'description.visualTraits', 'description.copyEdit'],
    image: ['image.promptFormatting', 'image.chronicleFormatting'],
    perspective: ['perspective.synthesis'],
    chronicle: ['chronicle.generation', 'chronicle.compare', 'chronicle.combine', 'chronicle.summary', 'chronicle.title', 'chronicle.imageRefs', 'chronicle.coverImageScene'],
    palette: ['palette.expansion'],
    dynamics: ['dynamics.generation'],
    revision: ['revision.summary', 'revision.loreBackport'],
    historian: ['historian.entityReview', 'historian.chronicleReview'],
  };
}
