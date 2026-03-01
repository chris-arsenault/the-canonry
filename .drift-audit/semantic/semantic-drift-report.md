# Semantic Drift Report
Generated: 2026-03-01 00:44 UTC
Units analyzed: 4318
Clusters found: 414
Verified clusters: 21
CSS clusters: 25
CSS intra-file duplicates: 152

## DUPLICATE (2)

### cluster-001: IndexedDB read operations — query illuminator DB for chronicles, entities, events, static pages, era narratives by simulation run or project ID
**Members:** 33 | **Avg Similarity:** 0.46 | **Spread:** 4 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| isTokenValid | function | apps/canonry/webui/src/aws/awsConfigStorage.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getS3ImageUploadPlan | function | apps/canonry/webui/src/aws/awsS3.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| syncProjectImagesToS3 | function | apps/canonry/webui/src/aws/awsS3.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getUserPoolSession | function | apps/canonry/webui/src/aws/cognitoUserAuth.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| sessionToTokens | function | apps/canonry/webui/src/aws/cognitoUserAuth.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| signInWithUserPool | function | apps/canonry/webui/src/aws/cognitoUserAuth.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| signOutUserPool | function | apps/canonry/webui/src/aws/cognitoUserAuth.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| pullImagesFromS3 | function | apps/canonry/webui/src/aws/s3ImagePull.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getImageBlob | function | apps/canonry/webui/src/lib/imageExportHelpers.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getImageMetadata | function | apps/canonry/webui/src/lib/imageExportHelpers.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getImagesByProject | function | apps/canonry/webui/src/lib/imageExportHelpers.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getChronicleCountForProject | function | apps/canonry/webui/src/storage/chronicleStorage.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getCompletedChroniclesForProject | function | apps/canonry/webui/src/storage/chronicleStorage.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getCompletedChroniclesForSimulation | function | apps/canonry/webui/src/storage/chronicleStorage.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getEntityCountForRun | function | apps/canonry/webui/src/storage/entityStorage.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getCompletedEraNarrativesForSimulation | function | ...anonry/webui/src/storage/eraNarrativeStorage.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getNarrativeEventCountForRun | function | apps/canonry/webui/src/storage/eventStorage.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getImageCountForProject | function | apps/canonry/webui/src/storage/imageStorage.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| importBundleImageReferences | function | apps/canonry/webui/src/storage/imageStorage.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| deleteStaticPagesForProject | function | .../canonry/webui/src/storage/staticPageStorage.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getStaticPagesForProject | function | .../canonry/webui/src/storage/staticPageStorage.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getSlots | function | apps/canonry/webui/src/storage/worldStore.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| selectActiveSection | function | apps/canonry/webui/src/stores/useCanonryUiStore.js | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getChronicle | function | apps/chronicler/webui/src/lib/chronicleStorage.ts | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getCompletedChroniclesForSimulation | function | apps/chronicler/webui/src/lib/chronicleStorage.ts | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getCompletedEraNarrativesForSimulation | function | ...chronicler/webui/src/lib/eraNarrativeStorage.ts | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| readPageLayouts | function | ...chronicler/webui/src/lib/illuminatorDbReader.ts | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getPublishedStaticPagesForProject | function | apps/chronicler/webui/src/lib/staticPageStorage.ts | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getStaticPage | function | apps/chronicler/webui/src/lib/staticPageStorage.ts | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getPageLayoutMap | function | ...inator/webui/src/lib/db/pageLayoutRepository.ts | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getChronicles | function | packages/world-store/src/index.ts | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getStaticPages | function | packages/world-store/src/index.ts | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |
| getWorldSchema | function | packages/world-store/src/index.ts | behavior:0.90, typeSignature:0.72, coOccurrence:0.70, neighborhood:0.68 |

**Verdict:** DUPLICATE (confidence: 0.95)
**Shared Behavior:** ['opens illuminator DB via openIlluminatorDb()', 'creates readonly transaction on target store', 'queries by index (simulationRunId or projectId)', 'filters/sorts results in onsuccess callback', 'closes DB in finally block']
**Meaningful Differences:** ["chronicler filters for status==='complete' inline; canonry delegates to filterCompleted()", 'world-store uses generic getAllByIndex helper instead of raw IDB', 'canonry is JS, chronicler is TS, world-store is TS']
**Accidental Differences:** ['function naming: getCompletedChroniclesForSimulation vs getChronicles', 'error handling: canonry/chronicler wrap in try/catch, world-store does not', 'store name constants: CHRONICLE_STORE_NAME vs CHRONICLES_STORE']
**Feature Gaps:** ["world-store has generic getRecord/getAllByIndex helpers that canonry/chronicler don't use", 'canonry has import/seed functions that world-store lacks']
**Consolidation Complexity:** MEDIUM
**Consolidation Reasoning:** world-store already contains generic helpers (getRecord, getAllByIndex) that could replace all raw IDB boilerplate in canonry/storage and chronicler/lib. The challenge is that canonry/chronicler have additional filtering/projection logic that would need to be parameterized.
**Consumer Impact:** canonry App.jsx, chronicler components, illuminator components — 3 apps import these functions

### cluster-009: Prefixed ID generation — produce unique IDs in the format prefix_timestamp_uuid-slice for database records
**Members:** 8 | **Avg Similarity:** 0.62 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generateCostId | function | .../illuminator/webui/src/lib/db/costRepository.ts | behavior:1.00, typeSignature:1.00, callSequence:0.92, calleeSet:0.92 |
| generateRunId | function | ...uminator/webui/src/lib/db/dynamicsRepository.ts | behavior:1.00, typeSignature:1.00, callSequence:0.92, calleeSet:0.92 |
| generateEraNarrativeId | function | ...ator/webui/src/lib/db/eraNarrativeRepository.ts | behavior:1.00, typeSignature:1.00, callSequence:0.92, calleeSet:0.92 |
| generateVersionId | function | ...ator/webui/src/lib/db/eraNarrativeRepository.ts | behavior:1.00, typeSignature:1.00, callSequence:0.92, calleeSet:0.92 |
| generateHistorianRunId | function | ...minator/webui/src/lib/db/historianRepository.ts | behavior:1.00, typeSignature:1.00, callSequence:0.92, calleeSet:0.92 |
| generatePageId | function | ...inator/webui/src/lib/db/staticPageRepository.ts | behavior:1.00, typeSignature:1.00, callSequence:0.92, calleeSet:0.92 |
| generateRevisionRunId | function | ...r/webui/src/lib/db/summaryRevisionRepository.ts | behavior:1.00, typeSignature:1.00, callSequence:0.92, calleeSet:0.92 |
| generateEventId | function | apps/lore-weave/lib/core/idGeneration.ts | behavior:1.00, typeSignature:1.00, callSequence:0.92, calleeSet:0.92 |

**Verdict:** DUPLICATE (confidence: 0.98)
**Shared Behavior:** ['uses Date.now() for timestamp component', 'uses crypto.randomUUID().slice() for random component', 'returns template string: prefix_timestamp_random']
**Accidental Differences:** ['different prefix strings (cost_, dynrun_, eranarr_, enver_, histrun_, static_, revrun_, event_)', 'UUID slice length varies: 6, 8, or 9 characters']
**Feature Gaps:** ["lore-weave's generateEventId has a fallback for missing crypto.randomUUID"]
**Consolidation Complexity:** LOW
**Consolidation Reasoning:** All 7 illuminator functions are trivially identical: prefix_${Date.now()}_${crypto.randomUUID().slice(0, N)}. A single generatePrefixedId(prefix, sliceLength?) utility replaces all of them.
**Consumer Impact:** 7 illuminator repository files, 1 lore-weave core file

## OVERLAPPING (2)

### cluster-004: IndexedDB write/mutation operations — persist world data, import bundles, manage simulation slots across canonry storage and illuminator repository layers
**Members:** 26 | **Avg Similarity:** 0.41 | **Spread:** 3 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| buildImageStorageConfig | function | apps/canonry/webui/src/aws/awsS3.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| createS3Client | function | apps/canonry/webui/src/aws/awsS3.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| listS3Prefixes | function | apps/canonry/webui/src/aws/awsS3.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| importChronicles | function | apps/canonry/webui/src/storage/chronicleStorage.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| importEntities | function | apps/canonry/webui/src/storage/entityStorage.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| importNarrativeEvents | function | apps/canonry/webui/src/storage/eventStorage.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| deleteRunSlot | function | apps/canonry/webui/src/storage/runStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| getRunSlot | function | apps/canonry/webui/src/storage/runStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| importStaticPages | function | .../canonry/webui/src/storage/staticPageStorage.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| loadAndImportSeedPages | function | .../canonry/webui/src/storage/staticPageStorage.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| clearSlot | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| generateSlotTitle | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| getSlot | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| loadSlot | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| saveCultureIdentities | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| saveEnrichmentConfig | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| saveEntityGuidance | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| saveHistorianConfig | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| saveStyleSelection | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| saveToActiveSlot | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| saveToSlot | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| saveWorldContext | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| saveWorldData | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| setActiveSlotIndex | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| getSlot | function | .../illuminator/webui/src/lib/db/slotRepository.ts | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |
| getSlotRecord | function | packages/world-store/src/index.ts | consumerSet:0.85, neighborhood:0.85, coOccurrence:0.84, behavior:0.84 |

**Verdict:** OVERLAPPING (confidence: 0.85)
**Shared Behavior:** ['opens illuminator DB via openIlluminatorDb()', 'creates readwrite transactions', 'puts/deletes records in IDB stores', 'closes DB after operation']
**Meaningful Differences:** ['canonry storage handles bulk import (importChronicles, importEntities, importNarrativeEvents, importStaticPages)', 'illuminator has Dexie-based repository with richer typed CRUD', 'canonry worldStore manages slot lifecycle (save/load/clear) which is app-specific']
**Accidental Differences:** ['canonry uses raw IDB API, illuminator uses Dexie ORM', 'different error handling patterns', 'JS vs TS']
**Feature Gaps:** ['illuminator repositories have typed Dexie schemas; canonry storage does not', 'canonry has slot management (saveToSlot, loadSlot, clearSlot) that illuminator accesses via world-store']
**Consolidation Complexity:** HIGH
**Consolidation Reasoning:** The write paths are more heterogeneous than the reads (cluster-001). Canonry's import functions handle bulk seeding from bundles, while illuminator's repositories handle per-record CRUD during enrichment workflows. Consolidation would require establishing world-store as the canonical write layer and migrating both apps, but the slot management and import logic are app-specific enough to resist full unification.
**Consumer Impact:** canonry App.jsx + storage modules, illuminator stores + repositories

### cluster-006: Illuminator Dexie repository layer — typed CRUD for entities, events, relationships, chronicles, schemas, static pages against the illuminator IndexedDB
**Members:** 23 | **Avg Similarity:** 0.42 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| refreshEraSummariesInChronicles | function | ...minator/webui/src/lib/db/chronicleRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| getCoordinateState | function | ...r/webui/src/lib/db/coordinateStateRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| upsertCoordinateState | function | ...r/webui/src/lib/db/coordinateStateRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| getDynamicsRun | function | ...uminator/webui/src/lib/db/dynamicsRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| deleteEntitiesForRun | function | ...lluminator/webui/src/lib/db/entityRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| deleteEntity | function | ...lluminator/webui/src/lib/db/entityRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| getEntitiesForRun | function | ...lluminator/webui/src/lib/db/entityRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| getEntity | function | ...lluminator/webui/src/lib/db/entityRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| isSeeded | function | ...lluminator/webui/src/lib/db/entityRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| getEraNarrative | function | ...ator/webui/src/lib/db/eraNarrativeRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| deleteEventsForRun | function | ...illuminator/webui/src/lib/db/eventRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| getNarrativeEvent | function | ...illuminator/webui/src/lib/db/eventRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| getNarrativeEventsForRun | function | ...illuminator/webui/src/lib/db/eventRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| isNarrativeEventsSeeded | function | ...illuminator/webui/src/lib/db/eventRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| getHistorianRun | function | ...minator/webui/src/lib/db/historianRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| deleteRelationshipsForRun | function | ...ator/webui/src/lib/db/relationshipRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| getRelationshipsForRun | function | ...ator/webui/src/lib/db/relationshipRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| isRelationshipsSeeded | function | ...ator/webui/src/lib/db/relationshipRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| getSchema | function | ...lluminator/webui/src/lib/db/schemaRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| upsertSchema | function | ...lluminator/webui/src/lib/db/schemaRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| getStaticPage | function | ...inator/webui/src/lib/db/staticPageRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| getRevisionRun | function | ...r/webui/src/lib/db/summaryRevisionRepository.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |
| getNarrativeEvents | function | packages/world-store/src/index.ts | behavior:1.00, typeSignature:0.70, imports:0.61, semantic:0.56 |

**Verdict:** OVERLAPPING (confidence: 0.88)
**Shared Behavior:** ['accesses illuminator database', 'reads/writes same stores as canonry/storage and world-store', 'query by simulationRunId or entity ID']
**Meaningful Differences:** ['illuminator uses Dexie ORM (db.entities.where/put/delete)', 'canonry uses raw IDB API', 'world-store uses raw IDB with generic helpers', 'illuminator has richer operations (isSeeded, seedEntities, refreshEraSummaries)']
**Accidental Differences:** ['three different access patterns for the same physical database', 'different typing strategies (Dexie typed tables vs manual TS vs untyped JS)']
**Feature Gaps:** ['illuminator has seed detection (isSeeded, isNarrativeEventsSeeded, isRelationshipsSeeded)', 'illuminator has batch refresh operations (refreshEraSummariesInChronicles)', 'world-store has buildWorldStateForSlot() that reads across stores']
**Consolidation Complexity:** HIGH
**Consolidation Reasoning:** Three apps access the same DB through three different access layers. Illuminator's Dexie layer is the richest but only works within illuminator. A unified approach would make world-store the single access layer using Dexie, replacing raw IDB in canonry and chronicler. This is a large architectural change touching 50+ functions.
**Consumer Impact:** illuminator (22 repository functions), canonry (15+ storage functions), chronicler (8 storage functions), world-store (15 functions)

## RELATED (2)

### cluster-020: Modal/overlay components with keyboard event listeners — serving different purposes (era narrative, relationship stories, image lightbox, entity details, image modal)
**Members:** 5 | **Avg Similarity:** 0.38 | **Spread:** 3 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...archivist/webui/src/components/EraNarrative.tsx | neighborhood:1.00, behavior:0.88, typeSignature:0.64, semantic:0.55 |
| default | function | ...webui/src/components/RelationshipStoryModal.tsx | neighborhood:1.00, behavior:0.88, typeSignature:0.64, semantic:0.55 |
| default | function | ...ronicler/webui/src/components/ImageLightbox.tsx | neighborhood:1.00, behavior:0.88, typeSignature:0.64, semantic:0.55 |
| default | function | ...nator/webui/src/components/EntityDetailView.tsx | neighborhood:1.00, behavior:0.88, typeSignature:0.64, semantic:0.55 |
| default | function | ...illuminator/webui/src/components/ImageModal.jsx | neighborhood:1.00, behavior:0.88, typeSignature:0.64, semantic:0.55 |

**Verdict:** RELATED (confidence: 0.75)
**Shared Behavior:** ['document.addEventListener for keyboard/click events', 'useCallback + useEffect + useRef hook combo', 'overlay/fullscreen presentation']
**Meaningful Differences:** ['EraNarrative renders narrative text content', 'RelationshipStoryModal displays relationship story data', 'ImageLightbox is an image viewer with zoom/navigation', 'EntityDetailView shows entity metadata', 'ImageModal displays image with metadata']
**Accidental Differences:** ['shared keyboard handler boilerplate (already captured by modal-close-behavior-drift manifest entry)']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** These components share infrastructure (keyboard handling, overlay pattern) but serve genuinely different purposes. The shared infrastructure concern is already captured by the modal-implementation-drift and modal-close-behavior-drift manifest entries.
**Consumer Impact:** N/A

### cluster-021: ID generation functions with heterogeneous strategies — counter-based, timestamp-based, and entity-prefixed
**Members:** 6 | **Avg Similarity:** 0.46 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generateImageId | function | ...illuminator/webui/src/lib/db/imageRepository.ts | behavior:1.00, typeSignature:1.00, semantic:0.71, neighborhood:0.56 |
| generateId | function | apps/lore-weave/lib/core/idGeneration.ts | behavior:1.00, typeSignature:1.00, semantic:0.71, neighborhood:0.56 |
| generateLoreId | function | apps/lore-weave/lib/core/idGeneration.ts | behavior:1.00, typeSignature:1.00, semantic:0.71, neighborhood:0.56 |
| generateId | function | apps/lore-weave/lib/index.ts | behavior:1.00, typeSignature:1.00, semantic:0.71, neighborhood:0.56 |
| generateId | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, typeSignature:1.00, semantic:0.71, neighborhood:0.56 |
| generateLoreId | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, typeSignature:1.00, semantic:0.71, neighborhood:0.56 |

**Verdict:** RELATED (confidence: 0.8)
**Shared Behavior:** ['generate unique string IDs for database records']
**Meaningful Differences:** ['generateImageId uses entityId+timestamp (domain-specific composite key)', 'generateId uses incrementing counter (stateful, session-scoped)', 'generateLoreId uses timestamp+counter hybrid (also stateful)']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** Unlike cluster-009 where all functions are trivially identical, these three serve different needs: generateImageId creates entity-scoped IDs, generateId is a simple sequential counter for simulation entities, generateLoreId is a hybrid. Should remain separate.
**Consumer Impact:** N/A

## FALSE_POSITIVE (15)

### cluster-002: Re-export chain — shared UI components exported through barrel files
**Members:** 39 | **Avg Similarity:** 0.44 | **Spread:** 3 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| AddCard | component | ...nce-engine/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| AddItemButton | component | ...nce-engine/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| EmptyState | component | ...nce-engine/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| EnableToggle | component | ...nce-engine/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| InfoBox | component | ...nce-engine/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| ItemRow | component | ...nce-engine/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| AddCard | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| AddItemButton | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| EmptyState | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| EnableToggle | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| ExpandableCard | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| FormGroup | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| FormRow | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| InfoBox | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| ItemRow | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| AddCard | component | ...es/shared-components/src/components/AddCard.jsx | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| AddItemButton | component | ...red-components/src/components/AddItemButton.jsx | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| EmptyState | component | ...shared-components/src/components/EmptyState.jsx | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| EnableToggle | component | ...ared-components/src/components/EnableToggle.jsx | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| ExpandableCard | component | ...ed-components/src/components/ExpandableCard.jsx | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| FormGroup | component | .../shared-components/src/components/FormGroup.jsx | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| FormRow | component | .../shared-components/src/components/FormGroup.jsx | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| InfoBox | component | ...es/shared-components/src/components/InfoBox.jsx | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| ItemRow | component | ...es/shared-components/src/components/ItemRow.jsx | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| AddCard | component | packages/shared-components/src/components/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| AddItemButton | component | packages/shared-components/src/components/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| EmptyState | component | packages/shared-components/src/components/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| EnableToggle | component | packages/shared-components/src/components/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| InfoBox | component | packages/shared-components/src/components/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| ItemRow | component | packages/shared-components/src/components/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| AddCard | component | packages/shared-components/src/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| AddItemButton | component | packages/shared-components/src/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| EmptyState | component | packages/shared-components/src/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| EnableToggle | component | packages/shared-components/src/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| ExpandableCard | component | packages/shared-components/src/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| FormGroup | component | packages/shared-components/src/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| FormRow | component | packages/shared-components/src/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| InfoBox | component | packages/shared-components/src/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |
| ItemRow | component | packages/shared-components/src/index.js | callSequence:1.00, calleeSet:0.98, behavior:0.95, neighborhood:0.83 |

**Verdict:** FALSE_POSITIVE (confidence: 0.99)
**Shared Behavior:** ['re-export from @the-canonry/shared-components']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** These are the same components re-exported through barrel index.js files in coherence-engine and name-forge. The app-level shared/index.js files contain pure re-exports from @the-canonry/shared-components, not independent implementations.
**Consumer Impact:** N/A

### cluster-003: Re-export chain — dropdown/select components plus a few domain-specific editors that share hook profiles
**Members:** 25 | **Avg Similarity:** 0.48 | **Spread:** 3 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| OutcomeTab | component | ...ebui/src/components/actions/tabs/OutcomeTab.jsx | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| OutcomeTab | component | ...gine/webui/src/components/actions/tabs/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| SelectionFiltersEditor | component | ...s/generators/filters/SelectionFiltersEditor.jsx | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| SelectionFiltersEditor | component | ...ebui/src/components/generators/filters/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| EffectsTab | component | ...engine/webui/src/components/generators/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| SelectionFiltersEditor | component | ...engine/webui/src/components/generators/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| EffectsTab | component | ...i/src/components/generators/tabs/EffectsTab.jsx | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| EffectsTab | component | ...e/webui/src/components/generators/tabs/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| ChipSelect | component | ...nce-engine/webui/src/components/shared/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| ReferenceDropdown | component | ...nce-engine/webui/src/components/shared/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| SearchableDropdown | component | ...nce-engine/webui/src/components/shared/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| ChipSelect | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| ReferenceDropdown | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| SearchableDropdown | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| TagSelector | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| ChipSelect | component | ...shared-components/src/components/ChipSelect.jsx | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| ReferenceDropdown | component | ...components/src/components/ReferenceDropdown.jsx | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| SearchableDropdown | component | ...omponents/src/components/SearchableDropdown.jsx | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| ChipSelect | component | packages/shared-components/src/components/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| ReferenceDropdown | component | packages/shared-components/src/components/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| SearchableDropdown | component | packages/shared-components/src/components/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| ChipSelect | component | packages/shared-components/src/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| ReferenceDropdown | component | packages/shared-components/src/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| SearchableDropdown | component | packages/shared-components/src/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |
| TagSelector | component | packages/shared-components/src/index.js | callSequence:1.00, behavior:0.99, hookProfile:0.96, neighborhood:0.76 |

**Verdict:** FALSE_POSITIVE (confidence: 0.95)
**Shared Behavior:** ['re-export from @the-canonry/shared-components']
**Meaningful Differences:** ['SelectionFiltersEditor and EffectsTab are domain-specific editors, not generic shared components']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** Cluster is dominated by ChipSelect, ReferenceDropdown, SearchableDropdown re-export chains. The domain editors (OutcomeTab, EffectsTab, SelectionFiltersEditor) were pulled in by shared hook profiles (useState, useMemo, useEffect) — structural similarity, not semantic duplication.
**Consumer Impact:** N/A

### cluster-005: Re-export chain — validation badges (ErrorBadge, OrphanBadge, SectionHeader, TabValidationBadge)
**Members:** 20 | **Avg Similarity:** 0.51 | **Spread:** 3 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ErrorBadge | component | ...nce-engine/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| OrphanBadge | component | ...nce-engine/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| SectionHeader | component | ...nce-engine/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| TabValidationBadge | component | ...nce-engine/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| ErrorBadge | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| OrphanBadge | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| SectionHeader | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| TabValidationBadge | component | ...name-forge/webui/src/components/shared/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| SectionHeader | component | ...red-components/src/components/SectionHeader.jsx | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| ErrorBadge | component | ...d-components/src/components/ValidationBadge.jsx | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| OrphanBadge | component | ...d-components/src/components/ValidationBadge.jsx | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| TabValidationBadge | component | ...d-components/src/components/ValidationBadge.jsx | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| ErrorBadge | component | packages/shared-components/src/components/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| OrphanBadge | component | packages/shared-components/src/components/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| SectionHeader | component | packages/shared-components/src/components/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| TabValidationBadge | component | packages/shared-components/src/components/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| ErrorBadge | component | packages/shared-components/src/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| OrphanBadge | component | packages/shared-components/src/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| SectionHeader | component | packages/shared-components/src/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |
| TabValidationBadge | component | packages/shared-components/src/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.94, typeSignature:0.83 |

**Verdict:** FALSE_POSITIVE (confidence: 0.99)
**Shared Behavior:** ['re-export from @the-canonry/shared-components']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** Same re-export chain pattern as cluster-002. Components defined in shared-components, re-exported through app barrel files.
**Consumer Impact:** N/A

### cluster-007: Default-exported lazy-loaded view components plus index re-exports
**Members:** 9 | **Avg Similarity:** 0.46 | **Spread:** 3 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...ngine/webui/src/components/DependencyViewer.jsx | neighborhood:1.00, typeSignature:0.86, behavior:0.84, calleeSet:0.61 |
| default | function | ...mponents/dependency-viewer/DependencyViewer.jsx | neighborhood:1.00, typeSignature:0.86, behavior:0.84, calleeSet:0.61 |
| default | function | ...webui/src/components/dependency-viewer/index.js | neighborhood:1.00, typeSignature:0.86, behavior:0.84, calleeSet:0.61 |
| default | function | .../src/components/config/ConfigurationSummary.jsx | neighborhood:1.00, typeSignature:0.86, behavior:0.84, calleeSet:0.61 |
| default | function | ...lore-weave/webui/src/components/config/index.js | neighborhood:1.00, typeSignature:0.86, behavior:0.84, calleeSet:0.61 |
| default | function | .../webui/src/components/results/ResultsViewer.jsx | neighborhood:1.00, typeSignature:0.86, behavior:0.84, calleeSet:0.61 |
| default | function | ...ore-weave/webui/src/components/results/index.js | neighborhood:1.00, typeSignature:0.86, behavior:0.84, calleeSet:0.61 |
| default | function | .../src/components/optimizer/OptimizerWorkshop.jsx | neighborhood:1.00, typeSignature:0.86, behavior:0.84, calleeSet:0.61 |
| default | function | ...e-forge/webui/src/components/optimizer/index.js | neighborhood:1.00, typeSignature:0.86, behavior:0.84, calleeSet:0.61 |

**Verdict:** FALSE_POSITIVE (confidence: 0.85)
**Shared Behavior:** ['default export pattern', 'use Object.entries and useMemo for data processing']
**Meaningful Differences:** ['DependencyViewer shows dependency graphs', 'ConfigurationSummary shows config overview', 'ResultsViewer shows simulation results', 'OptimizerWorkshop shows optimization UI']
**Accidental Differences:** ['shared useMemo + Object.entries pattern']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** Structural similarity from shared React patterns (useMemo, Object.entries().map). These components serve completely different purposes — dependency visualization, config summary, simulation results, and optimization. Not semantic drift.
**Consumer Impact:** N/A

### cluster-008: Re-export chain — IconButton component
**Members:** 5 | **Avg Similarity:** 0.67 | **Spread:** 3 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| IconButton | component | ...nce-engine/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| IconButton | component | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| IconButton | component | ...shared-components/src/components/IconButton.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| IconButton | component | packages/shared-components/src/components/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| IconButton | component | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

**Verdict:** FALSE_POSITIVE (confidence: 0.99)
**Shared Behavior:** ['re-export from @the-canonry/shared-components']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** IconButton defined once in shared-components, re-exported through barrel files.
**Consumer Impact:** N/A

### cluster-010: Re-export chain — ModalShell component
**Members:** 5 | **Avg Similarity:** 0.63 | **Spread:** 3 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ModalShell | component | ...nce-engine/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| ModalShell | component | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| ModalShell | component | ...shared-components/src/components/ModalShell.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| ModalShell | component | packages/shared-components/src/components/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| ModalShell | component | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

**Verdict:** FALSE_POSITIVE (confidence: 0.99)
**Shared Behavior:** ['re-export from @the-canonry/shared-components']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** ModalShell defined once in shared-components, re-exported through barrel files.
**Consumer Impact:** N/A

### cluster-011: Re-export chain — LevelSelector component
**Members:** 5 | **Avg Similarity:** 0.61 | **Spread:** 3 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| LevelSelector | component | ...nce-engine/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| LevelSelector | component | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| LevelSelector | component | ...red-components/src/components/LevelSelector.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| LevelSelector | component | packages/shared-components/src/components/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| LevelSelector | component | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

**Verdict:** FALSE_POSITIVE (confidence: 0.99)
**Shared Behavior:** ['re-export from @the-canonry/shared-components']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** LevelSelector defined once in shared-components, re-exported through barrel files.
**Consumer Impact:** N/A

### cluster-012: Re-export chain — useEditorState hook
**Members:** 5 | **Avg Similarity:** 0.60 | **Spread:** 3 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| useEditorState | hook | ...nce-engine/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| useEditorState | hook | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| useEditorState | hook | ...mponents/src/components/hooks/useEditorState.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| useEditorState | hook | packages/shared-components/src/components/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| useEditorState | hook | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

**Verdict:** FALSE_POSITIVE (confidence: 0.99)
**Shared Behavior:** ['re-export from @the-canonry/shared-components']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** useEditorState defined once in shared-components, re-exported through barrel files. Note: the structural manifest already tracks the coherence-engine diverged copy separately (shared-hook-divergence).
**Consumer Impact:** N/A

### cluster-013: Re-export chain — getElementValidation utility
**Members:** 5 | **Avg Similarity:** 0.59 | **Spread:** 3 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getElementValidation | function | ...nce-engine/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| getElementValidation | function | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| getElementValidation | function | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| getElementValidation | function | packages/shared-components/src/utils/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| getElementValidation | function | ...s/shared-components/src/utils/schemaUsageMap.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

**Verdict:** FALSE_POSITIVE (confidence: 0.99)
**Shared Behavior:** ['re-export from @the-canonry/shared-components']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** getElementValidation defined once in shared-components/utils, re-exported through barrel files.
**Consumer Impact:** N/A

### cluster-014: Re-export chain — EraBadges component
**Members:** 5 | **Avg Similarity:** 0.58 | **Spread:** 3 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| EraBadges | component | ...nce-engine/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| EraBadges | component | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| EraBadges | component | .../shared-components/src/components/EraBadges.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| EraBadges | component | packages/shared-components/src/components/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| EraBadges | component | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

**Verdict:** FALSE_POSITIVE (confidence: 0.99)
**Shared Behavior:** ['re-export from @the-canonry/shared-components']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** EraBadges defined once in shared-components, re-exported through barrel files.
**Consumer Impact:** N/A

### cluster-015: Re-export chain — DetailUsageBadges / UsageBadges component
**Members:** 5 | **Avg Similarity:** 0.58 | **Spread:** 3 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| UsageBadges | component | ...omponents/dependency-viewer/components/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| DetailUsageBadges | component | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| DetailUsageBadges | component | ...nts/src/components/badges/DetailUsageBadges.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| DetailUsageBadges | component | ...hared-components/src/components/badges/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| DetailUsageBadges | component | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

