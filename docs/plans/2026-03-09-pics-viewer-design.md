# pics.theiceremembers.com — Image Viewer & Metadata Pipeline Design

**Date:** 2026-03-09
**Status:** Approved

## Overview

Build a public image viewer site (pics.theiceremembers.com) that reads directly from S3, plus the supporting metadata pipeline: data model extensions, deterministic metadata tracking in the image generation pipeline, a curation UI for back-tagging existing images, and S3 sync extensions.

## Change 1: Data Model (`imageTypes.ts`)

### New Fields on `ImageMetadata`

| Field | Type | Source (new images) | Backfill (existing) |
|-------|------|---------------------|---------------------|
| `artisticStyleId` | `string` | StyleSelection at gen time | LLM inference from prompt |
| `compositionStyleId` | `string` | StyleSelection at gen time | LLM inference from prompt |
| `colorPaletteId` | `string` | StyleSelection at gen time | LLM inference from prompt |
| `title` | `string` | Deterministic pattern | Deterministic pattern |
| `tags` | `string[]` | visualTags from scene refs | visualTags from scene refs / LLM |

### `imageType` Expansion

Current: `"entity" | "chronicle"`
New: `"entity" | "scene" | "cover" | "other"`

Backfill mapping (deterministic):
- `imageType === "entity"` → `"entity"`
- Chronicle image linked to `PromptRequestRef` → `"scene"`
- Chronicle image linked to `ChronicleCoverImage` → `"cover"`
- Everything else → `"other"`

### Title Generation (Deterministic)

- **Entity images:** `"{entityName} — {artisticStyleName}"`
- **Scene images:** Truncated/cleaned `sceneDescription` from `PromptRequestRef`
- **Cover images:** `"{chronicleTitle} Cover"`

### Dexie Migration

New version bump to add fields. No new indexes required initially (filtering happens client-side in curation UI and catalog.json is pre-built for the viewer).

### `catalog.json` Schema (Built at Sync Time)

```typescript
interface ImageCatalogEntry {
  imageId: string;
  title: string;
  artisticStyleId: string;
  compositionStyleId: string;
  colorPaletteId: string;
  imageType: "entity" | "scene" | "cover" | "other";
  tags: string[];
  entityName?: string;
  entityKind?: string;
  entityCulture?: string;
  model: string;
  width: number;
  height: number;
  aspect: "portrait" | "landscape" | "square";
  generatedAt: number;
  thumbPath: string;
  fullPath: string;
}

interface ImageCatalog {
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
```

The catalog is a **projection** of the unified Dexie image store, built at sync time. The app-side data model is unified; the catalog is a read-optimized subset for the public viewer.

## Change 2: Image Generation Pipeline

### `imageTask.ts` / `promptBuilders.ts`

The `StyleSelection` (artisticStyleId, compositionStyleId, colorPaletteId) is already resolved before image generation — it just isn't persisted to `ImageMetadata`. Changes:

1. Thread resolved style IDs from `buildImagePromptFromGuidance()` through to the `ImageMetadata` object saved to Dexie
2. Generate deterministic `title` after generation succeeds
3. Copy `visualTags` from `PromptRequestRef` to `tags` for chronicle images

All metadata is filled deterministically at generation time. No LLM calls for metadata on new images.

## Change 3: Curation Tab (Illuminator UI)

New tab in Illuminator sidebar for back-tagging existing images.

### Pre-Run Coverage Report

Scans all images in Dexie and shows:

**Per-field completeness:**
- For each new metadata field: count present, count missing, % complete

**Per-field derivability:**
- For each missing field: how many can be filled deterministically, and from what source
- Example: `artisticStyleId` derivable from `suggestedArtisticStyleId` on linked PromptRequestRef for N images

**Remaining gaps after deterministic fill:**
- Count still missing, split by "has prompt data" vs "no prompt data"
- Surfaces oldest images with no prompt — these need different strategy

The report drives the workflow. No assumptions about what's missing.

### Backfill Pipeline

