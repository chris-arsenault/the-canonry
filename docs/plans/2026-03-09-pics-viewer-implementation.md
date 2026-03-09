# pics.theiceremembers.com Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a public image viewer site at pics.theiceremembers.com with supporting metadata pipeline — data model extensions, deterministic metadata tracking, a catalog curation UI for back-tagging, S3 sync extensions, and the viewer app itself.

**Architecture:** Extend `ImageMetadata` with style/composition/palette fields, thread them through the generation pipeline, add a "Catalog" tab in Illuminator for back-tagging existing images (deterministic fill → LLM fill → review), extend Canonry's S3 sync to build `catalog.json`, and create a new mobile-first static viewer app.

**Tech Stack:** React, Vite, CSS columns (masonry), Dexie (IndexedDB), existing S3/CloudFront infrastructure, existing LLM task worker.

**Design doc:** `docs/plans/2026-03-09-pics-viewer-design.md`

**Note:** The existing "Curation" tab handles chronicle-level image layout. This plan uses "Catalog" for the new image metadata tagging feature to avoid name collision.

---

## Phase 1: Data Model & Pipeline

### Task 1: Extend ImageMetadata type

**Files:**
- Modify: `apps/illuminator/webui/src/lib/imageTypes.ts`

**Step 1: Expand ImageType**

In `imageTypes.ts` line 9, change:
```typescript
// Before
export type ImageType = "entity" | "chronicle";

// After
export type ImageType = "entity" | "scene" | "cover" | "other";
```

**Step 2: Add new fields to ImageMetadata**

In `imageTypes.ts` after the `sceneDescription` field (line 53), add:
```typescript
  /** Artistic style ID from StyleSelection at generation time */
  artisticStyleId?: string;
  /** Composition style ID from StyleSelection at generation time */
  compositionStyleId?: string;
  /** Color palette ID from StyleSelection at generation time */
  colorPaletteId?: string;
  /** Human-readable display title (deterministic) */
  title?: string;
  /** Descriptive tags (from visualTags on chronicle refs, or LLM-generated) */
  tags?: string[];
```

**Step 3: Commit**
```
feat: extend ImageMetadata with style IDs, title, and tags
```

---

### Task 2: Dexie schema migration

**Files:**
- Modify: `apps/illuminator/webui/src/lib/db/illuminatorDb.ts`

**Step 1: Add v11 schema version**

After the v10 block (around line 423), add a new version:
```typescript
this.version(11).stores({
  // No index changes needed — new fields are not indexed.
  // This version just bumps to signal the schema change.
  // Dexie auto-preserves existing data on version bump with no store changes.
});
```

Note: `artisticStyleId`, `compositionStyleId`, `colorPaletteId`, `title`, and `tags` don't need Dexie indexes — they're used for client-side filtering in the catalog builder and curation UI, not for Dexie queries.

**Step 2: Commit**
```
chore: bump Dexie schema to v11 for new image metadata fields
```

---

### Task 3: Thread style IDs through image generation pipeline

**Files:**
- Modify: `apps/illuminator/webui/src/workers/types.ts` (add style fields to task type)
- Modify: `apps/illuminator/webui/src/workers/tasks/imageTask.ts` (persist style fields)
- Modify: `apps/illuminator/webui/src/hooks/usePromptBuilder.ts` (pass style IDs into task)

**Step 1: Add style fields to the image task type**

In `workers/types.ts`, find the image task payload type and add:
```typescript
artisticStyleId?: string;
compositionStyleId?: string;
colorPaletteId?: string;
```

**Step 2: Persist style fields in imageTask.ts**

In `imageTask.ts` at the `saveImage()` call (around line 331), add the three new fields to the metadata object:
```typescript
artisticStyleId: task.artisticStyleId,
compositionStyleId: task.compositionStyleId,
colorPaletteId: task.colorPaletteId,
```

**Step 3: Generate deterministic title in imageTask.ts**

After the `saveImage()` call, or inline with the metadata, compute the title:
```typescript
// Deterministic title generation
const title = task.imageType === "cover"
  ? `${task.entityName || "Unknown"} Cover`
  : task.sceneDescription
    ? task.sceneDescription.slice(0, 120)
    : task.entityName
      ? `${task.entityName}`
      : "Untitled";
```

