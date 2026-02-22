# Illuminator Data Architecture: Investigation & Plan

## Status: Investigation Complete, Planning Index Move

---

## 1. Current Architecture

### Layers

**Repository Layer (Dexie)** — stateless query wrappers over IndexedDB.
- `entityRepository.ts` — CRUD, named mutations (applyRename, applyRevisionPatches, revalidateBackrefs, etc.)
- `eventRepository.ts` — narrative event storage, text replacement patches
- `relationshipRepository.ts` — relationship storage, upsert
- `chronicleRepository.ts` — chronicle records

Well-designed. Transactional. No caching, no subscriptions, no invalidation. Caller is responsible for state propagation.

**Zustand Stores** — intended to be the reactive layer between Dexie and React.
- `entityStore.ts` — holds `entityIds: string[]` + bounded cache (50 items) + `dirtyIds` tracking. Exposes `getEntity(id): Promise<Entity>`. Never actually queried for rendering data.
- `chronicleStore.ts` — holds `navItems` + `navOrder` + bounded cache (20 items). Actually works correctly via `chronicleSelectors.ts` with granular subscriptions.

**IlluminatorRemote.jsx (~1700 lines)** — god component. Holds the actual UI source of truth:
- `useState` arrays: `entities`, `narrativeEvents`, `relationships`
- 8+ `useMemo` hooks deriving indexes from those arrays
- `reloadAndNotify()` as the sole invalidation mechanism (fetches ALL data from Dexie, replaces all state)
- Passes everything to children via props

### The Intended Architecture (Not Yet Achieved)

- **Dexie** = source of truth
- **Zustand** = reactive layer preventing full component tree refresh
- **No `useState`** for entity data in IlluminatorRemote (only UI state like expand/collapse)
- **Exception**: image loading goes directly to Dexie for performance

### Why Previous Refactors Failed

The EntityStore exposes `getEntity(id): Promise<Entity>` — async, per-entity, cache-bounded. But the component tree consumes entities as **synchronous array-level operations** that produce derived indexes:

```
entities (full array, synchronous)
  -> entityById (Map)
  -> prominenceScale (computed distribution)
  -> renownedThreshold (derived from prominenceScale)
  -> prominentByCulture (Map, derived from entities + renownedThreshold)
  -> eraTemporalInfo (filtered + sorted + mapped)
  -> eraTemporalInfoByKey (Map, derived from eraTemporalInfo + entities)
  -> currentEra (find by ID)
  -> relationshipsByEntity (Map)
```

These indexes feed into `buildPrompt()`, `getEntityContextsForRevision()`, and are passed as props to 6+ child components. Every enrichment callback, chronicle builder, and prompt assembler depends on them being synchronously available.

`getEntity(id)` returns a Promise. `useMemo` can't call async functions. Every refactor attempt hit this wall: either hold the full array in the store (defeating the bounded-cache design) or rewrite every consumer to work with async per-entity lookups (massive scope).

The derived data had nowhere to go:
1. In IlluminatorRemote useMemos — requires `entities` as useState. Current state.
2. In the Zustand store — requires the store to hold the full array and compute indexes. Relocates the god component into Zustand.
3. In each consuming component — each needs the full array anyway, so every subscriber re-renders on every change.

---

## 2. The Symptom: Backport Log Spam

After each backport task completes, logs show 5+ redundant full-dataset fetches:
```
[EventRepo] getNarrativeEventsForRun {count: 6419}
[RelationshipRepo] getRelationshipsForRun {count: 1544}
[IlluminatorRemote] eraTemporalInfo built
```

### Root Cause

`applyBulkPatches()` triggers 2-3 `reloadAndNotify()` calls per batch:
1. `handleRevisionApplied(patches)` -> `reloadAndNotify(updatedIds)` — FETCH #1
2. `reloadAndNotify(patches.map(...))` — FETCH #2 (same data)
3. `setChronicleRefreshTrigger(n+1)` -> `chronicleStore.refreshAll()` — additional query

Each `reloadAndNotify()` fetches ALL entities + ALL events + ALL relationships, sets three separate `setState` calls, triggers `eraTemporalInfo` useMemo recomputation.

With 5 batches = 10-15 full data fetches between tasks.

### Why This Isn't Just a Performance Problem

The log spam reveals that the architecture has no concept of **scoped invalidation**. The only tool available is "reload everything." The batch backport just makes this visible because it's the most mutation-heavy workflow.

---

## 3. The Solution: Precomputed Persisted Indexes

### Key Insight

The indexes treated as ephemeral derived state are not ephemeral. They're computed from **structural fields set at seed time** that don't change during enrichment:

| Index | Keyed On | Changes During Enrichment? |
|---|---|---|
| `entityById` | `id` | Yes (descriptions change) |
| `prominenceScale` | all prominence values | No |
| `renownedThreshold` | prominenceScale | No |
| `prominentByCulture` | `culture` + `prominence` | No |
| `eraTemporalInfo` | `kind === 'era'` + `temporal` | No |
| `eraTemporalInfoByKey` | eraTemporalInfo + `eraId` | No |
| `currentEra` | `slotRecord.finalEraId` | No |
| `relationshipsByEntity` | relationship endpoints | No |

