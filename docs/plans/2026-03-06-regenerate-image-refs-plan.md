# Regenerate Image Refs — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert all chronicle entity_ref image references to prompt_request (custom scene images), fix stale anchors, and stop generating entity_refs in the future.

**Architecture:** New `regenerate_image_refs` chronicle step in a separate task file (chronicleTask.ts is 3100+ lines). The step reads existing refs + chronicle content, sends to LLM to produce updated prompt_request-only refs. Bulk operation follows the `useChronicleBulkOperations` pattern. Future image_refs prompt drops entity_ref as an option.

**Tech Stack:** TypeScript, React hooks, LLM text calls (Anthropic/OpenAI via `runTextCall`), IndexedDB via Dexie

**Design doc:** `docs/plans/2026-03-06-regenerate-image-refs-design.md`

---

### Task 1: Add `regenerate_image_refs` to ChronicleStep

**Files:**
- Modify: `apps/illuminator/webui/src/lib/enrichmentTypes.ts` (line ~321, `ChronicleStep` union)

**Step 1: Add the new step to the union type**

In `enrichmentTypes.ts`, add `"regenerate_image_refs"` to the `ChronicleStep` type union, after `"regenerate_scene_description"`:

```typescript
  | "regenerate_scene_description" // Regenerate a single image ref's scene description
  | "regenerate_image_refs"; // Regenerate all image refs: convert entity_refs, fix stale anchors
```

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/lib/enrichmentTypes.ts
git commit -m "feat: add regenerate_image_refs to ChronicleStep type"
```

---

### Task 2: Create the regenerate image refs task file

**Files:**
- Create: `apps/illuminator/webui/src/workers/tasks/chronicleImageRefsTask.ts`

This file contains the prompt builder, response parser, and step executor for `regenerate_image_refs`. It follows the pattern of `eraNarrativeImageRefs.ts`.

**Step 1: Create the task file**

```typescript
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
// Content resolution (duplicated from chronicleTask — minimal helper)
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
These describe what entities look like — use them when writing scene descriptions.
${visualDisplay}

## Existing Image Refs
${refsDisplay}

## Instructions

For EACH existing image ref, decide what to do:

1. **Keep** (disposition: "kept") — Use when the ref is a prompt_request, its anchorText still exists VERBATIM in the chronicle text above, and the sceneDescription still fits the surrounding context. Return the ref unchanged (same refId, anchorText, sceneDescription, size, caption, involvedEntityIds).

2. **Convert** (disposition: "converted") — Use for entity_ref refs. Write a new sceneDescription that captures the dramatic moment near the anchor point, incorporating the entity's visual identity. Find a valid anchorText in the current text (relocate if the original anchor is gone).

3. **Relocate** (disposition: "relocated") — Use for prompt_request refs whose anchorText is NO LONGER in the chronicle text. Find a new anchorText in the current text where this scene is relevant. Update sceneDescription if the new context is significantly different. Preserve the original sceneDescription if it still fits.