Add `title` to the saveImage metadata object.

**Step 4: Copy tags from task**

Add `tags: task.tags || []` to the saveImage metadata object. The task should carry tags from the chronicle ref's `visualTags` when available.

**Step 5: Pass style IDs from usePromptBuilder into the task**

In `usePromptBuilder.ts`, where `resolveStyleSelection()` is called (around line 256), the resolved style IDs are available as `resolvedStyle.artisticStyle?.id`, `resolvedStyle.compositionStyle?.id`, `resolvedStyle.colorPalette?.id`. These need to flow into the task payload that's enqueued to the worker.

Trace the call chain from `usePromptBuilder` → task enqueueing to find where the task object is constructed, and add the three fields there.

**Step 6: Use expanded imageType values**

Where chronicle image tasks are created, set `imageType` to `"scene"` (for PromptRequestRef images) or `"cover"` (for ChronicleCoverImage images) instead of the generic `"chronicle"`.

Check `apps/illuminator/webui/src/components/chronicle-panel/useChronicleImageCallbacks.ts` and `apps/illuminator/webui/src/components/chronicle-panel/useChronicleBulkOperations.ts` for where image tasks are enqueued with `imageType: "chronicle"`.

**Step 7: Commit**
```
feat: persist style IDs, title, and tags in image generation pipeline
```

---

## Phase 2: Catalog Builder

### Task 4: Create catalog.json builder function

**Files:**
- Create: `apps/illuminator/webui/src/lib/catalogBuilder.ts`

**Step 1: Write the catalog builder**

This is a pure function that reads all images from Dexie and produces the catalog structure:

```typescript
import { db } from "./db/illuminatorDb";
import type { ImageAspect, ImageType } from "./imageTypes";

export interface ImageCatalogEntry {
  imageId: string;
  title: string;
  artisticStyleId: string;
  compositionStyleId: string;
  colorPaletteId: string;
  imageType: ImageType;
  tags: string[];
  entityName?: string;
  entityKind?: string;
  entityCulture?: string;
  model: string;
  width: number;
  height: number;
  aspect: ImageAspect;
  generatedAt: number;
  thumbPath: string;
  fullPath: string;
}

export interface ImageCatalog {
  version: 1;
  generatedAt: string;
  baseUrl: string;
  images: ImageCatalogEntry[];
  facets: {
    artisticStyles: string[];
    compositionStyles: string[];
    colorPalettes: string[];
    entityKinds: string[];
    cultures: string[];
    models: string[];
    imageTypes: string[];
  };
}

/**
 * Build catalog.json from all images in Dexie.
 *
 * @param baseUrl - CloudFront domain for image CDN
 * @param projectId - Project to export
 * @param imagePrefix - S3 base prefix (e.g. "canonry")
 */
export async function buildCatalog(
  baseUrl: string,
  projectId: string,
  imagePrefix: string,
): Promise<ImageCatalog> {
  const allImages = await db.images
    .where("projectId")
    .equals(projectId)
    .toArray();

  const entries: ImageCatalogEntry[] = [];
  const facetSets = {
    artisticStyles: new Set<string>(),
    compositionStyles: new Set<string>(),
    colorPalettes: new Set<string>(),
    entityKinds: new Set<string>(),
    cultures: new Set<string>(),
    models: new Set<string>(),
    imageTypes: new Set<string>(),
  };

  for (const img of allImages) {
    // Skip images without required fields
    if (!img.imageId || !img.width || !img.height) continue;

    const imageType = img.imageType || "other";
    const entry: ImageCatalogEntry = {
      imageId: img.imageId,
      title: img.title || img.entityName || "Untitled",
      artisticStyleId: img.artisticStyleId || "unknown",
      compositionStyleId: img.compositionStyleId || "unknown",
      colorPaletteId: img.colorPaletteId || "unknown",
      imageType,
      tags: img.tags || [],
      entityName: img.entityName,
      entityKind: img.entityKind,
      entityCulture: img.entityCulture,
      model: img.model,
      width: img.width,
      height: img.height,
      aspect: img.aspect || "square",
      generatedAt: img.generatedAt,
      thumbPath: buildImagePath(imagePrefix, "thumb", projectId, img.imageId),
      fullPath: buildImagePath(imagePrefix, "webp", projectId, img.imageId),
    };
    entries.push(entry);

    // Accumulate facets
    if (entry.artisticStyleId !== "unknown") facetSets.artisticStyles.add(entry.artisticStyleId);
    if (entry.compositionStyleId !== "unknown") facetSets.compositionStyles.add(entry.compositionStyleId);
    if (entry.colorPaletteId !== "unknown") facetSets.colorPalettes.add(entry.colorPaletteId);
    if (entry.entityKind) facetSets.entityKinds.add(entry.entityKind);
    if (entry.entityCulture) facetSets.cultures.add(entry.entityCulture);
    facetSets.models.add(entry.model);
    facetSets.imageTypes.add(imageType);
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseUrl,
    images: entries.sort((a, b) => b.generatedAt - a.generatedAt),
    facets: {
      artisticStyles: [...facetSets.artisticStyles].sort(),
      compositionStyles: [...facetSets.compositionStyles].sort(),
      colorPalettes: [...facetSets.colorPalettes].sort(),
      entityKinds: [...facetSets.entityKinds].sort(),
      cultures: [...facetSets.cultures].sort(),
      models: [...facetSets.models].sort(),
      imageTypes: [...facetSets.imageTypes].sort(),
    },
  };
}

function buildImagePath(prefix: string, variant: string, projectId: string, imageId: string): string {
  const parts = [prefix, variant, projectId, `${imageId}.webp`].filter(Boolean);
  return parts.join("/");
}
```

