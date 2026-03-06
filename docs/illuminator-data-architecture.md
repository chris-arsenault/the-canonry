# Illuminator Data Architecture

## Overview

Illuminator uses a three-layer data architecture:

```
Dexie (IndexedDB)  -->  Zustand stores  -->  React components
   source of truth       reactive cache       UI consumers
```

**Dexie** is the single source of truth for all world data. Data is written to Dexie during seed/sync and never modified by the UI layer directly (enrichment updates go through repository functions that write to Dexie first).

**Zustand stores** provide a reactive cache over Dexie. Stores load data from Dexie on initialization and expose it to components via selectors. Components subscribe to specific slices of data and only re-render when their subscribed data changes.

**React components** consume data exclusively through store selectors. No component holds world data in `useState`. No component computes structural indexes — those are either precomputed at seed time and persisted, or computed once inside a store.

## Stores

### EntityStore (`entityStore.ts`)

Holds the full entity map. Supports per-entity refresh (fetch 1 entity from Dexie instead of ~6000).

| Method | Description |
|---|---|
| `initialize(runId)` | Load all entities for the run |
| `refreshEntities(ids)` | Reload specific entities by ID |
| `refreshAll()` | Reload all entities |
| `getEntity(id)` | Synchronous lookup from the map |
| `reset()` | Clear all state |

**Selectors** (`entitySelectors.ts`): `useEntities()`, `useEntityById()`, `useEntity(id)`, `useEntityCount()`

### RelationshipStore (`relationshipStore.ts`)

Holds the flat relationship array AND a precomputed `byEntity` index (Map from entity ID to relationships). The index is recomputed inside the store whenever relationships reload — no component-level `useMemo` needed.

| Method | Description |
|---|---|
| `initialize(runId)` | Load all relationships, compute byEntity index |
| `refreshAll()` | Reload all relationships, recompute index |
| `getForEntity(id)` | Synchronous lookup from byEntity map |
| `reset()` | Clear all state |

**Selectors** (`relationshipSelectors.ts`): `useRelationships()`, `useRelationshipsByEntity()`, `useRelationshipsForEntity(id)`, `useRelationshipCount()`

### NarrativeEventStore (`narrativeEventStore.ts`)

Holds the flat narrative event array. Events only change during rename (full reload) or data sync.

| Method | Description |
|---|---|
| `initialize(runId)` | Load all events for the run |
| `refreshAll()` | Reload all events |
| `reset()` | Clear all state |

**Selectors** (`narrativeEventSelectors.ts`): `useNarrativeEvents()`, `useNarrativeEventCount()`

### IndexStore (`indexStore.ts`)

Holds precomputed structural indexes that are calculated at seed/sync time and persisted to Dexie. This store never computes indexes — it only reads them.

Persisted indexes: `prominenceScale`, `renownedThreshold`, `eraTemporalInfo`, `prominentByCulture`, `eraIdAliases`

**Selectors** (`indexSelectors.ts`): `useProminenceScale()`, `useRenownedThreshold()`, `useEraTemporalInfo()`, `useEraTemporalInfoByKey()`, `useProminentByCulture()`

### ChronicleStore (`chronicleStore.ts`)

Holds chronicle-specific data (separate from the world data stores above).

**Selectors** (`chronicleSelectors.ts`)

## Repositories

Repositories are the Dexie access layer. Each repository provides typed read/write functions for a specific table or set of tables.

| Repository | Tables |
|---|---|
| `entityRepository.ts` | `entities` |
| `relationshipRepository.ts` | `relationships` |
| `eventRepository.ts` | `narrativeEvents` |
| `indexRepository.ts` | `runIndexes` |
| `chronicleRepository.ts` | `chronicles` |
| `imageRepository.ts` | `images`, `imageBlobs` |
| `slotRepository.ts` | `simulationSlots` |
| `costRepository.ts` | `costRecords` |
| `traitRepository.ts` | `traitPalettes`, `usedTraits` |
| `staticPageRepository.ts` | `staticPages` |
| `styleRepository.ts` | `styleLibraries` |
| `schemaRepository.ts` | `schemaSnapshots` |
| `historianRepository.ts` | `historianRuns` |
| `eraNarrativeRepository.ts` | `eraNarratives` |
| `summaryRevisionRepository.ts` | `summaryRevisionRuns` |
| `dynamicsRepository.ts` | `dynamicsRuns` |
| `coordinateStateRepository.ts` | `coordinateStates` |
| `contentTreeRepository.ts` | `contentTrees` |

## Data Flow

