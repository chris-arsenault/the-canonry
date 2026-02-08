# Current State (2026-02-06)

This document is a **factual snapshot** of the codebase state as of Feb 6, 2026. It is based on direct inspection of the repository and avoids inferred behavior not backed by code.

## Summary (One Screen)

- **Dexie/IDB is the persistence layer** and lives in `apps/illuminator/webui/src/lib/db/*` and `packages/world-store`.
- **Shared packages are mixed‑layer**: `world-store` is repo‑only, while `narrative-store` and `image-store` embed Zustand state + backend interfaces.
- **Chronicler now loads world data from Dexie via `@penguin-tales/world-store`**, not from props.
- **Viewer seeds Dexie from bundle on load** and then uses Dexie for header search indexing.
- **Archivist is still prop‑driven** and consumes `worldData` directly.
- **Narrative events can be loaded into memory** via shared Zustand store (`narrative-store`), including an `ensureAllEventsLoaded` path.

## Shared Packages: Actual Responsibilities

### `packages/world-store`
**Role:** Dexie/IndexedDB read access only (plus `buildWorldStateForSlot` assembler).  
**No Zustand.**  
**Key file:** `packages/world-store/src/index.ts`

Exports (non‑exhaustive):
- `getSlotRecord`, `getWorldSchema`, `getCoordinateState`
- `getEntities`, `getRelationships`, `getNarrativeEvents`
- `buildWorldStateForSlot`
- `getChronicles`, `getStaticPages` (recently added)

### `packages/narrative-store`
**Role:** Shared Zustand store + backend interface + event ingestion.  
**Key file:** `packages/narrative-store/src/index.ts`

Notable behavior:
- Maintains `eventsById`, `eventsByEntity`, `eventIds`
- Provides `ensureEntityEvents` and **`ensureAllEventsLoaded`**
- **Ingests chunks into memory** (`ingestChunk`)

### `packages/image-store`
**Role:** Shared Zustand store for cached image URLs + metadata.  
**Key file:** `packages/image-store/src/store.ts`

Notable behavior:
- Maintains in‑memory URL + metadata caches
- Backend abstraction and cache invalidation in store

### `packages/shared-components`
**Role:** UI components only.  
**Key file:** `packages/shared-components` (no Zustand usage)

### `packages/world-schema`
**Role:** Types + schema definitions only.  
**Key file:** `packages/world-schema/src/*`

## Current Data Flows (By MFE)

### Illuminator
**Persistence:** Dexie via repos in `apps/illuminator/webui/src/lib/db/*`  
**State:** Local Zustand stores per feature (e.g. `chronicleStore`, `entityStore`)

Key code:
- Dexie schema: `apps/illuminator/webui/src/lib/db/illuminatorDb.ts`
- Chronicle repo: `apps/illuminator/webui/src/lib/db/chronicleRepository.ts`
- Chronicle state: `apps/illuminator/webui/src/lib/db/chronicleStore.ts` (Zustand)

World‑state import is explicit and user‑triggered in `IlluminatorRemote.jsx` via `handleDataSync`.  
**No automatic migration on load.**  
**File:** `apps/illuminator/webui/src/IlluminatorRemote.jsx`

### Chronicler
**World data source:** Dexie via `@penguin-tales/world-store`.  
**File:** `apps/chronicler/webui/src/ChroniclerRemote.tsx`

**Chronicles + static pages:** Loaded from IndexedDB directly (not via `world-store`).  
**Files:**
- `apps/chronicler/webui/src/lib/chronicleStorage.ts`
- `apps/chronicler/webui/src/lib/staticPageStorage.ts`
  
**Narrative events:** Loaded from `@penguin-tales/narrative-store` (Zustand).  
**File:** `apps/chronicler/webui/src/components/WikiExplorer.tsx`

### Viewer
**Seeds Dexie** on bundle load using a raw IDB writer.  
**File:** `apps/viewer/webui/src/lib/illuminatorDbWriter.js`

**Header search index** now reads from Dexie (via `@penguin-tales/world-store`).  
**File:** `apps/viewer/webui/src/App.jsx`

**Narrative chunks** ingested into `narrative-store` and also persisted to Dexie.  
**File:** `apps/viewer/webui/src/App.jsx`

### Archivist
**Still prop‑driven**; consumes `worldData` passed by host.  
**File:** `apps/archivist/webui/src/ArchivistRemote.tsx`

## Remaining World‑State Reads (Not Dexie‑Only)

1. **Archivist** uses `worldData` props across all components (no Dexie access).  
   `apps/archivist/webui/src/*`

2. **Viewer** still passes `worldData` to Archivist host (prop‑based).  
   `apps/viewer/webui/src/App.jsx`

3. **Illuminator** uses `worldData.schema` as a fallback when building `worldSchema` (if schema not in Dexie).  
   `apps/illuminator/webui/src/IlluminatorRemote.jsx`

## Zustand Usage in Shared Packages

- `packages/narrative-store`: **Yes** (store + backend + ingestion)
- `packages/image-store`: **Yes** (store + backend + caches)
- `packages/world-store`: **No**
- `packages/shared-components`: **No**

## Known Inconsistencies / Architectural Drift

1. **Mixed layers in shared packages**
   - `world-store` is pure data access.
   - `narrative-store` and `image-store` are state layers, not repo layers.

2. **Large dataset in shared Zustand**
   - `narrative-store` can load all events into memory via `ensureAllEventsLoaded`.

3. **Multiple Dexie entry points**
   - Illuminator uses Dexie repositories.
   - Viewer uses raw IndexedDB writer (`illuminatorDbWriter.js`).
   - Chronicler reads from both `world-store` (world data) and direct IDB (chronicles/static pages).

## Reference Files (Quick Jump)

- `packages/world-store/src/index.ts`
- `packages/narrative-store/src/index.ts`
- `packages/image-store/src/store.ts`
- `apps/chronicler/webui/src/ChroniclerRemote.tsx`
- `apps/chronicler/webui/src/components/WikiExplorer.tsx`
- `apps/chronicler/webui/src/lib/chronicleStorage.ts`
- `apps/chronicler/webui/src/lib/staticPageStorage.ts`
- `apps/viewer/webui/src/App.jsx`
- `apps/viewer/webui/src/lib/illuminatorDbWriter.js`
- `apps/illuminator/webui/src/IlluminatorRemote.jsx`
- `apps/illuminator/webui/src/lib/db/chronicleStore.ts`
- `apps/archivist/webui/src/ArchivistRemote.tsx`

