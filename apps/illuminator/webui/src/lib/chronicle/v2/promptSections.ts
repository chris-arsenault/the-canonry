/**
 * Chronicle V2 Prompt Sections
 *
 * Shared formatting helpers and section builders used by both
 * story and document prompt builders.
 */

import type {
  ChronicleGenerationContext,
  EntityContext,
  NarrativeEventContext,
  ChronicleTemporalContext,
  EraTemporalInfo,
} from "../../chronicleTypes";
import { collapseBidirectionalRelationships, type CollapsedRelationship } from "../selectionWizard";
import {
  type ProminenceScale,
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceLabelFromScale,
} from "@canonry/world-schema";
import type { V2SelectionResult } from "./types";

import type { EntityDirective } from "../../perspectiveSynthesizer";

// =============================================================================
// Entity Formatting
// =============================================================================

/**
 * Resolve a prominence value to a human-readable label.
 */
export function resolveProminenceLabel(
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

export function buildProminenceScaleForEntities(
  entities: Array<EntityContext | undefined>
): ProminenceScale {
  const values = entities
    .filter((e): e is EntityContext => Boolean(e))
    .map((e) => Number(e.prominence))
    .filter((value) => Number.isFinite(value));
  return buildProminenceScale(values, { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
}

export function formatEntityFull(e: EntityContext, scale: ProminenceScale): string {
  const desc = e.description || "(no description available)";
  const tags =
    e.tags && Object.keys(e.tags).length > 0
      ? Object.entries(e.tags)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")
      : null;

  const kindLabel = e.subtype ? `${e.kind}/${e.subtype}` : e.kind;
  const lines = [
    `Kind: ${kindLabel}`,
    `Prominence: ${resolveProminenceLabel(e.prominence, scale)}`,
    e.culture ? `Culture: ${e.culture}` : null,
    tags ? `Tags: ${tags}` : null,
    "",
    desc,
  ].filter((line) => line !== null);

  return lines.join("\n");
}

/**
 * Format a single entity briefly (for supporting characters).
 * Uses ### to nest under ## Supporting Characters section.
 */
export function formatEntityBrief(e: EntityContext, scale: ProminenceScale): string {
  const desc = e.description || "(no description available)";
  const briefKindLabel = e.subtype ? `${e.kind}/${e.subtype}` : e.kind;
  const cultureSuffix = e.culture ? `, Culture: ${e.culture}` : "";
  return `### ${e.name} (${briefKindLabel})
Prominence: ${resolveProminenceLabel(e.prominence, scale)}${cultureSuffix}
${desc}`;
}

// =============================================================================
// Relationship & Event Formatting
// =============================================================================

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
  const subjectLine = e.subjectName ? ` (subject: ${e.subjectName})` : "";
  const objectLine = e.objectName ? ` (object: ${e.objectName})` : "";
  const participantNames = e.participants?.map((p) => p.name).filter(Boolean) ?? [];
  const uniqueParticipants = Array.from(new Set(participantNames)).filter(
    (name) => name !== e.subjectName && name !== e.objectName
  );
  const participantsLine =
    uniqueParticipants.length > 0 ? ` (participants: ${uniqueParticipants.join(", ")})` : "";
  return `- [${e.eventKind}, ${significance}%] ${e.headline}${subjectLine}${objectLine}${participantsLine}`;
}

// =============================================================================
// Section Builders
// =============================================================================

/**
 * Build the world section of the prompt.
 * Contains world context only - style/tone guidance is handled separately.
 */
export function buildWorldSection(context: ChronicleGenerationContext): string {
  const lines = [`# World: ${context.worldName}`, context.worldDescription || ""].filter(Boolean);

  if (context.canonFacts && context.canonFacts.length > 0) {
    lines.push("");
    lines.push("Canon Facts:");
    lines.push(
      "(Facts marked with [FACET: ...] include a lens specific to this chronicle. Prioritize the facet - it shows how the universal truth applies to these particular entities and circumstances. The base fact provides context; the facet is your guide.)"
    );
    for (const fact of context.canonFacts) {
      lines.push(`- ${fact}`);
    }
  }

  return lines.join("\n");
}

/**
 * Build the data section (relationships + events).
 * Collapses bidirectional relationships into single entries with (mutual) indicator.
 */
export function buildDataSection(selection: V2SelectionResult): string {
  const lines: string[] = [];

  if (selection.relationships.length > 0) {
    const collapsed = collapseBidirectionalRelationships(selection.relationships);
    lines.push("# Relationships");
    for (const rel of collapsed) {
      lines.push(formatCollapsedRelationship(rel));
    }
  }

  if (selection.events.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("# TIMELINE");
    lines.push("## Events");
    for (const evt of selection.events) {
      lines.push(formatEvent(evt));
    }
  }

  return lines.join("\n");
}

/**
 * Build the temporal context section.
 * Provides era information and timeline context for the chronicle.
 */
export function buildTemporalSection(
  temporalContext: ChronicleTemporalContext | undefined,
  temporalNarrative: string | undefined
): string {
  if (!temporalContext && !temporalNarrative) return "";

  const lines: string[] = ["# Historical Context"];

  if (temporalContext) {
    const focal = temporalContext.focalEra;

    // Focal era name and summary
    lines.push(`## Era: ${focal.name}`);
    if (focal.summary) {
      lines.push(focal.summary);
    }

    // World timeline (natural language) - always show
    lines.push("");
    lines.push(buildWorldTimeline(temporalContext.allEras, focal.id));

    // Note about events from other eras
    if (temporalContext.isMultiEra) {
      lines.push("");
      lines.push(
        "Some events listed may be from earlier eras. Treat these as historical background that shaped the present, not as scenes to dramatize."
      );
    }
  }

  // Synthesized dynamics (from perspective synthesis)
  if (temporalNarrative) {
    lines.push("");
    lines.push("## Current Conditions");
    lines.push(temporalNarrative);
  }

  return lines.join("\n");
}

/**
 * Add "the" article to an era name, handling names that already start with "The".
 */
function withArticle(name: string): string {
  // If name starts with "The ", convert to lowercase "the "
  if (name.startsWith("The ")) {
    return "the " + name.slice(4);
  }
  return "the " + name;
}

/**
 * Build a natural language world timeline.
 * E.g., "The world passed through the Dawn Age, then the Age of Expansion. It now exists in the Clever Ice Age."
 */
function buildWorldTimeline(eras: EraTemporalInfo[], focalEraId: string): string {
  const sorted = [...eras].sort((a, b) => a.order - b.order);
  const focalIndex = sorted.findIndex((e) => e.id === focalEraId);

  if (focalIndex === -1) return "";

  const past = sorted.slice(0, focalIndex);
  const current = sorted[focalIndex];
  const future = sorted.slice(focalIndex + 1);

  const parts: string[] = [];

  if (past.length > 0) {
    const pastNames = past.map((e) => withArticle(e.name)).join(", then ");
    parts.push(`The world passed through ${pastNames}.`);
  }

  parts.push(`It now exists in ${withArticle(current.name)}.`);

  if (future.length > 0) {
    const futureNames = future.map((e) => withArticle(e.name)).join(", then ");
    parts.push(`${futureNames} ${future.length === 1 ? "lies" : "lie"} ahead.`);
  }

  return parts.join(" ");
}

/**
 * Build the name bank section.
 * Provides culture-appropriate names for invented characters.
 * This is practical data, not prose guidance.
 */
export function buildNameBankSection(
  nameBank: Record<string, string[]> | undefined,
  entities: EntityContext[]
): string {
  if (!nameBank || Object.keys(nameBank).length === 0) {
    return "";
  }

  const entityCultures = new Set(
    entities.map((e) => e.culture).filter((c): c is string => Boolean(c))
  );

  const lines: string[] = ["# Name Bank"];
  lines.push("Culture-appropriate names for invented characters:");

  // Cultures from entities first
  for (const cultureId of entityCultures) {
    if (nameBank[cultureId] && nameBank[cultureId].length > 0) {
      lines.push(`- ${cultureId}: ${nameBank[cultureId].join(", ")}`);
    }
  }

  // Any additional cultures in name bank
  for (const [cultureId, names] of Object.entries(nameBank)) {
    if (!entityCultures.has(cultureId) && names.length > 0) {
      lines.push(`- ${cultureId}: ${names.join(", ")}`);
    }
  }

  return lines.join("\n");
}

/**
 * Build the narrative voice section.
 * Renders the synthesized voice from perspective synthesis as key-value pairs.
 */
export function buildNarrativeVoiceSection(
  narrativeVoice: Record<string, string> | undefined
): string {
  if (!narrativeVoice || Object.keys(narrativeVoice).length === 0) {
    return "";
  }

  const lines: string[] = ["# Story Bible: Tone & Atmosphere"];
  lines.push("Reference notes on emotional texture — draw on these:");
  lines.push("");

  for (const [key, value] of Object.entries(narrativeVoice)) {
    lines.push(`**${key}**: ${value}`);
  }

  return lines.join("\n");
}

/**
 * Build the entity directives section.
 * Renders per-entity writing directives from perspective synthesis.
 */
export function buildEntityDirectivesSection(
  entityDirectives: EntityDirective[] | undefined
): string {
  if (!entityDirectives || entityDirectives.length === 0) {
    return "";
  }

  const lines: string[] = ["# Story Bible: Character Notes"];
  lines.push(
    "Background on relationships and history — bring alive through specificity, don't explain:"
  );
  lines.push("");

  for (const directive of entityDirectives) {
    lines.push(`**${directive.entityName}**: ${directive.directive}`);
  }

  return lines.join("\n");
}

/**
 * Build the narrative lens section.
 * Provides contextual framing from an intangible entity (rule, occurrence, ability)
 * that shapes the story without being a cast member.
 */
export function buildNarrativeLensSection(
  context: ChronicleGenerationContext,
  scale: ProminenceScale
): string {
  if (!context.lensEntity) {
    return "";
  }

  const entity = context.lensEntity;
  const desc = entity.description || entity.summary || "(no description available)";
  const tags =
    entity.tags && Object.keys(entity.tags).length > 0
      ? Object.entries(entity.tags)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")
      : null;

  const lensKindLabel = entity.subtype ? `${entity.kind}/${entity.subtype}` : entity.kind;
  const lensCultureSuffix = entity.culture ? `, Culture: ${entity.culture}` : "";
  const lines: string[] = ["# Narrative Lens"];
  lines.push("This story exists in the shadow of:");
  lines.push("");
  lines.push(`## ${entity.name} (${lensKindLabel})`);
  lines.push(
    `Prominence: ${resolveProminenceLabel(entity.prominence, scale)}${lensCultureSuffix}`
  );
  if (tags) lines.push(`Tags: ${tags}`);
  lines.push("");
  lines.push(desc);
  lines.push("");
  lines.push(
    "Lens Guidance: This entity is NOT a character in the story. It is the context — the constraint, the backdrop, the thing everyone knows but no one can change. It should be felt in characters' choices, in what is possible and impossible, in what goes unsaid. Reference it naturally, never explain it to the reader as if they don't know it."
  );

  return lines.join("\n");
}

// =============================================================================
// Narrative Direction (optional, from wizard)
// =============================================================================

/**
 * Build the narrative direction section.
 * Only emits content when narrativeDirection is present.
 * When empty/undefined, returns empty string — no prompt change.
 */
export function buildNarrativeDirectionSection(narrativeDirection: string | undefined): string {
  if (!narrativeDirection) return "";

  return `# Narrative Direction
This chronicle has a specific narrative purpose:
"${narrativeDirection}"
Write to fulfill this direction. Every structural and tonal choice should serve it.`;
}