**Step 2: Commit**
```
feat: add catalog.json builder for pics viewer
```

---

## Phase 3: Catalog Tab in Illuminator

### Task 5: Add Catalog tab shell

**Files:**
- Create: `apps/illuminator/webui/src/components/CatalogTab.tsx`
- Create: `apps/illuminator/webui/src/components/CatalogTab.css`
- Modify: `apps/illuminator/webui/src/components/IlluminatorSidebar.jsx` (add tab entry)
- Modify: `apps/illuminator/webui/src/components/IlluminatorTabContent.jsx` (wire component)

**Step 1: Create CatalogTab.tsx shell**

```typescript
import React, { useState } from "react";
import { useIlluminatorConfigStore } from "../lib/db/illuminatorConfigStore";
import "./CatalogTab.css";

export default function CatalogTab() {
  const { projectId, simulationRunId } = useIlluminatorConfigStore();
  const [view, setView] = useState<"report" | "review">("report");

  if (!simulationRunId) {
    return (
      <div className="illuminator-content">
        <div className="catalog-empty">No simulation loaded.</div>
      </div>
    );
  }

  return (
    <div className="illuminator-content">
      <div className="catalog-workspace">
        <div className="catalog-toolbar">
          <button
            className={view === "report" ? "active" : ""}
            onClick={() => setView("report")}
          >
            Coverage Report
          </button>
          <button
            className={view === "review" ? "active" : ""}
            onClick={() => setView("review")}
          >
            Review &amp; Edit
          </button>
        </div>
        <div className="catalog-content">
          {view === "report" ? (
            <div className="catalog-placeholder">Coverage report — coming next</div>
          ) : (
            <div className="catalog-placeholder">Review screen — coming next</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create minimal CatalogTab.css**

**Step 3: Add to IlluminatorSidebar.jsx TABS array**

Add `{ id: "catalog", label: "Catalog" }` to the TABS array.

**Step 4: Wire in IlluminatorTabContent.jsx**

Import CatalogTab and add `catalog: CatalogTab` to TAB_COMPONENTS.

**Step 5: Verify** — dev server shows new tab, clicking it renders the shell.

**Step 6: Commit**
```
feat: add Catalog tab shell to Illuminator
```

---

### Task 6: Coverage report component

**Files:**
- Create: `apps/illuminator/webui/src/components/catalog/CoverageReport.tsx`
- Create: `apps/illuminator/webui/src/lib/catalogAnalysis.ts`
- Modify: `apps/illuminator/webui/src/components/CatalogTab.tsx` (integrate)

**Step 1: Write catalogAnalysis.ts — the scan logic**

This module scans all images in Dexie and all chronicle records to produce the coverage report. It should:

1. Load all image records from Dexie for the current project
2. Load all chronicle records to access `imageRefs` and `coverImage` data
3. For each metadata field (`artisticStyleId`, `compositionStyleId`, `colorPaletteId`, `imageType`, `title`, `tags`):
   - Count how many images have the field present
   - Count how many are missing
   - Count how many missing ones are **derivable** (and from what source)
4. Return a structured report

Derivability rules:
- `imageType`: derivable for all images — entity images stay "entity", look up chronicle refs to classify "scene" vs "cover"
- `title`: derivable for all images — entityName pattern or sceneDescription
- `tags`: derivable where a linked PromptRequestRef has `visualTags`
- `artisticStyleId`: derivable where a linked PromptRequestRef has `suggestedArtisticStyleId`
- `compositionStyleId`: same pattern
- `colorPaletteId`: same pattern

For "remaining gaps after deterministic fill", split by:
- Has `finalPrompt` or `originalPrompt` (can send to LLM)
- Has no prompt data (needs manual or skip)

```typescript
export interface FieldCoverage {
  field: string;
  present: number;
  missing: number;
  derivable: number;
  derivableSource: string;
  remainingAfterFill: number;
  remainingWithPrompt: number;
  remainingNoPrompt: number;
}

