# Entity Curation Alignment + Bulk Actions Tab — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align entity image curation with chronicle curation format (StylePills + ThumbnailStrips), and consolidate all bulk actions into a dedicated tab with de-modaled operation panels.

**Architecture:** Extract shared image curation primitives (StylePills, ThumbnailStrip) from CurationImageSheet for reuse. Replace entity card grid with entity image sheet matching chronicle format. Create a Bulk Actions tab that absorbs ChronicleBulkActions + EntityImageBulkActions trigger buttons and renders BulkOperationShell-based progress panels inline instead of as overlay modals.

**Tech Stack:** React, TypeScript, Zustand stores, CSS modules (BEM-ish with component prefixes)

---

## Task 1: Extract StylePills into shared component

**Files:**
- Create: `apps/illuminator/webui/src/components/curation/StylePills.tsx`
- Create: `apps/illuminator/webui/src/components/curation/StylePills.css`
- Modify: `apps/illuminator/webui/src/components/curation/CurationImageSheet.tsx`

**Step 1: Create StylePills component**

Extract the `StylePills` function (CurationImageSheet.tsx lines 295-314) and the `StyleNameMaps` interface (lines 17-21) into a standalone file.

```tsx
// components/curation/StylePills.tsx
import React from "react";
import "./StylePills.css";

export interface StyleNameMaps {
  artistic: Map<string, string>;
  composition: Map<string, string>;
  palette: Map<string, string>;
}

export default function StylePills({ artisticId, compositionId, paletteId, styleNames }: Readonly<{
  artisticId?: string;
  compositionId?: string;
  paletteId?: string;
  styleNames: StyleNameMaps;
}>) {
  const artistic = artisticId ? styleNames.artistic.get(artisticId) : undefined;
  const composition = compositionId ? styleNames.composition.get(compositionId) : undefined;
  const palette = paletteId ? styleNames.palette.get(paletteId) : undefined;

  if (!artistic && !composition && !palette) return null;

  return (
    <div className="cis-style-pills">
      {artistic && <span className="cis-pill cis-pill-artistic" title="Artistic style">{artistic}</span>}
      {composition && <span className="cis-pill cis-pill-composition" title="Composition">{composition}</span>}
      {palette && <span className="cis-pill cis-pill-palette" title="Color palette">{palette}</span>}
    </div>
  );
}
```

**Step 2: Create StylePills CSS**

Move the `.cis-style-pills` and `.cis-pill*` rules from `CurationImageSheet.css` into `StylePills.css`.

**Step 3: Update CurationImageSheet to import shared StylePills**

- Delete the local `StylePills` function and `StyleNameMaps` interface
- Add: `import StylePills from "./StylePills";`
- Add: `import type { StyleNameMaps } from "./StylePills";`
- The component JSX stays identical — same prop names, same class names

**Step 4: Verify**

Check that the CurationTab renders identically. The CSS class names are unchanged so the visual output is the same.

**Step 5: Commit**

```bash
git add apps/illuminator/webui/src/components/curation/StylePills.tsx apps/illuminator/webui/src/components/curation/StylePills.css apps/illuminator/webui/src/components/curation/CurationImageSheet.tsx apps/illuminator/webui/src/components/curation/CurationImageSheet.css
git commit -m "refactor: extract StylePills into shared curation component"
```

---

## Task 2: Extract ThumbnailStrip into shared component

**Files:**
- Create: `apps/illuminator/webui/src/components/curation/ThumbnailStrip.tsx`
- Create: `apps/illuminator/webui/src/components/curation/ThumbnailStrip.css`
- Modify: `apps/illuminator/webui/src/components/curation/CurationImageSheet.tsx`

**Step 1: Create ThumbnailStrip component**

Extract the `ThumbnailStrip` function (CurationImageSheet.tsx lines 316-349) and the `ThumbUrl` interface (lines 29-32) into a standalone file.

