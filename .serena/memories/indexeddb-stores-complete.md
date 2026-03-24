# Complete IndexedDB Store Inventory

## Overview

This document comprehensively catalogs all 23 stores in the Illuminator database (IndexedDB) and confirms that Canonry does NOT have its own separate database (all data is stored in the shared illuminator DB).

**Key Facts:**
- Single canonical database: `illuminator` (created in `apps/illuminator/webui/src/lib/db/illuminatorDb.ts`)
- All stores use Dexie ORM
- Schema evolution tracked across 12 versions (v1-v12)
- No separate Canonry IndexedDB stores
- All persistence is unified in the illuminator DB

---

## Illuminator Database Stores (23 total)

### Version 1 (Entity Enrichment DAL)

#### Store: `entities`
- **Primary Key:** `id`
- **Indexes:** `simulationRunId`, `kind`, `[simulationRunId+kind]`
- **Type:** `PersistedEntity extends WorldEntity`
- **Record Structure:**
  - From `WorldEntity` (world-schema): `id`, `kind`, `subtype`, `name`, `description`, `status`, `prominence`, `culture`, `tags`, `links` (relationships), `coordinates`, `createdAt`, `updatedAt`, `summary`
  - Plus Illuminator fields:
    - `simulationRunId: string` (required) — scopes entity to simulation run
    - `enrichment?: EntityEnrichment` — visual thesis, image ID, chronicles, historian notes, backrefs, etc.
- **Purpose:** Core entity data with enrichment metadata (descriptions, visual traits, images)
- **Data Type:** ESSENTIAL (user content from simulation)

#### Store: `narrativeEvents`
- **Primary Key:** `id`
- **Indexes:** `simulationRunId`
- **Type:** `PersistedNarrativeEvent extends NarrativeEvent`
- **Record Structure:**
  - From `NarrativeEvent` (world-schema): `id`, `tick`, `era`, `eventKind`, `significance`, `headline`, `description`, `subject`, `object`, `participants`, `stateChanges`, `narrativeTags`
  - Plus: `simulationRunId: string` (required)
- **Purpose:** Timestamped world events for chronicle narrative selection
- **Data Type:** ESSENTIAL (world simulation events)

---

### Version 2+ (Chronicles, Images, Costs, Traits, Runs, Static Pages, Styles)

#### Store: `chronicles`
- **Primary Key:** `chronicleId`
- **Indexes:** `simulationRunId`, `projectId`
- **Type:** `ChronicleRecord`
- **Record Structure:** (major record with many fields)
  - **Chronicle Identity:**
    - `chronicleId: string` (PK)
    - `projectId: string`, `simulationRunId: string`, `title: string`
    - `format: "story" | "document"`, `focusType: "single" | "ensemble"`
    - `roleAssignments: ChronicleRoleAssignment[]` (cast members with roles)
    - `lens?: NarrativeLens` (optional contextual frame entity)
    - `narrativeStyleId: string`, `narrativeStyle?: NarrativeStyle` (snapshot)
    - `selectedEntityIds[]`, `selectedEventIds[]`, `selectedRelationshipIds[]`
    - `temporalContext?: ChronicleTemporalContext` (era + tick range + scope)
  - **Generation:**
    - `status: ChronicleStatus` (generating → assembly_ready → editing → validating → complete)
    - `assembledContent?: string`, `assembledAt?: number`
    - `generationSystemPrompt?: string`, `generationUserPrompt?: string`
    - `generationSampling?: "normal" | "low"`
    - `generationStep?: "generate" | "regenerate" | "creative" | "combine" | "copy_edit"`
    - `generationHistory?: ChronicleGenerationVersion[]` (versions with content + cost)
    - `activeVersionId?: string`, `acceptedVersionId?: string`
  - **Validation & Refinements:**
    - `perspectiveSynthesis?: PerspectiveSynthesisRecord` (LLM tone + faceted facts)
    - `cohesionReport?: CohesionReport` (structure/entity/theme consistency)
    - `quickCheckReport?: QuickCheckReport` (unanchored entity refs)
    - `factCoverageReport?: FactCoverageReport` (canon fact presence ratings)
    - `summary?: string`, `titleCandidates?: string[]`
    - `imageRefs?: ChronicleImageRefs` (embedded scene descriptions → generated images)
    - `coverImage?: ChronicleCoverImage` (cover montage)
  - **Historian Annotations:**
    - `historianNotes?: HistorianNote[]` (marginal notes anchored to text)
    - `toneRanking?: { ranking, rationale, generatedAt, actualCost }`
    - `assignedTone?: HistorianTone`
  - **Entity Backport Tracking:**
    - `entityBackportStatus?: Record<string, EntityBackportEntry>`
  - **Revision & Acceptance:**
    - `editVersion: number`, `editedAt?: number`
    - `finalContent?: string`, `acceptedAt?: number`
  - **Cost Tracking:**
    - `totalEstimatedCost: number`, `totalActualCost: number`
    - `totalInputTokens: number`, `totalOutputTokens: number`
  - **Metadata:**
    - `model: string`, `createdAt: number`, `updatedAt: number`
