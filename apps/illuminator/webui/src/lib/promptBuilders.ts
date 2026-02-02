/**
 * Prompt Templates System - Redesigned
 *
 * Simplified approach:
 * - WorldContext: Just essentials (name, description, canon facts, tone)
 * - EntityContext: Built dynamically from actual graph data (relationships, peers, era)
 * - Prompts that USE this data effectively
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Style information for image generation
 */
export interface StyleInfo {
  /** Artistic style prompt fragment (e.g., "oil painting style, rich textures...") */
  artisticPromptFragment?: string;
  /** Composition style prompt fragment (e.g., "portrait composition, head and shoulders...") */
  compositionPromptFragment?: string;
  /** Color palette prompt fragment (e.g., "warm earth tones: terracotta, amber, ochre...") */
  colorPalettePromptFragment?: string;
  /** Additional culture-specific style keywords */
  cultureKeywords?: string[];
  /**
   * Visual identity entries from culture, filtered by entity kind's visualIdentityKeys.
   * e.g., { "ATTIRE": "fur parkas with bone jewelry", "SPECIES": "emperor penguins" }
   */
  visualIdentity?: Record<string, string>;
}

/**
 * Descriptive information for text generation
 */
export interface DescriptiveInfo {
  /**
   * Descriptive identity entries from culture, filtered by entity kind's descriptiveIdentityKeys.
   * e.g., { "VALUES": "harmony, patience", "SPEECH": "formal, archaic dialect" }
   */
  descriptiveIdentity?: Record<string, string>;
  /**
   * Visual identity entries from culture, filtered by entity kind's visualIdentityKeys.
   * e.g., { "SPECIES": "penguins with aurora-bright eyes", "ARCHITECTURE": "crystal spires" }
   * Used to inform visual thesis and traits generation.
   */
  visualIdentity?: Record<string, string>;
}

/**
 * Tone fragments - composable tone guidance
 */
export interface ToneFragments {
  core: string;
  cultureOverlays?: Record<string, string>;
  kindOverlays?: Record<string, string>;
}

/**
 * Canon fact with metadata
 */
export interface CanonFactWithMetadata {
  id: string;
  text: string;
  type?: 'world_truth' | 'generation_constraint';
  basePriority: number;
  cultureTags?: string[];
  themeTags?: string[];
}

/**
 * World-level context - structured for perspective synthesis
 */
export interface WorldContext {
  name: string;                              // World name
  description: string;                       // Genre/setting brief (1-2 sentences)
  toneFragments: ToneFragments;              // Composable tone guidance
  canonFactsWithMetadata: CanonFactWithMetadata[];  // Facts with relevance metadata
  speciesConstraint?: string;                // Species rule for image generation
}

/**
 * Get flat tone string from structured context
 */
export function getTone(ctx: WorldContext): string {
  return ctx.toneFragments?.core || '';
}

/**
 * Get flat canon facts array from structured context
 */
export function getCanonFacts(ctx: WorldContext): string[] {
  return (ctx.canonFactsWithMetadata || []).map(f => f.text);
}

/**
 * Resolved relationship with target entity info
 */
export interface ResolvedRelationship {
  kind: string;                 // "allies_with", "member_of", "rivals"
  targetName: string;           // Resolved entity name
  targetKind: string;           // "faction", "npc", "location"
  targetSubtype?: string;       // "guild", "hero", "fortress"
  strength?: number;            // 0-1 relationship strength
  mutual?: boolean;             // Is this bidirectional?
}

/**
 * Entity-specific context built from graph data
 */
export interface EntityContext {
  // Core entity data
  entity: {
    id: string;
    name: string;
    kind: string;
    subtype: string;
    prominence: string;
    culture: string;
    status: string;
    /** Short summary of the entity (1-2 sentences) */
    summary?: string;
    /** Full description (if any) - used for text prompts */
    description: string;
    tags: Record<string, string | number | boolean>;
    /** One-sentence visual thesis - the primary visual signal for this entity */
    visualThesis?: string;
    /** Distinctive visual traits for image generation (support the thesis) */
    visualTraits?: string[];
  };

  // Resolved relationships (not just IDs)
  relationships: ResolvedRelationship[];

  // Temporal context
  era: {
    name: string;
    description?: string;
  };
  entityAge: 'ancient' | 'established' | 'mature' | 'recent' | 'new';

  // Related entities (names, not IDs)
  culturalPeers?: string[];     // Other notable entities of same culture
  factionMembers?: string[];    // If entity belongs to a faction
  locationEntities?: string[];  // Entities at same location (if applicable)