```tsx
// components/curation/ThumbnailStrip.tsx
import React from "react";
import "./ThumbnailStrip.css";

export interface ThumbUrl {
  imageId: string;
  url: string;
}

export default function ThumbnailStrip({ thumbs, selectedImageId, onSelect, onViewFull }: Readonly<{
  thumbs: ThumbUrl[];
  selectedImageId?: string;
  onSelect: (imageId: string) => void;
  onViewFull: (info: { imageId: string; title: string }) => void;
}>) {
  if (thumbs.length === 0) return null;
  const isActive = (id: string) => id === selectedImageId;
  return (
    <div className="cis-thumb-strip">
      {thumbs.map((thumb) => (
        <div key={thumb.imageId} className="cis-thumb-slot">
          <img
            className={`cis-thumb${isActive(thumb.imageId) ? " cis-thumb-selected" : ""}`}
            src={thumb.url}
            alt=""
            onClick={() => onViewFull({ imageId: thumb.imageId, title: "Image" })}
            title="View full size"
          />
          {isActive(thumb.imageId) ? (
            <span className="cis-use-button-active">Active</span>
          ) : (
            <button className="cis-use-button" onClick={() => onSelect(thumb.imageId)}>
              Use
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Create ThumbnailStrip CSS**

Move the `.cis-thumb-strip`, `.cis-thumb`, `.cis-thumb-selected`, `.cis-thumb-slot`, `.cis-use-button`, `.cis-use-button-active` rules from `CurationImageSheet.css` into `ThumbnailStrip.css`.

**Step 3: Update CurationImageSheet to import shared ThumbnailStrip**

- Delete local `ThumbnailStrip` function and `ThumbUrl` interface
- Add: `import ThumbnailStrip from "./ThumbnailStrip";`
- Add: `import type { ThumbUrl } from "./ThumbnailStrip";`

**Step 4: Commit**

```bash
git add apps/illuminator/webui/src/components/curation/ThumbnailStrip.tsx apps/illuminator/webui/src/components/curation/ThumbnailStrip.css apps/illuminator/webui/src/components/curation/CurationImageSheet.tsx apps/illuminator/webui/src/components/curation/CurationImageSheet.css
git commit -m "refactor: extract ThumbnailStrip into shared curation component"
```

---

## Task 3: Create EntityImageSheet (replace EntityCurationGrid)

**Files:**
- Create: `apps/illuminator/webui/src/components/curation/EntityImageSheet.tsx`
- Create: `apps/illuminator/webui/src/components/curation/EntityImageSheet.css`

The EntityImageSheet shows a scrollable list of entity "image cards" for the filtered kind/culture group.
Each card mirrors the `cis-scene-card` pattern from CurationImageSheet:
entity name + kind/subtype, StylePills (assigned styles), ThumbnailStrip (all images), click → ImageModal.

**Step 1: Create EntityImageSheet component**

Key design decisions:
- Each entity in the filtered list gets a card, similar to `cis-scene-card` per prompt request
- Entity enrichment `imageStyle` block provides the assigned style IDs
- Images loaded via `getImagesForEntity(entityId)` + `loadImage(imageId)` for object URLs
- Selected entity highlighted (clicking a card selects it in the parent for right-rail detail)
- Lazy-load images: only load thumbnails for entities visible in viewport (IntersectionObserver)

```tsx
// components/curation/EntityImageSheet.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import type { EntityNavItem } from "../../lib/db/entityNav";
import { getImagesForEntity, loadImage } from "../../lib/db/imageRepository";
import { applyImageResult } from "../../lib/db/entityRepository";
import { useEntityStore } from "../../lib/db/entityStore";
import StylePills from "./StylePills";
import type { StyleNameMaps } from "./StylePills";
import ThumbnailStrip from "./ThumbnailStrip";
import type { ThumbUrl } from "./ThumbnailStrip";
import ImageModal from "../ImageModal";
import "./EntityImageSheet.css";

