/**
 * Chronicle V2 Prompt Builder
 *
 * Single-shot prompt construction for both story and document formats.
 * Includes full narrative style fidelity - structure, scenes, cast rules, etc.
 *
 * Split into modules:
 * - promptSections.ts: Shared formatting helpers and section builders
 * - documentPrompt.ts: Document format prompt construction
 * - creativePrompt.ts: Creative freedom mode prompt construction
 */

import type { ChronicleGenerationContext } from "../../chronicleTypes";
import {
  type NarrativeStyle,
  type StoryNarrativeStyle,
  type ProminenceScale,
} from "@canonry/world-schema";
import type { V2SelectionResult } from "./types";
import {
  formatEntityFull,
  formatEntityBrief,
  buildProminenceScaleForEntities,
  buildWorldSection,
  buildDataSection,
  buildTemporalSection,
  buildNameBankSection,
  buildNarrativeVoiceSection,
  buildEntityDirectivesSection,
  buildNarrativeLensSection,
  buildNarrativeDirectionSection,
} from "./promptSections";
import { buildDocumentPrompt, getDocumentWordCount } from "./documentPrompt";

// =============================================================================
// Story Format - Structure & Style Building
// =============================================================================

/**
 * Build the narrative structure section for story format.
 * Uses the unified narrativeInstructions field.
 */
function buildStoryStructureSection(style: StoryNarrativeStyle): string {
  const lines: string[] = ["# Narrative Structure"];

  // Scene count guidance
  if (style.pacing?.sceneCount) {
    lines.push(`Target: ${style.pacing.sceneCount.min}-${style.pacing.sceneCount.max} scenes`);
    lines.push("");
  }

  // Narrative instructions (plot structure, scenes, beats, emotional arcs)
  if (style.narrativeInstructions) {
    lines.push(style.narrativeInstructions);
  }

  return lines.join("\n");
}

/**
 * Build the unified cast section for story format.
 * Combines role expectations with character data so the LLM sees roles and characters together.
 */
export function buildUnifiedCastSection(
  selection: V2SelectionResult,
  primaryEntityIds: Set<string>,
  style: StoryNarrativeStyle,
  prominenceScale: ProminenceScale
): string {
  const lines: string[] = [`# Cast (${selection.entities.length} characters)`];
  lines.push("");
  lines.push(
    "**Temporal context**: Entity descriptions reflect their CURRENT state — who they became, how they ended up. This chronicle depicts PAST EVENTS when characters who are now dead/changed were alive and active. Write them as they WERE during the story, not as they ARE now."
  );

  // Role expectations first - so LLM knows what to look for
  if (style.roles && style.roles.length > 0) {
    lines.push("");
    lines.push("## Narrative Roles");
    lines.push("Assign characters from below to these roles:");
    for (const role of style.roles) {
      const countStr =
        role.count.min === role.count.max
          ? `${role.count.min}`
          : `${role.count.min}-${role.count.max}`;
      lines.push(`- **${role.role}** (${countStr}): ${role.description}`);
    }
  }

  // Primary characters
  const primaryEntities = selection.entities.filter((e) => primaryEntityIds.has(e.id));
  const supportingEntities = selection.entities.filter((e) => !primaryEntityIds.has(e.id));

  if (primaryEntities.length > 0) {
    lines.push("");
    lines.push("## Primary Characters");
    for (const entity of primaryEntities) {
      lines.push("");
      lines.push(`### ${entity.name}`);
      lines.push(formatEntityFull(entity, prominenceScale));
    }
  }

  // Supporting characters
  if (supportingEntities.length > 0) {
    lines.push("");
    lines.push("## Supporting Characters");
    for (const entity of supportingEntities) {
      lines.push("");
      lines.push(formatEntityBrief(entity, prominenceScale));
    }
  }

  return lines.join("\n");
}

/**
 * Build the event usage section for story format.
 */
export function buildEventUsageSection(style: StoryNarrativeStyle): string {
  if (!style.eventInstructions) {
    return "";
  }

  return `# How to Use Events
${style.eventInstructions}`;
}

/**
 * Build the unified style section for story format.
 * Combines world tone/voice guidance with prose instructions from the narrative style.
 * This is the single location for all writing style guidance.
 */
