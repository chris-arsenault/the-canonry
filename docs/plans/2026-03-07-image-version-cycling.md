# Image Version Cycling & Shared ImageDisplay Component

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a shared `ImageDisplay` component with built-in version cycling so the viewer can show alternate image versions stored in S3 without changing how the "selected" image works.

**Architecture:** Bundle export collects alternate image metadata (sibling images sharing the same logical slot) from IndexedDB and embeds S3 URLs in the bundle. CDNBackend indexes alternates and exposes them via a new `getAlternates()` method. A shared `ImageDisplay` component in `shared-components` uses a new `useImageAlternates` hook to detect and cycle through versions. All existing image display sites across chronicler and archivist are migrated to use `ImageDisplay`.

**Tech Stack:** React, Zustand (image store), IndexedDB/Dexie (image metadata), S3 URLs, CSS (global classes via shared-components)

---

## Background

### Image ID format
`img_{entityId}_{timestamp}` — each regeneration creates a unique ID. Multiple versions for the same entity/ref coexist in S3.

### Logical slots (grouping key)
Images are grouped into "slots" — the logical position an image fills:

| Image type | Slot key | IndexedDB fields used |
|---|---|---|
| Entity portrait | `entity:{entityId}` | `imageType === "entity"`, same `entityId` |
| Chronicle cover | `cover:{chronicleId}` | `imageRefId === "__cover_image__"`, same `chronicleId` |
| Chronicle scene | `scene:{chronicleId}:{imageRefId}` | `imageType === "chronicle"`, same `chronicleId` + `imageRefId` |

### Current state
- S3 has ALL versions (never overwrites)
- Bundle only includes the currently-referenced image per slot
- No shared image display component exists — 8 separate render sites across chronicler (7) and archivist (1)

### Key files

| File | Role |
|---|---|
| `packages/image-store/src/types.ts` | ImageBackend interface, ImageSize, ImageEntryMetadata |
| `packages/image-store/src/backends/cdn.ts` | CDNBackend — resolves URLs from bundle data |
| `packages/image-store/src/backends/indexeddb.ts` | IndexedDBBackend — reads from Illuminator Dexie DB |
| `packages/image-store/src/store.ts` | Zustand store with URL/metadata caching |
| `packages/image-store/src/hooks.ts` | useImageUrl, useImageUrls, useImageMetadata |
| `packages/image-store/src/index.ts` | Package exports |
| `packages/shared-components/src/index.ts` | Shared component exports |
| `packages/shared-components/src/components/index.ts` | Component re-exports |
| `packages/shared-components/src/styles/index.css` | CSS aggregator |
| `packages/shared-components/package.json` | Package deps (currently only React peer) |
| `apps/canonry/webui/src/lib/imageAssetBuilder.ts` | Collects referenced images for bundles |
| `apps/canonry/webui/src/aws/awsS3.js` | S3 upload, `buildStorageImageUrl()` |
| `apps/viewer/webui/src/useBundleLoader.ts` | Initializes CDNBackend from bundle |
| `apps/chronicler/webui/src/components/WikiPageImages.tsx` | ChronicleImage, CoverHeroImage, ChronicleGallery |
| `apps/chronicler/webui/src/components/ImageLightbox.tsx` | Full-size image modal |
| `apps/chronicler/webui/src/components/WikiPageInfobox.tsx` | Entity portrait in infobox |
| `apps/chronicler/webui/src/components/WikiExplorerHome.tsx` | FeaturedArticleSection |
| `apps/chronicler/webui/src/components/WikiPagePreview.tsx` | EntityPreviewCard (hover tooltip) |
| `apps/archivist/webui/src/components/EntityDetail.tsx` | Entity portrait in detail panel |

---

## Task 1: Add AlternateGroup type and extend ImageBackend

**Files:**
- Modify: `packages/image-store/src/types.ts`

**Step 1: Add the AlternateGroup type**

Add after `CachedUrl` interface:

```typescript
/**
 * A version of an image at the same logical slot.
 * URL points to the S3 location (available in S3-mode bundles only).
 */
export interface ImageVersion {
  imageId: string;
  generatedAt: number;
  url: string;
}

/**
 * Group of image versions sharing the same logical slot
 * (e.g., multiple regenerations of the same entity portrait).
 * `activeId` is the currently-selected version that entities/chronicles point to.
 */
export interface AlternateGroup {
  activeId: string;
  versions: ImageVersion[];
}
```

**Step 2: Add getAlternates to ImageBackend**

Add to the `ImageBackend` interface:

```typescript
  /** Get alternate versions of an image (other generations at the same logical slot) */
  getAlternates(imageId: string): Promise<AlternateGroup | null>;
```

**Step 3: Export new types from index.ts**