interface EntityImageSheetProps {
  entities: EntityNavItem[];
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
  styleNames: StyleNameMaps;
}
```

Each entity card:
- Shows entity name (bold), kind/subtype (muted)
- StylePills with `suggestedArtisticStyleId`, `suggestedCompositionStyleId`, `suggestedColorPaletteId` from nav item (need to add these to EntityNavItem — see Task 4)
- ThumbnailStrip showing all generated images for this entity
- Click "Use" on a thumbnail → `applyImageResult` to set primary, refresh entity

Use `eis-` CSS prefix: `eis-sheet`, `eis-entity-card`, `eis-entity-card-selected`, `eis-entity-name`, `eis-entity-meta`.

The image loading pattern: use IntersectionObserver per card. When card becomes visible, call `getImagesForEntity(entityId)` then `loadImage()` for each result. Store thumbs in a `Map<entityId, ThumbUrl[]>` state.

**Step 2: Create EntityImageSheet CSS**

Layout: flex column, gap 8px. Each card styled like `cis-scene-card` (1px border, padding, rounded corners). Selected card gets accent border like `ecg-card-selected`.

**Step 3: Commit**

```bash
git add apps/illuminator/webui/src/components/curation/EntityImageSheet.tsx apps/illuminator/webui/src/components/curation/EntityImageSheet.css
git commit -m "feat: add EntityImageSheet matching chronicle curation format"
```

---

## Task 4: Extend EntityNavItem with style IDs for StylePills

**Files:**
- Modify: `apps/illuminator/webui/src/lib/db/entityNav.ts`

**Step 1: Add style ID fields to EntityNavItem**

The StylePills component needs `suggestedArtisticStyleId`, `suggestedCompositionStyleId`, `suggestedColorPaletteId` from the entity's `enrichment.imageStyle` block. Add these to the lightweight nav projection:

```typescript
// In EntityNavItem interface, after hasImageStyle:
suggestedArtisticStyleId?: string;
suggestedCompositionStyleId?: string;
suggestedColorPaletteId?: string;
```

In `buildEntityNavItem`, add:
```typescript
suggestedArtisticStyleId: entity.enrichment?.imageStyle?.suggestedArtisticStyleId,
suggestedCompositionStyleId: entity.enrichment?.imageStyle?.suggestedCompositionStyleId,
suggestedColorPaletteId: entity.enrichment?.imageStyle?.suggestedColorPaletteId,
```

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/lib/db/entityNav.ts
git commit -m "feat: add style IDs to EntityNavItem for StylePills display"
```

---

## Task 5: Wire EntityImageSheet into EntityCurationPanel

**Files:**
- Modify: `apps/illuminator/webui/src/components/entity-curation/EntityCurationPanel.tsx`
- Modify: `apps/illuminator/webui/src/components/entity-curation/EntityCurationPanel.css`
- Modify: `apps/illuminator/webui/src/components/IlluminatorTabContent.jsx` (EntityCurationTab wrapper)
- Delete: `apps/illuminator/webui/src/components/entity-curation/EntityCurationGrid.tsx`
- Delete: `apps/illuminator/webui/src/components/entity-curation/EntityCurationGrid.css`

**Step 1: Update EntityCurationTab to pass styleLibrary for style name maps**

In `IlluminatorTabContent.jsx`, the `EntityCurationTab` already receives `props.styleLibrary`. Pass it to `EntityCurationPanel`.

**Step 2: Rewrite EntityCurationPanel center rail**

Replace `EntityCurationGrid` + `EntityImageBulkActions` with `EntityImageSheet`:

- Build `styleNames` maps from `styleLibrary` (same pattern as CurationTab lines 43-53)
- Center rail renders `EntityImageSheet` with filtered entities, style names, selection callback
- Remove `EntityImageBulkActions` import and rendering (moves to bulk tab in Task 8)
- Remove all `useEntityBulkImageOperations` wiring (moves to bulk tab)
- Remove bulk stats computation (`taggedCount`, `imageCount`)
- Keep right rail image history as-is (detailed view for selected entity)