**Verdict:** FALSE_POSITIVE (confidence: 0.95)
**Shared Behavior:** ['re-export from @the-canonry/shared-components']
**Meaningful Differences:** ['coherence-engine exports as UsageBadges (different name) from dependency-viewer/components/index.js']
**Accidental Differences:** ['component name: UsageBadges vs DetailUsageBadges']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** Mostly re-export chain. The coherence-engine UsageBadges name divergence is minor.
**Consumer Impact:** N/A

### cluster-016: Re-export chain — PressureChangesEditor component
**Members:** 5 | **Avg Similarity:** 0.58 | **Spread:** 3 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| PressureChangesEditor | component | ...nce-engine/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| PressureChangesEditor | component | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| PressureChangesEditor | component | ...onents/src/components/PressureChangesEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| PressureChangesEditor | component | packages/shared-components/src/components/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| PressureChangesEditor | component | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

**Verdict:** FALSE_POSITIVE (confidence: 0.99)
**Shared Behavior:** ['re-export from @the-canonry/shared-components']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** PressureChangesEditor defined once in shared-components, re-exported through barrel files.
**Consumer Impact:** N/A

### cluster-017: Re-export chain — CategorySection component
**Members:** 5 | **Avg Similarity:** 0.58 | **Spread:** 3 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| CategorySection | component | ...nce-engine/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| CategorySection | component | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| CategorySection | component | ...d-components/src/components/CategorySection.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| CategorySection | component | packages/shared-components/src/components/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| CategorySection | component | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

**Verdict:** FALSE_POSITIVE (confidence: 0.99)
**Shared Behavior:** ['re-export from @the-canonry/shared-components']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** CategorySection defined once in shared-components, re-exported through barrel files.
**Consumer Impact:** N/A

### cluster-018: Re-export chain — useLocalInputState hook
**Members:** 5 | **Avg Similarity:** 0.57 | **Spread:** 3 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| useLocalInputState | hook | ...nce-engine/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| useLocalInputState | hook | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| useLocalInputState | hook | ...ents/src/components/hooks/useLocalInputState.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| useLocalInputState | hook | packages/shared-components/src/components/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| useLocalInputState | hook | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

**Verdict:** FALSE_POSITIVE (confidence: 0.99)
**Shared Behavior:** ['re-export from @the-canonry/shared-components']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** useLocalInputState defined once in shared-components, re-exported through barrel files. Note: the structural manifest already tracks the dead copy in coherence-engine (shared-hook-divergence).
**Consumer Impact:** N/A

### cluster-019: Re-export chain — name-forge mutation functions exported through barrel files
**Members:** 13 | **Avg Similarity:** 0.46 | **Spread:** 1 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyRandomMutation | function | apps/name-forge/lib/index.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.95, calleeSet:0.50 |
| addConsonant | function | apps/name-forge/lib/optimizer/index.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.95, calleeSet:0.50 |
| addTemplate | function | apps/name-forge/lib/optimizer/index.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.95, calleeSet:0.50 |
| addVowel | function | apps/name-forge/lib/optimizer/index.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.95, calleeSet:0.50 |
| applyRandomMutation | function | apps/name-forge/lib/optimizer/index.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.95, calleeSet:0.50 |
| swapConsonant | function | apps/name-forge/lib/optimizer/index.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.95, calleeSet:0.50 |
| swapVowel | function | apps/name-forge/lib/optimizer/index.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.95, calleeSet:0.50 |
| addConsonant | function | apps/name-forge/lib/optimizer/mutations.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.95, calleeSet:0.50 |
| addTemplate | function | apps/name-forge/lib/optimizer/mutations.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.95, calleeSet:0.50 |
| addVowel | function | apps/name-forge/lib/optimizer/mutations.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.95, calleeSet:0.50 |
| applyRandomMutation | function | apps/name-forge/lib/optimizer/mutations.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.95, calleeSet:0.50 |
| swapConsonant | function | apps/name-forge/lib/optimizer/mutations.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.95, calleeSet:0.50 |
| swapVowel | function | apps/name-forge/lib/optimizer/mutations.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.95, calleeSet:0.50 |

**Verdict:** FALSE_POSITIVE (confidence: 0.95)
**Shared Behavior:** ['re-export from name-forge/lib/optimizer/mutations.ts']
**Consolidation Complexity:** N/A
**Consolidation Reasoning:** Functions defined in mutations.ts, re-exported through optimizer/index.ts, then lib/index.ts. Standard barrel export architecture, not duplication.
**Consumer Impact:** N/A

## Unverified (393)

### cluster-022: getUsageSummary, getUsageSummary, getUsageSummary, getUsageSummary
**Members:** 4 | **Avg Similarity:** 0.65 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getUsageSummary | function | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getUsageSummary | function | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getUsageSummary | function | packages/shared-components/src/utils/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getUsageSummary | function | ...s/shared-components/src/utils/schemaUsageMap.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-023: computeUsageMap, computeUsageMap, computeUsageMap, computeUsageMap
**Members:** 4 | **Avg Similarity:** 0.65 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| computeUsageMap | function | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| computeUsageMap | function | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| computeUsageMap | function | packages/shared-components/src/utils/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| computeUsageMap | function | ...s/shared-components/src/utils/schemaUsageMap.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-024: LocalTextArea, LocalTextArea, LocalTextArea, LocalTextArea
**Members:** 4 | **Avg Similarity:** 0.65 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| LocalTextArea | component | ...nce-engine/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| LocalTextArea | component | ...red-components/src/components/LocalTextArea.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| LocalTextArea | component | packages/shared-components/src/components/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| LocalTextArea | component | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-025: computeTagUsage, computeTagUsage, computeTagUsage, computeTagUsage
**Members:** 4 | **Avg Similarity:** 0.64 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| computeTagUsage | function | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| computeTagUsage | function | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| computeTagUsage | function | packages/shared-components/src/utils/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| computeTagUsage | function | ...s/shared-components/src/utils/schemaUsageMap.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-026: NumberInput, NumberInput, NumberInput, NumberInput
**Members:** 4 | **Avg Similarity:** 0.61 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| NumberInput | component | ...nce-engine/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| NumberInput | component | ...hared-components/src/components/NumberInput.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| NumberInput | component | packages/shared-components/src/components/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| NumberInput | component | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-027: ToolUsageBadges, ToolUsageBadges, ToolUsageBadges, ToolUsageBadges
**Members:** 4 | **Avg Similarity:** 0.59 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ToolUsageBadges | component | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| ToolUsageBadges | component | ...nents/src/components/badges/ToolUsageBadges.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| ToolUsageBadges | component | ...hared-components/src/components/badges/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| ToolUsageBadges | component | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

*Pending semantic verification*

### cluster-028: ProbabilityTab, ProbabilityTab, StoryPotentialRadarWithScore, StoryPotentialRadarWithScore
**Members:** 4 | **Avg Similarity:** 0.57 | **Spread:** 2 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ProbabilityTab | component | .../src/components/actions/tabs/ProbabilityTab.jsx | callSequence:1.00, calleeSet:1.00, behavior:0.96, typeSignature:0.80 |
| ProbabilityTab | component | ...gine/webui/src/components/actions/tabs/index.js | callSequence:1.00, calleeSet:1.00, behavior:0.96, typeSignature:0.80 |
| StoryPotentialRadarWithScore | component | ...leWizard/visualizations/StoryPotentialRadar.tsx | callSequence:1.00, calleeSet:1.00, behavior:0.96, typeSignature:0.80 |
| StoryPotentialRadarWithScore | component | ...ponents/ChronicleWizard/visualizations/index.ts | callSequence:1.00, calleeSet:1.00, behavior:0.96, typeSignature:0.80 |

*Pending semantic verification*

### cluster-029: modifyTemplate, mutateApostropheRate, mutateHyphenRate, mutateLengthRange, +4 more
**Members:** 8 | **Avg Similarity:** 0.56 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| modifyTemplate | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.89 |
| mutateApostropheRate | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.89 |
| mutateHyphenRate | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.89 |
| mutateLengthRange | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.89 |
| modifyTemplate | function | apps/name-forge/lib/optimizer/mutations.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.89 |
| mutateApostropheRate | function | apps/name-forge/lib/optimizer/mutations.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.89 |
| mutateHyphenRate | function | apps/name-forge/lib/optimizer/mutations.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.89 |
| mutateLengthRange | function | apps/name-forge/lib/optimizer/mutations.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.89 |

*Pending semantic verification*

### cluster-030: createEmptyProject, deleteProject, listProjects, loadProject, +7 more
**Members:** 11 | **Avg Similarity:** 0.38 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createEmptyProject | function | apps/canonry/webui/src/storage/db.js | consumerSet:0.85, neighborhood:0.83, behavior:0.82, dataAccess:0.69 |
| deleteProject | function | apps/canonry/webui/src/storage/db.js | consumerSet:0.85, neighborhood:0.83, behavior:0.82, dataAccess:0.69 |
| listProjects | function | apps/canonry/webui/src/storage/db.js | consumerSet:0.85, neighborhood:0.83, behavior:0.82, dataAccess:0.69 |
| loadProject | function | apps/canonry/webui/src/storage/db.js | consumerSet:0.85, neighborhood:0.83, behavior:0.82, dataAccess:0.69 |
| openDatabase | function | apps/canonry/webui/src/storage/db.js | consumerSet:0.85, neighborhood:0.83, behavior:0.82, dataAccess:0.69 |
| saveProject | function | apps/canonry/webui/src/storage/db.js | consumerSet:0.85, neighborhood:0.83, behavior:0.82, dataAccess:0.69 |
| deleteRunSlotsForProject | function | apps/canonry/webui/src/storage/runStore.js | consumerSet:0.85, neighborhood:0.83, behavior:0.82, dataAccess:0.69 |
| loadLastProjectId | function | apps/canonry/webui/src/storage/uiState.js | consumerSet:0.85, neighborhood:0.83, behavior:0.82, dataAccess:0.69 |
| saveLastProjectId | function | apps/canonry/webui/src/storage/uiState.js | consumerSet:0.85, neighborhood:0.83, behavior:0.82, dataAccess:0.69 |
| loadWorldStore | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.83, behavior:0.82, dataAccess:0.69 |
| saveWorldStore | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.85, neighborhood:0.83, behavior:0.82, dataAccess:0.69 |

*Pending semantic verification*

### cluster-031: default, default, default, default, +5 more
**Members:** 9 | **Avg Similarity:** 0.46 | **Spread:** 1 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...e-engine/webui/src/components/ActionsEditor.jsx | neighborhood:1.00, behavior:0.96, typeSignature:0.73, calleeSet:0.62 |
| default | function | ...ngine/webui/src/components/GeneratorsEditor.jsx | neighborhood:1.00, behavior:0.96, typeSignature:0.73, calleeSet:0.62 |
| default | function | ...e-engine/webui/src/components/SystemsEditor.jsx | neighborhood:1.00, behavior:0.96, typeSignature:0.73, calleeSet:0.62 |
| default | function | .../webui/src/components/actions/ActionsEditor.jsx | neighborhood:1.00, behavior:0.96, typeSignature:0.73, calleeSet:0.62 |
| default | function | ...ce-engine/webui/src/components/actions/index.js | neighborhood:1.00, behavior:0.96, typeSignature:0.73, calleeSet:0.62 |
| default | function | .../src/components/generators/GeneratorsEditor.jsx | neighborhood:1.00, behavior:0.96, typeSignature:0.73, calleeSet:0.62 |
| default | function | ...engine/webui/src/components/generators/index.js | neighborhood:1.00, behavior:0.96, typeSignature:0.73, calleeSet:0.62 |
| default | function | .../webui/src/components/systems/SystemsEditor.jsx | neighborhood:1.00, behavior:0.96, typeSignature:0.73, calleeSet:0.62 |
| default | function | ...ce-engine/webui/src/components/systems/index.js | neighborhood:1.00, behavior:0.96, typeSignature:0.73, calleeSet:0.62 |

*Pending semantic verification*

### cluster-032: generateSlug, slugifyName, slugifyName, slugifyName
**Members:** 4 | **Avg Similarity:** 0.51 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generateSlug | function | ...inator/webui/src/lib/db/staticPageRepository.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, callSequence:0.65 |
| slugifyName | function | apps/lore-weave/lib/graph/entityMutation.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, callSequence:0.65 |
| slugifyName | function | apps/lore-weave/lib/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, callSequence:0.65 |
| slugifyName | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, callSequence:0.65 |

*Pending semantic verification*

### cluster-033: FinalDiagnostics, ExpandableSeedSection, ExpandableSeedSection, ExpandableSeedSection
**Members:** 4 | **Avg Similarity:** 0.51 | **Spread:** 2 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| FinalDiagnostics | component | ...e-weave/webui/src/components/dashboard/index.js | callSequence:1.00, hookProfile:1.00, neighborhood:1.00, behavior:0.94 |
| ExpandableSeedSection | component | ...mponents/src/components/ChronicleSeedViewer.jsx | callSequence:1.00, hookProfile:1.00, neighborhood:1.00, behavior:0.94 |
| ExpandableSeedSection | component | packages/shared-components/src/components/index.js | callSequence:1.00, hookProfile:1.00, neighborhood:1.00, behavior:0.94 |
| ExpandableSeedSection | component | packages/shared-components/src/index.js | callSequence:1.00, hookProfile:1.00, neighborhood:1.00, behavior:0.94 |

*Pending semantic verification*

### cluster-034: computeSchemaUsage, computeSchemaUsage, computeSchemaUsage
**Members:** 3 | **Avg Similarity:** 0.67 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| computeSchemaUsage | function | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| computeSchemaUsage | function | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| computeSchemaUsage | function | ...s/shared-components/src/utils/schemaUsageMap.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-035: buildCreativeStoryPrompt, selectEntitiesV2, buildCreativeStoryPrompt, selectEntitiesV2, +4 more
**Members:** 8 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| buildCreativeStoryPrompt | function | ...illuminator/webui/src/lib/chronicle/v2/index.ts | behavior:0.90, coOccurrence:0.80, consumerSet:0.80, neighborhood:0.80 |
| selectEntitiesV2 | function | ...illuminator/webui/src/lib/chronicle/v2/index.ts | behavior:0.90, coOccurrence:0.80, consumerSet:0.80, neighborhood:0.80 |
| buildCreativeStoryPrompt | function | ...tor/webui/src/lib/chronicle/v2/promptBuilder.ts | behavior:0.90, coOccurrence:0.80, consumerSet:0.80, neighborhood:0.80 |
| selectEntitiesV2 | function | ...nator/webui/src/lib/chronicle/v2/selectionV2.ts | behavior:0.90, coOccurrence:0.80, consumerSet:0.80, neighborhood:0.80 |
| createChronicle | function | ...minator/webui/src/lib/db/chronicleRepository.ts | behavior:0.90, coOccurrence:0.80, consumerSet:0.80, neighborhood:0.80 |
| regenerateChronicleAssembly | function | ...minator/webui/src/lib/db/chronicleRepository.ts | behavior:0.90, coOccurrence:0.80, consumerSet:0.80, neighborhood:0.80 |
| updateChronicleQuickCheckReport | function | ...minator/webui/src/lib/db/chronicleRepository.ts | behavior:0.90, coOccurrence:0.80, consumerSet:0.80, neighborhood:0.80 |
| updateChronicleTemporalCheckReport | function | ...minator/webui/src/lib/db/chronicleRepository.ts | behavior:0.90, coOccurrence:0.80, consumerSet:0.80, neighborhood:0.80 |

*Pending semantic verification*

### cluster-036: buildCopyEditSystemPrompt, getMaxTokensFromStyle, getV2SystemPrompt, getMaxTokensFromStyle, +5 more
**Members:** 9 | **Avg Similarity:** 0.42 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| buildCopyEditSystemPrompt | function | ...or/webui/src/lib/chronicle/v2/copyEditPrompt.ts | behavior:1.00, consumerSet:0.82, neighborhood:0.82, coOccurrence:0.80 |
| getMaxTokensFromStyle | function | ...illuminator/webui/src/lib/chronicle/v2/index.ts | behavior:1.00, consumerSet:0.82, neighborhood:0.82, coOccurrence:0.80 |
| getV2SystemPrompt | function | ...illuminator/webui/src/lib/chronicle/v2/index.ts | behavior:1.00, consumerSet:0.82, neighborhood:0.82, coOccurrence:0.80 |
| getMaxTokensFromStyle | function | ...tor/webui/src/lib/chronicle/v2/promptBuilder.ts | behavior:1.00, consumerSet:0.82, neighborhood:0.82, coOccurrence:0.80 |
| getV2SystemPrompt | function | ...tor/webui/src/lib/chronicle/v2/promptBuilder.ts | behavior:1.00, consumerSet:0.82, neighborhood:0.82, coOccurrence:0.80 |
| analyzeConstellation | function | ...uminator/webui/src/lib/constellationAnalyzer.ts | behavior:1.00, consumerSet:0.82, neighborhood:0.82, coOccurrence:0.80 |
| getScenePromptTemplate | function | apps/illuminator/webui/src/lib/coverImageStyles.ts | behavior:1.00, consumerSet:0.82, neighborhood:0.82, coOccurrence:0.80 |
| stripLeadingWrapper | function | apps/illuminator/webui/src/lib/jsonParsing.ts | behavior:1.00, consumerSet:0.82, neighborhood:0.82, coOccurrence:0.80 |
| stripLeadingWrapper | function | ...uminator/webui/src/workers/tasks/textParsing.ts | behavior:1.00, consumerSet:0.82, neighborhood:0.82, coOccurrence:0.80 |

*Pending semantic verification*

### cluster-037: createClusterFormationSystem, createClusterFormationSystem, createConnectionEvolutionSystem, createEraSpawnerSystem, +4 more
**Members:** 8 | **Avg Similarity:** 0.47 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createClusterFormationSystem | function | apps/lore-weave/lib/index.ts | consumerSet:0.95, neighborhood:0.95, coOccurrence:0.91, behavior:0.88 |
| createClusterFormationSystem | function | apps/lore-weave/lib/systems/clusterFormation.ts | consumerSet:0.95, neighborhood:0.95, coOccurrence:0.91, behavior:0.88 |
| createConnectionEvolutionSystem | function | apps/lore-weave/lib/systems/connectionEvolution.ts | consumerSet:0.95, neighborhood:0.95, coOccurrence:0.91, behavior:0.88 |
| createEraSpawnerSystem | function | apps/lore-weave/lib/systems/eraSpawner.ts | consumerSet:0.95, neighborhood:0.95, coOccurrence:0.91, behavior:0.88 |
| createEraTransitionSystem | function | apps/lore-weave/lib/systems/eraTransition.ts | consumerSet:0.95, neighborhood:0.95, coOccurrence:0.91, behavior:0.88 |
| createGraphContagionSystem | function | apps/lore-weave/lib/systems/graphContagion.ts | consumerSet:0.95, neighborhood:0.95, coOccurrence:0.91, behavior:0.88 |
| createRelationshipMaintenanceSystem | function | ...re-weave/lib/systems/relationshipMaintenance.ts | consumerSet:0.95, neighborhood:0.95, coOccurrence:0.91, behavior:0.88 |
| createUniversalCatalystSystem | function | apps/lore-weave/lib/systems/universalCatalyst.ts | consumerSet:0.95, neighborhood:0.95, coOccurrence:0.91, behavior:0.88 |

*Pending semantic verification*

### cluster-038: removeConsonant, removeTemplate, removeVowel, removeConsonant, +2 more
**Members:** 6 | **Avg Similarity:** 0.59 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| removeConsonant | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.81 |
| removeTemplate | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.81 |
| removeVowel | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.81 |
| removeConsonant | function | apps/name-forge/lib/optimizer/mutations.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.81 |
| removeTemplate | function | apps/name-forge/lib/optimizer/mutations.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.81 |
| removeVowel | function | apps/name-forge/lib/optimizer/mutations.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.81 |

*Pending semantic verification*

### cluster-039: OverviewTab, OverviewTab, OverviewTab, OverviewTab, +3 more
**Members:** 7 | **Avg Similarity:** 0.51 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| OverviewTab | component | ...bui/src/components/actions/tabs/OverviewTab.jsx | behavior:0.91, jsxStructure:0.79, typeSignature:0.76, calleeSet:0.70 |
| OverviewTab | component | ...gine/webui/src/components/actions/tabs/index.js | behavior:0.91, jsxStructure:0.79, typeSignature:0.76, calleeSet:0.70 |
| OverviewTab | component | ...engine/webui/src/components/generators/index.js | behavior:0.91, jsxStructure:0.79, typeSignature:0.76, calleeSet:0.70 |
| OverviewTab | component | .../src/components/generators/tabs/OverviewTab.jsx | behavior:0.91, jsxStructure:0.79, typeSignature:0.76, calleeSet:0.70 |
| OverviewTab | component | ...e/webui/src/components/generators/tabs/index.js | behavior:0.91, jsxStructure:0.79, typeSignature:0.76, calleeSet:0.70 |
| OverviewTab | component | ...bui/src/components/systems/tabs/OverviewTab.jsx | behavior:0.91, jsxStructure:0.79, typeSignature:0.76, calleeSet:0.70 |
| OverviewTab | component | ...gine/webui/src/components/systems/tabs/index.js | behavior:0.91, jsxStructure:0.79, typeSignature:0.76, calleeSet:0.70 |

*Pending semantic verification*

### cluster-040: ActionListCard, ActionListCard, GeneratorListCard, GeneratorListCard, +3 more
**Members:** 7 | **Avg Similarity:** 0.50 | **Spread:** 1 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ActionListCard | component | ...src/components/actions/cards/ActionListCard.jsx | callSequence:1.00, hookProfile:1.00, behavior:0.93, jsxStructure:0.71 |
| ActionListCard | component | ...ine/webui/src/components/actions/cards/index.js | callSequence:1.00, hookProfile:1.00, behavior:0.93, jsxStructure:0.71 |
| GeneratorListCard | component | ...mponents/generators/cards/GeneratorListCard.jsx | callSequence:1.00, hookProfile:1.00, behavior:0.93, jsxStructure:0.71 |
| GeneratorListCard | component | .../webui/src/components/generators/cards/index.js | callSequence:1.00, hookProfile:1.00, behavior:0.93, jsxStructure:0.71 |
| GeneratorListCard | component | ...engine/webui/src/components/generators/index.js | callSequence:1.00, hookProfile:1.00, behavior:0.93, jsxStructure:0.71 |
| SystemListCard | component | ...src/components/systems/cards/SystemListCard.jsx | callSequence:1.00, hookProfile:1.00, behavior:0.93, jsxStructure:0.71 |
| SystemListCard | component | ...ine/webui/src/components/systems/cards/index.js | callSequence:1.00, hookProfile:1.00, behavior:0.93, jsxStructure:0.71 |

*Pending semantic verification*

### cluster-041: saveAwsConfig, saveAwsTokens, saveUiState, saveStoredValue
**Members:** 4 | **Avg Similarity:** 0.41 | **Spread:** 2 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| saveAwsConfig | function | apps/canonry/webui/src/aws/awsConfigStorage.js | callSequence:1.00, behavior:0.92, calleeSet:0.71, typeSignature:0.67 |
| saveAwsTokens | function | apps/canonry/webui/src/aws/awsConfigStorage.js | callSequence:1.00, behavior:0.92, calleeSet:0.71, typeSignature:0.67 |
| saveUiState | function | apps/canonry/webui/src/storage/uiState.js | callSequence:1.00, behavior:0.92, calleeSet:0.71, typeSignature:0.67 |
| saveStoredValue | function | ...coherence-engine/webui/src/utils/persistence.js | callSequence:1.00, behavior:0.92, calleeSet:0.71, typeSignature:0.67 |

*Pending semantic verification*

### cluster-042: useBackportFlow, useDataSync, useDynamicsFlow, useHistorianCallbacks, +3 more
**Members:** 7 | **Avg Similarity:** 0.45 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| useBackportFlow | hook | .../illuminator/webui/src/hooks/useBackportFlow.js | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, hookProfile:0.81 |
| useDataSync | hook | apps/illuminator/webui/src/hooks/useDataSync.js | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, hookProfile:0.81 |
| useDynamicsFlow | hook | .../illuminator/webui/src/hooks/useDynamicsFlow.js | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, hookProfile:0.81 |
| useHistorianCallbacks | hook | ...inator/webui/src/hooks/useHistorianCallbacks.js | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, hookProfile:0.81 |
| useIlluminatorSetup | hook | ...uminator/webui/src/hooks/useIlluminatorSetup.js | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, hookProfile:0.81 |
| usePromptBuilder | hook | ...illuminator/webui/src/hooks/usePromptBuilder.js | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, hookProfile:0.81 |
| useRevisionFlow | hook | .../illuminator/webui/src/hooks/useRevisionFlow.js | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, hookProfile:0.81 |

*Pending semantic verification*

### cluster-043: addCluster, removeCluster, synthesizeCluster, addCluster, +2 more
**Members:** 6 | **Avg Similarity:** 0.53 | **Spread:** 1 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| addCluster | function | apps/name-forge/lib/optimizer/index.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.94, semantic:0.76 |
| removeCluster | function | apps/name-forge/lib/optimizer/index.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.94, semantic:0.76 |
| synthesizeCluster | function | apps/name-forge/lib/optimizer/index.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.94, semantic:0.76 |
| addCluster | function | apps/name-forge/lib/optimizer/mutations.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.94, semantic:0.76 |
| removeCluster | function | apps/name-forge/lib/optimizer/mutations.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.94, semantic:0.76 |
| synthesizeCluster | function | apps/name-forge/lib/optimizer/mutations.ts | neighborhood:1.00, typeSignature:1.00, behavior:0.94, semantic:0.76 |

*Pending semantic verification*

### cluster-044: extractCultureIds, buildEventHeadline, downloadBulkAnnotationReviewExport, downloadChronicleExport, +3 more
**Members:** 7 | **Avg Similarity:** 0.37 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| extractCultureIds | function | ...illuminator/webui/src/lib/chronicle/nameBank.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.96, behavior:0.82 |
| buildEventHeadline | function | ...inator/webui/src/lib/chronicleContextBuilder.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.96, behavior:0.82 |
| downloadBulkAnnotationReviewExport | function | apps/illuminator/webui/src/lib/chronicleExport.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.96, behavior:0.82 |
| downloadChronicleExport | function | apps/illuminator/webui/src/lib/chronicleExport.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.96, behavior:0.82 |
| deriveTitleFromRoles | function | ...minator/webui/src/lib/db/chronicleRepository.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.96, behavior:0.82 |
| resetAllBackportFlags | function | ...minator/webui/src/lib/db/chronicleRepository.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.96, behavior:0.82 |
| useChronicleNavItems | hook | ...uminator/webui/src/lib/db/chronicleSelectors.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.96, behavior:0.82 |

*Pending semantic verification*

### cluster-045: default, default, default, default
**Members:** 4 | **Avg Similarity:** 0.39 | **Spread:** 2 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...canonry/webui/src/components/ProjectManager.jsx | callSequence:1.00, neighborhood:1.00, behavior:0.96, typeSignature:0.50 |
| default | function | packages/shared-components/src/TagSelector.jsx | callSequence:1.00, neighborhood:1.00, behavior:0.96, typeSignature:0.50 |
| default | function | ...shared-components/src/components/ChipSelect.jsx | callSequence:1.00, neighborhood:1.00, behavior:0.96, typeSignature:0.50 |
| default | function | ...components/src/components/ReferenceDropdown.jsx | callSequence:1.00, neighborhood:1.00, behavior:0.96, typeSignature:0.50 |

*Pending semantic verification*

### cluster-046: VariablesTab, VariablesTab, VariablesTab, VariablesTab, +1 more
**Members:** 5 | **Avg Similarity:** 0.61 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| VariablesTab | component | ...ui/src/components/actions/tabs/VariablesTab.jsx | behavior:1.00, callSequence:1.00, hookProfile:1.00, jsxStructure:0.99 |
| VariablesTab | component | ...gine/webui/src/components/actions/tabs/index.js | behavior:1.00, callSequence:1.00, hookProfile:1.00, jsxStructure:0.99 |
| VariablesTab | component | ...engine/webui/src/components/generators/index.js | behavior:1.00, callSequence:1.00, hookProfile:1.00, jsxStructure:0.99 |
| VariablesTab | component | ...src/components/generators/tabs/VariablesTab.jsx | behavior:1.00, callSequence:1.00, hookProfile:1.00, jsxStructure:0.99 |
| VariablesTab | component | ...e/webui/src/components/generators/tabs/index.js | behavior:1.00, callSequence:1.00, hookProfile:1.00, jsxStructure:0.99 |

*Pending semantic verification*

### cluster-047: default, default, default, default, +3 more
**Members:** 7 | **Avg Similarity:** 0.43 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | apps/canonry/webui/src/remotes/ArchivistHost.jsx | behavior:1.00, imports:1.00, neighborhood:1.00, semantic:0.75 |
| default | function | apps/canonry/webui/src/remotes/ChroniclerHost.jsx | behavior:1.00, imports:1.00, neighborhood:1.00, semantic:0.75 |
| default | function | ...nonry/webui/src/remotes/CoherenceEngineHost.jsx | behavior:1.00, imports:1.00, neighborhood:1.00, semantic:0.75 |
| default | function | .../canonry/webui/src/remotes/CosmographerHost.jsx | behavior:1.00, imports:1.00, neighborhood:1.00, semantic:0.75 |
| default | function | apps/canonry/webui/src/remotes/IlluminatorHost.jsx | behavior:1.00, imports:1.00, neighborhood:1.00, semantic:0.75 |
| default | function | apps/canonry/webui/src/remotes/LoreWeaveHost.jsx | behavior:1.00, imports:1.00, neighborhood:1.00, semantic:0.75 |
| default | function | apps/canonry/webui/src/remotes/NameForgeHost.jsx | behavior:1.00, imports:1.00, neighborhood:1.00, semantic:0.75 |

*Pending semantic verification*

