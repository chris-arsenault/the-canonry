# C# Desktop Parity Delta Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all feature gaps between the TypeScript browser app and the C# desktop app.

**Architecture:** Bottom-up: persistence entities first (foundation), then domain logic (prompt builders, pipelines, catalog), then supporting systems (preprint, bulk ops, config), and finally UI wiring. Each chunk produces testable, working software.

**Tech Stack:** .NET 10, EF Core (SQLite), xUnit, System.Text.Json, SkiaSharp (image processing), System.IO.Compression (ZIP export).

**Desktop repo:** `~/src/the-canonry-desktop/`
**TS reference repo:** `~/src/the-canonry/`

---

## Chunk 1: Missing Persistence Entities + Repositories

The design spec's DbContext lists 17 tables. Only 9 exist. This chunk adds the remaining 9 entity classes, extends the DbContext, adds repositories for all entity types (including 5 existing entities that lack repositories), and tests everything.

### Task 1: NarrativeEvent Entity

Core world data — events emitted during simulation (entity creation, relationship formation, status changes, etc.).

**TS Reference:** `apps/illuminator/webui/src/lib/db/illuminatorDb.ts` (narrativeEvents store), `apps/lore-weave/lib/core/worldTypes.ts` (NarrativeEvent type)

**Files:**
- Create: `src/Infrastructure/TheCanonry.Persistence/Entities/NarrativeEventEntity.cs`
- Test: `tests/TheCanonry.Persistence.Tests/Repositories/NarrativeEventRepositoryTests.cs`

- [ ] **Step 1: Write NarrativeEventEntity**

```csharp
namespace TheCanonry.Persistence.Entities;

public class NarrativeEventEntity
{
    public long Id { get; set; }
    public string SimulationRunId { get; set; } = "";
    public int Tick { get; set; }
    public string EraId { get; set; } = "";
    public string EventKind { get; set; } = ""; // "entity_created", "relationship_formed", etc.
    public double Significance { get; set; }
    public string SubjectId { get; set; } = ""; // Primary entity involved
    public string Action { get; set; } = "";
    public string Description { get; set; } = "";
    public string CausedByJson { get; set; } = "{}"; // JSON: EventCause
    public string NarrativeTagsJson { get; set; } = "[]"; // JSON: string[]
    public string ParticipantEffectsJson { get; set; } = "[]"; // JSON: ParticipantEffect[]
}
```

- [ ] **Step 2: Commit**

---

### Task 2: TraitPalette Entity

Per-entity-kind visual trait categories for image generation guidance.

**TS Reference:** `apps/illuminator/webui/src/lib/db/illuminatorDb.ts` (traitPalettes store), `lib/traitTypes.ts`

**Files:**
- Create: `src/Infrastructure/TheCanonry.Persistence/Entities/TraitPaletteEntity.cs`

- [ ] **Step 1: Write TraitPaletteEntity**

```csharp
namespace TheCanonry.Persistence.Entities;

public class TraitPaletteEntity
{
    public long Id { get; set; }
    public string ProjectId { get; set; } = "";
    public string EntityKind { get; set; } = "";
    public string CategoriesJson { get; set; } = "[]"; // JSON: TraitCategory[]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 2: Commit**

---

### Task 3: StaticPage Entity

User-authored wiki pages (frontmatter, body, linked entities).

**TS Reference:** `lib/staticPageTypes.ts`

**Files:**
- Create: `src/Infrastructure/TheCanonry.Persistence/Entities/StaticPageEntity.cs`

- [ ] **Step 1: Write StaticPageEntity**

```csharp
namespace TheCanonry.Persistence.Entities;