**Step 3: Simplify EntityCurationPanel props**

Remove bulk-operation-only props that were added for the toolbar:
- Remove: `imageModel`, `imageQuality`, `onEnqueue`, `entityGuidance`, `cultureIdentities`, `worldContext`
- Keep: `simulationRunId`, `styleLibrary` (needed for style name maps)

Update `EntityCurationTab` wrapper in `IlluminatorTabContent.jsx` accordingly — remove the store reads for `entityGuidance`, `cultureIdentities`, `worldContext` and the forwarding of `imageModel`, `imageQuality`, `enqueue`.

**Step 4: Delete EntityCurationGrid**

```bash
rm apps/illuminator/webui/src/components/entity-curation/EntityCurationGrid.tsx
rm apps/illuminator/webui/src/components/entity-curation/EntityCurationGrid.css
```

**Step 5: Commit**

```bash
git add -u apps/illuminator/webui/src/components/entity-curation/ apps/illuminator/webui/src/components/IlluminatorTabContent.jsx
git commit -m "refactor: replace entity card grid with EntityImageSheet matching chronicle curation"
```

---

## Task 6: Add inline render mode to BulkOperationShell

**Files:**
- Modify: `apps/illuminator/webui/src/components/BulkOperationShell.jsx`
- Modify: `apps/illuminator/webui/src/components/BulkOperationShell.css`

**Step 1: Add renderMode prop**

Add `renderMode = "modal"` prop to BulkOperationShell. When `"inline"`:
- Skip the `.bulk-overlay` wrapper (no fixed overlay, no backdrop)
- Render `.bulk-dialog` directly as a block-level card
- Still support minimize/pill (FloatingPill navigates to bulk tab)
- Still support confirm/cancel/close footer
- `tabId` defaults to `"bulkactions"` in inline mode

```jsx
// In BulkOperationShell:
// When renderMode === "inline", wrap in a div instead of the overlay
const Wrapper = renderMode === "inline" ? "div" : "div";
// ... conditional className: renderMode === "inline" ? "bulk-inline-panel" : "bulk-overlay"
```

**Step 2: Add CSS for inline mode**

```css
/* BulkOperationShell.css — inline mode */
.bulk-inline-panel {
  /* No fixed positioning, no backdrop */
}

.bulk-inline-panel .bulk-dialog {
  width: 100%;
  max-width: none;
  max-height: none;
  box-shadow: none;
  border-radius: 8px;
}
```

**Step 3: Commit**

```bash
git add apps/illuminator/webui/src/components/BulkOperationShell.jsx apps/illuminator/webui/src/components/BulkOperationShell.css
git commit -m "feat: add inline render mode to BulkOperationShell"
```

---

## Task 7: Create BulkActionsTab

**Files:**
- Create: `apps/illuminator/webui/src/components/bulk-actions/BulkActionsTab.tsx`
- Create: `apps/illuminator/webui/src/components/bulk-actions/BulkActionsTab.css`
- Create: `apps/illuminator/webui/src/components/bulk-actions/BulkActionRail.tsx`
- Create: `apps/illuminator/webui/src/components/bulk-actions/BulkActionRail.css`

### BulkActionRail

The action rail absorbs the button sections from ChronicleBulkActions (6 sections) and EntityImageBulkActions (2 sections). It is a scrollable column of collapsible sections.

**Props it needs:**
- All 50+ callbacks from `ChronicleBulkActionsProps` (validation, scene images, cover images, historian tone, backport, historian)
- All entity bulk callbacks from `useEntityBulkImageOperations` return (tag, assign primary, assign secondary, clear, generate, useSecondary toggle)
- Status flags (isFactCoverageActive, isToneRankingActive, etc.)

This is the same props as ChronicleBulkActions + EntityImageBulkActions combined. The component is presentational — callbacks and state come from hooks wired in BulkActionsTab.

