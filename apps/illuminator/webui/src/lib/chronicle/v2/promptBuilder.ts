/**
 * Chronicle V2 Prompt Builder
 *
 * Single-shot prompt construction for both story and document formats.
 * Includes full narrative style fidelity - structure, scenes, cast rules, etc.
 */

import type {
  ChronicleGenerationContext,
  EntityContext,
  RelationshipContext,
  NarrativeEventContext,
  ChronicleTemporalContext,
  EraTemporalInfo,
} from '../chronicleTypes';
import {
  collapseBidirectionalRelationships,
  type CollapsedRelationship,
} from '../selectionWizard';
import type {
  NarrativeStyle,
  StoryNarrativeStyle,
  DocumentNarrativeStyle,
} from '@canonry/world-schema';
import type { V2SelectionResult } from './types';

import type { EntityDirective } from '../../perspectiveSynthesizer';

// =============================================================================
// Entity Formatting
// =============================================================================

/**
 * Format a single entity with full details (for entry point).
 */
function formatEntityFull(e: EntityContext): string {
  const desc = e.description || '(no description available)';
  const tags = e.tags && Object.keys(e.tags).length > 0
    ? Object.entries(e.tags).map(([k, v]) => `${k}=${v}`).join(', ')
    : null;

  const lines = [
    `Kind: ${e.kind}${e.subtype ? `/${e.subtype}` : ''}`,
    `Prominence: ${e.prominence}`,
    e.culture ? `Culture: ${e.culture}` : null,
    tags ? `Tags: ${tags}` : null,
    '',
    desc,
  ].filter((line) => line !== null);

  return lines.join('\n');
}

/**
 * Format a single entity briefly (for supporting characters).
 * Uses ### to nest under ## Supporting Characters section.
 */
function formatEntityBrief(e: EntityContext): string {
  const desc = e.description || '(no description available)';
  return `### ${e.name} (${e.kind}${e.subtype ? `/${e.subtype}` : ''})
Prominence: ${e.prominence}${e.culture ? `, Culture: ${e.culture}` : ''}
${desc}`;
}

/**
 * Format a collapsed relationship (potentially bidirectional).
 */
function formatCollapsedRelationship(collapsed: CollapsedRelationship): string {
  const { primary, isBidirectional } = collapsed;
  if (isBidirectional) {
    return `- ${primary.sourceName} <--[${primary.kind}]--> ${primary.targetName} (mutual)`;
  }
  return `- ${primary.sourceName} --[${primary.kind}]--> ${primary.targetName}`;
}

/**
 * Format an event.
 */
function formatEvent(e: NarrativeEventContext): string {
  const significance = Math.round(e.significance * 100);
  const subjectLine = e.subjectName ? ` (subject: ${e.subjectName})` : '';
  const objectLine = e.objectName ? ` (object: ${e.objectName})` : '';
  const participantNames = e.participants?.map(p => p.name).filter(Boolean) ?? [];
  const uniqueParticipants = Array.from(new Set(participantNames))
    .filter(name => name !== e.subjectName && name !== e.objectName);
  const participantsLine = uniqueParticipants.length > 0
    ? ` (participants: ${uniqueParticipants.join(', ')})`
    : '';
  return `- [${e.eventKind}, ${significance}%] ${e.headline}${subjectLine}${objectLine}${participantsLine}`;
}

// =============================================================================
// Section Builders
// =============================================================================

/**
 * Build the world section of the prompt.
 * Contains world context only - style/tone guidance is handled separately.
 */
