/**
 * Perspective Synthesizer
 *
 * Synthesizes a world perspective brief from entity constellation analysis.
 * Uses LLM to generate a focused perspective that adjusts emphasis while
 * maintaining world coherence.
 */

import type { LLMClient } from "./llmClient";
import type { EntityContext, EraContext, ChronicleRoleAssignment } from "./chronicleTypes";
import type { EntityConstellation } from "./constellationAnalyzer";
import type { ResolvedLLMCallConfig } from "./llmModelSettings";
import type { NarrativeStyle } from "@canonry/world-schema";
import { runTextCall } from "./llmTextCall";
import { buildUserPrompt } from "./perspectivePromptHelpers";
import { parseSynthesisResponse, enforceFacetRequirements, buildFacetedFacts } from "./perspectiveParsing";

// =============================================================================
// Types
// =============================================================================

/**
 * Fact type determines how the fact is used in generation.
 */
export type FactType = "world_truth" | "generation_constraint";

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
  /** If true, this fact is excluded from perspective synthesis and generation prompts. */
  disabled?: boolean;
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
    (f) => f.type === "generation_constraint" && !f.disabled
  );

  // Build prompt with ALL baseline material - let LLM do the refinement
  const { prompt: userPrompt, resolvedWorldDynamics } = buildUserPrompt(input);

  // Assembled tone is the core tone fragment
  const assembledTone = toneFragments.core;

  // Make LLM call
  const callResult = await runTextCall({
    llmClient,
    callType: "perspective.synthesis",
    callConfig,
    systemPrompt: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.7, // Allow variation
  });

  // Parse response
  const synthesis = parseSynthesisResponse(callResult.result.text);

  // Enforce required facts and finalize
  const enforcedSynthesis = enforceFacetRequirements(synthesis, input);

  // Build faceted facts for generation
  const facetedFacts = buildFacetedFacts(enforcedSynthesis, factsWithMetadata, generationConstraints);

  return {
    synthesis: enforcedSynthesis,
    assembledTone,
    facetedFacts,
    resolvedWorldDynamics,
    usage: callResult.usage,
  };
}