### cluster-048: getCategory, getCategory, getValidChildren, getCategory, +1 more
**Members:** 5 | **Avg Similarity:** 0.59 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getCategory | function | apps/cosmographer/lib/index.ts | behavior:1.00, callSequence:1.00, neighborhood:1.00, typeSignature:0.85 |
| getCategory | function | apps/cosmographer/lib/ontology/categories.ts | behavior:1.00, callSequence:1.00, neighborhood:1.00, typeSignature:0.85 |
| getValidChildren | function | apps/cosmographer/lib/ontology/categories.ts | behavior:1.00, callSequence:1.00, neighborhood:1.00, typeSignature:0.85 |
| getCategory | function | apps/cosmographer/lib/ontology/index.ts | behavior:1.00, callSequence:1.00, neighborhood:1.00, typeSignature:0.85 |
| getValidChildren | function | apps/cosmographer/lib/ontology/index.ts | behavior:1.00, callSequence:1.00, neighborhood:1.00, typeSignature:0.85 |

*Pending semantic verification*

### cluster-049: normalizedLevenshtein, normalizedLevenshtein, shapeDistance, normalizedLevenshtein, +1 more
**Members:** 5 | **Avg Similarity:** 0.59 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| normalizedLevenshtein | function | apps/name-forge/lib/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, callSequence:0.77 |
| normalizedLevenshtein | function | .../name-forge/lib/validation/analysis/distance.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, callSequence:0.77 |
| shapeDistance | function | .../name-forge/lib/validation/analysis/distance.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, callSequence:0.77 |
| normalizedLevenshtein | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, callSequence:0.77 |
| shapeDistance | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, callSequence:0.77 |

*Pending semantic verification*

### cluster-050: parseCanon, parseCanon, parseCanon, parseCanon
**Members:** 4 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| parseCanon | function | packages/canonry-dsl-v2/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| parseCanon | function | packages/canonry-dsl-v2/src/parser.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| parseCanon | function | packages/canonry-dsl/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| parseCanon | function | packages/canonry-dsl/src/parser.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-051: serializeCanonStaticPages, serializeCanonStaticPages, serializeCanonStaticPages, serializeCanonStaticPages
**Members:** 4 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| serializeCanonStaticPages | function | packages/canonry-dsl-v2/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| serializeCanonStaticPages | function | packages/canonry-dsl-v2/src/serialize.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| serializeCanonStaticPages | function | packages/canonry-dsl/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| serializeCanonStaticPages | function | packages/canonry-dsl/src/serialize.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-052: serializeCanonProject, serializeCanonProject, serializeCanonProject, serializeCanonProject
**Members:** 4 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| serializeCanonProject | function | packages/canonry-dsl-v2/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| serializeCanonProject | function | packages/canonry-dsl-v2/src/serialize.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| serializeCanonProject | function | packages/canonry-dsl/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| serializeCanonProject | function | packages/canonry-dsl/src/serialize.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-053: ConnectionEvolutionTab, GraphContagionTab, TagDiffusionTab, ConnectionEvolutionTab, +2 more
**Members:** 6 | **Avg Similarity:** 0.47 | **Spread:** 1 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ConnectionEvolutionTab | component | ...ponents/systems/tabs/ConnectionEvolutionTab.jsx | callSequence:1.00, typeSignature:1.00, behavior:0.88, semantic:0.50 |
| GraphContagionTab | component | ...c/components/systems/tabs/GraphContagionTab.jsx | callSequence:1.00, typeSignature:1.00, behavior:0.88, semantic:0.50 |
| TagDiffusionTab | component | ...src/components/systems/tabs/TagDiffusionTab.jsx | callSequence:1.00, typeSignature:1.00, behavior:0.88, semantic:0.50 |
| ConnectionEvolutionTab | component | ...gine/webui/src/components/systems/tabs/index.js | callSequence:1.00, typeSignature:1.00, behavior:0.88, semantic:0.50 |
| GraphContagionTab | component | ...gine/webui/src/components/systems/tabs/index.js | callSequence:1.00, typeSignature:1.00, behavior:0.88, semantic:0.50 |
| TagDiffusionTab | component | ...gine/webui/src/components/systems/tabs/index.js | callSequence:1.00, typeSignature:1.00, behavior:0.88, semantic:0.50 |

*Pending semantic verification*

### cluster-054: findEntities, findEntities, getCatalyzedEvents, getCatalyzedEvents, +1 more
**Members:** 5 | **Avg Similarity:** 0.55 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| findEntities | function | apps/lore-weave/lib/graph/entityQueries.ts | behavior:1.00, typeSignature:0.94, calleeSet:0.93, callSequence:0.86 |
| findEntities | function | apps/lore-weave/lib/index.ts | behavior:1.00, typeSignature:0.94, calleeSet:0.93, callSequence:0.86 |
| getCatalyzedEvents | function | apps/lore-weave/lib/index.ts | behavior:1.00, typeSignature:0.94, calleeSet:0.93, callSequence:0.86 |
| getCatalyzedEvents | function | apps/lore-weave/lib/systems/catalystHelpers.ts | behavior:1.00, typeSignature:0.94, calleeSet:0.93, callSequence:0.86 |
| findEntities | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, typeSignature:0.94, calleeSet:0.93, callSequence:0.86 |

*Pending semantic verification*

### cluster-055: countApostrophes, countHyphens, countApostrophes, countHyphens
**Members:** 4 | **Avg Similarity:** 0.69 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| countApostrophes | function | .../name-forge/lib/validation/analysis/features.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| countHyphens | function | .../name-forge/lib/validation/analysis/features.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| countApostrophes | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| countHyphens | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-056: ValidationEditor, ErasEditor, ValidationEditor, ValidationEditor, +1 more
**Members:** 5 | **Avg Similarity:** 0.54 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ValidationEditor | component | ...ngine/webui/src/components/ValidationEditor.jsx | behavior:0.93, typeSignature:0.82, hookProfile:0.80, callSequence:0.69 |
| ErasEditor | component | ...rence-engine/webui/src/components/eras/index.js | behavior:0.93, typeSignature:0.82, hookProfile:0.80, callSequence:0.69 |
| ValidationEditor | component | .../src/components/validation/ValidationEditor.jsx | behavior:0.93, typeSignature:0.82, hookProfile:0.80, callSequence:0.69 |
| ValidationEditor | component | ...engine/webui/src/components/validation/index.js | behavior:0.93, typeSignature:0.82, hookProfile:0.80, callSequence:0.69 |
| WeightMatrixEditor | component | ...ine/webui/src/components/weight-matrix/index.js | behavior:0.93, typeSignature:0.82, hookProfile:0.80, callSequence:0.69 |

*Pending semantic verification*

### cluster-057: comparative, superlative, comparative, superlative
**Members:** 4 | **Avg Similarity:** 0.68 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| comparative | function | apps/name-forge/lib/derivation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| superlative | function | apps/name-forge/lib/derivation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| comparative | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| superlative | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-058: pickRandom, pickRandom, shuffle, pickRandom, +1 more
**Members:** 5 | **Avg Similarity:** 0.54 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| pickRandom | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:0.85 |
| pickRandom | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:0.85 |
| shuffle | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:0.85 |
| pickRandom | function | apps/lore-weave/lib/utils/randomUtils.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:0.85 |
| shuffle | function | apps/lore-weave/lib/utils/randomUtils.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:0.85 |

*Pending semantic verification*

### cluster-059: compileCanonProject, compileCanonProject, compileCanonProject, compileCanonProject
**Members:** 4 | **Avg Similarity:** 0.67 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| compileCanonProject | function | packages/canonry-dsl-v2/src/compile.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:1.00 |
| compileCanonProject | function | packages/canonry-dsl-v2/src/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:1.00 |
| compileCanonProject | function | packages/canonry-dsl/src/compile.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:1.00 |
| compileCanonProject | function | packages/canonry-dsl/src/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:1.00 |

*Pending semantic verification*

### cluster-060: compileCanonStaticPages, compileCanonStaticPages, compileCanonStaticPages, compileCanonStaticPages
**Members:** 4 | **Avg Similarity:** 0.67 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| compileCanonStaticPages | function | packages/canonry-dsl-v2/src/compile.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.99 |
| compileCanonStaticPages | function | packages/canonry-dsl-v2/src/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.99 |
| compileCanonStaticPages | function | packages/canonry-dsl/src/compile.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.99 |
| compileCanonStaticPages | function | packages/canonry-dsl/src/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.99 |

*Pending semantic verification*

### cluster-061: createPartOfRelationships, recordRelationshipFormation, createPartOfRelationships, recordRelationshipFormation, +1 more
**Members:** 5 | **Avg Similarity:** 0.52 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createPartOfRelationships | function | apps/lore-weave/lib/graph/entityArchival.ts | behavior:1.00, typeSignature:0.88, callSequence:0.86, calleeSet:0.80 |
| recordRelationshipFormation | function | apps/lore-weave/lib/graph/relationshipMutation.ts | behavior:1.00, typeSignature:0.88, callSequence:0.86, calleeSet:0.80 |
| createPartOfRelationships | function | apps/lore-weave/lib/index.ts | behavior:1.00, typeSignature:0.88, callSequence:0.86, calleeSet:0.80 |
| recordRelationshipFormation | function | apps/lore-weave/lib/index.ts | behavior:1.00, typeSignature:0.88, callSequence:0.86, calleeSet:0.80 |
| recordRelationshipFormation | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, typeSignature:0.88, callSequence:0.86, calleeSet:0.80 |

*Pending semantic verification*

### cluster-062: PathStepEditor, PathStepEditor, PathStepEditor, ClusterFormationTab, +1 more
**Members:** 5 | **Avg Similarity:** 0.52 | **Spread:** 1 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| PathStepEditor | component | ...omponents/generators/filters/PathStepEditor.jsx | callSequence:1.00, behavior:0.95, typeSignature:0.87, calleeSet:0.81 |
| PathStepEditor | component | ...ebui/src/components/generators/filters/index.js | callSequence:1.00, behavior:0.95, typeSignature:0.87, calleeSet:0.81 |
| PathStepEditor | component | ...engine/webui/src/components/generators/index.js | callSequence:1.00, behavior:0.95, typeSignature:0.87, calleeSet:0.81 |
| ClusterFormationTab | component | ...components/systems/tabs/ClusterFormationTab.jsx | callSequence:1.00, behavior:0.95, typeSignature:0.87, calleeSet:0.81 |
| ClusterFormationTab | component | ...gine/webui/src/components/systems/tabs/index.js | callSequence:1.00, behavior:0.95, typeSignature:0.87, calleeSet:0.81 |

*Pending semantic verification*

### cluster-063: ActionModal, ActionModal, GeneratorModal, GeneratorModal, +1 more
**Members:** 5 | **Avg Similarity:** 0.52 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ActionModal | component | ...i/src/components/actions/modals/ActionModal.jsx | behavior:1.00, callSequence:1.00, jsxStructure:0.94, hookProfile:0.74 |
| ActionModal | component | ...ne/webui/src/components/actions/modals/index.js | behavior:1.00, callSequence:1.00, jsxStructure:0.94, hookProfile:0.74 |
| GeneratorModal | component | ...ui/src/components/generators/GeneratorModal.jsx | behavior:1.00, callSequence:1.00, jsxStructure:0.94, hookProfile:0.74 |
| GeneratorModal | component | ...engine/webui/src/components/generators/index.js | behavior:1.00, callSequence:1.00, jsxStructure:0.94, hookProfile:0.74 |
| SystemModal | component | ...ne/webui/src/components/systems/SystemModal.jsx | behavior:1.00, callSequence:1.00, jsxStructure:0.94, hookProfile:0.74 |

*Pending semantic verification*

### cluster-064: buildStorageImageUrl, exportIndexedDbToS3, importIndexedDbFromS3, saveRunSlot, +2 more
**Members:** 6 | **Avg Similarity:** 0.43 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| buildStorageImageUrl | function | apps/canonry/webui/src/aws/awsS3.js | consumerSet:0.89, neighborhood:0.89, behavior:0.86, coOccurrence:0.84 |
| exportIndexedDbToS3 | function | apps/canonry/webui/src/aws/indexedDbSnapshot.js | consumerSet:0.89, neighborhood:0.89, behavior:0.86, coOccurrence:0.84 |
| importIndexedDbFromS3 | function | apps/canonry/webui/src/aws/indexedDbSnapshot.js | consumerSet:0.89, neighborhood:0.89, behavior:0.86, coOccurrence:0.84 |
| saveRunSlot | function | apps/canonry/webui/src/storage/runStore.js | consumerSet:0.89, neighborhood:0.89, behavior:0.86, coOccurrence:0.84 |
| saveSlot | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.89, neighborhood:0.89, behavior:0.86, coOccurrence:0.84 |
| updateSlotTitle | function | apps/canonry/webui/src/storage/worldStore.js | consumerSet:0.89, neighborhood:0.89, behavior:0.86, coOccurrence:0.84 |

*Pending semantic verification*

### cluster-065: default, default, default, default, +1 more
**Members:** 5 | **Avg Similarity:** 0.51 | **Spread:** 1 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...ator/webui/src/components/BulkBackportModal.jsx | neighborhood:1.00, behavior:0.97, typeSignature:0.93, imports:0.66 |
| default | function | ...src/components/BulkChronicleAnnotationModal.jsx | neighborhood:1.00, behavior:0.97, typeSignature:0.93, imports:0.66 |
| default | function | .../webui/src/components/BulkFactCoverageModal.jsx | neighborhood:1.00, behavior:0.97, typeSignature:0.93, imports:0.66 |
| default | function | ...tor/webui/src/components/BulkHistorianModal.jsx | neighborhood:1.00, behavior:0.97, typeSignature:0.93, imports:0.66 |
| default | function | ...r/webui/src/components/BulkToneRankingModal.jsx | neighborhood:1.00, behavior:0.97, typeSignature:0.93, imports:0.66 |

*Pending semantic verification*

### cluster-066: deleteDynamicsRun, deleteEraNarrative, deleteHistorianRun, deleteRunIndexes, +2 more
**Members:** 6 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| deleteDynamicsRun | function | ...uminator/webui/src/lib/db/dynamicsRepository.ts | behavior:1.00, typeSignature:1.00, semantic:0.75, callSequence:0.30 |
| deleteEraNarrative | function | ...ator/webui/src/lib/db/eraNarrativeRepository.ts | behavior:1.00, typeSignature:1.00, semantic:0.75, callSequence:0.30 |
| deleteHistorianRun | function | ...minator/webui/src/lib/db/historianRepository.ts | behavior:1.00, typeSignature:1.00, semantic:0.75, callSequence:0.30 |
| deleteRunIndexes | function | ...illuminator/webui/src/lib/db/indexRepository.ts | behavior:1.00, typeSignature:1.00, semantic:0.75, callSequence:0.30 |
| deleteStaticPage | function | ...inator/webui/src/lib/db/staticPageRepository.ts | behavior:1.00, typeSignature:1.00, semantic:0.75, callSequence:0.30 |
| deleteRevisionRun | function | ...r/webui/src/lib/db/summaryRevisionRepository.ts | behavior:1.00, typeSignature:1.00, semantic:0.75, callSequence:0.30 |

*Pending semantic verification*

### cluster-067: getEntityKindUsageSummary, getEntityKindUsageSummary, getEntityKindUsageSummary
**Members:** 3 | **Avg Similarity:** 0.41 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getEntityKindUsageSummary | function | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.74 |
| getEntityKindUsageSummary | function | packages/shared-components/src/index.js | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.74 |
| getEntityKindUsageSummary | function | ...s/shared-components/src/utils/schemaUsageMap.js | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.74 |

*Pending semantic verification*

### cluster-068: hasRelationship, findRelationship, hasRelationship, hasRelationship
**Members:** 4 | **Avg Similarity:** 0.61 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| hasRelationship | function | apps/lore-weave/lib/graph/entityQueries.ts | behavior:1.00, neighborhood:1.00, typeSignature:0.93, calleeSet:0.84 |
| findRelationship | function | apps/lore-weave/lib/graph/graphQueries.ts | behavior:1.00, neighborhood:1.00, typeSignature:0.93, calleeSet:0.84 |
| hasRelationship | function | apps/lore-weave/lib/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:0.93, calleeSet:0.84 |
| hasRelationship | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:0.93, calleeSet:0.84 |

*Pending semantic verification*

### cluster-069: getActiveRelationships, getHistoricalRelationships, countRelationships, getActiveRelationships, +1 more
**Members:** 5 | **Avg Similarity:** 0.49 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getActiveRelationships | function | apps/lore-weave/lib/graph/entityArchival.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getHistoricalRelationships | function | apps/lore-weave/lib/graph/entityArchival.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| countRelationships | function | apps/lore-weave/lib/graph/graphQueries.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getActiveRelationships | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getHistoricalRelationships | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-070: getRelationshipKindUsageSummary, getRelationshipKindUsageSummary, getRelationshipKindUsageSummary
**Members:** 3 | **Avg Similarity:** 0.40 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getRelationshipKindUsageSummary | function | ...name-forge/webui/src/components/shared/index.js | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.71 |
| getRelationshipKindUsageSummary | function | packages/shared-components/src/index.js | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.71 |
| getRelationshipKindUsageSummary | function | ...s/shared-components/src/utils/schemaUsageMap.js | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.71 |

*Pending semantic verification*

### cluster-071: getVocabularyStats, hasEmbeddings, getVocabularyStats, hasEmbeddings
**Members:** 4 | **Avg Similarity:** 0.60 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getVocabularyStats | function | apps/cosmographer/lib/embeddings/loader.ts | behavior:1.00, callSequence:1.00, neighborhood:1.00, calleeSet:0.93 |
| hasEmbeddings | function | apps/cosmographer/lib/embeddings/loader.ts | behavior:1.00, callSequence:1.00, neighborhood:1.00, calleeSet:0.93 |
| getVocabularyStats | function | apps/cosmographer/lib/index.ts | behavior:1.00, callSequence:1.00, neighborhood:1.00, calleeSet:0.93 |
| hasEmbeddings | function | apps/cosmographer/lib/index.ts | behavior:1.00, callSequence:1.00, neighborhood:1.00, calleeSet:0.93 |

*Pending semantic verification*

### cluster-072: FactorCard, FactorCard, FactorEditorModal, FactorEditorModal
**Members:** 4 | **Avg Similarity:** 0.59 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| FactorCard | component | ...i/src/components/pressures/cards/FactorCard.jsx | behavior:0.92, typeSignature:0.90, semantic:0.75, jsxStructure:0.74 |
| FactorCard | component | ...e/webui/src/components/pressures/cards/index.js | behavior:0.92, typeSignature:0.90, semantic:0.75, jsxStructure:0.74 |
| FactorEditorModal | component | ...mponents/pressures/modals/FactorEditorModal.jsx | behavior:0.92, typeSignature:0.90, semantic:0.75, jsxStructure:0.74 |
| FactorEditorModal | component | .../webui/src/components/pressures/modals/index.js | behavior:0.92, typeSignature:0.90, semantic:0.75, jsxStructure:0.74 |

*Pending semantic verification*

### cluster-073: default, default, default
**Members:** 3 | **Avg Similarity:** 0.39 | **Spread:** 2 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...nator/webui/src/components/StaticPageEditor.jsx | neighborhood:1.00, typeSignature:0.70, behavior:0.69, callSequence:0.62 |
| default | function | ...i/src/components/workspace/tabs/GrammarsTab.jsx | neighborhood:1.00, typeSignature:0.70, behavior:0.69, callSequence:0.62 |
| default | function | ...ui/src/components/workspace/tabs/LexemesTab.jsx | neighborhood:1.00, typeSignature:0.70, behavior:0.69, callSequence:0.62 |

*Pending semantic verification*

### cluster-074: ContractEnforcer, StateChangeTracker, MutationTracker, StateChangeTracker, +2 more
**Members:** 6 | **Avg Similarity:** 0.39 | **Spread:** 1 directories
**Dominant Signal:** typeSignature

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ContractEnforcer | class | apps/lore-weave/lib/engine/contractEnforcer.ts | typeSignature:1.00, behavior:0.84, consumerSet:0.82, coOccurrence:0.74 |
| StateChangeTracker | class | apps/lore-weave/lib/narrative/index.ts | typeSignature:1.00, behavior:0.84, consumerSet:0.82, coOccurrence:0.74 |
| MutationTracker | class | apps/lore-weave/lib/narrative/mutationTracker.ts | typeSignature:1.00, behavior:0.84, consumerSet:0.82, coOccurrence:0.74 |
| StateChangeTracker | class | .../lore-weave/lib/narrative/stateChangeTracker.ts | typeSignature:1.00, behavior:0.84, consumerSet:0.82, coOccurrence:0.74 |
| PopulationTracker | class | .../lore-weave/lib/statistics/populationTracker.ts | typeSignature:1.00, behavior:0.84, consumerSet:0.82, coOccurrence:0.74 |
| StatisticsCollector | class | ...ore-weave/lib/statistics/statisticsCollector.ts | typeSignature:1.00, behavior:0.84, consumerSet:0.82, coOccurrence:0.74 |

*Pending semantic verification*

### cluster-075: ApplicabilityTab, ApplicabilityTab, ApplicabilityTab, ApplicabilityTab
**Members:** 4 | **Avg Similarity:** 0.58 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ApplicabilityTab | component | ...s/generators/applicability/ApplicabilityTab.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| ApplicabilityTab | component | ...rc/components/generators/applicability/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| ApplicabilityTab | component | ...engine/webui/src/components/generators/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| ApplicabilityTab | component | ...e/webui/src/components/generators/tabs/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

*Pending semantic verification*

### cluster-076: prominenceIndexFromScale, prominenceThresholdFromScale, prominenceIndexFromScale, prominenceThresholdFromScale
**Members:** 4 | **Avg Similarity:** 0.58 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| prominenceIndexFromScale | function | packages/world-schema/src/index.ts | behavior:1.00, neighborhood:1.00, calleeSet:0.87, typeSignature:0.85 |
| prominenceThresholdFromScale | function | packages/world-schema/src/index.ts | behavior:1.00, neighborhood:1.00, calleeSet:0.87, typeSignature:0.85 |
| prominenceIndexFromScale | function | packages/world-schema/src/prominenceScale.ts | behavior:1.00, neighborhood:1.00, calleeSet:0.87, typeSignature:0.85 |
| prominenceThresholdFromScale | function | packages/world-schema/src/prominenceScale.ts | behavior:1.00, neighborhood:1.00, calleeSet:0.87, typeSignature:0.85 |

*Pending semantic verification*

### cluster-077: default, default, default, default, +1 more
**Members:** 5 | **Avg Similarity:** 0.45 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...shared-components/src/components/EmptyState.jsx | behavior:1.00, callSequence:1.00, imports:1.00, neighborhood:1.00 |
| default | function | ...ared-components/src/components/EnableToggle.jsx | behavior:1.00, callSequence:1.00, imports:1.00, neighborhood:1.00 |
| default | function | ...ed-components/src/components/ExpandableCard.jsx | behavior:1.00, callSequence:1.00, imports:1.00, neighborhood:1.00 |
| default | function | .../shared-components/src/components/FormGroup.jsx | behavior:1.00, callSequence:1.00, imports:1.00, neighborhood:1.00 |
| default | function | ...es/shared-components/src/components/InfoBox.jsx | behavior:1.00, callSequence:1.00, imports:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-078: capitalizeWords, mixedCase, capitalizeWords, mixedCase
**Members:** 4 | **Avg Similarity:** 0.56 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| capitalizeWords | function | apps/name-forge/lib/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.81 |
| mixedCase | function | apps/name-forge/lib/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.81 |
| capitalizeWords | function | apps/name-forge/lib/utils/helpers.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.81 |
| mixedCase | function | apps/name-forge/lib/utils/helpers.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.81 |

*Pending semantic verification*

### cluster-079: default, default, default
**Members:** 3 | **Avg Similarity:** 0.37 | **Spread:** 2 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | apps/canonry/webui/src/components/SlotSelector.jsx | callSequence:1.00, neighborhood:1.00, behavior:0.92, typeSignature:0.70 |
| default | function | .../webui/src/components/HistorianToneSelector.jsx | callSequence:1.00, neighborhood:1.00, behavior:0.92, typeSignature:0.70 |
| default | function | ...ponents/chronicle-workspace/WorkspaceHeader.jsx | callSequence:1.00, neighborhood:1.00, behavior:0.92, typeSignature:0.70 |

*Pending semantic verification*

### cluster-080: useChronicleLoreBackport, useDynamicsGeneration, useHistorianEdition, useHistorianReview, +1 more
**Members:** 5 | **Avg Similarity:** 0.45 | **Spread:** 1 directories
**Dominant Signal:** hookProfile

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| useChronicleLoreBackport | hook | ...tor/webui/src/hooks/useChronicleLoreBackport.ts | hookProfile:1.00, behavior:0.95, calleeSet:0.74, coOccurrence:0.61 |
| useDynamicsGeneration | hook | ...inator/webui/src/hooks/useDynamicsGeneration.ts | hookProfile:1.00, behavior:0.95, calleeSet:0.74, coOccurrence:0.61 |
| useHistorianEdition | hook | ...uminator/webui/src/hooks/useHistorianEdition.ts | hookProfile:1.00, behavior:0.95, calleeSet:0.74, coOccurrence:0.61 |
| useHistorianReview | hook | ...luminator/webui/src/hooks/useHistorianReview.ts | hookProfile:1.00, behavior:0.95, calleeSet:0.74, coOccurrence:0.61 |
| useSummaryRevision | hook | ...luminator/webui/src/hooks/useSummaryRevision.ts | hookProfile:1.00, behavior:0.95, calleeSet:0.74, coOccurrence:0.61 |

*Pending semantic verification*

### cluster-081: ConditionsSection, EffectsSection, ConditionsSection, EffectsSection
**Members:** 4 | **Avg Similarity:** 0.56 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ConditionsSection | component | .../components/eras/sections/ConditionsSection.jsx | behavior:1.00, neighborhood:1.00, semantic:0.85, jsxStructure:0.84 |
| EffectsSection | component | ...src/components/eras/sections/EffectsSection.jsx | behavior:1.00, neighborhood:1.00, semantic:0.85, jsxStructure:0.84 |
| ConditionsSection | component | ...ine/webui/src/components/eras/sections/index.js | behavior:1.00, neighborhood:1.00, semantic:0.85, jsxStructure:0.84 |
| EffectsSection | component | ...ine/webui/src/components/eras/sections/index.js | behavior:1.00, neighborhood:1.00, semantic:0.85, jsxStructure:0.84 |

*Pending semantic verification*

### cluster-082: generateWord, generateWordWithDebug, generateWord, generateWordWithDebug
**Members:** 4 | **Avg Similarity:** 0.56 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generateWord | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, neighborhood:1.00, calleeSet:0.93 |
| generateWordWithDebug | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, neighborhood:1.00, calleeSet:0.93 |
| generateWord | function | apps/name-forge/lib/phonology.ts | behavior:1.00, callSequence:1.00, neighborhood:1.00, calleeSet:0.93 |
| generateWordWithDebug | function | apps/name-forge/lib/phonology.ts | behavior:1.00, callSequence:1.00, neighborhood:1.00, calleeSet:0.93 |

*Pending semantic verification*

### cluster-083: pickRandom, pickRandom, randomInt, shuffle
**Members:** 4 | **Avg Similarity:** 0.55 | **Spread:** 1 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| pickRandom | function | apps/name-forge/lib/index.ts | callSequence:1.00, calleeSet:1.00, neighborhood:1.00, behavior:0.92 |
| pickRandom | function | apps/name-forge/lib/utils/rng.ts | callSequence:1.00, calleeSet:1.00, neighborhood:1.00, behavior:0.92 |
| randomInt | function | apps/name-forge/lib/utils/rng.ts | callSequence:1.00, calleeSet:1.00, neighborhood:1.00, behavior:0.92 |
| shuffle | function | apps/name-forge/lib/utils/rng.ts | callSequence:1.00, calleeSet:1.00, neighborhood:1.00, behavior:0.92 |

*Pending semantic verification*

### cluster-084: isExcludedPair, isExcludedPair, isExcludedPair
**Members:** 3 | **Avg Similarity:** 0.73 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| isExcludedPair | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| isExcludedPair | function | packages/world-schema/src/style.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| isExcludedPair | function | packages/world-schema/src/styleExclusions.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-085: filterStylesForComposition, filterStylesForComposition, filterStylesForComposition
**Members:** 3 | **Avg Similarity:** 0.73 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| filterStylesForComposition | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| filterStylesForComposition | function | packages/world-schema/src/style.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| filterStylesForComposition | function | packages/world-schema/src/styleExclusions.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-086: filterCompositionsForStyle, filterCompositionsForStyle, filterCompositionsForStyle
**Members:** 3 | **Avg Similarity:** 0.73 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| filterCompositionsForStyle | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| filterCompositionsForStyle | function | packages/world-schema/src/style.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| filterCompositionsForStyle | function | packages/world-schema/src/styleExclusions.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-087: applyTagPatch, buildTagPatch, applyTagPatch, buildTagPatch
**Members:** 4 | **Avg Similarity:** 0.55 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyTagPatch | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, typeSignature:0.90, calleeSet:0.89, semantic:0.78 |
| buildTagPatch | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, typeSignature:0.90, calleeSet:0.89, semantic:0.78 |
| applyTagPatch | function | apps/lore-weave/lib/rules/mutations/index.ts | behavior:1.00, typeSignature:0.90, calleeSet:0.89, semantic:0.78 |
| buildTagPatch | function | apps/lore-weave/lib/rules/mutations/index.ts | behavior:1.00, typeSignature:0.90, calleeSet:0.89, semantic:0.78 |

*Pending semantic verification*

### cluster-088: analyzePhonemeImportance, analyzePhonemeImportance, analyzePhonemeImportance
**Members:** 3 | **Avg Similarity:** 0.73 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| analyzePhonemeImportance | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| analyzePhonemeImportance | function | apps/name-forge/lib/optimizer/bayesian.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| analyzePhonemeImportance | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-089: buildCopyEditUserPrompt, buildV2Prompt, buildV2Prompt, updateChronicleComparisonReport, +1 more
**Members:** 5 | **Avg Similarity:** 0.44 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| buildCopyEditUserPrompt | function | ...or/webui/src/lib/chronicle/v2/copyEditPrompt.ts | behavior:0.93, consumerSet:0.86, neighborhood:0.86, coOccurrence:0.84 |
| buildV2Prompt | function | ...illuminator/webui/src/lib/chronicle/v2/index.ts | behavior:0.93, consumerSet:0.86, neighborhood:0.86, coOccurrence:0.84 |
| buildV2Prompt | function | ...tor/webui/src/lib/chronicle/v2/promptBuilder.ts | behavior:0.93, consumerSet:0.86, neighborhood:0.86, coOccurrence:0.84 |
| updateChronicleComparisonReport | function | ...minator/webui/src/lib/db/chronicleRepository.ts | behavior:0.93, consumerSet:0.86, neighborhood:0.86, coOccurrence:0.84 |
| synthesizePerspective | function | ...minator/webui/src/lib/perspectiveSynthesizer.ts | behavior:0.93, consumerSet:0.86, neighborhood:0.86, coOccurrence:0.84 |