Use `bar-` CSS prefix. Layout: flex column, overflow-y auto. Each section: collapsible with section label. Buttons use existing `.illuminator-button` class.

### BulkActionsTab

Two-column layout:
```
┌───────────────┬──────────────────────────┐
│ BulkActionRail│  BulkOperationWorkspace   │
│ (280px)       │  (flex: 1, overflow-y)    │
│               │                           │
│ Scrollable    │  Stacked inline           │
│ action buttons│  BulkOperationShell cards │
└───────────────┴──────────────────────────┘
```

**BulkActionsTab wiring:**

Subscriptions from Zustand stores (all read directly, no prop threading):
- `useBulkTagImageRefsStore` — progress, prepareTag, confirmTag, cancelTag, closeTag
- `useBulkTagCoverImagesStore` — progress, prepareTag, confirmTag, cancelTag, closeTag
- `useBulkChronicleAnnotationStore` — progress, confirmAnnotation, cancelAnnotation, closeAnnotation
- `useBulkEraNarrativeStore` — progress, confirmBulk, cancelBulk, closeBulk
- `useToneRankingStore` — progress, confirmToneRanking, cancelToneRanking, closeToneRanking, assignmentPreview, applyAssignment, closeAssignment
- `useInterleavedAnnotationStore` — progress, confirmInterleaved, cancelInterleaved, closeInterleaved
- `useFactCoverage()` hook — progress, isActive, prepareFactCoverage, confirmFactCoverage, cancelFactCoverage, closeFactCoverage

Hooks for operation callbacks:
- `useChronicleBulkOperations(...)` — provides all chronicle bulk handlers
- `useEntityBulkImageOperations(...)` — provides all entity bulk handlers

Data dependencies for the hooks (from stores/selectors):
- `simulationRunId`, `projectId`, `worldContext`, `entityGuidance`, `cultureIdentities`, `historianConfig` from `useIlluminatorConfigStore`
- `chronicleItems` from `useChronicleNavItems()`
- `entityNavItems` from `useEntityNavList()` + `useEntityNavItems()` (Map)
- `styleLibrary` from props (passed from IlluminatorTabContent)
- `imageModel` from props (`config.imageModel`)
- `onEnqueue` from props
- `relationshipsByEntity`, `prominenceScale`, `prominentByCulture`, `eraTemporalInfo` from index/relationship selectors
- `fullEntityMapRef` — a ref holding the full entity map, used by `useChronicleBulkOperations`. Need to check how ChroniclePanel creates this.

**Workspace renders all active bulk operations inline:**

```tsx
<div className="bat-workspace">
  <BulkTagImageRefsModal renderMode="inline" progress={...} onConfirm={...} onCancel={...} onClose={...} />
  <BulkTagCoverImagesModal renderMode="inline" progress={...} onConfirm={...} onCancel={...} onClose={...} />
  <BulkFactCoverageModal renderMode="inline" progress={...} onConfirm={...} onCancel={...} onClose={...} />
  <BulkBackportModal renderMode="inline" progress={...} ... />
  <BulkHistorianModal renderMode="inline" progress={...} ... />
  <BulkToneRankingModal renderMode="inline" progress={...} ... />
  <ToneAssignmentPreviewModal renderMode="inline" preview={...} ... />
  <BulkChronicleAnnotationModal renderMode="inline" progress={...} ... />
  <InterleavedAnnotationModal renderMode="inline" progress={...} ... />
  <BulkEraNarrativeModal renderMode="inline" ... />
  <EntityBulkToasts ... />
</div>
```

Each modal component already returns `null` when progress is idle, so only active operations render. The `renderMode="inline"` prop flows through to `BulkOperationShell`.

Use `bat-` CSS prefix: `bat-workspace`, `bat-rail`, `bat-column`.

**Step 1: Create BulkActionRail**

Absorb ChronicleBulkActions section layout (3-column grid with 6 sections) + EntityImageBulkActions sections (2 sections). Use the same section labels, buttons, checkboxes, and status text. Add an "Entity Images" section with the entity style assignment + generation buttons.

