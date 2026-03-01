/**
 * Chronicle V2 Creative Freedom Mode
 *
 * Fully separate prompt from the structured prompt - intentional duplication.
 * Same PS outputs, same world data, same entity selection. The difference is
 * purely in how the generation prompt frames and presents the material.
 *
 * Key differences from structured (getV2SystemPrompt):
 * - Fiction writer identity focused on finding the specific, haunting detail
 * - Creative target ("one image the reader won't forget") instead of requirements list
 * - Structure presented as a starting shape, not a prescription
 * - Same craft posture as structured -- constraints fuel creativity, not freedom
 */

import type { ChronicleGenerationContext } from "../../chronicleTypes";
import type { StoryNarrativeStyle } from "@canonry/world-schema";
import type { V2SelectionResult } from "./types";
import {
  buildProminenceScaleForEntities,
  buildWorldSection,
  buildDataSection,
  buildTemporalSection,
  buildNameBankSection,
  buildNarrativeLensSection,
  buildNarrativeDirectionSection,
} from "./promptSections";
import {
  buildUnifiedCastSection,
  buildEventUsageSection,
  buildUnifiedStyleSection,
} from "./promptBuilder";

/**
 * System prompt for creative freedom generation.
 */
export function getCreativeSystemPrompt(): string {
  return `You are a fiction writer. Find the one detail that makes this story specific — the gesture, the object, the sensory moment no other story contains. Build outward from there. The measure is whether a reader finishes this and sits with it. Avoid the patterns, rhythms, and hedging that mark machine-generated text.

Your prompt contains:

GUIDANCE (pre-synthesized — follow their intent, find your own voice):
- Tone & Atmosphere: Synthesized prose guidance for this chronicle
- Character Notes: Per-entity guidance for portrayal

WORLD DATA (what to write about):
- Cast: Characters and narrative roles
- World: Setting, canon facts, events, relationships

Entity descriptions reflect who characters BECAME. Write them as they WERE during the story's events.

Tone & Atmosphere and Character Notes are pre-synthesized guidance — follow their intent closely, but express them in your own voice.`;
}

/**
 * Build the creative freedom prompt for story format.
 *
 * The creative mode runs the same PS as the structured prompt, so it receives
 * the same narrative voice, entity directives, faceted facts, and motifs.
 * The difference is purely in how the generation prompt frames and presents
 * this material to the LLM.
 */
export function buildCreativeStoryPrompt(
  context: ChronicleGenerationContext,
  selection: V2SelectionResult
): string {
  const style = context.narrativeStyle as StoryNarrativeStyle;
  const pacing = style.pacing;
  const wordRange = `${pacing.totalWordCount.min}-${pacing.totalWordCount.max}`;

  const primaryEntityIds = new Set(context.focus?.primaryEntityIds ?? []);
  const prominenceScale = buildProminenceScaleForEntities([
    ...selection.entities,
    context.lensEntity,
  ]);

  // === TASK DATA ===

  // 1. TASK -- creative target, not permissions list
  const taskSection = `# Task
Write a ${wordRange} word story.

Find the one image the reader won't forget. Build outward from there.

- You may reassign characters to different roles or invent minor characters
- The narrative structure below is a starting shape, not a requirement
- Write directly with no section headers or meta-commentary`;

  // 2. NARRATIVE STRUCTURE -- softened: presented as suggestion
  const structureSection = buildCreativeStructureSection(style);

  // 3. EVENT USAGE
  const eventSection = buildEventUsageSection(style);

  // 4. NARRATIVE VOICE -- V0-style header (not "Story Bible")
  const narrativeVoiceSection = buildCreativeNarrativeVoiceSection(context);

  // 5. ENTITY WRITING DIRECTIVES -- V0-style header (not "Story Bible")
  const entityDirectivesSection = buildCreativeEntityDirectivesSection(context);

  // 6. WRITING STYLE -- same as structured, including craft posture
  const styleSection = buildUnifiedStyleSection(context.tone, style);

  // === WORLD DATA ===

  // 7. CAST (unified roles + characters -- same as structured)
  const castSection = buildUnifiedCastSection(selection, primaryEntityIds, style, prominenceScale);

  // 7b. NARRATIVE LENS (contextual frame entity)
  const lensSection = buildNarrativeLensSection(context, prominenceScale);

  // 8. WORLD (setting context only, no style)
  const worldSection = buildWorldSection(context);

  // 9. NAME BANK (practical data)
  const nameBankSection = buildNameBankSection(context.nameBank, selection.entities);

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

/**
 * Build narrative voice section for creative mode.
 * Uses V0-style header ("Tone & Atmosphere") instead of "Story Bible".
 */
function buildCreativeNarrativeVoiceSection(context: ChronicleGenerationContext): string {
  if (!context.narrativeVoice || Object.keys(context.narrativeVoice).length === 0) {
    return "";
  }

  const voiceLines: string[] = ["# Tone & Atmosphere"];
  voiceLines.push("Synthesized prose guidance for this chronicle:");
  voiceLines.push("");
  for (const [key, value] of Object.entries(context.narrativeVoice)) {
    voiceLines.push(`**${key}**: ${value}`);
  }
  return voiceLines.join("\n");
}

/**
 * Build entity directives section for creative mode.
 * Uses V0-style header ("Character Notes") instead of "Story Bible".
 */
function buildCreativeEntityDirectivesSection(context: ChronicleGenerationContext): string {
  if (!context.entityDirectives || context.entityDirectives.length === 0) {
    return "";
  }

  const directiveLines: string[] = ["# Character Notes"];
  directiveLines.push(
    "Specific guidance for writing each entity — interpret creatively, don't reproduce this language directly:"
  );
  directiveLines.push("");
  for (const directive of context.entityDirectives) {
    directiveLines.push(`**${directive.entityName}**: ${directive.directive}`);
  }
  return directiveLines.join("\n");
}

/**
 * Build narrative structure section for creative mode.
 * Same beat sheet content but framed as a starting shape rather than prescription.
 */
function buildCreativeStructureSection(style: StoryNarrativeStyle): string {
  const lines: string[] = ["# Narrative Structure"];
  lines.push("One possible shape for this story. Use it, adapt it, or find a better one.");

  // Scene count guidance
  if (style.pacing?.sceneCount) {
    lines.push("");
    lines.push(`Target: ${style.pacing.sceneCount.min}-${style.pacing.sceneCount.max} scenes`);
  }

  // Narrative instructions (plot structure, scenes, beats, emotional arcs)
  if (style.narrativeInstructions) {
    lines.push("");
    lines.push(style.narrativeInstructions);
  }

  return lines.join("\n");
}