*Pending semantic verification*

### cluster-090: computeFitness, computeFitness, computeFitness
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| computeFitness | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| computeFitness | function | apps/name-forge/lib/optimizer/fitness.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| computeFitness | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-091: computeFitnessLight, computeFitnessLight, computeFitnessLight
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| computeFitnessLight | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| computeFitnessLight | function | apps/name-forge/lib/optimizer/fitness.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| computeFitnessLight | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-092: hillclimb, hillclimb, hillclimb
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| hillclimb | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| hillclimb | function | apps/name-forge/lib/optimizer/hillclimb.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| hillclimb | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-093: applyMultipleMutations, applyMultipleMutations, applyMultipleMutations
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyMultipleMutations | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| applyMultipleMutations | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| applyMultipleMutations | function | apps/name-forge/lib/optimizer/mutations.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-094: applyWeightedMutation, applyWeightedMutation, applyWeightedMutation
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyWeightedMutation | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| applyWeightedMutation | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| applyWeightedMutation | function | apps/name-forge/lib/optimizer/mutations.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-095: evaluatePressureGrowthWithBreakdown, createSystemFromDeclarative, createTemplateFromDeclarative, createSystemFromDeclarative, +1 more
**Members:** 5 | **Avg Similarity:** 0.43 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| evaluatePressureGrowthWithBreakdown | function | apps/lore-weave/lib/engine/pressureInterpreter.ts | behavior:1.00, typeSignature:0.70, consumerSet:0.60, neighborhood:0.60 |
| createSystemFromDeclarative | function | apps/lore-weave/lib/engine/systemInterpreter.ts | behavior:1.00, typeSignature:0.70, consumerSet:0.60, neighborhood:0.60 |
| createTemplateFromDeclarative | function | apps/lore-weave/lib/engine/templateInterpreter.ts | behavior:1.00, typeSignature:0.70, consumerSet:0.60, neighborhood:0.60 |
| createSystemFromDeclarative | function | apps/lore-weave/lib/index.ts | behavior:1.00, typeSignature:0.70, consumerSet:0.60, neighborhood:0.60 |
| createTemplateFromDeclarative | function | apps/lore-weave/lib/index.ts | behavior:1.00, typeSignature:0.70, consumerSet:0.60, neighborhood:0.60 |

*Pending semantic verification*

### cluster-096: getCategoriesForDomain, getCategoriesForDomain, getCategoriesForDomain
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getCategoriesForDomain | function | apps/cosmographer/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getCategoriesForDomain | function | apps/cosmographer/lib/ontology/categories.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getCategoriesForDomain | function | apps/cosmographer/lib/ontology/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-097: getAllCategoryIds, getAllCategoryIds, getAllCategoryIds
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getAllCategoryIds | function | apps/cosmographer/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getAllCategoryIds | function | apps/cosmographer/lib/ontology/categories.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getAllCategoryIds | function | apps/cosmographer/lib/ontology/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-098: registerCustomCategory, registerCustomCategory, registerCustomCategory
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| registerCustomCategory | function | apps/cosmographer/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| registerCustomCategory | function | apps/cosmographer/lib/ontology/categories.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| registerCustomCategory | function | apps/cosmographer/lib/ontology/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-099: classifyPlane, classifyPlane, classifyPlane
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| classifyPlane | function | apps/cosmographer/lib/analysis/classifier.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| classifyPlane | function | apps/cosmographer/lib/analysis/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| classifyPlane | function | apps/cosmographer/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-100: classifyPlanes, classifyPlanes, classifyPlanes
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| classifyPlanes | function | apps/cosmographer/lib/analysis/classifier.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| classifyPlanes | function | apps/cosmographer/lib/analysis/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| classifyPlanes | function | apps/cosmographer/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-101: getMatchedKeywords, getMatchedKeywords, getMatchedKeywords
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getMatchedKeywords | function | apps/cosmographer/lib/analysis/classifier.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getMatchedKeywords | function | apps/cosmographer/lib/analysis/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getMatchedKeywords | function | apps/cosmographer/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-102: generateHierarchy, generateHierarchy, generateHierarchy
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generateHierarchy | function | apps/cosmographer/lib/generator/hierarchy.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| generateHierarchy | function | apps/cosmographer/lib/generator/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| generateHierarchy | function | apps/cosmographer/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-103: generateDistances, generateDistances, generateDistances
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generateDistances | function | apps/cosmographer/lib/generator/hierarchy.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| generateDistances | function | apps/cosmographer/lib/generator/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| generateDistances | function | apps/cosmographer/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-104: getStringTags, getStringTags, getStringTags
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getStringTags | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getStringTags | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getStringTags | function | apps/lore-weave/lib/utils/tagUtils.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-105: cosineSimilarity, cosineSimilarity, cosineSimilarity
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| cosineSimilarity | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| cosineSimilarity | function | .../name-forge/lib/validation/analysis/distance.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| cosineSimilarity | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-106: encodeParameters, encodeParameters, encodeParameters
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| encodeParameters | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| encodeParameters | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| encodeParameters | function | apps/name-forge/lib/parameter-encoder.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-107: decodeParameters, decodeParameters, decodeParameters
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| decodeParameters | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| decodeParameters | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| decodeParameters | function | apps/name-forge/lib/parameter-encoder.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-108: perturbParameters, perturbParameters, perturbParameters
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| perturbParameters | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| perturbParameters | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| perturbParameters | function | apps/name-forge/lib/parameter-encoder.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-109: parameterDistance, parameterDistance, parameterDistance
**Members:** 3 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| parameterDistance | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| parameterDistance | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| parameterDistance | function | apps/name-forge/lib/parameter-encoder.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-110: CoordinateContext, CoordinateContext, TargetSelector, TargetSelector, +1 more
**Members:** 5 | **Avg Similarity:** 0.43 | **Spread:** 1 directories
**Dominant Signal:** typeSignature

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| CoordinateContext | class | ...lore-weave/lib/coordinates/coordinateContext.ts | typeSignature:1.00, behavior:0.97, semantic:0.81, neighborhood:0.40 |
| CoordinateContext | class | apps/lore-weave/lib/index.ts | typeSignature:1.00, behavior:0.97, semantic:0.81, neighborhood:0.40 |
| TargetSelector | class | apps/lore-weave/lib/index.ts | typeSignature:1.00, behavior:0.97, semantic:0.81, neighborhood:0.40 |
| TargetSelector | class | apps/lore-weave/lib/selection/index.ts | typeSignature:1.00, behavior:0.97, semantic:0.81, neighborhood:0.40 |
| TargetSelector | class | apps/lore-weave/lib/selection/targetSelector.ts | typeSignature:1.00, behavior:0.97, semantic:0.81, neighborhood:0.40 |

*Pending semantic verification*

### cluster-111: simulatedAnnealing, simulatedAnnealing, simulatedAnnealing
**Members:** 3 | **Avg Similarity:** 0.71 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| simulatedAnnealing | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| simulatedAnnealing | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| simulatedAnnealing | function | apps/name-forge/lib/optimizer/sim-anneal.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-112: levenshtein, levenshtein, levenshtein
**Members:** 3 | **Avg Similarity:** 0.71 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| levenshtein | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| levenshtein | function | .../name-forge/lib/validation/analysis/distance.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| levenshtein | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-113: geneticAlgorithm, geneticAlgorithm, geneticAlgorithm
**Members:** 3 | **Avg Similarity:** 0.71 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| geneticAlgorithm | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| geneticAlgorithm | function | apps/name-forge/lib/optimizer/genetic.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| geneticAlgorithm | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-114: bayesianOptimization, bayesianOptimization, bayesianOptimization
**Members:** 3 | **Avg Similarity:** 0.71 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| bayesianOptimization | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| bayesianOptimization | function | apps/name-forge/lib/optimizer/bayesian.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| bayesianOptimization | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-115: euclideanDistance, euclideanDistance, euclideanDistance
**Members:** 3 | **Avg Similarity:** 0.70 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| euclideanDistance | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| euclideanDistance | function | .../name-forge/lib/validation/analysis/distance.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| euclideanDistance | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-116: createPressureYScale, createXScale, createPressureYScale, createXScale
**Members:** 4 | **Avg Similarity:** 0.52 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createPressureYScale | function | ...e/webui/src/components/dashboard/trace/index.js | behavior:1.00, semantic:0.97, calleeSet:0.92, callSequence:0.57 |
| createXScale | function | ...e/webui/src/components/dashboard/trace/index.js | behavior:1.00, semantic:0.97, calleeSet:0.92, callSequence:0.57 |
| createPressureYScale | function | .../webui/src/components/dashboard/trace/scales.js | behavior:1.00, semantic:0.97, calleeSet:0.92, callSequence:0.57 |
| createXScale | function | .../webui/src/components/dashboard/trace/scales.js | behavior:1.00, semantic:0.97, calleeSet:0.92, callSequence:0.57 |

*Pending semantic verification*

### cluster-117: describeMetric, describeSelectionFilter, describeMetric, describeSelectionFilter
**Members:** 4 | **Avg Similarity:** 0.51 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| describeMetric | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, semantic:0.85, typeSignature:0.85, callSequence:0.57 |
| describeSelectionFilter | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, semantic:0.85, typeSignature:0.85, callSequence:0.57 |
| describeMetric | function | apps/lore-weave/lib/rules/metrics/index.ts | behavior:1.00, semantic:0.85, typeSignature:0.85, callSequence:0.57 |
| describeSelectionFilter | function | apps/lore-weave/lib/rules/selection/index.ts | behavior:1.00, semantic:0.85, typeSignature:0.85, callSequence:0.57 |

*Pending semantic verification*

### cluster-118: crossValidate, crossValidate, crossValidate
**Members:** 3 | **Avg Similarity:** 0.68 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| crossValidate | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| crossValidate | function | ...ame-forge/lib/validation/analysis/classifier.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| crossValidate | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-119: normalizeInitialState, normalizeInitialState, normalizeInitialState
**Members:** 3 | **Avg Similarity:** 0.68 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| normalizeInitialState | function | apps/lore-weave/lib/graph/entityMutation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| normalizeInitialState | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| normalizeInitialState | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-120: getSystemModifier, getTemplateWeight, updateEntity, checkTransitionConditions, +1 more
**Members:** 5 | **Avg Similarity:** 0.40 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getSystemModifier | function | apps/lore-weave/lib/engine/eraUtils.ts | behavior:0.91, consumerSet:0.75, neighborhood:0.75, coOccurrence:0.72 |
| getTemplateWeight | function | apps/lore-weave/lib/engine/eraUtils.ts | behavior:0.91, consumerSet:0.75, neighborhood:0.75, coOccurrence:0.72 |
| updateEntity | function | apps/lore-weave/lib/graph/entityMutation.ts | behavior:0.91, consumerSet:0.75, neighborhood:0.75, coOccurrence:0.72 |
| checkTransitionConditions | function | apps/lore-weave/lib/systems/eraTransition.ts | behavior:0.91, consumerSet:0.75, neighborhood:0.75, coOccurrence:0.72 |
| updateEntity | function | apps/lore-weave/lib/utils/index.ts | behavior:0.91, consumerSet:0.75, neighborhood:0.75, coOccurrence:0.72 |

*Pending semantic verification*

### cluster-121: getTrueTagKeys, getTrueTagKeys, getTrueTagKeys
**Members:** 3 | **Avg Similarity:** 0.67 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getTrueTagKeys | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getTrueTagKeys | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getTrueTagKeys | function | apps/lore-weave/lib/utils/tagUtils.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-122: ProfileTab, ProfileTab, ProfileTab
**Members:** 3 | **Avg Similarity:** 0.66 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ProfileTab | component | ...e-forge/webui/src/components/workspace/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| ProfileTab | component | ...ge/webui/src/components/workspace/tabs/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| ProfileTab | component | .../src/components/workspace/tabs/profile/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-123: AddRuleButton, AddRuleButton, AddRuleButton
**Members:** 3 | **Avg Similarity:** 0.66 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| AddRuleButton | component | ...ents/generators/applicability/AddRuleButton.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| AddRuleButton | component | ...rc/components/generators/applicability/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| AddRuleButton | component | ...engine/webui/src/components/generators/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-124: SelectionFilterCard, SelectionFilterCard, SelectionFilterCard
**Members:** 3 | **Avg Similarity:** 0.66 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| SelectionFilterCard | component | ...ents/generators/filters/SelectionFilterCard.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| SelectionFilterCard | component | ...ebui/src/components/generators/filters/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| SelectionFilterCard | component | ...engine/webui/src/components/generators/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-125: theoreticalCapacity, theoreticalCapacity, theoreticalCapacity
**Members:** 3 | **Avg Similarity:** 0.66 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| theoreticalCapacity | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| theoreticalCapacity | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| theoreticalCapacity | function | apps/name-forge/lib/validation/metrics/capacity.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-126: analyzeDiversity, analyzeDiversity, analyzeDiversity
**Members:** 3 | **Avg Similarity:** 0.66 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| analyzeDiversity | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| analyzeDiversity | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| analyzeDiversity | function | ...ame-forge/lib/validation/metrics/diffuseness.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-127: validateDiffuseness, validateDiffuseness, validateDiffuseness
**Members:** 3 | **Avg Similarity:** 0.66 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| validateDiffuseness | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| validateDiffuseness | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| validateDiffuseness | function | ...ame-forge/lib/validation/metrics/diffuseness.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-128: annotateEntityNames, deleteChronicleVersion, updateChronicleActiveVersion, updateChronicleCombineInstructions, +1 more
**Members:** 5 | **Avg Similarity:** 0.39 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| annotateEntityNames | function | ...lluminator/webui/src/lib/annotateEntityNames.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, behavior:0.88 |
| deleteChronicleVersion | function | ...minator/webui/src/lib/db/chronicleRepository.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, behavior:0.88 |
| updateChronicleActiveVersion | function | ...minator/webui/src/lib/db/chronicleRepository.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, behavior:0.88 |
| updateChronicleCombineInstructions | function | ...minator/webui/src/lib/db/chronicleRepository.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, behavior:0.88 |
| updateChronicleTemporalContext | function | ...minator/webui/src/lib/db/chronicleRepository.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, behavior:0.88 |

*Pending semantic verification*

### cluster-129: calculateEntropy, calculateEntropy, calculateEntropy
**Members:** 3 | **Avg Similarity:** 0.65 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| calculateEntropy | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| calculateEntropy | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| calculateEntropy | function | apps/name-forge/lib/validation/metrics/capacity.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-130: estimateRequiredSamples, estimateRequiredSamples, estimateRequiredSamples
**Members:** 3 | **Avg Similarity:** 0.65 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| estimateRequiredSamples | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| estimateRequiredSamples | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| estimateRequiredSamples | function | apps/name-forge/lib/validation/metrics/capacity.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-131: generateFromDomain, generateFromDomain, generateNamesFromDomain, generateTestNames
**Members:** 4 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generateFromDomain | function | apps/name-forge/lib/generate.ts | behavior:1.00, neighborhood:1.00, typeSignature:0.76, callSequence:0.72 |
| generateFromDomain | function | apps/name-forge/lib/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:0.76, callSequence:0.72 |
| generateNamesFromDomain | function | apps/name-forge/webui/src/lib/browser-generator.js | behavior:1.00, neighborhood:1.00, typeSignature:0.76, callSequence:0.72 |
| generateTestNames | function | apps/name-forge/webui/src/lib/browser-optimizer.js | behavior:1.00, neighborhood:1.00, typeSignature:0.76, callSequence:0.72 |

*Pending semantic verification*

### cluster-132: mergeTags, mergeTags, mergeTags
**Members:** 3 | **Avg Similarity:** 0.64 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| mergeTags | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| mergeTags | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| mergeTags | function | apps/lore-weave/lib/utils/tagUtils.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-133: createPressureFromDeclarative, loadPressure, createPressureFromDeclarative, loadPressure
**Members:** 4 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createPressureFromDeclarative | function | apps/lore-weave/lib/engine/pressureInterpreter.ts | behavior:1.00, typeSignature:1.00, semantic:0.90, neighborhood:0.50 |
| loadPressure | function | apps/lore-weave/lib/engine/pressureInterpreter.ts | behavior:1.00, typeSignature:1.00, semantic:0.90, neighborhood:0.50 |
| createPressureFromDeclarative | function | apps/lore-weave/lib/index.ts | behavior:1.00, typeSignature:1.00, semantic:0.90, neighborhood:0.50 |
| loadPressure | function | apps/lore-weave/lib/index.ts | behavior:1.00, typeSignature:1.00, semantic:0.90, neighborhood:0.50 |

*Pending semantic verification*

### cluster-134: default, default, default, default, +1 more
**Members:** 5 | **Avg Similarity:** 0.38 | **Spread:** 1 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...mponents/generators/cards/GeneratorListCard.jsx | neighborhood:1.00, behavior:0.90, typeSignature:0.70, imports:0.55 |
| default | function | .../src/components/generators/tabs/CreationTab.jsx | neighborhood:1.00, behavior:0.90, typeSignature:0.70, imports:0.55 |
| default | function | .../src/components/generators/tabs/OverviewTab.jsx | neighborhood:1.00, behavior:0.90, typeSignature:0.70, imports:0.55 |
| default | function | ...components/generators/tabs/RelationshipsTab.jsx | neighborhood:1.00, behavior:0.90, typeSignature:0.70, imports:0.55 |
| default | function | ...ui/src/components/generators/tabs/TargetTab.jsx | neighborhood:1.00, behavior:0.90, typeSignature:0.70, imports:0.55 |

*Pending semantic verification*

### cluster-135: rollProbability, rollProbability, rollProbability
**Members:** 3 | **Avg Similarity:** 0.64 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| rollProbability | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| rollProbability | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| rollProbability | function | apps/lore-weave/lib/utils/randomUtils.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-136: GraphPathEditor, GraphPathEditor, GraphPathEditor
**Members:** 3 | **Avg Similarity:** 0.64 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| GraphPathEditor | component | ...mponents/generators/filters/GraphPathEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| GraphPathEditor | component | ...ebui/src/components/generators/filters/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| GraphPathEditor | component | ...engine/webui/src/components/generators/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-137: canFormRelationship, canFormRelationship, canFormRelationship
**Members:** 3 | **Avg Similarity:** 0.64 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| canFormRelationship | function | apps/lore-weave/lib/graph/relationshipMutation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| canFormRelationship | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| canFormRelationship | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-138: matchesActorConfig, matchesActorConfig, matchesActorConfig
**Members:** 3 | **Avg Similarity:** 0.64 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| matchesActorConfig | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| matchesActorConfig | function | apps/lore-weave/lib/rules/actorMatcher.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| matchesActorConfig | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-139: ApplicabilityRuleCard, ApplicabilityRuleCard, ApplicabilityRuleCard
**Members:** 3 | **Avg Similarity:** 0.64 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ApplicabilityRuleCard | component | ...erators/applicability/ApplicabilityRuleCard.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| ApplicabilityRuleCard | component | ...rc/components/generators/applicability/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| ApplicabilityRuleCard | component | ...engine/webui/src/components/generators/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-140: pickMultiple, pickMultiple, pickMultiple
**Members:** 3 | **Avg Similarity:** 0.64 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| pickMultiple | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| pickMultiple | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| pickMultiple | function | apps/lore-weave/lib/utils/randomUtils.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-141: CreationTab, CreationTab, CreationTab
**Members:** 3 | **Avg Similarity:** 0.63 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| CreationTab | component | ...engine/webui/src/components/generators/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| CreationTab | component | .../src/components/generators/tabs/CreationTab.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| CreationTab | component | ...e/webui/src/components/generators/tabs/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-142: ChronicleWizard, downloadBulkToneReviewExport, unpublishChronicle, useSelectedChronicle
**Members:** 4 | **Avg Similarity:** 0.40 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ChronicleWizard | component | ...r/webui/src/components/ChronicleWizard/index.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.96, behavior:0.78 |
| downloadBulkToneReviewExport | function | apps/illuminator/webui/src/lib/chronicleExport.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.96, behavior:0.78 |
| unpublishChronicle | function | ...minator/webui/src/lib/db/chronicleRepository.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.96, behavior:0.78 |
| useSelectedChronicle | hook | ...uminator/webui/src/lib/db/chronicleSelectors.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.96, behavior:0.78 |

*Pending semantic verification*

### cluster-143: useChronicleActions, useFactCoverage, useToneRanking, generateChronicleId
**Members:** 4 | **Avg Similarity:** 0.39 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| useChronicleActions | hook | ...uminator/webui/src/hooks/useChronicleActions.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, behavior:0.88 |
| useFactCoverage | hook | .../illuminator/webui/src/hooks/useFactCoverage.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, behavior:0.88 |
| useToneRanking | hook | apps/illuminator/webui/src/hooks/useToneRanking.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, behavior:0.88 |
| generateChronicleId | function | ...minator/webui/src/lib/db/chronicleRepository.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, behavior:0.88 |

*Pending semantic verification*

### cluster-144: RelationshipsTab, RelationshipsTab, RelationshipsTab
**Members:** 3 | **Avg Similarity:** 0.63 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| RelationshipsTab | component | ...engine/webui/src/components/generators/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| RelationshipsTab | component | ...components/generators/tabs/RelationshipsTab.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| RelationshipsTab | component | ...e/webui/src/components/generators/tabs/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-145: getConnectionWeight, getConnectionWeight, getConnectionWeight
**Members:** 3 | **Avg Similarity:** 0.62 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getConnectionWeight | function | apps/lore-weave/lib/graph/entityQueries.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getConnectionWeight | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getConnectionWeight | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-146: validateCapacity, validateCapacity, validateCapacity
**Members:** 3 | **Avg Similarity:** 0.62 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| validateCapacity | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| validateCapacity | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| validateCapacity | function | apps/name-forge/lib/validation/metrics/capacity.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-147: extractFeatures, extractFeatures, extractFeatures
**Members:** 3 | **Avg Similarity:** 0.62 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| extractFeatures | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| extractFeatures | function | .../name-forge/lib/validation/analysis/features.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| extractFeatures | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-148: getRelated, getRelated, getRelated
**Members:** 3 | **Avg Similarity:** 0.62 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getRelated | function | apps/lore-weave/lib/graph/entityQueries.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| getRelated | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| getRelated | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-149: ResultsViewer, SimulationRunner, DistributionTargetsEditor, useSimulationWorker
**Members:** 4 | **Avg Similarity:** 0.38 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ResultsViewer | component | ...ore-weave/webui/src/components/results/index.js | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.75, hookProfile:0.62 |
| SimulationRunner | component | ...lore-weave/webui/src/components/runner/index.js | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.75, hookProfile:0.62 |
| DistributionTargetsEditor | component | ...ore-weave/webui/src/components/targets/index.js | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.75, hookProfile:0.62 |
| useSimulationWorker | hook | ...re-weave/webui/src/hooks/useSimulationWorker.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.75, hookProfile:0.62 |

*Pending semantic verification*

### cluster-150: findSimilarClusters, findSimilarClusters, findSimilarClusters
**Members:** 3 | **Avg Similarity:** 0.61 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| findSimilarClusters | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| findSimilarClusters | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| findSimilarClusters | function | ...ame-forge/lib/validation/metrics/diffuseness.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-151: generateEntityIdFromName, generateEntityIdFromName, generateEntityIdFromName
**Members:** 3 | **Avg Similarity:** 0.60 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generateEntityIdFromName | function | apps/lore-weave/lib/graph/entityMutation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| generateEntityIdFromName | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| generateEntityIdFromName | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-152: addRelationship, addRelationship, addRelationship
**Members:** 3 | **Avg Similarity:** 0.60 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| addRelationship | function | apps/lore-weave/lib/graph/relationshipMutation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| addRelationship | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| addRelationship | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-153: arrayToTags, arrayToTags, arrayToTags
**Members:** 3 | **Avg Similarity:** 0.60 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| arrayToTags | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| arrayToTags | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| arrayToTags | function | apps/lore-weave/lib/utils/tagUtils.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-154: validateSeparation, validateSeparation, validateSeparation
**Members:** 3 | **Avg Similarity:** 0.60 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| validateSeparation | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| validateSeparation | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| validateSeparation | function | ...name-forge/lib/validation/metrics/separation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-155: archiveRelationship, archiveRelationship, archiveRelationship
**Members:** 3 | **Avg Similarity:** 0.59 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| archiveRelationship | function | apps/lore-weave/lib/graph/relationshipMutation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| archiveRelationship | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| archiveRelationship | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-156: default, default
**Members:** 2 | **Avg Similarity:** 0.44 | **Spread:** 2 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | apps/archivist/webui/src/ArchivistRemote.tsx | neighborhood:1.00, behavior:0.88, calleeSet:0.83, typeSignature:0.70 |
| default | function | ...hronicler/webui/src/hooks/useWorldDataLoader.ts | neighborhood:1.00, behavior:0.88, calleeSet:0.83, typeSignature:0.70 |

*Pending semantic verification*

### cluster-157: PathConstraintEditor, PathConstraintEditor, PathConstraintEditor
**Members:** 3 | **Avg Similarity:** 0.58 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| PathConstraintEditor | component | ...nts/generators/filters/PathConstraintEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| PathConstraintEditor | component | ...ebui/src/components/generators/filters/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| PathConstraintEditor | component | ...engine/webui/src/components/generators/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

*Pending semantic verification*

### cluster-158: addEntity, addEntity, addEntity
**Members:** 3 | **Avg Similarity:** 0.58 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| addEntity | function | apps/lore-weave/lib/graph/entityMutation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| addEntity | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| addEntity | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-159: modifyRelationshipStrength, modifyRelationshipStrength, modifyRelationshipStrength
**Members:** 3 | **Avg Similarity:** 0.58 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| modifyRelationshipStrength | function | apps/lore-weave/lib/graph/relationshipMutation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| modifyRelationshipStrength | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| modifyRelationshipStrength | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-160: getEmbeddingSimilarity, similarityToCentroid, getEmbeddingSimilarity
**Members:** 3 | **Avg Similarity:** 0.58 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getEmbeddingSimilarity | function | apps/cosmographer/lib/embeddings/loader.ts | behavior:1.00, neighborhood:1.00, calleeSet:0.97, semantic:0.79 |
| similarityToCentroid | function | apps/cosmographer/lib/embeddings/loader.ts | behavior:1.00, neighborhood:1.00, calleeSet:0.97, semantic:0.79 |
| getEmbeddingSimilarity | function | apps/cosmographer/lib/index.ts | behavior:1.00, neighborhood:1.00, calleeSet:0.97, semantic:0.79 |

*Pending semantic verification*

### cluster-161: TargetTab, TargetTab, TargetTab
**Members:** 3 | **Avg Similarity:** 0.57 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| TargetTab | component | ...engine/webui/src/components/generators/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| TargetTab | component | ...ui/src/components/generators/tabs/TargetTab.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| TargetTab | component | ...e/webui/src/components/generators/tabs/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

*Pending semantic verification*

### cluster-162: default, default, default
**Members:** 3 | **Avg Similarity:** 0.57 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...ngine/webui/src/components/CausalLoopEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| default | function | ...src/components/causal-loop/CausalLoopEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| default | function | ...ngine/webui/src/components/causal-loop/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-163: default, default, default, default
**Members:** 4 | **Avg Similarity:** 0.42 | **Spread:** 1 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | apps/illuminator/webui/src/hooks/useConfigSync.js | neighborhood:1.00, behavior:0.85, typeSignature:0.70, semantic:0.61 |
| default | function | ...inator/webui/src/hooks/useEntityGuidanceSync.js | neighborhood:1.00, behavior:0.85, typeSignature:0.70, semantic:0.61 |
| default | function | ...nator/webui/src/hooks/useHistorianConfigSync.js | neighborhood:1.00, behavior:0.85, typeSignature:0.70, semantic:0.61 |
| default | function | ...uminator/webui/src/hooks/useWorldContextSync.js | neighborhood:1.00, behavior:0.85, typeSignature:0.70, semantic:0.61 |

*Pending semantic verification*

### cluster-164: default, default, default
**Members:** 3 | **Avg Similarity:** 0.56 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...ngine/webui/src/components/ValidationEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| default | function | .../src/components/validation/ValidationEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| default | function | ...engine/webui/src/components/validation/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-165: getValidationStatus, getValidationStatus, getValidationStatus
**Members:** 3 | **Avg Similarity:** 0.56 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getValidationStatus | function | ...ngine/webui/src/components/ValidationEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| getValidationStatus | function | .../src/components/validation/ValidationEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| getValidationStatus | function | ...engine/webui/src/components/validation/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-166: default, default, default
**Members:** 3 | **Avg Similarity:** 0.56 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...engine/webui/src/components/PressuresEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| default | function | ...ui/src/components/pressures/PressuresEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| default | function | ...-engine/webui/src/components/pressures/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-167: loadUiState, loadStoredValue
**Members:** 2 | **Avg Similarity:** 0.41 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| loadUiState | function | apps/canonry/webui/src/storage/uiState.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:0.58 |
| loadStoredValue | function | ...coherence-engine/webui/src/utils/persistence.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:0.58 |

*Pending semantic verification*

### cluster-168: estimateSyllableCount, estimateSyllableCount, estimateSyllableCount
**Members:** 3 | **Avg Similarity:** 0.54 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| estimateSyllableCount | function | apps/name-forge/lib/utils/helpers.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.82 |
| estimateSyllableCount | function | .../name-forge/lib/validation/analysis/features.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.82 |
| estimateSyllableCount | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.82 |

*Pending semantic verification*

