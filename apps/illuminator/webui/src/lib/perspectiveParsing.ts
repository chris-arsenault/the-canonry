/**
 * Parsing and enforcement helpers for perspective synthesis.
 *
 * Handles JSON parsing of LLM responses, facet requirement enforcement,
 * and faceted fact assembly.
 */

import type {
  CanonFactWithMetadata,
  EntityDirective,
  FactFacet,
  PerspectiveSynthesis,
  PerspectiveSynthesisInput,
} from "./perspectiveSynthesizer";

// =============================================================================
// Raw LLM response shape (for safe JSON.parse typing)
// =============================================================================

/** Shape of the raw JSON parsed from the LLM response text. */
interface RawSynthesisResponse {
  brief?: string;
  facets?: Array<{ factId?: string; interpretation?: string }>;
  suggestedMotifs?: unknown[];
  narrativeVoice?: unknown;
  entityDirectives?: unknown[];
  temporalNarrative?: unknown;
}

// =============================================================================
// Normalization helpers
// =============================================================================

function normalizeNarrativeVoice(raw: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string") {
        result[key] = value;
      }
    }
  }
  return result;
}

function normalizeEntityDirectives(raw: unknown): EntityDirective[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d: { entityId?: string; directive?: string }) => d.entityId && d.directive)
    .map((d: { entityId?: string; entityName?: string; directive?: string }) => ({
      entityId: d.entityId || "",
      entityName: d.entityName || "",
      directive: d.directive || "",
    }));
}

function normalizeFacets(raw: RawSynthesisResponse): FactFacet[] {
  if (!Array.isArray(raw.facets)) return [];
  return raw.facets.map((f) => ({
    factId: f.factId || "",
    interpretation: f.interpretation || "",
  }));
}

function normalizeMotifs(raw: RawSynthesisResponse): string[] {
  if (!Array.isArray(raw.suggestedMotifs)) return [];
  return raw.suggestedMotifs.filter((m): m is string => typeof m === "string");
}

// =============================================================================
// Response parsing
// =============================================================================

export function parseSynthesisResponse(rawText: string): PerspectiveSynthesis {
  try {
    const text = rawText.trim();
    // eslint-disable-next-line sonarjs/slow-regex -- bounded LLM response text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in response");
    }
    const parsed: RawSynthesisResponse = JSON.parse(jsonMatch[0]) as RawSynthesisResponse;

    if (!parsed.brief) {
      throw new Error("Missing brief in synthesis");
    }

    return {
      brief: parsed.brief,
      facets: normalizeFacets(parsed),
      suggestedMotifs: normalizeMotifs(parsed),
      narrativeVoice: normalizeNarrativeVoice(parsed.narrativeVoice),
      entityDirectives: normalizeEntityDirectives(parsed.entityDirectives),
      temporalNarrative:
        typeof parsed.temporalNarrative === "string" ? parsed.temporalNarrative : undefined,
    };
  } catch (err) {
    throw new Error(
      `Perspective synthesis failed to produce valid output: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// =============================================================================
// Facet enforcement
// =============================================================================

function computeEnforcedMax(
  requestedMax: number | undefined,
  requiredCount: number
): number | undefined {
  if (typeof requestedMax === "number" && requestedMax > 0) {
    return Math.max(requestedMax, requiredCount);
  }
  if (requiredCount > 6) {
    return requiredCount;
  }
  return undefined;
}

function collectFacetLookup(
  facets: FactFacet[]
): { facetsById: Map<string, string>; orderedFacetIds: string[] } {
  const facetsById = new Map<string, string>();
  const orderedFacetIds: string[] = [];
  for (const facet of facets) {
    if (!facet.factId || !facet.interpretation) continue;
    if (!facetsById.has(facet.factId)) {
      facetsById.set(facet.factId, facet.interpretation);
      orderedFacetIds.push(facet.factId);
    }
  }
  return { facetsById, orderedFacetIds };
}

function buildFallbackInterpretation(input: PerspectiveSynthesisInput): string {
  const focus = input.constellation?.focusSummary
    ? `In this ${input.constellation.focusSummary} chronicle, `
    : "In this chronicle, ";
  const era = input.focalEra?.name ? `set in the ${input.focalEra.name} era, ` : "";
  return `${focus}${era}this truth is foregrounded, shaping the stakes and how the entities interpret events.`;
}

export function enforceFacetRequirements(
  synthesis: PerspectiveSynthesis,
  input: PerspectiveSynthesisInput
): PerspectiveSynthesis {
  const worldTruthFacts = (input.factsWithMetadata || []).filter(
    (f) => f.type !== "generation_constraint" && !f.disabled
  );
  const requiredIds = worldTruthFacts
    .filter((f) => f.required)
    .map((f) => f.id)
    .filter(Boolean);

  const enforcedMax = computeEnforcedMax(input.factSelection?.maxCount, requiredIds.length);
  const { facetsById, orderedFacetIds } = collectFacetLookup(synthesis.facets);
  const fallback = buildFallbackInterpretation(input);

  const finalFacets: FactFacet[] = [];
  const addedIds = new Set<string>();

  for (const requiredId of requiredIds) {
    finalFacets.push({ factId: requiredId, interpretation: facetsById.get(requiredId) || fallback });
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

  return { ...synthesis, facets: finalFacets };
}

// =============================================================================
// Faceted facts assembly
// =============================================================================

export function buildFacetedFacts(
  synthesis: PerspectiveSynthesis,
  factsWithMetadata: CanonFactWithMetadata[],
  generationConstraints: CanonFactWithMetadata[]
): string[] {
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

  const constraintTexts: string[] = generationConstraints.map((c) => c.text);
  return [...facetedWorldTruths, ...constraintTexts];
}