  // Narrative events involving this entity
  events?: Array<{
    era: string;
    description: string;
    significance: number;
    effects?: Array<{
      type: string;
      description: string;
    }>;
  }>;
}

/**
 * Full context for prompt building
 */
export interface PromptContext {
  world: WorldContext;
  entity: EntityContext;
}

// =============================================================================
// NEW: Entity Guidance Types (replaces PromptTemplates)
// =============================================================================

/**
 * Visual thesis generation settings for an entity kind
 */
export interface VisualThesisConfig {
  /** Domain context for the LLM (e.g., "You design characters for a fighting game roster") */
  domain: string;
  /** What to focus on for this kind (e.g., "Structural gear, profile extensions") */
  focus: string;
  /** Framing prepended to user message (e.g., "This is a CHARACTER - describe...") */
  framing: string;
}

/**
 * Visual traits generation settings for an entity kind
 */
export interface VisualTraitsConfig {
  /** Domain context for the LLM (e.g., "You're completing a character design brief") */
  domain: string;
  /** What to focus on for traits (e.g., "Additional distinctive features") */
  focus: string;
  /** Framing prepended to user message */
  framing: string;
}

/**
 * Per-entity-kind guidance for description and visual generation
 */
export interface KindGuidance {
  /** What to emphasize when describing this entity kind */
  focus: string;
  /** How to use relationships in the description */
  relationshipUse: string;
  /** Brief hint for how to portray this kind in chronicle prose */
  proseHint: string;
  /** Visual thesis generation config */
  visualThesis: VisualThesisConfig;
  /** Visual traits generation config */
  visualTraits: VisualTraitsConfig;
  /** Instructions for image generation */
  imageInstructions: string;
  /** Elements to avoid in images */
  imageAvoid: string;
}

/**
 * Entity guidance configuration - per-kind instructions for generation
 */
export interface EntityGuidance {
  [entityKind: string]: KindGuidance;
}

/**
 * Culture identity traits organized by type
 */
export interface CultureIdentities {
  /** Visual traits per culture (SPECIES, ARCHITECTURE, TECH, etc.) */
  visual: {
    [cultureId: string]: Record<string, string>;
  };
  /** Descriptive traits per culture (VALUES, SPEECH, FEARS, etc.) */
  descriptive: {
    [cultureId: string]: Record<string, string>;
  };
  /** Which visual keys apply to each entity kind */
  visualKeysByKind: {
    [entityKind: string]: string[];
  };
  /** Which descriptive keys apply to each entity kind */
  descriptiveKeysByKind: {
    [entityKind: string]: string[];
  };
}

/**
 * Complete Illuminator configuration (new structure)
 */
export interface IlluminatorConfig {
  worldContext: WorldContext;
  entityGuidance: EntityGuidance;
  cultureIdentities: CultureIdentities;
  enrichmentConfig: EnrichmentConfig;
  styleSelection: {
    artisticStyleId: string;
    compositionStyleId: string;
  };
}

/**
 * Enrichment API configuration
 */
export interface EnrichmentConfig {
  textModel: string;
  chronicleModel?: string;
  imageModel: string;
  imageSize: string;
  imageQuality: string;
  minProminenceForImage: string;
  numWorkers: number;
  requireDescription: boolean;
  useClaudeForImagePrompt: boolean;
  claudeImagePromptTemplate?: string;
}

// =============================================================================
// NEW: Helper Functions for Entity Guidance
// =============================================================================

/**
 * Get guidance for a specific entity kind
 * Returns undefined if kind not found (caller should handle gracefully)
 */
export function getKindGuidance(
  entityGuidance: EntityGuidance,
  kind: string
): KindGuidance | undefined {
  return entityGuidance[kind];
}

/**
 * Get visual identity for a culture, filtered by entity kind
 */
export function getFilteredVisualIdentity(
  cultureIdentities: CultureIdentities,
  culture: string,
  kind: string
): Record<string, string> {
  const cultureVisual = cultureIdentities.visual[culture];
  if (!cultureVisual) return {};

  const allowedKeys = cultureIdentities.visualKeysByKind[kind] || [];
  if (allowedKeys.length === 0) return cultureVisual;

  const filtered: Record<string, string> = {};
  for (const key of allowedKeys) {
    if (cultureVisual[key]) {
      filtered[key] = cultureVisual[key];
    }
  }
  return filtered;
}

