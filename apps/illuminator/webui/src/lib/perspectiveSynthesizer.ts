/**
 * Perspective Synthesizer
 *
 * Synthesizes a world perspective brief from entity constellation analysis.
 * Uses LLM to generate a focused perspective that adjusts emphasis while
 * maintaining world coherence.
 */

import type { LLMClient } from './llmClient';
import type { EntityContext, EraContext } from './chronicleTypes';
import type { EntityConstellation } from './constellationAnalyzer';
import type { ResolvedLLMCallConfig } from './llmModelSettings';
import type { NarrativeStyle } from '@canonry/world-schema';
import { runTextCall } from './llmTextCall';

// =============================================================================
// Types
// =============================================================================

/**
 * Fact type determines how the fact is used in generation.
 */
export type FactType = 'world_truth' | 'generation_constraint';

/**
 * Canon fact with relevance metadata for perspective synthesis.
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

  // Relevance signals (only used for world_truth facts)
  relevantCultures: string[]; // ["nightshelf", "aurora_stack", "*"]
  relevantKinds: string[]; // ["artifact", "npc", "*"]
  relevantTags: string[]; // ["trade", "conflict", "magic"]
  relevantRelationships: string[]; // ["ally", "rival", "trade_partner"]

  // Base priority (0-1) - higher = more likely to be foregrounded
  basePriority: number;
}

/**
 * Tone fragments - just core prose style.
 */
export interface ToneFragments {
  core: string;
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
}

/**
 * Full result including LLM usage
 */
export interface PerspectiveSynthesisResult {
  synthesis: PerspectiveSynthesis;
  assembledTone: string;
  /** All facts formatted for generation - core facts with faceted interpretations first */
  facetedFacts: string[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    actualCost: number;
  };
}

// =============================================================================
// LLM Synthesis
// =============================================================================

const SYSTEM_PROMPT = `You are a perspective consultant for a fantasy chronicle series. Your job is to help each chronicle feel like a distinct window into the same world - not a different world, but a different FACET of the same truths.

You will receive:
1. NARRATIVE STYLE: What kind of story this is and how it should be written
2. BASELINE MATERIAL: Core tone, world facts, cultural identities, entity portrayal guidelines, and world dynamics
3. CONSTELLATION ANALYSIS: What cultures, entity types, themes, and dynamics are present
4. ENTITIES: The specific characters, places, etc. in this chronicle

Your task:
- Consider the NARRATIVE STYLE, CULTURAL IDENTITIES, and WORLD DYNAMICS when faceting
- FACET the world facts - for each selected fact, provide a short interpretation showing how it applies to THIS chronicle
- Keep interpretations to 1-2 sentences - they will be appended to the original fact
- Synthesize a NARRATIVE VOICE that blends the cultural identities and narrative style into prose-level writing guidance. Choose 3-6 keys that capture the most important dimensions of how this chronicle should read (e.g., VOICE, TENSION, WHAT_IS_UNSAID, PHYSICALITY, CLOSURE - but choose keys that fit THIS chronicle)
- Generate ENTITY DIRECTIVES for each entity, pre-applying their culture's traits (speech, values, fears, taboos) and their kind's portrayal guidelines into 1-3 sentences of concrete writing guidance

IMPORTANT: Output ONLY valid JSON. No markdown, no explanation, no commentary.`;

