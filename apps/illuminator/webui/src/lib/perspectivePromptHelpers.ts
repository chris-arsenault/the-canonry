/**
 * Prompt-building helpers for perspective synthesis.
 *
 * Extracted from perspectiveSynthesizer.ts to reduce file size and
 * per-function complexity.
 */

import type { EntityContext, EraContext, ChronicleRoleAssignment } from "./chronicleTypes";
import type { EntityConstellation } from "./constellationAnalyzer";
import type {
  CanonFactWithMetadata,
  FactSelectionConfig,
  PerspectiveSynthesisInput,
} from "./perspectiveSynthesizer";
import {
  type NarrativeStyle,
  type ProminenceScale,
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceLabelFromScale,
} from "@canonry/world-schema";

// =============================================================================
// Primitive helpers
// =============================================================================

const normalizeToken = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

function resolveProminenceLabel(
  value: EntityContext["prominence"] | number | undefined,
  scale: ProminenceScale
): string {
  if (value == null) return "unknown";
  if (typeof value === "number") {
    return prominenceLabelFromScale(value, scale);
  }
  const trimmed = String(value).trim();
  if (!trimmed) return "unknown";
  if (scale.labels.includes(trimmed)) return trimmed;
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return prominenceLabelFromScale(numeric, scale);
  }
  return trimmed;
}

// =============================================================================
// Display builders
// =============================================================================

function buildEntitySummaries(
  entities: EntityContext[],
  prominenceScale: ProminenceScale,
  roleByEntityId: Map<string, { role: string; isPrimary: boolean }>
): string {
  return entities
    .slice(0, 10)
    .map((e) => {
      const tags =
        e.tags && Object.keys(e.tags).length > 0
          ? ` [${Object.entries(e.tags)
              .map(([k, v]) => `${k}=${v}`)
              .join(", ")}]`
          : "";
      const prominenceLabel = resolveProminenceLabel(e.prominence, prominenceScale);
      const assignment = roleByEntityId.get(e.id);
      let roleLabel = "";
      if (assignment) {
        const primarySuffix = assignment.isPrimary ? " (primary)" : "";
        roleLabel = `, role: ${assignment.role}${primarySuffix}`;
      }
      return `- ${e.name} (${e.kind}, ${e.culture || "unknown"}, ${prominenceLabel}${roleLabel})${tags}: ${e.summary || "(no summary)"}`;
    })
    .join("\n");
}

function buildCulturalIdentitiesDisplay(
  culturalIdentities: Record<string, Record<string, string>> | undefined,
  presentCultureIds: string[]
): string {
  if (!culturalIdentities || presentCultureIds.length === 0) {
    return "No cultural identities provided.";
  }
  const presentIdentities = presentCultureIds
    .filter((id) => culturalIdentities[id])
    .map((cultureId) => {
      const traits = culturalIdentities[cultureId];
      const traitLines = Object.entries(traits)
        .map(([key, value]) => `  ${key}: ${value}`)
        .join("\n");
      return `## ${cultureId}\n${traitLines}`;
    });
  return presentIdentities.length > 0
    ? presentIdentities.join("\n\n")
    : "No cultural identities provided.";
}

function buildNarrativeStyleDisplay(narrativeStyle: NarrativeStyle | undefined): string {
  if (!narrativeStyle) return "No specific narrative style.";
  const styleParts = [
    `Name: ${narrativeStyle.name}`,
    `Format: ${narrativeStyle.format}`,
    narrativeStyle.description ? `Description: ${narrativeStyle.description}` : null,
    narrativeStyle.tags?.length ? `Tags: ${narrativeStyle.tags.join(", ")}` : null,
    narrativeStyle.proseInstructions
      ? `\nProse guidance:\n${narrativeStyle.proseInstructions}`
      : null,
    narrativeStyle.craftPosture
      ? `\nCraft posture (density and restraint):\n${narrativeStyle.craftPosture}`
      : null,
  ].filter(Boolean);
  return styleParts.join("\n");
}

function buildProseHintsDisplay(
  proseHints: Record<string, string> | undefined,
  entityKinds: Set<string>
): string {
  if (!proseHints || Object.keys(proseHints).length === 0) {
    return "No entity portrayal guidelines provided.";
  }
  const relevantHints = Object.entries(proseHints)
    .filter(([kind]) => entityKinds.has(kind))
    .map(([kind, hint]) => `  ${kind}: ${hint}`);
  return relevantHints.length > 0
    ? relevantHints.join("\n")
    : "No entity portrayal guidelines provided.";
}