export interface CoverageReport {
  totalImages: number;
  fields: FieldCoverage[];
  generatedAt: number;
}

export async function analyzeCoverage(projectId: string): Promise<CoverageReport> {
  // Implementation: scan images + chronicles, compute per-field stats
}
```

**Step 2: Write CoverageReport.tsx**

Table component rendering the `CoverageReport` data. Each row shows field name, present/missing counts, derivable count, remaining gaps. Include a "Run Deterministic Fill" button at the bottom.

Follow the dense information display pattern from CLAUDE.md — compact table, no badge components.

**Step 3: Integrate into CatalogTab.tsx**

Replace the "Coverage report — coming next" placeholder.

**Step 4: Commit**
```
feat: add catalog coverage report with derivability analysis
```

---

### Task 7: Deterministic fill operation

**Files:**
- Create: `apps/illuminator/webui/src/lib/catalogDeterministicFill.ts`
- Modify: `apps/illuminator/webui/src/components/catalog/CoverageReport.tsx` (wire button)

**Step 1: Write the deterministic fill function**

```typescript
export interface FillResult {
  updated: number;
  skipped: number;
  errors: number;
  details: { imageId: string; fieldsSet: string[] }[];
}

export async function runDeterministicFill(projectId: string): Promise<FillResult> {
  // 1. Load all images for project
  // 2. Load all chronicles to build ref lookup maps:
  //    - imageId → PromptRequestRef (via generatedImageId)
  //    - imageId → ChronicleCoverImage (via coverImage.generatedImageId)
  // 3. For each image, compute updates:
  //    - imageType reclassification
  //    - title from entityName/sceneDescription pattern
  //    - tags from visualTags on linked ref
  //    - artisticStyleId from suggestedArtisticStyleId on linked ref
  //    - compositionStyleId from suggestedCompositionStyleId
  //    - colorPaletteId from suggestedColorPaletteId
  // 4. Batch write updates to Dexie
  // Return summary of what was filled
}
```

Key implementation detail: build a reverse lookup from `generatedImageId` on all PromptRequestRefs and ChronicleCoverImages back to the chronicle/ref that produced them. This lets us find the metadata source for any chronicle image.

**Step 2: Wire the button in CoverageReport.tsx**

The "Run Deterministic Fill" button calls `runDeterministicFill()`, shows a progress indicator, then re-runs `analyzeCoverage()` to refresh the report.

**Step 3: Commit**
```
feat: deterministic metadata fill for existing images
```

---

### Task 8: LLM batch fill operation

**Files:**
- Create: `apps/illuminator/webui/src/lib/catalogLlmFill.ts`
- Modify: `apps/illuminator/webui/src/lib/llmCallTypes.ts` (add new call type)
- Modify: `apps/illuminator/webui/src/components/catalog/CoverageReport.tsx` (add LLM fill button)

**Step 1: Add LLM call type**

In `llmCallTypes.ts`, add:
```typescript
"catalog.inferMetadata"  // Infer style/composition/palette from image prompt
```

**Step 2: Write catalogLlmFill.ts**

The function:
1. Queries images that are missing style fields but have prompt data
2. Batches them (20-50 per LLM call)
3. For each batch, sends prompts + valid style/composition/palette ID lists to Claude
4. Claude returns best-match IDs + optional tags for each image
5. Stores results as **pending** — not written to Dexie until reviewed

```typescript
export interface LlmFillCandidate {
  imageId: string;
  prompt: string;  // finalPrompt or originalPrompt
}

