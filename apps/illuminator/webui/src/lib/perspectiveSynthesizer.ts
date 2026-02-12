/**
 * Perspective Synthesizer
 *
 * Synthesizes a world perspective brief from entity constellation analysis.
 * Uses LLM to generate a focused perspective that adjusts emphasis while
 * maintaining world coherence.
 */

import type { LLMClient } from './llmClient';
import type { EntityContext, EraContext, ChronicleRoleAssignment } from './chronicleTypes';
import type { EntityConstellation } from './constellationAnalyzer';
import type { ResolvedLLMCallConfig } from './llmModelSettings';
import {
  type NarrativeStyle,
  type ProminenceScale,
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceLabelFromScale,
} from '@canonry/world-schema';
import { runTextCall } from './llmTextCall';

// =============================================================================
// Types
// =============================================================================

/**
 * Fact type determines how the fact is used in generation.
 */
export type FactType = 'world_truth' | 'generation_constraint';

/**
 * Canon fact for perspective synthesis.
 */
export interface CanonFactWithMetadata {
  id: string;
  text: string;

  /**
   * How this fact is used. Defaults to "world_truth" if not specified.
   * - world_truth: Faceted by perspective synthesis
   * - generation_constraint: Always included verbatim, never faceted
   */
  type?: FactType;
  /** If true, this fact must be included in perspective facets. */
  required?: boolean;
}

/**
 * Tone fragments - just core prose style.
 */
export interface ToneFragments {
  core: string;
}

/**
 * Fact selection settings for perspective synthesis.
 */
export interface FactSelectionConfig {
  /** Minimum number of world-truth facts to facet (required facts count toward this). */
  minCount?: number;
  /** Maximum number of world-truth facts to facet. */
  maxCount?: number;
}

/**
 * A fact selected and interpreted for this constellation
 */
export interface FactFacet {
  factId: string;
  interpretation: string; // How this truth manifests for these entities
}

/**
 * Per-entity writing directive from perspective synthesis
 */
export interface EntityDirective {
  entityId: string;
  entityName: string;
  directive: string; // 1-3 sentences of concrete writing guidance
}

/**
 * Output of perspective synthesis
 */
export interface PerspectiveSynthesis {
  /** 150-200 words of perspective guidance for this chronicle */
  brief: string;
  /** Selected facts with their faceted interpretations for this constellation */
  facets: FactFacet[];
  /** 2-3 short phrases that might echo through this chronicle */
  suggestedMotifs: string[];
  /** Synthesized narrative voice blending cultural traits + narrative style */
  narrativeVoice: Record<string, string>;
  /** Per-entity writing directives pre-applying cultural traits + prose hints */
  entityDirectives: EntityDirective[];
  /** 2-4 sentences synthesizing era conditions and world dynamics into story-specific stakes. */
  temporalNarrative?: string;
}

/**
 * Input for perspective synthesis
 */
export interface PerspectiveSynthesisInput {
  constellation: EntityConstellation;
  entities: EntityContext[];
  focalEra?: EraContext;
  factsWithMetadata: CanonFactWithMetadata[];
  toneFragments: ToneFragments;
  /** Cultural identities - all cultures' descriptive traits (VALUES, SPEECH, FEARS, TABOOS, PROSE_STYLE, etc.) */
  culturalIdentities?: Record<string, Record<string, string>>;
  /** Narrative style - determines what aspects of the world to emphasize */
  narrativeStyle?: NarrativeStyle;
  /** Prose hints for entity kinds (entityKind -> prose guidance) */
  proseHints?: Record<string, string>;
  /** World dynamics - higher-level narrative context statements */
  worldDynamics?: Array<{
    id: string;
    text: string;
    cultures?: string[];
    kinds?: string[];
    eraOverrides?: Record<string, { text: string; replace: boolean }>;
  }>;
  /** Fact selection settings for perspective synthesis. */
  factSelection?: FactSelectionConfig;
  /** Optional free-text narrative direction — primary constraint when present */
  narrativeDirection?: string;
  /** Role assignments from wizard — which entity fills which narrative role */
  roleAssignments?: ChronicleRoleAssignment[];
}