// =============================================================================
// Fact selection
// =============================================================================

function computeDefaultFactSelection(): {
  factSelectionLine: string;
  facetSelectionInstruction: string;
} {
  return {
    factSelectionLine: "Fact selection target: default (4-6). Required facts must still be included.",
    facetSelectionInstruction: "Select 4-6",
  };
}

function computeCustomFactSelection(
  requestedMin: number | undefined,
  requestedMax: number | undefined,
  requiredFactCount: number
): { factSelectionLine: string; facetSelectionInstruction: string } {
  const effectiveMin = Math.max(requestedMin ?? 4, requiredFactCount);
  const effectiveMax = Math.max(requestedMax ?? effectiveMin ?? 6, effectiveMin ?? requiredFactCount);

  if (effectiveMin === effectiveMax) {
    return {
      factSelectionLine: `Fact selection target: exactly ${effectiveMin} (required facts count toward this).`,
      facetSelectionInstruction: `Select exactly ${effectiveMin}`,
    };
  }
  return {
    factSelectionLine: `Fact selection target: ${effectiveMin}-${effectiveMax} (required facts count toward this).`,
    facetSelectionInstruction: `Select ${effectiveMin}-${effectiveMax}`,
  };
}

export function computeFactSelectionDisplay(
  factSelection: FactSelectionConfig | undefined,
  requiredFactCount: number
): { factSelectionLine: string; facetSelectionInstruction: string } {
  const requestedMin = factSelection?.minCount;
  const requestedMax = factSelection?.maxCount;
  const hasCustomRange =
    (typeof requestedMin === "number" && requestedMin > 0) ||
    (typeof requestedMax === "number" && requestedMax > 0);

  if (!hasCustomRange) {
    return computeDefaultFactSelection();
  }
  return computeCustomFactSelection(requestedMin, requestedMax, requiredFactCount);
}

// =============================================================================
// World dynamics resolution
// =============================================================================

