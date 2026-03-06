/**
 * Chronicle V2 Document Format Prompt Builder
 *
 * Builds prompts for document-format chronicles (in-universe documents like
 * dispatches, treaties, letters, etc.).
 */

import type { ChronicleGenerationContext } from "../../chronicleTypes";
import type { DocumentNarrativeStyle, ProminenceScale } from "@canonry/world-schema";
import type { V2SelectionResult } from "./types";
import {
  formatEntityFull,
  formatEntityBrief,
  buildWorldSection,
  buildDataSection,
  buildTemporalSection,
  buildNarrativeLensSection,
  buildNarrativeDirectionSection,
} from "./promptSections";

// =============================================================================
// Document Format - Structure & Style Building
// =============================================================================

/**
 * Get word count range from document style.
 * Handles both new format (pacing.wordCount) and legacy format (documentConfig.wordCount).
 */
export function getDocumentWordCount(style: DocumentNarrativeStyle): { min: number; max: number } {
  // New format
  if (style.pacing?.wordCount) {
    return style.pacing.wordCount;
  }
  // Legacy format fallback
  const legacy = style as unknown as {
    documentConfig?: { wordCount?: { min: number; max: number } };
  };
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
      sections?: Array<{
        name: string;
        purpose: string;
        wordCountTarget?: number;
        optional?: boolean;
      }>;
    };
  };
  if (legacy.documentConfig) {
    const doc = legacy.documentConfig;
    const lines: string[] = [];
    if (doc.documentType) {
      lines.push(`Document Type: ${doc.documentType}`);
    }
    if (doc.contentInstructions) {
      lines.push("", doc.contentInstructions);
    }
    if (doc.voice) {
      lines.push("", `Voice: ${doc.voice}`);
    }
    if (doc.toneKeywords?.length) {
      lines.push(`Tone: ${doc.toneKeywords.join(", ")}`);
    }
    if (doc.sections?.length) {
      lines.push("", "Sections:");
      doc.sections.forEach((s, i) => {
        lines.push(`${i + 1}. ${s.name}: ${s.purpose}`);
      });
    }
    return lines.join("\n");
  }
  return "";
}

/**
 * Build the document instructions section.
 * Uses the unified documentInstructions field (structure, voice, tone all in one).
 */
function buildDocumentInstructionsSection(style: DocumentNarrativeStyle): string {
  const instructions = getDocumentInstructions(style);
  if (!instructions) {
    return style.craftPosture
      ? `# Document Instructions\n\n## Craft Posture\nHow to relate to the material — density, withholding, and elaboration:\n${style.craftPosture}`
      : "";
  }

  const lines = [`# Document Instructions`, instructions];

  if (style.craftPosture) {
    lines.push("");
    lines.push(`## Craft Posture`);
    lines.push("How to relate to the material — density, withholding, and elaboration:");
    lines.push(style.craftPosture);
  }

  return lines.join("\n");
}

/**
 * Get roles from document style.
 * Handles both new format (roles) and legacy format (entityRules.roles).
 */
function getDocumentRoles(
  style: DocumentNarrativeStyle
): Array<{ role: string; count: { min: number; max: number }; description: string }> {
  // New format
  if (style.roles && style.roles.length > 0) {
    return style.roles;
  }
  // Legacy format fallback
  const legacy = style as unknown as {
    entityRules?: {
      roles?: Array<{ role: string; count: { min: number; max: number }; description: string }>;
    };
  };
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
  return "";
}

/**
 * Build the document event usage section.
 */
function buildDocumentEventUsageSection(style: DocumentNarrativeStyle): string {
  const instructions = getDocumentEventInstructions(style);
  if (!instructions) {
    return "";
  }

  return `# How to Use Events
${instructions}`;
}

/**
 * Build the perspective section for document format.
 * Contains the PS-synthesized perspective brief and suggested motifs.
 *
 * NOTE: No format receives coreTone directly — it conflicts with narrative style proseInstructions
 * (e.g. "dark, war-weary" fights Dreamscape's "hallucinatory, fluid"). PS already receives
 * coreTone as input and incorporates it into its synthesis. The generation prompt gets only
 * PS brief + motifs + narrative style proseInstructions.
 */
function buildDocumentStyleSection(tone: string | undefined): string {
  if (!tone) return "";
  return `# Perspective\n\n${tone}`;
}

/**
 * Build the unified cast section for document format.
 * Combines role expectations with character data so the LLM sees roles and characters together.
 */
function buildUnifiedDocumentCastSection(
  selection: V2SelectionResult,
  primaryEntityIds: Set<string>,
  style: DocumentNarrativeStyle,
  prominenceScale: ProminenceScale
): string {
  const lines: string[] = [`# Cast (${selection.entities.length} characters)`];
  lines.push("");
  lines.push(
    "**Temporal context**: Entity descriptions reflect their CURRENT state — who they became, how they ended up. This chronicle depicts PAST EVENTS when characters who are now dead/changed were alive and active. Write them as they WERE during the story, not as they ARE now."
  );
  const roles = getDocumentRoles(style);

  // Role expectations first - so LLM knows what to look for
  if (roles.length > 0) {
    lines.push("");
    lines.push("## Document Roles");
    lines.push("Assign characters from below to these roles:");
    for (const role of roles) {
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
 * 6. WRITING STYLE - World tone + perspective brief + motifs
 *
 * WORLD DATA (what to write about):
 * 7. CAST - Document roles + characters
 * 8. WORLD - Setting context
 * 9. NAME BANK - Culture-appropriate names
 * 10. HISTORICAL CONTEXT - Era, timeline
 * 11. RELATIONSHIPS + EVENTS - Data section
 */
export function buildDocumentPrompt(
  context: ChronicleGenerationContext,
  selection: V2SelectionResult,
  primaryEntityIds: Set<string>,
  narrativeVoiceSection: string,
  entityDirectivesSection: string,
  nameBankSection: string,
  style: DocumentNarrativeStyle,
  prominenceScale: ProminenceScale
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

  // 6. WRITING STYLE (world tone + perspective brief + motifs)
  const styleSection = buildDocumentStyleSection(context.tone);

  // === WORLD DATA ===

  // 7. CAST (unified roles + characters)
  const castSection = buildUnifiedDocumentCastSection(
    selection,
    primaryEntityIds,
    style,
    prominenceScale
  );

  // 7b. NARRATIVE LENS (contextual frame entity)
  const lensSection = buildNarrativeLensSection(context, prominenceScale);

  // 8. WORLD (setting context)
  const worldSection = buildWorldSection(context);

  // 9. NAME BANK (practical data)

  // 10. HISTORICAL CONTEXT
  const temporalSection = buildTemporalSection(context.temporalContext, context.temporalNarrative);

  // 11. RELATIONSHIPS + EVENTS
  const dataSection = buildDataSection(selection);

  // NARRATIVE DIRECTION (optional, between task and instructions)
  const narrativeDirectionSection = buildNarrativeDirectionSection(context.narrativeDirection);

  // Combine sections in order: TASK DATA then WORLD DATA
  const sections = [
    // TASK DATA
    taskSection,
    narrativeDirectionSection,
    instructionsSection,
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