Add to `packages/image-store/src/index.ts`:

```typescript
export type { ..., AlternateGroup, ImageVersion } from './types';
```

**Step 4: Commit**

```bash
git add packages/image-store/src/types.ts packages/image-store/src/index.ts
git commit -m "feat(image-store): add AlternateGroup type and getAlternates to ImageBackend"
```

---

## Task 2: Implement getAlternates in both backends

**Files:**
- Modify: `packages/image-store/src/backends/cdn.ts`
- Modify: `packages/image-store/src/backends/indexeddb.ts`

**Step 1: Add alternates support to CDNBackend**

Add a new constructor parameter and internal map. The full updated class:

```typescript
// Add import
import type { ImageBackend, ImageEntryMetadata, ImageSize, AlternateGroup } from '../types';

// Add new wire type for bundle data
export interface BundleAlternatesData {
  [activeImageId: string]: AlternateGroup;
}

export class CDNBackend implements ImageBackend {
  private urlMap = new Map<string, { thumb: string; full: string }>();
  private metadataMap = new Map<string, ImageEntryMetadata>();
  private alternatesMap = new Map<string, AlternateGroup>();
  private bundleImageData: BundleImageData | null;
  private legacyImages: LegacyImageMap | null;
  private bundleAlternates: BundleAlternatesData | null;

  constructor(
    bundleImageData: BundleImageData | null,
    legacyImages?: LegacyImageMap | null,
    bundleAlternates?: BundleAlternatesData | null,
  ) {
    this.bundleImageData = bundleImageData;
    this.legacyImages = legacyImages ?? null;
    this.bundleAlternates = bundleAlternates ?? null;
  }

  initialize(): Promise<void> {
    this.loadLegacyImages();
    this.loadBundleImages();
    this.loadAlternates();
    return Promise.resolve();
  }

  // ... existing private methods unchanged ...

  private loadAlternates(): void {
    if (!this.bundleAlternates) return;
    for (const [activeId, group] of Object.entries(this.bundleAlternates)) {
      if (group.versions.length > 1) {
        this.alternatesMap.set(activeId, group);
      }
    }
  }

  // ... existing public methods unchanged ...

  getAlternates(imageId: string): Promise<AlternateGroup | null> {
    return Promise.resolve(this.alternatesMap.get(imageId) ?? null);
  }
}
```

Export `BundleAlternatesData` from `packages/image-store/src/index.ts`.

**Step 2: Stub getAlternates in IndexedDBBackend**

Add to `IndexedDBBackend` class:

```typescript
  getAlternates(_imageId: string): Promise<AlternateGroup | null> {
    return Promise.resolve(null);
  }
```

Import `AlternateGroup` type.

**Step 3: Commit**

```bash
git add packages/image-store/src/backends/cdn.ts packages/image-store/src/backends/indexeddb.ts packages/image-store/src/index.ts
git commit -m "feat(image-store): implement getAlternates in CDN and IndexedDB backends"
```

---

## Task 3: Add loadAlternates to store + useImageAlternates hook

**Files:**
- Modify: `packages/image-store/src/store.ts`
- Modify: `packages/image-store/src/hooks.ts`
- Modify: `packages/image-store/src/index.ts`

**Step 1: Add loadAlternates to store**

Add to `ImageStoreState` interface:

```typescript
  /** Load alternate versions for an image (cache-first). */
  loadAlternates: (imageId: string) => Promise<AlternateGroup | null>;
```

Add `alternatesCache` to state:

```typescript
  alternatesCache: Map<string, AlternateGroup | null>;
```

Initialize in create:

```typescript
  alternatesCache: new Map(),
```

Clear in configure and cleanup:

```typescript
  // In configure:
  set({ backend, initialized: false, urlCache: new Map(), metadataCache: new Map(), alternatesCache: new Map() });

  // In cleanup:
  set({ backend: null, initialized: false, urlCache: new Map(), metadataCache: new Map(), alternatesCache: new Map() });
```

Implement loadAlternates:

```typescript
  loadAlternates: async (imageId: string) => {
    const { backend, alternatesCache } = get();
    if (!backend) return null;
    if (alternatesCache.has(imageId)) return alternatesCache.get(imageId)!;
    const group = await backend.getAlternates(imageId);
    const newCache = new Map(get().alternatesCache);
    newCache.set(imageId, group);
    set({ alternatesCache: newCache });
    return group;
  },
```

Import `AlternateGroup` type.

**Step 2: Add useImageAlternates hook**

Add to `packages/image-store/src/hooks.ts`:

```typescript
import type { ImageEntryMetadata, ImageSize, AlternateGroup } from './types';

export interface UseImageAlternatesResult {
  group: AlternateGroup | null;
  hasAlternates: boolean;
  count: number;
}

/**
 * Load alternate versions of an image (other generations at the same logical slot).
 * Returns { group, hasAlternates, count }.
 */
export function useImageAlternates(
  imageId: string | null | undefined,
): UseImageAlternatesResult {
  const [group, setGroup] = useState<AlternateGroup | null>(null);
  const loadAlternates = useImageStore((s) => s.loadAlternates);
  const initialized = useImageStore((s) => s.initialized);

  useEffect(() => {
    if (!imageId || !initialized) {
      setGroup(null);
      return;
    }

    let cancelled = false;
    void loadAlternates(imageId).then((result) => {
      if (!cancelled) setGroup(result);
    });

    return () => { cancelled = true; };
  }, [imageId, loadAlternates, initialized]);

  return {
    group,
    hasAlternates: group != null && group.versions.length > 1,
    count: group?.versions.length ?? 0,
  };
}
```

**Step 3: Export from index.ts**

```typescript
export { useImageUrl, useImageUrls, useImageMetadata, useImageAlternates } from './hooks';
export type { UseImageUrlResult, UseImageAlternatesResult } from './hooks';
```

**Step 4: Commit**

```bash
git add packages/image-store/src/store.ts packages/image-store/src/hooks.ts packages/image-store/src/index.ts
git commit -m "feat(image-store): add loadAlternates to store and useImageAlternates hook"
```

---

## Task 4: Create ImageDisplay component in shared-components

**Files:**
- Create: `packages/shared-components/src/components/ImageDisplay.tsx`
- Create: `packages/shared-components/src/styles/components/image-display.css`
- Modify: `packages/shared-components/src/styles/index.css`
- Modify: `packages/shared-components/src/components/index.ts`
- Modify: `packages/shared-components/src/index.ts`
- Modify: `packages/shared-components/package.json`

**Step 1: Add image-store as peer dependency**

In `packages/shared-components/package.json`, add to `peerDependencies`:

```json
"@the-canonry/image-store": "workspace:*"
```

**Step 2: Create CSS**

Create `packages/shared-components/src/styles/components/image-display.css`:

```css
/* ---------------------------------------------------------------------------
 * ImageDisplay — shared image component with version cycling
 * --------------------------------------------------------------------------- */

.image-display {
  position: relative;
  display: inline-block;
}

.image-display-img {
  display: block;
  max-width: 100%;
  height: auto;
}

/* Clickable wrapper */
.image-display-btn {
  all: unset;
  cursor: pointer;
  display: block;
}

.image-display-btn:focus-visible {
  outline: 2px solid var(--color-accent, #60a5fa);
  outline-offset: 2px;
}

/* Version cycling indicator */
.image-display-versions {
  position: absolute;
  bottom: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  gap: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #e2e8f0;
  font-size: 11px;
  font-family: monospace;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  z-index: 2;
  border: 1px solid rgba(255, 255, 255, 0.15);
  transition: background 0.15s ease;
}

.image-display-versions:hover {
  background: rgba(0, 0, 0, 0.85);
  border-color: rgba(255, 255, 255, 0.3);
}

.image-display-versions:focus-visible {
  outline: 2px solid var(--color-accent, #60a5fa);
  outline-offset: 1px;
}

/* Timestamp shown when viewing an alternate */
.image-display-alt-label {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(0, 0, 0, 0.7);
  color: #fbbf24;
  font-size: 10px;
  font-family: monospace;
  padding: 2px 6px;
  border-radius: 3px;
  z-index: 2;
  pointer-events: none;
}

/* Loading shimmer */
.image-display-loading {
  background: linear-gradient(
    90deg,
    rgba(100, 116, 139, 0.15) 25%,
    rgba(100, 116, 139, 0.25) 50%,
    rgba(100, 116, 139, 0.15) 75%
  );
  background-size: 200% 100%;
  animation: image-display-shimmer 1.5s ease-in-out infinite;
  min-height: 80px;
  border-radius: 4px;
}

@keyframes image-display-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Step 3: Add CSS import**

Add to `packages/shared-components/src/styles/index.css`:

```css
@import url('./components/image-display.css');
```

**Step 4: Create the ImageDisplay component**

Create `packages/shared-components/src/components/ImageDisplay.tsx`:

```tsx
import React, { useState, useCallback, useMemo } from 'react';
import { useImageUrl, useImageAlternates } from '@the-canonry/image-store';
import type { ImageSize } from '@the-canonry/image-store';

