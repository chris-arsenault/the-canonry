/**
 * Chronicle Lore Backport Worker Task
 *
 * Reads run state from IndexedDB, assembles context from the chronicle text
 * and perspective synthesis, makes one LLM call for the cast batch, and
 * writes the resulting patches back to IndexedDB.
 *
 * Extracts new lore from a published chronicle and proposes small updates
 * to cast member summaries and descriptions.
 */

import type { WorkerTask } from '../../lib/enrichmentTypes';
import type { TaskContext } from './taskTypes';
import type { TaskResult } from '../types';
import type {
  SummaryRevisionLLMResponse,
  RevisionEntityContext,
} from '../../lib/summaryRevisionTypes';
import { getRevisionRun, updateRevisionRun } from '../../lib/db/summaryRevisionRepository';
import { runTextCall } from '../../lib/llmTextCall';
import { getCallConfig } from './llmCallConfig';
import { saveCostRecordWithDefaults, type CostType } from '../../lib/db/costRepository';

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are updating entity records with new lore from a published chronicle. Each entity has a summary and a description. Descriptions are rendered as markdown on a wiki page and grow across multiple chronicles into long-form articles.

## Your Thinking Process

Use your thinking budget. For each entity, work through these steps:

**Step 1 — Identify new lore.** Read the chronicle and list every piece of genuinely new information about this entity: actions taken, relationships changed, motivations revealed, status changes, discoveries. Ignore atmospheric details that don't characterize the entity, events they merely witnessed, and information already present in the existing text. For events and factions, pay special attention to outcomes, consequences, and status changes. If the existing description covers how something started but not how it ended, the resolution is new lore.

**Step 2 — Check for overlap.** Compare each new fact against the existing description. If the existing text already covers an event or fact — even vaguely or without names — that is NOT new lore. Do not repeat it, restate it, or expand on it. If the chronicle adds a specific name or detail to something already described in general terms, note this as a detail refinement (Step 3), not new lore.

**Step 3 — Classify each change.**
- **Detail refinement**: The existing text describes something generally, and the chronicle reveals a specific name, date, or detail. Example: existing says "a traveler brought it"; chronicle reveals the traveler's name. In this case, REWRITE the existing sentence to include the detail. Do not add a separate sentence that restates the same event.
- **New fact**: Something not covered at all in the existing text. Add this as new sentences or a new paragraph.

**Step 4 — Reorganize into paragraphs.** The description array is a sequence of paragraphs. Group related content together:
- Physical appearance / identifying features
- Origin and history
- Key actions and events
- Relationships and reputation
- Current status or unresolved tensions