### cluster-169: default, default, default, default
**Members:** 4 | **Avg Similarity:** 0.40 | **Spread:** 1 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...erators/applicability/ApplicabilityRuleCard.jsx | neighborhood:1.00, behavior:0.84, typeSignature:0.62, imports:0.61 |
| default | function | ...nts/generators/filters/PathConstraintEditor.jsx | neighborhood:1.00, behavior:0.84, typeSignature:0.62, imports:0.61 |
| default | function | ...omponents/generators/filters/PathStepEditor.jsx | neighborhood:1.00, behavior:0.84, typeSignature:0.62, imports:0.61 |
| default | function | ...ents/generators/filters/SelectionFilterCard.jsx | neighborhood:1.00, behavior:0.84, typeSignature:0.62, imports:0.61 |

*Pending semantic verification*

### cluster-170: resolveAnchorPhrase, resolveAnchorPhrase
**Members:** 2 | **Avg Similarity:** 0.40 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| resolveAnchorPhrase | function | apps/chronicler/webui/src/lib/fuzzyAnchor.ts | behavior:1.00, typeSignature:1.00, calleeSet:0.63, semantic:0.47 |
| resolveAnchorPhrase | function | apps/illuminator/webui/src/lib/fuzzyAnchor.ts | behavior:1.00, typeSignature:1.00, calleeSet:0.63, semantic:0.47 |

*Pending semantic verification*

### cluster-171: default, default, default
**Members:** 3 | **Avg Similarity:** 0.53 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...i/src/components/NamingProfileMappingViewer.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| default | function | ...g-profile-viewer/NamingProfileMappingViewer.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| default | function | ...i/src/components/naming-profile-viewer/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-172: updateDynamicsRun, updateEraNarrative, updateHistorianRun, updateRevisionRun
**Members:** 4 | **Avg Similarity:** 0.40 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| updateDynamicsRun | function | ...uminator/webui/src/lib/db/dynamicsRepository.ts | behavior:1.00, semantic:0.86, typeSignature:0.55, callSequence:0.30 |
| updateEraNarrative | function | ...ator/webui/src/lib/db/eraNarrativeRepository.ts | behavior:1.00, semantic:0.86, typeSignature:0.55, callSequence:0.30 |
| updateHistorianRun | function | ...minator/webui/src/lib/db/historianRepository.ts | behavior:1.00, semantic:0.86, typeSignature:0.55, callSequence:0.30 |
| updateRevisionRun | function | ...r/webui/src/lib/db/summaryRevisionRepository.ts | behavior:1.00, semantic:0.86, typeSignature:0.55, callSequence:0.30 |

*Pending semantic verification*

### cluster-173: generateNameBank, createChronicleShell, reconcileBackportStatusFromEntities, updateChronicleTertiaryCast
**Members:** 4 | **Avg Similarity:** 0.40 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generateNameBank | function | ...illuminator/webui/src/lib/chronicle/nameBank.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, behavior:0.88 |
| createChronicleShell | function | ...minator/webui/src/lib/db/chronicleRepository.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, behavior:0.88 |
| reconcileBackportStatusFromEntities | function | ...minator/webui/src/lib/db/chronicleRepository.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, behavior:0.88 |
| updateChronicleTertiaryCast | function | ...minator/webui/src/lib/db/chronicleRepository.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, behavior:0.88 |

*Pending semantic verification*

### cluster-174: CausalLoopEditor, CausalLoopEditor
**Members:** 2 | **Avg Similarity:** 0.77 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| CausalLoopEditor | component | ...src/components/causal-loop/CausalLoopEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| CausalLoopEditor | component | ...ngine/webui/src/components/causal-loop/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-175: DependencyViewer, DependencyViewer
**Members:** 2 | **Avg Similarity:** 0.77 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| DependencyViewer | component | ...mponents/dependency-viewer/DependencyViewer.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| DependencyViewer | component | ...webui/src/components/dependency-viewer/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-176: SystemsEditor, SystemsEditor
**Members:** 2 | **Avg Similarity:** 0.77 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| SystemsEditor | component | .../webui/src/components/systems/SystemsEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| SystemsEditor | component | ...ce-engine/webui/src/components/systems/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-177: GeneratorsEditor, GeneratorsEditor
**Members:** 2 | **Avg Similarity:** 0.77 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| GeneratorsEditor | component | .../src/components/generators/GeneratorsEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| GeneratorsEditor | component | ...engine/webui/src/components/generators/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-178: PressuresEditor, PressuresEditor
**Members:** 2 | **Avg Similarity:** 0.77 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| PressuresEditor | component | ...ui/src/components/pressures/PressuresEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| PressuresEditor | component | ...-engine/webui/src/components/pressures/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-179: NamingProfileMappingViewer, NamingProfileMappingViewer
**Members:** 2 | **Avg Similarity:** 0.77 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| NamingProfileMappingViewer | component | ...g-profile-viewer/NamingProfileMappingViewer.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| NamingProfileMappingViewer | component | ...i/src/components/naming-profile-viewer/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-180: default, default
**Members:** 2 | **Avg Similarity:** 0.38 | **Spread:** 2 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | .../chronicler/webui/src/components/WikiSearch.tsx | neighborhood:1.00, behavior:0.88, calleeSet:0.58, imports:0.47 |
| default | function | apps/viewer/webui/src/HeaderSearch.jsx | neighborhood:1.00, behavior:0.88, calleeSet:0.58, imports:0.47 |

*Pending semantic verification*

### cluster-181: default, default, default
**Members:** 3 | **Avg Similarity:** 0.51 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...ui/src/components/workspace/tabs/ProfileTab.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| default | function | ...omponents/workspace/tabs/profile/ProfileTab.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| default | function | .../src/components/workspace/tabs/profile/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-182: GenerateTab, OptimizerWorkshop, CultureSidebar, EntityWorkspace
**Members:** 4 | **Avg Similarity:** 0.38 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| GenerateTab | component | ...e-forge/webui/src/components/generator/index.js | consumerSet:1.00, neighborhood:1.00, hookProfile:0.95, coOccurrence:0.67 |
| OptimizerWorkshop | component | ...e-forge/webui/src/components/optimizer/index.js | consumerSet:1.00, neighborhood:1.00, hookProfile:0.95, coOccurrence:0.67 |
| CultureSidebar | component | ...ame-forge/webui/src/components/sidebar/index.js | consumerSet:1.00, neighborhood:1.00, hookProfile:0.95, coOccurrence:0.67 |
| EntityWorkspace | component | ...e-forge/webui/src/components/workspace/index.js | consumerSet:1.00, neighborhood:1.00, hookProfile:0.95, coOccurrence:0.67 |

*Pending semantic verification*

### cluster-183: useBulkBackport, useBulkHistorian, collectPreviousNotes
**Members:** 3 | **Avg Similarity:** 0.42 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| useBulkBackport | hook | .../illuminator/webui/src/hooks/useBulkBackport.ts | behavior:0.75, coOccurrence:0.68, typeSignature:0.55, consumerSet:0.50 |
| useBulkHistorian | hook | ...illuminator/webui/src/hooks/useBulkHistorian.ts | behavior:0.75, coOccurrence:0.68, typeSignature:0.55, consumerSet:0.50 |
| collectPreviousNotes | function | ...nator/webui/src/lib/historianContextBuilders.ts | behavior:0.75, coOccurrence:0.68, typeSignature:0.55, consumerSet:0.50 |

*Pending semantic verification*

### cluster-184: filterChronicleEvents, computeIntensityCurve, getEventsInRange
**Members:** 3 | **Avg Similarity:** 0.50 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| filterChronicleEvents | function | ...ator/webui/src/lib/chronicle/selectionWizard.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.94, behavior:0.88 |
| computeIntensityCurve | function | ...inator/webui/src/lib/chronicle/timelineUtils.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.94, behavior:0.88 |
| getEventsInRange | function | ...inator/webui/src/lib/chronicle/timelineUtils.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.94, behavior:0.88 |

*Pending semantic verification*

### cluster-185: clearAwsTokens, clearStoredValue
**Members:** 2 | **Avg Similarity:** 0.37 | **Spread:** 2 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| clearAwsTokens | function | apps/canonry/webui/src/aws/awsConfigStorage.js | callSequence:1.00, behavior:0.88, calleeSet:0.70, semantic:0.57 |
| clearStoredValue | function | ...coherence-engine/webui/src/utils/persistence.js | callSequence:1.00, behavior:0.88, calleeSet:0.70, semantic:0.57 |

*Pending semantic verification*

### cluster-186: seedEntities, seedNarrativeEvents, seedRelationships
**Members:** 3 | **Avg Similarity:** 0.49 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| seedEntities | function | ...lluminator/webui/src/lib/db/entityRepository.ts | behavior:1.00, semantic:0.91, typeSignature:0.70, imports:0.57 |
| seedNarrativeEvents | function | ...illuminator/webui/src/lib/db/eventRepository.ts | behavior:1.00, semantic:0.91, typeSignature:0.70, imports:0.57 |
| seedRelationships | function | ...ator/webui/src/lib/db/relationshipRepository.ts | behavior:1.00, semantic:0.91, typeSignature:0.70, imports:0.57 |

*Pending semantic verification*

### cluster-187: default, default, default
**Members:** 3 | **Avg Similarity:** 0.49 | **Spread:** 1 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | .../webui/src/components/BulkEraNarrativeModal.jsx | callSequence:1.00, neighborhood:1.00, behavior:0.88, dataAccess:0.70 |
| default | function | ...tor/webui/src/components/BulkOperationShell.jsx | callSequence:1.00, neighborhood:1.00, behavior:0.88, dataAccess:0.70 |
| default | function | ...i/src/components/InterleavedAnnotationModal.jsx | callSequence:1.00, neighborhood:1.00, behavior:0.88, dataAccess:0.70 |

*Pending semantic verification*

### cluster-188: getRunSlots, getActiveSlot, getActiveSlotIndex, loadWorldData
**Members:** 4 | **Avg Similarity:** 0.36 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getRunSlots | function | apps/canonry/webui/src/storage/runStore.js | behavior:1.00, dataAccess:1.00, typeSignature:1.00, semantic:0.49 |
| getActiveSlot | function | apps/canonry/webui/src/storage/worldStore.js | behavior:1.00, dataAccess:1.00, typeSignature:1.00, semantic:0.49 |
| getActiveSlotIndex | function | apps/canonry/webui/src/storage/worldStore.js | behavior:1.00, dataAccess:1.00, typeSignature:1.00, semantic:0.49 |
| loadWorldData | function | apps/canonry/webui/src/storage/worldStore.js | behavior:1.00, dataAccess:1.00, typeSignature:1.00, semantic:0.49 |

*Pending semantic verification*

### cluster-189: getDefaultQuality, getDefaultSize, getModelForCall, getThinkingBudgetForCall
**Members:** 4 | **Avg Similarity:** 0.36 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getDefaultQuality | function | apps/illuminator/webui/src/lib/imageSettings.ts | behavior:1.00, neighborhood:1.00, typeSignature:0.70, semantic:0.57 |
| getDefaultSize | function | apps/illuminator/webui/src/lib/imageSettings.ts | behavior:1.00, neighborhood:1.00, typeSignature:0.70, semantic:0.57 |
| getModelForCall | function | apps/illuminator/webui/src/lib/llmModelSettings.ts | behavior:1.00, neighborhood:1.00, typeSignature:0.70, semantic:0.57 |
| getThinkingBudgetForCall | function | apps/illuminator/webui/src/lib/llmModelSettings.ts | behavior:1.00, neighborhood:1.00, typeSignature:0.70, semantic:0.57 |

*Pending semantic verification*

### cluster-190: getHistoricalTraits, parseJsonObject, parseJsonObject
**Members:** 3 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getHistoricalTraits | function | ...illuminator/webui/src/lib/db/traitRepository.ts | behavior:0.94, typeSignature:0.85, callSequence:0.57, coOccurrence:0.57 |
| parseJsonObject | function | apps/illuminator/webui/src/lib/jsonParsing.ts | behavior:0.94, typeSignature:0.85, callSequence:0.57, coOccurrence:0.57 |
| parseJsonObject | function | ...uminator/webui/src/workers/tasks/textParsing.ts | behavior:0.94, typeSignature:0.85, callSequence:0.57, coOccurrence:0.57 |

*Pending semantic verification*

### cluster-191: createNewRule, default, createNewRule, createNewRule
**Members:** 4 | **Avg Similarity:** 0.36 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createNewRule | function | ...nents/generators/applicability/createNewRule.js | behavior:1.00, typeSignature:1.00, neighborhood:0.67, semantic:0.61 |
| default | function | ...nents/generators/applicability/createNewRule.js | behavior:1.00, typeSignature:1.00, neighborhood:0.67, semantic:0.61 |
| createNewRule | function | ...rc/components/generators/applicability/index.js | behavior:1.00, typeSignature:1.00, neighborhood:0.67, semantic:0.61 |
| createNewRule | function | ...engine/webui/src/components/generators/index.js | behavior:1.00, typeSignature:1.00, neighborhood:0.67, semantic:0.61 |

*Pending semantic verification*

### cluster-192: previewGrammar, previewGrammar, previewGrammarNames
**Members:** 3 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| previewGrammar | function | apps/name-forge/lib/generate.ts | callSequence:1.00, behavior:0.92, semantic:0.74, typeSignature:0.60 |
| previewGrammar | function | apps/name-forge/lib/index.ts | callSequence:1.00, behavior:0.92, semantic:0.74, typeSignature:0.60 |
| previewGrammarNames | function | apps/name-forge/webui/src/lib/browser-generator.js | callSequence:1.00, behavior:0.92, semantic:0.74, typeSignature:0.60 |

*Pending semantic verification*

### cluster-193: StoryScoreDots, StoryScoreDots
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| StoryScoreDots | component | ...leWizard/visualizations/StoryPotentialRadar.tsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| StoryScoreDots | component | ...ponents/ChronicleWizard/visualizations/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

*Pending semantic verification*

### cluster-194: ActionsEditor, ActionsEditor
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ActionsEditor | component | .../webui/src/components/actions/ActionsEditor.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| ActionsEditor | component | ...ce-engine/webui/src/components/actions/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

*Pending semantic verification*

### cluster-195: EraCard, EraCard
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| EraCard | component | ...ce-engine/webui/src/components/eras/EraCard.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| EraCard | component | ...rence-engine/webui/src/components/eras/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-196: DependencySection, DependencySection
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| DependencySection | component | ...endency-viewer/components/DependencySection.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| DependencySection | component | ...omponents/dependency-viewer/components/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-197: IssueCard, IssueCard
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| IssueCard | component | ...i/src/components/validation/cards/IssueCard.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| IssueCard | component | .../webui/src/components/validation/cards/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-198: PressureCard, PressureCard
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| PressureCard | component | ...src/components/pressures/cards/PressureCard.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| PressureCard | component | ...e/webui/src/components/pressures/cards/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-199: ThresholdTriggerTab, ThresholdTriggerTab
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ThresholdTriggerTab | component | ...components/systems/tabs/ThresholdTriggerTab.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| ThresholdTriggerTab | component | ...gine/webui/src/components/systems/tabs/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-200: getEmbedding, getEmbedding
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getEmbedding | function | apps/cosmographer/lib/embeddings/loader.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getEmbedding | function | apps/cosmographer/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-201: findMostSimilar, findMostSimilar
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| findMostSimilar | function | apps/cosmographer/lib/embeddings/loader.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| findMostSimilar | function | apps/cosmographer/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-202: canBeChildOf, canBeChildOf
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| canBeChildOf | function | apps/cosmographer/lib/ontology/categories.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| canBeChildOf | function | apps/cosmographer/lib/ontology/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-203: categoryDistance, categoryDistance
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| categoryDistance | function | apps/cosmographer/lib/ontology/categories.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| categoryDistance | function | apps/cosmographer/lib/ontology/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-204: validateWorld, validateWorld
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| validateWorld | function | apps/lore-weave/lib/engine/validators.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| validateWorld | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-205: calculateSimilarity, calculateSimilarity
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| calculateSimilarity | function | apps/lore-weave/lib/graph/clusteringUtils.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| calculateSimilarity | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-206: findBestClusterMatch, findBestClusterMatch
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| findBestClusterMatch | function | apps/lore-weave/lib/graph/clusteringUtils.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| findBestClusterMatch | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-207: archiveEntity, archiveEntity
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| archiveEntity | function | apps/lore-weave/lib/graph/entityArchival.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| archiveEntity | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-208: getPartOfMembers, getPartOfMembers
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getPartOfMembers | function | apps/lore-weave/lib/graph/entityArchival.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getPartOfMembers | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-209: supersedeEntity, supersedeEntity
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| supersedeEntity | function | apps/lore-weave/lib/graph/entityArchival.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| supersedeEntity | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-210: createExecutableAction, createExecutableAction
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createExecutableAction | function | apps/lore-weave/lib/engine/actionInterpreter.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| createExecutableAction | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-211: loadPressures, loadPressures
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| loadPressures | function | apps/lore-weave/lib/engine/pressureInterpreter.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| loadPressures | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-212: loadSystems, loadSystems
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| loadSystems | function | apps/lore-weave/lib/engine/systemInterpreter.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| loadSystems | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-213: evaluateSimpleCount, evaluateSimpleCount
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| evaluateSimpleCount | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| evaluateSimpleCount | function | apps/lore-weave/lib/rules/metrics/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-214: applyMutationResult, applyMutationResult
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyMutationResult | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| applyMutationResult | function | apps/lore-weave/lib/rules/mutations/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-215: entityPassesFilter, entityPassesFilter
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| entityPassesFilter | function | apps/lore-weave/lib/rules/filters/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| entityPassesFilter | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-216: entityPassesAllFilters, entityPassesAllFilters
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| entityPassesAllFilters | function | apps/lore-weave/lib/rules/filters/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| entityPassesAllFilters | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-217: past, past
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| past | function | apps/name-forge/lib/derivation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| past | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-218: possessive, possessive
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| possessive | function | apps/name-forge/lib/derivation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| possessive | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-219: gerund, gerund
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| gerund | function | apps/name-forge/lib/derivation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| gerund | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-220: agentive, agentive
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| agentive | function | apps/name-forge/lib/derivation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| agentive | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-221: isDerivationType, isDerivationType
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| isDerivationType | function | apps/name-forge/lib/derivation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| isDerivationType | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-222: generate, generate
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generate | function | apps/name-forge/lib/generate.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| generate | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-223: generateOne, generateOne
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generateOne | function | apps/name-forge/lib/generate.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| generateOne | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-224: testDomain, testDomain
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| testDomain | function | apps/name-forge/lib/generate.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| testDomain | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-225: generatePhonotacticName, generatePhonotacticName
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generatePhonotacticName | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| generatePhonotacticName | function | apps/name-forge/lib/phonotactic-pipeline.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-226: executePhonotacticPipeline, executePhonotacticPipeline
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| executePhonotacticPipeline | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| executePhonotacticPipeline | function | apps/name-forge/lib/phonotactic-pipeline.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-227: applyMorphology, applyMorphology
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyMorphology | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| applyMorphology | function | apps/name-forge/lib/morphology.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-228: applyStyle, applyStyle
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyStyle | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| applyStyle | function | apps/name-forge/lib/style.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-229: generateFromMarkov, generateFromMarkov
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generateFromMarkov | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| generateFromMarkov | function | apps/name-forge/lib/markov.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-230: generateNamesFromMarkov, generateNamesFromMarkov
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generateNamesFromMarkov | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| generateNamesFromMarkov | function | apps/name-forge/lib/markov.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-231: setMarkovBaseUrl, setMarkovBaseUrl
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| setMarkovBaseUrl | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| setMarkovBaseUrl | function | apps/name-forge/lib/markov-loader.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-232: pickWeighted, pickWeighted
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| pickWeighted | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| pickWeighted | function | apps/name-forge/lib/utils/rng.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-233: applyCapitalization, applyCapitalization
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyCapitalization | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| applyCapitalization | function | apps/name-forge/lib/utils/helpers.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-234: capitalize, capitalize
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| capitalize | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| capitalize | function | apps/name-forge/lib/utils/helpers.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-235: optimizeDomain, optimizeDomain
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| optimizeDomain | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| optimizeDomain | function | apps/name-forge/lib/optimizer/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-236: extractBigrams, extractBigrams
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| extractBigrams | function | .../name-forge/lib/validation/analysis/features.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| extractBigrams | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-237: getEnding, getEnding
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getEnding | function | .../name-forge/lib/validation/analysis/features.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getEnding | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-238: featureVectorToArray, featureVectorToArray
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| featureVectorToArray | function | .../name-forge/lib/validation/analysis/features.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| featureVectorToArray | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-239: buildVocabulary, buildVocabulary
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| buildVocabulary | function | .../name-forge/lib/validation/analysis/features.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| buildVocabulary | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-240: calculateCentroid, calculateCentroid
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| calculateCentroid | function | .../name-forge/lib/validation/analysis/features.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| calculateCentroid | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-241: normalizeFeatures, normalizeFeatures
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| normalizeFeatures | function | .../name-forge/lib/validation/analysis/features.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| normalizeFeatures | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-242: pairwiseDistances, pairwiseDistances
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| pairwiseDistances | function | .../name-forge/lib/validation/analysis/distance.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| pairwiseDistances | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-243: findNearestNeighbors, findNearestNeighbors
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| findNearestNeighbors | function | .../name-forge/lib/validation/analysis/distance.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| findNearestNeighbors | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-244: calculatePercentiles, calculatePercentiles
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| calculatePercentiles | function | .../name-forge/lib/validation/analysis/distance.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| calculatePercentiles | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-245: isProminenceOnlyEvent, isProminenceOnlyEvent
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| isProminenceOnlyEvent | function | packages/world-schema/src/eventFiltering.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| isProminenceOnlyEvent | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-246: getEntityEffects, getEntityEffects
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getEntityEffects | function | packages/world-schema/src/eventFiltering.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getEntityEffects | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-247: getEntityEvents, getEntityEvents
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getEntityEvents | function | packages/world-schema/src/eventFiltering.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getEntityEvents | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-248: formatEventForPrompt, formatEventForPrompt
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| formatEventForPrompt | function | packages/world-schema/src/eventFiltering.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| formatEventForPrompt | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-249: isFrameworkTag, isFrameworkTag
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| isFrameworkTag | function | packages/world-schema/src/frameworkPrimitives.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| isFrameworkTag | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-250: isFrameworkSubtype, isFrameworkSubtype
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| isFrameworkSubtype | function | packages/world-schema/src/frameworkPrimitives.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| isFrameworkSubtype | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-251: mergeFrameworkSchemaSlice, mergeFrameworkSchemaSlice
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| mergeFrameworkSchemaSlice | function | packages/world-schema/src/frameworkPrimitives.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| mergeFrameworkSchemaSlice | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-252: findNarrativeStyle, findNarrativeStyle
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| findNarrativeStyle | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| findNarrativeStyle | function | packages/world-schema/src/style.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-253: findColorPalette, findColorPalette
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| findColorPalette | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| findColorPalette | function | packages/world-schema/src/style.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-254: findArtisticStyle, findArtisticStyle
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| findArtisticStyle | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| findArtisticStyle | function | packages/world-schema/src/style.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-255: findCompositionStyle, findCompositionStyle
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| findCompositionStyle | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| findCompositionStyle | function | packages/world-schema/src/style.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-256: buildProminenceScale, buildProminenceScale
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| buildProminenceScale | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| buildProminenceScale | function | packages/world-schema/src/prominenceScale.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-257: prominenceLabelFromScale, prominenceLabelFromScale
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| prominenceLabelFromScale | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| prominenceLabelFromScale | function | packages/world-schema/src/prominenceScale.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-258: WizardProvider, WizardProvider
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| WizardProvider | component | ...rc/components/ChronicleWizard/WizardContext.tsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| WizardProvider | component | ...r/webui/src/components/ChronicleWizard/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-259: applySaturationLimits, applySaturationLimits
**Members:** 2 | **Avg Similarity:** 0.72 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applySaturationLimits | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| applySaturationLimits | function | apps/lore-weave/lib/rules/selection/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-260: calculateVowelRatio, calculateVowelRatio, calculateVowelRatio
**Members:** 3 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| calculateVowelRatio | function | apps/name-forge/lib/utils/helpers.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.57 |
| calculateVowelRatio | function | .../name-forge/lib/validation/analysis/features.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.57 |
| calculateVowelRatio | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.57 |

*Pending semantic verification*

### cluster-261: createRNG, createRNG
**Members:** 2 | **Avg Similarity:** 0.71 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createRNG | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| createRNG | function | apps/name-forge/lib/utils/rng.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-262: normalizeForComparison, toShapeKey, toShapeKey
**Members:** 3 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| normalizeForComparison | function | apps/name-forge/lib/style.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.58 |
| toShapeKey | function | .../name-forge/lib/validation/analysis/distance.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.58 |
| toShapeKey | function | apps/name-forge/lib/validation/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, calleeSet:0.58 |

*Pending semantic verification*

### cluster-263: generateNarrativeTags, generateNarrativeTags
**Members:** 2 | **Avg Similarity:** 0.71 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generateNarrativeTags | function | apps/lore-weave/lib/narrative/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| generateNarrativeTags | function | ...re-weave/lib/narrative/narrativeTagGenerator.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-264: generateAxisWeights, generateAxisWeights, generateAxisWeights
**Members:** 3 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generateAxisWeights | function | apps/cosmographer/lib/generator/hierarchy.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| generateAxisWeights | function | apps/cosmographer/lib/generator/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| generateAxisWeights | function | apps/cosmographer/lib/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-265: SimulationEmitter, SimulationEmitter, SimulationEmitter
**Members:** 3 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| SimulationEmitter | class | apps/lore-weave/lib/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| SimulationEmitter | class | apps/lore-weave/lib/observer/SimulationEmitter.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| SimulationEmitter | class | apps/lore-weave/lib/observer/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-266: NearestCentroidClassifier, NearestCentroidClassifier, NearestCentroidClassifier
**Members:** 3 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| NearestCentroidClassifier | class | apps/name-forge/lib/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| NearestCentroidClassifier | class | ...ame-forge/lib/validation/analysis/classifier.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| NearestCentroidClassifier | class | apps/name-forge/lib/validation/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-267: ErrorBoundary, default, ErrorBoundary
**Members:** 3 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ErrorBoundary | class | ...red-components/src/components/ErrorBoundary.jsx | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| default | class | ...red-components/src/components/ErrorBoundary.jsx | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| ErrorBoundary | class | packages/shared-components/src/components/index.js | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-268: applyPreferFilters, applyPreferFilters
**Members:** 2 | **Avg Similarity:** 0.71 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyPreferFilters | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| applyPreferFilters | function | apps/lore-weave/lib/rules/selection/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-269: default, default
**Members:** 2 | **Avg Similarity:** 0.36 | **Spread:** 2 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...i/src/components/SchemaEditor/CultureEditor.jsx | behavior:1.00, neighborhood:1.00, imports:0.88, typeSignature:0.70 |
| default | function | ...er/webui/src/components/CultureEditor/index.jsx | behavior:1.00, neighborhood:1.00, imports:0.88, typeSignature:0.70 |

*Pending semantic verification*

### cluster-270: useImageUrls, useImageUrls
**Members:** 2 | **Avg Similarity:** 0.71 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| useImageUrls | hook | packages/image-store/src/hooks.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| useImageUrls | hook | packages/image-store/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-271: chunk, chunk
**Members:** 2 | **Avg Similarity:** 0.70 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| chunk | function | apps/lore-weave/lib/utils/arrayUtils.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| chunk | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-272: useImageUrl, useImageUrl
**Members:** 2 | **Avg Similarity:** 0.70 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| useImageUrl | hook | packages/image-store/src/hooks.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| useImageUrl | hook | packages/image-store/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-273: applyWikiLinks, applyWikiLinks
**Members:** 2 | **Avg Similarity:** 0.70 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyWikiLinks | function | apps/chronicler/webui/src/lib/entityLinking.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |
| applyWikiLinks | function | apps/chronicler/webui/src/lib/wikiBuilder.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |

*Pending semantic verification*

### cluster-274: createClients, createClients
**Members:** 2 | **Avg Similarity:** 0.69 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createClients | function | apps/illuminator/webui/src/workers/clients.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| createClients | function | ...illuminator/webui/src/workers/enrichmentCore.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-275: isFrameworkEntityKind, isFrameworkEntityKind
**Members:** 2 | **Avg Similarity:** 0.69 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| isFrameworkEntityKind | function | packages/world-schema/src/frameworkPrimitives.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| isFrameworkEntityKind | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-276: applyEntityCriteria, applyEntityCriteria
**Members:** 2 | **Avg Similarity:** 0.69 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyEntityCriteria | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| applyEntityCriteria | function | apps/lore-weave/lib/rules/selection/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-277: applySelectionFilter, applySelectionFilter
**Members:** 2 | **Avg Similarity:** 0.69 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applySelectionFilter | function | apps/lore-weave/lib/rules/filters/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| applySelectionFilter | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-278: default, default, default
**Members:** 3 | **Avg Similarity:** 0.45 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...r/webui/src/components/ChronicleImagePicker.jsx | behavior:1.00, neighborhood:1.00, typeSignature:0.70, calleeSet:0.58 |
| default | function | ...nator/webui/src/components/ImagePickerModal.jsx | behavior:1.00, neighborhood:1.00, typeSignature:0.70, calleeSet:0.58 |
| default | function | ...minator/webui/src/components/ImageRefPicker.jsx | behavior:1.00, neighborhood:1.00, typeSignature:0.70, calleeSet:0.58 |

*Pending semantic verification*

### cluster-279: evaluateCondition, evaluateCondition
**Members:** 2 | **Avg Similarity:** 0.68 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| evaluateCondition | function | apps/lore-weave/lib/rules/conditions/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |
| evaluateCondition | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |

*Pending semantic verification*

### cluster-280: useWizard, useWizard
**Members:** 2 | **Avg Similarity:** 0.68 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| useWizard | hook | ...rc/components/ChronicleWizard/WizardContext.tsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| useWizard | hook | ...r/webui/src/components/ChronicleWizard/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-281: useImageMetadata, useImageMetadata
**Members:** 2 | **Avg Similarity:** 0.68 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| useImageMetadata | hook | packages/image-store/src/hooks.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| useImageMetadata | hook | packages/image-store/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-282: selectVariableEntities, selectVariableEntities
**Members:** 2 | **Avg Similarity:** 0.68 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| selectVariableEntities | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |
| selectVariableEntities | function | apps/lore-weave/lib/rules/selection/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |

*Pending semantic verification*