**Step 2: Create BulkActionsTab**

Wire all stores, hooks, and render BulkActionRail + workspace.

**Step 3: Commit**

```bash
git add apps/illuminator/webui/src/components/bulk-actions/
git commit -m "feat: add BulkActionsTab with de-modaled operation panels"
```

---

## Task 8: Wire BulkActionsTab into tab system + update sidebar

**Files:**
- Modify: `apps/illuminator/webui/src/components/IlluminatorTabContent.jsx`
- Modify: `apps/illuminator/webui/src/components/IlluminatorSidebar.jsx`

**Step 1: Add tab to sidebar**

In `IlluminatorSidebar.jsx`, add to TABS array (after "activity", before "costs"):
```js
{ id: "bulkactions", label: "Bulk Actions" },
```

**Step 2: Add tab to IlluminatorTabContent**

Import `BulkActionsTab` and add wrapper:

```jsx
function BulkActionsTabWrapper(props) {
  // Similar to ChronicleTab — pull store deps and forward relevant props
  const { projectId, simulationRunId, worldContext, entityGuidance, cultureIdentities, historianConfig } =
    useIlluminatorConfigStore();
  return (
    <div className="illuminator-content">
      <BulkActionsTab
        projectId={projectId}
        simulationRunId={simulationRunId}
        styleLibrary={props.styleLibrary}
        imageModel={props.config?.imageModel}
        imageQuality={props.imageGenSettings?.imageQuality}
        onEnqueue={props.enqueue}
        // flows for backport/historian modals
        backportFlow={props.backportFlow}
        historianFlow={props.historianFlow}
        onRefreshEraSummaries={props.handleRefreshEraSummaries}
      />
    </div>
  );
}
```

Add to `TAB_COMPONENTS`:
```js
bulkactions: BulkActionsTabWrapper,
```

**Step 3: Commit**

```bash
git add apps/illuminator/webui/src/components/IlluminatorTabContent.jsx apps/illuminator/webui/src/components/IlluminatorSidebar.jsx
git commit -m "feat: register BulkActionsTab in tab system and sidebar"
```

---

## Task 9: Remove bulk actions from ChroniclePanel

**Files:**
- Modify: `apps/illuminator/webui/src/components/chronicle-panel/ChroniclePanel.tsx`
- Delete: `apps/illuminator/webui/src/components/chronicle-panel/ChronicleBulkActions.tsx`
- Delete: `apps/illuminator/webui/src/components/chronicle-panel/ChronicleBulkActions.css`

**Step 1: Remove from ChroniclePanel**

In ChroniclePanel.tsx:
- Remove `ChronicleBulkActions` import and rendering (lines 374-424)
- Remove `showBulkActions` state and toggle handler
- Remove `BulkTagImageRefsModal`, `BulkTagCoverImagesModal`, `BulkFactCoverageModal` rendering (lines 478-480)
- Remove store subscriptions for `useBulkTagImageRefsStore`, `useBulkTagCoverImagesStore` (lines 136-148)
- Remove `useFactCoverage` hook call (line 121)
- Remove `useToneRanking` hook call (line 124) — keep only if used elsewhere in ChroniclePanel beyond passing to bulk actions
- Keep all toast rendering — toasts provide feedback for operations triggered from the bulk tab but the results appear in the ChroniclePanel context. Actually, toast results come from `useChronicleBulkOperations` return values which will also move. Review carefully.

**Important:** The `useChronicleBulkOperations` hook is called in ChroniclePanel (line 256) and provides BOTH bulk action handlers AND result states for toasts. Since the hook moves to BulkActionsTab, the toasts also move. Remove all toast rendering from ChroniclePanel that was driven by `bulk.*Result` states.

**Step 2: Remove bulk-related props passed to ChroniclePanel from parent**