export interface LlmFillResult {
  imageId: string;
  artisticStyleId?: string;
  compositionStyleId?: string;
  colorPaletteId?: string;
  tags?: string[];
  confidence: number;  // 0-1, from LLM self-assessment
}

export interface LlmFillBatchResult {
  results: LlmFillResult[];
  cost: { estimated: number; actual: number };
  processed: number;
  errors: number;
}

export async function runLlmFill(
  projectId: string,
  styleLibrary: StyleLibrary,
  onProgress: (done: number, total: number) => void,
): Promise<LlmFillBatchResult> {
  // Implementation uses existing worker task infrastructure
  // to make LLM calls via the same pattern as chronicle.batchTagImageRefs
}
```

The LLM prompt should include:
- The image's original/final prompt text
- The full list of valid artistic style IDs + names
- The full list of valid composition style IDs + names
- The full list of valid color palette IDs + names
- Instructions to return the best match for each, with confidence score

**Step 3: Wire into CoverageReport**

Add "Run LLM Fill" button that's enabled only after deterministic fill has been run. Shows estimated cost before running. Results go to a pending review queue (stored in component state or a lightweight Zustand store).

**Step 4: Commit**
```
feat: LLM batch metadata inference for images with prompts
```

---

### Task 9: Review & edit screen

**Files:**
- Create: `apps/illuminator/webui/src/components/catalog/CatalogReview.tsx`
- Create: `apps/illuminator/webui/src/components/catalog/CatalogReview.css`
- Modify: `apps/illuminator/webui/src/components/CatalogTab.tsx` (integrate)

**Step 1: Write CatalogReview.tsx**

A filterable table/grid of images showing:
- Thumbnail (small, from Dexie blob)
- Title (editable inline)
- Image type (dropdown: entity/scene/cover/other)
- Artistic style (dropdown of style library IDs)
- Composition style (dropdown)
- Color palette (dropdown)
- Tags (editable chip list)
- Source indicator: "deterministic", "LLM (confidence: 0.9)", "manual"

Features:
- Filter: "all", "LLM-tagged only", "missing fields", "low confidence (<0.7)"
- Sort: by image type, by confidence, by date
- Bulk actions: "Approve selected" (writes to Dexie), "Reject selected" (clears pending)
- Individual inline editing for any field
- Select all / deselect all

The review screen shows both already-persisted metadata and pending LLM results (with visual distinction).

**Step 2: Wire into CatalogTab.tsx**

Replace the "Review screen — coming next" placeholder. Pass `styleLibrary` through for dropdown population.

**Step 3: Commit**
```
feat: catalog review and edit screen for image metadata
```

---

## Phase 4: S3 Sync Extension

### Task 10: Add catalog.json to Canonry S3 sync

**Files:**
- Modify: `apps/canonry/webui/src/aws/awsS3.js` (add catalog build + upload)
- Modify: `apps/canonry/webui/src/hooks/useAwsCallbacks.ts` (extend sync flow)

**Step 1: Add catalog upload to sync flow**

In `awsS3.js`, add a function:
```javascript
export async function uploadCatalog(s3, config, projectId, catalogJson) {
  const key = toS3Key(config.basePrefix, "catalog.json");
  await s3.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: JSON.stringify(catalogJson),
    ContentType: "application/json",
    CacheControl: "public, max-age=120",
  }));
}
```

**Step 2: Extend the sync flow in useAwsCallbacks.ts**

In `doSyncImages()`, after uploading raw images:
1. Import and call `buildCatalog()` from `catalogBuilder.ts`
2. Call `uploadCatalog()` with the result
3. Report catalog upload in progress callback

**Step 3: Add in-browser webp/thumb optimization**

In `awsS3.js`, add a function that uses canvas API to:
1. Load a raw PNG blob
2. Draw to canvas
3. Export as webp at 85% quality (full) and 400px width at 80% quality (thumb)
4. Upload both to the webp/ and thumb/ prefixes

Integrate this into the sync flow: after uploading raw images, optimize any that don't have webp/thumb entries in the manifest.

**Step 4: Commit**
```
feat: extend S3 sync to build catalog.json and optimize images
```

---

## Phase 5: Pics Viewer App

### Task 11: Scaffold the pics app

**Files:**
- Create: `apps/pics/webui/package.json`
- Create: `apps/pics/webui/vite.config.js`
- Create: `apps/pics/webui/index.html`
- Create: `apps/pics/webui/src/main.tsx`
- Create: `apps/pics/webui/src/App.tsx`
- Create: `apps/pics/webui/src/styles.css`
- Create: `apps/pics/webui/tsconfig.json`
- Modify: `package.json` (root — add workspace entry and dev script)

**Step 1: Create package.json**

Minimal dependencies: `react`, `react-dom`. Dev deps: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`.

