# Regenerate Image Refs Design

## Problem

Chronicle image refs contain two types: `entity_ref` (references entity portrait images) and `prompt_request` (custom scene images). Entity refs are no longer wanted — all image refs should be custom chronicle images. Additionally, many image refs have stale anchors pointing to text that no longer exists after chronicle edits/regeneration.

## Solution

Three changes:

1. A new chronicle step `regenerate_image_refs` that converts entity refs to prompt requests, fixes stale anchors, and preserves valid refs
2. A bulk operation to run this across all chronicles
3. A prompt change so future `image_refs` generations only produce `prompt_request` refs

## Step: `regenerate_image_refs`

### Behavior

The LLM receives the chronicle's current content and existing image refs. For each ref it produces one of four dispositions:

- **kept** — `prompt_request` ref with valid anchor and fitting scene description. Returned as-is (same refId, anchor, scene description).
- **converted** — `entity_ref` converted to `prompt_request`. New scene description generated, anchor relocated if needed.
- **relocated** — `prompt_request` ref whose anchor text is gone. New anchor found in current text, scene description preserved or updated if context changed significantly.
- **dropped** — ref whose scene is completely irrelevant to the current text. Removed from the output.

### Prompt Design

Input to the LLM:
- Full chronicle content (chunked as in current image_refs step)
- Existing image refs with their type, anchorText, size, caption, and (for prompt_request) sceneDescription
- Visual identities (entity visual theses) for scene description generation

Output: JSON with updated refs array, each tagged with disposition.

```json
{
  "imageRefs": [
    {
      "disposition": "kept",
      "refId": "<original refId>",
      "anchorText": "<same anchor>",
      "sceneDescription": "<same description>",
      "size": "medium",
      "caption": "..."
    },
    {
      "disposition": "converted",
      "originalRefId": "<entity_ref refId>",
      "anchorText": "<anchor in current text>",
      "sceneDescription": "<new scene description>",
      "involvedEntityIds": ["..."],
      "size": "medium"
    },
    {
      "disposition": "relocated",
      "originalRefId": "<original refId>",
      "anchorText": "<new anchor in current text>",
      "sceneDescription": "<preserved or updated>",
      "involvedEntityIds": ["..."],
      "size": "medium"
    }
  ]
}
```

Dropped refs are simply absent from the output.

### Execution

1. Load chronicle record from DB
2. Resolve active version content
3. Build visual identities from entity enrichments
4. Build prompt with existing refs + content
5. Parse response into `PromptRequestRef[]` (all refs become prompt_request)
6. Resolve anchor indices with `resolveAnchorPhrase`
7. Save via `updateChronicleImageRefs`

### Task Payload

- `chronicleStep: "regenerate_image_refs"`
- `chronicleId` — required
- `visualIdentities` — entity visual theses (built by caller)
- Does NOT need `chronicleContext` — reads content from DB

## Bulk Operation

In `useChronicleBulkOperations.ts`, new `handleBulkRegenerateImageRefs` callback:

- Filters chronicles to `complete` or `assembly_ready` status AND has existing image refs
- For each eligible chronicle, enqueues task with `chronicleStep: "regenerate_image_refs"`
- Builds `visualIdentities` from the full entity map
- Button in ChroniclePanel bulk operations section
- Result toast showing count enqueued

## Future Behavior: Remove `entity_ref` from Generation

Modify `buildImageRefsPrompt` in `chronicleTask.ts`:

- Remove "Entity Reference" option from the prompt instructions
- Remove entity list section — instead include visual identities inline so scene descriptions reference entity appearances
- Only `prompt_request` is offered as an option

`parseImageRefsResponse` continues to accept `entity_ref` for backwards compatibility with existing stored data.

The `EntityImageRef` type remains in `chronicleTypes.ts` — existing data still uses it.

## Files Changed

| File | Change |
|------|--------|
| `enrichmentTypes.ts` | Add `"regenerate_image_refs"` to `ChronicleStep` |
| `chronicleTask.ts` | New step handler, new prompt builder, modify `buildImageRefsPrompt` |
| `useChronicleBulkOperations.ts` | New `handleBulkRegenerateImageRefs` callback |
| `ChroniclePanel.tsx` | Wire up bulk button |
| `chroniclePanelTypes.ts` | Add nav item field for hasEntityRefs if needed for filtering |
| `chronicleNav.ts` | Derive hasEntityRefs or imageRefCount from record |

## Files Not Changed

| File | Reason |
|------|--------|
| `chronicleTypes.ts` | `EntityImageRef` stays for backwards compat |
| `imageRefCompatibility.ts` | LLM handles anchor validation in the new step |
| `chronicleImageOps.ts` | Reuses existing `updateChronicleImageRefs` |