Review ChroniclePanel's props — `onStartBulkBackport`, `isBulkBackportActive`, `onRefreshEraSummaries` etc. Some of these are used only by ChronicleBulkActions. Remove unused props.

**Step 3: Delete ChronicleBulkActions**

```bash
rm apps/illuminator/webui/src/components/chronicle-panel/ChronicleBulkActions.tsx
rm apps/illuminator/webui/src/components/chronicle-panel/ChronicleBulkActions.css
```

**Step 4: Commit**

```bash
git add -u apps/illuminator/webui/src/components/chronicle-panel/
git commit -m "refactor: remove bulk actions UI from ChroniclePanel (moved to BulkActionsTab)"
```

---

## Task 10: Remove bulk actions from EntityCurationPanel

**Files:**
- Modify: `apps/illuminator/webui/src/components/entity-curation/EntityCurationPanel.tsx`
- Delete: `apps/illuminator/webui/src/components/EntityImageBulkActions.tsx`
- Delete: `apps/illuminator/webui/src/components/EntityImageBulkActions.css`

**Step 1: Remove from EntityCurationPanel**

Already partially done in Task 5 (which replaced the grid). Verify:
- No `EntityImageBulkActions` import
- No `useEntityBulkImageOperations` call
- No bulk stats (`taggedCount`, `imageCount`)
- No store reads for `entityNavMap`, `relationshipsByEntity`, `prominenceScale`, etc. (those were only for the bulk ops hook)

**Step 2: Delete EntityImageBulkActions**

```bash
rm apps/illuminator/webui/src/components/EntityImageBulkActions.tsx
rm apps/illuminator/webui/src/components/EntityImageBulkActions.css
```

**Step 3: Commit**

```bash
git add -u apps/illuminator/webui/src/components/
git commit -m "refactor: remove EntityImageBulkActions (moved to BulkActionsTab)"
```

---

## Task 11: Move bulk modal rendering from IlluminatorModals to BulkActionsTab

**Files:**
- Modify: `apps/illuminator/webui/src/components/IlluminatorModals.jsx`

**Step 1: Remove BulkOperationShell-based modals from IlluminatorModals**

These modals move to BulkActionsTab workspace (Task 7). Remove from IlluminatorModals:

From `BackportSection`: Remove `BulkBackportModal` rendering (lines 97-104). Keep `BackportConfigModal` and `SummaryRevisionModal` — those are interactive review modals.

From `HistorianSection`: Remove `BulkHistorianModal` rendering (lines 121-129). Keep `SummaryRevisionModal` and `HistorianReviewModal`.

Remove `ToneAndAnnotationModals` section entirely (lines 191-234) — all four modals (`BulkToneRankingModal`, `ToneAssignmentPreviewModal`, `BulkChronicleAnnotationModal`, `InterleavedAnnotationModal`) move to BulkActionsTab.

Remove imports for moved modals. Remove store subscriptions that were only used for those modals.

**Step 2: Verify remaining modals**

IlluminatorModals should still render:
- `ImageSettingsDrawer` (settings, not bulk)
- `DynamicsGenerationModal` (interactive)
- `RevisionFilterModal` + `SummaryRevisionModal` (interactive review)
- `BackportConfigModal` + `SummaryRevisionModal` for backport (interactive review)
- `SummaryRevisionModal` + `HistorianReviewModal` for historian (interactive review)
- `EntityRenameModal`, `CreateEntityModal` (entity CRUD)
- `ThinkingViewer` (passive display)
- `FloatingPills` (passive display)

**Step 3: Commit**

```bash
git add apps/illuminator/webui/src/components/IlluminatorModals.jsx
git commit -m "refactor: move bulk progress modals from IlluminatorModals to BulkActionsTab"
```

---

## Task 12: Update FloatingPills tabId for bulk operations

**Files:**
- Modify: All BulkOperationShell-based modal files (only the `tabId` prop)

**Step 1: Update tabId on all bulk modals**