/**
 * Get descriptive identity for a culture, filtered by entity kind
 */
export function getFilteredDescriptiveIdentity(
  cultureIdentities: CultureIdentities,
  culture: string,
  kind: string
): Record<string, string> {
  const cultureDescriptive = cultureIdentities.descriptive[culture];
  if (!cultureDescriptive) return {};

  const allowedKeys = cultureIdentities.descriptiveKeysByKind[kind] || [];
  if (allowedKeys.length === 0) return cultureDescriptive;

  const filtered: Record<string, string> = {};
  for (const key of allowedKeys) {
    if (cultureDescriptive[key]) {
      filtered[key] = cultureDescriptive[key];
    }
  }
  return filtered;
}

/**
 * Build prose hints for chronicle generation
 * Aggregates proseHint from all involved entity kinds
 */
export function buildProseHints(
  entityGuidance: EntityGuidance,
  involvedKinds: string[]
): string {
  const uniqueKinds = [...new Set(involvedKinds)];
  const hints: string[] = [];

  for (const kind of uniqueKinds) {
    const guidance = entityGuidance[kind];
    if (guidance?.proseHint) {
      hints.push(`${kind.toUpperCase()}: ${guidance.proseHint}`);
    }
  }

  return hints.length > 0 ? hints.join('\n') : '';
}

/**
 * Get default guidance for a kind that has no configuration
 */
function getDefaultKindGuidance(kind: string): KindGuidance {
  return {
    focus: `Describe this ${kind} with vivid, specific details.`,
    relationshipUse: 'Reference relevant relationships to ground the description.',
    proseHint: `Show this ${kind} through specific details.`,
    visualThesis: {
      domain: `You design ${kind}s for a fantasy world.`,
      focus: 'Focus on distinctive visual elements.',
      framing: `This is a ${kind.toUpperCase()}.`,
    },
    visualTraits: {
      domain: `You're completing a ${kind} design brief.`,
      focus: 'Add supporting visual details.',
      framing: `This is a ${kind.toUpperCase()}.`,
    },
    imageInstructions: `Create concept art for this ${kind}.`,
    imageAvoid: 'Text, labels, watermarks.',
  };
}

// =============================================================================
// Prompt Builders (using EntityGuidance directly)
// =============================================================================

/**
 * Build a description prompt using EntityGuidance and CultureIdentities directly.
 * No adapter layer - this is the canonical prompt builder.
 */