- **Purpose:** Complete chronicle generation pipeline state (plan → generate → validate → edit → accept)
- **Data Type:** ESSENTIAL (user content — published chronicles)

#### Store: `images`
- **Primary Key:** `imageId`
- **Indexes:** `projectId`, `entityId`, `chronicleId`, `entityKind`, `entityCulture`, `model`, `imageType`, `generatedAt`
- **Type:** `ImageRecord extends ImageMetadata`
- **Record Structure:**
  - **Metadata (from ImageMetadata):**
    - `imageId: string` (PK)
    - `entityId: string`, `projectId: string`
    - `entityName?: string`, `entityKind?: string`, `entityCulture?: string`
    - `originalPrompt?: string`, `formattingPrompt?: string`, `finalPrompt?: string`
    - `generatedAt: number`, `model: string`
    - `revisedPrompt?: string` (image model's interpretation)
    - `requestedSize?: string`, `estimatedCost?: number`, `actualCost?: number`
    - `inputTokens?: number`, `outputTokens?: number`
    - **Dimensions & Aspect:**
      - `width?: number`, `height?: number`
      - `aspect?: "portrait" | "landscape" | "square"`
    - **Chronicle Image Fields:**
      - `imageType?: "entity" | "scene" | "cover" | "other"`
      - `chronicleId?: string`, `imageRefId?: string`
      - `sceneDescription?: string`
    - **Catalog Metadata (backfilled):**
      - `artisticStyleId?: string`, `compositionStyleId?: string`, `colorPaletteId?: string`
      - `title?: string`, `llmTitle?: boolean`, `tags?: string[]`
    - **Upscale Metadata:**
      - `hqWidth?: number`, `hqHeight?: number`, `hqUpscaledAt?: number`
  - **ImageRecord-specific:**
    - `blob: Blob` (image binary data — v3+ moved to separate table)
    - `mimeType: string`, `size: number`, `savedAt: number`
- **Purpose:** Entity portraits, chronicle scene images, cover images with metadata and binary data
- **Data Type:** MIXED (user content + generated — blob is large, moved to separate table in v3)
- **Note:** As of v3, blobs are in `imageBlobs` table; metadata remains here for fast queries

#### Store: `imageBlobs`
- **Primary Key:** `imageId`
- **Indexes:** (primary only)
- **Type:** `ImageBlobRecord`
- **Record Structure:**
  - `imageId: string` (FK to images)
  - `blob: Blob` (binary image data)
- **Purpose:** Optimized blob storage (v3+) — split from images table for fast metadata queries
- **Data Type:** GENERATED (binary image data)
- **Scoping:** Keyed by `imageId` which identifies entity/chronicle

#### Store: `upscaleBlobs`
- **Primary Key:** `blobId` (compound: "{imageId}:{width}x{height}")
- **Indexes:** `imageId`
- **Type:** `UpscaleBlobRecord`
- **Record Structure:**
  - `blobId: string` (compound key, PK)
  - `imageId: string` (FK to images table)
  - `blob: Blob` (upscaled binary data)
  - `width: number`, `height: number`
  - `model: "clarity" | "creative" | "topaz"` (fal.ai upscaler)
  - `factor: 2 | 4` (scale factor)
  - `creativity: number`, `resemblance: number` (fal.ai parameters)
  - `prompt: string`, `negativePrompt: string` (guidance sent to upscaler)
  - `sourceWidth: number`, `sourceHeight: number` (source image resolution)
  - `upscaledAt: number`
- **Purpose:** Print-quality upscaled image variants (v12+) — multiple tiers per source image
- **Data Type:** GENERATED (upscale blob data)
- **Scoping:** Linked to images table via `imageId`

#### Store: `upscaleTestBlobs`
- **Primary Key:** `testId`
- **Indexes:** `sourceImageId`
- **Type:** `UpscaleTestBlobRecord`
- **Record Structure:** Similar to `upscaleBlobs` but disconnected
  - `testId: string` (PK — not linked via FK, just for display)
  - `sourceImageId: string` (narrative reference, not a DB link)
  - `blob: Blob`
  - `width, height, model, factor, creativity, resemblance, prompt, negativePrompt, sourceWidth, sourceHeight: ...`
  - `createdAt: number`
- **Purpose:** Ephemeral test upscale attempts (v12+) — experimentation sandbox
- **Data Type:** TEMPORARY/CACHE (test blobs)

#### Store: `costs`
- **Primary Key:** `id`
- **Indexes:** `projectId`, `simulationRunId`, `entityId`, `chronicleId`, `type`, `model`, `timestamp`
- **Type:** `CostRecord`
- **Record Structure:**
  - `id: string` (PK)
  - `timestamp: number`
  - **Scoping:**
    - `projectId: string`, `simulationRunId?: string`
    - `entityId?: string`, `entityName?: string`, `entityKind?: string`
    - `chronicleId?: string`
  - **Cost Tracking:**
    - `type: CostType` (description, image, chronicleValidation, summaryRevision, historiannReview, etc.)
    - `model: string`
    - `estimatedCost: number`, `actualCost: number`
    - `inputTokens: number`, `outputTokens: number`
- **Purpose:** Audit trail of all LLM/API costs (per operation type, model, entity)
- **Data Type:** DERIVED/CACHE (aggregable from other records, but persisted for efficiency)

#### Store: `traitPalettes`
- **Primary Key:** `id` (composite: "{projectId}_{entityKind}")
- **Indexes:** `projectId`, `entityKind`
- **Type:** `TraitPalette`
- **Record Structure:**
  - `id: string` (PK — composite)
  - `projectId: string`, `entityKind: string`
  - `items: PaletteItem[]` — each item:
    - `id: string`, `category: string`, `description: string`
    - `examples: string[]`, `timesUsed: number`
    - `addedAt: number`, `subtypes?: string[]`, `era?: string`
  - `updatedAt: number`
- **Purpose:** Per-entity-kind visual trait categories for consistent image generation (e.g., "noble bearing", "weathered")
- **Data Type:** ESSENTIAL (project configuration + user-curated trait library)

#### Store: `usedTraits`
- **Primary Key:** `id` (composite: "{projectId}_{simulationRunId}_{entityKind}_{entityId}")
- **Indexes:** `projectId`, `simulationRunId`, `entityKind`, `entityId`
- **Type:** `UsedTraitRecord`
- **Record Structure:**
  - `id: string` (PK — composite)
  - `projectId: string`, `simulationRunId: string`, `entityKind: string`, `entityId: string`
  - `entityName: string`, `traits: string[]` (assigned trait categories)
  - `registeredAt: number`
- **Purpose:** Track which visual traits were assigned to each entity (for consistency + analytics)
- **Data Type:** DERIVED/CACHE (can be recomputed from palette + entity selections)

#### Store: `historianRuns`
- **Primary Key:** `runId`
- **Indexes:** `projectId`, `status`, `createdAt`
- **Type:** `HistorianRun`
- **Record Structure:**
  - `runId: string`, `projectId: string`, `simulationRunId: string`
  - `status: HistorianRunStatus` (pending → generating → reviewing → complete/cancelled/failed)
  - `error?: string`
  - **Target:**
    - `tone: HistorianTone` (scholarly, witty, weary, forensic, elegiac, cantankerous, rueful, conspiratorial, bemused)
    - `targetType: "entity" | "chronicle" | "chronology"`
    - `targetId: string`, `targetName: string`
  - **Content:**
    - `sourceText: string` (text being annotated)
    - `notes: HistorianNote[]` (generated margin notes with anchorPhrase, text, type, display mode)
    - `noteDecisions: Record<string, boolean>` (accept/reject per note)
    - `chronologyAssignments?: ChronologyAssignment[]` (for chronology runs)
  - **Context (serialized JSON):**
    - `contextJson: string`, `previousNotesJson: string`, `historianConfigJson: string`
  - **Prompts:**
    - `systemPrompt?: string`, `userPrompt?: string`
  - **Cost:**
    - `inputTokens: number`, `outputTokens: number`, `actualCost: number`
  - **Metadata:**
    - `createdAt: number`, `updatedAt: number`
- **Purpose:** Batch annotation workflow for entity descriptions and chronicles (with tone control)
- **Data Type:** ESSENTIAL (user review state) + GENERATED (LLM-produced notes)

#### Store: `summaryRevisionRuns`
- **Primary Key:** `runId`
- **Indexes:** `projectId`, `status`, `createdAt`
- **Type:** `SummaryRevisionRun`
- **Record Structure:**
  - `runId: string`, `projectId: string`, `simulationRunId: string`
  - `status: SummaryRevisionRunStatus` (pending → generating → batch_reviewing → run_reviewing → complete/cancelled/failed)
  - **Batches (culture-grouped):**
    - `batches: SummaryRevisionBatch[]` — each batch:
      - `culture: string`, `entityIds: string[]`
      - `status: "pending" | "generating" | "complete" | "failed"`
      - `patches: SummaryRevisionPatch[]` — each patch:
        - `entityId, entityName, entityKind`
        - `summary?: string`, `description?: string`, `anchorPhrase?: string`
      - `error?: string`, `inputTokens?, outputTokens?, actualCost?`
  - `currentBatchIndex: number`
  - `patchDecisions: Record<string, boolean>` (accept/reject per entity)
  - **Context (serialized):**
    - `worldDynamicsContext: string`, `staticPagesContext: string`, `schemaContext: string`
  - `revisionGuidance: string` (user-editable prompt tuning)
  - **Cost:**
    - `totalInputTokens: number`, `totalOutputTokens: number`, `totalActualCost: number`
  - **Metadata:**
    - `createdAt: number`, `updatedAt: number`
- **Purpose:** Batch revision of entity descriptions using world dynamics context (sequential batch review workflow)
- **Data Type:** ESSENTIAL (user review state) + GENERATED (LLM-produced patches)

#### Store: `dynamicsRuns`
- **Primary Key:** `runId`
- **Indexes:** `projectId`, `status`, `createdAt`
- **Type:** `DynamicsRun`
- **Record Structure:**
  - `runId: string`, `projectId: string`, `simulationRunId: string`
  - `status: DynamicsRunStatus` (pending → generating → awaiting_review → complete/failed)
  - **Conversation:**
    - `messages: DynamicsMessage[]` (multi-turn LLM conversation)
      - Each message: `role: "system" | "assistant" | "user"`, `content: string`, `timestamp: number`
  - **Proposed Dynamics:**
    - `proposedDynamics?: ProposedDynamic[]` — each dynamic:
      - `text: string`, `cultures?: string[]`, `kinds?: string[]`
      - `eraOverrides?: Record<string, { text, replace }>`
  - `userFeedback?: string` (feedback for next turn)
  - `error?: string`
  - **Cost:**
    - `totalInputTokens: number`, `totalOutputTokens: number`, `totalActualCost: number`
  - **Metadata:**
    - `createdAt: number`, `updatedAt: number`
- **Purpose:** Multi-turn LLM flow for generating world dynamics (narrative statements about macro-level forces)
- **Data Type:** ESSENTIAL (user review state) + GENERATED (LLM-produced dynamics)

#### Store: `staticPages`
- **Primary Key:** `pageId`
- **Indexes:** `projectId`, `slug`, `status`, `updatedAt`
- **Type:** `StaticPage`
- **Record Structure:**
  - `pageId: string`, `projectId: string`
  - `title: string`, `slug: string`, `content: string`
  - `summary?: string`
  - `status: "draft" | "published"`
  - **Computed (from content):**
    - `linkedEntityIds: string[]` (entities mentioned in content)
    - `wordCount: number`
  - **Metadata:**
    - `createdAt: number`, `updatedAt: number`
- **Purpose:** User-authored static pages (for book frontmatter, world notes, appendices)
- **Data Type:** ESSENTIAL (user content)

#### Store: `styleLibrary`
- **Primary Key:** `id`
- **Indexes:** (primary only)
- **Type:** `StyleLibraryRecord`
- **Record Structure:**
  - `id: string` (PK)
  - `library: StyleLibrary` (from world-schema: palettes, styles, themes)
  - `savedAt: number`
- **Purpose:** Color palettes, artistic styles, composition styles for image generation
- **Data Type:** ESSENTIAL (project configuration)

---

### Version 3 (Image Blob Split)

#### Store: `imageBlobs` (v3+)
- See above (moved from `images` table)

---

### Version 4 (Content Tree for Pre-Print)

#### Store: `contentTrees`
- **Primary Key:** `[projectId+simulationRunId]` (compound)
- **Indexes:** (primary only)
- **Type:** `ContentTreeState`
- **Record Structure:**
  - `projectId: string`, `simulationRunId: string` (compound PK)
  - `nodes: ContentTreeNode[]` — hierarchical tree structure:
    - Each node: `id, name, type: "folder" | "entity" | "chronicle" | "static_page" | "era_narrative"`
    - `children?: ContentTreeNode[]`, `contentId?: string` (for leaf nodes)
  - `updatedAt: number`
- **Purpose:** User-defined ordering of content in pre-print book (drag-drop structure)
- **Data Type:** ESSENTIAL (user curation)

---

### Version 5 (Relationships Store)

#### Store: `relationships`
- **Primary Key:** `[simulationRunId+src+dst+kind]` (compound)
- **Indexes:** `simulationRunId`, `src`, `dst`, `kind`
- **Type:** `PersistedRelationship extends WorldRelationship`
- **Record Structure:**
  - From `WorldRelationship` (world-schema): `src: string`, `dst: string`, `kind: string`, `strength?: number`
  - Plus: `simulationRunId: string` (scoping)
- **Purpose:** Entity relationship graph (decoupled from hard state in v5+)
- **Data Type:** ESSENTIAL (world simulation structure)

---

### Version 6 (Simulation Slots Metadata)

#### Store: `simulationSlots`
- **Primary Key:** `[projectId+slotIndex]` (compound)
- **Indexes:** `projectId`, `slotIndex`, `simulationRunId`
- **Type:** `SimulationSlotRecord`
- **Record Structure:**
  - `projectId: string`, `slotIndex: number` (compound PK)
  - `simulationRunId: string` (required — always present for saved slots)
  - `finalTick?: number` (absent until simulation completes)
  - `finalEraId?: string` (absent until simulation completes)
  - `label?: string` (user-assigned label, absent if not set)
  - `isTemporary?: boolean` (absent = not temporary)
  - `updatedAt: number`
- **Purpose:** Discrete metadata for saved simulation runs (slot root info)
- **Data Type:** ESSENTIAL (user run tracking)
- **Design Note:** No full simulation state here — just pointers to entityId, relationships, narrativeEvents in their respective tables

---

### Version 7 (Schema + Coordinate State)

#### Store: `worldSchemas`
- **Primary Key:** `projectId`
- **Indexes:** (primary only)
- **Type:** `WorldSchemaRecord`
- **Record Structure:**
  - `projectId: string` (PK)
  - `schema: CanonrySchemaSlice` (entity kinds, relationship kinds, cultures, etc.)
  - `updatedAt: number`
- **Purpose:** Shared read access to world schema (project configuration)
- **Data Type:** ESSENTIAL (project configuration — from canonry)

#### Store: `coordinateStates`
- **Primary Key:** `simulationRunId`
- **Indexes:** (primary only)
- **Type:** `CoordinateStateRecord`
- **Record Structure:**
  - `simulationRunId: string` (PK)
  - `coordinateState: CoordinateState` (semantic coordinate space state)
  - `updatedAt: number`
- **Purpose:** Semantic coordinate system state for entity placement
- **Data Type:** DERIVED (can be recomputed from entity coordinates)

---

### Version 8 (Era Narratives)

#### Store: `eraNarratives`
- **Primary Key:** `narrativeId`
- **Indexes:** `projectId`, `simulationRunId`, `eraId`, `status`, `createdAt`
- **Type:** `EraNarrativeRecord`
- **Record Structure:**
  - `narrativeId: string`, `projectId: string`, `simulationRunId: string`
  - `eraId: string`, `eraName: string`
  - `status: EraNarrativeStatus` (pending → generating → step_complete → complete/cancelled/failed)
  - `error?: string`
  - **Tone & Direction:**
    - `tone: EraNarrativeTone` (witty, cantankerous, bemused, defiant, sardonic, tender, hopeful, enthusiastic)
    - `arcDirection?: string` (optional override for thesis framing)
    - `editInsertion?: string` (optional passage to weave in during copy edit)
    - `historianConfigJson: string`
  - **Pipeline Steps:**
    - `currentStep: "threads" | "generate" | "edit"`
    - `prepBriefs: EraNarrativePrepBrief[]` (per-chronicle input briefs)
    - `worldContext?: EraNarrativeWorldContext` (era summaries, dynamics, culture identities)
  - **Thread Synthesis Output:**
    - `threadSynthesis?: EraNarrativeThreadSynthesis` (threads, thesis, quotes, strategic dynamics)
  - **Content:**
    - `narrative?: EraNarrativeContent` (legacy single object, backward compat)
    - `contentVersions?: EraNarrativeContentVersion[]` (versioned content — generate/edit steps)
    - `activeVersionId?: string` (user-selected active version)
  - **Cover & Images:**
    - `coverImage?: EraNarrativeCoverImage` (cover scene generation state)
    - `imageRefs?: EraNarrativeImageRefs` (inline images — chronicle refs + new scenes)
  - **Cost:**
    - `totalInputTokens: number`, `totalOutputTokens: number`, `totalActualCost: number`
  - **Metadata:**
    - `createdAt: number`, `updatedAt: number`
- **Purpose:** Era-scoped historical narrative compilation (from chronicles + historian prep briefs)
- **Data Type:** ESSENTIAL (user review state) + GENERATED (LLM-produced threads/content)

---

### Version 9 (Precomputed Run Indexes)

#### Store: `runIndexes`
- **Primary Key:** `simulationRunId`
- **Indexes:** (primary only)
- **Type:** `RunIndexRecord`
- **Record Structure:**
  - `simulationRunId: string` (PK)
  - `prominenceScale: ProminenceScale` (from world-schema)
  - `renownedThreshold: number` (prominence level threshold)
  - `eraTemporalInfo: EraTemporalEntry[]` (all eras with temporal bounds)
    - Each entry: `id, name, summary, order, startTick, endTick, duration`
  - `eraIdAliases: Record<string, string>` (entityId → eraId lookup)
  - `prominentByCulture: Record<string, Array<{ id, name }>>` (prominent entities per culture)
  - `computedAt: number`
- **Purpose:** Precomputed structural indexes (computed once at seed/sync, stable across enrichment)
- **Data Type:** DERIVED/CACHE (recomputable from entities + eras, but cached for performance)

---

### Version 10 (Page Layout Overrides)

#### Store: `pageLayouts`
- **Primary Key:** `[simulationRunId+pageId]` (compound)
- **Indexes:** `simulationRunId`
- **Type:** `PageLayoutOverride`
- **Record Structure:**
  - `pageId: string`, `simulationRunId: string` (compound PK)
  - `layoutMode?: "flow" | "margin" | "centered"`
  - `annotationDisplay?: "full" | "popout" | "disabled"`
  - `annotationPosition?: "sidenote" | "inline" | "footnote"`
  - `imageLayout?: "float" | "margin" | "block" | "hidden"`
  - `contentWidth?: "narrow" | "standard" | "wide"`
  - `dropcap?: boolean`, `textAlign?: "left" | "center" | "justify"`
  - `customClass?: string`
  - `updatedAt: number`
- **Purpose:** Per-page layout overrides for pre-print rendering (bypasses heuristics)
- **Data Type:** ESSENTIAL (user curation)

---

### Version 11 (Catalog Metadata on Images)

No new store — adds fields to `images` (artisticStyleId, compositionStyleId, colorPaletteId, title, tags). These are used for client-side filtering in catalog builder, not Dexie queries.

---

### Version 12 (Upscale Blob Tables)

#### Store: `upscaleBlobs` & `upscaleTestBlobs`
- See above

---

## Store Summary Table

| # | Store | Key | Type | Data Type | Scoping |
|---|-------|-----|------|-----------|---------|
| 1 | entities | id | PersistedEntity | ESSENTIAL | simulationRunId |
| 2 | narrativeEvents | id | PersistedNarrativeEvent | ESSENTIAL | simulationRunId |
| 3 | chronicles | chronicleId | ChronicleRecord | ESSENTIAL | simulationRunId |
| 4 | images | imageId | ImageRecord | MIXED | projectId, entityId, chronicleId |
| 5 | imageBlobs | imageId | ImageBlobRecord | GENERATED | imageId |
| 6 | upscaleBlobs | blobId | UpscaleBlobRecord | GENERATED | imageId |
| 7 | upscaleTestBlobs | testId | UpscaleTestBlobRecord | TEMPORARY | sourceImageId (narrative) |
| 8 | costs | id | CostRecord | DERIVED/CACHE | projectId, simulationRunId |
| 9 | traitPalettes | id | TraitPalette | ESSENTIAL | projectId, entityKind |
| 10 | usedTraits | id | UsedTraitRecord | DERIVED/CACHE | simulationRunId, entityId |
| 11 | historianRuns | runId | HistorianRun | ESSENTIAL + GENERATED | simulationRunId |
| 12 | summaryRevisionRuns | runId | SummaryRevisionRun | ESSENTIAL + GENERATED | simulationRunId |
| 13 | dynamicsRuns | runId | DynamicsRun | ESSENTIAL + GENERATED | simulationRunId |
| 14 | staticPages | pageId | StaticPage | ESSENTIAL | projectId |
| 15 | styleLibrary | id | StyleLibraryRecord | ESSENTIAL | (global) |
| 16 | contentTrees | [projectId+simulationRunId] | ContentTreeState | ESSENTIAL | projectId, simulationRunId |
| 17 | relationships | [simulationRunId+src+dst+kind] | PersistedRelationship | ESSENTIAL | simulationRunId |
| 18 | simulationSlots | [projectId+slotIndex] | SimulationSlotRecord | ESSENTIAL | projectId |
| 19 | worldSchemas | projectId | WorldSchemaRecord | ESSENTIAL | projectId |
| 20 | coordinateStates | simulationRunId | CoordinateStateRecord | DERIVED | simulationRunId |
| 21 | eraNarratives | narrativeId | EraNarrativeRecord | ESSENTIAL + GENERATED | simulationRunId |
| 22 | runIndexes | simulationRunId | RunIndexRecord | DERIVED/CACHE | simulationRunId |
| 23 | pageLayouts | [simulationRunId+pageId] | PageLayoutOverride | ESSENTIAL | simulationRunId |

---

## Data Type Classification

### ESSENTIAL (User Content)
- `entities` — world entities from simulation
- `narrativeEvents` — world events
- `chronicles` — user-created/published chronicles
- `traitPalettes` — project trait library
- `staticPages` — user-authored content
- `styleLibrary` — color/style configurations
- `contentTrees` — user-defined pre-print structure
- `relationships` — world structure
- `simulationSlots` — user run tracking
- `worldSchemas` — project configuration
- `eraNarratives` — era-scoped narratives
- `historianRuns` — historian review state (persisted workflow)
- `summaryRevisionRuns` — summary revision workflow state
- `dynamicsRuns` — dynamics generation workflow state
- `pageLayouts` — page-level curation

### GENERATED (LLM + API Output)
- `images` (blob part) — generated images
- `imageBlobs` — generated image binaries
- `upscaleBlobs` — upscaled image variants
- Chronicles: `assembledContent`, `perspectiveSynthesis`, `historianNotes`, etc.
- Historian/Dynamics/SummaryRevision runs: LLM-generated notes, patches, dynamics

### DERIVED/CACHE (Recomputable)
- `costs` — aggregable from other records (but cached for audit trail)
- `usedTraits` — derived from trait palette + entity assignments
- `coordinateStates` — derived from entity coordinates
- `runIndexes` — precomputed from entities + eras at seed/sync time

### TEMPORARY
- `upscaleTestBlobs` — ephemeral test upscale experiments

---

## Canonry Database Status

**There is NO separate Canonry IndexedDB database.**

All Canonry data is persisted to the shared `illuminator` database:
- Schema from canonry is stored in `worldSchemas` table
- Chronicle definitions, colors, styles from canonry are in `styleLibrary`
- User-authored content from canonry's editor is in the illuminator DB alongside illuminator data

This unified approach avoids data fragmentation and simplifies multi-app orchestration.

---

## Key Design Patterns

### Scoping Strategy
- **simulationRunId**: Groups all world-dependent data (entities, events, chronicles) to a specific world generation run
- **projectId**: Groups project configuration (schema, trait palettes, static pages)
- Compound keys (e.g., [projectId+slotIndex]) for multi-tenant slot tracking

### Versioning
- Chronicles: multiple `generationHistory` versions with step/sampling metadata
- Era Narratives: `contentVersions` for generate/edit steps
- Schema migrations: 12 versions with upgrade handlers (image blob split in v3)

### Binary Data Optimization
- v3+: Image blobs moved to separate table (`imageBlobs`) for fast metadata queries on `images` table
- Upscale variants keyed by "{imageId}:{width}x{height}" to allow multiple resolution tiers

### User Review Workflows
- Historian/SummaryRevision/Dynamics runs persist intermediate state in IndexedDB as shared mailbox between worker and UI
- Multiple batches with per-item accept/reject tracking
- Full conversation history (for dynamics) or per-batch context (for summary revision)

### Cost Audit Trail
- `costs` table indexes by type, model, and context (entity, chronicle) for slicing
- All major enrichment operations log costs for project-level expense tracking