function buildWorldSection(context: ChronicleGenerationContext): string {
  const lines = [
    `# World: ${context.worldName}`,
    context.worldDescription || '',
  ].filter(Boolean);

  if (context.canonFacts && context.canonFacts.length > 0) {
    lines.push('');
    lines.push('Canon Facts:');
    lines.push('(Facts marked with [FACET: ...] include a lens specific to this chronicle. Prioritize the facet - it shows how the universal truth applies to these particular entities and circumstances. The base fact provides context; the facet is your guide.)');
    for (const fact of context.canonFacts) {
      lines.push(`- ${fact}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build the data section (relationships + events).
 * Collapses bidirectional relationships into single entries with (mutual) indicator.
 */
function buildDataSection(selection: V2SelectionResult): string {
  const lines: string[] = [];

  if (selection.relationships.length > 0) {
    const collapsed = collapseBidirectionalRelationships(selection.relationships);
    lines.push('# Relationships');
    for (const rel of collapsed) {
      lines.push(formatCollapsedRelationship(rel));
    }
  }

  if (selection.events.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('# Events');
    for (const evt of selection.events) {
      lines.push(formatEvent(evt));
    }
  }

  return lines.join('\n');
}

/**
 * Build the temporal context section.
 * Provides era information and timeline context for the chronicle.
 */
function buildTemporalSection(temporalContext: ChronicleTemporalContext | undefined): string {
  if (!temporalContext) return '';

  const lines: string[] = ['# Historical Context'];
  const focal = temporalContext.focalEra;

  // Focal era name and summary
  lines.push(`## Era: ${focal.name}`);
  if (focal.summary) {
    lines.push(focal.summary);
  }

  // World timeline (natural language) - always show
  lines.push('');
  lines.push(buildWorldTimeline(temporalContext.allEras, focal.id));

  // Note about events from other eras
  if (temporalContext.isMultiEra) {
    lines.push('');
    lines.push('Some events listed may be from earlier eras. Treat these as historical background that shaped the present, not as scenes to dramatize.');
  }

  return lines.join('\n');
}

/**
 * Add "the" article to an era name, handling names that already start with "The".
 */
function withArticle(name: string): string {
  // If name starts with "The ", convert to lowercase "the "
  if (name.startsWith('The ')) {
    return 'the ' + name.slice(4);
  }
  return 'the ' + name;
}

/**
 * Build a natural language world timeline.
 * E.g., "The world passed through the Dawn Age, then the Age of Expansion. It now exists in the Clever Ice Age."
 */
function buildWorldTimeline(eras: EraTemporalInfo[], focalEraId: string): string {
  const sorted = [...eras].sort((a, b) => a.order - b.order);
  const focalIndex = sorted.findIndex(e => e.id === focalEraId);

  if (focalIndex === -1) return '';

  const past = sorted.slice(0, focalIndex);
  const current = sorted[focalIndex];
  const future = sorted.slice(focalIndex + 1);

  const parts: string[] = [];

  if (past.length > 0) {
    const pastNames = past.map(e => withArticle(e.name)).join(', then ');
    parts.push(`The world passed through ${pastNames}.`);
  }

  parts.push(`It now exists in ${withArticle(current.name)}.`);

  if (future.length > 0) {
    const futureNames = future.map(e => withArticle(e.name)).join(', then ');
    parts.push(`${futureNames} ${future.length === 1 ? 'lies' : 'lie'} ahead.`);
  }

  return parts.join(' ');
}

/**
 * Build the name bank section.
 * Provides culture-appropriate names for invented characters.
 * This is practical data, not prose guidance.
 */
function buildNameBankSection(
  nameBank: Record<string, string[]> | undefined,
  entities: EntityContext[]
): string {
  if (!nameBank || Object.keys(nameBank).length === 0) {
    return '';
  }

  const entityCultures = new Set(
    entities.map(e => e.culture).filter((c): c is string => Boolean(c))
  );

  const lines: string[] = ['# Name Bank'];
  lines.push('Culture-appropriate names for invented characters:');

  // Cultures from entities first
  for (const cultureId of entityCultures) {
    if (nameBank[cultureId] && nameBank[cultureId].length > 0) {
      lines.push(`- ${cultureId}: ${nameBank[cultureId].join(', ')}`);
    }
  }

  // Any additional cultures in name bank
  for (const [cultureId, names] of Object.entries(nameBank)) {
    if (!entityCultures.has(cultureId) && names.length > 0) {
      lines.push(`- ${cultureId}: ${names.join(', ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build the narrative voice section.
 * Renders the synthesized voice from perspective synthesis as key-value pairs.
 */
function buildNarrativeVoiceSection(
  narrativeVoice: Record<string, string> | undefined
): string {
  if (!narrativeVoice || Object.keys(narrativeVoice).length === 0) {
    return '';
  }

  const lines: string[] = ['# Narrative Voice'];
  lines.push('Synthesized prose guidance for this chronicle:');
  lines.push('');

  for (const [key, value] of Object.entries(narrativeVoice)) {
    lines.push(`**${key}**: ${value}`);
  }

  return lines.join('\n');
}

/**
 * Build the entity directives section.
 * Renders per-entity writing directives from perspective synthesis.
 */
function buildEntityDirectivesSection(
  entityDirectives: EntityDirective[] | undefined
): string {
  if (!entityDirectives || entityDirectives.length === 0) {
    return '';
  }

  const lines: string[] = ['# Entity Writing Directives'];
  lines.push('Specific guidance for writing each entity — interpret creatively, don\'t reproduce this language directly:');
  lines.push('');

  for (const directive of entityDirectives) {
    lines.push(`**${directive.entityName}**: ${directive.directive}`);
  }

  return lines.join('\n');
}

/**
 * Build the narrative lens section.
 * Provides contextual framing from an intangible entity (rule, occurrence, ability)
 * that shapes the story without being a cast member.
 */
function buildNarrativeLensSection(context: ChronicleGenerationContext): string {
  if (!context.lensEntity) {
    return '';
  }

  const entity = context.lensEntity;
  const desc = entity.description || entity.summary || '(no description available)';
  const tags = entity.tags && Object.keys(entity.tags).length > 0
    ? Object.entries(entity.tags).map(([k, v]) => `${k}=${v}`).join(', ')
    : null;

  const lines: string[] = ['# Narrative Lens'];
  lines.push('This story exists in the shadow of:');
  lines.push('');
  lines.push(`## ${entity.name} (${entity.kind}${entity.subtype ? `/${entity.subtype}` : ''})`);
  lines.push(`Prominence: ${entity.prominence}${entity.culture ? `, Culture: ${entity.culture}` : ''}`);
  if (tags) lines.push(`Tags: ${tags}`);
  lines.push('');
  lines.push(desc);
  lines.push('');
  lines.push('Lens Guidance: This entity is NOT a character in the story. It is the context — the constraint, the backdrop, the thing everyone knows but no one can change. It should be felt in characters\' choices, in what is possible and impossible, in what goes unsaid. Reference it naturally, never explain it to the reader as if they don\'t know it.');

  return lines.join('\n');
}

// =============================================================================
// Story Format - Structure & Style Building
// =============================================================================

/**
 * Build the narrative structure section for story format.
 * Uses the unified narrativeInstructions field.
 */
function buildStoryStructureSection(style: StoryNarrativeStyle): string {
  const lines: string[] = ['# Narrative Structure'];

  // Scene count guidance
  if (style.pacing?.sceneCount) {
    lines.push(`Target: ${style.pacing.sceneCount.min}-${style.pacing.sceneCount.max} scenes`);
    lines.push('');
  }

  // Narrative instructions (plot structure, scenes, beats, emotional arcs)
  if (style.narrativeInstructions) {
    lines.push(style.narrativeInstructions);
  }

  return lines.join('\n');
}

/**
 * Build the unified cast section for story format.
 * Combines role expectations with character data so the LLM sees roles and characters together.
 */
function buildUnifiedCastSection(
  selection: V2SelectionResult,
  primaryEntityIds: Set<string>,
  style: StoryNarrativeStyle
): string {
  const lines: string[] = [`# Cast (${selection.entities.length} characters)`];

  // Role expectations first - so LLM knows what to look for
  if (style.roles && style.roles.length > 0) {
    lines.push('');
    lines.push('## Narrative Roles');
    lines.push('Assign characters from below to these roles:');
    for (const role of style.roles) {
      const countStr = role.count.min === role.count.max
        ? `${role.count.min}`
        : `${role.count.min}-${role.count.max}`;
      lines.push(`- **${role.role}** (${countStr}): ${role.description}`);
    }
  }

  // Primary characters
  const primaryEntities = selection.entities.filter(e => primaryEntityIds.has(e.id));
  const supportingEntities = selection.entities.filter(e => !primaryEntityIds.has(e.id));

  if (primaryEntities.length > 0) {
    lines.push('');
    lines.push('## Primary Characters');
    for (const entity of primaryEntities) {
      lines.push('');
      lines.push(`### ${entity.name}`);
      lines.push(formatEntityFull(entity));
    }
  }

  // Supporting characters
  if (supportingEntities.length > 0) {
    lines.push('');
    lines.push('## Supporting Characters');
    for (const entity of supportingEntities) {
      lines.push('');
      lines.push(formatEntityBrief(entity));
    }
  }

  return lines.join('\n');
}

/**
 * Build the event usage section for story format.
 */
function buildEventUsageSection(style: StoryNarrativeStyle): string {
  if (!style.eventInstructions) {
    return '';
  }

  return `# How to Use Events
${style.eventInstructions}`;
}

/**
 * Build the unified style section for story format.
 * Combines world tone/voice guidance with prose instructions from the narrative style.
 * This is the single location for all writing style guidance.
 */
function buildUnifiedStyleSection(
  tone: string | undefined,
  style: StoryNarrativeStyle
): string {
  const lines: string[] = [`# Writing Style`];
  let hasContent = false;

  // World tone/voice guidance (may contain detailed style instructions)
  if (tone) {
    lines.push('');
    lines.push(tone);
    hasContent = true;
  }

  // Prose instructions from narrative style (tone, dialogue, description, world elements, avoid)
  if (style.proseInstructions) {
    if (hasContent) lines.push('');
    lines.push(`## Prose: ${style.name}`);
    lines.push(style.proseInstructions);
    hasContent = true;
  }

  return hasContent ? lines.join('\n') : '';
}

/**
 * Build complete prompt for story format.
 *
 * Section order matches system prompt exactly:
 *
 * TASK DATA (how to write it):
 * 1. TASK - Word count, scene count, requirements
 * 2. NARRATIVE STRUCTURE - Scene progression and emotional beats
 * 3. EVENT USAGE - How to incorporate world events
 * 4. NARRATIVE VOICE - Synthesized prose guidance
 * 5. ENTITY WRITING DIRECTIVES - Per-entity guidance
 * 6. WRITING STYLE - World tone + prose instructions
 *
 * WORLD DATA (what to write about):
 * 7. CAST - Narrative roles + characters
 * 8. WORLD - Setting context
 * 9. NAME BANK - Culture-appropriate names
 * 10. HISTORICAL CONTEXT - Era, timeline, temporal scope
 * 11. RELATIONSHIPS - Connections between characters
 * 12. EVENTS - What happened in the world
 */
function buildStoryPrompt(
  context: ChronicleGenerationContext,
  selection: V2SelectionResult,
  primaryEntityIds: Set<string>,
  narrativeVoiceSection: string,
  entityDirectivesSection: string,
  nameBankSection: string,
  style: StoryNarrativeStyle
): string {
  const pacing = style.pacing;
  const wordRange = `${pacing.totalWordCount.min}-${pacing.totalWordCount.max}`;
  const sceneRange = pacing.sceneCount
    ? `${pacing.sceneCount.min}-${pacing.sceneCount.max}`
    : '4-5';

  // === TASK DATA ===

  // 1. TASK
  const taskSection = `# Task
Write a ${wordRange} word narrative in ${sceneRange} distinct scenes.

Requirements:
- Assign the provided characters to the narrative roles defined below
- Follow the plot structure and scene progression
- Incorporate the listed events naturally into the narrative
- Follow the Entity Writing Directives for each character's speech and behavior
- Write directly with no section headers or meta-commentary`;

  // 2. NARRATIVE STRUCTURE
  const structureSection = buildStoryStructureSection(style);

  // 3. EVENT USAGE
  const eventSection = buildEventUsageSection(style);

  // 4. NARRATIVE VOICE (synthesized, replaces raw cultural identities)

  // 5. ENTITY WRITING DIRECTIVES (synthesized, replaces raw prose hints)

  // 6. WRITING STYLE
  const styleSection = buildUnifiedStyleSection(context.tone, style);

  // === WORLD DATA ===

  // 7. CAST (unified roles + characters)
  const castSection = buildUnifiedCastSection(selection, primaryEntityIds, style);

  // 7b. NARRATIVE LENS (contextual frame entity)
  const lensSection = buildNarrativeLensSection(context);

  // 8. WORLD (setting context only, no style)
  const worldSection = buildWorldSection(context);

  // 9. NAME BANK (practical data)

  // 10. HISTORICAL CONTEXT
  const temporalSection = buildTemporalSection(context.temporalContext);

  // 11 & 12. RELATIONSHIPS + EVENTS
  const dataSection = buildDataSection(selection);

  // Combine sections in order: TASK DATA then WORLD DATA
  const sections = [
    // TASK DATA
    taskSection,
    structureSection,
    eventSection,
    narrativeVoiceSection,
    entityDirectivesSection,
    styleSection,
    // WORLD DATA
    castSection,
    lensSection,
    worldSection,
    nameBankSection,
    temporalSection,
    dataSection,
  ].filter(Boolean);

  return sections.join('\n\n');
}

// =============================================================================
// Document Format - Structure & Style Building
// =============================================================================

/**
 * Get word count range from document style.
 * Handles both new format (pacing.wordCount) and legacy format (documentConfig.wordCount).
 */
function getDocumentWordCount(style: DocumentNarrativeStyle): { min: number; max: number } {
  // New format
  if (style.pacing?.wordCount) {
    return style.pacing.wordCount;
  }
  // Legacy format fallback
  const legacy = style as unknown as { documentConfig?: { wordCount?: { min: number; max: number } } };
  if (legacy.documentConfig?.wordCount) {
    return legacy.documentConfig.wordCount;
  }
  // Default fallback
  return { min: 400, max: 600 };
}

/**
 * Get document instructions from style.
 * Handles both new format (documentInstructions) and legacy format (documentConfig fields).
 */
function getDocumentInstructions(style: DocumentNarrativeStyle): string {
  // New format
  if (style.documentInstructions) {
    return style.documentInstructions;
  }
  // Legacy format - try to construct from old fields
  const legacy = style as unknown as {
    documentConfig?: {
      documentType?: string;
      contentInstructions?: string;
      voice?: string;
      toneKeywords?: string[];
      sections?: Array<{ name: string; purpose: string; wordCountTarget?: number; optional?: boolean }>;
    };
  };
  if (legacy.documentConfig) {
    const doc = legacy.documentConfig;
    const lines: string[] = [];
    if (doc.documentType) {
      lines.push(`Document Type: ${doc.documentType}`);
    }
    if (doc.contentInstructions) {
      lines.push('', doc.contentInstructions);
    }
    if (doc.voice) {
      lines.push('', `Voice: ${doc.voice}`);
    }
    if (doc.toneKeywords?.length) {
      lines.push(`Tone: ${doc.toneKeywords.join(', ')}`);
    }
    if (doc.sections?.length) {
      lines.push('', 'Sections:');
      doc.sections.forEach((s, i) => {
        lines.push(`${i + 1}. ${s.name}: ${s.purpose}`);
      });
    }
    return lines.join('\n');
  }
  return '';
}

/**
 * Build the document instructions section.
 * Uses the unified documentInstructions field (structure, voice, tone all in one).
 */
function buildDocumentInstructionsSection(style: DocumentNarrativeStyle): string {
  const instructions = getDocumentInstructions(style);
  if (!instructions) {
    return '';
  }

  return `# Document Instructions
${instructions}`;
}

/**
 * Get roles from document style.
 * Handles both new format (roles) and legacy format (entityRules.roles).
 */
function getDocumentRoles(style: DocumentNarrativeStyle): Array<{ role: string; count: { min: number; max: number }; description: string }> {
  // New format
  if (style.roles && style.roles.length > 0) {
    return style.roles;
  }
  // Legacy format fallback
  const legacy = style as unknown as { entityRules?: { roles?: Array<{ role: string; count: { min: number; max: number }; description: string }> } };
  if (legacy.entityRules?.roles) {
    return legacy.entityRules.roles;
  }
  return [];
}

/**
 * Get event instructions from document style.
 * Handles both new format (eventInstructions) and legacy format (documentConfig.eventUsage).
 */
function getDocumentEventInstructions(style: DocumentNarrativeStyle): string {
  // New format
  if (style.eventInstructions) {
    return style.eventInstructions;
  }
  // Legacy format fallback
  const legacy = style as unknown as { documentConfig?: { eventUsage?: string } };
  if (legacy.documentConfig?.eventUsage) {
    return legacy.documentConfig.eventUsage;
  }
  return '';
}

/**
 * Build the document event usage section.
 */
function buildDocumentEventUsageSection(style: DocumentNarrativeStyle): string {
  const instructions = getDocumentEventInstructions(style);
  if (!instructions) {
    return '';
  }

  return `# How to Use Events
${instructions}`;
}

/**
 * Build the unified cast section for document format.
 * Combines role expectations with character data so the LLM sees roles and characters together.
 */
function buildUnifiedDocumentCastSection(
  selection: V2SelectionResult,
  primaryEntityIds: Set<string>,
  style: DocumentNarrativeStyle
): string {
  const lines: string[] = [`# Cast (${selection.entities.length} characters)`];
  const roles = getDocumentRoles(style);

  // Role expectations first - so LLM knows what to look for
  if (roles.length > 0) {
    lines.push('');
    lines.push('## Document Roles');
    lines.push('Assign characters from below to these roles:');
    for (const role of roles) {
      const countStr = role.count.min === role.count.max
        ? `${role.count.min}`
        : `${role.count.min}-${role.count.max}`;
      lines.push(`- **${role.role}** (${countStr}): ${role.description}`);
    }
  }

  // Primary characters
  const primaryEntities = selection.entities.filter(e => primaryEntityIds.has(e.id));
  const supportingEntities = selection.entities.filter(e => !primaryEntityIds.has(e.id));

  if (primaryEntities.length > 0) {
    lines.push('');
    lines.push('## Primary Characters');
    for (const entity of primaryEntities) {
      lines.push('');
      lines.push(`### ${entity.name}`);
      lines.push(formatEntityFull(entity));
    }
  }

  // Supporting characters
  if (supportingEntities.length > 0) {
    lines.push('');
    lines.push('## Supporting Characters');
    for (const entity of supportingEntities) {
      lines.push('');
      lines.push(formatEntityBrief(entity));
    }
  }

  return lines.join('\n');
}

/**
 * Build complete prompt for document format.
 *
 * Section order matches story prompt structure:
 *
 * TASK DATA (how to write it):
 * 1. TASK - Word count, requirements
 * 2. DOCUMENT INSTRUCTIONS - Structure, voice, tone guidance
 * 3. EVENT USAGE - How to incorporate world events
 * 4. NARRATIVE VOICE - Synthesized prose guidance
 * 5. ENTITY WRITING DIRECTIVES - Per-entity guidance
 *
 * WORLD DATA (what to write about):
 * 6. CAST - Document roles + characters
 * 7. WORLD - Setting context
 * 8. NAME BANK - Culture-appropriate names
 * 9. HISTORICAL CONTEXT - Era, timeline
 * 10. RELATIONSHIPS + EVENTS - Data section
 */
function buildDocumentPrompt(
  context: ChronicleGenerationContext,
  selection: V2SelectionResult,
  primaryEntityIds: Set<string>,
  narrativeVoiceSection: string,
  entityDirectivesSection: string,
  nameBankSection: string,
  style: DocumentNarrativeStyle
): string {
  const wordCount = getDocumentWordCount(style);
  const wordRange = `${wordCount.min}-${wordCount.max}`;

  // === TASK DATA ===

  // 1. TASK
  const taskSection = `# Task
Write a ${wordRange} word ${style.name}.

Requirements:
- Follow the document structure and voice guidance below
- Assign the provided characters to the document roles defined below
- Incorporate the listed events naturally as context or content
- Follow the Entity Writing Directives for each character's speech and behavior
- Ground the document in the historical era and timeline provided
- Make the document feel authentic - as if it exists within the world
- Write the document directly with no meta-commentary`;

  // 2. DOCUMENT INSTRUCTIONS
  const instructionsSection = buildDocumentInstructionsSection(style);

  // 3. EVENT USAGE
  const eventSection = buildDocumentEventUsageSection(style);

  // 4. NARRATIVE VOICE (synthesized)

  // 5. ENTITY WRITING DIRECTIVES (synthesized)

  // === WORLD DATA ===

  // 6. CAST (unified roles + characters)
  const castSection = buildUnifiedDocumentCastSection(selection, primaryEntityIds, style);

  // 6b. NARRATIVE LENS (contextual frame entity)
  const lensSection = buildNarrativeLensSection(context);

  // 7. WORLD (setting context)
  const worldSection = buildWorldSection(context);

  // 8. NAME BANK (practical data)

  // 9. HISTORICAL CONTEXT
  const temporalSection = buildTemporalSection(context.temporalContext);

  // 10. RELATIONSHIPS + EVENTS
  const dataSection = buildDataSection(selection);

  // Combine sections in order: TASK DATA then WORLD DATA
  const sections = [
    // TASK DATA
    taskSection,
    instructionsSection,
    eventSection,
    narrativeVoiceSection,
    entityDirectivesSection,
    // WORLD DATA
    castSection,
    lensSection,
    worldSection,
    nameBankSection,
    temporalSection,
    dataSection,
  ].filter(Boolean);

  return sections.join('\n\n');
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Build the V2 single-shot prompt.
 */
export function buildV2Prompt(
  context: ChronicleGenerationContext,
  style: NarrativeStyle,
  selection: V2SelectionResult
): string {
  const primaryEntityIds = new Set(context.focus?.primaryEntityIds || []);
  const narrativeVoiceSection = buildNarrativeVoiceSection(context.narrativeVoice);
  const entityDirectivesSection = buildEntityDirectivesSection(context.entityDirectives);
  const nameBankSection = buildNameBankSection(context.nameBank, selection.entities);

  if (style.format === 'story') {
    return buildStoryPrompt(
      context,
      selection,
      primaryEntityIds,
      narrativeVoiceSection,
      entityDirectivesSection,
      nameBankSection,
      style as StoryNarrativeStyle
    );
  } else {
    return buildDocumentPrompt(
      context,
      selection,
      primaryEntityIds,
      narrativeVoiceSection,
      entityDirectivesSection,
      nameBankSection,
      style as DocumentNarrativeStyle
    );
  }
}

/**
 * Get max tokens based on word count target.
 * Rough estimate: 1 token ~= 0.75 words, plus buffer.
 */
export function getMaxTokensFromStyle(style: NarrativeStyle): number {
  const maxWords = style.format === 'story'
    ? (style as StoryNarrativeStyle).pacing.totalWordCount.max
    : getDocumentWordCount(style as DocumentNarrativeStyle).max;

  // Add 50% buffer for safety
  return Math.ceil(maxWords / 0.75 * 1.5);
}

/**
 * Get the system prompt for V2 generation.
 * Describes prompt structure and establishes guidance hierarchy.
 */
export function getV2SystemPrompt(style: NarrativeStyle): string {
  if (style.format === 'story') {
    return `You are a narrative writer creating world lore. Your prompt contains:

TASK DATA (how to write it):
- Task: Word count, scene count, requirements
- Narrative Structure: Scene progression and emotional beats - THIS IS PRIMARY
- Event Usage: How to incorporate world events
- Narrative Voice: Synthesized prose guidance blending cultural and stylistic elements
- Entity Writing Directives: Per-entity guidance for speech, behavior, and portrayal
- Writing Style: World tone sets the backdrop; Prose instructions are specific to this story type

WORLD DATA (what to write about):
- Cast: Narrative roles to fill, then characters to fill them
- Narrative Lens (optional): A contextual entity (rule, occurrence, ability) that shapes the story without being a character — treat as ambient constraint
- World: Setting name, description, canon facts
- Name Bank: Culture-appropriate names for invented characters
- Historical Context: Current era and world timeline
- Relationships: Connections between characters
- Events: What happened in the world

Hierarchy: Narrative Structure and Prose instructions define THIS story. Narrative Voice and Entity Directives are pre-synthesized guidance — follow their intent closely, but express them in your own voice. Writing Style provides the ambient tone everything sits within. The Narrative Lens, when present, provides contextual gravity — weave it into characters' decisions and the world's constraints without explaining it.`;
  } else {
    return `You are writing an in-universe document. Your prompt contains:

TASK DATA (how to write it):
- Task: Word count, requirements
- Document Instructions: Structure, voice, tone, what to include/avoid - THIS IS PRIMARY
- Event Usage: How to incorporate world events
- Narrative Voice: Synthesized prose guidance blending cultural and stylistic elements
- Entity Writing Directives: Per-entity guidance for speech, behavior, and portrayal

WORLD DATA (what to write about):
- Cast: Document roles to fill, then characters to fill them
- Narrative Lens (optional): A contextual entity (rule, occurrence, ability) that shapes the document without being a character — treat as ambient constraint
- World: Setting name, description, canon facts
- Name Bank: Culture-appropriate names for invented characters
- Historical Context: Current era and world timeline
- Relationships: Connections between characters
- Events: What happened in the world

Hierarchy: Document Instructions define THIS document's structure and voice. Narrative Voice and Entity Directives are pre-synthesized guidance — follow their intent closely, but express them in your own voice. The Narrative Lens, when present, provides contextual gravity — weave it into the document's assumptions and references without explaining it.

Write authentically as if the document exists within the world. No meta-commentary.`;
  }
}