export interface ImageDisplayProps {
  /** Image ID to display (from entity.enrichment.image.imageId, chronicle.coverImage.generatedImageId, etc.) */
  readonly imageId: string | null | undefined;
  /** Alt text for the image */
  readonly alt?: string;
  /** Image size variant */
  readonly size?: ImageSize;
  /** CSS class applied to the <img> element */
  readonly className?: string;
  /** CSS class applied to the outer container */
  readonly containerClassName?: string;
  /** Called when the image is clicked. Receives the imageId and resolved URL. */
  readonly onClick?: (imageId: string, url: string) => void;
  /** Use loading="lazy" on the img element */
  readonly lazyLoad?: boolean;
  /** Show version cycling indicator when alternates exist */
  readonly enableVersionCycling?: boolean;
  /** Content to show while loading. Defaults to a shimmer placeholder. */
  readonly loadingContent?: React.ReactNode;
  /** Content to show on error. null = render nothing (default). */
  readonly errorContent?: React.ReactNode;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ImageDisplay({
  imageId,
  alt = '',
  size = 'thumb',
  className = '',
  containerClassName = '',
  onClick,
  lazyLoad = false,
  enableVersionCycling = false,
  loadingContent,
  errorContent,
}: ImageDisplayProps) {
  const { url, loading, error } = useImageUrl(imageId, size);
  const { group, hasAlternates, count } = useImageAlternates(
    enableVersionCycling ? imageId : null,
  );

  const [altIndex, setAltIndex] = useState<number | null>(null);
  const [imgError, setImgError] = useState(false);

  const handleImgError = useCallback(() => setImgError(true), []);

  // Reset alternate index when imageId changes
  const prevIdRef = React.useRef(imageId);
  if (prevIdRef.current !== imageId) {
    prevIdRef.current = imageId;
    setAltIndex(null);
    setImgError(false);
  }

  // Determine which version is currently displayed
  const activeIndex = useMemo(() => {
    if (!group) return 0;
    return group.versions.findIndex((v) => v.imageId === group.activeId);
  }, [group]);

  const currentIndex = altIndex ?? activeIndex;
  const currentVersion = group?.versions[currentIndex];
  const isShowingAlternate = altIndex !== null && altIndex !== activeIndex;
  const displayUrl = isShowingAlternate && currentVersion ? currentVersion.url : url;

  const handleCycleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!group || count < 2) return;
      const next = ((altIndex ?? activeIndex) + 1) % count;
      setAltIndex(next);
      setImgError(false);
    },
    [group, count, altIndex, activeIndex],
  );

  const handleCycleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.stopPropagation();
        e.preventDefault();
        handleCycleClick(e as unknown as React.MouseEvent);
      }
    },
    [handleCycleClick],
  );

  const handleClick = useCallback(() => {
    const id = currentVersion?.imageId ?? imageId;
    const u = displayUrl;
    if (id && u && onClick) onClick(id, u);
  }, [onClick, currentVersion, imageId, displayUrl]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') handleClick();
    },
    [handleClick],
  );

  // Loading state
  if (loading) {
    return (
      <div className={`image-display ${containerClassName}`.trim()}>
        {loadingContent ?? <div className="image-display-loading" />}
      </div>
    );
  }

  // Error state
  if (imgError || error || !displayUrl) {
    if (errorContent === undefined || errorContent === null) return null;
    return (
      <div className={`image-display ${containerClassName}`.trim()}>
        {errorContent}
      </div>
    );
  }

  const imgElement = (
    <img
      src={displayUrl}
      alt={alt}
      className={`image-display-img ${className}`.trim()}
      onError={handleImgError}
      loading={lazyLoad ? 'lazy' : undefined}
    />
  );

  const versionIndicator = hasAlternates && enableVersionCycling && (
    <button
      type="button"
      className="image-display-versions"
      onClick={handleCycleClick}
      onKeyDown={handleCycleKeyDown}
      tabIndex={0}
      title={`Version ${currentIndex + 1} of ${count} — click to cycle`}
    >
      {currentIndex + 1}/{count}
    </button>
  );

  const altLabel = isShowingAlternate && currentVersion && (
    <div className="image-display-alt-label">
      {formatDate(currentVersion.generatedAt)}
    </div>
  );

  const content = (
    <>
      {onClick ? (
        <button
          type="button"
          className="image-display-btn"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {imgElement}
        </button>
      ) : (
        imgElement
      )}
      {versionIndicator}
      {altLabel}
    </>
  );

  return (
    <div className={`image-display ${containerClassName}`.trim()}>
      {content}
    </div>
  );
}
```

**Step 5: Export from components/index.ts**

Add:

```typescript
export { ImageDisplay } from './ImageDisplay';
export type { ImageDisplayProps } from './ImageDisplay';
```

**Step 6: Export from src/index.ts**

Add:

```typescript
export { ImageDisplay } from './components/ImageDisplay';
export type { ImageDisplayProps } from './components/ImageDisplay';
```

**Step 7: Commit**

```bash
git add packages/shared-components/
git commit -m "feat(shared-components): add ImageDisplay component with version cycling"
```

---

## Task 5: Collect alternates in imageAssetBuilder

**Files:**
- Modify: `apps/canonry/webui/src/lib/imageAssetBuilder.ts`

This task modifies the bundle export to collect alternate image versions.

**Step 1: Add types for alternates**

Add after existing type definitions:

```typescript
interface AlternateVersion {
  imageId: string;
  generatedAt: number;
  url: string;
}