### Architecture

1. **Computed once** during data sync/seed, written to a Dexie table
2. **Read on app load** by Zustand — no computation, just a read
3. **Never touched by enrichment/backport** — descriptions change, indexes don't
4. **Rebuilt only by explicit triggers** — new data sync, entity creation/deletion, manual prominence edit

### What This Eliminates

- `reloadAndNotify()` — no longer needed. After backport, the changed entity is already in Dexie; Zustand invalidates that one cache entry.
- `entities` useState in IlluminatorRemote — replaced by Zustand store reading from Dexie
- 8+ useMemo cascade — indexes are precomputed in Dexie, not derived in React
- Full-array fetches — only the changed entity is re-read
- God component pattern — IlluminatorRemote stops being the data hub

### What Changes After a Backport Task Completes

Before (current):
```
task complete -> reloadAndNotify() -> fetch ALL entities + ALL events + ALL relationships
  -> setEntities() -> 8 useMemo recompute -> full component tree re-render
```

After (target):
```
task complete -> entity already written to Dexie by repository
  -> Zustand invalidates one cache entry
  -> component viewing that entity re-reads it
  -> no index recomputation, no full-array fetch
```

---

## 4. Additional Observations

### Redundant `prominenceScale` Computation

`buildProminenceScale` is independently computed by at least 7 consumers:
- IlluminatorRemote.jsx (global)
- EntityBrowser.jsx
- EntityGuidanceEditor.jsx
- EnrichmentQueue.jsx
- ResultsPanel.jsx
- chronicleLoreBackportTask.ts (service worker)
- chronicleContextBuilder.ts
- perspectiveSynthesizer.ts
- promptBuilder.ts (local variant for selected entities)

A persisted global prominenceScale eliminates the redundant computations in the main thread components. Service worker and prompt builders that compute subset-specific scales would continue computing locally.

### ChronicleStore as Reference Pattern

The ChronicleStore already implements the target pattern correctly:
- Holds lightweight nav projections (`navItems`, `navOrder`)
- Bounded record cache
- Granular selectors in `chronicleSelectors.ts` (`useChronicleNavItems()`, `useSelectedChronicle(id)`, `useChronicleCount()`)
- Components subscribe via selectors, only re-render when their specific data changes

This is the pattern EntityStore should follow.

### Components That Bypass IlluminatorRemote

`ChroniclePanel` and `ChronicleWorkspace` import repositories directly and query Dexie themselves, creating parallel data flows that can diverge from IlluminatorRemote's state. The persisted index approach resolves this — everyone reads from the same Dexie tables.

### `narrativeEvents` and `relationships`

These are also held as useState arrays in IlluminatorRemote and passed as props. They're consumed for:
- Prompt building (entity context assembly)
- Entity detail views (showing related events/relationships)
- Coverage statistics

These should follow the same pattern: persisted in Dexie (already are), read per-entity when needed, not held as full arrays in React state. `relationshipsByEntity` as a persisted index handles the most common access pattern.

---

## 5. Implementation Chunks

### Chunk 1: Precomputed Indexes → Dexie (COMPLETE)

Moved 5 useMemo-computed indexes from IlluminatorRemote to persisted Dexie storage:
- `prominenceScale` (excludes `manual_` entities from distribution)
- `renownedThreshold`
- `eraTemporalInfo`
- `eraTemporalInfoByKey` (via `eraIdAliases`)
- `prominentByCulture` (stored as `Record<string, {id, name}[]>`)

**Files created:**
- `lib/db/indexTypes.ts` — `RunIndexRecord`, `EraTemporalEntry`
- `lib/db/indexComputation.ts` — `computeRunIndexes()` pure function
- `lib/db/indexRepository.ts` — Dexie CRUD
- `lib/db/indexStore.ts` — Zustand store (read-only, reads from Dexie)
- `lib/db/indexSelectors.ts` — granular selectors

**Files modified:**
- `lib/db/illuminatorDb.ts` — v9 schema, `runIndexes` table
- `IlluminatorRemote.jsx` — removed 5 useMemos, replaced with store selectors, added computation triggers to handleDataSync/handleRenameApplied/handleCreateEntity

**Computation triggers:** data sync, entity creation, entity rename
**NOT triggered by:** enrichment, backport, description changes

### Chunk 2: `relationshipsByEntity` (Planned)

Move from useMemo over full relationships array to Dexie index query per-entity.

### Chunk 3: `entityById` / EntityStore (Planned)

Expand EntityStore to serve as the component-facing entity data layer, replacing `entities` useState.

### Chunk 4: Remove `entities`/`narrativeEvents`/`relationships` useState (Planned)

Final removal of god component state. Components consume via stores/selectors only.