### cluster-283: parseJsonSafe, parseJsonSafe
**Members:** 2 | **Avg Similarity:** 0.68 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| parseJsonSafe | function | apps/lore-weave/lib/utils/arrayUtils.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| parseJsonSafe | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-284: selectEntities, selectEntities
**Members:** 2 | **Avg Similarity:** 0.67 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| selectEntities | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| selectEntities | function | apps/lore-weave/lib/rules/selection/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-285: getProminenceValue, getProminenceValue
**Members:** 2 | **Avg Similarity:** 0.67 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getProminenceValue | function | apps/lore-weave/lib/narrative/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getProminenceValue | function | ...e-weave/lib/narrative/significanceCalculator.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-286: ActorTab, ActorTab
**Members:** 2 | **Avg Similarity:** 0.67 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ActorTab | component | .../webui/src/components/actions/tabs/ActorTab.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| ActorTab | component | ...gine/webui/src/components/actions/tabs/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

*Pending semantic verification*

### cluster-287: InstigatorTab, InstigatorTab
**Members:** 2 | **Avg Similarity:** 0.67 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| InstigatorTab | component | ...i/src/components/actions/tabs/InstigatorTab.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| InstigatorTab | component | ...gine/webui/src/components/actions/tabs/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

*Pending semantic verification*

### cluster-288: TransitionsGrid, TransitionsGrid
**Members:** 2 | **Avg Similarity:** 0.67 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| TransitionsGrid | component | ...rc/components/eras/sections/TransitionsGrid.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| TransitionsGrid | component | ...ine/webui/src/components/eras/sections/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

*Pending semantic verification*

### cluster-289: TransitionEffectItem, TransitionEffectItem
**Members:** 2 | **Avg Similarity:** 0.67 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| TransitionEffectItem | component | ...components/eras/shared/TransitionEffectItem.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| TransitionEffectItem | component | ...ngine/webui/src/components/eras/shared/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

*Pending semantic verification*

### cluster-290: PlaneDiffusionTab, PlaneDiffusionTab
**Members:** 2 | **Avg Similarity:** 0.67 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| PlaneDiffusionTab | component | ...c/components/systems/tabs/PlaneDiffusionTab.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| PlaneDiffusionTab | component | ...gine/webui/src/components/systems/tabs/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

*Pending semantic verification*

### cluster-291: CommonSettingsTab, CommonSettingsTab
**Members:** 2 | **Avg Similarity:** 0.67 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| CommonSettingsTab | component | ...c/components/systems/tabs/CommonSettingsTab.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| CommonSettingsTab | component | ...gine/webui/src/components/systems/tabs/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

*Pending semantic verification*

### cluster-292: applyPickStrategy, applyPickStrategy
**Members:** 2 | **Avg Similarity:** 0.67 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyPickStrategy | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| applyPickStrategy | function | apps/lore-weave/lib/rules/selection/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-293: isFrameworkStatus, isFrameworkStatus
**Members:** 2 | **Avg Similarity:** 0.67 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| isFrameworkStatus | function | packages/world-schema/src/frameworkPrimitives.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| isFrameworkStatus | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-294: generateWords, generateWords
**Members:** 2 | **Avg Similarity:** 0.67 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| generateWords | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| generateWords | function | apps/name-forge/lib/phonology.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-295: evaluateGraphPath, evaluateGraphPath
**Members:** 2 | **Avg Similarity:** 0.67 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| evaluateGraphPath | function | apps/lore-weave/lib/rules/graphPath.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |
| evaluateGraphPath | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |

*Pending semantic verification*

### cluster-296: isFrameworkRelationshipKind, isFrameworkRelationshipKind
**Members:** 2 | **Avg Similarity:** 0.66 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| isFrameworkRelationshipKind | function | packages/world-schema/src/frameworkPrimitives.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| isFrameworkRelationshipKind | function | packages/world-schema/src/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-297: loadActions, loadActions
**Members:** 2 | **Avg Similarity:** 0.66 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| loadActions | function | apps/lore-weave/lib/engine/actionInterpreter.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |
| loadActions | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |

*Pending semantic verification*

### cluster-298: detectClusters, detectClusters
**Members:** 2 | **Avg Similarity:** 0.66 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| detectClusters | function | apps/lore-weave/lib/graph/clusteringUtils.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |
| detectClusters | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |

*Pending semantic verification*

### cluster-299: filterClusterableEntities, filterClusterableEntities
**Members:** 2 | **Avg Similarity:** 0.66 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| filterClusterableEntities | function | apps/lore-weave/lib/graph/clusteringUtils.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |
| filterClusterableEntities | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |

*Pending semantic verification*

### cluster-300: archiveEntities, archiveEntities
**Members:** 2 | **Avg Similarity:** 0.66 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| archiveEntities | function | apps/lore-weave/lib/graph/entityArchival.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |
| archiveEntities | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |

*Pending semantic verification*

### cluster-301: transferRelationships, transferRelationships
**Members:** 2 | **Avg Similarity:** 0.66 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| transferRelationships | function | apps/lore-weave/lib/graph/entityArchival.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |
| transferRelationships | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |

*Pending semantic verification*

### cluster-302: weightedRandom, weightedRandom
**Members:** 2 | **Avg Similarity:** 0.66 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| weightedRandom | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |
| weightedRandom | function | apps/lore-weave/lib/utils/randomUtils.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, semantic:1.00 |

*Pending semantic verification*

### cluster-303: applyDerivation, applyDerivation
**Members:** 2 | **Avg Similarity:** 0.66 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyDerivation | function | apps/name-forge/lib/derivation.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| applyDerivation | function | apps/name-forge/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-304: prepareMutation, prepareMutation
**Members:** 2 | **Avg Similarity:** 0.66 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| prepareMutation | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| prepareMutation | function | apps/lore-weave/lib/rules/mutations/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-305: CoverageMatrix, CoverageMatrix
**Members:** 2 | **Avg Similarity:** 0.65 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| CoverageMatrix | component | ...mponents/src/components/CoverageMatrix/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| CoverageMatrix | component | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-306: calculateActualTextCost, estimateTextCostForCall, calcTokenBudget
**Members:** 3 | **Avg Similarity:** 0.44 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| calculateActualTextCost | function | apps/illuminator/webui/src/lib/costEstimation.ts | behavior:1.00, consumerSet:1.00, neighborhood:1.00, coOccurrence:0.86 |
| estimateTextCostForCall | function | apps/illuminator/webui/src/lib/costEstimation.ts | behavior:1.00, consumerSet:1.00, neighborhood:1.00, coOccurrence:0.86 |
| calcTokenBudget | function | apps/illuminator/webui/src/lib/llmBudget.ts | behavior:1.00, consumerSet:1.00, neighborhood:1.00, coOccurrence:0.86 |

*Pending semantic verification*

### cluster-307: getProminenceMultiplierValue, getProminenceMultiplierValue
**Members:** 2 | **Avg Similarity:** 0.65 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getProminenceMultiplierValue | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| getProminenceMultiplierValue | function | apps/lore-weave/lib/rules/metrics/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-308: extractFirstJsonObject, extractFirstJsonObject
**Members:** 2 | **Avg Similarity:** 0.65 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| extractFirstJsonObject | function | apps/illuminator/webui/src/lib/jsonParsing.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| extractFirstJsonObject | function | ...uminator/webui/src/workers/tasks/textParsing.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-309: applySelectionFilters, applySelectionFilters
**Members:** 2 | **Avg Similarity:** 0.65 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applySelectionFilters | function | apps/lore-weave/lib/rules/filters/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| applySelectionFilters | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-310: prominenceIndex, prominenceIndex
**Members:** 2 | **Avg Similarity:** 0.65 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| prominenceIndex | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| prominenceIndex | function | apps/lore-weave/lib/rules/types.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-311: executeTask, executeTask
**Members:** 2 | **Avg Similarity:** 0.65 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| executeTask | function | ...illuminator/webui/src/workers/enrichmentCore.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| executeTask | function | apps/illuminator/webui/src/workers/tasks/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-312: evaluateMetric, evaluateMetric
**Members:** 2 | **Avg Similarity:** 0.64 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| evaluateMetric | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| evaluateMetric | function | apps/lore-weave/lib/rules/metrics/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-313: PlaneDiffusionVis, PlaneDiffusionVis
**Members:** 2 | **Avg Similarity:** 0.64 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| PlaneDiffusionVis | component | ...ponents/dashboard/systems/PlaneDiffusionVis.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| PlaneDiffusionVis | component | ...webui/src/components/dashboard/systems/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-314: LexemesTab, LexemesTab
**Members:** 2 | **Avg Similarity:** 0.64 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| LexemesTab | component | ...e-forge/webui/src/components/workspace/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| LexemesTab | component | ...ge/webui/src/components/workspace/tabs/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-315: computeDomainDiff, computeDomainDiff
**Members:** 2 | **Avg Similarity:** 0.63 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| computeDomainDiff | function | ...e/webui/src/components/optimizer/DomainDiff.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| computeDomainDiff | function | ...e-forge/webui/src/components/optimizer/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-316: findMatchingGenerators, findMatchingGenerators
**Members:** 2 | **Avg Similarity:** 0.63 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| findMatchingGenerators | function | .../src/components/workspace/tabs/profile/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| findMatchingGenerators | function | .../src/components/workspace/tabs/profile/utils.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-317: resolveVariablesForEntity, resolveVariablesForEntity
**Members:** 2 | **Avg Similarity:** 0.63 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| resolveVariablesForEntity | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| resolveVariablesForEntity | function | apps/lore-weave/lib/rules/selection/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-318: applyMutation, applyMutation
**Members:** 2 | **Avg Similarity:** 0.63 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyMutation | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| applyMutation | function | apps/lore-weave/lib/rules/mutations/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-319: buildCluster, buildRelationships, buildRelationships
**Members:** 3 | **Avg Similarity:** 0.42 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| buildCluster | function | apps/lore-weave/lib/graph/entityClusterBuilder.ts | behavior:1.00, neighborhood:1.00, typeSignature:0.85, semantic:0.72 |
| buildRelationships | function | apps/lore-weave/lib/graph/relationshipBuilder.ts | behavior:1.00, neighborhood:1.00, typeSignature:0.85, semantic:0.72 |
| buildRelationships | function | apps/lore-weave/lib/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:0.85, semantic:0.72 |

*Pending semantic verification*

### cluster-320: getCallTypesByCategory, getLLMModelSettings, getOverrideCount
**Members:** 3 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getCallTypesByCategory | function | apps/illuminator/webui/src/lib/llmCallTypes.ts | consumerSet:1.00, neighborhood:1.00, behavior:0.94, coOccurrence:0.92 |
| getLLMModelSettings | function | apps/illuminator/webui/src/lib/llmModelSettings.ts | consumerSet:1.00, neighborhood:1.00, behavior:0.94, coOccurrence:0.92 |
| getOverrideCount | function | apps/illuminator/webui/src/lib/llmModelSettings.ts | consumerSet:1.00, neighborhood:1.00, behavior:0.94, coOccurrence:0.92 |

*Pending semantic verification*

### cluster-321: ChronicleSeedViewer, ChronicleSeedViewer
**Members:** 2 | **Avg Similarity:** 0.62 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ChronicleSeedViewer | component | packages/shared-components/src/components/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |
| ChronicleSeedViewer | component | packages/shared-components/src/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, jsxStructure:1.00 |

*Pending semantic verification*

### cluster-322: SeedModal, SeedModal, SeedModal
**Members:** 3 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| SeedModal | component | ...mponents/src/components/ChronicleSeedViewer.jsx | behavior:1.00, jsxStructure:1.00, neighborhood:1.00, typeSignature:1.00 |
| SeedModal | component | packages/shared-components/src/components/index.js | behavior:1.00, jsxStructure:1.00, neighborhood:1.00, typeSignature:1.00 |
| SeedModal | component | packages/shared-components/src/index.js | behavior:1.00, jsxStructure:1.00, neighborhood:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-323: GrammarsTab, GrammarsTab
**Members:** 2 | **Avg Similarity:** 0.61 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| GrammarsTab | component | ...e-forge/webui/src/components/workspace/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| GrammarsTab | component | ...ge/webui/src/components/workspace/tabs/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-324: DomainTab, DomainTab
**Members:** 2 | **Avg Similarity:** 0.61 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| DomainTab | component | ...e-forge/webui/src/components/workspace/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| DomainTab | component | ...ge/webui/src/components/workspace/tabs/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-325: getTagValue, getTagValue, getTagValue
**Members:** 3 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getTagValue | function | apps/lore-weave/lib/index.ts | behavior:1.00, typeSignature:1.00, semantic:0.88, neighborhood:0.33 |
| getTagValue | function | apps/lore-weave/lib/utils/index.ts | behavior:1.00, typeSignature:1.00, semantic:0.88, neighborhood:0.33 |
| getTagValue | function | apps/lore-weave/lib/utils/tagUtils.ts | behavior:1.00, typeSignature:1.00, semantic:0.88, neighborhood:0.33 |

*Pending semantic verification*

### cluster-326: patchEntitiesFromHardState, patchNarrativeEvents, patchRelationships
**Members:** 3 | **Avg Similarity:** 0.40 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| patchEntitiesFromHardState | function | ...lluminator/webui/src/lib/db/entityRepository.ts | behavior:1.00, imports:0.71, typeSignature:0.70, semantic:0.48 |
| patchNarrativeEvents | function | ...illuminator/webui/src/lib/db/eventRepository.ts | behavior:1.00, imports:0.71, typeSignature:0.70, semantic:0.48 |
| patchRelationships | function | ...ator/webui/src/lib/db/relationshipRepository.ts | behavior:1.00, imports:0.71, typeSignature:0.70, semantic:0.48 |

*Pending semantic verification*

### cluster-327: GraphContagionVis, GraphContagionVis
**Members:** 2 | **Avg Similarity:** 0.60 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| GraphContagionVis | component | ...ponents/dashboard/systems/GraphContagionVis.jsx | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |
| GraphContagionVis | component | ...webui/src/components/dashboard/systems/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, hookProfile:1.00 |

*Pending semantic verification*

### cluster-328: getCreativeSystemPrompt, getCreativeSystemPrompt, getStyleLibrary
**Members:** 3 | **Avg Similarity:** 0.40 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getCreativeSystemPrompt | function | ...illuminator/webui/src/lib/chronicle/v2/index.ts | behavior:0.94, typeSignature:0.85, coOccurrence:0.50, consumerSet:0.50 |
| getCreativeSystemPrompt | function | ...tor/webui/src/lib/chronicle/v2/promptBuilder.ts | behavior:0.94, typeSignature:0.85, coOccurrence:0.50, consumerSet:0.50 |
| getStyleLibrary | function | ...illuminator/webui/src/lib/db/styleRepository.ts | behavior:0.94, typeSignature:0.85, coOccurrence:0.50, consumerSet:0.50 |

*Pending semantic verification*

### cluster-329: calculateAttemptChance, calculateAttemptChance
**Members:** 2 | **Avg Similarity:** 0.60 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| calculateAttemptChance | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| calculateAttemptChance | function | apps/lore-weave/lib/systems/catalystHelpers.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-330: default, default
**Members:** 2 | **Avg Similarity:** 0.60 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...ui/src/components/actions/tabs/VariablesTab.jsx | behavior:1.00, callSequence:1.00, imports:1.00, neighborhood:1.00 |
| default | function | ...src/components/generators/tabs/VariablesTab.jsx | behavior:1.00, callSequence:1.00, imports:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-331: clampProminence, clampProminence
**Members:** 2 | **Avg Similarity:** 0.59 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| clampProminence | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| clampProminence | function | apps/lore-weave/lib/rules/types.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-332: updateChronicleCoverImage, updateEraNarrativeCoverImage, updateEraNarrativeImageRefs
**Members:** 3 | **Avg Similarity:** 0.39 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| updateChronicleCoverImage | function | ...minator/webui/src/lib/db/chronicleRepository.ts | behavior:1.00, semantic:0.75, typeSignature:0.70, callSequence:0.30 |
| updateEraNarrativeCoverImage | function | ...ator/webui/src/lib/db/eraNarrativeRepository.ts | behavior:1.00, semantic:0.75, typeSignature:0.70, callSequence:0.30 |
| updateEraNarrativeImageRefs | function | ...ator/webui/src/lib/db/eraNarrativeRepository.ts | behavior:1.00, semantic:0.75, typeSignature:0.70, callSequence:0.30 |

*Pending semantic verification*

### cluster-333: computeRunIndexes, upsertRunIndexes, upsertSlot
**Members:** 3 | **Avg Similarity:** 0.39 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| computeRunIndexes | function | ...lluminator/webui/src/lib/db/indexComputation.ts | behavior:0.94, coOccurrence:0.68, consumerSet:0.62, imports:0.59 |
| upsertRunIndexes | function | ...illuminator/webui/src/lib/db/indexRepository.ts | behavior:0.94, coOccurrence:0.68, consumerSet:0.62, imports:0.59 |
| upsertSlot | function | .../illuminator/webui/src/lib/db/slotRepository.ts | behavior:0.94, coOccurrence:0.68, consumerSet:0.62, imports:0.59 |

*Pending semantic verification*

### cluster-334: calculateSignificance, calculateSignificance
**Members:** 2 | **Avg Similarity:** 0.59 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| calculateSignificance | function | apps/lore-weave/lib/narrative/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| calculateSignificance | function | ...e-weave/lib/narrative/significanceCalculator.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-335: createPlaneDiffusionSystem, createPlaneDiffusionSystem
**Members:** 2 | **Avg Similarity:** 0.57 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createPlaneDiffusionSystem | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| createPlaneDiffusionSystem | function | apps/lore-weave/lib/systems/planeDiffusion.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-336: getAgentsByCategory, getAgentsByCategory
**Members:** 2 | **Avg Similarity:** 0.57 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getAgentsByCategory | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| getAgentsByCategory | function | apps/lore-weave/lib/systems/catalystHelpers.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-337: useChronicleQueueWatcher, useEnrichmentQueue, useImageGenSettings
**Members:** 3 | **Avg Similarity:** 0.38 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| useChronicleQueueWatcher | hook | ...tor/webui/src/hooks/useChronicleQueueWatcher.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, hookProfile:0.89 |
| useEnrichmentQueue | hook | ...luminator/webui/src/hooks/useEnrichmentQueue.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, hookProfile:0.89 |
| useImageGenSettings | hook | ...uminator/webui/src/hooks/useImageGenSettings.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, hookProfile:0.89 |

*Pending semantic verification*

### cluster-338: computeProfileGeneratorUsage, computeProfileGeneratorUsage
**Members:** 2 | **Avg Similarity:** 0.55 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| computeProfileGeneratorUsage | function | .../src/components/workspace/tabs/profile/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| computeProfileGeneratorUsage | function | .../src/components/workspace/tabs/profile/utils.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-339: parseJsonValue, parseJsonValue
**Members:** 2 | **Avg Similarity:** 0.54 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| parseJsonValue | function | apps/illuminator/webui/src/lib/jsonParsing.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| parseJsonValue | function | ...uminator/webui/src/workers/tasks/textParsing.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-340: resolveSingleVariable, resolveSingleVariable
**Members:** 2 | **Avg Similarity:** 0.54 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| resolveSingleVariable | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| resolveSingleVariable | function | apps/lore-weave/lib/rules/selection/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-341: default, default
**Members:** 2 | **Avg Similarity:** 0.52 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | .../archivist/webui/src/components/GraphView3D.tsx | behavior:1.00, callSequence:1.00, neighborhood:1.00, imports:0.73 |
| default | function | ...chivist/webui/src/components/TimelineView3D.tsx | behavior:1.00, callSequence:1.00, neighborhood:1.00, imports:0.73 |

*Pending semantic verification*

### cluster-342: createTagDiffusionSystem, createTagDiffusionSystem
**Members:** 2 | **Avg Similarity:** 0.50 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createTagDiffusionSystem | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| createTagDiffusionSystem | function | apps/lore-weave/lib/systems/tagDiffusion.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-343: formatValidationForExport, formatValidationForExport
**Members:** 2 | **Avg Similarity:** 0.49 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| formatValidationForExport | function | .../components/validation/utils/exportFunctions.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |
| formatValidationForExport | function | .../webui/src/components/validation/utils/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, neighborhood:1.00 |

*Pending semantic verification*

### cluster-344: createGrowthSystem, createGrowthSystem
**Members:** 2 | **Avg Similarity:** 0.49 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createGrowthSystem | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| createGrowthSystem | function | apps/lore-weave/lib/systems/growthSystem.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-345: createThresholdTriggerSystem, createThresholdTriggerSystem
**Members:** 2 | **Avg Similarity:** 0.49 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createThresholdTriggerSystem | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| createThresholdTriggerSystem | function | apps/lore-weave/lib/systems/thresholdTrigger.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-346: useEntityCrud, useHistorianActions
**Members:** 2 | **Avg Similarity:** 0.49 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| useEntityCrud | hook | apps/illuminator/webui/src/hooks/useEntityCrud.ts | behavior:1.00, consumerSet:1.00, neighborhood:1.00, hookProfile:0.98 |
| useHistorianActions | hook | ...uminator/webui/src/hooks/useHistorianActions.ts | behavior:1.00, consumerSet:1.00, neighborhood:1.00, hookProfile:0.98 |

*Pending semantic verification*

### cluster-347: runValidations, runValidations
**Members:** 2 | **Avg Similarity:** 0.49 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| runValidations | function | .../webui/src/components/validation/utils/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| runValidations | function | .../components/validation/utils/validationRules.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-348: IndexedDBBackend, IndexedDBBackend
**Members:** 2 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| IndexedDBBackend | class | packages/image-store/src/backends/indexeddb.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| IndexedDBBackend | class | packages/image-store/src/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-349: CDNBackend, CDNBackend
**Members:** 2 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| CDNBackend | class | packages/image-store/src/backends/cdn.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| CDNBackend | class | packages/image-store/src/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-350: WorldEngine, WorldEngine
**Members:** 2 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| WorldEngine | class | apps/lore-weave/lib/engine/worldEngine.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| WorldEngine | class | apps/lore-weave/lib/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-351: CulturalAwarenessAnalyzer, CulturalAwarenessAnalyzer
**Members:** 2 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| CulturalAwarenessAnalyzer | class | apps/lore-weave/lib/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| CulturalAwarenessAnalyzer | class | ...ave/lib/statistics/culturalAwarenessAnalyzer.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-352: isHistoricalEntity, isHistoricalEntity
**Members:** 2 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| isHistoricalEntity | function | apps/lore-weave/lib/graph/entityArchival.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| isHistoricalEntity | function | apps/lore-weave/lib/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-353: EntityClusterBuilder, EntityClusterBuilder
**Members:** 2 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| EntityClusterBuilder | class | apps/lore-weave/lib/graph/entityClusterBuilder.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| EntityClusterBuilder | class | apps/lore-weave/lib/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-354: createCoordinateContext, createCoordinateContext
**Members:** 2 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createCoordinateContext | function | ...lore-weave/lib/coordinates/coordinateContext.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| createCoordinateContext | function | apps/lore-weave/lib/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-355: NarrativeEventBuilder, NarrativeEventBuilder
**Members:** 2 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| NarrativeEventBuilder | class | apps/lore-weave/lib/narrative/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| NarrativeEventBuilder | class | ...re-weave/lib/narrative/narrativeEventBuilder.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-356: getFrameworkRelationshipStrength, getFrameworkRelationshipStrength
**Members:** 2 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getFrameworkRelationshipStrength | function | packages/world-schema/src/frameworkPrimitives.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| getFrameworkRelationshipStrength | function | packages/world-schema/src/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-357: createDefaultStyleLibrary, createDefaultStyleLibrary
**Members:** 2 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createDefaultStyleLibrary | function | packages/world-schema/src/index.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |
| createDefaultStyleLibrary | function | packages/world-schema/src/style.ts | behavior:1.00, neighborhood:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-358: StoryScoreBar, StoryScoreBar
**Members:** 2 | **Avg Similarity:** 0.47 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| StoryScoreBar | component | ...leWizard/visualizations/StoryPotentialRadar.tsx | behavior:1.00, jsxStructure:1.00, semantic:1.00, typeSignature:1.00 |
| StoryScoreBar | component | ...ponents/ChronicleWizard/visualizations/index.ts | behavior:1.00, jsxStructure:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-359: TargetingTab, TargetingTab
**Members:** 2 | **Avg Similarity:** 0.47 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| TargetingTab | component | ...ui/src/components/actions/tabs/TargetingTab.jsx | behavior:1.00, jsxStructure:1.00, semantic:1.00, typeSignature:1.00 |
| TargetingTab | component | ...gine/webui/src/components/actions/tabs/index.js | behavior:1.00, jsxStructure:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-360: BasicInfoSection, BasicInfoSection
**Members:** 2 | **Avg Similarity:** 0.47 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| BasicInfoSection | component | ...c/components/eras/sections/BasicInfoSection.jsx | behavior:1.00, jsxStructure:1.00, semantic:1.00, typeSignature:1.00 |
| BasicInfoSection | component | ...ine/webui/src/components/eras/sections/index.js | behavior:1.00, jsxStructure:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-361: TransitionConditionEditor, TransitionConditionEditor
**Members:** 2 | **Avg Similarity:** 0.47 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| TransitionConditionEditor | component | ...nents/eras/shared/TransitionConditionEditor.jsx | behavior:1.00, jsxStructure:1.00, semantic:1.00, typeSignature:1.00 |
| TransitionConditionEditor | component | ...ngine/webui/src/components/eras/shared/index.js | behavior:1.00, jsxStructure:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-362: FrameworkSystemTab, FrameworkSystemTab
**Members:** 2 | **Avg Similarity:** 0.47 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| FrameworkSystemTab | component | .../components/systems/tabs/FrameworkSystemTab.jsx | behavior:1.00, jsxStructure:1.00, semantic:1.00, typeSignature:1.00 |
| FrameworkSystemTab | component | ...gine/webui/src/components/systems/tabs/index.js | behavior:1.00, jsxStructure:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-363: initializeCatalystSmart, initializeCatalystSmart
**Members:** 2 | **Avg Similarity:** 0.47 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| initializeCatalystSmart | function | apps/lore-weave/lib/index.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| initializeCatalystSmart | function | apps/lore-weave/lib/systems/catalystHelpers.ts | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-364: exportAsJson, exportAsJson
**Members:** 2 | **Avg Similarity:** 0.47 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| exportAsJson | function | .../components/validation/utils/exportFunctions.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| exportAsJson | function | .../webui/src/components/validation/utils/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-365: createDefaultNarrativeConfig, createDefaultNarrativeConfig
**Members:** 2 | **Avg Similarity:** 0.47 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createDefaultNarrativeConfig | function | apps/lore-weave/lib/narrative/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.96 |
| createDefaultNarrativeConfig | function | .../lore-weave/lib/narrative/stateChangeTracker.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.96 |

*Pending semantic verification*

### cluster-366: extractCognitoTokensFromUrl, useProjectStorage
**Members:** 2 | **Avg Similarity:** 0.38 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| extractCognitoTokensFromUrl | function | apps/canonry/webui/src/aws/cognitoAuth.js | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, typeSignature:0.70 |
| useProjectStorage | hook | .../canonry/webui/src/storage/useProjectStorage.js | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95, typeSignature:0.70 |

*Pending semantic verification*

### cluster-367: exportAsCsv, exportAsCsv
**Members:** 2 | **Avg Similarity:** 0.46 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| exportAsCsv | function | .../components/validation/utils/exportFunctions.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| exportAsCsv | function | .../webui/src/components/validation/utils/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-368: default, default
**Members:** 2 | **Avg Similarity:** 0.45 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | .../workspace/tabs/profile/StrategyGroupEditor.jsx | behavior:1.00, callSequence:1.00, neighborhood:1.00, typeSignature:0.70 |
| default | function | .../workspace/tabs/profile/tabs/SingleGroupTab.jsx | behavior:1.00, callSequence:1.00, neighborhood:1.00, typeSignature:0.70 |

*Pending semantic verification*

### cluster-369: findMatchingProfile, findMatchingProfile
**Members:** 2 | **Avg Similarity:** 0.45 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| findMatchingProfile | function | ...ing-profile-viewer/utils/findMatchingProfile.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| findMatchingProfile | function | ...components/naming-profile-viewer/utils/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-370: ParchmentTexture, useBreakpoint
**Members:** 2 | **Avg Similarity:** 0.38 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ParchmentTexture | component | apps/chronicler/webui/src/components/Ornaments.tsx | consumerSet:1.00, neighborhood:1.00, hookProfile:0.98, coOccurrence:0.95 |
| useBreakpoint | hook | apps/chronicler/webui/src/hooks/useBreakpoint.ts | consumerSet:1.00, neighborhood:1.00, hookProfile:0.98, coOccurrence:0.95 |

*Pending semantic verification*

### cluster-371: useEraNarrative, useHistorianChronology
**Members:** 2 | **Avg Similarity:** 0.44 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| useEraNarrative | hook | .../illuminator/webui/src/hooks/useEraNarrative.ts | behavior:1.00, hookProfile:0.99, typeSignature:0.70, semantic:0.67 |
| useHistorianChronology | hook | ...nator/webui/src/hooks/useHistorianChronology.ts | behavior:1.00, hookProfile:0.99, typeSignature:0.70, semantic:0.67 |

*Pending semantic verification*

### cluster-372: useNarrativeEvents, useRelationships
**Members:** 2 | **Avg Similarity:** 0.44 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| useNarrativeEvents | hook | ...tor/webui/src/lib/db/narrativeEventSelectors.ts | behavior:1.00, consumerSet:1.00, neighborhood:1.00, coOccurrence:0.87 |
| useRelationships | hook | ...nator/webui/src/lib/db/relationshipSelectors.ts | behavior:1.00, consumerSet:1.00, neighborhood:1.00, coOccurrence:0.87 |

*Pending semantic verification*

### cluster-373: analyzeNamingMappings, analyzeNamingMappings
**Members:** 2 | **Avg Similarity:** 0.44 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| analyzeNamingMappings | function | ...g-profile-viewer/utils/analyzeNamingMappings.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |
| analyzeNamingMappings | function | ...components/naming-profile-viewer/utils/index.js | behavior:1.00, callSequence:1.00, calleeSet:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-374: compareProminence, compareProminence
**Members:** 2 | **Avg Similarity:** 0.44 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| compareProminence | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.84 |
| compareProminence | function | apps/lore-weave/lib/rules/types.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.84 |

