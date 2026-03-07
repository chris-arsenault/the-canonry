/**
 * Chronicle Image Refs Regeneration Task
 *
 * Regenerates all image refs for a chronicle:
 * - Converts entity_ref to prompt_request (with new scene descriptions)
 * - Fixes stale anchors (relocates to valid text in current content)
 * - Preserves valid prompt_request refs that still match
 *
 * Extracted from chronicleTask.ts to keep file sizes manageable.
 */

import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskContext } from "./taskTypes";
import type { TaskResult } from "../types";
import type {
  ChronicleRecord,
  ChronicleImageRef,
  ChronicleImageRefs,
  ChronicleImageSize,
  PromptRequestRef,
} from "../../lib/chronicleTypes";
import { getChronicle } from "../../lib/db/chronicleRepository";
import { updateChronicleImageRefs } from "../../lib/db/chronicleImageOps";
import { saveCostRecordWithDefaults, type CostType } from "../../lib/db/costRepository";
import { resolveAnchorPhrase } from "../../lib/fuzzyAnchor";
import { runTextCall } from "../../lib/llmTextCall";
import { getCallConfig } from "./llmCallConfig";

// ============================================================================
// Content resolution
// ============================================================================

function resolveActiveContent(record: ChronicleRecord): {
  versionId: string;
  content: string;
} {
  const versions = record.generationHistory || [];
  const latest = versions.reduce(
    (acc, v) => (acc && acc.generatedAt > v.generatedAt ? acc : v),
    versions[0],
  );
  const activeVersionId = record.activeVersionId || latest?.versionId;
  const match = versions.find((v) => v.versionId === activeVersionId);
  if (match) return { versionId: match.versionId, content: match.content };
  if (latest) return { versionId: latest.versionId, content: latest.content };
  return { versionId: activeVersionId || "unknown", content: record.assembledContent || "" };
}

// ============================================================================
// Prompt
// ============================================================================