### Initial Load
```
App mounts
  --> check Dexie for existing data
  --> EntityStore.initialize(runId)
  --> IndexStore.initialize(runId)
  --> NarrativeEventStore.initialize(runId)
  --> RelationshipStore.initialize(runId)
  --> Components render from store selectors
```

### Data Sync (import from simulation)
```
handleDataSync()
  --> Write entities, events, relationships to Dexie
  --> Compute and persist indexes (prominenceScale, etc.)
  --> Reset all stores
  --> Re-initialize all stores from Dexie
  --> Components re-render via selector subscriptions
```

### Entity Enrichment (description/image generation)
```
Enrichment completes
  --> Write enriched entity to Dexie
  --> EntityStore.refreshEntities([entityId])  (fetches 1 entity)
  --> Only components subscribed to that entity re-render
```

### Entity Rename
```
Rename entity
  --> Patch entity + events in Dexie
  --> EntityStore.refreshEntities([entityId])
  --> NarrativeEventStore.refreshAll()
  --> Dispatch worlddata-changed event
```

### Full Reload
```
reloadAll()
  --> EntityStore.refreshAll()
  --> NarrativeEventStore.refreshAll()
  --> RelationshipStore.refreshAll()
  --> IndexStore.refresh()
```

## Scoped Invalidation

Not all data changes require reloading everything. Three reload scopes exist:

| Scope | Function | When |
|---|---|---|
| Entity-only | `reloadEntities(ids)` | After enrichment, single entity updates |
| Entities + Events | `reloadEntitiesAndEvents()` | After rename (events reference entity names) |
| Full | `reloadAll()` | After data sync, bulk operations |

### IlluminatorConfigStore (`illuminatorConfigStore.ts`)

One-way sync store for project-level configuration. IlluminatorRemote writes via `setConfig()` in a `useEffect`; child components and hooks read only.

| Field | Description |
|---|---|
| `projectId` | Current project ID |
| `simulationRunId` | Current simulation run |
| `worldContext` | Canon facts, world dynamics |
| `historianConfig` | Historian persona definition |
| `entityGuidance` | Entity description/image prompt guidance |
| `cultureIdentities` | Culture-specific identity configs |
| `isHistorianEditionActive` | Whether a historian edition run is active |
| `isHistorianActive` | Whether a historian review is active |

**Access pattern:** Children read directly via `useIlluminatorConfigStore(s => s.projectId)`. These values are NOT passed as props — see ADR-002.

### EnrichmentQueueStore (`enrichmentQueueStore.ts`)

Reactive mirror of the enrichment worker queue. `useIlluminatorSetup` syncs `queue` and `stats` from the `useEnrichmentQueue` hook into this store via `useEffect`.

| Field | Description |
|---|---|
| `queue` | QueueItem[] — full queue for status lookups |
| `stats` | QueueStats — pre-computed counts (queued, running, completed, errored) |

**Access pattern:** Components read via `useEnrichmentQueueStore(s => s.queue)`. Enqueue/cancel actions are separate (via `enrichmentQueueBridge`).

## Key Design Decisions

1. **No useState for world data.** All world data flows through Zustand stores. This prevents the dual-sovereignty problem where both Dexie and React state claim to be the source of truth.

2. **Per-entity refresh.** `EntityStore.refreshEntities([id])` fetches a single entity from Dexie instead of reloading all ~6000. This is the primary optimization for enrichment workflows.

3. **Precomputed indexes.** Structural indexes like `prominenceScale` and `eraTemporalInfo` are computed once at seed time and persisted to Dexie. Components read them from the IndexStore — they never recompute these indexes.

4. **Derived indexes inside stores.** The `byEntity` relationship index is computed inside RelationshipStore when data loads. Components use `useRelationshipsByEntity()` instead of running their own `useMemo`.

5. **Granular selectors.** Each store exposes focused selectors so components subscribe to exactly the data they need. A component that only needs one entity subscribes via `useEntity(id)` and doesn't re-render when other entities change.

6. **Store-first data access.** Child components read store-available values directly from Zustand selectors instead of receiving them as props from the parent. The parent writes to stores; children read from stores. Mutation callbacks (e.g., `updateWorldContext`) remain as props because they propagate changes to external Module Federation consumers. See ADR-002.

7. **Grouped workflow flow objects.** The four workflow flows (revision, backport, historian, dynamics) are passed as grouped domain objects (`revisionFlow`, `backportFlow`, `historianFlow`, `dynamicsFlow`) rather than flat-spreading ~60 properties. Components destructure only the flow groups they need. See ADR-003.