public class StaticPageEntity
{
    public long Id { get; set; }
    public string PageId { get; set; } = ""; // Original string ID from IndexedDB
    public string ProjectId { get; set; } = "";
    public string SimulationRunId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Slug { get; set; } = "";
    public string Content { get; set; } = ""; // Markdown body
    public string? Summary { get; set; }
    public string Status { get; set; } = "draft"; // draft | published
    public string LinkedEntityIdsJson { get; set; } = "[]"; // JSON: string[]
    public int WordCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 2: Commit**

---

### Task 4: ContentTree Entity

Hierarchical document ordering for PrePrint.

**TS Reference:** `lib/preprint/prePrintTypes.ts` (ContentTreeState), `lib/preprint/contentTree.ts`

**Files:**
- Create: `src/Infrastructure/TheCanonry.Persistence/Entities/ContentTreeEntity.cs`

- [ ] **Step 1: Write ContentTreeEntity**

```csharp
namespace TheCanonry.Persistence.Entities;

public class ContentTreeEntity
{
    public long Id { get; set; }
    public string ProjectId { get; set; } = "";
    public string SimulationRunId { get; set; } = "";
    public string TreeJson { get; set; } = "[]"; // JSON: ContentTreeNode[]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 2: Commit**

---

### Task 5: PageLayout Entity

Per-page layout overrides for PrePrint.

**TS Reference:** `lib/preprint/prePrintTypes.ts` (PageLayoutOverride)

**Files:**
- Create: `src/Infrastructure/TheCanonry.Persistence/Entities/PageLayoutEntity.cs`

- [ ] **Step 1: Write PageLayoutEntity**

```csharp
namespace TheCanonry.Persistence.Entities;

public class PageLayoutEntity
{
    public long Id { get; set; }
    public string SimulationRunId { get; set; } = "";
    public string PageId { get; set; } = ""; // References StaticPage, Chronicle, etc.
    public string LayoutMode { get; set; } = "default";
    public string AnnotationDisplay { get; set; } = "inline";
    public string ImageLayout { get; set; } = "float";
    public string ContentWidth { get; set; } = "normal";
    public string SettingsJson { get; set; } = "{}"; // JSON: additional overrides
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 2: Commit**

---

### Task 6: StyleLibrary Entity

Color palettes, artistic styles, composition styles.

**TS Reference:** `packages/world-schema/src/style.ts` (StyleLibrary type)

**Files:**
- Create: `src/Infrastructure/TheCanonry.Persistence/Entities/StyleLibraryEntity.cs`

- [ ] **Step 1: Write StyleLibraryEntity**

```csharp
namespace TheCanonry.Persistence.Entities;

public class StyleLibraryEntity
{
    public long Id { get; set; }
    public string ProjectId { get; set; } = "";
    public string ArtisticStylesJson { get; set; } = "[]";
    public string CompositionStylesJson { get; set; } = "[]";
    public string ColorPalettesJson { get; set; } = "[]";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 2: Commit**

---

### Task 7: WorldSchema Entity

Project domain configuration (entity kinds, relationship kinds, cultures).

**TS Reference:** `apps/illuminator/webui/src/lib/db/illuminatorDb.ts` (worldSchemas store)

**Files:**
- Create: `src/Infrastructure/TheCanonry.Persistence/Entities/WorldSchemaEntity.cs`

- [ ] **Step 1: Write WorldSchemaEntity**

```csharp
namespace TheCanonry.Persistence.Entities;

public class WorldSchemaEntity
{
    public long Id { get; set; }
    public string ProjectId { get; set; } = "";
    public string SchemaJson { get; set; } = "{}"; // Full CanonrySchemaSlice
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 2: Commit**

---

### Task 8: DynamicsRun Entity

World dynamics multi-turn LLM conversation state.

**TS Reference:** `lib/dynamicsGenerationTypes.ts`, illuminatorDb.ts (dynamicsRuns store)

**Files:**
- Create: `src/Infrastructure/TheCanonry.Persistence/Entities/DynamicsRunEntity.cs`

- [ ] **Step 1: Write DynamicsRunEntity**

```csharp
namespace TheCanonry.Persistence.Entities;

public class DynamicsRunEntity
{
    public long Id { get; set; }
    public string RunId { get; set; } = "";
    public string SimulationRunId { get; set; } = "";
    public string MessagesJson { get; set; } = "[]"; // JSON: conversation message history
    public string Status { get; set; } = "pending"; // pending, running, completed, failed
    public string? ResultJson { get; set; } // JSON: generated dynamics content
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 2: Commit**

---

### Task 9: SummaryRevisionRun Entity

Batch entity description revision state.

**TS Reference:** `lib/summaryRevisionTypes.ts`, illuminatorDb.ts (summaryRevisionRuns store)

**Files:**
- Create: `src/Infrastructure/TheCanonry.Persistence/Entities/SummaryRevisionRunEntity.cs`

- [ ] **Step 1: Write SummaryRevisionRunEntity**

```csharp
namespace TheCanonry.Persistence.Entities;

public class SummaryRevisionRunEntity
{
    public long Id { get; set; }
    public string RunId { get; set; } = "";
    public string SimulationRunId { get; set; } = "";
    public string BatchesJson { get; set; } = "[]"; // JSON: batch structure with per-entity patches
    public string Status { get; set; } = "pending";
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 2: Commit**

---

### Task 10: Extend DbContext with All 9 New Entities

**Files:**
- Modify: `src/Infrastructure/TheCanonry.Persistence/CanonryDbContext.cs`

- [ ] **Step 1: Add 9 new DbSets**

Add after line 18 (after existing `Costs` DbSet):

```csharp
public DbSet<NarrativeEventEntity> NarrativeEvents => Set<NarrativeEventEntity>();
public DbSet<TraitPaletteEntity> TraitPalettes => Set<TraitPaletteEntity>();
public DbSet<StaticPageEntity> StaticPages => Set<StaticPageEntity>();
public DbSet<ContentTreeEntity> ContentTrees => Set<ContentTreeEntity>();
public DbSet<PageLayoutEntity> PageLayouts => Set<PageLayoutEntity>();
public DbSet<StyleLibraryEntity> StyleLibraries => Set<StyleLibraryEntity>();
public DbSet<WorldSchemaEntity> WorldSchemas => Set<WorldSchemaEntity>();
public DbSet<DynamicsRunEntity> DynamicsRuns => Set<DynamicsRunEntity>();
public DbSet<SummaryRevisionRunEntity> SummaryRevisionRuns => Set<SummaryRevisionRunEntity>();
```

- [ ] **Step 2: Add OnModelCreating configurations**

Add entity configurations with appropriate keys and indexes:

```csharp
modelBuilder.Entity<NarrativeEventEntity>(e =>
{
    e.HasKey(x => x.Id);
    e.HasIndex(x => x.SimulationRunId);
    e.HasIndex(x => x.EraId);
    e.HasIndex(x => x.Tick);
});

modelBuilder.Entity<TraitPaletteEntity>(e =>
{
    e.HasKey(x => x.Id);
    e.HasIndex(x => new { x.ProjectId, x.EntityKind }).IsUnique();
});

modelBuilder.Entity<StaticPageEntity>(e =>
{
    e.HasKey(x => x.Id);
    e.HasIndex(x => x.SimulationRunId);
    e.HasIndex(x => x.PageId);
});

modelBuilder.Entity<ContentTreeEntity>(e =>
{
    e.HasKey(x => x.Id);
    e.HasIndex(x => new { x.ProjectId, x.SimulationRunId }).IsUnique();
});

modelBuilder.Entity<PageLayoutEntity>(e =>
{
    e.HasKey(x => x.Id);
    e.HasIndex(x => new { x.SimulationRunId, x.PageId }).IsUnique();
});

modelBuilder.Entity<StyleLibraryEntity>(e =>
{
    e.HasKey(x => x.Id);
    e.HasIndex(x => x.ProjectId).IsUnique();
});

modelBuilder.Entity<WorldSchemaEntity>(e =>
{
    e.HasKey(x => x.Id);
    e.HasIndex(x => x.ProjectId).IsUnique();
});

modelBuilder.Entity<DynamicsRunEntity>(e =>
{
    e.HasKey(x => x.Id);
    e.HasIndex(x => x.SimulationRunId);
    e.HasIndex(x => x.RunId);
});

modelBuilder.Entity<SummaryRevisionRunEntity>(e =>
{
    e.HasKey(x => x.Id);
    e.HasIndex(x => x.SimulationRunId);
    e.HasIndex(x => x.RunId);
});
```

- [ ] **Step 3: Run tests to verify existing tests still pass**

```bash
dotnet test tests/TheCanonry.Persistence.Tests/ --verbosity minimal
```

- [ ] **Step 4: Commit**

```bash
git add src/Infrastructure/TheCanonry.Persistence/Entities/ src/Infrastructure/TheCanonry.Persistence/CanonryDbContext.cs
git commit -m "feat: add 9 missing persistence entities — NarrativeEvent, TraitPalette, StaticPage, ContentTree, PageLayout, StyleLibrary, WorldSchema, DynamicsRun, SummaryRevisionRun"
```

---

### Task 11: Repositories for New Entities

Create repositories for all 9 new entities plus the 5 existing entities that lack repositories (PersistedEntity, PersistedRelationship, SimulationSlotEntity, HistorianRun, EraNarrative).

**Files:**
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/EntityRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/RelationshipRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/SimulationSlotRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/HistorianRunRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/EraNarrativeRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/NarrativeEventRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/TraitPaletteRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/StaticPageRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/ContentTreeRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/PageLayoutRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/StyleLibraryRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/WorldSchemaRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/DynamicsRunRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/SummaryRevisionRunRepository.cs`

Each repository follows the established pattern (constructor takes `CanonryDbContext`, async methods, EF Core queries). Key methods per repository:

**EntityRepository:** `GetBySimulation(runId)`, `GetByKind(runId, kind)`, `GetById(id, runId)`, `Search(runId, query)`, `Upsert(entity)`, `Delete(id, runId)`

**RelationshipRepository:** `GetBySimulation(runId)`, `GetByEntity(runId, entityId)`, `Create(rel)`, `Delete(id)`

**SimulationSlotRepository:** `GetByProject(projectId)`, `GetByIndex(projectId, slotIndex)`, `Upsert(slot)`, `Delete(id)`

**HistorianRunRepository:** `GetBySimulation(runId)`, `GetByEntity(runId, entityId)`, `Create(run)`, `Update(run)`, `Delete(id)`

**EraNarrativeRepository:** `GetBySimulation(runId)`, `GetByEra(runId, eraId)`, `Create(narrative)`, `Update(narrative)`, `Delete(id)`

**NarrativeEventRepository:** `GetBySimulation(runId)`, `GetByEra(runId, eraId)`, `GetByEntity(runId, entityId)`, `Create(event)`, `BulkCreate(events)`

**TraitPaletteRepository:** `GetByProject(projectId)`, `GetByKind(projectId, kind)`, `Upsert(palette)`

**StaticPageRepository:** `GetBySimulation(runId)`, `GetByPageId(pageId)`, `Create(page)`, `Update(page)`, `Delete(id)`

**ContentTreeRepository:** `Get(projectId, runId)`, `Upsert(tree)`

**PageLayoutRepository:** `Get(runId, pageId)`, `Upsert(layout)`, `GetBySimulation(runId)`

**StyleLibraryRepository:** `GetByProject(projectId)`, `Upsert(library)`

**WorldSchemaRepository:** `GetByProject(projectId)`, `Upsert(schema)`

**DynamicsRunRepository:** `GetBySimulation(runId)`, `Create(run)`, `Update(run)`, `Delete(id)`

**SummaryRevisionRunRepository:** `GetBySimulation(runId)`, `Create(run)`, `Update(run)`, `Delete(id)`

- [ ] **Step 1: Write EntityRepository and RelationshipRepository**
- [ ] **Step 2: Write SimulationSlotRepository, HistorianRunRepository, EraNarrativeRepository**
- [ ] **Step 3: Write NarrativeEventRepository, TraitPaletteRepository, StaticPageRepository**
- [ ] **Step 4: Write ContentTreeRepository, PageLayoutRepository, StyleLibraryRepository**
- [ ] **Step 5: Write WorldSchemaRepository, DynamicsRunRepository, SummaryRevisionRunRepository**
- [ ] **Step 6: Write tests for all new repositories** — CRUD operations, upsert behavior, query filtering. At least 3 tests per repository = ~42 tests.
- [ ] **Step 7: Run all persistence tests**

```bash
dotnet test tests/TheCanonry.Persistence.Tests/ --verbosity minimal
```

- [ ] **Step 8: Commit**

```bash
git add src/Infrastructure/TheCanonry.Persistence/Repositories/ tests/TheCanonry.Persistence.Tests/
git commit -m "feat: add 14 repositories — complete CRUD coverage for all 18 entity types"
```

---

## Chunk 2: Chronicle Generation Pipeline

The chronicle system is the highest-value Illuminator feature. The C# app has basic 3-step generation (generate→summary→title) but is missing the full V2 pipeline: perspective synthesis, format-specific prompts, copy-edit, image refs extraction, versioning, and wizard flow.

**TS Reference:** `apps/illuminator/webui/src/lib/chronicle/`, `lib/perspectiveSynthesizer.ts`, `lib/perspectiveParsing.ts`, `lib/constellationAnalyzer.ts`

### Task 12: Perspective Synthesis

The perspective synthesizer transforms a constellation of entities into a narrative brief, fact facets, motifs, voice keys, and per-entity writing directives. This is the creative intelligence layer that makes chronicles distinctive.

**Files:**
- Create: `src/TheCanonry.Illuminator/Chronicle/PerspectiveSynthesis/PerspectiveTypes.cs`
- Create: `src/TheCanonry.Illuminator/Chronicle/PerspectiveSynthesis/PerspectiveSynthesizer.cs`
- Create: `src/TheCanonry.Illuminator/Chronicle/PerspectiveSynthesis/ConstellationAnalyzer.cs`
- Create: `src/TheCanonry.Illuminator/Chronicle/PerspectiveSynthesis/PerspectivePrompts.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/Chronicle/PerspectiveSynthesisTests.cs`

- [ ] **Step 1: Write PerspectiveTypes**

Read `lib/perspectiveSynthesizer.ts` and `lib/chronicleTypes.ts` for exact shapes. Key types:
- `PerspectiveResult` — brief, facets, suggestedMotifs, narrativeVoice, entityDirectives, temporalNarrative
- `FactFacet` — factId, interpretation
- `EntityDirective` — entityId, entityName, directive
- `EntityConstellation` — cultural analysis, entity types, themes, relationships
- `CanonFactWithMetadata` — id, text, type (world_truth | generation_constraint), required, disabled

- [ ] **Step 2: Write ConstellationAnalyzer**

Read `lib/constellationAnalyzer.ts`. Static analysis of entity set:
- Culture distribution (counts per culture)
- Kind distribution (entity types in cast)
- Relationship patterns (internal relationships between cast members)
- Thematic signals from shared tags

- [ ] **Step 3: Write PerspectivePrompts**

Read `lib/perspectiveSynthesizer.ts` for exact system/user prompt construction. Critical details:
- System prompt establishes "perspective consultant" role
- Fact type separation: generation_constraints excluded from LLM (returned verbatim), world_truths faceted
- Required facts enforcement
- Cultural identity integration
- NarrativeStyle prose guidance integration

- [ ] **Step 4: Write PerspectiveSynthesizer**

Orchestration: build constellation → assemble facts → call LLM → parse response → enforce required facts → return PerspectiveResult

- [ ] **Step 5: Write tests** — Constellation analysis (culture counts, relationship patterns), prompt construction, fact separation, required fact enforcement. Mock LLM for synthesis. At least 8 tests.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: add perspective synthesis — constellation analysis, fact faceting, narrative voice, entity directives"
```

---

### Task 13: V2 Chronicle Prompt Builder

Replace the basic ChroniclePrompts with the full V2 prompt builder that supports story/document formats, perspective integration, and structured prompt sections.

**TS Reference:** `lib/chronicle/v2/promptBuilder.ts`, `v2/creativePrompt.ts`, `v2/documentPrompt.ts`, `v2/promptSections.ts`

**Files:**
- Modify: `src/TheCanonry.Illuminator/Chronicle/ChroniclePrompts.cs` — rewrite `BuildGenerationSystemPrompt` and `BuildGenerationUserPrompt`
- Create: `src/TheCanonry.Illuminator/Chronicle/V2/StoryPromptBuilder.cs`
- Create: `src/TheCanonry.Illuminator/Chronicle/V2/DocumentPromptBuilder.cs`
- Create: `src/TheCanonry.Illuminator/Chronicle/V2/PromptSections.cs`
- Create: `src/TheCanonry.Illuminator/Chronicle/V2/CopyEditPromptBuilder.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/Chronicle/V2PromptBuilderTests.cs`

- [ ] **Step 1: Write PromptSections**

Read `v2/promptSections.ts`. Static methods that build each prompt section:
- `BuildTaskSection(wordCount, sceneCount)` — requirements
- `BuildNarrativeStructureSection(beatSheet)` — scene progression
- `BuildEventUsageSection(events)` — how to incorporate events
- `BuildEntityDirectivesSection(directives)` — per-entity guidance
- `BuildWritingStyleSection(tone, proseInstructions, craftPosture)` — voice
- `BuildCastSection(entities, roles, descriptions)` — character data with temporal note
- `BuildNarrativeLensSection(lens)` — contextual frame
- `BuildWorldSection(worldContext)` — setting
- `BuildNameBankSection(cultures)` — naming conventions
- `BuildHistoricalContextSection(era, timeline)` — temporal scope
- `BuildRelationshipsAndEventsSection(relationships, events)` — connections

- [ ] **Step 2: Write StoryPromptBuilder**

Read `v2/creativePrompt.ts`. Assembles story-format system+user prompts using PromptSections in correct order (TASK DATA then WORLD DATA).

- [ ] **Step 3: Write DocumentPromptBuilder**

Read `v2/documentPrompt.ts`. Document-format prompts with different structure emphasis.

- [ ] **Step 4: Write CopyEditPromptBuilder**

Read `v2/copyEditPrompt.ts`. Format-specific polish prompts:
- Story: preserve plot, character voice, cut machine-generation patterns
- Document: preserve information, smooth register shifts, tighten padding

- [ ] **Step 5: Update ChroniclePrompts to delegate to V2 builders**

`BuildGenerationSystemPrompt` dispatches to Story or Document builder based on format. `BuildGenerationUserPrompt` dispatches similarly.

- [ ] **Step 6: Write tests** — Section output structure, story vs document prompt differences, copy-edit prompt format. At least 6 tests.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: add V2 chronicle prompt builders — story, document, copy-edit with structured sections"
```

---

### Task 14: Chronicle Pipeline Orchestration

Extend ChronicleTask to support the full pipeline: perspective synthesis → generation → copy-edit → summary → title → image refs. Add version tracking.

**TS Reference:** `workers/tasks/chronicleTask.ts`, `lib/chronicle/shared/assembly.ts`, `lib/chronicle/shared/editing.ts`

**Files:**
- Modify: `src/TheCanonry.Illuminator/Chronicle/ChronicleTask.cs` — add perspective, copy-edit, image refs steps
- Create: `src/TheCanonry.Illuminator/Chronicle/ChronicleVersionManager.cs`
- Create: `src/TheCanonry.Illuminator/Chronicle/ChroniclePipelineOrchestrator.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/Chronicle/ChroniclePipelineTests.cs`

- [ ] **Step 1: Write ChronicleVersionManager**

Manages `ChronicleVersion` snapshots: create version from generation output, track active version, switch between versions. Pure logic, no I/O.

- [ ] **Step 2: Write ChroniclePipelineOrchestrator**

High-level orchestrator for the full pipeline:
1. Run perspective synthesis (if entities provided)
2. Build V2 prompts using perspective result
3. Call LLM for generation
4. Create version snapshot
5. Run copy-edit (optional)
6. Run summary generation
7. Run title generation
8. Run image refs extraction
9. Return full ChronicleRecord with all artifacts

Each step reports progress via `IProgress<TaskProgress>`.

- [ ] **Step 3: Extend ChronicleTask**

Add `StepType` enum entries: `PerspectiveSynthesis`, `CopyEdit`, `ImageRefs`, `Regenerate`, `Creative`, `Combine`, `Compare`. Route each step to appropriate logic.

- [ ] **Step 4: Write tests** — Full pipeline with mock LLM, version creation, copy-edit integration. At least 6 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add chronicle pipeline orchestrator with perspective synthesis, copy-edit, versioning"
```

---

## Chunk 3: Historian, Era Narrative, and Supporting Task Prompts

The enrichment tasks exist as classes but need full prompt construction logic ported from the TS source.

### Task 15: Historian Context Builders

**TS Reference:** `lib/historianContextBuilders.ts`, `workers/tasks/historianReviewTask.ts`, `workers/tasks/historianEditionTask.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/Enrichment/Prompts/HistorianPrompts.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Prompts/HistorianContextBuilder.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/Enrichment/HistorianPromptTests.cs`

- [ ] **Step 1: Write HistorianContextBuilder**

Read `lib/historianContextBuilders.ts`. Assembles context for historian tasks:
- `BuildEditionContext(entity, config, tone, descriptionHistory, relationships, neighbors, chronicleSources, worldContext, previousAnnotations)` → structured context object
- `BuildReviewContext(sourceText, entity|chronicle, config, tone, relationships, neighbors, canonFacts, worldDynamics, previousNotes)` → structured context object
- `BuildCorpusVoiceDigest(existingAnnotations)` → tracks superlatives, overused openings, length distribution
- `CollectPreviousNotes(historianRuns, limit)` → sample for voice continuity

- [ ] **Step 2: Write HistorianPrompts**

Read `workers/tasks/historianReviewTask.ts` and `historianEditionTask.ts` for exact prompts:

**Edition system prompt:** Historian identity + persona + editorial discretion + format guidelines + word budget computation (base × prominence multiplier × revision dampening). Response format: JSON `{ patches: [{ entityId, entityName, entityKind, description }] }`

**Review system prompt:** Historian identity + tone description + annotation guidelines (≤40 words, specific, anchored) + note types (marginalia, tangent, supply) + quality constraints. Response format: JSON `{ annotations: [{ type, anchorPhrase, text }] }`

**Chronology system prompt:** Assigns years to chronicles within era timeline.

**Prep system prompt:** Generate historian's private reading notes for era narrative input.

- [ ] **Step 3: Write tests** — Context assembly, word budget computation, prompt structure. At least 6 tests.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add historian prompt builders — edition, review, chronology, prep with context assembly"
```

---

### Task 16: Era Narrative Prompts

**TS Reference:** `workers/tasks/eraNarrativeTask.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/Enrichment/Prompts/EraNarrativePrompts.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/Enrichment/EraNarrativePromptTests.cs`

- [ ] **Step 1: Write EraNarrativePrompts**

Read `eraNarrativeTask.ts` for the 3-step pipeline prompts:

**Threads step:** "Identify 3-4 thematic strands that bind this era's story" — inputs: chronicle summaries, cultural identities, world dynamics. Output: JSON with threads array.

**Generate step:** Historian voice contextualized for era narrative (not annotation). 5,000–7,000 word target. Inputs: thread synthesis, era context, cultural identities. Output: plain text with sections.

**Edit step:** Copy-edit with craft posture. Output: edited plain text.

**Tone descriptions:** Each of 6 tones (witty, forensic, nostalgic, dire, meditative, elegiac) has distinct built-in tonal relief mechanism.

- [ ] **Step 2: Write tests** — Thread prompt structure, tone-specific system prompts. At least 4 tests.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add era narrative prompts — threads, generate, edit with 6 tone variants"
```

---

### Task 17: Remaining Task Prompts

Port prompts for: dynamics generation, summary revision, chronicle backport, fact coverage, tone ranking, motif variation, palette expansion, entity tag image styles.

**Files:**
- Create: `src/TheCanonry.Illuminator/Enrichment/Prompts/DynamicsPrompts.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Prompts/SummaryRevisionPrompts.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Prompts/BackportPrompts.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Prompts/FactCoveragePrompts.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Prompts/ToneRankingPrompts.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Prompts/MotifVariationPrompts.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Prompts/PaletteExpansionPrompts.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Prompts/EntityTagImageStylesPrompts.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/Enrichment/TaskPromptTests.cs`

- [ ] **Step 1: Write DynamicsPrompts** — Multi-turn synthesis of world-level narrative forces. Read `workers/tasks/dynamicsGenerationTask.ts`.
- [ ] **Step 2: Write SummaryRevisionPrompts** — Batch entity description revision using dynamics. Read `workers/tasks/summaryRevisionTask.ts`.
- [ ] **Step 3: Write BackportPrompts** — Extract lore from published chronicles, patch entity descriptions. Read `workers/tasks/chronicleLoreBackportTask.ts`.
- [ ] **Step 4: Write FactCoveragePrompts** — Rate per-fact presence (missing/mentioned/prevalent/integral). Read `workers/tasks/factCoverageTask.ts`.
- [ ] **Step 5: Write ToneRankingPrompts** — Rank top-3 historian tones by chronicle. Read `workers/tasks/toneRankingTask.ts`.
- [ ] **Step 6: Write MotifVariationPrompts** — Rewrite overused annotation phrases. Read `workers/tasks/motifVariationTask.ts`.
- [ ] **Step 7: Write PaletteExpansionPrompts** — AI-assisted visual trait category curation. Read `workers/tasks/paletteExpansionTask.ts`.
- [ ] **Step 8: Write EntityTagImageStylesPrompts** — Batch LLM ranking of artistic/composition/color styles. Read `workers/tasks/entityTagImageStylesTask.ts`.
- [ ] **Step 9: Write tests** — At least 2 tests per prompt builder (structure + content verification). ~16 tests total.

- [ ] **Step 10: Commit**

```bash
git commit -m "feat: add prompt builders for all remaining enrichment tasks"
```

---

## Chunk 4: World Context & Configuration Management

The browser app stores world context, entity guidance, culture identities, per-call LLM config, image settings, and style libraries. The desktop app needs persistence and management for all of these.

### Task 18: World Context Types and Persistence

**TS Reference:** `lib/worldContextTypes.ts` (if exists), hook `useWorldContextSync`, `useConfigSync`, `useEntityGuidanceSync`

**Files:**
- Create: `src/TheCanonry.Illuminator/Config/WorldContext.cs`
- Create: `src/TheCanonry.Illuminator/Config/EntityGuidance.cs`
- Create: `src/TheCanonry.Illuminator/Config/CultureIdentity.cs`
- Create: `src/TheCanonry.Illuminator/Config/LlmCallConfig.cs`
- Create: `src/TheCanonry.Illuminator/Config/ImageGenerationConfig.cs`
- Create: `src/TheCanonry.Illuminator/Config/ConfigStore.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/Config/ConfigStoreTests.cs`

- [ ] **Step 1: Write WorldContext**

```csharp
public sealed class WorldContext
{
    public required string Name { get; init; }
    public required string Description { get; init; }
    public required string ToneCore { get; init; }
    public required IReadOnlyList<CanonFact> CanonFacts { get; init; }
    public string? SpeciesConstraint { get; init; }
    public string? WorldDynamics { get; set; }
}

public sealed record CanonFact(string Id, string Text, string Type, bool Required, bool Disabled);
```

- [ ] **Step 2: Write EntityGuidance**

Per-entity-kind visual and narrative generation hints:
```csharp
public sealed class EntityGuidance
{
    public required Dictionary<string, KindGuidance> ByKind { get; init; }
}

public sealed record KindGuidance(
    string? DomainInstructions,
    string? VisualAvoid,
    string? ProseHints,
    string? TraitGuidance);
```

- [ ] **Step 3: Write CultureIdentity, LlmCallConfig, ImageGenerationConfig**

- [ ] **Step 4: Write ConfigStore**

Manages persistence of all config types to DB. Uses dedicated columns or JSON storage on a general config table. Alternatively, store as key-value pairs in a `ProjectConfig` table.

- [ ] **Step 5: Write tests** — Round-trip serialization, config retrieval. At least 6 tests.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: add world context, entity guidance, culture identity, and LLM call config types"
```

---

### Task 19: Image Style Assignment

Port the deterministic + LLM-based style assignment system.

**TS Reference:** `lib/imageStyleAssignment.ts`, `lib/catalogDeterministicFill.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/Catalog/ImageStyleAssignment.cs`
- Create: `src/TheCanonry.Illuminator/Catalog/ForbiddenCombinations.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/Catalog/ImageStyleAssignmentTests.cs`

- [ ] **Step 1: Write ImageStyleAssignment**

Read `lib/imageStyleAssignment.ts`. Two algorithms:
- **Primary assignment (deterministic):** Independent balancing of each dimension (artistic, composition, palette). Find most overrepresented candidate, shift to most underrepresented if target appears in item's ranked list. Repeat until spread ≤ 1.
- **Secondary assignment (pair-novelty greedy):** Pick from remaining ranked options excluding primary. Maximize pairwise novelty across corpus. Score combo by counting unused pairs.

- [ ] **Step 2: Write ForbiddenCombinations**

Forbidden artistic×composition pairs that must be swapped to alternatives.

- [ ] **Step 3: Write tests** — Balancing algorithm (uniform distribution from ranked lists), forbidden pair enforcement, secondary novelty maximization. At least 6 tests.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add image style assignment — deterministic balancing + pair-novelty secondary"
```

---

## Chunk 5: Catalog Analysis & Management

### Task 20: Catalog Analysis and Fill Pipeline

**TS Reference:** `lib/catalogAnalysis.ts`, `lib/catalogLlmFill.ts`, `lib/catalogDeterministicFill.ts`, `lib/catalogSimilarity.ts`, `lib/catalogBuilder.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/Catalog/CatalogAnalysis.cs`
- Create: `src/TheCanonry.Illuminator/Catalog/CatalogDeterministicFill.cs`
- Create: `src/TheCanonry.Illuminator/Catalog/CatalogLlmFill.cs`
- Create: `src/TheCanonry.Illuminator/Catalog/CatalogSimilarity.cs`
- Create: `src/TheCanonry.Illuminator/Catalog/CatalogTypes.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/Catalog/CatalogAnalysisTests.cs`

- [ ] **Step 1: Write CatalogTypes**

```csharp
public sealed record FieldCoverage(string FieldName, int Present, int Missing, int Derivable, string? DerivableSource);
public sealed record CoverageReport(IReadOnlyList<FieldCoverage> Fields, int TotalImages);
public sealed record ImageCatalogEntry(string ImageId, string? Title, string? ArtisticStyleId, string? CompositionStyleId, string? ColorPaletteId, IReadOnlyList<string>? Tags, string EntityId, string EntityName, string EntityKind, string Culture, string Model, int Width, int Height, string Aspect, string ThumbPath, string FullPath, string? HqPath);
public sealed record ImageCatalog(int Version, DateTime GeneratedAt, string BaseUrl, IReadOnlyList<ImageCatalogEntry> Images, CatalogFacets Facets);
public sealed record CatalogFacets(IReadOnlyList<string> Styles, IReadOnlyList<string> Palettes, IReadOnlyList<string> EntityKinds, IReadOnlyList<string> Cultures, IReadOnlyList<string> Models, IReadOnlyList<string> ImageTypes);
```

- [ ] **Step 2: Write CatalogAnalysis** — `AnalyzeCoverage(images)` produces per-field completeness report. Fields: imageType, title, tags, artisticStyleId, compositionStyleId, colorPaletteId.

- [ ] **Step 3: Write CatalogDeterministicFill** — Derives metadata from known sources (chronicle image refs for style suggestions, entity name for title). No LLM.

- [ ] **Step 4: Write CatalogLlmFill** — Batch LLM classification of styles, tags, titles. Two modes: text (from prompts) and vision (from image data).

- [ ] **Step 5: Write CatalogSimilarity** — Levenshtein-based title similarity detection. Report pairs above 0.5 threshold.

- [ ] **Step 6: Write tests** — Coverage analysis, deterministic fill from refs, similarity detection. At least 8 tests.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: add catalog analysis, deterministic fill, LLM fill, similarity detection"
```

---

## Chunk 6: PrePrint & Content Management

### Task 21: Content Tree Operations

**TS Reference:** `lib/preprint/contentTree.ts`, `lib/preprint/prePrintTypes.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/PrePrint/ContentTree.cs`
- Create: `src/TheCanonry.Illuminator/PrePrint/PrePrintTypes.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/PrePrint/ContentTreeTests.cs`

- [ ] **Step 1: Write PrePrintTypes**

```csharp
public enum ContentNodeType { Folder, Entity, Chronicle, StaticPage, EraNarrative }

public sealed class ContentTreeNode
{
    public required string Id { get; init; }
    public required string Name { get; set; }
    public required ContentNodeType Type { get; init; }
    public string? ContentId { get; init; }
    public List<ContentTreeNode>? Children { get; set; }
}
```

Plus: `PrePrintStats`, `WordCountBreakdown`, `ImageStats`, `CompletenessStats`, `ExportManifest`, `PageLayoutOverride`.

- [ ] **Step 2: Write ContentTree**

Read `lib/preprint/contentTree.ts`. Pure functions:
- `CreateScaffold()` → default tree (Front Matter, Body, Back Matter)
- `FindNode(tree, id)`, `RenameNode(tree, id, name)`, `DeleteNode(tree, id)`, `MoveNode(tree, id, targetParentId, index)`
- `AddContentItem(tree, parentId, item)` — add entity/chronicle/page to folder
- `FlattenForExport(tree)` → depth-first walk producing `FlattenedNode[]` with slugified paths
- `AutoPopulateBody(tree, entities, chronicles, eraNarratives, staticPages)` — intelligent fill

- [ ] **Step 3: Write tests** — Scaffold creation, node CRUD, flatten, auto-populate. At least 8 tests.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add content tree structure and operations for PrePrint"
```

---

### Task 22: PrePrint Statistics

**TS Reference:** `lib/preprint/prePrintStats.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/PrePrint/PrePrintStatistics.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/PrePrint/PrePrintStatisticsTests.cs`

- [ ] **Step 1: Write PrePrintStatistics**

Static methods:
- `ComputeWordBreakdown(chronicles, entities, eraNarratives, staticPages, historianRuns)` → words by source
- `ComputeImageStats(images)` → distribution by aspect, type, size
- `ComputeCompletenessStats(entities, chronicles, staticPages, eraNarratives)` → coverage flags
- `ComputePrePrintStats(...)` → aggregate all above

- [ ] **Step 2: Write tests** — At least 4 tests.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add PrePrint statistics computation"
```

---

### Task 23: Markdown Export

**TS Reference:** `lib/preprint/markdownExport.ts`, `lib/preprint/markdownFormatters.ts`, `lib/preprint/markdownHelpers.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/PrePrint/Export/MarkdownExporter.cs`
- Create: `src/TheCanonry.Illuminator/PrePrint/Export/MarkdownFormatters.cs`
- Create: `src/TheCanonry.Illuminator/PrePrint/Export/ExportManifestBuilder.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/PrePrint/MarkdownExportTests.cs`

- [ ] **Step 1: Write MarkdownFormatters**

Per-content-type formatting:
- `FormatEntity(entity, historianNotes)` → YAML frontmatter + markdown body + footnotes
- `FormatChronicle(chronicle, historianNotes)` → frontmatter + body + notes
- `FormatStaticPage(page)` → frontmatter + body
- `FormatEraNarrative(narrative)` → frontmatter + body

- [ ] **Step 2: Write MarkdownExporter**

`BuildExportZip(contentTree, data)` → creates ZIP with folder structure matching content tree. Each node becomes `.md` file. Uses `System.IO.Compression.ZipArchive`.

- [ ] **Step 3: Write ExportManifestBuilder** — Aggregates stats and image inventory.

- [ ] **Step 4: Write tests** — Entity formatting, chronicle formatting, ZIP structure. At least 5 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add Markdown export with ZIP packaging"
```

---

### Task 24: ICML/IDML Export

**TS Reference:** `lib/preprint/icmlExport.ts`, `lib/preprint/icmlContent.ts`, `lib/preprint/icmlStyles.ts`, `lib/preprint/idmlExport.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/PrePrint/Export/IcmlExporter.cs`
- Create: `src/TheCanonry.Illuminator/PrePrint/Export/IcmlStyles.cs`
- Create: `src/TheCanonry.Illuminator/PrePrint/Export/IdmlExporter.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/PrePrint/IdmlExportTests.cs`

- [ ] **Step 1: Write IcmlStyles** — Paragraph and character style definitions (section heading, body, blockquote, historian note, caption, etc.)

- [ ] **Step 2: Write IcmlExporter** — Single story XML with typed paragraph/character styles.

- [ ] **Step 3: Write IdmlExporter** — Complete IDML document package: per-entry Stories, 4 master spreads, inline footnotes, callout frames, linked image placeholders, pre-paginated with buffer.

- [ ] **Step 4: Write tests** — Style generation, XML structure validation. At least 4 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add ICML and IDML export for InDesign integration"
```

---

## Chunk 7: Static Pages, Bulk Operations, Supporting Features

### Task 25: Static Page System

**TS Reference:** `lib/staticPageTypes.ts`, `lib/db/staticPageRepository.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/Content/StaticPageService.cs`
- Create: `src/TheCanonry.Illuminator/Content/WikiLinkService.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/Content/StaticPageServiceTests.cs`

- [ ] **Step 1: Write WikiLinkService**

Parse `[[entity-name]]` wiki links in markdown, resolve to entity IDs, extract `linkedEntityIds`. Read `lib/wikiLinkService.ts`.

- [ ] **Step 2: Write StaticPageService**

CRUD operations that maintain computed fields (linkedEntityIds via WikiLinkService, wordCount). Delegates persistence to StaticPageRepository.

- [ ] **Step 3: Write tests** — Wiki link parsing, word count, CRUD. At least 4 tests.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add static page service with wiki link parsing"
```

---

### Task 26: Bulk Operation Framework

**TS Reference:** `components/BulkOperationShell.jsx`, `hooks/useBulkHistorian.ts`, `hooks/useEntityBulkImageOperations.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/BulkOps/BulkOperationRunner.cs`
- Create: `src/TheCanonry.Illuminator/BulkOps/BulkOperationTypes.cs`
- Create: `src/TheCanonry.Illuminator/BulkOps/BulkHistorian.cs`
- Create: `src/TheCanonry.Illuminator/BulkOps/BulkImageStyleTagger.cs`
- Create: `src/TheCanonry.Illuminator/BulkOps/BulkBackport.cs`
- Create: `src/TheCanonry.Illuminator/BulkOps/BulkFactCoverage.cs`
- Create: `src/TheCanonry.Illuminator/BulkOps/BulkEraNarrative.cs`
- Create: `src/TheCanonry.Illuminator/BulkOps/BulkToneRanking.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/BulkOps/BulkOperationTests.cs`

- [ ] **Step 1: Write BulkOperationTypes**

```csharp
public enum BulkOperationStatus { Idle, Confirming, Running, Complete, Failed }
public sealed record BulkOperationProgress(int Total, int Processed, int Failed, BulkOperationStatus Status, IReadOnlyList<BulkFailure> Failures);
public sealed record BulkFailure(string EntityId, string EntityName, string Error);
```

- [ ] **Step 2: Write BulkOperationRunner**

Generic orchestrator: takes a list of items + an async per-item processor + progress callback. Runs items sequentially (matching browser behavior), tracks success/failure, reports progress.

- [ ] **Step 3: Write BulkHistorian** — Review (margin notes with tone cycling), edition (copy-edit), clear operations.
- [ ] **Step 4: Write BulkImageStyleTagger** — Tag styles, assign primary/secondary, clear, generate images.
- [ ] **Step 5: Write BulkBackport, BulkFactCoverage, BulkEraNarrative, BulkToneRanking**
- [ ] **Step 6: Write tests** — Runner with mock processor, progress tracking, failure handling. At least 6 tests.
- [ ] **Step 7: Commit**

```bash
git commit -m "feat: add bulk operation framework with historian, image style, backport, fact coverage, era narrative, tone ranking"
```

---

### Task 27: Entity Rename

**TS Reference:** `lib/entityRename.ts`, `lib/entityRenameScan.ts`, `lib/entityRenamePatchBuild.ts`, `lib/entityRenamePatchApply.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/Operations/EntityRenameService.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/Operations/EntityRenameTests.cs`

- [ ] **Step 1: Write EntityRenameService**

Cross-store rename with consistency scanning:
- `ScanReferences(simulationRunId, entityId, oldName)` → finds all occurrences in entity descriptions, chronicle content, era narrative content, historian notes, static pages
- `BuildPatches(references, oldName, newName)` → text replacement patches
- `ApplyPatches(patches)` → applies via repositories

- [ ] **Step 2: Write tests** — Reference scanning, patch building, application. At least 4 tests.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add entity rename with cross-store consistency scanning"
```

---

### Task 28: Corpus Find/Replace and Coverage Analysis

**Files:**
- Create: `src/TheCanonry.Illuminator/Operations/CorpusFindReplace.cs`
- Create: `src/TheCanonry.Illuminator/Operations/EntityCoverageAnalysis.cs`
- Test: `tests/TheCanonry.Illuminator.Tests/Operations/CorpusFindReplaceTests.cs`

- [ ] **Step 1: Write CorpusFindReplace** — Search across all entity descriptions in a simulation run. Replace with preview.

- [ ] **Step 2: Write EntityCoverageAnalysis** — Per-entity completeness scoring: description presence, image presence, chronicle backrefs, era utilization, relationship density, culture representation.

- [ ] **Step 3: Write tests** — At least 4 tests.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add corpus find/replace and entity coverage analysis"
```

---

## Chunk 8: Wire Stubbed UI Commands

The Forge, Domain Editor, and AWS Sync views have UI but stubbed commands. Wire them to real backends.

### Task 29: Wire Forge to WorldEngine

**Files:**
- Modify: `src/App/ViewModels/ForgeViewModel.cs` — Replace mock tick loop with real WorldEngine invocation

- [ ] **Step 1: Load EngineConfig from domain JSON files**
- [ ] **Step 2: Wire RunSimulationCommand to create WorldEngine and call RunAsync**
- [ ] **Step 3: Wire progress events (tick, era, entity/relationship counts) to UI properties**
- [ ] **Step 4: Wire StopSimulationCommand to CancellationToken**
- [ ] **Step 5: Persist results to SQLite via repositories on completion**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat: wire Forge UI to WorldEngine with real simulation execution"
```

---

### Task 30: Wire Domain Editor to File I/O

**Files:**
- Modify: `src/App/ViewModels/DomainEditorViewModel.cs` — Connect to filesystem

- [ ] **Step 1: Wire LoadCommand to read JSON files from domain directory**
- [ ] **Step 2: Wire SaveCommand to write modified JSON back**
- [ ] **Step 3: Wire ValidateCommand to CoherenceValidator**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat: wire Domain Editor to file I/O and coherence validation"
```

---

### Task 31: Wire AWS Sync UI to S3 Operations

**Files:**
- Modify: `src/App/ViewModels/AwsSyncViewModel.cs` — Connect to AwsSync infrastructure

- [ ] **Step 1: Wire TestConnectionCommand to ImageSyncService.TestConnectionAsync**
- [ ] **Step 2: Wire SyncImagesCommand to ImageSyncService.SyncAsync with progress**
- [ ] **Step 3: Wire UploadCatalogCommand to CatalogBuilder.BuildAndUploadAsync**
- [ ] **Step 4: Add import snapshot command using MigrationService**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: wire AWS Sync UI to S3 operations and migration import"
```

---

## Summary

| Chunk | Tasks | New Files | Tests |
|---|---|---|---|
| 1: Persistence Entities + Repos | 1–11 | 23 entity + repo files | ~50 |
| 2: Chronicle Pipeline | 12–14 | 10 files | ~20 |
| 3: Task Prompts | 15–17 | 12 prompt files | ~26 |
| 4: Config + Style Assignment | 18–19 | 8 files | ~12 |
| 5: Catalog System | 20 | 6 files | ~8 |
| 6: PrePrint | 21–24 | 12 files | ~21 |
| 7: Bulk Ops + Supporting | 25–28 | 14 files | ~18 |
| 8: Data Migration | 29–32 | 22 files | ~28 |
| 9: Wire UI Commands | 33–35 | 0 (modify existing) | 0 (manual verification) |
| **Total** | **35 tasks** | **~107 files** | **~183 tests** |

**Dependency order:** Chunks 1–3 are sequential (persistence → pipeline → prompts). Chunks 4–7 can be parallelized after Chunk 1. Chunk 8 requires all prior chunks. Chunk 9 can run anytime after Chunk 1.