Iterative, multi-pass. Each pass:

1. **Deterministic fill** — fill everything derivable (imageType reclassification, title, tags from visualTags, style IDs from suggested fields on chronicle refs)
2. **LLM batch fill** — for remaining gaps on images that have prompt data, batch LLM calls to infer style/composition/palette/tags. ~20-50 images per call.
3. **Review screen** — table/grid of images with inferred metadata. Filter to "LLM-tagged only". Inline edit (dropdowns for style/composition/palette, free text for title/tags). Bulk approve/reject.
4. **Publish to Dexie** — write approved metadata back to images table

No expectation of single-pass completion. The coverage report updates after each pass to show remaining gaps. Edge cases handled iteratively.

### Implementation Note

Only implement known deterministic cases initially (entity images lack style data — that's confirmed). Do not guess at what other images are missing. The pre-run report will surface the actual gaps, and we extend the fill logic incrementally.

## Change 4: Canonry S3 Sync Extension

The existing S3 sync button in Canonry's AWS tab is extended:

1. **Build `catalog.json`** from Dexie image records (client-side)
2. **Optimize images** — for any raw images not yet in webp/thumb format, create optimized variants (canvas API in browser)
3. **Upload** — push catalog.json + optimized images to S3

No new S3 plumbing. Uses existing Cognito credentials and S3 client from Canonry.

## Change 5: Pics Viewer App (`apps/pics/`)

### Architecture

New Vite + React app. Static site, no backend. Single-page, single route.

Fetches `catalog.json` from CDN on load. All filtering/sorting/search is client-side (~3k records, trivial).

### Layout (Mobile-First)

```
┌─────────────────────────┐
│ Header: site title      │
│ Search bar              │
│ Filter chips (scrollable│
│ horizontal on mobile)   │
├─────────────────────────┤
│                         │
│  Masonry grid           │
│  (infinite scroll)      │
│                         │
│  Thumbnails from CDN    │
│  tap → lightbox         │
│                         │
└─────────────────────────┘
```

### Features

**Masonry grid (default view):**
- CSS `column-count` + `break-inside: avoid` (no JS layout library — dimensions known from catalog)
- 2 columns mobile, 3-4 tablet, 5-6 desktop
- Lazy-loading thumbnails via intersection observer
- Infinite scroll
- Image count in header

**Filter/Sort:**
- Sort: newest, oldest, random shuffle
- Filter dropdowns from `catalog.facets`: artistic style, composition, palette, culture, entity kind, model, image type
- Text search: fuzzy match against title, entityName, tags, culture
- Active filters as dismissible chips
- URL query params for shareable filtered views

**Lightbox:**
- Full-resolution image from CDN
- Title + metadata overlay (tap to toggle)
- Swipe left/right (respects current sort/filter)
- Pinch to zoom on mobile
- Keyboard nav on desktop (arrows, escape)

**Compare mode:**
- Long-press or button to select 2 images
- Side-by-side (stacked on mobile portrait)
- Synced zoom/pan

**Slideshow:**
- Full-screen auto-advance (configurable interval)
- Respects current filter/sort
- Pause/resume on tap

### Tech

- CSS columns for masonry (no library)
- Custom lightbox component (no library)
- Client-side filtering on catalog array
- React state + URL params (no state library)
- Plain CSS / CSS modules, mobile-first media queries

### What It Doesn't Have

- No auth / login
- No project concept — flat image pool
- No narrative, chronicles, entity details
- No image upload or editing
- No backend / API

## Change 6: Infrastructure

### New CloudFront Distribution

- Domain: pics.theiceremembers.com
- Origin: new S3 bucket (or prefix) for static site assets
- Images served from existing image CDN (same bucket/distribution as viewer)
- Same Terraform pattern as existing viewer deployment

### Deployment

- `infrastructure/terraform-pics/` — new Terraform config mirroring `terraform-viewer/`
- `deploy.sh` builds `apps/pics/`, uploads to S3, invalidates CloudFront