4. **Drop** — If a ref's scene is completely irrelevant to the current text, simply omit it from the output.

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
- For scene descriptions, incorporate visual identities so the image generator knows what figures look like
- involvedEntityIds should use entity IDs from the Visual Identities list
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

    // For "kept" refs, try to preserve the original refId
    let refId: string;
    if (disposition === "kept" && raw.refId && existingMap.has(raw.refId)) {
      refId = raw.refId;
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
      status: disposition === "kept" ? (existingMap.get(raw.refId ?? "")?.type === "prompt_request"
        ? (existingMap.get(raw.refId ?? "") as PromptRequestRef).status
        : "pending") : "pending",
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
```

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/workers/tasks/chronicleImageRefsTask.ts
git commit -m "feat: add regenerate_image_refs task file"
```

---

### Task 3: Wire the new step into the dispatch

**Files:**
- Modify: `apps/illuminator/webui/src/workers/tasks/chronicleTask.ts` (~line 347-388, `dispatchPostGenerationStep`)

**Step 1: Add import at top of file**

Add after the existing imports (near line 38):

```typescript
import { executeRegenerateImageRefsStep } from "./chronicleImageRefsTask";
```

**Step 2: Add case to dispatch switch**

In `dispatchPostGenerationStep`, add before the `default` case (around line 384):

```typescript
    case "regenerate_image_refs":
      return executeRegenerateImageRefsStep(task, context);
```

Note: unlike other steps, this does NOT pass `chronicleRecord` — the task file loads it internally (it doesn't need the caller's stale copy, and the signature differs from the other step handlers).

**Step 3: Commit**

```bash
git add apps/illuminator/webui/src/workers/tasks/chronicleTask.ts
git commit -m "feat: wire regenerate_image_refs into chronicle step dispatch"
```

---

### Task 4: Add nav item field for image ref filtering

**Files:**
- Modify: `apps/illuminator/webui/src/lib/db/chronicleNav.ts` (~line 17-55, `ChronicleNavItem` and `buildNavItem`)

**Step 1: Add `imageRefTotalCount` to `ChronicleNavItem`**

Add after `imageRefCompleteCount` (line 36):

```typescript
  imageRefTotalCount: number;
```

**Step 2: Populate in `buildNavItem`**

In the `buildNavItem` function, add the field alongside `imageRefCompleteCount` computation. Find where `imageRefCompleteCount` is computed (around line 99) and add nearby:

```typescript
    imageRefTotalCount: record.imageRefs?.refs?.length || 0,
```

**Step 3: Commit**

```bash
git add apps/illuminator/webui/src/lib/db/chronicleNav.ts
git commit -m "feat: add imageRefTotalCount to ChronicleNavItem"
```

---

### Task 5: Add bulk operation callback

**Files:**
- Modify: `apps/illuminator/webui/src/components/chronicle-panel/useChronicleBulkOperations.ts`

**Step 1: Add state and callback**

Add `fullEntityMapRef` to the params interface (`UseChronicleBulkOperationsParams`, around line 74):

```typescript
  fullEntityMapRef: React.RefObject<Map<string, Record<string, unknown>>>;
```

Add the import for React at the top (it already imports from "react"):
No additional import needed — `React.RefObject` is available from the existing `import { useState, useCallback } from "react"` via the JSX runtime. Actually, add the type import:

```typescript
import { useState, useCallback, type RefObject } from "react";
```

And update the params type:

```typescript
  fullEntityMapRef: RefObject<Map<string, Record<string, unknown>>>;
```

Add a new result state (near line 108, after `bulkSummaryResult`):

```typescript
  // Bulk image ref regeneration
  const [bulkImageRefResult, setBulkImageRefResult] = useState<OperationResult | null>(null);
```

Add the handler (after `handleBulkHistorianPrep`, before the `return`):

```typescript
  // ── Bulk image ref regeneration ──

  const handleBulkRegenerateImageRefs = useCallback(() => {
    const eligible = chronicleItems.filter(
      (c) =>
        (c.imageRefTotalCount ?? 0) > 0 &&
        (c.status === "complete" || c.status === "assembly_ready"),
    );
    if (eligible.length === 0) {
      setBulkImageRefResult({ success: true, count: 0 });
      setTimeout(() => setBulkImageRefResult(null), 4000);
      return;
    }

    // Build visual identities from the full entity map
    const visualIdentities: Record<string, string> = {};
    for (const [id, entity] of fullEntityMapRef.current) {
      const enrichment = entity.enrichment as Record<string, unknown> | undefined;
      const text = enrichment?.text as Record<string, unknown> | undefined;
      const thesis = typeof text?.visualThesis === "string" ? text.visualThesis : undefined;
      if (thesis) {
        visualIdentities[id] = thesis;
      }
    }

    const items = eligible.map((c) => {
      const primaryRole = c.roleAssignments?.find((r) => r.isPrimary) || c.roleAssignments?.[0];
      const entity = buildQueueEntity(primaryRole, c);
      return {
        entity,
        type: "entityChronicle",
        prompt: "",
        chronicleStep: "regenerate_image_refs",
        chronicleId: c.chronicleId,
        visualIdentities,
      };
    });
    onEnqueue(items);
    setBulkImageRefResult({ success: true, count: eligible.length });
    setTimeout(() => setBulkImageRefResult(null), 4000);
  }, [chronicleItems, onEnqueue, fullEntityMapRef]);
```

**Step 2: Add to return object**

Add to the return statement:

```typescript
    // Bulk image ref regeneration
    bulkImageRefResult,
    setBulkImageRefResult,
    handleBulkRegenerateImageRefs,
```

**Step 3: Commit**

```bash
git add apps/illuminator/webui/src/components/chronicle-panel/useChronicleBulkOperations.ts
git commit -m "feat: add bulk regenerate image refs operation"
```

---

### Task 6: Pass `fullEntityMapRef` to bulk operations

**Files:**
- Modify: `apps/illuminator/webui/src/components/chronicle-panel/ChroniclePanel.tsx` (~line 222)

**Step 1: Add `fullEntityMapRef` to `useChronicleBulkOperations` call**

Find the call (around line 222):

```typescript
  const bulk = useChronicleBulkOperations({
    simulationRunId, chronicleItems, onEnqueue, refresh,
    historianConfigured, historianConfig, skipCompletedPrep,
  });
```

Add `fullEntityMapRef`:

```typescript
  const bulk = useChronicleBulkOperations({
    simulationRunId, chronicleItems, onEnqueue, refresh,
    historianConfigured, historianConfig, skipCompletedPrep,
    fullEntityMapRef,
  });
```

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/components/chronicle-panel/ChroniclePanel.tsx
git commit -m "feat: pass fullEntityMapRef to bulk operations"
```

---

### Task 7: Add button to ChronicleBulkActions

**Files:**
- Modify: `apps/illuminator/webui/src/components/chronicle-panel/ChronicleBulkActions.tsx`
- Modify: `apps/illuminator/webui/src/components/chronicle-panel/ChroniclePanel.tsx` (pass new prop)

**Step 1: Add prop to `ChronicleBulkActions`**

Add to the props interface:

```typescript
  onBulkRegenerateImageRefs: () => void;
```

Add to destructuring in the component.

**Step 2: Add button**

Add near the other bulk operation buttons (near the "Generate Summaries" button, around line 183):

```tsx
            <button
              onClick={onBulkRegenerateImageRefs}
              className="illuminator-button"
              title="Regenerate image refs for all chronicles: convert entity refs to scene images, fix stale anchors"
            >
              Regenerate Image Refs
            </button>
```

**Step 3: Pass prop from ChroniclePanel**

In `ChroniclePanel.tsx`, find where `ChronicleBulkActions` is rendered and add:

```tsx
        onBulkRegenerateImageRefs={bulk.handleBulkRegenerateImageRefs}
```

**Step 4: Commit**

```bash
git add apps/illuminator/webui/src/components/chronicle-panel/ChronicleBulkActions.tsx \
        apps/illuminator/webui/src/components/chronicle-panel/ChroniclePanel.tsx
git commit -m "feat: add Regenerate Image Refs button to bulk actions"
```

---

### Task 8: Modify `buildImageRefsPrompt` to remove entity_ref option

**Files:**
- Modify: `apps/illuminator/webui/src/workers/tasks/chronicleTask.ts` (~lines 2106-2265, `formatImageRefEntities` and `buildImageRefsPrompt`)

**Step 1: Replace `formatImageRefEntities` with visual identity formatter**

Replace `formatImageRefEntities` (lines 2106-2122) with:

```typescript
function formatImageRefVisualIdentities(
  visualIdentities?: Record<string, string>,
): string {
  if (!visualIdentities) return "(none available)";
  const entries = Object.entries(visualIdentities);
  if (entries.length === 0) return "(none available)";
  return entries.map(([id, thesis]) => `- ${id}: ${thesis}`).join("\n");
}
```

**Step 2: Update `buildImageRefsPrompt`**

Replace the function body (lines 2193-2265). The key changes:
- Replace `## Available Entities` with `## Visual Identities`
- Remove `entity_ref` from the instructions and output format
- Only `prompt_request` is offered
- Add instruction to incorporate visual identities into scene descriptions

```typescript
function buildImageRefsPrompt(
  content: string,
  _chronicleContext: ChronicleGenerationContext,
  visualIdentities?: Record<string, string>,
): string {
  const visualDisplay = formatImageRefVisualIdentities(visualIdentities);
  const chunks = splitIntoChunks(content);

  const chunksDisplay = chunks
    .map((chunk, i) => {
      return `### CHUNK ${i + 1} of ${chunks.length}
${chunk.text}
---`;
    })
    .join("\n\n");

  return `You are adding image references to a chronicle. Your task is to identify optimal placement points for images that enhance the narrative.

## Visual Identities
These describe what entities look like — incorporate them into scene descriptions so the image generator knows what figures look like.
${visualDisplay}

## Instructions
The chronicle has been divided into ${chunks.length} chunks. For EACH chunk, decide whether it deserves an image (0 or 1 per chunk). This ensures images are distributed throughout the narrative.

For each image, provide a scene description:
- Describe a vivid 1-2 sentence scene capturing the dramatic moment
- Include visual details of involved entities using the Visual Identities above
- Include involvedEntityIds with at least one entity that appears in the scene

## Output Format
Return a JSON object:
{
  "imageRefs": [
    {
      "type": "prompt_request",
      "sceneDescription": "<vivid 1-2 sentence scene description>",
      "involvedEntityIds": ["<entity-id-1>", "<entity-id-2>"],
      "anchorText": "<exact 5-15 word phrase from the chronicle>",
      "size": "small|medium|large|full-width",
      "caption": "<optional>"
    }
  ]
}

## Size Guidelines
- small: 150px, supplementary/margin images
- medium: 300px, standard images
- large: 450px, key scenes
- full-width: 100%, establishing shots

## Rules
- Suggest 0 or 1 image per chunk (total 2-5 images for the whole chronicle)
- anchorText MUST be an exact phrase from that chunk's text
- involvedEntityIds MUST use IDs from the Visual Identities list
- involvedEntityIds MUST contain at least one entity ID
- Return valid JSON only, no markdown

## Chronicle Chunks
${chunksDisplay}`;
}
```

**Step 3: The `formatImageRefEntities` function is now unused — delete it**

Remove lines 2106-2122 (the old `formatImageRefEntities` function).

**Step 4: Commit**

```bash
git add apps/illuminator/webui/src/workers/tasks/chronicleTask.ts
git commit -m "feat: remove entity_ref from future image refs generation prompt"
```

---

### Task 9: Add toast for bulk image ref result

**Files:**
- Modify: `apps/illuminator/webui/src/components/chronicle-panel/ChroniclePanelToasts.tsx` (or wherever the existing toasts are)
- Modify: `apps/illuminator/webui/src/components/chronicle-panel/ChroniclePanel.tsx` (render the toast)

**Step 1: Add toast component**

Follow the pattern of `BulkSummaryToast`. Add:

```tsx
export function BulkImageRefToast({ result, onDismiss }: {
  result: OperationResult | null;
  onDismiss: () => void;
}) {
  if (!result) return null;
  return (
    <div className="chronicle-toast">
      {result.success
        ? result.count === 0
          ? "No chronicles with image refs to regenerate"
          : `Enqueued image ref regeneration for ${result.count} chronicles`
        : `Error: ${result.error}`}
      <button onClick={onDismiss} className="chronicle-toast-dismiss">×</button>
    </div>
  );
}
```

**Step 2: Render in ChroniclePanel**

Add alongside the other toasts:

```tsx
<BulkImageRefToast
  result={bulk.bulkImageRefResult}
  onDismiss={() => bulk.setBulkImageRefResult(null)}
/>
```

**Step 3: Commit**

```bash
git add apps/illuminator/webui/src/components/chronicle-panel/ChroniclePanelToasts.tsx \
        apps/illuminator/webui/src/components/chronicle-panel/ChroniclePanel.tsx
git commit -m "feat: add toast for bulk image ref regeneration result"
```

---

### Task 10: Final integration commit

**Step 1: Verify no TypeScript errors**

Check that all imports resolve and types align. The dev server's HMR will show any issues.

**Step 2: Manual test plan**

1. Open the Illuminator UI
2. Navigate to a simulation with chronicles that have image refs
3. Open the bulk actions panel
4. Click "Regenerate Image Refs"
5. Verify tasks are enqueued in the queue panel
6. Wait for completion
7. Check a chronicle's ImagesTab — all refs should now be `prompt_request` type
8. Check that anchors point to valid text in the chronicle
9. Test the normal "Generate Image Refs" button on a single chronicle — should only produce `prompt_request` refs

**Step 3: Commit**

If any integration fixes were needed, commit them:

```bash
git commit -m "fix: integration fixes for regenerate image refs"
```