/**
 * Full result including LLM usage
 */
export interface PerspectiveSynthesisResult {
  synthesis: PerspectiveSynthesis;
  assembledTone: string;
  /** All facts formatted for generation - core facts with faceted interpretations first */
  facetedFacts: string[];
  /** World dynamics actually injected into the synthesis prompt (post-filter/override). */
  resolvedWorldDynamics: Array<{ id: string; text: string }>;
  usage: {
    inputTokens: number;
    outputTokens: number;
    actualCost: number;
  };
}

// =============================================================================
// LLM Synthesis
// =============================================================================

const SYSTEM_PROMPT = `You are a perspective consultant for a fantasy chronicle series. Your job is to help each chronicle feel like a STORY about PEOPLE, not a document about a world.

You will receive:
1. NARRATIVE STYLE: What kind of story this is and how it should be written — READ THIS CAREFULLY, it determines the emotional register
2. BASELINE MATERIAL: Core tone, world facts, cultural identities, entity portrayal guidelines, and world dynamics
3. CONSTELLATION ANALYSIS: What cultures, entity types, themes, and dynamics are present
4. ENTITIES: The specific characters, places, etc. in this chronicle

Your task:
- MATCH THE NARRATIVE STYLE. Read the prose guidance carefully — it tells you what this story needs. Do not impose dimensions the style doesn't call for.
- Consider the NARRATIVE STYLE, CULTURAL IDENTITIES, and WORLD DYNAMICS when faceting
- FACET the world facts - for each selected fact, provide a short interpretation showing how it applies to THIS chronicle
- Keep interpretations to 1-2 sentences - they will be appended to the original fact
- Synthesize a NARRATIVE VOICE with 3-5 keys. Choose dimensions that serve THIS style — let the prose guidance inform what matters.
- Generate ENTITY DIRECTIVES for each entity. What matters about them for THIS story type? Let the style guide you.
- If any facts are marked REQUIRED, they MUST appear in facets

Your goal: Help the author write fiction that matches the narrative style's intent.

IMPORTANT: Output ONLY valid JSON. No markdown, no explanation, no commentary.`;

const normalizeToken = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '');

function resolveWorldDynamics(input: PerspectiveSynthesisInput): Array<{ id: string; text: string }> {
  const { worldDynamics, entities, focalEra, constellation } = input;
  if (!worldDynamics || worldDynamics.length === 0) return [];

  const presentCultureIds = Object.keys(constellation.cultures);
  const cultureTokenSet = new Set(presentCultureIds.map(normalizeToken));
  const entityKindsSet = new Set(entities.map((e) => e.kind));
  const kindTokenSet = new Set(Array.from(entityKindsSet).map(normalizeToken));
  const focalEraId = focalEra?.id;

  return worldDynamics
    .filter((d) => {
      const cultures = d.cultures || [];
      const kinds = d.kinds || [];

      const cultureMatch =
        cultures.length === 0 ||
        cultures.includes('*') ||
        cultures.some((c) => presentCultureIds.includes(c) || cultureTokenSet.has(normalizeToken(c)));

      const kindMatch =
        kinds.length === 0 ||
        kinds.includes('*') ||
        kinds.some((k) => entityKindsSet.has(k) || kindTokenSet.has(normalizeToken(k)));

      return cultureMatch && kindMatch;
    })
    .map((d) => {
      let text = d.text;
      if (focalEraId && d.eraOverrides?.[focalEraId]) {
        const override = d.eraOverrides[focalEraId];
        text = override.replace ? override.text : `${d.text} ${override.text}`;
      }
      return { id: d.id, text };
    });
}