```json
{
  "name": "@the-canonry/pics",
  "private": true,
  "scripts": {
    "dev": "vite --port 5009",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

**Step 2: Create vite.config.js**

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { target: "esnext" },
  server: { port: 5009, strictPort: true },
});
```

**Step 3: Create index.html, main.tsx, App.tsx shell**

Model after `apps/viewer/webui/` structure. App.tsx should be a minimal shell:
```typescript
export default function App() {
  return (
    <div className="pics-app">
      <header className="pics-header">
        <h1>The Ice Remembers</h1>
      </header>
      <main className="pics-main">
        {/* Gallery will go here */}
      </main>
    </div>
  );
}
```

**Step 4: Create styles.css**

Mobile-first base styles. Use a similar warm palette to the viewer but lighter — this is an image-forward site, so backgrounds should be dark/neutral to let images pop.

**Step 5: Add workspace entry in root package.json**

Add `"apps/pics/webui"` to the workspaces array.

**Step 6: Install dependencies**

```bash
cd apps/pics/webui && npm install
```

**Step 7: Verify** — `npm run dev` from apps/pics/webui starts on port 5009.

**Step 8: Commit**
```
feat: scaffold pics viewer app
```

---

### Task 12: Catalog loader and state

**Files:**
- Create: `apps/pics/webui/src/useCatalog.ts`
- Create: `apps/pics/webui/src/types.ts`
- Modify: `apps/pics/webui/src/App.tsx`

**Step 1: Define types in types.ts**

Copy `ImageCatalogEntry` and `ImageCatalog` interfaces from `catalogBuilder.ts` (or create a shared package — but for now, just duplicate the read-side types to avoid a dependency).

**Step 2: Write useCatalog.ts hook**

```typescript
import { useState, useEffect } from "react";
import type { ImageCatalog } from "./types";

const CATALOG_URL = "catalog.json"; // Relative to deployment base

export function useCatalog() {
  const [catalog, setCatalog] = useState<ImageCatalog | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(CATALOG_URL, import.meta.env.BASE_URL || window.location.href);
    fetch(url.toString())
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setCatalog(data);
        setStatus("ready");
      })
      .catch((e) => {
        setError(e.message);
        setStatus("error");
      });
  }, []);

  return { catalog, status, error };
}
```

**Step 3: Wire into App.tsx**

Load catalog, show loading/error states, pass catalog to gallery when ready.

**Step 4: Commit**
```
feat: catalog loader hook for pics viewer
```

---

### Task 13: Filter/sort/search state

**Files:**
- Create: `apps/pics/webui/src/useFilters.ts`
- Create: `apps/pics/webui/src/FilterBar.tsx`
- Create: `apps/pics/webui/src/FilterBar.css`

**Step 1: Write useFilters.ts**

Manages filter state, applies filters to catalog entries, syncs with URL params:

```typescript
export interface Filters {
  search: string;
  artisticStyle: string | null;
  compositionStyle: string | null;
  colorPalette: string | null;
  entityKind: string | null;
  culture: string | null;
  model: string | null;
  imageType: string | null;
  sort: "newest" | "oldest" | "random";
}

export function useFilters(images: ImageCatalogEntry[]) {
  // State for each filter
  // Apply filters to produce filtered array
  // Sync active filters to/from URL search params
  // Return: { filters, setFilter, clearFilters, filtered, activeFilterCount }
}
```

