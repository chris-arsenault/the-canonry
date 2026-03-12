# Entity Image Style Assignment & Curation — Design

## Goal

Port the chronicle image style pipeline (LLM tagging → deterministic primary assignment → pair-novelty secondary assignment → bulk generation → curation) to entity images. Emphasize coverage of unused styles across the entity corpus.

## Architecture

Mirror the chronicle model exactly. Each entity keeps one active image (`enrichment.image.imageId`). Historical images stay in the image store, queryable by `entityId`. Style assignments live on a new `enrichment.imageStyle` block, independent of whether an image exists.

---

## Data Model

New `imageStyle` block on `EntityEnrichment` (sibling to existing `image`):

```typescript
imageStyle?: {
  // LLM-assigned ranked lists (top 3 per dimension)
  rankedArtisticStyleIds: string[];
  rankedCompositionStyleIds: string[];
  rankedColorPaletteIds: string[];
  visualTags: string[];
  // Deterministic primary assignment (distribution-balanced)
  suggestedArtisticStyleId: string;
  suggestedCompositionStyleId: string;
  suggestedColorPaletteId: string;
  // Pair-novelty secondary assignment
  secondaryArtisticStyleId?: string;
  secondaryCompositionStyleId?: string;
  secondaryColorPaletteId?: string;
}
```

Style IDs are also persisted on the `ImageRecord` metadata when generated (already supported fields: `artisticStyleId`, `compositionStyleId`, `colorPaletteId`).

---

## LLM Tagging Task

New worker task: `entityTagImageStylesTask.ts`.

**Input:** Batch of entities with visual theses. Eligibility: has visual thesis, prominence meets threshold.

**Prompt structure:**
- Style/composition/palette catalogs grouped by category (same format as `chronicleTagImageRefsTask`)
- Entity list: `[entityId] (kind/subtype) visualThesis | trait1, trait2, ...`
- Output: JSON array of `{ entityId, tags[2-4], artisticStyleIds[3], compositionStyleIds[3], colorPaletteIds[3] }`

**Coverage rules (critical):**
- Every artistic style, composition, and palette in the library MUST appear in at least one entity's top 3 across the batch
- No single style as #1 pick for more than ~20% of entities
- 3 picks must span at least 2 different categories per dimension

**Composition matching:** No kind-based constraints. The LLM picks compositions based on what makes an interesting image — a character in a sweeping landscape, a faction as a symbolic object study, a location as an intimate portrait detail. Unexpected pairings are encouraged. The only constraint is coverage: every composition must appear somewhere.

**Write-back:** Results stored on `enrichment.imageStyle.ranked*`, `visualTags`, and `suggested*` (top pick as backwards-compat primary).

---

## Bulk Operations

New hook: `useEntityBulkImageOperations.ts`.

### Operations

1. **Tag Styles** — Enqueues the LLM batch tagging task. All eligible entities in one call.

2. **Assign Primary** — Reads `enrichment.imageStyle.ranked*` from all tagged entities, calls `assignImageStyles(rankings, styleLibrary)` (reused from `imageStyleAssignment.ts`), writes back `suggested*` fields. For the rankings adapter, use `entityId` as both `chronicleId` and `refId`.

3. **Assign Secondary** — Reads ranked lists + primary assignments, calls `assignSecondaryStyles(rankings, primaries)`, writes back `secondary*` fields.

4. **Bulk Clear Images** — Clears `enrichment.image` on all entities. Image blobs remain in the store for catalog/history queries.

5. **Bulk Generate** — Iterates entities with style assignments. Resolves style fragments from `StyleLibrary` using the assigned IDs (primary or secondary based on toggle). Builds prompt via existing `buildImagePromptFromGuidance()` with `styleInfo` populated from the assignment. Enqueues image tasks with 10s delay between items.

### Primary/Secondary Toggle

Same `useSecondaryStyles` state pattern as chronicles. Shared checkbox in the bulk actions UI controls which set of IDs the generate operation reads.

### Algorithm Reuse

`assignImageStyles()` and `assignSecondaryStyles()` from `imageStyleAssignment.ts` operate on `ImageRefRanking[]` — a generic interface. Entity rankings map directly:
- `chronicleId` → `entityId`
- `refId` → `entityId` (one image per entity, so same value)

No changes to the algorithms needed.

---

## Curation Page

New component: `EntityImageCurationPanel`.

### Left Nav

Entities grouped by kind, then by culture within each kind. Collapsible groups. Each group shows image coverage count (e.g., "faction (12/15)"). Clicking a group scrolls/filters the middle area.

### Middle Area

Grid of entity cards for the selected group. Each card shows:
- Thumbnail of active image (or placeholder)
- Entity name, subtype
- Style assignment indicators: `✦ ◈ ◉` symbols with primary (gold) and secondary (purple) highlights
- Status badge: complete / missing / has-secondary-available

### Image Selection

Click a card → query image store for all images with that `entityId` → display as a selection grid. Pick one to set as active (`enrichment.image.imageId`). This is the "assign primary picture for print/viewer" workflow.

### Grouping Display

The middle area respects the left nav grouping. When "All" or a kind is selected, entities display in kind → culture sections with section headers. This gives a visual overview of style variety within each group.

---

## Files Touched

| Area | File | Change |
|------|------|--------|
| Types | `enrichmentTypes.ts` | Add `imageStyle` to `EntityEnrichment` |
| Types | `entityNav.ts` | Add `hasImageStyle` flag to `EntityNavItem` |
| Worker | `entityTagImageStylesTask.ts` | New LLM batch tagging task |
| Worker | `enrichmentWorker.ts` | Register new task type |
| Hook | `useEntityBulkImageOperations.ts` | New bulk operations hook |
| UI | `EntityImageCurationPanel.tsx` | New curation page component |
| UI | `EntityImageCurationPanel.css` | Styles for curation page |
| UI | `IlluminatorTabContent.jsx` | Wire curation panel into tab system |
| Existing | `imageStyleAssignment.ts` | No changes (reused as-is) |
| Existing | `promptBuilders.ts` | No changes (already accepts `styleInfo`) |
| Existing | `imageSettings.ts` | No changes |