function buildUserPrompt(input: PerspectiveSynthesisInput): {
  prompt: string;
  resolvedWorldDynamics: Array<{ id: string; text: string }>;
} {
  const {
    constellation,
    entities,
    focalEra,
    toneFragments,
    culturalIdentities,
    factsWithMetadata,
    narrativeStyle,
    proseHints,
    factSelection,
    narrativeDirection,
    roleAssignments,
  } = input;
  const prominenceScale = buildProminenceScale(
    entities
      .map((e) => Number(e.prominence))
      .filter((value) => Number.isFinite(value)),
    { distribution: DEFAULT_PROMINENCE_DISTRIBUTION }
  );
  const resolveProminenceLabel = (value: EntityContext['prominence'] | number | undefined, scale: ProminenceScale) => {
    if (value == null) return 'unknown';
    if (typeof value === 'number') {
      return prominenceLabelFromScale(value, scale);
    }
    const trimmed = String(value).trim();
    if (!trimmed) return 'unknown';
    if (scale.labels.includes(trimmed)) return trimmed;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return prominenceLabelFromScale(numeric, scale);
    }
    return trimmed;
  };

  // Build role lookup from assignments
  const roleByEntityId = new Map<string, { role: string; isPrimary: boolean }>();
  if (roleAssignments) {
    for (const ra of roleAssignments) {
      roleByEntityId.set(ra.entityId, { role: ra.role, isPrimary: ra.isPrimary });
    }
  }

  // Entity summaries
  const entitySummaries = entities
    .slice(0, 10)
    .map((e) => {
      const tags = e.tags && Object.keys(e.tags).length > 0
        ? ` [${Object.entries(e.tags).map(([k, v]) => `${k}=${v}`).join(', ')}]`
        : '';
      const prominenceLabel = resolveProminenceLabel(e.prominence, prominenceScale);
      const assignment = roleByEntityId.get(e.id);
      const roleLabel = assignment
        ? `, role: ${assignment.role}${assignment.isPrimary ? ' (primary)' : ''}`
        : '';
      return `- ${e.name} (${e.kind}, ${e.culture || 'unknown'}, ${prominenceLabel}${roleLabel})${tags}: ${e.summary || '(no summary)'}`;
    })
    .join('\n');

  // All world truth facts (not generation constraints, not disabled)
  const worldTruthFacts = (factsWithMetadata || []).filter(
    (f) => f.type !== 'generation_constraint' && !f.disabled
  );
  const requiredFacts = worldTruthFacts.filter((f) => f.required);
  const worldTruthFactsDisplay = worldTruthFacts
    .map((f) => `- [${f.id}]${f.required ? ' (REQUIRED)' : ''}: ${f.text}`)
    .join('\n');

  // Cultural identities for ALL present cultures (full, untruncated)
  const presentCultureIds = Object.keys(constellation.cultures);
  let culturalIdentitiesDisplay = 'No cultural identities provided.';
  if (culturalIdentities && presentCultureIds.length > 0) {
    const presentIdentities = presentCultureIds
      .filter((id) => culturalIdentities[id])
      .map((cultureId) => {
        const traits = culturalIdentities[cultureId];
        const traitLines = Object.entries(traits)
          .map(([key, value]) => `  ${key}: ${value}`)
          .join('\n');
        return `## ${cultureId}\n${traitLines}`;
      });
    if (presentIdentities.length > 0) {
      culturalIdentitiesDisplay = presentIdentities.join('\n\n');
    }
  }

  // Narrative style context - include prose instructions so synthesis matches style tone
  let narrativeStyleDisplay = 'No specific narrative style.';
  if (narrativeStyle) {
    const styleParts = [
      `Name: ${narrativeStyle.name}`,
      `Format: ${narrativeStyle.format}`,
      narrativeStyle.description ? `Description: ${narrativeStyle.description}` : null,
      narrativeStyle.tags?.length ? `Tags: ${narrativeStyle.tags.join(', ')}` : null,
      narrativeStyle.proseInstructions ? `\nProse guidance:\n${narrativeStyle.proseInstructions}` : null,
      narrativeStyle.craftPosture ? `\nCraft posture (density and restraint):\n${narrativeStyle.craftPosture}` : null,
    ].filter(Boolean);
    narrativeStyleDisplay = styleParts.join('\n');
  }

  // Prose hints for entity kinds
  let proseHintsDisplay = 'No entity portrayal guidelines provided.';
  if (proseHints && Object.keys(proseHints).length > 0) {
    const entityKinds = new Set(entities.map(e => e.kind));
    const relevantHints = Object.entries(proseHints)
      .filter(([kind]) => entityKinds.has(kind))
      .map(([kind, hint]) => `  ${kind}: ${hint}`);
    if (relevantHints.length > 0) {
      proseHintsDisplay = relevantHints.join('\n');
    }
  }

  // World dynamics — filter to relevant cultures/kinds, apply era overrides
  const resolvedWorldDynamics = resolveWorldDynamics(input);
  const worldDynamicsDisplay = resolvedWorldDynamics.length > 0
    ? resolvedWorldDynamics.map((d) => `- ${d.text}`).join('\n')
    : 'No world dynamics declared.';

  const requestedMin = factSelection?.minCount;
  const requestedMax = factSelection?.maxCount;
  const hasCustomRange =
    (typeof requestedMin === 'number' && requestedMin > 0) ||
    (typeof requestedMax === 'number' && requestedMax > 0);

  // Compute effective min/max, respecting required facts floor
  const effectiveMin = hasCustomRange
    ? Math.max(requestedMin ?? 4, requiredFacts.length)
    : undefined;
  const effectiveMax = hasCustomRange
    ? Math.max(requestedMax ?? effectiveMin ?? 6, effectiveMin ?? requiredFacts.length)
    : undefined;

  let factSelectionLine: string;
  let facetSelectionInstruction: string;
  if (effectiveMin !== undefined && effectiveMax !== undefined) {
    if (effectiveMin === effectiveMax) {
      factSelectionLine = `Fact selection target: exactly ${effectiveMin} (required facts count toward this).`;
      facetSelectionInstruction = `Select exactly ${effectiveMin}`;
    } else {
      factSelectionLine = `Fact selection target: ${effectiveMin}-${effectiveMax} (required facts count toward this).`;
      facetSelectionInstruction = `Select ${effectiveMin}-${effectiveMax}`;
    }
  } else {
    factSelectionLine = 'Fact selection target: default (4-6). Required facts must still be included.';
    facetSelectionInstruction = 'Select 4-6';
  }

  // Narrative direction block (only when provided)
  const narrativeDirectionBlock = narrativeDirection
    ? `\n=== NARRATIVE DIRECTION (PRIMARY CONSTRAINT) ===
The author has specified this concrete direction for the chronicle:
"${narrativeDirection}"

Your perspective brief, entity directives, motifs, and fact facets must all serve this specific narrative. Treat this as the organizing thesis — every synthesis decision should support it.\n`
    : '';

  return {
    resolvedWorldDynamics,
    prompt: `=== NARRATIVE STYLE ===
${narrativeStyleDisplay}
${narrativeDirectionBlock}
=== BASELINE MATERIAL ===

CORE TONE (applies to all chronicles):
${toneFragments.core}

WORLD FACTS (truths about this world):
${worldTruthFactsDisplay || 'No world facts provided.'}

CULTURAL IDENTITIES (for cultures present in this chronicle):
${culturalIdentitiesDisplay}

ENTITY PORTRAYAL GUIDELINES (per entity kind):
${proseHintsDisplay}

WORLD DYNAMICS (narrative context about inter-group forces and behaviors):
${worldDynamicsDisplay}

=== THIS CHRONICLE'S CONSTELLATION ===

Summary: ${constellation.focusSummary}
Cultures present: ${presentCultureIds.join(', ') || 'mixed/unknown'}
Culture balance: ${constellation.cultureBalance}${constellation.dominantCulture ? ` (dominant: ${constellation.dominantCulture})` : ''}
Entity types: ${Object.entries(constellation.kinds).map(([k, v]) => `${k}(${v})`).join(', ')}
Prominent themes: ${constellation.prominentTags.join(', ') || 'none identified'}
Relationship kinds: ${Object.entries(constellation.relationshipKinds).map(([k, v]) => `${k}(${v})`).join(', ') || 'none'}
Era: ${focalEra?.name || 'unspecified'}

ENTITIES IN THIS CHRONICLE:
${entitySummaries}

=== FACT SELECTION ===
${factSelectionLine}
${requiredFacts.length > 0 ? `Required facts: ${requiredFacts.map((f) => f.id).join(', ')}` : 'Required facts: none'}

=== YOUR TASK ===

Based on the narrative style, constellation, and cultural identities above, create a perspective for this chronicle.

CRITICAL: Match the narrative style. The prose guidance tells you what this story needs — follow it.

Provide a JSON object with:

1. "brief": A perspective brief (100-150 words) describing what matters emotionally for THIS story type. Let the style's prose guidance inform what to focus on.

2. "facets": ${facetSelectionInstruction} facts most relevant to this chronicle. REQUIRED facts (if any) must be included; if required facts exceed the default range, include all required and do not add optional facts. For each, provide a 1-2 sentence interpretation explaining how this fact specifically manifests or matters for the entities and story type in this chronicle. The original fact will be included; your interpretation adds the specific lens.

3. "suggestedMotifs": 2-3 short phrases that might echo through this chronicle — appropriate to the style.

4. "narrativeVoice": 3-5 atmospheric anchors appropriate to THIS narrative style. Choose dimensions that serve the story type. Do NOT provide ending or closure guidance.

5. "entityDirectives": For each entity, 1-2 sentences on what matters about them for THIS story. Let the style guide what to focus on. Include entityId, entityName, and directive.

6. "temporalNarrative" (optional): If WORLD DYNAMICS were provided above, synthesize them into 2-4 sentences of story-specific stakes for THIS chronicle. What conditions shape what's possible? What pressures bear on these characters? If no world dynamics are provided, omit this field entirely.

Output format:
{
  "brief": "...",
  "facets": [
    {"factId": "fact-id", "interpretation": "1-2 sentences max"}
  ],
  "suggestedMotifs": ["phrase one", "phrase two"],
  "narrativeVoice": {
    "KEY": "concrete prose guidance"
  },
  "entityDirectives": [
    {"entityId": "id", "entityName": "Name", "directive": "1-3 sentences"}
  ],
  "temporalNarrative": "2-4 sentences (optional, only if world dynamics provided)"
}`,
  };
}