function formatExistingRefs(refs: ChronicleImageRef[]): string {
  return refs
    .map((ref, i) => {
      const lines: string[] = [];
      lines.push(`### Ref ${i + 1} (refId: ${ref.refId})`);
      lines.push(`- type: ${ref.type}`);
      lines.push(`- anchorText: "${ref.anchorText}"`);
      lines.push(`- size: ${ref.size}`);
      if (ref.caption) lines.push(`- caption: "${ref.caption}"`);
      if (ref.type === "entity_ref") {
        lines.push(`- entityId: ${ref.entityId}`);
      }
      if (ref.type === "prompt_request") {
        lines.push(`- sceneDescription: "${ref.sceneDescription}"`);
        if (ref.involvedEntityIds?.length) {
          lines.push(`- involvedEntityIds: ${JSON.stringify(ref.involvedEntityIds)}`);
        }
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function formatVisualIdentities(visualIdentities: Record<string, string>): string {
  const entries = Object.entries(visualIdentities);
  if (entries.length === 0) return "(none available)";
  return entries.map(([id, thesis]) => `- ${id}: ${thesis}`).join("\n");
}

function buildRegenerateImageRefsPrompt(
  content: string,
  existingRefs: ChronicleImageRef[],
  visualIdentities: Record<string, string>,
): string {
  const refsDisplay = formatExistingRefs(existingRefs);
  const visualDisplay = formatVisualIdentities(visualIdentities);

  return `You are updating the image references for a chronicle. The chronicle text may have changed since the image refs were created, and entity_ref images are being replaced with custom scene images.

## Chronicle Content
${content}

## Visual Identities
"Entities" in this world include people, places, landmarks, artifacts, institutions, phenomena, and events — not just characters. The identities below describe what each entity looks like visually.
${visualDisplay}

## Existing Image Refs
${refsDisplay}

## Instructions

For EACH existing image ref, decide what to do:

1. **Keep** (disposition: "kept") — Use when the ref is a prompt_request, its anchorText still exists VERBATIM in the chronicle text above, and the sceneDescription still fits the surrounding context. Return the ref unchanged (same refId, anchorText, sceneDescription, size, caption, involvedEntityIds).

2. **Convert** (disposition: "converted") — Use for entity_ref refs. Write a new sceneDescription for the scene near the anchor point. This could be a character moment, a landscape, an artifact, a crowd scene — whatever best fits the narrative context. Use the entity's visual identity for visual details. Find a valid anchorText in the current text (relocate if the original anchor is gone).

3. **Relocate** (disposition: "relocated") — Use for prompt_request refs whose anchorText is NO LONGER in the chronicle text. Find a new anchorText in the current text where this scene is relevant. Update sceneDescription if the new context is significantly different. Preserve the original sceneDescription if it still fits.

4. **Drop** — If a ref's scene is completely irrelevant to the current text, simply omit it from the output.

Aim for visual variety — not every scene needs to show characters in action. Landscapes, artifacts, group scenes, and atmospheric shots make for a richer chronicle.

## Output Format
Return a JSON object:
{
  "imageRefs": [
    {
      "disposition": "kept",
      "refId": "<original refId>",
      "anchorText": "<same exact phrase from chronicle>",
      "sceneDescription": "<same description>",
      "involvedEntityIds": ["<entity-ids>"],
      "size": "small|medium|large|full-width",
      "caption": "<same or omitted>"
    },
    {
      "disposition": "converted",
      "originalRefId": "<entity_ref refId>",
      "anchorText": "<exact 5-15 word phrase from chronicle>",
      "sceneDescription": "<vivid 1-2 sentence scene description>",
      "involvedEntityIds": ["<entity-ids>"],
      "size": "small|medium|large|full-width",
      "caption": "<optional>"
    },
    {
      "disposition": "relocated",
      "originalRefId": "<original refId>",
      "anchorText": "<exact 5-15 word phrase from chronicle>",
      "sceneDescription": "<preserved or updated description>",
      "involvedEntityIds": ["<entity-ids>"],
      "size": "small|medium|large|full-width",
      "caption": "<optional>"
    }
  ]
}

## Rules
- anchorText MUST be an exact phrase from the chronicle text (5-15 words)
- For "kept" refs, return EXACTLY the same refId, anchorText, sceneDescription, and involvedEntityIds
- For scene descriptions, use visual identities for any entities depicted
- involvedEntityIds should list entities relevant to the scene (places, artifacts, people, etc.)
- involvedEntityIds can be empty for pure atmosphere/environment scenes
- Preserve size and caption from original refs where possible
- Return valid JSON only, no markdown`;
}

// ============================================================================
// Response parsing
// ============================================================================

const VALID_SIZES: ChronicleImageSize[] = ["small", "medium", "large", "full-width"];

interface RawRegeneratedRef {
  disposition?: string;
  refId?: string;
  originalRefId?: string;
  anchorText?: string;
  sceneDescription?: string;
  involvedEntityIds?: unknown;
  size?: string;
  caption?: string;
}

function parseInvolvedEntityIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.filter((id): id is string => typeof id === "string" && id.length > 0);
  return ids.length > 0 ? ids : undefined;
}

function parseRegenerateImageRefsResponse(
  text: string,
  existingRefs: ChronicleImageRef[],
): PromptRequestRef[] {
  // eslint-disable-next-line sonarjs/slow-regex -- bounded LLM response text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON object found in response");

  const parsed = JSON.parse(jsonMatch[0]) as { imageRefs?: RawRegeneratedRef[] };
  const rawRefs = parsed.imageRefs;
  if (!rawRefs || !Array.isArray(rawRefs)) {
    throw new Error("imageRefs array not found in response");
  }

  const existingMap = new Map(existingRefs.map((r) => [r.refId, r]));

  return rawRefs.map((raw, index): PromptRequestRef => {
    const disposition = raw.disposition || "converted";
    const anchorText = typeof raw.anchorText === "string" ? raw.anchorText : "";
    const rawSize = typeof raw.size === "string" ? raw.size : "medium";
    const size: ChronicleImageSize = VALID_SIZES.includes(rawSize as ChronicleImageSize)
      ? (rawSize as ChronicleImageSize)
      : "medium";
    const caption = typeof raw.caption === "string" ? raw.caption : undefined;

    // For "kept" refs, preserve the original refId and status
    let refId: string;
    let status: PromptRequestRef["status"] = "pending";
    if (disposition === "kept" && raw.refId && existingMap.has(raw.refId)) {
      refId = raw.refId;
      const existing = existingMap.get(raw.refId);
      if (existing?.type === "prompt_request") {
        status = existing.status;
      }
    } else {
      refId = `imgref_regen_${Date.now()}_${index}`;
    }

    const sceneDescription =
      typeof raw.sceneDescription === "string" ? raw.sceneDescription : "";
    if (!sceneDescription) {
      throw new Error(`Ref at index ${index} (disposition: ${disposition}) missing sceneDescription`);
    }

    return {
      refId,
      type: "prompt_request",
      anchorText,
      size,
      caption,
      sceneDescription,
      involvedEntityIds: parseInvolvedEntityIds(raw.involvedEntityIds),
      status,
    };
  });
}

// ============================================================================
// Step executor
// ============================================================================

export async function executeRegenerateImageRefsStep(
  task: WorkerTask,
  context: TaskContext,
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!task.chronicleId) {
    return { success: false, error: "chronicleId required for regenerate_image_refs" };
  }

  const chronicleRecord = await getChronicle(task.chronicleId);
  if (!chronicleRecord) {
    return { success: false, error: `Chronicle ${task.chronicleId} not found` };
  }

  const existingRefs = chronicleRecord.imageRefs?.refs;
  if (!existingRefs || existingRefs.length === 0) {
    return { success: false, error: "Chronicle has no existing image refs to regenerate" };
  }

  const { versionId, content } = resolveActiveContent(chronicleRecord);
  if (!content) {
    return { success: false, error: "Chronicle has no content" };
  }

  const visualIdentities = task.visualIdentities || {};

  const callConfig = getCallConfig(config, "chronicle.imageRefs");
  const prompt = buildRegenerateImageRefsPrompt(content, existingRefs, visualIdentities);

  const callResult = await runTextCall({
    llmClient,
    callType: "chronicle.imageRefs",
    callConfig,
    systemPrompt:
      "You are updating image references for a chronicle. Preserve valid refs, convert entity refs to scene images, and fix stale anchors. Always respond with valid JSON.",
    prompt,
    temperature: 0.4,
  });

  if (isAborted()) {
    return { success: false, error: "Task aborted", debug: callResult.result.debug };
  }

  const resultText = callResult.result.text?.trim();
  if (callResult.result.error || !resultText) {
    return {
      success: false,
      error: `Regenerate image refs failed: ${callResult.result.error || "Empty response"}`,
      debug: callResult.result.debug,
    };
  }

  let parsedRefs: PromptRequestRef[];
  try {
    parsedRefs = parseRegenerateImageRefsResponse(resultText, existingRefs);
  } catch (e) {
    return {
      success: false,
      error: `Failed to parse response: ${e instanceof Error ? e.message : "Unknown error"}`,
      debug: callResult.result.debug,
    };
  }

  if (parsedRefs.length === 0) {
    return { success: false, error: "All image refs were dropped — no refs in response" };
  }

  // Resolve anchor indices
  for (const ref of parsedRefs) {
    if (ref.anchorText) {
      const resolved = resolveAnchorPhrase(ref.anchorText, content);
      if (resolved) {
        ref.anchorText = resolved.phrase;
        ref.anchorIndex = resolved.index;
      }
    }
  }

  const imageRefs: ChronicleImageRefs = {
    refs: parsedRefs,
    generatedAt: Date.now(),
    model: callConfig.model,
  };

  const costs = {
    estimated: callResult.estimate.estimatedCost,
    actual: callResult.usage.actualCost,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
  };

  await updateChronicleImageRefs(
    task.chronicleId,
    imageRefs,
    costs,
    callConfig.model,
    versionId,
  );

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId: task.chronicleId,
    type: "chronicleImageRefs" as CostType,
    model: callConfig.model,
    estimatedCost: costs.estimated,
    actualCost: costs.actual,
    inputTokens: costs.inputTokens,
    outputTokens: costs.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId: task.chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: costs.estimated,
      actualCost: costs.actual,
      inputTokens: costs.inputTokens,
      outputTokens: costs.outputTokens,
    },
    debug: callResult.result.debug,
  };
}