*Pending semantic verification*

### cluster-375: deleteChroniclesForSimulation, deleteStaticPagesForProject
**Members:** 2 | **Avg Similarity:** 0.43 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| deleteChroniclesForSimulation | function | ...minator/webui/src/lib/db/chronicleRepository.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.64 |
| deleteStaticPagesForProject | function | ...inator/webui/src/lib/db/staticPageRepository.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.64 |

*Pending semantic verification*

### cluster-376: createActionContext, createActionContext
**Members:** 2 | **Avg Similarity:** 0.43 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createActionContext | function | apps/lore-weave/lib/rules/context.ts | behavior:1.00, semantic:1.00, typeSignature:1.00, coOccurrence:0.16 |
| createActionContext | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, semantic:1.00, typeSignature:1.00, coOccurrence:0.16 |

*Pending semantic verification*

### cluster-377: StrategyGroupEditor, SingleGroupTab
**Members:** 2 | **Avg Similarity:** 0.43 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| StrategyGroupEditor | component | .../src/components/workspace/tabs/profile/index.js | behavior:1.00, callSequence:1.00, typeSignature:0.70, semantic:0.63 |
| SingleGroupTab | component | ...components/workspace/tabs/profile/tabs/index.js | behavior:1.00, callSequence:1.00, typeSignature:0.70, semantic:0.63 |

*Pending semantic verification*

### cluster-378: default, default
**Members:** 2 | **Avg Similarity:** 0.42 | **Spread:** 1 directories
**Dominant Signal:** imports

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...i/src/components/shared/SelectionRuleEditor.jsx | imports:1.00, neighborhood:1.00, behavior:0.88, typeSignature:0.70 |
| default | function | ...c/components/shared/VariableSelectionEditor.jsx | imports:1.00, neighborhood:1.00, behavior:0.88, typeSignature:0.70 |

*Pending semantic verification*

### cluster-379: default, default
**Members:** 2 | **Avg Similarity:** 0.42 | **Spread:** 1 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...components/workspace/tabs/profile/TestPanel.jsx | neighborhood:1.00, behavior:0.88, typeSignature:0.70, calleeSet:0.63 |
| default | function | ...ponents/workspace/tabs/profile/tabs/TestTab.jsx | neighborhood:1.00, behavior:0.88, typeSignature:0.70, calleeSet:0.63 |

*Pending semantic verification*

### cluster-380: isDeclarativeSystem, isDeclarativeSystem
**Members:** 2 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| isDeclarativeSystem | function | apps/lore-weave/lib/engine/systemInterpreter.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |
| isDeclarativeSystem | function | apps/lore-weave/lib/index.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-381: TemplateInterpreter, TemplateInterpreter
**Members:** 2 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| TemplateInterpreter | class | apps/lore-weave/lib/engine/templateInterpreter.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |
| TemplateInterpreter | class | apps/lore-weave/lib/index.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-382: NameForgeService, NameForgeService
**Members:** 2 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| NameForgeService | class | apps/lore-weave/lib/index.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |
| NameForgeService | class | apps/lore-weave/lib/naming/nameForgeService.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-383: GraphStore, GraphStore
**Members:** 2 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| GraphStore | class | apps/lore-weave/lib/engine/types.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |
| GraphStore | class | apps/lore-weave/lib/index.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-384: DynamicWeightCalculator, DynamicWeightCalculator
**Members:** 2 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| DynamicWeightCalculator | class | ...-weave/lib/selection/dynamicWeightCalculator.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |
| DynamicWeightCalculator | class | apps/lore-weave/lib/selection/index.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-385: WorldRuntime, WorldRuntime
**Members:** 2 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| WorldRuntime | class | apps/lore-weave/lib/index.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |
| WorldRuntime | class | apps/lore-weave/lib/runtime/worldRuntime.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-386: createRuleContext, createRuleContext
**Members:** 2 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createRuleContext | function | apps/lore-weave/lib/rules/context.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |
| createRuleContext | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-387: createSystemContext, createSystemContext
**Members:** 2 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createSystemContext | function | apps/lore-weave/lib/rules/context.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |
| createSystemContext | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-388: withSelf, withSelf
**Members:** 2 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| withSelf | function | apps/lore-weave/lib/rules/context.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |
| withSelf | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-389: ActionEntityResolver, ActionEntityResolver
**Members:** 2 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ActionEntityResolver | class | apps/lore-weave/lib/rules/index.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |
| ActionEntityResolver | class | apps/lore-weave/lib/rules/resolver.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-390: SimpleEntityResolver, SimpleEntityResolver
**Members:** 2 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| SimpleEntityResolver | class | apps/lore-weave/lib/rules/index.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |
| SimpleEntityResolver | class | apps/lore-weave/lib/rules/resolver.ts | behavior:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-391: getOverallStatus, getOverallStatus
**Members:** 2 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| getOverallStatus | function | .../webui/src/components/validation/utils/index.js | behavior:1.00, semantic:1.00, typeSignature:1.00 |
| getOverallStatus | function | .../components/validation/utils/validationRules.js | behavior:1.00, semantic:1.00, typeSignature:1.00 |

*Pending semantic verification*

### cluster-392: applyOperator, applyOperator
**Members:** 2 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyOperator | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, typeSignature:1.00, semantic:0.96, coOccurrence:0.05 |
| applyOperator | function | apps/lore-weave/lib/rules/types.ts | behavior:1.00, typeSignature:1.00, semantic:0.96, coOccurrence:0.05 |

*Pending semantic verification*

### cluster-393: canPerformAction, canPerformAction
**Members:** 2 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| canPerformAction | function | apps/lore-weave/lib/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.73 |
| canPerformAction | function | apps/lore-weave/lib/systems/catalystHelpers.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.73 |

*Pending semantic verification*

### cluster-394: repairFactCoverageWasFaceted, exportImagePrompts
**Members:** 2 | **Avg Similarity:** 0.40 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| repairFactCoverageWasFaceted | function | ...minator/webui/src/lib/db/chronicleRepository.ts | behavior:1.00, consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95 |
| exportImagePrompts | function | ...illuminator/webui/src/lib/db/imageRepository.ts | behavior:1.00, consumerSet:1.00, neighborhood:1.00, coOccurrence:0.95 |

*Pending semantic verification*

### cluster-395: LLMClient, LLMClient
**Members:** 2 | **Avg Similarity:** 0.39 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| LLMClient | class | .../illuminator/webui/src/lib/llmClient.browser.ts | behavior:1.00, typeSignature:1.00, semantic:0.92 |
| LLMClient | class | apps/illuminator/webui/src/lib/llmClient.ts | behavior:1.00, typeSignature:1.00, semantic:0.92 |

*Pending semantic verification*

### cluster-396: default, default
**Members:** 2 | **Avg Similarity:** 0.39 | **Spread:** 1 directories
**Dominant Signal:** callSequence

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...s/generators/filters/SelectionFiltersEditor.jsx | callSequence:1.00, neighborhood:1.00, behavior:0.88, typeSignature:0.70 |
| default | function | ...i/src/components/generators/tabs/EffectsTab.jsx | callSequence:1.00, neighborhood:1.00, behavior:0.88, typeSignature:0.70 |

*Pending semantic verification*

### cluster-397: recordCatalyst, recordCatalyst
**Members:** 2 | **Avg Similarity:** 0.39 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| recordCatalyst | function | apps/lore-weave/lib/index.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.64 |
| recordCatalyst | function | apps/lore-weave/lib/systems/catalystHelpers.ts | behavior:1.00, neighborhood:1.00, typeSignature:1.00, semantic:0.64 |

*Pending semantic verification*

### cluster-398: default, default
**Members:** 2 | **Avg Similarity:** 0.38 | **Spread:** 1 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...s/ChronicleWizard/steps/EventResolutionStep.tsx | neighborhood:1.00, typeSignature:1.00, behavior:0.88, imports:0.71 |
| default | function | ...ts/ChronicleWizard/steps/RoleAssignmentStep.tsx | neighborhood:1.00, typeSignature:1.00, behavior:0.88, imports:0.71 |

*Pending semantic verification*

### cluster-399: prominenceThreshold, prominenceThreshold
**Members:** 2 | **Avg Similarity:** 0.38 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| prominenceThreshold | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, typeSignature:1.00, semantic:0.83, coOccurrence:0.11 |
| prominenceThreshold | function | apps/lore-weave/lib/rules/types.ts | behavior:1.00, typeSignature:1.00, semantic:0.83, coOccurrence:0.11 |

*Pending semantic verification*

### cluster-400: default, default
**Members:** 2 | **Avg Similarity:** 0.38 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...rc/components/SchemaEditor/EntityKindEditor.jsx | behavior:1.00, neighborhood:1.00, typeSignature:0.70, imports:0.56 |
| default | function | ...ponents/SchemaEditor/RelationshipKindEditor.jsx | behavior:1.00, neighborhood:1.00, typeSignature:0.70, imports:0.56 |

*Pending semantic verification*

### cluster-401: buildNavItem, deleteChronicle
**Members:** 2 | **Avg Similarity:** 0.38 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| buildNavItem | function | apps/illuminator/webui/src/lib/db/chronicleNav.ts | consumerSet:1.00, neighborhood:1.00, behavior:0.88, coOccurrence:0.86 |
| deleteChronicle | function | ...minator/webui/src/lib/db/chronicleRepository.ts | consumerSet:1.00, neighborhood:1.00, behavior:0.88, coOccurrence:0.86 |

*Pending semantic verification*

### cluster-402: applyRevisionPatches, applyEventPatches
**Members:** 2 | **Avg Similarity:** 0.38 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| applyRevisionPatches | function | ...lluminator/webui/src/lib/db/entityRepository.ts | behavior:0.88, imports:0.85, typeSignature:0.70, coOccurrence:0.60 |
| applyEventPatches | function | ...illuminator/webui/src/lib/db/eventRepository.ts | behavior:0.88, imports:0.85, typeSignature:0.70, coOccurrence:0.60 |

*Pending semantic verification*

### cluster-403: default, default
**Members:** 2 | **Avg Similarity:** 0.37 | **Spread:** 1 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...ebui/src/components/DynamicsGenerationModal.jsx | neighborhood:1.00, behavior:0.88, typeSignature:0.70, semantic:0.65 |
| default | function | ...r/webui/src/components/HistorianReviewModal.jsx | neighborhood:1.00, behavior:0.88, typeSignature:0.70, semantic:0.65 |

*Pending semantic verification*

### cluster-404: SelectionRuleEditor, VariableSelectionEditor
**Members:** 2 | **Avg Similarity:** 0.37 | **Spread:** 1 directories
**Dominant Signal:** imports

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| SelectionRuleEditor | component | ...i/src/components/shared/SelectionRuleEditor.jsx | imports:1.00, behavior:0.88, typeSignature:0.70, coOccurrence:0.67 |
| VariableSelectionEditor | component | ...c/components/shared/VariableSelectionEditor.jsx | imports:1.00, behavior:0.88, typeSignature:0.70, coOccurrence:0.67 |

*Pending semantic verification*

### cluster-405: estimateImageCost, saveImage
**Members:** 2 | **Avg Similarity:** 0.37 | **Spread:** 1 directories
**Dominant Signal:** consumerSet

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| estimateImageCost | function | apps/illuminator/webui/src/lib/costEstimation.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.91, behavior:0.88 |
| saveImage | function | ...illuminator/webui/src/lib/db/imageRepository.ts | consumerSet:1.00, neighborhood:1.00, coOccurrence:0.91, behavior:0.88 |

*Pending semantic verification*

### cluster-406: default, default
**Members:** 2 | **Avg Similarity:** 0.37 | **Spread:** 1 directories
**Dominant Signal:** imports

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...d-components/src/components/CategorySection.jsx | imports:1.00, neighborhood:1.00, behavior:0.88, calleeSet:0.54 |
| default | function | ...red-components/src/components/SectionHeader.jsx | imports:1.00, neighborhood:1.00, behavior:0.88, calleeSet:0.54 |

*Pending semantic verification*

### cluster-407: noteDisplay, flattenForExport
**Members:** 2 | **Avg Similarity:** 0.36 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| noteDisplay | function | apps/illuminator/webui/src/lib/historianTypes.ts | behavior:1.00, consumerSet:1.00, neighborhood:1.00, coOccurrence:0.91 |
| flattenForExport | function | ...luminator/webui/src/lib/preprint/contentTree.ts | behavior:1.00, consumerSet:1.00, neighborhood:1.00, coOccurrence:0.91 |

*Pending semantic verification*

### cluster-408: default, default
**Members:** 2 | **Avg Similarity:** 0.36 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...ator/webui/src/components/CorpusFindReplace.tsx | behavior:1.00, callSequence:1.00, neighborhood:1.00, imports:0.63 |
| default | function | ...webui/src/components/DescriptionMotifWeaver.tsx | behavior:1.00, callSequence:1.00, neighborhood:1.00, imports:0.63 |

*Pending semantic verification*

### cluster-409: analyzeBehavior, analyzeJsx
**Members:** 2 | **Avg Similarity:** 0.36 | **Spread:** 1 directories
**Dominant Signal:** imports

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| analyzeBehavior | function | ...drift-semantic/extractor/src/behaviorMarkers.ts | imports:1.00, neighborhood:1.00, behavior:0.88, typeSignature:0.70 |
| analyzeJsx | function | tools/drift-semantic/extractor/src/jsxAnalyzer.ts | imports:1.00, neighborhood:1.00, behavior:0.88, typeSignature:0.70 |

*Pending semantic verification*

### cluster-410: createEraNarrative, createHistorianRun
**Members:** 2 | **Avg Similarity:** 0.36 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| createEraNarrative | function | ...ator/webui/src/lib/db/eraNarrativeRepository.ts | behavior:1.00, semantic:0.81, typeSignature:0.40, imports:0.37 |
| createHistorianRun | function | ...minator/webui/src/lib/db/historianRepository.ts | behavior:1.00, semantic:0.81, typeSignature:0.40, imports:0.37 |

*Pending semantic verification*

### cluster-411: CopyGrammarModal, CopyLexemeModal
**Members:** 2 | **Avg Similarity:** 0.35 | **Spread:** 1 directories
**Dominant Signal:** hookProfile

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| CopyGrammarModal | component | .../components/workspace/tabs/CopyGrammarModal.jsx | hookProfile:0.99, behavior:0.88, semantic:0.64, imports:0.59 |
| CopyLexemeModal | component | ...c/components/workspace/tabs/CopyLexemeModal.jsx | hookProfile:0.99, behavior:0.88, semantic:0.64, imports:0.59 |

*Pending semantic verification*

### cluster-412: normalizeOperator, normalizeOperator
**Members:** 2 | **Avg Similarity:** 0.35 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| normalizeOperator | function | apps/lore-weave/lib/rules/index.ts | behavior:1.00, typeSignature:1.00, semantic:0.75 |
| normalizeOperator | function | apps/lore-weave/lib/rules/types.ts | behavior:1.00, typeSignature:1.00, semantic:0.75 |

*Pending semantic verification*

### cluster-413: ImageClient, ImageGenerationClient
**Members:** 2 | **Avg Similarity:** 0.35 | **Spread:** 1 directories
**Dominant Signal:** behavior

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| ImageClient | class | apps/illuminator/webui/src/lib/imageClient.ts | behavior:1.00, typeSignature:1.00, semantic:0.75 |
| ImageGenerationClient | class | .../illuminator/webui/src/lib/llmClient.browser.ts | behavior:1.00, typeSignature:1.00, semantic:0.75 |

*Pending semantic verification*

### cluster-414: default, default
**Members:** 2 | **Avg Similarity:** 0.35 | **Spread:** 1 directories
**Dominant Signal:** neighborhood

| Unit | Kind | File | Key Signals |
|------|------|------|-------------|
| default | function | ...her/webui/src/components/EntityEditor/index.jsx | neighborhood:1.00, behavior:0.88, typeSignature:0.70, semantic:0.41 |
| default | function | ...bui/src/components/RelationshipEditor/index.jsx | neighborhood:1.00, behavior:0.88, typeSignature:0.70, semantic:0.41 |

*Pending semantic verification*


## CSS Style Duplication

Found 25 clusters of similar CSS files.

### css-cluster-001: BulkBackportModal.css, BulkEraNarrativeModal.css, BulkHistorianModal.css, BulkOperationShell.css, +19 more
**Files:** 23 | **Avg Similarity:** 0.44 | **Spread:** 2 directories
**Top Signals:** categoryProfile:0.98, propertyFrequency:0.93, customPropertyVocab:0.67

| File | Linked Components |
|------|-------------------|
| ...ator/webui/src/components/BulkBackportModal.css | |
| .../webui/src/components/BulkEraNarrativeModal.css | |
| ...tor/webui/src/components/BulkHistorianModal.css | |
| ...tor/webui/src/components/BulkOperationShell.css | |
| ...minator/webui/src/components/ChroniclePanel.css | |
| ...or/webui/src/components/ChroniclePlanEditor.css | |
| ...icleWizard/visualizations/NarrativeTimeline.css | |
| ...inator/webui/src/components/ChronologyModal.css | |
| ...ator/webui/src/components/CreateEntityModal.css | |
| ...ebui/src/components/DynamicsGenerationModal.css | |
| ...ator/webui/src/components/EntityRenameModal.css | |
| ...ator/webui/src/components/EraNarrativeModal.css | |
| ...tor/webui/src/components/EraNarrativeViewer.css | |
| .../webui/src/components/HistorianConfigEditor.css | |
| ...r/webui/src/components/HistorianReviewModal.css | |
| ...c/components/HistoryCompressionPreviewModal.css | |
| ...i/src/components/InterleavedAnnotationModal.css | |
| ...inator/webui/src/components/QuickCheckModal.css | |
| ...r/webui/src/components/SummaryRevisionModal.css | |
| ...minator/webui/src/components/ThinkingViewer.css | |
| ...i/src/components/ToneAssignmentPreviewModal.css | |
| ...ents/chronicle-workspace/ChronicleWorkspace.css | |
| ...mponents/src/components/ChronicleSeedViewer.css | |

**Linked Components:** apps/illuminator/webui/src/components/BulkBackportModal.jsx::default, apps/illuminator/webui/src/components/BulkEraNarrativeModal.jsx::default, apps/illuminator/webui/src/components/BulkHistorianModal.jsx::default, apps/illuminator/webui/src/components/BulkOperationShell.jsx::BulkCost, apps/illuminator/webui/src/components/BulkOperationShell.jsx::BulkFailedList, apps/illuminator/webui/src/components/BulkOperationShell.jsx::BulkProgressBar, apps/illuminator/webui/src/components/BulkOperationShell.jsx::BulkTerminalMessage, apps/illuminator/webui/src/components/BulkOperationShell.jsx::default, apps/illuminator/webui/src/components/ChroniclePanel.jsx::default, apps/illuminator/webui/src/components/ChroniclePlanEditor.jsx::default
  ...and 19 more

**Shared Custom Properties:** `--border-color, --text-muted`

### css-cluster-002: ActivityPanel.css, BackportConfigModal.css, ChronicleImagePanel.css, ChronicleReviewPanel.css, +16 more
**Files:** 20 | **Avg Similarity:** 0.44 | **Spread:** 1 directories
**Top Signals:** categoryProfile:0.98, propertyFrequency:0.91, customPropertyVocab:0.66

| File | Linked Components |
|------|-------------------|
| ...uminator/webui/src/components/ActivityPanel.css | |
| ...or/webui/src/components/BackportConfigModal.css | |
| ...or/webui/src/components/ChronicleImagePanel.css | |
| ...r/webui/src/components/ChronicleReviewPanel.css | |
| ...r/webui/src/components/CohesionReportViewer.css | |
| ...ator/webui/src/components/CorpusFindReplace.css | |
| ...tor/webui/src/components/CoverImageControls.css | |
| ...webui/src/components/DescriptionMotifWeaver.css | |
| ...or/webui/src/components/EntityCoveragePanel.css | |
| ...lluminator/webui/src/components/EventsPanel.css | |
| ...r/webui/src/components/HistorianMarginNotes.css | |
| ...uminator/webui/src/components/ProgressPanel.css | |
| ...or/webui/src/components/RevisionFilterModal.css | |
| ...c/components/chronicle-workspace/ContentTab.css | |
| ...omponents/chronicle-workspace/EnrichmentTab.css | |
| ...components/chronicle-workspace/HistorianTab.css | |
| ...rc/components/chronicle-workspace/ImagesTab.css | |
| .../components/chronicle-workspace/PipelineTab.css | |
| ...components/chronicle-workspace/ReferenceTab.css | |
| .../components/chronicle-workspace/VersionsTab.css | |

**Linked Components:** apps/illuminator/webui/src/components/ActivityPanel.jsx::default, apps/illuminator/webui/src/components/BackportConfigModal.jsx::default, apps/illuminator/webui/src/components/ChronicleImagePanel.tsx::default, apps/illuminator/webui/src/components/ChronicleReviewPanel.jsx::default, apps/illuminator/webui/src/components/CohesionReportViewer.jsx::default, apps/illuminator/webui/src/components/CorpusFindReplace.tsx::default, apps/illuminator/webui/src/components/CoverImageControls.jsx::CoverImageControls, apps/illuminator/webui/src/components/CoverImageControls.jsx::CoverImagePreview, apps/illuminator/webui/src/components/DescriptionMotifWeaver.tsx::default, apps/illuminator/webui/src/components/EntityCoveragePanel.jsx::default
  ...and 11 more

**Shared Custom Properties:** `--text-muted`

### css-cluster-003: BackrefImageEditor.css, ChronicleImagePicker.css, EntryPointStep.css, EventResolutionStep.css, +13 more
**Files:** 17 | **Avg Similarity:** 0.43 | **Spread:** 1 directories
**Top Signals:** categoryProfile:0.97, propertyFrequency:0.92, customPropertyVocab:0.61

| File | Linked Components |
|------|-------------------|
| ...tor/webui/src/components/BackrefImageEditor.css | |
| ...r/webui/src/components/ChronicleImagePicker.css | |
| ...onents/ChronicleWizard/steps/EntryPointStep.css | |
| ...s/ChronicleWizard/steps/EventResolutionStep.css | |
| ...mponents/ChronicleWizard/steps/GenerateStep.css | |
| ...ts/ChronicleWizard/steps/RoleAssignmentStep.css | |
| .../components/ChronicleWizard/steps/StyleStep.css | |
| ...inator/webui/src/components/EnrichmentQueue.css | |
| ...uminator/webui/src/components/EntityBrowser.css | |
| ...nator/webui/src/components/EntityDetailView.css | |
| ...nator/webui/src/components/ImagePickerModal.css | |
| ...or/webui/src/components/ImageSettingsDrawer.css | |
| ...luminator/webui/src/components/ResultsPanel.css | |
| ...luminator/webui/src/components/StoragePanel.css | |
| ...tor/webui/src/components/StyleLibraryEditor.css | |
| ...or/webui/src/components/TraitPaletteSection.css | |
| ...tor/webui/src/components/WorldContextEditor.css | |

**Linked Components:** apps/illuminator/webui/src/components/BackrefImageEditor.jsx::default, apps/illuminator/webui/src/components/ChronicleImagePicker.jsx::default, apps/illuminator/webui/src/components/ChronicleWizard/steps/EntryPointStep.tsx::default, apps/illuminator/webui/src/components/ChronicleWizard/steps/EventResolutionStep.tsx::default, apps/illuminator/webui/src/components/ChronicleWizard/steps/GenerateStep.tsx::default, apps/illuminator/webui/src/components/ChronicleWizard/steps/RoleAssignmentStep.tsx::default, apps/illuminator/webui/src/components/ChronicleWizard/steps/StyleStep.tsx::default, apps/illuminator/webui/src/components/EnrichmentQueue.jsx::default, apps/illuminator/webui/src/components/EntityBrowser.jsx::default, apps/illuminator/webui/src/components/EntityDetailView.tsx::default
  ...and 9 more

**Shared Custom Properties:** `--text-muted`

### css-cluster-004: dependency-viewer.css, naming-profile-viewer.css, validation.css, card.css, +3 more
**Files:** 7 | **Avg Similarity:** 0.46 | **Spread:** 2 directories
**Top Signals:** categoryProfile:0.97, propertyFrequency:0.93, customPropertyVocab:0.65

| File | Linked Components |
|------|-------------------|
| ...ponents/dependency-viewer/dependency-viewer.css | |
| ...naming-profile-viewer/naming-profile-viewer.css | |
| .../webui/src/components/validation/validation.css | |
| ...nce-engine/webui/src/styles/components/card.css | |
| ...e-engine/webui/src/styles/components/editor.css | |
| ...hared-components/src/styles/components/card.css | |
| ...red-components/src/styles/components/editor.css | |

**Linked Components:** apps/coherence-engine/webui/src/components/dependency-viewer/DependencyViewer.jsx::DependencyViewer, apps/coherence-engine/webui/src/components/dependency-viewer/DependencyViewer.jsx::default, apps/coherence-engine/webui/src/components/dependency-viewer/components/DependencySection.jsx::DependencySection, apps/coherence-engine/webui/src/components/naming-profile-viewer/NamingProfileMappingViewer.jsx::NamingProfileMappingViewer, apps/coherence-engine/webui/src/components/naming-profile-viewer/NamingProfileMappingViewer.jsx::default, apps/coherence-engine/webui/src/components/validation/ValidationEditor.jsx::ValidationEditor, apps/coherence-engine/webui/src/components/validation/ValidationEditor.jsx::default, apps/coherence-engine/webui/src/components/validation/ValidationEditor.jsx::getValidationStatus, apps/coherence-engine/webui/src/components/validation/cards/IssueCard.jsx::IssueCard

**Shared Custom Properties:** `--color-bg-card, --color-border, --color-border-light, --color-text, --color-text-dim, --color-text-muted, --font-size-lg, --font-size-sm, --font-size-xs, --font-weight-medium`

### css-cluster-005: index.css, utilities.css, utilities.css
**Files:** 3 | **Avg Similarity:** 0.65 | **Spread:** 3 directories
**Top Signals:** categoryProfile:0.93, propertyFrequency:0.84, ruleSetMatch:0.68

| File | Linked Components |
|------|-------------------|
| apps/archivist/webui/src/index.css | |
| ...coherence-engine/webui/src/styles/utilities.css | |
| ...ages/shared-components/src/styles/utilities.css | |

**Linked Components:** apps/archivist/webui/src/ArchivistRemote.tsx::ArchivistRemoteProps, apps/archivist/webui/src/ArchivistRemote.tsx::default

**Shared Custom Properties:** `--font-size-base, --font-size-xl, --spacing-2xl, --spacing-md, --spacing-xl`

### css-cluster-006: WikiSearch.module.css, dropdown.css, dropdown.css
**Files:** 3 | **Avg Similarity:** 0.53 | **Spread:** 3 directories
**Top Signals:** categoryProfile:0.96, propertyFrequency:0.89, ruleSetMatch:0.51

| File | Linked Components |
|------|-------------------|
| ...cler/webui/src/components/WikiSearch.module.css | |
| ...engine/webui/src/styles/components/dropdown.css | |
| ...d-components/src/styles/components/dropdown.css | |

**Linked Components:** apps/chronicler/webui/src/components/WikiSearch.tsx::default

**Shared Custom Properties:** `--color-accent, --color-border, --font-size-sm, --font-size-xs, --radius-md, --spacing-xs, --transition-fast, --z-dropdown`

### css-cluster-007: level-selector.css, level-selector.css
**Files:** 2 | **Avg Similarity:** 0.86 | **Spread:** 2 directories
**Top Signals:** customPropertyVocab:1.00, categoryProfile:0.98, propertyFrequency:0.94

| File | Linked Components |
|------|-------------------|
| .../webui/src/styles/components/level-selector.css | |
| ...onents/src/styles/components/level-selector.css | |

**Shared Custom Properties:** `--color-accent, --color-bg-card, --color-border, --color-text, --font-size-md, --font-weight-medium, --radius-full, --radius-md, --spacing-md, --spacing-xs`

### css-cluster-008: form.css, form.css
**Files:** 2 | **Avg Similarity:** 0.79 | **Spread:** 2 directories
**Top Signals:** categoryProfile:1.00, propertyFrequency:1.00, ruleSetMatch:0.87

| File | Linked Components |
|------|-------------------|
| ...nce-engine/webui/src/styles/components/form.css | |
| ...hared-components/src/styles/components/form.css | |

**Shared Custom Properties:** `--color-accent, --color-bg-card, --color-bg-dark, --color-border, --color-border-light, --color-danger, --color-text, --color-text-dim, --color-text-muted, --color-warning`

### css-cluster-009: section.css, section.css
**Files:** 2 | **Avg Similarity:** 0.79 | **Spread:** 2 directories
**Top Signals:** categoryProfile:1.00, selectorPrefixOverlap:1.00, propertyFrequency:0.99

| File | Linked Components |
|------|-------------------|
| ...-engine/webui/src/styles/components/section.css | |
| ...ed-components/src/styles/components/section.css | |

**Shared Custom Properties:** `--color-accent, --color-bg-card, --color-border, --color-border-light, --color-text, --color-text-dim, --color-text-muted, --font-size-2xl, --font-size-base, --font-size-lg`

### css-cluster-010: badge.css, badge.css
**Files:** 2 | **Avg Similarity:** 0.69 | **Spread:** 2 directories
**Top Signals:** categoryProfile:0.99, propertyFrequency:0.97, selectorPrefixOverlap:0.89

| File | Linked Components |
|------|-------------------|
| ...ce-engine/webui/src/styles/components/badge.css | |
| ...ared-components/src/styles/components/badge.css | |

**Shared Custom Properties:** `--color-bg-dark, --color-danger, --color-gray, --color-success, --color-text-dim, --color-warning, --font-size-xs, --font-weight-medium, --font-weight-semibold, --radius-sm`

### css-cluster-011: CoherenceEngineRemote.css, CosmographerRemote.css
**Files:** 2 | **Avg Similarity:** 0.66 | **Spread:** 2 directories
**Top Signals:** categoryProfile:0.98, propertyFrequency:0.94, ruleSetMatch:0.72

| File | Linked Components |
|------|-------------------|
| ...ence-engine/webui/src/CoherenceEngineRemote.css | |
| apps/cosmographer/webui/src/CosmographerRemote.css | |