function buildUserPrompt(input: PerspectiveSynthesisInput): string {
  const { constellation, entities, focalEra, toneFragments, culturalIdentities, factsWithMetadata, narrativeStyle, proseHints, worldDynamics } = input;

  // Entity summaries
  const entitySummaries = entities
    .slice(0, 10)
    .map((e) => {
      const tags = e.tags && Object.keys(e.tags).length > 0
        ? ` [${Object.entries(e.tags).map(([k, v]) => `${k}=${v}`).join(', ')}]`
        : '';
      return `- ${e.name} (${e.kind}, ${e.culture || 'unknown'})${tags}: ${e.summary || '(no summary)'}`;
    })
    .join('\n');

  // All world truth facts (not generation constraints)
  const worldTruthFacts = (factsWithMetadata || [])
    .filter((f) => f.type !== 'generation_constraint')
    .map((f) => `- [${f.id}]: ${f.text}`)
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

  // Narrative style context
  let narrativeStyleDisplay = 'No specific narrative style.';
  if (narrativeStyle) {
    const styleParts = [
      `Name: ${narrativeStyle.name}`,
      `Format: ${narrativeStyle.format}`,
      narrativeStyle.description ? `Description: ${narrativeStyle.description}` : null,
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

  // World dynamics — filter to relevant cultures/kinds
  let worldDynamicsDisplay = 'No world dynamics declared.';
  if (worldDynamics && worldDynamics.length > 0) {
    const entityKindsSet = new Set(entities.map(e => e.kind));
    const relevantDynamics = worldDynamics.filter((d) => {
      const cultureMatch = !d.cultures || d.cultures.length === 0 ||
        d.cultures.includes('*') ||
        d.cultures.some((c) => presentCultureIds.includes(c));
      const kindMatch = !d.kinds || d.kinds.length === 0 ||
        d.kinds.includes('*') ||
        d.kinds.some((k) => entityKindsSet.has(k));
      return cultureMatch && kindMatch;
    });
    if (relevantDynamics.length > 0) {
      const focalEraId = focalEra?.id;
      worldDynamicsDisplay = relevantDynamics.map((d) => {
        let text = d.text;
        if (focalEraId && d.eraOverrides?.[focalEraId]) {
          const override = d.eraOverrides[focalEraId];
          text = override.replace ? override.text : `${d.text} ${override.text}`;
        }
        return `- ${text}`;
      }).join('\n');
    }
  }

  return `=== NARRATIVE STYLE ===
${narrativeStyleDisplay}

=== BASELINE MATERIAL ===

CORE TONE (applies to all chronicles):
${toneFragments.core}

WORLD FACTS (truths about this world):
${worldTruthFacts}

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

=== YOUR TASK ===

Based on the narrative style, constellation, and cultural identities above, create a perspective for this chronicle.

Provide a JSON object with:

1. "brief": A perspective brief (150-200 words) describing what lens this chronicle should view the world through. Consider both the narrative style and the cultural identities of present cultures.

2. "facets": Select 4-6 facts most relevant to this chronicle. For each, provide a 1-2 sentence interpretation explaining how this fact specifically manifests or matters for the entities and story type in this chronicle. The original fact will be included; your interpretation adds the specific lens.

3. "suggestedMotifs": 2-3 short phrases that might echo through this chronicle.

4. "narrativeVoice": A synthesized prose voice for this chronicle. Blend the cultural identities of present cultures with the narrative style into 3-6 key-value pairs. Choose keys that capture the most important dimensions of how this chronicle should read (e.g., VOICE, TENSION, WHAT_IS_UNSAID, PHYSICALITY, CLOSURE - but choose keys that fit THIS chronicle). Values should be 1-2 sentences of concrete prose guidance.

5. "entityDirectives": For each entity listed above, provide 1-3 sentences of concrete writing guidance. Pre-apply that entity's cultural traits (speech patterns, values, fears, taboos) and their kind's portrayal guidelines into specific direction for how to write this entity. Include entityId, entityName, and directive.

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
  ]
}`;
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
    (f) => f.type === 'generation_constraint'
  );

  // Build prompt with ALL baseline material - let LLM do the refinement
  const userPrompt = buildUserPrompt(input);

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

    synthesis = {
      brief: parsed.brief,
      facets,
      suggestedMotifs,
      narrativeVoice,
      entityDirectives,
    };
  } catch (err) {
    throw new Error(
      `Perspective synthesis failed to produce valid output: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Build faceted facts for generation
  // Original fact + faceted interpretation for this context
  const factMap = new Map(factsWithMetadata.map((f) => [f.id, f]));
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
    usage: callResult.usage,
  };
}