export function resolveWorldDynamics(
  input: PerspectiveSynthesisInput
): Array<{ id: string; text: string }> {
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
        cultures.includes("*") ||
        cultures.some(
          (c) => presentCultureIds.includes(c) || cultureTokenSet.has(normalizeToken(c))
        );

      const kindMatch =
        kinds.length === 0 ||
        kinds.includes("*") ||
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

// =============================================================================
// Prompt assembly
// =============================================================================

function buildRoleLookup(
  roleAssignments: ChronicleRoleAssignment[] | undefined
): Map<string, { role: string; isPrimary: boolean }> {
  const roleByEntityId = new Map<string, { role: string; isPrimary: boolean }>();
  if (roleAssignments) {
    for (const ra of roleAssignments) {
      roleByEntityId.set(ra.entityId, { role: ra.role, isPrimary: ra.isPrimary });
    }
  }
  return roleByEntityId;
}

interface PromptSections {
  entitySummaries: string;
  worldTruthFactsDisplay: string;
  requiredFacts: CanonFactWithMetadata[];
  presentCultureIds: string[];
  culturalIdentitiesDisplay: string;
  narrativeStyleDisplay: string;
  proseHintsDisplay: string;
  worldDynamicsDisplay: string;
  resolvedWorldDynamics: Array<{ id: string; text: string }>;
  factSelectionLine: string;
  facetSelectionInstruction: string;
}

function buildPromptSections(input: PerspectiveSynthesisInput): PromptSections {
  const {
    constellation,
    entities,
    culturalIdentities,
    factsWithMetadata,
    narrativeStyle,
    proseHints,
    factSelection,
    roleAssignments,
  } = input;

  const prominenceScale = buildProminenceScale(
    entities.map((e) => Number(e.prominence)).filter((value) => Number.isFinite(value)),
    { distribution: DEFAULT_PROMINENCE_DISTRIBUTION }
  );

  const roleByEntityId = buildRoleLookup(roleAssignments);
  const entitySummaries = buildEntitySummaries(entities, prominenceScale, roleByEntityId);

  const worldTruthFacts = (factsWithMetadata || []).filter(
    (f) => f.type !== "generation_constraint" && !f.disabled
  );
  const requiredFacts = worldTruthFacts.filter((f) => f.required);
  const worldTruthFactsDisplay = worldTruthFacts
    .map((f) => `- [${f.id}]${f.required ? " (REQUIRED)" : ""}: ${f.text}`)
    .join("\n");

  const presentCultureIds = Object.keys(constellation.cultures);
  const culturalIdentitiesDisplay = buildCulturalIdentitiesDisplay(culturalIdentities, presentCultureIds);
  const narrativeStyleDisplay = buildNarrativeStyleDisplay(narrativeStyle);
  const entityKinds = new Set(entities.map((e) => e.kind));
  const proseHintsDisplay = buildProseHintsDisplay(proseHints, entityKinds);

  const resolvedWorldDynamics = resolveWorldDynamics(input);
  const worldDynamicsDisplay =
    resolvedWorldDynamics.length > 0
      ? resolvedWorldDynamics.map((d) => `- ${d.text}`).join("\n")
      : "No world dynamics declared.";

  const { factSelectionLine, facetSelectionInstruction } = computeFactSelectionDisplay(
    factSelection,
    requiredFacts.length
  );

  return {
    entitySummaries,
    worldTruthFactsDisplay,
    requiredFacts,
    presentCultureIds,
    culturalIdentitiesDisplay,
    narrativeStyleDisplay,
    proseHintsDisplay,
    worldDynamicsDisplay,
    resolvedWorldDynamics,
    factSelectionLine,
    facetSelectionInstruction,
  };
}

function buildConstellationBlock(
  constellation: EntityConstellation,
  presentCultureIds: string[],
  focalEra: EraContext | undefined,
  entitySummaries: string
): string {
  return `=== THIS CHRONICLE'S CONSTELLATION ===

Summary: ${constellation.focusSummary}
Cultures present: ${presentCultureIds.join(", ") || "mixed/unknown"}
Culture balance: ${constellation.cultureBalance}${constellation.dominantCulture ? ` (dominant: ${constellation.dominantCulture})` : ""}
Entity types: ${Object.entries(constellation.kinds)
    .map(([k, v]) => `${k}(${v})`)
    .join(", ")}
Prominent themes: ${constellation.prominentTags.join(", ") || "none identified"}
Relationship kinds: ${
    Object.entries(constellation.relationshipKinds)
      .map(([k, v]) => `${k}(${v})`)
      .join(", ") || "none"
  }
Era: ${focalEra?.name || "unspecified"}

ENTITIES IN THIS CHRONICLE:
${entitySummaries}`;
}

function buildTaskBlock(facetSelectionInstruction: string): string {
  return `=== YOUR TASK ===

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
}`;
}

export function buildUserPrompt(input: PerspectiveSynthesisInput): {
  prompt: string;
  resolvedWorldDynamics: Array<{ id: string; text: string }>;
} {
  const { constellation, focalEra, toneFragments, narrativeDirection } = input;
  const sections = buildPromptSections(input);

  const narrativeDirectionBlock = narrativeDirection
    ? `\n=== NARRATIVE DIRECTION (PRIMARY CONSTRAINT) ===
The author has specified this concrete direction for the chronicle:
"${narrativeDirection}"

Your perspective brief, entity directives, motifs, and fact facets must all serve this specific narrative. Treat this as the organizing thesis — every synthesis decision should support it.\n`
    : "";

  const constellationBlock = buildConstellationBlock(
    constellation,
    sections.presentCultureIds,
    focalEra,
    sections.entitySummaries
  );

  const requiredFactsLine =
    sections.requiredFacts.length > 0
      ? `Required facts: ${sections.requiredFacts.map((f) => f.id).join(", ")}`
      : "Required facts: none";

  const taskBlock = buildTaskBlock(sections.facetSelectionInstruction);

  return {
    resolvedWorldDynamics: sections.resolvedWorldDynamics,
    prompt: `=== NARRATIVE STYLE ===
${sections.narrativeStyleDisplay}
${narrativeDirectionBlock}
=== BASELINE MATERIAL ===

CORE TONE (applies to all chronicles):
${toneFragments.core}

WORLD FACTS (truths about this world):
${sections.worldTruthFactsDisplay || "No world facts provided."}

CULTURAL IDENTITIES (for cultures present in this chronicle):
${sections.culturalIdentitiesDisplay}

ENTITY PORTRAYAL GUIDELINES (per entity kind):
${sections.proseHintsDisplay}

WORLD DYNAMICS (narrative context about inter-group forces and behaviors):
${sections.worldDynamicsDisplay}

${constellationBlock}

=== FACT SELECTION ===
${sections.factSelectionLine}
${requiredFactsLine}

${taskBlock}`,
  };
}