Search should be case-insensitive substring match against title, entityName, entityCulture, and tags.

**Step 2: Write FilterBar.tsx**

Mobile-first layout:
- Search input at top (full width)
- Horizontally scrollable row of filter dropdowns
- Active filters shown as dismissible chips below
- Image count display

Each dropdown is populated from `catalog.facets`.

**Step 3: Commit**
```
feat: filter/sort/search for pics viewer
```

---

### Task 14: Masonry grid

**Files:**
- Create: `apps/pics/webui/src/MasonryGrid.tsx`
- Create: `apps/pics/webui/src/MasonryGrid.css`
- Modify: `apps/pics/webui/src/App.tsx` (integrate)

**Step 1: Write MasonryGrid.tsx**

CSS column-based masonry with lazy loading:

```typescript
interface MasonryGridProps {
  images: ImageCatalogEntry[];
  baseUrl: string;
  onImageClick: (image: ImageCatalogEntry, index: number) => void;
}
```

Implementation:
- CSS `column-count` responsive: 2 (mobile), 3 (tablet), 4-5 (desktop)
- Each image rendered as `<figure>` with `break-inside: avoid`
- Use `<img loading="lazy">` for thumbnails
- Aspect ratio set via `aspect-ratio` CSS property using `width/height` from catalog
- Title overlay on hover (desktop) or below image (mobile)
- Intersection observer for infinite scroll (render in chunks of 50)

**Step 2: Write MasonryGrid.css**

```css
.masonry-grid {
  column-count: 2;
  column-gap: 8px;
  padding: 8px;
}

@media (min-width: 640px) {
  .masonry-grid { column-count: 3; column-gap: 12px; padding: 12px; }
}

@media (min-width: 1024px) {
  .masonry-grid { column-count: 4; column-gap: 16px; padding: 16px; }
}

@media (min-width: 1400px) {
  .masonry-grid { column-count: 5; }
}

.masonry-item {
  break-inside: avoid;
  margin-bottom: 8px;
}

.masonry-item img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 4px;
  cursor: pointer;
}
```

**Step 3: Integrate into App.tsx**

Wire FilterBar + MasonryGrid together. Filtered images flow from useFilters into MasonryGrid.

**Step 4: Commit**
```
feat: mobile-first masonry grid for pics viewer
```

---

### Task 15: Lightbox

**Files:**
- Create: `apps/pics/webui/src/Lightbox.tsx`
- Create: `apps/pics/webui/src/Lightbox.css`
- Modify: `apps/pics/webui/src/App.tsx` (integrate)

**Step 1: Write Lightbox.tsx**

Full-screen overlay showing a single image at full resolution:

```typescript
interface LightboxProps {
  images: ImageCatalogEntry[];
  currentIndex: number;
  baseUrl: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
}
```

Features:
- Full-resolution image loaded from CDN (fullPath)
- Metadata overlay: title, style, composition, palette, culture, model, tags
- Toggle metadata visibility on tap/click
- Swipe left/right on mobile (touch events)
- Arrow key navigation on desktop
- Escape to close
- Pinch-to-zoom on mobile (CSS `touch-action: manipulation` + transform)
- Previous/Next buttons (translucent, edges of screen)
- Preload adjacent images (index ± 1)

**Step 2: Write Lightbox.css**

Fixed overlay, z-index above everything, dark background, centered image with `object-fit: contain`.

**Step 3: Wire into App.tsx**

MasonryGrid `onImageClick` opens Lightbox with the clicked image index. Lightbox navigates within the current filtered set.

**Step 4: Commit**
```
feat: lightbox with swipe/keyboard navigation
```

---

### Task 16: Compare mode

**Files:**
- Create: `apps/pics/webui/src/CompareView.tsx`
- Create: `apps/pics/webui/src/CompareView.css`
- Modify: `apps/pics/webui/src/App.tsx` (integrate)

**Step 1: Write CompareView.tsx**

Side-by-side image comparison:

```typescript
interface CompareViewProps {
  images: [ImageCatalogEntry, ImageCatalogEntry];
  baseUrl: string;
  onClose: () => void;
}
```

Features:
- Two images side by side (desktop) or stacked (mobile portrait)
- Each image independently scrollable/zoomable
- Optional synced zoom/pan toggle
- Metadata displayed below each image
- Close button returns to grid