Break existing wall-of-text into logical paragraphs where natural boundaries exist. When the description is long enough (3+ paragraphs), consider adding markdown sub-headings (### Heading) to create wiki-style sections.

**Step 5 — Final check.** Read your output description end to end. Ask: does any paragraph repeat information from another paragraph? Does any sentence restate a fact already established elsewhere in the description? If so, merge or remove the redundancy.

## Summary Changes (0-1 sentences)

- You may append ONE sentence to the end of the summary, or leave it unchanged.
- Only if the chronicle reveals something significant: a status change, a defining action, a new allegiance.
- Most entities should have NO summary change. The summary is a stable identity statement.

## Entity-Centric Self-Containment

Each description is a standalone wiki article about ONE entity. A reader arrives at this page knowing nothing about any chronicle. Apply these filters to every new sentence:

1. **Is this about this entity?** Every sentence must be about what this entity did, owns, experienced, or became. If a sentence is really about what happened to someone else, or about a broader event's plot, it belongs on that other entity's page — not here.
2. **Would this make sense without the chronicle?** If a new sentence references an artifact, event, or person not already in this description, you must introduce it with a brief identifying clause — or omit the detail entirely. Never assume the reader knows what "the incident" or "the harp" refers to.
3. **Compress, don't replay.** A chronicle may spend 500 words on a scene. The backport should distill that into 1-2 sentences of entity-relevant fact. "Xi was blessed — or cursed — by the Radiant Aurora-harp, a memory-singing instrument; the blessing left them aware of its location at all times." That's enough. Don't reconstruct the scene.
4. **When in doubt, omit.** A shorter description that stands alone is better than a longer one that requires chronicle context to parse.

## Description Register

Descriptions are wiki articles, not prose narratives. They follow the world's tone but state facts plainly. Do not:
- Import atmospheric language or emotional imagery from the chronicle
- Fabricate causal details not stated in the chronicle (e.g., don't invent WHY something looks damaged — just note that it is)
- Include quoted dialogue — paraphrase instead
- Editorialize ("a war that changed everything") — state what changed specifically

The existing descriptions have voice and personality — match that voice. But new content you add should convey facts, not import the chronicle's literary style.

## Description Rules

- Frame all content as canonical world facts, not chronicle narration. Write "She brokered the accord" not "During the chronicle, she brokered an accord."
- Match the voice and register of the existing description.
- Preserve all existing semantic information. Every fact in the original must appear in your output. You may reword a sentence to integrate a new detail, but you must not drop any information.
- It is acceptable to output the existing description unchanged if the chronicle reveals nothing new.
- Do NOT contradict the entity's visual thesis.

## Preserving Existing Structure

Descriptions that have been updated before may already have multiple paragraphs (shown as numbered [1], [2], etc. in the input). When updating a multi-paragraph description:

- Paragraphs with no changes pass through VERBATIM. Copy them exactly.
- If a paragraph needs a detail refinement, edit only the affected sentence within that paragraph.
- Add new content as a new paragraph at the end, or as a new sentence within the most relevant existing paragraph.
- Do not re-split, merge, or reorder existing paragraphs unless the result would be incoherent.

When updating a single-paragraph description with substantial new content, you should split it into logical paragraphs. But a single-paragraph description with only minor detail refinements should stay as one paragraph.

Some entities may list "Existing Anchor Phrases" — these are short phrases from the description that are used as link anchors from other chronicles. Preserve these phrases verbatim in your output. If you edit a sentence containing an anchor phrase, keep the anchor text intact within the rewritten sentence.

## Zero Overlap Rule

This is the most important rule. If the existing description says something, do not say it again — not in different words, not with more detail appended as a separate statement, not as a summary of what was already said.

If you need to add a detail to an existing fact, EDIT that sentence. If you find yourself writing a sentence that covers the same ground as an existing one, STOP and integrate the new detail into the existing sentence instead.

## Cross-Entity Overlap Rule

You are updating all cast entities in one batch. When the same fact applies to multiple entities, decide which entity owns that fact:
- A **faction's** description should describe collective actions and institutional outcomes.
- An **NPC's** description should describe individual actions, personal motivations, and character development.
- A **location's** description should describe physical changes, territorial shifts, and environmental state.
- An **event's** description should describe the arc, consequences, and resolution — what happened and what changed.

Do not state the same fact in two entity descriptions. Each entity's description should cover a distinct facet of the shared event.

## Anchor Phrase

For each entity where you modify the description, pick a short anchor phrase (3-8 words) from your new or modified text that best represents the new lore. This phrase will be used to link back to the source chronicle. Pick a distinctive phrase — not a generic clause. The anchor phrase must appear verbatim in one of the description paragraphs.

## Output Format

Output ONLY valid JSON. The description field is an ARRAY OF STRINGS — each string is one paragraph.

{
  "patches": [
    {
      "entityId": "entity_id_here",
      "entityName": "Entity Name",
      "entityKind": "npc",
      "summary": "Complete summary text",
      "description": [
        "First paragraph of the complete description.",
        "Second paragraph with more content.",
        "Third paragraph, and so on."
      ],
      "anchorPhrase": "a short phrase from new or modified text"
    }
  ]
}

## Narrative Lens Entities

Some entities may be marked as **[NARRATIVE LENS]** — these are not cast members but contextual frame entities (rules, occurrences, abilities) that shaped the chronicle's world without being characters in it. Apply a higher bar for changes:

- Only update a lens entity if the chronicle reveals a genuinely new fact about the entity itself — a consequence, a new aspect, or a changed status.
- Do NOT update a lens entity merely because it was referenced or invoked. Being mentioned as context is its normal role.
- Most lens entities should have NO changes. When changes do occur, they should be brief and factual.

Rules:
- Include EVERY cast and lens entity in the patches array.
- Output the COMPLETE text for each field — not a diff. Every original fact must be present.
- If no change is needed for a field, output the current text unchanged (description as a single-element array).
- Omit anchorPhrase if the description is unchanged.`;

// ============================================================================
// Context Assembly
// ============================================================================

function buildUserPrompt(
  entities: RevisionEntityContext[],
  chronicleText: string,
  perspectiveSynthesisJson: string,
  customInstructions?: string,
): string {
  const sections: string[] = [];
  let chronicleFormat = '';

  // Chronicle text
  sections.push(`=== CHRONICLE TEXT ===\n${chronicleText}`);

  // Perspective synthesis
  if (perspectiveSynthesisJson) {
    try {
      const synthesis = JSON.parse(perspectiveSynthesisJson);
      chronicleFormat = synthesis.chronicleFormat || '';
      const synthParts: string[] = [];

      if (synthesis.brief) {
        synthParts.push(`Brief: ${synthesis.brief}`);
      }
      if (synthesis.facets?.length) {
        synthParts.push(`Faceted Facts:\n${synthesis.facets.map((f: { factId: string; interpretation: string }) => `  - [${f.factId}] ${f.interpretation}`).join('\n')}`);
      }
      if (synthesis.narrativeVoice && Object.keys(synthesis.narrativeVoice).length) {
        synthParts.push(`Narrative Voice:\n${Object.entries(synthesis.narrativeVoice).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`);
      }
      if (synthesis.entityDirectives?.length) {
        synthParts.push(`Entity Directives:\n${synthesis.entityDirectives.map((d: { entityName: string; directive: string }) => `  - ${d.entityName}: ${d.directive}`).join('\n')}`);
      }
      if (synthesis.suggestedMotifs?.length) {
        synthParts.push(`Motifs: ${synthesis.suggestedMotifs.join(', ')}`);
      }

      if (synthParts.length > 0) {
        sections.push(`=== PERSPECTIVE SYNTHESIS ===\n${synthParts.join('\n\n')}`);
      }
    } catch {
      // If JSON parsing fails, include as raw text
      sections.push(`=== PERSPECTIVE SYNTHESIS ===\n${perspectiveSynthesisJson}`);
    }
  }

  // Separate cast and lens entities
  const castEntities = entities.filter(e => !e.isLens);
  const lensEntities = entities.filter(e => e.isLens);

  function formatEntityBlock(e: RevisionEntityContext): string {
    const parts: string[] = [];
    const lensTag = e.isLens ? ' [NARRATIVE LENS]' : '';
    parts.push(`### ${e.name} (${e.kind}${e.subtype ? ` / ${e.subtype}` : ''})${lensTag}`);
    parts.push(`ID: ${e.id}`);
    parts.push(`Prominence: ${e.prominence} | Culture: ${e.culture} | Status: ${e.status}`);

    if (e.kindFocus) {
      parts.push(`Description Focus (${e.kind}): ${e.kindFocus}`);
    }

    if (e.visualThesis) {
      parts.push(`Visual Thesis (DO NOT CONTRADICT): ${e.visualThesis}`);
    }

    if (e.relationships.length > 0) {
      const relLines = e.relationships.map(
        (r) => `  - ${r.kind} → ${r.targetName} (${r.targetKind})`
      );
      parts.push(`Relationships:\n${relLines.join('\n')}`);
    }

    parts.push(`Summary: ${e.summary}`);

    // Send description as numbered paragraphs so LLM sees existing structure
    const descParagraphs = e.description
      ? e.description.split(/\n\n+/).filter((p: string) => p.trim())
      : [];
    if (descParagraphs.length > 1) {
      parts.push(`Description (${descParagraphs.length} paragraphs):`);
      descParagraphs.forEach((p: string, i: number) => {
        parts.push(`  [${i + 1}] ${p.trim()}`);
      });
    } else {
      parts.push(`Description: ${e.description}`);
    }

    if (e.existingAnchorPhrases?.length) {
      parts.push(`Existing Anchor Phrases (PRESERVE in description):\n${e.existingAnchorPhrases.map((a: string) => `  - "${a}"`).join('\n')}`);
    }

    return parts.join('\n');
  }

  // Cast entities section
  const castLines = castEntities.map(formatEntityBlock);
  sections.push(`=== CAST (${castEntities.length} entities) ===\n\n${castLines.join('\n\n---\n\n')}`);

  // Lens entities section (if any)
  if (lensEntities.length > 0) {
    const lensLines = lensEntities.map(formatEntityBlock);
    sections.push(`=== NARRATIVE LENS (${lensEntities.length} ${lensEntities.length === 1 ? 'entity' : 'entities'}) ===\nThese entities provided contextual framing for the chronicle — they are not cast members. Apply a higher bar: only update if the chronicle reveals genuinely new facts about the entity itself.\n\n${lensLines.join('\n\n---\n\n')}`);
  }

  // Per-entity task framing — re-anchor the model at each entity boundary
  const documentFormatNote = chronicleFormat === 'document'
    ? `\nThis chronicle is written in document format — it reports events and outcomes factually. Extract institutional outcomes, status changes, and territorial shifts. Attribute each fact to the entity that owns it.`
    : '';

  const criticalNote = customInstructions
    ? `\nCRITICAL — USER INSTRUCTIONS: ${customInstructions}`
    : '';

  const entityTaskBlocks = entities.map((e) => {
    if (e.isLens) {
      return `--- UPDATE: ${e.name} (${e.kind}) [NARRATIVE LENS] ---
This entity was the narrative lens — contextual framing, not a cast member. It was referenced or invoked but did not act as a character. Apply a HIGH BAR for changes.

For ${e.name}, ask:
1. Does the chronicle reveal a genuinely new fact about ${e.name} itself — a consequence, a new aspect, a status change, or a previously unknown property?
2. Merely being referenced, invoked, or serving as backdrop is NOT new lore. Skip those.
3. If there IS new lore: compress into 1 sentence. Most lens entities need NO update.
4. Final check: would this change make sense without knowing this chronicle used ${e.name} as a lens?${criticalNote}`;
    }
    return `--- UPDATE: ${e.name} (${e.kind}) ---
You are writing the standalone wiki article for ${e.name}. A reader may arrive at this page knowing nothing about this chronicle. Every sentence must be about ${e.name}. Every reference to another entity, event, or artifact must be introduced with a brief identifying clause or omitted.

For ${e.name}, follow the thinking steps:
1. What genuinely new facts does the chronicle reveal about ${e.name} specifically?
2. Does each new fact already appear in the existing description? If so, skip it.
3. For each new fact: is it a detail refinement (edit existing sentence) or a new fact (add content)?
4. Compress each new fact into 1-2 sentences of entity-relevant wiki content. Do not reconstruct chronicle scenes.
5. Final check: would every sentence make sense to someone who has never read this chronicle?${criticalNote}`;
  }).join('\n\n');

  const criticalSection = customInstructions
    ? `\n\n## CRITICAL — User Instructions\n\nThe following user-provided instructions override default behavior. Apply them to EVERY entity update:\n\n${customInstructions}\n`
    : '';

  sections.push(`=== YOUR TASK ===${criticalSection}
Process each entity below independently. For each one, reset your focus — you are writing that entity's wiki article, not summarizing the chronicle.${documentFormatNote}

General rules:
- Summary: append 0-1 sentences. Most entities need no summary change.
- Description: output as an array of paragraph strings. Integrate detail refinements into existing sentences. Add new lore as new content. Preserve all existing information.
- Zero overlap: never restate a fact already in the description.
- Cross-entity overlap: each fact belongs to one entity. Do not duplicate facts across entities.
- Preserve visual thesis.

${entityTaskBlocks}`);

  return sections.join('\n\n');
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeChronicleLoreBackportTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: 'Text generation not configured - missing Anthropic API key' };
  }

  const runId = task.chronicleId; // Repurposing chronicleId field for runId
  if (!runId) {
    return { success: false, error: 'runId (chronicleId) required for chronicle lore backport' };
  }

  // Read current run state
  const run = await getRevisionRun(runId);
  if (!run) {
    return { success: false, error: `Lore backport run ${runId} not found` };
  }

  // Single batch (index 0)
  const batchIndex = run.currentBatchIndex;
  const batch = run.batches[batchIndex];
  if (!batch || batch.status !== 'pending') {
    return { success: false, error: `No pending batch at index ${batchIndex}` };
  }

  // Mark batch as generating
  const updatedBatches = [...run.batches];
  updatedBatches[batchIndex] = { ...batch, status: 'generating' };
  await updateRevisionRun(runId, { status: 'generating', batches: updatedBatches });

  // Entity data is passed via the task prompt field as JSON
  let entities: RevisionEntityContext[];
  try {
    entities = JSON.parse(task.prompt);
  } catch {
    const errorMsg = 'Failed to parse entity context from task prompt';
    updatedBatches[batchIndex] = { ...batch, status: 'failed', error: errorMsg };
    await updateRevisionRun(runId, { status: 'failed', batches: updatedBatches });
    return { success: false, error: errorMsg };
  }

  const callConfig = getCallConfig(config, 'revision.loreBackport');

  // Chronicle text is stored in worldDynamicsContext (repurposed)
  // Perspective synthesis JSON is stored in staticPagesContext (repurposed)
  // Custom user instructions are stored in revisionGuidance (repurposed)
  const customInstructions = run.revisionGuidance || undefined;
  const userPrompt = buildUserPrompt(
    entities,
    run.worldDynamicsContext,
    run.staticPagesContext,
    customInstructions,
  );

  try {
    const callResult = await runTextCall({
      llmClient,
      callType: 'revision.loreBackport',
      callConfig,
      systemPrompt: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.5,
    });

    if (isAborted()) {
      updatedBatches[batchIndex] = { ...batch, status: 'failed', error: 'Task aborted' };
      await updateRevisionRun(runId, { status: 'failed', batches: updatedBatches });
      return { success: false, error: 'Task aborted' };
    }

    const resultText = callResult.result.text?.trim();
    if (callResult.result.error || !resultText) {
      const errorMsg = `LLM call failed: ${callResult.result.error || 'No text returned'}`;
      updatedBatches[batchIndex] = { ...batch, status: 'failed', error: errorMsg };
      await updateRevisionRun(runId, { status: 'run_reviewing', batches: updatedBatches });
      return { success: false, error: errorMsg };
    }

    // Parse LLM response
    let parsed: SummaryRevisionLLMResponse;
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object found');
      parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.patches)) throw new Error('Missing patches array');

      // Normalize description: LLM returns string[] (paragraphs), join to single string
      for (const patch of parsed.patches) {
        if (Array.isArray(patch.description)) {
          patch.description = patch.description.join('\n\n');
        }
      }
    } catch (err) {
      const errorMsg = `Failed to parse LLM response: ${err instanceof Error ? err.message : String(err)}`;
      updatedBatches[batchIndex] = { ...batch, status: 'failed', error: errorMsg };
      await updateRevisionRun(runId, { status: 'run_reviewing', batches: updatedBatches });
      return { success: false, error: errorMsg };
    }

    // Update batch with patches — single batch so always run_reviewing
    updatedBatches[batchIndex] = {
      ...batch,
      status: 'complete',
      patches: parsed.patches,
      inputTokens: callResult.usage.inputTokens,
      outputTokens: callResult.usage.outputTokens,
      actualCost: callResult.usage.actualCost,
    };

    await updateRevisionRun(runId, {
      status: 'run_reviewing',
      batches: updatedBatches,
      totalInputTokens: run.totalInputTokens + callResult.usage.inputTokens,
      totalOutputTokens: run.totalOutputTokens + callResult.usage.outputTokens,
      totalActualCost: run.totalActualCost + callResult.usage.actualCost,
    });

    // Record cost
    await saveCostRecordWithDefaults({
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      entityId: task.entityId,
      entityName: task.entityName,
      entityKind: task.entityKind,
      type: 'chronicleLoreBackport' as CostType,
      model: callConfig.model,
      estimatedCost: callResult.estimate.estimatedCost,
      actualCost: callResult.usage.actualCost,
      inputTokens: callResult.usage.inputTokens,
      outputTokens: callResult.usage.outputTokens,
    });

    return {
      success: true,
      result: {
        generatedAt: Date.now(),
        model: callConfig.model,
        estimatedCost: callResult.estimate.estimatedCost,
        actualCost: callResult.usage.actualCost,
        inputTokens: callResult.usage.inputTokens,
        outputTokens: callResult.usage.outputTokens,
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    updatedBatches[batchIndex] = { ...batch, status: 'failed', error: errorMsg };
    await updateRevisionRun(runId, { status: 'run_reviewing', batches: updatedBatches });
    return { success: false, error: `Chronicle lore backport failed: ${errorMsg}` };
  }
}

export const chronicleLoreBackportTask = {
  type: 'chronicleLoreBackport' as const,
  execute: executeChronicleLoreBackportTask,
};