export function buildDescriptionPromptFromGuidance(
  entityGuidance: EntityGuidance,
  cultureIdentities: CultureIdentities,
  worldContext: WorldContext,
  entityContext: EntityContext
): string {
  const e = entityContext.entity;
  const kind = e.kind;
  const guidance = entityGuidance[kind] || getDefaultKindGuidance(kind);

  // Get filtered cultural identities
  const descriptiveIdentity = getFilteredDescriptiveIdentity(cultureIdentities, e.culture, kind);
  const visualIdentity = getFilteredVisualIdentity(cultureIdentities, e.culture, kind);

  // Format sections
  const tagsSection = e.tags && Object.keys(e.tags).length > 0
    ? `TAGS:\n${Object.entries(e.tags).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
    : '';

  const descriptiveSection = Object.keys(descriptiveIdentity).length > 0
    ? `CULTURAL IDENTITY (${e.culture}):\n${Object.entries(descriptiveIdentity).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
    : '';

  const visualSection = Object.keys(visualIdentity).length > 0
    ? `CULTURAL VISUAL IDENTITY (${e.culture}):\n${Object.entries(visualIdentity).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
    : '';

  const relationshipsSection = entityContext.relationships.length > 0
    ? entityContext.relationships.slice(0, 8).map(r => {
        let line = `- ${r.kind}: ${r.targetName} (${r.targetKind}`;
        if (r.targetSubtype) line += `/${r.targetSubtype}`;
        line += ')';
        const strength = r.strength ?? 0.5;
        const label = strength >= 0.7 ? 'strong' : strength >= 0.4 ? 'moderate' : 'weak';
        line += ` [${label}]`;
        return line;
      }).join('\n')
    : '(No established relationships)';

  const parts = [
    `Write a description for ${e.name}, a ${e.subtype} ${kind} in ${worldContext.name}.`,
    '',
    `WORLD: ${worldContext.description}`,
    '',
    'TONE & STYLE:',
    getTone(worldContext),
    '',
    'CANON FACTS (never contradict):',
    getCanonFacts(worldContext).map(f => `- ${f}`).join('\n'),
    '',
    '---',
    '',
    'ENTITY:',
    `- Kind: ${kind}`,
    `- Subtype: ${e.subtype}`,
    `- Prominence: ${e.prominence}`,
    `- Status: ${e.status}`,
    `- Culture: ${e.culture || 'unaffiliated'}`,
    `- Age in world: ${entityContext.entityAge}`,
    '',
    tagsSection,
    descriptiveSection,
    visualSection,
    '',
    'RELATIONSHIPS:',
    relationshipsSection,
    '',
    entityContext.culturalPeers?.length ? `CULTURAL PEERS: ${entityContext.culturalPeers.join(', ')}` : '',
    entityContext.factionMembers?.length ? `FACTION MEMBERS: ${entityContext.factionMembers.join(', ')}` : '',
    '',
    // Add events section if entity has narrative history
    entityContext.events?.length ? `HISTORY FRAGMENTS (mine for flavor, don't enumerate):\n${entityContext.events.map(ev =>
      `- [${ev.era}] ${ev.description}`
    ).join('\n')}` : '',
    '',
    `ERA: ${entityContext.era.name}${entityContext.era.description ? ` - ${entityContext.era.description}` : ''}`,
    '',
    '---',
    '',
    `FOCUS FOR ${kind.toUpperCase()}:`,
    guidance.focus,
    '',
    'RELATIONSHIP GUIDANCE:',
    guidance.relationshipUse,
    '',
    '---',
    '',
    'OUTPUT: Return JSON with keys: summary, description, aliases',
    '- description: 2-4 sentences, vivid and specific',
    '- summary: 1-2 sentences, compressed and faithful to description',
    '- aliases: array of alternate names (can be empty)',
  ];

  return parts.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Build an image prompt using EntityGuidance and CultureIdentities directly.
 * No adapter layer - this is the canonical prompt builder.
 */
export function buildImagePromptFromGuidance(
  entityGuidance: EntityGuidance,
  cultureIdentities: CultureIdentities,
  worldContext: WorldContext,
  entityContext: EntityContext,
  styleInfo?: StyleInfo
): string {
  const e = entityContext.entity;
  const kind = e.kind;
  const guidance = entityGuidance[kind] || getDefaultKindGuidance(kind);

  // Use summary for image prompts (concise text for visual generation)
  const summaryText = e.summary || '';

  // Visual thesis - THE primary visual signal
  const visualThesisSection = e.visualThesis
    ? `VISUAL THESIS (PRIMARY - this is the dominant visual signal):\n${e.visualThesis}`
    : '';

  // Supporting traits
  const supportingTraitsSection = e.visualTraits?.length
    ? `SUPPORTING TRAITS (reinforce the thesis):\n${e.visualTraits.map(t => `- ${t}`).join('\n')}`
    : '';

  // Cultural visual identity
  const visualIdentity = getFilteredVisualIdentity(cultureIdentities, e.culture, kind);
  const visualIdentitySection = Object.keys(visualIdentity).length > 0
    ? `CULTURAL VISUAL IDENTITY (${e.culture}):\n${Object.entries(visualIdentity).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
    : '';

  // Style sections
  const styleSection = styleInfo?.artisticPromptFragment
    ? `STYLE: ${styleInfo.artisticPromptFragment}`
    : '';

  const colorPaletteSection = styleInfo?.colorPalettePromptFragment
    ? (styleInfo.colorPalettePromptFragment.startsWith('COLOR PALETTE')
        ? styleInfo.colorPalettePromptFragment
        : `COLOR PALETTE: ${styleInfo.colorPalettePromptFragment}`)
    : '';

  const compositionSection = styleInfo?.compositionPromptFragment
    ? `COMPOSITION: ${styleInfo.compositionPromptFragment}`
    : '';

  // Species constraint section - placed prominently after IMAGE INSTRUCTIONS
  const speciesSection = worldContext.speciesConstraint
    ? `SPECIES REQUIREMENT: ${worldContext.speciesConstraint}`
    : '';

  const parts = [
    `IMAGE INSTRUCTIONS: ${guidance.imageInstructions}`,
    speciesSection,
    '',
    `SUBJECT: ${e.name}, a ${e.subtype} ${kind}`,
    summaryText ? `CONTEXT: ${summaryText}` : '',
    '',
    visualThesisSection,
    supportingTraitsSection,
    visualIdentitySection,
    '',
    styleSection,
    colorPaletteSection,
    compositionSection,
    'RENDER: Favor stylized exaggeration over anatomical realism. Push proportions to emphasize the thesis.',
    '',
    `SETTING: ${worldContext.name}`,
    '',
    `AVOID: ${guidance.imageAvoid}`,
  ];

  return parts.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Get visual config for an entity from EntityGuidance
 */
export function getVisualConfigFromGuidance(
  entityGuidance: EntityGuidance,
  kind: string
): {
  visualAvoid: string;
  visualThesisInstructions: string;
  visualThesisFraming: string;
  visualTraitsInstructions: string;
  visualTraitsFraming: string;
} {
  const guidance = entityGuidance[kind] || getDefaultKindGuidance(kind);
  return {
    visualAvoid: guidance.imageAvoid,
    visualThesisInstructions: `${guidance.visualThesis.domain}\n\n${guidance.visualThesis.focus}`,
    visualThesisFraming: guidance.visualThesis.framing,
    visualTraitsInstructions: `${guidance.visualTraits.domain}\n\n${guidance.visualTraits.focus}`,
    visualTraitsFraming: guidance.visualTraits.framing,
  };
}

/**
 * Create default entity guidance (fallback when none provided)
 */
export function createDefaultEntityGuidance(): EntityGuidance {
  return {};
}

/**
 * Create default culture identities (fallback when none provided)
 */
export function createDefaultCultureIdentities(): CultureIdentities {
  return {
    visual: {},
    descriptive: {},
    visualKeysByKind: {},
    descriptiveKeysByKind: {},
  };
}



// =============================================================================
// Chronicle Image Prompts
// =============================================================================

/**
 * Chronicle image size to composition hint mapping
 */
const SIZE_COMPOSITION_HINTS: Record<string, string> = {
  small: 'compact vignette, focused detail shot, thumbnail-friendly',
  medium: 'balanced composition, scene establishing shot',
  large: 'dramatic wide shot, environmental storytelling',
  'full-width': 'panoramic vista, epic landscape, sweeping scene',
};

/**
 * Context for building chronicle scene image prompts
 */
export interface ChronicleSceneContext {
  /** LLM-generated scene description */
  sceneDescription: string;
  /** Size hint for composition */
  size: 'small' | 'medium' | 'large' | 'full-width';
  /** Chronicle title for context */
  chronicleTitle?: string;
  /** World context */
  world?: {
    name: string;
    description?: string;
    speciesConstraint?: string;
  };
}

/**
 * Build an image prompt for chronicle scene/montage images.
 * Rendering directives (STYLE/PALETTE/COMPOSITION) come first as primary authority.
 * No entity lookups — visual identity is baked into the scene description by the scene LLM.
 */
export function buildChronicleScenePrompt(
  context: ChronicleSceneContext,
  styleInfo?: StyleInfo
): string {
  const { sceneDescription, size, chronicleTitle, world } = context;

  // Rendering directives first — these are the primary visual authority
  const styleSection = styleInfo?.artisticPromptFragment
    ? `STYLE: ${styleInfo.artisticPromptFragment}`
    : '';

  const colorPaletteSection = styleInfo?.colorPalettePromptFragment
    ? (styleInfo.colorPalettePromptFragment.startsWith('COLOR PALETTE')
        ? styleInfo.colorPalettePromptFragment
        : `COLOR PALETTE: ${styleInfo.colorPalettePromptFragment}`)
    : '';

  const compositionHint = SIZE_COMPOSITION_HINTS[size] || SIZE_COMPOSITION_HINTS.medium;
  const compositionSection = styleInfo?.compositionPromptFragment
    ? `COMPOSITION: ${styleInfo.compositionPromptFragment}`
    : `COMPOSITION: ${compositionHint}`;

  const sizeHint = `SIZE HINT: ${compositionHint}`;

  // Scene content
  const worldSection = world
    ? `WORLD: ${world.name}${world.description ? ` - ${world.description}` : ''}`
    : '';

  const speciesSection = world?.speciesConstraint
    ? `SPECIES REQUIREMENT: ${world.speciesConstraint}`
    : '';

  const parts = [
    styleSection,
    colorPaletteSection,
    compositionSection,
    sizeHint,
    '',
    `SCENE: ${sceneDescription}`,
    chronicleTitle ? `FROM: "${chronicleTitle}"` : '',
    '',
    worldSection,
    speciesSection,
    '',
    'AVOID: Human figures, humanoid hands or fingers, human body proportions. Modern elements, anachronistic technology, text overlays, watermarks',
  ];

  return parts.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