**Step 2: Integration**

Add a "compare" selection mode: long-press (mobile) or Ctrl+click (desktop) to select images for comparison. When 2 selected, show Compare button. Clicking it opens CompareView.

**Step 3: Commit**
```
feat: side-by-side image comparison mode
```

---

### Task 17: Slideshow mode

**Files:**
- Create: `apps/pics/webui/src/Slideshow.tsx`
- Create: `apps/pics/webui/src/Slideshow.css`
- Modify: `apps/pics/webui/src/App.tsx` (integrate)

**Step 1: Write Slideshow.tsx**

Full-screen auto-advancing image viewer:

```typescript
interface SlideshowProps {
  images: ImageCatalogEntry[];
  baseUrl: string;
  startIndex: number;
  onClose: () => void;
}
```

Features:
- Full-screen (uses Fullscreen API where available)
- Auto-advance with configurable interval (5s/10s/15s/30s)
- Crossfade transition between images
- Pause on tap/click, resume on tap/click
- Respects current filter/sort order
- Progress bar at top showing position in set
- Escape or close button to exit
- Preload next image

**Step 2: Integration**

Add slideshow button in header toolbar (visible when images are loaded). Launches slideshow from current position or beginning of filtered set.

**Step 3: Commit**
```
feat: auto-advancing slideshow mode
```

---

## Phase 6: Infrastructure

### Task 18: Terraform for pics deployment

**Files:**
- Create: `infrastructure/terraform-pics/main.tf`
- Create: `infrastructure/terraform-pics/variables.tf`
- Create: `infrastructure/terraform-pics/outputs.tf`
- Create: `infrastructure/terraform-pics/deploy.sh`

**Step 1: Copy and adapt from terraform-viewer**

The pics site needs:
- Its own S3 bucket for static assets (HTML, JS, CSS)
- Shares the existing image S3 bucket (same images, same CloudFront origin)
- Its own CloudFront distribution with pics.theiceremembers.com domain
- Same cache behaviors for image prefixes (raw/*, webp/*, thumb/*)
- ACM certificate (may already exist if wildcard for *.theiceremembers.com)
- Route53 record for pics.theiceremembers.com

Key differences from viewer:
- No bundle.json / chunked timelines
- `catalog.json` served from image bucket (uploaded by Canonry sync), not static bucket
- Simpler cache behavior — just static assets + image paths + catalog.json path

**Step 2: Write deploy.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Build pics app
cd apps/pics/webui && npm run build && cd -

# Terraform deploy
cd infrastructure/terraform-pics
terraform init
terraform apply
cd -
```

**Step 3: Commit**
```
feat: Terraform infrastructure for pics.theiceremembers.com
```

---

## Task Dependency Graph

```
Phase 1 (Data Model & Pipeline):
  Task 1 (types) → Task 2 (migration) → Task 3 (pipeline)

Phase 2 (Catalog Builder):
  Task 1 → Task 4 (catalog builder)

Phase 3 (Catalog Tab):
  Task 4 → Task 5 (tab shell) → Task 6 (coverage report) → Task 7 (deterministic fill) → Task 8 (LLM fill) → Task 9 (review screen)

Phase 4 (S3 Sync):
  Task 4 + Task 7 → Task 10 (S3 sync extension)

Phase 5 (Pics App):
  Task 4 → Task 11 (scaffold) → Task 12 (catalog loader) → Task 13 (filters) → Task 14 (masonry grid) → Task 15 (lightbox) → Task 16 (compare) → Task 17 (slideshow)

Phase 6 (Infrastructure):
  Task 11 → Task 18 (Terraform)
```

Phases 1-3 must be sequential. Phases 4, 5, and 6 can proceed in parallel once their dependencies are met.

Within Phase 5, Tasks 11-14 are sequential (core functionality). Tasks 15-17 are independent of each other and can be implemented in any order after Task 14.

---

## Verification Strategy

Since the CLAUDE.md prohibits build commands, verification is through:
- Dev server HMR for all UI changes (Illuminator on existing port, pics on 5009)
- Manual browser testing for each feature
- Console checks for data operations (deterministic fill, catalog builder)
- For Terraform: `terraform plan` to verify before `terraform apply`