interface AlternateGroup {
  activeId: string;
  versions: AlternateVersion[];
}

type ImageAlternates = Record<string, AlternateGroup>;
```

Add `imageAlternates` to `ImageAssets`:

```typescript
interface ImageAssets {
  imageData: { generatedAt: string; totalImages: number; results: ImageEntry[] } | null;
  images: Record<string, string> | null;
  imageFiles: ImageFile[];
  imageAlternates: ImageAlternates | null;
}
```

**Step 2: Add slot key computation**

Add a helper that determines the logical slot for an image record:

```typescript
function computeSlotKey(record: ImageRecord): string | null {
  if (record.imageType === "chronicle" && record.chronicleId && record.imageRefId) {
    if (record.imageRefId === "__cover_image__") {
      return `cover:${record.chronicleId}`;
    }
    return `scene:${record.chronicleId}:${record.imageRefId}`;
  }
  if (record.imageType === "entity" && record.entityId) {
    return `entity:${record.entityId}`;
  }
  // Fallback for old records without imageType
  if (record.entityId) return `entity:${record.entityId}`;
  return null;
}
```

Note: This requires `ImageRecord` to include `chronicleId` and `imageRefId`. Update the `ImageRecordBase` type to add these fields or widen the union:

```typescript
interface ImageRecordBase {
  imageId: string;
  mimeType: string;
  originalPrompt: string;
  finalPrompt: string;
  revisedPrompt: string;
  generatedAt?: number;
}

type ImageRecord =
  | ImageRecordBase & { imageType: "entity"; entityId: string; entityName: string; entityKind: string; chronicleId?: undefined; imageRefId?: undefined }
  | ImageRecordBase & { imageType: "chronicle"; chronicleId: string; imageRefId: string; entityId?: string; entityName?: string; entityKind?: string };
```

**Step 3: Add alternate collection function**

```typescript
function collectAlternates(
  referencedIds: Set<string>,
  allRecords: ImageRecord[],
  storage: ImageStorageConfig | undefined,
  mode: string,
): ImageAlternates | null {
  if (mode !== "s3" || !storage) return null;

  // Build slot → records index from ALL project images
  const slotIndex = new Map<string, ImageRecord[]>();
  for (const record of allRecords) {
    const slot = computeSlotKey(record);
    if (!slot) continue;
    let list = slotIndex.get(slot);
    if (!list) {
      list = [];
      slotIndex.set(slot, list);
    }
    list.push(record);
  }

  // For each referenced image, find its slot and collect all versions
  const alternates: ImageAlternates = {};
  for (const imageId of referencedIds) {
    const record = allRecords.find((r) => r.imageId === imageId);
    if (!record) continue;
    const slot = computeSlotKey(record);
    if (!slot) continue;
    const siblings = slotIndex.get(slot);
    if (!siblings || siblings.length < 2) continue;

    // Sort newest first
    const sorted = [...siblings].sort(
      (a, b) => (b.generatedAt ?? 0) - (a.generatedAt ?? 0),
    );

    alternates[imageId] = {
      activeId: imageId,
      versions: sorted.map((r) => ({
        imageId: r.imageId,
        generatedAt: r.generatedAt ?? 0,
        url: buildStorageImageUrl(storage, "raw", r.imageId) || "",
      })).filter((v) => v.url),
    };
  }

  return Object.keys(alternates).length > 0 ? alternates : null;
}
```

**Step 4: Wire into buildBundleImageAssets**

In `buildBundleImageAssets`, after the image processing loop, add:

```typescript
  const imageAlternates = collectAlternates(
    imageIds,
    imageRecords,
    mode === "s3" ? { bucket: storage!.bucket, prefix: storage!.prefix, region: storage!.region, basePrefix: storage!.prefix, projectId: projectId || "", rawPrefix: "raw" } : undefined,
    mode || "local",
  );