**Linked Components:** apps/coherence-engine/webui/src/CoherenceEngineRemote.jsx::default, apps/cosmographer/webui/src/CosmographerRemote.jsx::default

### css-cluster-012: BulkChronicleAnnotationModal.css, ConfigPanel.css, CostsPanel.css, IlluminatorTabContent.css, +1 more
**Files:** 5 | **Avg Similarity:** 0.42 | **Spread:** 1 directories
**Top Signals:** categoryProfile:0.93, customPropertyVocab:0.88, propertyFrequency:0.77

| File | Linked Components |
|------|-------------------|
| ...src/components/BulkChronicleAnnotationModal.css | |
| ...lluminator/webui/src/components/ConfigPanel.css | |
| ...illuminator/webui/src/components/CostsPanel.css | |
| .../webui/src/components/IlluminatorTabContent.css | |
| ...uminator/webui/src/components/StyleSelector.css | |

**Linked Components:** apps/illuminator/webui/src/components/BulkChronicleAnnotationModal.jsx::default, apps/illuminator/webui/src/components/ConfigPanel.jsx::default, apps/illuminator/webui/src/components/CostsPanel.jsx::default, apps/illuminator/webui/src/components/IlluminatorTabContent.jsx::default, apps/illuminator/webui/src/components/StyleSelector.jsx::NONE_ID, apps/illuminator/webui/src/components/StyleSelector.jsx::RANDOM_ID, apps/illuminator/webui/src/components/StyleSelector.jsx::default, apps/illuminator/webui/src/components/StyleSelector.jsx::resolveStyleSelection

**Shared Custom Properties:** `--text-muted`

### css-cluster-013: VariablesTab.css, ThresholdTriggerTab.css
**Files:** 2 | **Avg Similarity:** 0.95 | **Spread:** 1 directories
**Top Signals:** categoryProfile:1.00, customPropertyVocab:1.00, propertyFrequency:1.00

| File | Linked Components |
|------|-------------------|
| ...ui/src/components/actions/tabs/VariablesTab.css | |
| ...components/systems/tabs/ThresholdTriggerTab.css | |

**Linked Components:** apps/coherence-engine/webui/src/components/actions/tabs/VariablesTab.jsx::VariablesTab, apps/coherence-engine/webui/src/components/actions/tabs/VariablesTab.jsx::default, apps/coherence-engine/webui/src/components/systems/tabs/ThresholdTriggerTab.jsx::ThresholdTriggerTab

**Shared Custom Properties:** `--spacing-md`

### css-cluster-014: App.css, App.css
**Files:** 2 | **Avg Similarity:** 0.47 | **Spread:** 2 directories
**Top Signals:** categoryProfile:0.99, propertyFrequency:0.99, customPropertyVocab:0.51

| File | Linked Components |
|------|-------------------|
| apps/illuminator/webui/src/App.css | |
| apps/name-forge/webui/src/App.css | |

**Linked Components:** apps/illuminator/webui/src/IlluminatorRemote.jsx::default, apps/name-forge/webui/src/NameForgeRemote.jsx::default

**Shared Custom Properties:** `--bg-primary, --bg-secondary, --bg-sidebar, --bg-tertiary, --border-color, --card-bg, --card-border, --danger, --font-mono, --input-bg`

### css-cluster-015: GraphView.css, GraphView3D.css, TimelineView3D.css
**Files:** 3 | **Avg Similarity:** 0.57 | **Spread:** 1 directories
**Top Signals:** categoryProfile:0.92, propertyFrequency:0.78, ruleSetMatch:0.73

| File | Linked Components |
|------|-------------------|
| apps/archivist/webui/src/components/GraphView.css | |
| .../archivist/webui/src/components/GraphView3D.css | |
| ...chivist/webui/src/components/TimelineView3D.css | |

**Linked Components:** apps/archivist/webui/src/components/GraphView.tsx::default, apps/archivist/webui/src/components/GraphView3D.tsx::EdgeMetric, apps/archivist/webui/src/components/GraphView3D.tsx::default, apps/archivist/webui/src/components/TimelineView3D.tsx::EdgeMetric, apps/archivist/webui/src/components/TimelineView3D.tsx::default

### css-cluster-016: ChainLinkSection.css, DiscoveryStory.css, EraNarrative.css, LoreSection.css
**Files:** 4 | **Avg Similarity:** 0.42 | **Spread:** 1 directories
**Top Signals:** categoryProfile:0.97, propertyFrequency:0.94, customPropertyVocab:0.38

| File | Linked Components |
|------|-------------------|
| ...ivist/webui/src/components/ChainLinkSection.css | |
| ...chivist/webui/src/components/DiscoveryStory.css | |
| ...archivist/webui/src/components/EraNarrative.css | |
| .../archivist/webui/src/components/LoreSection.css | |

**Linked Components:** apps/archivist/webui/src/components/ChainLinkSection.tsx::default, apps/archivist/webui/src/components/DiscoveryStory.tsx::default, apps/archivist/webui/src/components/EraNarrative.tsx::default, apps/archivist/webui/src/components/LoreSection.tsx::default

**Shared Custom Properties:** `--font-serif, --font-size-base, --font-size-lg, --font-size-sm, --font-weight-bold, --radius-lg, --spacing-md, --spacing-xl`

### css-cluster-017: WeightMatrixEditor.css, CoverageMatrix.css
**Files:** 2 | **Avg Similarity:** 0.40 | **Spread:** 2 directories
**Top Signals:** categoryProfile:0.94, propertyFrequency:0.94, ruleSetMatch:0.38

| File | Linked Components |
|------|-------------------|
| ...components/weight-matrix/WeightMatrixEditor.css | |
| ...rc/components/CoverageMatrix/CoverageMatrix.css | |

**Linked Components:** apps/coherence-engine/webui/src/components/weight-matrix/WeightMatrixEditor.jsx::default, packages/shared-components/src/components/CoverageMatrix/CoverageMatrix.jsx::default

### css-cluster-018: HistorianEditionComparison.css, ChronicleVersionSelector.css, WorkspaceHeader.css
**Files:** 3 | **Avg Similarity:** 0.48 | **Spread:** 1 directories
**Top Signals:** categoryProfile:0.95, propertyFrequency:0.91, customPropertyVocab:0.63

| File | Linked Components |
|------|-------------------|
| ...i/src/components/HistorianEditionComparison.css | |
| ...hronicle-workspace/ChronicleVersionSelector.css | |
| ...ponents/chronicle-workspace/WorkspaceHeader.css | |

**Linked Components:** apps/illuminator/webui/src/components/HistorianEditionComparison.tsx::default, apps/illuminator/webui/src/components/chronicle-workspace/ChronicleVersionSelector.jsx::default, apps/illuminator/webui/src/components/chronicle-workspace/WorkspaceHeader.jsx::default

**Shared Custom Properties:** `--bg-tertiary, --border-color, --text-secondary`

### css-cluster-019: EpochTimeline.css, FinalDiagnostics.css, PopulationMetrics.css
**Files:** 3 | **Avg Similarity:** 0.44 | **Spread:** 1 directories
**Top Signals:** categoryProfile:0.93, propertyFrequency:0.84, ruleSetMatch:0.44

| File | Linked Components |
|------|-------------------|
| ...ebui/src/components/dashboard/EpochTimeline.css | |
| ...i/src/components/dashboard/FinalDiagnostics.css | |
| .../src/components/dashboard/PopulationMetrics.css | |

**Linked Components:** apps/lore-weave/webui/src/components/dashboard/EpochTimeline.jsx::default, apps/lore-weave/webui/src/components/dashboard/FinalDiagnostics.jsx::default, apps/lore-weave/webui/src/components/dashboard/PopulationMetrics.jsx::default

**Shared Custom Properties:** `--lw-text-muted`

### css-cluster-020: AxisRegistry.css, RelationshipEditor.css
**Files:** 2 | **Avg Similarity:** 0.46 | **Spread:** 1 directories
**Top Signals:** categoryProfile:0.97, propertyFrequency:0.96, ruleSetMatch:0.47

| File | Linked Components |
|------|-------------------|
| ...ui/src/components/AxisRegistry/AxisRegistry.css | |
| ...nents/RelationshipEditor/RelationshipEditor.css | |

**Linked Components:** apps/cosmographer/webui/src/components/AxisRegistry/index.jsx::default, apps/cosmographer/webui/src/components/RelationshipEditor/index.jsx::default

### css-cluster-021: EnsembleConstellation.css, TimelineBrush.css
**Files:** 2 | **Avg Similarity:** 0.43 | **Spread:** 1 directories
**Top Signals:** categoryProfile:0.71, propertyFrequency:0.67, ruleSetMatch:0.57

| File | Linked Components |
|------|-------------------|
| ...Wizard/visualizations/EnsembleConstellation.css | |
| ...hronicleWizard/visualizations/TimelineBrush.css | |

**Linked Components:** apps/illuminator/webui/src/components/ChronicleWizard/visualizations/EnsembleConstellation.tsx::default, apps/illuminator/webui/src/components/ChronicleWizard/visualizations/TimelineBrush.tsx::default

### css-cluster-022: RelationshipKindEditor.css, TagRegistryEditor.css
**Files:** 2 | **Avg Similarity:** 0.43 | **Spread:** 1 directories
**Top Signals:** categoryProfile:0.84, propertyFrequency:0.84, ruleSetMatch:0.47

| File | Linked Components |
|------|-------------------|
| ...ponents/SchemaEditor/RelationshipKindEditor.css | |
| ...c/components/SchemaEditor/TagRegistryEditor.css | |

**Linked Components:** apps/canonry/webui/src/components/SchemaEditor/RelationshipKindEditor.jsx::default, apps/canonry/webui/src/components/SchemaEditor/TagRegistryEditor.jsx::default

### css-cluster-023: empty-state.css, error-boundary.css
**Files:** 2 | **Avg Similarity:** 0.43 | **Spread:** 1 directories
**Top Signals:** categoryProfile:0.95, propertyFrequency:0.83, customPropertyVocab:0.56

| File | Linked Components |
|------|-------------------|
| ...omponents/src/styles/components/empty-state.css | |
| ...onents/src/styles/components/error-boundary.css | |

**Shared Custom Properties:** `--color-text, --color-text-dim, --color-text-muted, --font-size-2xl, --font-weight-medium, --spacing-2xl, --spacing-4xl, --spacing-md, --spacing-xl`

### css-cluster-024: actions.css, toggle.css
**Files:** 2 | **Avg Similarity:** 0.41 | **Spread:** 1 directories
**Top Signals:** categoryProfile:0.85, propertyFrequency:0.74, ruleExactMatch:0.29

| File | Linked Components |
|------|-------------------|
| ...ed-components/src/styles/components/actions.css | |
| ...red-components/src/styles/components/toggle.css | |

**Shared Custom Properties:** `--color-success, --color-text-muted, --radius-full, --spacing-lg, --transition-normal`

### css-cluster-025: EntityDetail.css, FilterPanel.css
**Files:** 2 | **Avg Similarity:** 0.40 | **Spread:** 1 directories
**Top Signals:** categoryProfile:0.97, propertyFrequency:0.91, customPropertyVocab:0.43

| File | Linked Components |
|------|-------------------|
| ...archivist/webui/src/components/EntityDetail.css | |
| .../archivist/webui/src/components/FilterPanel.css | |

**Linked Components:** apps/archivist/webui/src/components/EntityDetail.tsx::default, apps/archivist/webui/src/components/FilterPanel.tsx::EdgeMetric, apps/archivist/webui/src/components/FilterPanel.tsx::ViewMode, apps/archivist/webui/src/components/FilterPanel.tsx::default

**Shared Custom Properties:** `--color-bg-blue-20, --color-bg-dark-20, --color-bg-dark-40, --color-blue-300, --color-blue-400, --color-blue-500, --color-border, --color-border-light, --color-border-strong, --color-gray-400`


## CSS Intra-File Duplication

### FilterPanel.css
Found 1 similar prefix groups within `apps/archivist/webui/src/components/FilterPanel.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| view-mode (4r) | edge-metric (5r) | 0.742 | categoryProfile |

### StatsPanel.css
Found 1 similar prefix groups within `apps/archivist/webui/src/components/StatsPanel.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| validation-value (3r) | validation-result (10r) | 0.445 | categoryProfile |

### RelationshipKindEditor.css
Found 2 similar prefix groups within `apps/canonry/webui/src/components/SchemaEditor/RelationshipKindEditor.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| rke-constraint (4r) | rke-maintenance (3r) | 0.482 | categoryProfile |
| rke-constraint (4r) | rke-verbs (3r) | 0.409 | categoryProfile |

### WikiExplorer.module.css
Found 6 similar prefix groups within `apps/chronicler/webui/src/components/WikiExplorer.module.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| pages-index (3r) | category-index (3r) | 0.950 | ruleExactMatch |
| era-button (4r) | entity-list (8r) | 0.524 | categoryProfile |
| page-item (3r) | era-button (4r) | 0.462 | categoryProfile |
| entity-link (3r) | title-button (3r) | 0.434 | categoryProfile |
| entity-card (7r) | entity-list (8r) | 0.421 | propertyFrequency |
| page-item (3r) | entity-list (8r) | 0.419 | categoryProfile |

### CausalLoopEditor.css
Found 2 similar prefix groups within `apps/coherence-engine/webui/src/components/causal-loop/CausalLoopEditor.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| cl-stats (3r) | cl-edge (7r) | 0.436 | categoryProfile |
| cl-loop (6r) | cl-edge (7r) | 0.406 | categoryProfile |

### validation.css
Found 1 similar prefix groups within `apps/coherence-engine/webui/src/components/validation/validation.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| validation-export (3r) | validation-affected (3r) | 0.516 | categoryProfile |

### editor.css
Found 1 similar prefix groups within `apps/coherence-engine/webui/src/styles/components/editor.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| nested-card (11r) | condition-card (10r) | 0.456 | categoryProfile |

### SemanticPlane.css
Found 1 similar prefix groups within `apps/cosmographer/webui/src/components/SemanticPlane/SemanticPlane.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| sp-region (8r) | sp-entity (4r) | 0.403 | categoryProfile |

### App.css
Found 36 similar prefix groups within `apps/illuminator/webui/src/App.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| preprint-subtab (3r) | workspace-subtab (5r) | 0.804 | customPropertyVocab |
| illuminator-prompt (7r) | illuminator-kind (5r) | 0.519 | categoryProfile |
| illuminator-status (5r) | static-page-status (3r) | 0.509 | customPropertyVocab |
| illuminator-kind (5r) | illuminator-btn (8r) | 0.501 | categoryProfile |
| illuminator-btn (8r) | preprint-action (5r) | 0.483 | categoryProfile |
| illuminator-nav (4r) | preprint-subtab (3r) | 0.474 | categoryProfile |
| illuminator-context (3r) | illuminator-visual-identity (6r) | 0.469 | categoryProfile |
| illuminator-queue-item (4r) | illuminator-style-card (9r) | 0.463 | categoryProfile |
| illuminator-btn (8r) | static-page (10r) | 0.457 | categoryProfile |
| preprint-picker-item (3r) | preprint-palette-item (4r) | 0.455 | customPropertyVocab |
| illuminator-queue-item (4r) | entity-link (6r) | 0.449 | categoryProfile |
| illuminator-card (4r) | static-page-editor-empty (3r) | 0.444 | categoryProfile |
| illuminator-button (11r) | static-page (10r) | 0.444 | categoryProfile |
| illuminator-kind (5r) | static-page (10r) | 0.442 | categoryProfile |
| illuminator-prompt (7r) | illuminator-btn (8r) | 0.440 | categoryProfile |
| illuminator-prompt (7r) | static-page (10r) | 0.437 | categoryProfile |
| illuminator-kind (5r) | preprint-subtab (3r) | 0.436 | categoryProfile |
| illuminator-template-visual-steps (5r) | static-page-toolbar (4r) | 0.429 | categoryProfile |
| illuminator-identity-section (6r) | entity-link (6r) | 0.428 | categoryProfile |
| illuminator-api (7r) | illuminator-input (4r) | 0.423 | categoryProfile |
| illuminator-nav (4r) | workspace-subtab (5r) | 0.423 | categoryProfile |
| illuminator-api (7r) | illuminator-mode (3r) | 0.422 | categoryProfile |
| static-pages-list (5r) | entity-link (6r) | 0.422 | categoryProfile |
| illuminator-api (7r) | llm-table (13r) | 0.420 | categoryProfile |
| illuminator-entity (8r) | illuminator-style-card (9r) | 0.418 | categoryProfile |
| illuminator-mode (3r) | preprint-subtab (3r) | 0.417 | categoryProfile |
| illuminator-identity-section (6r) | static-page-modal (6r) | 0.416 | categoryProfile |
| illuminator-nav (4r) | preprint-palette (19r) | 0.414 | categoryProfile |
| static-pages-list (5r) | image-picker (10r) | 0.412 | categoryProfile |
| preprint-tree-node (7r) | preprint-picker-item (3r) | 0.409 | categoryProfile |
| illuminator-button (11r) | illuminator-btn (8r) | 0.408 | categoryProfile |
| illuminator-queue-item (4r) | illuminator-entity (8r) | 0.404 | categoryProfile |
| illuminator-queue-item (4r) | illuminator-visual-identity (6r) | 0.402 | propertyFrequency |
| illuminator-button (11r) | preprint-palette (19r) | 0.401 | categoryProfile |
| illuminator-input (4r) | static-page-summary (4r) | 0.401 | categoryProfile |
| static-page-modal (6r) | workspace-overflow (4r) | 0.400 | categoryProfile |

### ChronicleImagePanel.css
Found 1 similar prefix groups within `apps/illuminator/webui/src/components/ChronicleImagePanel.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| cip-involved (3r) | cip-stat (3r) | 0.442 | categoryProfile |

### ChroniclePanel.css
Found 1 similar prefix groups within `apps/illuminator/webui/src/components/ChroniclePanel.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| chron-header (6r) | chron-filter-bar (5r) | 0.412 | customPropertyVocab |

### ChroniclePlanEditor.css
Found 1 similar prefix groups within `apps/illuminator/webui/src/components/ChroniclePlanEditor.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| cpe-section (5r) | cpe-entity (3r) | 0.450 | categoryProfile |

### GenerateStep.css
Found 2 similar prefix groups within `apps/illuminator/webui/src/components/ChronicleWizard/steps/GenerateStep.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| gs-section (3r) | gs-lens (5r) | 0.444 | customPropertyVocab |
| gs-lens (5r) | gs-roles (3r) | 0.436 | customPropertyVocab |

### NarrativeTimeline.css
Found 1 similar prefix groups within `apps/illuminator/webui/src/components/ChronicleWizard/visualizations/NarrativeTimeline.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| nt-tooltip (7r) | nt-cast (6r) | 0.641 | customPropertyVocab |

### ChronologyModal.css
Found 1 similar prefix groups within `apps/illuminator/webui/src/components/ChronologyModal.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| chm-generating (3r) | chm-failed (3r) | 0.508 | categoryProfile |

### CohesionReportViewer.css
Found 1 similar prefix groups within `apps/illuminator/webui/src/components/CohesionReportViewer.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| crv-refinement (5r) | crv-section-goal (3r) | 0.456 | customPropertyVocab |

### CorpusFindReplace.css
Found 1 similar prefix groups within `apps/illuminator/webui/src/components/CorpusFindReplace.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| cfr-diff (3r) | cfr-literal (3r) | 0.457 | customPropertyVocab |

### CoveragePanel.css
Found 2 similar prefix groups within `apps/illuminator/webui/src/components/CoveragePanel.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| cvp-color (5r) | cvp-strength (3r) | 0.637 | propertyFrequency |
| cvp-histogram (8r) | cvp-analysis (7r) | 0.577 | customPropertyVocab |

### EntityCoveragePanel.css
Found 2 similar prefix groups within `apps/illuminator/webui/src/components/EntityCoveragePanel.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| ecp-pre-calc (4r) | ecp-header (4r) | 0.523 | categoryProfile |
| ecp-section (6r) | ecp-event (3r) | 0.433 | categoryProfile |

### EraNarrativeModal.css
Found 1 similar prefix groups within `apps/illuminator/webui/src/components/EraNarrativeModal.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| era-narr (13r) | era-narr-content (4r) | 0.402 | categoryProfile |

### EraNarrativeViewer.css
Found 11 similar prefix groups within `apps/illuminator/webui/src/components/EraNarrativeViewer.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| era-narrative-sd (5r) | era-narrative-quote (4r) | 0.600 | categoryProfile |
| era-narrative-thread (8r) | era-narrative-quote (4r) | 0.514 | categoryProfile |
| era-narrative-collapsible (3r) | era-narrative-brief (5r) | 0.506 | categoryProfile |
| era-narrative-image-refs (4r) | era-narrative-brief (5r) | 0.501 | categoryProfile |
| era-narrative-thread (8r) | era-narrative-brief (5r) | 0.486 | categoryProfile |
| era-narrative-image-refs (4r) | era-narrative-collapsible (3r) | 0.454 | categoryProfile |
| era-narrative-sd (5r) | era-narrative-movement (7r) | 0.434 | categoryProfile |
| era-narrative-thread (8r) | era-narrative-sd (5r) | 0.433 | categoryProfile |
| era-narrative-chronicle-ref (8r) | era-narrative-thread (8r) | 0.426 | categoryProfile |
| era-narrative-quote (4r) | era-narrative-movement (7r) | 0.425 | categoryProfile |
| era-narrative-thread (8r) | era-narrative-movement (7r) | 0.405 | customPropertyVocab |

### ImageSettingsDrawer.css
Found 2 similar prefix groups within `apps/illuminator/webui/src/components/ImageSettingsDrawer.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| isd-category (3r) | isd-output (5r) | 0.491 | categoryProfile |
| isd-item (7r) | isd-palette (6r) | 0.464 | categoryProfile |

### ProgressPanel.css
Found 1 similar prefix groups within `apps/illuminator/webui/src/components/ProgressPanel.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| pp-progress (4r) | pp-stat-label (4r) | 0.421 | categoryProfile |

### QuickCheckModal.css
Found 1 similar prefix groups within `apps/illuminator/webui/src/components/QuickCheckModal.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| qcm-search-result (4r) | qcm-header (3r) | 0.450 | customPropertyVocab |

### StyleLibraryEditor.css
Found 1 similar prefix groups within `apps/illuminator/webui/src/components/StyleLibraryEditor.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| style-editor-role (5r) | style-editor-status (3r) | 0.404 | categoryProfile |

### SummaryRevisionModal.css
Found 1 similar prefix groups within `apps/illuminator/webui/src/components/SummaryRevisionModal.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| srm-diff (5r) | srm-anchor (6r) | 0.471 | categoryProfile |

### TraitPaletteSection.css
Found 1 similar prefix groups within `apps/illuminator/webui/src/components/TraitPaletteSection.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| tps-stat (3r) | tps-palette (6r) | 0.467 | categoryProfile |

### WorldContextEditor.css
Found 1 similar prefix groups within `apps/illuminator/webui/src/components/WorldContextEditor.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| wce-fact (6r) | wce-dynamic (6r) | 0.950 | ruleExactMatch |

### ContentTab.css
Found 1 similar prefix groups within `apps/illuminator/webui/src/components/chronicle-workspace/ContentTab.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| ctab-summary (4r) | ctab-tertiary (8r) | 0.400 | categoryProfile |

### HistorianTab.css
Found 8 similar prefix groups within `apps/illuminator/webui/src/components/chronicle-workspace/HistorianTab.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| htab-prep (7r) | htab-backport (5r) | 0.666 | categoryProfile |
| htab-tone-detect (3r) | htab-backport (5r) | 0.588 | customPropertyVocab |
| htab-annotate (5r) | htab-backport (5r) | 0.585 | categoryProfile |
| htab-tone-detect (3r) | htab-annotate (5r) | 0.566 | categoryProfile |
| htab-annotate (5r) | htab-prep (7r) | 0.555 | categoryProfile |
| htab-tone-detect (3r) | htab-prep (7r) | 0.522 | categoryProfile |
| htab-tone (4r) | htab-prep (7r) | 0.412 | categoryProfile |
| htab-tone (4r) | htab-annotate (5r) | 0.409 | propertyFrequency |

### ReferenceTab.css
Found 2 similar prefix groups within `apps/illuminator/webui/src/components/chronicle-workspace/ReferenceTab.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| ref-tab-rating (5r) | ref-tab-fcg-legend (3r) | 0.674 | categoryProfile |
| ref-tab-synth (7r) | ref-tab-fcv (7r) | 0.475 | customPropertyVocab |

### VersionsTab.css
Found 6 similar prefix groups within `apps/illuminator/webui/src/components/chronicle-workspace/VersionsTab.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| vtab-action (3r) | vtab-regen (3r) | 0.850 | ruleSetMatch |
| vtab-action (3r) | vtab-regen-primary (3r) | 0.750 | ruleSetMatch |
| vtab-action (3r) | vtab-regen-creative (3r) | 0.750 | ruleSetMatch |
| vtab-regen (3r) | vtab-regen-primary (3r) | 0.750 | ruleSetMatch |
| vtab-regen (3r) | vtab-regen-creative (3r) | 0.750 | ruleSetMatch |
| vtab-regen-primary (3r) | vtab-regen-creative (3r) | 0.750 | ruleSetMatch |

### App.css
Found 7 similar prefix groups within `apps/lore-weave/webui/src/App.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| lw-timeline (8r) | lw-category (10r) | 0.502 | categoryProfile |
| lw-metric (6r) | lw-detail (5r) | 0.479 | categoryProfile |
| lw-pressure (9r) | lw-template (6r) | 0.453 | categoryProfile |
| lw-btn (15r) | lw-tab (3r) | 0.426 | categoryProfile |
| lw-btn (15r) | lw-nav (4r) | 0.418 | categoryProfile |
| lw-card (4r) | lw-section (4r) | 0.408 | categoryProfile |
| lw-card (4r) | lw-detail (5r) | 0.406 | categoryProfile |

### FinalDiagnostics.css
Found 1 similar prefix groups within `apps/lore-weave/webui/src/components/dashboard/FinalDiagnostics.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| fd-agent (3r) | fd-unused (3r) | 0.800 | ruleSetMatch |

### SimulationTraceVisx.css
Found 1 similar prefix groups within `apps/lore-weave/webui/src/components/dashboard/trace/SimulationTraceVisx.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| lw-trace-view-anchor (5r) | lw-trace-view-resolved (6r) | 0.483 | categoryProfile |

### App.css
Found 33 similar prefix groups within `apps/name-forge/webui/src/App.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| weight-slider (3r) | strategy-config (3r) | 0.728 | propertyFrequency |
| sidebar (5r) | guide-sidebar (3r) | 0.629 | categoryProfile |
| strategy-group (3r) | strategy-card (3r) | 0.550 | ruleSetMatch |
| strategy-badge (4r) | strategy-card (3r) | 0.530 | categoryProfile |
| test-count (3r) | strategy-config (3r) | 0.497 | categoryProfile |
| badge (4r) | profile-badge (3r) | 0.487 | categoryProfile |
| group-type (3r) | strategy-count (3r) | 0.483 | categoryProfile |
| list-item (7r) | profile-card (7r) | 0.468 | categoryProfile |
| generate-context (4r) | strategy-config (3r) | 0.463 | categoryProfile |
| test-count (3r) | weight-slider (3r) | 0.460 | categoryProfile |
| group-type (3r) | diff-tag (3r) | 0.458 | categoryProfile |
| strategy-count (3r) | diff-tag (3r) | 0.458 | categoryProfile |
| group-row (5r) | strategy-item (5r) | 0.452 | categoryProfile |
| rule-card (7r) | strategy-item (5r) | 0.450 | categoryProfile |
| guide-step (5r) | card (4r) | 0.445 | categoryProfile |
| sidebar (5r) | workshop-sidebar (5r) | 0.439 | propertyFrequency |
| flex-row (5r) | split-layout (3r) | 0.436 | categoryProfile |
| culture-form (4r) | rule-form (6r) | 0.432 | categoryProfile |
| culture-form (4r) | domain-card (6r) | 0.431 | categoryProfile |
| pill-button (3r) | add-group (4r) | 0.431 | categoryProfile |
| workspace-title (3r) | results-empty (4r) | 0.429 | categoryProfile |
| list-item (7r) | grammar-card (4r) | 0.426 | categoryProfile |
| strategy-badge (4r) | strategy-group (3r) | 0.424 | categoryProfile |
| workshop-sidebar (5r) | guide-sidebar (3r) | 0.422 | customPropertyVocab |
| app-header (3r) | collapsible-content (4r) | 0.418 | categoryProfile |
| list-viewer (4r) | group-section (3r) | 0.411 | categoryProfile |
| culture-form (4r) | split-layout (3r) | 0.411 | categoryProfile |
| nf-nav (4r) | nf-api (5r) | 0.407 | categoryProfile |
| culture-resource (6r) | add-btn (5r) | 0.405 | categoryProfile |
| domain-stats (3r) | card (4r) | 0.405 | categoryProfile |
| app-header (3r) | main-content (5r) | 0.401 | categoryProfile |
| rule-card (7r) | group-row (5r) | 0.401 | categoryProfile |
| culture-card (5r) | rule-card (7r) | 0.401 | categoryProfile |

### TagSelector.css
Found 1 similar prefix groups within `packages/shared-components/src/TagSelector.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| tag-selector (6r) | tag-selector-rarity (4r) | 0.443 | customPropertyVocab |

### card.css
Found 1 similar prefix groups within `packages/shared-components/src/styles/components/card.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| weights-accordion (8r) | transitions-column (5r) | 0.445 | propertyFrequency |

### editor.css
Found 7 similar prefix groups within `packages/shared-components/src/styles/components/editor.css`:

| Group A | Group B | Score | Dominant Signal |
|---------|---------|-------|-----------------|
| project-selector (5r) | slot-selector (5r) | 0.873 | ruleSetMatch |
| project-dropdown (4r) | slot-dropdown (3r) | 0.572 | categoryProfile |
| btn-sm (6r) | btn-xs (6r) | 0.551 | categoryProfile |
| project-item (6r) | slot-item (10r) | 0.476 | categoryProfile |
| nested-card (11r) | condition-card (10r) | 0.455 | categoryProfile |
| expandable-card (11r) | condition-card (10r) | 0.439 | categoryProfile |
| expandable-card (11r) | modal-status (3r) | 0.427 | categoryProfile |