/**
 * Synthesize perspective using LLM
 */
export async function synthesizePerspective(
  input: PerspectiveSynthesisInput,
  llmClient: LLMClient,
  callConfig: ResolvedLLMCallConfig
): Promise<PerspectiveSynthesisResult> {
  const { factsWithMetadata, toneFragments } = input;

  // Separate generation constraints (always included verbatim, not sent to LLM)
  const generationConstraints = (factsWithMetadata || []).filter(
    (f) => f.type === 'generation_constraint' && !f.disabled
  );

  // Build prompt with ALL baseline material - let LLM do the refinement
  const { prompt: userPrompt, resolvedWorldDynamics } = buildUserPrompt(input);

  // Assembled tone is the core tone fragment
  const assembledTone = toneFragments.core;

  // Make LLM call
  const callResult = await runTextCall({
    llmClient,
    callType: 'perspective.synthesis',
    callConfig,
    systemPrompt: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.7, // Allow variation
  });

  // Parse response
  let synthesis: PerspectiveSynthesis;
  try {
    const text = callResult.result.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }
    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.brief) {
      throw new Error('Missing brief in synthesis');
    }

    // Normalize facets
    const facets: FactFacet[] = Array.isArray(parsed.facets)
      ? parsed.facets.map((f: { factId?: string; interpretation?: string }) => ({
          factId: f.factId || '',
          interpretation: f.interpretation || '',
        }))
      : [];

    // Normalize suggestedMotifs
    const suggestedMotifs: string[] = Array.isArray(parsed.suggestedMotifs)
      ? parsed.suggestedMotifs.filter((m: unknown): m is string => typeof m === 'string')
      : [];

    // Normalize narrativeVoice
    const narrativeVoice: Record<string, string> = {};
    if (parsed.narrativeVoice && typeof parsed.narrativeVoice === 'object') {
      for (const [key, value] of Object.entries(parsed.narrativeVoice as Record<string, unknown>)) {
        if (typeof value === 'string') {
          narrativeVoice[key] = value;
        }
      }
    }

    // Normalize entityDirectives
    const entityDirectives: EntityDirective[] = Array.isArray(parsed.entityDirectives)
      ? parsed.entityDirectives
          .filter((d: { entityId?: string; directive?: string }) => d.entityId && d.directive)
          .map((d: { entityId?: string; entityName?: string; directive?: string }) => ({
            entityId: d.entityId || '',
            entityName: d.entityName || '',
            directive: d.directive || '',
          }))
      : [];

    const temporalNarrative = typeof parsed.temporalNarrative === 'string'
      ? parsed.temporalNarrative
      : undefined;

    synthesis = {
      brief: parsed.brief,
      facets,
      suggestedMotifs,
      narrativeVoice,
      entityDirectives,
      temporalNarrative,
    };
  } catch (err) {
    throw new Error(
      `Perspective synthesis failed to produce valid output: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Enforce required facts and max count (if configured)
  const worldTruthFacts = (factsWithMetadata || []).filter(
    (f) => f.type !== 'generation_constraint' && !f.disabled
  );
  const requiredFacts = worldTruthFacts.filter((f) => f.required);
  const requiredIds = requiredFacts.map((f) => f.id).filter(Boolean);
  const requestedMax = input.factSelection?.maxCount;
  const enforcedMax =
    typeof requestedMax === 'number' && requestedMax > 0
      ? Math.max(requestedMax, requiredIds.length)
      : requiredIds.length > 6
        ? requiredIds.length
        : undefined;
  const factMap = new Map(factsWithMetadata.map((f) => [f.id, f]));

  const facetsById = new Map<string, string>();
  const orderedFacetIds: string[] = [];
  for (const facet of synthesis.facets) {
    if (!facet.factId || !facet.interpretation) continue;
    if (!facetsById.has(facet.factId)) {
      facetsById.set(facet.factId, facet.interpretation);
      orderedFacetIds.push(facet.factId);
    }
  }

  const buildFallbackInterpretation = (factId: string): string => {
    const focus = input.constellation?.focusSummary
      ? `In this ${input.constellation.focusSummary} chronicle, `
      : 'In this chronicle, ';
    const era = input.focalEra?.name ? `set in the ${input.focalEra.name} era, ` : '';
    return `${focus}${era}this truth is foregrounded, shaping the stakes and how the entities interpret events.`;
  };

  const finalFacets: FactFacet[] = [];
  const addedIds = new Set<string>();

  for (const requiredId of requiredIds) {
    const interpretation = facetsById.get(requiredId) || buildFallbackInterpretation(requiredId);
    finalFacets.push({ factId: requiredId, interpretation });
    addedIds.add(requiredId);
  }

  for (const facetId of orderedFacetIds) {
    if (addedIds.has(facetId)) continue;
    const interpretation = facetsById.get(facetId);
    if (!interpretation) continue;
    finalFacets.push({ factId: facetId, interpretation });
    addedIds.add(facetId);
  }

  if (enforcedMax && finalFacets.length > enforcedMax) {
    finalFacets.length = enforcedMax;
  }

  synthesis = {
    ...synthesis,
    facets: finalFacets,
  };

  // Build faceted facts for generation
  // Original fact + faceted interpretation for this context
  const facetedWorldTruths: string[] = synthesis.facets
    .filter((f) => f.factId && f.interpretation)
    .map((f) => {
      const baseFact = factMap.get(f.factId);
      if (baseFact) {
        return `${baseFact.text} [FACET: ${f.interpretation}]`;
      }
      return f.interpretation;
    });

  // Generation constraints are always included verbatim (not faceted)
  // These are meta-instructions to the LLM, not in-universe facts
  const constraintTexts: string[] = generationConstraints.map((c) => c.text);

  // Combine: faceted world truths first, then verbatim constraints
  const facetedFacts: string[] = [...facetedWorldTruths, ...constraintTexts];

  return {
    synthesis,
    assembledTone,
    facetedFacts,
    resolvedWorldDynamics,
    usage: callResult.usage,
  };
}