Each `BulkOperationShell` call sets `tabId` for pill navigation. Update all to `tabId="bulkactions"` so minimized pills navigate to the bulk tab:

- `BulkTagImageRefsModal.jsx` — change `tabId="chronicle"` to `tabId="bulkactions"`
- `BulkTagCoverImagesModal.jsx` — same
- `BulkFactCoverageModal.jsx` — same
- `BulkBackportModal.jsx` — same
- `BulkHistorianModal.jsx` — same
- `BulkToneRankingModal.jsx` — same
- `BulkChronicleAnnotationModal.jsx` — same
- `InterleavedAnnotationModal.jsx` — same (check current tabId)
- `BulkEraNarrativeModal.jsx` — same

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/components/Bulk*.jsx apps/illuminator/webui/src/components/InterleavedAnnotationModal.jsx
git commit -m "refactor: update bulk modal tabIds to navigate to BulkActionsTab"
```

---

## Task 13: Dead code cleanup sweep

**Files:** Various

**Step 1: Search for unused imports**

After all tasks, grep for:
- References to `ChronicleBulkActions` — should be zero
- References to `EntityImageBulkActions` — should be zero
- References to `EntityCurationGrid` — should be zero
- Unused CSS files

**Step 2: Check for orphaned hooks**

- `useEntityBulkImageOperations` — verify it's imported only from BulkActionsTab
- `useChronicleBulkOperations` — verify it's imported only from BulkActionsTab (not ChroniclePanel anymore)

**Step 3: Remove any remaining dead code**

**Step 4: Commit**

```bash
git add -u
git commit -m "chore: remove dead code from bulk actions migration"
```

---

## Execution Notes

### Ordering

Tasks 1-2 (extract shared components) are independent and can run in parallel.
Task 3 depends on Tasks 1-2 (uses StylePills + ThumbnailStrip).
Task 4 is independent.
Task 5 depends on Tasks 3-4.
Task 6 is independent (can run in parallel with Tasks 1-5).
Task 7 depends on Task 6 (uses inline BulkOperationShell).
Task 8 depends on Task 7.
Tasks 9-11 depend on Task 8 (remove old rendering after new tab is wired).
Task 12 depends on Tasks 9-11.
Task 13 is the final cleanup.

### Critical dependency: `fullEntityMapRef`

`useChronicleBulkOperations` takes a `fullEntityMapRef: RefObject<Map<string, PersistedEntity>>`. In ChroniclePanel this is created as a ref populated from `useEntityStore`. The BulkActionsTab needs to replicate this pattern. Check ChroniclePanel for the exact setup (search for `fullEntityMapRef`).

### Critical dependency: `chronicleItems` with `getEffectiveStatus`

`useChronicleBulkOperations` takes `chronicleItems` enriched with queue-aware status via `getEffectiveStatus`. The BulkActionsTab needs the same enrichment. Use `useChronicleNavItems(getEffectiveStatus)` — import `getEffectiveStatus` from wherever ChroniclePanel gets it (likely the enrichment queue or a local helper).

### Interactive modals stay in IlluminatorModals

The backport, historian, and revision **review** flows involve interactive modals (SummaryRevisionModal, HistorianReviewModal, BackportConfigModal) that cannot be de-modaled because they require immediate user decisions. These remain in IlluminatorModals. Only the **progress** modals (BulkBackportModal, BulkHistorianModal) move.

### Props from flows

`BulkBackportModal` and `BulkHistorianModal` receive props from `backportFlow` and `historianFlow` respectively. These flow objects are created in `useIlluminatorFlows` in `IlluminatorRemote.jsx`. The BulkActionsTab needs access to relevant parts of these flows — either by passing them as tab props or by extracting the bulk progress portions into stores.

Currently `backportFlow.showBulkBackportModal`, `backportFlow.bulkBackportProgress`, `backportFlow.handleConfirmBulkBackport`, etc. are properties of the flow object. The simplest approach: pass `backportFlow` and `historianFlow` as tab props from IlluminatorTabContent.