export function buildUnifiedStyleSection(
  tone: string | undefined,
  style: StoryNarrativeStyle
): string {
  const lines: string[] = [`# Writing Style`];
  let hasContent = false;

  // World tone/voice guidance (may contain detailed style instructions)
  if (tone) {
    lines.push("");
    lines.push(tone);
    hasContent = true;
  }

  // Prose instructions from narrative style (tone, dialogue, description, world elements, avoid)
  if (style.proseInstructions) {
    if (hasContent) lines.push("");
    lines.push(`## Prose: ${style.name}`);
    lines.push(style.proseInstructions);
    hasContent = true;
  }

  // Craft posture - authorial density and restraint constraints
  if (style.craftPosture) {
    if (hasContent) lines.push("");
    lines.push(`## Craft Posture`);
    lines.push("How to relate to the material — density, withholding, and elaboration:");
    lines.push(style.craftPosture);
    hasContent = true;
  }

  return hasContent ? lines.join("\n") : "";
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
  style: StoryNarrativeStyle,
  prominenceScale: ProminenceScale
): string {
  const pacing = style.pacing;
  const wordRange = `${pacing.totalWordCount.min}-${pacing.totalWordCount.max}`;
  const sceneRange = pacing.sceneCount
    ? `${pacing.sceneCount.min}-${pacing.sceneCount.max}`
    : "4-5";

  // === TASK DATA ===

  // 1. TASK
  const taskSection = `# Task
Write a ${wordRange} word piece of engaging fantasy fiction in ${sceneRange} distinct scenes.

Your goal: A story that readers remember — with characters they care about, moments that land, and prose that moves. The world exists through what characters notice and feel, not through explanation.

Requirements:
- Assign the provided characters to the narrative roles defined below
- Follow the plot structure and scene progression
- Incorporate the listed events as lived moments, not reported history
- Use the research notes as inspiration for how characters relate
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
  const castSection = buildUnifiedCastSection(selection, primaryEntityIds, style, prominenceScale);

  // 7b. NARRATIVE LENS (contextual frame entity)
  const lensSection = buildNarrativeLensSection(context, prominenceScale);

  // 8. WORLD (setting context only, no style)
  const worldSection = buildWorldSection(context);

  // 9. NAME BANK (practical data)

  // 10. HISTORICAL CONTEXT
  const temporalSection = buildTemporalSection(context.temporalContext, context.temporalNarrative);

  // 11 & 12. RELATIONSHIPS + EVENTS
  const dataSection = buildDataSection(selection);

  // NARRATIVE DIRECTION (optional, between task and structure)
  const narrativeDirectionSection = buildNarrativeDirectionSection(context.narrativeDirection);

  // Combine sections in order: TASK DATA then WORLD DATA
  const sections = [
    // TASK DATA
    taskSection,
    narrativeDirectionSection,
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

  return sections.join("\n\n");
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
  const primaryEntityIds = new Set(context.focus?.primaryEntityIds ?? []);
  const narrativeVoiceSection = buildNarrativeVoiceSection(context.narrativeVoice);
  const entityDirectivesSection = buildEntityDirectivesSection(context.entityDirectives);
  const nameBankSection = buildNameBankSection(context.nameBank, selection.entities);
  const prominenceScale = buildProminenceScaleForEntities([
    ...selection.entities,
    context.lensEntity,
  ]);

  if (style.format === "story") {
    return buildStoryPrompt(
      context,
      selection,
      primaryEntityIds,
      narrativeVoiceSection,
      entityDirectivesSection,
      nameBankSection,
      style,
      prominenceScale
    );
  } else {
    return buildDocumentPrompt(
      context,
      selection,
      primaryEntityIds,
      narrativeVoiceSection,
      entityDirectivesSection,
      nameBankSection,
      style,
      prominenceScale
    );
  }
}

/**
 * Get max tokens based on word count target.
 * Rough estimate: 1 token ~= 0.75 words, plus buffer.
 */
export function getMaxTokensFromStyle(style: NarrativeStyle): number {
  const maxWords =
    style.format === "story"
      ? style.pacing.totalWordCount.max
      : getDocumentWordCount(style).max;

  // Add 50% buffer for safety, but never go below a practical minimum.
  const minAutoMaxTokens = 1024;
  const estimated = Math.ceil((maxWords / 0.75) * 1.5);
  return Math.max(estimated, minAutoMaxTokens);
}

/**
 * Get the system prompt for V2 generation.
 * Describes prompt structure and establishes guidance hierarchy.
 */
export function getV2SystemPrompt(style: NarrativeStyle): string {
  if (style.format === "story") {
    return getStorySystemPrompt();
  }
  return getDocumentSystemPrompt();
}

function getStorySystemPrompt(): string {
  return `You are an expert fantasy author writing engaging fiction. Your readers expect vivid characters, emotional truth, and prose that lands.

Your prompt contains:

CRAFT (how to write):
- Narrative Structure: Your beat sheet — scene progression and emotional shape
- Writing Style: Prose craft specific to this story type, including craft posture (density and restraint constraints)

STORY BIBLE (background reference, not requirements):
- Tone & Atmosphere: Notes on emotional texture
- Character Notes: Relationships and history — bring alive through specificity

WORLD DATA (what to write about):
- Cast: Characters to bring alive — descriptions show their FINAL state, but you're writing PAST EVENTS when they were alive/active
- Narrative Lens (optional): A contextual entity that shapes the story without being a character
- World: Setting context and canon facts
- Historical Context: Era, timeline, and current conditions that shape what's possible
- Events: What happened — show these through character experience, don't document them

CRITICAL: Entity descriptions reflect who characters BECAME. Write them as they WERE during the story's events. A character described as dead was alive when your story takes place.

Craft defines how to write; Story Bible is background reference. The world exists through what characters notice, do, and feel.`;
}

function getDocumentSystemPrompt(): string {
  return `You are crafting an in-universe document that feels authentic and alive. Your prompt contains:

CRAFT (how to write):
- Document Instructions: Structure, voice, tone - THIS DEFINES YOUR DOCUMENT
- Perspective: This chronicle's thematic angle and suggested motifs

STORY BIBLE (background reference):
- Tone & Atmosphere: Notes on emotional texture
- Character Notes: Relationships and history

WORLD DATA (what to write about):
- Cast: Characters referenced — descriptions show their FINAL state, but the document may depict PAST EVENTS when they were alive/active
- Narrative Lens (optional): A contextual entity that shapes the document's assumptions
- World: Setting context and canon facts
- Historical Context: Era, timeline, and current conditions that shape what's possible
- Events: What happened — reference naturally, don't list

CRITICAL: Entity descriptions reflect who characters BECAME. If depicting past events, write them as they WERE during those events.

Document Instructions define the document's structure and format — they are primary. The Perspective provides thematic focus, not prose style. Write as the document's author would write, not as a storyteller.

Write authentically as if the document exists within the world. No meta-commentary.`;
}