```

Wait — `buildStorageImageUrl` takes a `storage` object with specific shape. Check the existing call in `processS3Image`:

```typescript
const remotePath = buildStorageImageUrl(storage, "raw", imageId);
```

Where `storage` is `ImageStorageConfig` with `{ bucket, prefix, region }`. But `buildStorageImageUrl` internally uses `storage.basePrefix`, `storage.projectId`, `storage.rawPrefix`. So the config shape may differ from what's passed. Read `buildStorageImageUrl` to confirm:

```javascript
export function buildStorageImageUrl(storage, variant, imageId) {
  if (!storage || !imageId) return null;
  const basePrefix = storage.basePrefix || "";
  const projectId = storage.projectId || "";
  // ...
}
```

So `buildStorageImageUrl` expects `{ basePrefix, projectId, rawPrefix, ... }`. The `ImageStorageConfig` type in the builder uses `{ bucket, prefix, region }`. There must be a mapping. Check how `processS3Images` calls it — it receives `storage: ImageStorageConfig`.

The builder needs to construct the right storage shape for `buildStorageImageUrl`. Look at `processS3Image`:

```typescript
function processS3Image(
  imageId: string, record: ImageRecord | undefined, storage: ImageStorageConfig,
  // ...
): void {
  const remotePath = buildStorageImageUrl(storage, "raw", imageId);
```

So `ImageStorageConfig` is passed directly to `buildStorageImageUrl`. This means `ImageStorageConfig` must already have the right shape. But the interface says `{ bucket, prefix, region }`. Let me check more carefully... The `ImageStorageConfig` interface in the builder:

```typescript
interface ImageStorageConfig {
  bucket: string;
  prefix: string;
  region: string;
}
```

And `buildStorageImageUrl` reads `storage.basePrefix`, `storage.projectId`. This means the actual object passed at runtime has more fields than the TypeScript interface declares. The `storage` param from `BuildBundleImageAssetsParams` comes from the caller and likely has additional fields.

**Resolution:** Pass the same `storage` object to `collectAlternates`. Update the function signature:

```typescript
function collectAlternates(
  referencedIds: Set<string>,
  allRecords: ImageRecord[],
  storage: ImageStorageConfig | undefined,
  mode: string,
): ImageAlternates | null {
  if (mode !== "s3" || !storage) return null;
  // ... same as above, using storage directly with buildStorageImageUrl
```

In `buildBundleImageAssets`, call:

```typescript
  const imageAlternates = collectAlternates(imageIds, imageRecords, storage, mode || "local");
```

Update the return value to include `imageAlternates`:

```typescript
  return {
    imageData: { ... },
    images,
    imageFiles,
    imageAlternates,
  };
```

And update the empty return paths:

```typescript
  if (imageIds.size === 0) {
    return { imageData: null, images: null, imageFiles: [], imageAlternates: null };
  }
  // ...
  if (imageResults.length === 0) {
    return { imageData: null, images: null, imageFiles: [], imageAlternates: null };
  }
```

**Step 5: Commit**

```bash
git add apps/canonry/webui/src/lib/imageAssetBuilder.ts
git commit -m "feat(canonry): collect image alternates in bundle export (S3 mode)"
```

---

## Task 6: Wire alternates through bundle export and viewer loader

**Files:**
- Modify: `apps/canonry/webui/src/lib/bundleExportUtils.ts` (or wherever bundle JSON is assembled)
- Modify: `apps/viewer/webui/src/useBundleLoader.ts`
- Modify: `apps/viewer/webui/src/bundleLoader.ts` (if bundle type needs updating)

**Step 1: Include imageAlternates in the bundle JSON**

Find where the bundle JSON object is assembled (the code that puts together `{ format, version, metadata, worldData, chronicles, images, imageData, ... }`). Add the `imageAlternates` field from the builder output.

The exact location depends on the bundle assembly code. Search for where `buildBundleImageAssets` result is spread into the bundle object. Add:

```typescript
imageAlternates: imageAssets.imageAlternates,
```

**Step 2: Pass alternates to CDNBackend in useBundleLoader.ts**

In `apps/viewer/webui/src/useBundleLoader.ts`, find where CDNBackend is constructed:

```typescript
const backend = new CDNBackend(bundle.imageData, bundle.images);
```

Update to pass alternates:

```typescript
const backend = new CDNBackend(bundle.imageData, bundle.images, bundle.imageAlternates ?? null);
```

**Step 3: Commit**

```bash
git add apps/canonry/webui/src/lib/ apps/viewer/webui/src/
git commit -m "feat: wire image alternates from bundle export through viewer loader"
```

---

## Task 7: Migrate chronicler image components to ImageDisplay

**Files:**
- Modify: `apps/chronicler/webui/src/components/WikiPageImages.tsx`
- Modify: `apps/chronicler/webui/src/components/WikiExplorerHome.tsx`
- Modify: `apps/chronicler/webui/src/components/WikiPageInfobox.tsx`
- Modify: `apps/chronicler/webui/src/components/WikiPagePreview.tsx`

**Step 1: Update ChronicleImage**

Replace the `useImageUrl` + manual loading/error handling with `ImageDisplay`:

```tsx
import { ImageDisplay } from "@the-canonry/shared-components";

export function ChronicleImage({
  image,
  onOpen,
  layoutMode = "flow",
}: Readonly<{
  image: WikiSectionImage;
  onOpen: Optional<(imageUrl: string, image: WikiSectionImage) => void>;
  layoutMode: Optional<LayoutMode>;
}>) {
  const imageClassName =
    layoutMode === "margin"
      ? styles.marginImage
      : getImageClassName(image.size, image.justification || "left");

  const handleClick = useCallback(
    (_id: string, url: string) => onOpen?.(url, image),
    [onOpen, image],
  );

  return (
    <figure className={imageClassName}>
      <ImageDisplay
        imageId={image.imageId}
        alt={image.caption || "Chronicle illustration"}
        className={styles.figureImage}
        onClick={onOpen ? handleClick : undefined}
        enableVersionCycling
        loadingContent={<div className={styles.imagePlaceholder}>Loading...</div>}
      />
      {image.caption && <figcaption className={styles.imageCaption}>{image.caption}</figcaption>}
    </figure>
  );
}
```

Remove `useState` for error, the `useImageUrl` import (if no longer used elsewhere in the file), and the manual error/loading logic.

**Step 2: Update CoverHeroImage**

```tsx
export function CoverHeroImage({
  imageId,
  title,
  onOpen,
}: Readonly<{
  imageId: string;
  title: string;
  onOpen: Optional<(imageUrl: string) => void>;
}>) {
  const handleClick = useCallback(
    (_id: string, url: string) => onOpen?.(url),
    [onOpen],
  );

  return (
    <div className={styles.coverHero}>
      <ImageDisplay
        imageId={imageId}
        alt={title}
        className={[styles.coverHeroImage, onOpen ? styles.coverHeroImageClickable : ""].filter(Boolean).join(" ")}
        onClick={onOpen ? handleClick : undefined}
        enableVersionCycling
      />
      <div className={styles.coverHeroOverlay}>
        <h1 className={styles.chronicleTitleHero}>{title}</h1>
      </div>
      <FrostEdge position="bottom" className={styles.frostEdgeHero} />
    </div>
  );
}
```

Note: CoverHeroImage currently returns `null` when loading/error. ImageDisplay also returns `null` on error by default. But the parent `<div className={styles.coverHero}>` will still render. To match current behavior (entire component returns null when no image), check if imageId is valid and conditionally render the whole block. Or accept the minor change — an empty `.coverHero` div when there's no image (the hero banner styles may handle this gracefully with no visible difference).

**Step 3: Update FeaturedArticleSection in WikiExplorerHome.tsx**

Find the image rendering in `FeaturedArticleSection` and replace with `ImageDisplay`. The exact code depends on how the component currently renders its image. Pattern:

```tsx
<ImageDisplay
  imageId={featuredImageId}
  alt={title}
  className={styles.featuredImageInner}
  onClick={handleImageClick}
  enableVersionCycling
/>
```

**Step 4: Update WikiPageInfobox**

The infobox currently receives `imageUrl` as a prop (resolved by parent). To use `ImageDisplay`, it needs to receive `imageId` instead. This may require updating the parent (`useWikiPageData` hook or the component that renders WikiPageInfobox) to pass `imageId` instead of the resolved URL.

If this change cascades too far, an alternative is to leave WikiPageInfobox as-is for now and only add version cycling to components that directly use `useImageUrl`. **Decision: Update the prop from `imageUrl` to `imageId`.** The infobox already receives entity data from the parent, so the imageId is available.

**Step 5: Update WikiPagePreview (EntityPreviewCard)**

Same pattern — currently receives URL from parent. Switch to receiving `imageId` and using `ImageDisplay`. The preview card is display-only (no click handler) so:

```tsx
<ImageDisplay
  imageId={imageId}
  alt={entity.name}
  className={previewImageClass}
  enableVersionCycling
  errorContent={<div className={styles.previewPlaceholder}>{entity.name[0]}</div>}
/>
```

**Step 6: Clean up unused imports**

Remove `useImageUrl` imports from components that no longer call it directly.

**Step 7: Commit**

```bash
git add apps/chronicler/webui/src/components/
git commit -m "refactor(chronicler): migrate image display sites to shared ImageDisplay component"
```

---

## Task 8: Migrate archivist to ImageDisplay

**Files:**
- Modify: `apps/archivist/webui/src/components/EntityDetail.tsx`

**Step 1: Replace inline image rendering**

Current code (line 235):

```tsx
{imageUrl && <div className="mb-6"><div className="entity-image-container"><img src={imageUrl} alt={entity.name} className="entity-image" loading="lazy" /></div></div>}
```

Replace with:

```tsx
{entityForImage?.enrichment?.image?.imageId && (
  <div className="mb-6">
    <div className="entity-image-container">
      <ImageDisplay
        imageId={entityForImage.enrichment.image.imageId}
        alt={entity.name}
        className="entity-image"
        lazyLoad
        enableVersionCycling
      />
    </div>
  </div>
)}
```

**Step 2: Update imports**

Remove:
```tsx
import { useImageUrl } from "@the-canonry/image-store";
```

Add:
```tsx
import { ImageDisplay } from "@the-canonry/shared-components";
```

Remove the `useImageUrl` call:
```tsx
// Remove this line:
const { url: imageUrl } = useImageUrl(entityForImage?.enrichment?.image?.imageId);
```

**Step 3: Commit**

```bash
git add apps/archivist/webui/src/components/EntityDetail.tsx
git commit -m "refactor(archivist): migrate entity image to shared ImageDisplay component"
```

---

## Task 9: Gallery card version cycling

**Files:**
- Modify: `apps/chronicler/webui/src/components/WikiPageImages.tsx`

The `ChronicleGallery` component uses `useImageUrls` (batch) and passes resolved URLs to `GalleryCard`. Each gallery card gets a cover `imageId` from the chronicle data.

**Step 1: Update GalleryCard to use ImageDisplay**

Instead of receiving `coverUrl`, receive `imageId` and use ImageDisplay:

```tsx
function GalleryCard({ link, onNavigate }: Readonly<{
  link: WikiPage;
  onNavigate: (id: string) => void;
}>) {
  const handleClick = useCallback(() => onNavigate(link.id), [onNavigate, link.id]);
  const imageId = link.content.coverImageId ?? null;

  return (
    <button className={styles.galleryCard} onClick={handleClick}>
      <ImageDisplay
        imageId={imageId}
        alt={link.title}
        className={styles.galleryImage}
        enableVersionCycling
        errorContent={<div className={styles.galleryPlaceholder}>&#x1F4DC;</div>}
      />
      <div className={styles.galleryTitle} title={link.title}>
        {link.title}
      </div>
    </button>
  );
}
```

**Step 2: Simplify ChronicleGallery**

Remove the `useImageUrls` batch call and `imageIds` memo since each GalleryCard now loads its own image:

```tsx
export function ChronicleGallery({
  title,
  links,
  onNavigate,
}: Readonly<{
  title: string;
  links: WikiPage[];
  onNavigate: (id: string) => void;
}>) {
  const capped = links.slice(0, 20);

  return (
    <div className={styles.gallerySection}>
      <h2 className={styles.sectionHeading}>
        {title} ({links.length})
      </h2>
      <div className={styles.galleryGrid}>
        {capped.map((link) => (
          <GalleryCard key={link.id} link={link} onNavigate={onNavigate} />
        ))}
      </div>
      {links.length > 20 && <div className={styles.moreText}>...and {links.length - 20} more</div>}
    </div>
  );
}
```

**Trade-off:** This changes from 1 batch `useImageUrls` call (up to 20 images) to 20 individual `useImageUrl` calls inside ImageDisplay. With CDNBackend this is still synchronous map lookups so no performance concern. With IndexedDBBackend (Illuminator dev mode), there's a minor overhead but the store's cache prevents repeated IDB reads.

**Step 3: Commit**

```bash
git add apps/chronicler/webui/src/components/WikiPageImages.tsx
git commit -m "refactor(chronicler): migrate gallery cards to ImageDisplay with per-card loading"
```

---

## Task 10: Final cleanup and verify

**Step 1: Remove unused useImageUrl import from WikiPageImages.tsx**

If `useImageUrl` and `useImageUrls` are no longer used anywhere in the file, remove the import.

**Step 2: Check that useWikiPageData hook still works**

The `useWikiPageData` hook in `apps/chronicler/webui/src/hooks/useWikiPageData.ts` calls `useImageUrl` for hover preview and infobox images. If WikiPageInfobox and WikiPagePreview now use `ImageDisplay` internally, `useWikiPageData` may have unused image URL state. Clean up any dead code paths.

**Step 3: Search for any remaining direct useImageUrl calls in chronicler/archivist**

```bash
grep -r "useImageUrl" apps/chronicler/webui/src/ apps/archivist/webui/src/
```

Any remaining calls should either be migrated to ImageDisplay or are intentional (e.g., the lightbox full-size loading in useWikiPageData).

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: clean up unused image imports after ImageDisplay migration"
```
