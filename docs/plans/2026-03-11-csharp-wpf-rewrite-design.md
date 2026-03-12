# The Canonry Desktop — C# WPF Rewrite Design

**Date:** 2026-03-11
**Status:** Approved
**Target:** .NET 9, WPF, SQLite + EF Core
**Approach:** New repository, preserving existing TypeScript repo for reference and for Pics/Viewer web apps

## Motivation

The TypeScript monorepo has grown to ~275k lines of TS + 54k lines of CSS across 10 apps and 449 React components. At this scale, TypeScript's structural type system causes persistent problems during LLM-assisted development:

- **Type sprawl** — similar-but-different interfaces proliferate across files
- **Attribute guessing** — misspelled or misnamed properties pass silently as `undefined`
- **Undefined sprawl** — optional chaining everywhere instead of required fields
- **No strict typing enforcement** — the compiler doesn't catch errors that a nominal type system would reject
- **Slow debugging** — tracing prop chains across files to find where a misname was introduced

These problems are manageable up to ~100k LOC. Beyond that, when an LLM (or developer) can no longer hold a sufficient portion of the project in context, all four error classes appear consistently. The CLAUDE.md lint discipline rules, `Optional<T>` reasoning requirements, and API discipline sections are process guardrails compensating for what the type system should enforce.

C# solves this at the language level: nullable reference types, nominal typing, sealed hierarchies, exhaustive pattern matching, and compiler errors for misspelled properties.

## Decision: C# + WPF over Rust + Tauri

**Why not Rust + Tauri:**

1. The project is fundamentally a graph processor (entities, relationships, traversal, clustering, contagion). Graph data structures are the textbook hard problem in Rust due to ownership rules. In C#, they're natural reference types.
2. Tauri keeps a web UI layer, meaning TypeScript remains for rendering. This reintroduces type synchronization at the Rust/JS IPC boundary — the same category of problem we're trying to escape.
3. LLM generation quality for C#/.NET is higher than for Rust — deeper training data, fewer ownership/lifetime errors.

**Why WPF over Avalonia:**

Cross-platform is not a concern. The authoring tools are personal-use desktop software. WPF is the most mature, most battle-tested desktop framework in .NET, with the deepest training data for LLM generation.

**Why desktop over web:**

- **Multi-window is native** — each Illuminator workflow, Archivist graph, or Chronicler editor as its own OS window
- **No CORS** — direct HTTP to all external APIs, no relay server needed
- **No IndexedDB** — SQLite on disk with EF Core migrations
- **No Web Worker message passing** — `Task.Run` with typed parameters
- **No SPA state management** — WPF data binding with MVVM
- **Native interaction model** — toolbars, menus, context menus, keyboard shortcuts, dockable panes

## What Stays TypeScript

**Pics** and **Viewer** remain as lightweight standalone web apps in the same repository under `web/`. They are read-only, web-deployable, and consume exported data (catalog JSON + CDN images) from the desktop app. No coupling to the C# solution.

## Solution Structure

```
TheCanonry/
├── TheCanonry.sln
│
├── src/
│   ├── Core/                            # Pure domain logic — no I/O, no UI
│   │   ├── TheCanonry.Engine/           # World generation engine (port of lore-weave/lib)
│   │   │   ├── Engine/                  # WorldEngine, epoch/tick loop
│   │   │   ├── Systems/                 # 11 simulation system implementations
│   │   │   ├── Rules/                   # Filters, conditions, mutations, metrics, graph paths
│   │   │   ├── Templates/              # Template interpreter, growth system
│   │   │   ├── Narrative/               # Narrative event building
│   │   │   ├── Graph/                   # Entity/relationship CRUD, clustering, traversal
│   │   │   ├── Coordinates/             # Semantic coordinate system
│   │   │   ├── Statistics/              # Population tracking, distribution
│   │   │   ├── Selection/               # Template/target selection
│   │   │   ├── Naming/                  # Name-forge service adapter
│   │   │   ├── Pressures/               # Pressure feedback loop
│   │   │   └── Runtime/                 # WorldRuntime facade
│   │   │
│   │   ├── TheCanonry.Schema/           # Domain types, world schema, framework primitives
│   │   │   ├── Domain/                  # EntityKind, RelationshipKind, Culture, Era
│   │   │   ├── Config/                  # EngineConfig, DomainSchema, deserialization
│   │   │   └── Primitives/              # Framework primitives (era, occurrence, supersedes, etc.)
│   │   │
│   │   ├── TheCanonry.NameForge/        # Name generation
│   │   │   ├── Generator/               # Core generation algorithm
│   │   │   └── Rules/                   # Culture-specific naming rules
│   │   │
│   │   └── TheCanonry.Coherence/        # Validation & coherence checking
│   │
│   ├── TheCanonry.Illuminator/          # Illuminator domain logic — the heavyweight
│   │   ├── Enrichment/                  # Enrichment task definitions (~21 task types)
│   │   │   ├── Tasks/                   # One class per task type
│   │   │   ├── Queue/                   # EnrichmentQueue, job lifecycle
│   │   │   └── Prompts/                 # Prompt building for each task type
│   │   ├── Catalog/                     # Catalog analysis, similarity, LLM fill
│   │   ├── ImagePipeline/               # Image generation, upscaling, style assignment
│   │   ├── Chronicle/                   # Chronicle authoring, historian, era narratives
│   │   └── Curation/                    # Image curation, tone ranking, cover images
│   │
│   ├── Infrastructure/                  # External system adapters
│   │   ├── TheCanonry.Persistence/      # SQLite + EF Core
│   │   │   ├── DbContext/               # CanonryDbContext, entity configurations
│   │   │   ├── Migrations/              # EF Core migrations
│   │   │   └── Repositories/            # Repository implementations
│   │   │
│   │   ├── TheCanonry.ApiClients/       # External API clients
│   │   │   ├── Llm/                     # ILlmClient + ClaudeLlmClient, OpenAiLlmClient
│   │   │   ├── Images/                  # IImageClient + BFL, fal.ai, WaveSpeed, OpenAI
│   │   │   └── Shared/                  # HttpClient configuration, retry policies, API key management
│   │   │
│   │   └── TheCanonry.AwsSync/          # S3 sync for publishing
│   │
│   └── TheCanonry.Desktop/             # WPF application
│       ├── Shell/                       # ShellWindow, navigation, DI composition root
│       ├── Illuminator/                 # Illuminator views & ViewModels
│       │   ├── Enrichment/              # Enrichment dashboard, job monitoring
│       │   ├── Catalog/                 # Catalog review, analysis, LLM fill
│       │   ├── Chronicle/               # Chronicle editing, historian review
│       │   ├── ImageCuration/           # Image curation, style management
│       │   └── PrePrint/                # Book layout, content tree, upscaling
│       ├── Archivist/                   # Graph exploration, 3D force graphs, coordinate maps
│       ├── Chronicler/                  # Narrative editing, markdown, timeline
│       ├── Forge/                       # Simulation running (engine UI, dashboard)
│       ├── Coherence/                   # Validation dashboards, charts
│       ├── DomainEditor/                # Schema/config editing (canonry functionality)
│       ├── Cosmographer/                # Coordinate/semantic plane visualization
│       ├── Windows/                     # WindowManager, FeatureWindow, multi-window infrastructure
│       └── Shared/                      # Common controls, converters, base ViewModels, commands
│
├── tests/
│   ├── TheCanonry.Engine.Tests/
│   ├── TheCanonry.Schema.Tests/
│   ├── TheCanonry.NameForge.Tests/
│   ├── TheCanonry.Coherence.Tests/
│   ├── TheCanonry.Illuminator.Tests/
│   ├── TheCanonry.Persistence.Tests/
│   └── TheCanonry.ApiClients.Tests/
│
├── domain/                              # JSON domain configs — carried over unchanged
│   └── default-project/                 # schema.json, eras.json, generators.json, etc.
│
└── web/                                 # Standalone web apps — remain TypeScript
    ├── pics/                            # Image gallery, web-deployable
    └── viewer/                          # World viewer, web-deployable
```

### Dependency Graph

```
Core/  (no external dependencies beyond System.Text.Json)
  ├── TheCanonry.Schema          ← no dependencies
  ├── TheCanonry.Engine          ← depends on Schema
  ├── TheCanonry.NameForge       ← depends on Schema
  └── TheCanonry.Coherence       ← depends on Schema, Engine

TheCanonry.Illuminator           ← depends on Core/*
Infrastructure/                  ← depends on Core/*, Illuminator
  ├── TheCanonry.Persistence     ← depends on Schema, Illuminator (entity types)
  ├── TheCanonry.ApiClients      ← depends on Illuminator (request/response types)
  └── TheCanonry.AwsSync         ← depends on Schema, Persistence

TheCanonry.Desktop               ← depends on everything (composition root)
```

Core/ is pure logic. It compiles and tests without any I/O, UI, or network dependencies.

## Type System Design

### Nominal IDs — Compile-Time Distinct

```csharp
public readonly record struct EntityId(string Value);
public readonly record struct ChronicleId(string Value);
public readonly record struct CultureId(string Value);
public readonly record struct EraId(string Value);
public readonly record struct SimulationSlotId(int Value);
```

These are zero-cost value types. The compiler rejects passing a `ChronicleId` where an `EntityId` is expected.

### Domain-Extensible String Fields — The Core Design Decision

The TS codebase uses `string` for `kind`, `subtype`, `status`, `culture`, and relationship `kind` because domains define their own values via JSON configuration. The C# rewrite must preserve this extensibility while adding type safety. The approach: **string-backed value objects with registry validation at domain load time.**

```csharp
// A DomainValue is a typed wrapper around a domain-defined string.
// It is NOT a free string — it must be registered in a DomainRegistry to be valid.
// But it is NOT a closed enum — domains define their own values in JSON.

public readonly record struct EntityKind(string Value)
{
    public override string ToString() => Value;
}

public readonly record struct RelationshipKind(string Value)
{
    public override string ToString() => Value;
}

public readonly record struct EntityStatus(string Value)
{
    public override string ToString() => Value;
}
```

These are nominally distinct (you can't pass an `EntityKind` where a `RelationshipKind` is expected) but domain-extensible (new values come from JSON, not code changes).

**Framework primitives are static constants, not enum members:**

```csharp
public static class FrameworkPrimitives
{
    // Entity kinds the framework requires
    public static readonly EntityKind Era = new("era");
    public static readonly EntityKind Occurrence = new("occurrence");

    // Relationship kinds the framework requires
    public static readonly RelationshipKind Supersedes = new("supersedes");
    public static readonly RelationshipKind PartOf = new("part_of");
    public static readonly RelationshipKind ActiveDuring = new("active_during");
    public static readonly RelationshipKind ParticipantIn = new("participant_in");
    public static readonly RelationshipKind EpicenterOf = new("epicenter_of");
    public static readonly RelationshipKind TriggeredBy = new("triggered_by");
    public static readonly RelationshipKind CreatedDuring = new("created_during");

    // Status values the framework requires
    public static readonly EntityStatus Active = new("active");
    public static readonly EntityStatus Historical = new("historical");
    public static readonly EntityStatus Current = new("current");
    public static readonly EntityStatus Future = new("future");
    public static readonly EntityStatus Subsumed = new("subsumed");
}
```

**The DomainRegistry validates at domain load time:**

```csharp
public class DomainRegistry
{
    private readonly HashSet<EntityKind> _validEntityKinds = [];
    private readonly HashSet<RelationshipKind> _validRelationshipKinds = [];
    private readonly Dictionary<EntityKind, HashSet<EntityStatus>> _validStatuses = [];

    public DomainRegistry(DomainSchema schema)
    {
        // Register framework primitives
        _validEntityKinds.Add(FrameworkPrimitives.Era);
        _validEntityKinds.Add(FrameworkPrimitives.Occurrence);
        // ...

        // Register domain-defined values from JSON
        foreach (var kindDef in schema.EntityKinds)
        {
            var kind = new EntityKind(kindDef.Name);
            _validEntityKinds.Add(kind);

            foreach (var status in kindDef.Statuses)
                _validStatuses.GetOrAdd(kind).Add(new EntityStatus(status));
        }
    }

    public void Validate(EntityKind kind)
    {
        if (!_validEntityKinds.Contains(kind))
            throw new InvalidDomainValueException($"Unknown entity kind: {kind}");
    }

    public void ValidateStatus(EntityKind kind, EntityStatus status)
    {
        if (!_validStatuses.TryGetValue(kind, out var valid) || !valid.Contains(status))
            throw new InvalidDomainValueException($"Status '{status}' is not valid for entity kind '{kind}'");
    }
}
```

**The result:** Compile-time safety prevents mixing `EntityKind` and `RelationshipKind`. Runtime validation at domain load time prevents typos in JSON configs. Domain authors add new kinds/statuses in JSON without code changes. Framework code uses typed constants (`FrameworkPrimitives.Era`) that the compiler checks. This is strictly better than raw strings (TS) while preserving the extensibility model.

### Prominence — Numeric Scale, Not Enum

Prominence is a continuous `double` (0.0–5.0) with named thresholds derived at display time:

```csharp
public readonly record struct Prominence(double Value)
{
    public string Label => Value switch
    {
        < 1.0 => "Forgotten",
        < 2.0 => "Marginal",
        < 3.0 => "Recognized",
        < 4.0 => "Renowned",
        _ => "Mythic"
    };
}
```

### Entity — Full Domain Object

```csharp
public class Entity
{
    public EntityId Id { get; }
    public EntityKind Kind { get; }
    public string Subtype { get; }
    public string Name { get; private set; }
    public string Description { get; private set; }
    public string Summary { get; private set; }
    public string NarrativeHint { get; private set; }
    public bool LockedSummary { get; private set; }
    public EntityStatus Status { get; private set; }
    public Prominence Prominence { get; private set; }
    public CultureId Culture { get; }
    public EraId EraId { get; }
    public EntityTags Tags { get; }
    public SemanticCoordinates Coordinates { get; private set; }
    public TemporalSpan Temporal { get; private set; }
    public CatalystState Catalyst { get; }
    public RegionId RegionId { get; private set; }
    public IReadOnlyList<RegionId> AllRegionIds { get; private set; }
    public ExecutionContext CreatedBy { get; }
    public int CreatedAtTick { get; }
    public int UpdatedAtTick { get; private set; }

    private readonly List<Relationship> _links = [];
    public IReadOnlyList<Relationship> Links => _links;

    public Entity(EntityId id, EntityKind kind, string subtype, string name,
        CultureId culture, EraId eraId, SemanticCoordinates coordinates,
        ExecutionContext createdBy, int tick) { /* ... */ }

    public void AddLink(Relationship relationship) { /* validation, then add */ }
    public void UpdateStatus(EntityStatus newStatus) { /* ... */ }
    public void Promote(Prominence newProminence) { /* ... */ }
    public bool IsConnectedTo(EntityId other) => _links.Any(l => l.TargetId == other);
    public IEnumerable<Entity> Neighbors(Graph graph) { /* traversal */ }
}

public readonly record struct SemanticCoordinates(double X, double Y, double Z);

public class TemporalSpan
{
    public int StartTick { get; }
    public TickStatus End { get; private set; }  // Active (no end) or Ended(tick)
}

public readonly record struct CatalystState(bool CanAct);
```

### Relationship — Full Domain Object

```csharp
public class Relationship
{
    public EntityId SourceId { get; }
    public EntityId TargetId { get; }
    public RelationshipKind Kind { get; }
    public double Strength { get; private set; }
    public double Distance { get; private set; }
    public string Category { get; }
    public EntityStatus Status { get; private set; }
    public TickStatus Archived { get; private set; }
    public ExecutionContext CatalyzedBy { get; }
    public ExecutionContext CreatedBy { get; }
    public int CreatedAtTick { get; }

    public Relationship(EntityId source, EntityId target, RelationshipKind kind,
        double strength, ExecutionContext createdBy, int tick) { /* ... */ }

    public void Reinforce(double amount) { /* ... */ }
    public void Decay(double rate) { /* ... */ }
    public void Archive(int tick) { /* ... */ }
}
```

### NarrativeEvent — Sealed Hierarchy

NarrativeEvents use a discriminated union via sealed classes. The `NarrativeEventKind` determines the shape:

```csharp
public abstract class NarrativeEvent
{
    public long Id { get; }
    public int Tick { get; }
    public EraId EraId { get; }
    public IReadOnlyList<NarrativeEntityRef> Participants { get; }
    public string Description { get; }
}

// Each event kind is a sealed subclass with kind-specific data
public sealed class EntityCreatedEvent : NarrativeEvent { /* template, batch context */ }
public sealed class RelationshipFormedEvent : NarrativeEvent { /* source, target, kind */ }
public sealed class StatusChangedEvent : NarrativeEvent { /* entity, old/new status, cause */ }
public sealed class ClusterFormedEvent : NarrativeEvent { /* member entities, cluster type */ }
public sealed class EraTransitionEvent : NarrativeEvent { /* old era, new era, trigger */ }
// ... additional kinds as needed during implementation

// ParticipantEffect and EntityEffect as sealed hierarchies
public abstract record EntityEffect;
public sealed record CreatedEffect : EntityEffect;
public sealed record StatusChangeEffect(EntityStatus From, EntityStatus To) : EntityEffect;
public sealed record ProminenceChangeEffect(Prominence From, Prominence To) : EntityEffect;
public sealed record TagAddedEffect(string Key, string Value) : EntityEffect;
public sealed record RelationshipEffect(RelationshipKind Kind, EntityId OtherEntity) : EntityEffect;
public sealed record SubsumedEffect(EntityId IntoEntity) : EntityEffect;
public sealed record ArchivedEffect : EntityEffect;
```

Exhaustive pattern matching on `NarrativeEvent` and `EntityEffect` — the compiler tells you if you miss a case.

### Simulation Systems — Sealed Hierarchy

```csharp
public abstract class SimulationSystem
{
    public required string Name { get; init; }
    public required SystemFilter Filter { get; init; }

    public abstract void Apply(WorldRuntime runtime, int tick);
}

public sealed class ConnectionEvolutionSystem : SimulationSystem { /* ... */ }
public sealed class GraphContagionSystem : SimulationSystem { /* ... */ }
public sealed class ThresholdTriggerSystem : SimulationSystem { /* ... */ }
public sealed class ClusterFormationSystem : SimulationSystem { /* ... */ }
public sealed class TagDiffusionSystem : SimulationSystem { /* ... */ }
public sealed class PlaneDiffusionSystem : SimulationSystem { /* ... */ }
public sealed class EraSpawnerSystem : SimulationSystem { /* ... */ }
public sealed class EraTransitionSystem : SimulationSystem { /* ... */ }
public sealed class UniversalCatalystSystem : SimulationSystem { /* ... */ }
public sealed class RelationshipMaintenanceSystem : SimulationSystem { /* ... */ }
public sealed class GrowthSystem : SimulationSystem { /* ... */ }
```

### JSON Domain Config — Shared Contract

The JSON files under `domain/default-project/` are the shared contract between the C# desktop app and the TypeScript web apps. The C# types deserialize the same JSON:

```csharp
// System.Text.Json source generators — compile-time verified serialization
[JsonSerializable(typeof(DomainSchema))]
[JsonSerializable(typeof(EraConfig[]))]
[JsonSerializable(typeof(TemplateConfig[]))]
internal partial class DomainJsonContext : JsonSerializerContext { }

// Loading is type-safe — misspelled JSON fields cause deserialization errors at load time
var schema = JsonSerializer.Deserialize(json, DomainJsonContext.Default.DomainSchema);

// After loading, build the DomainRegistry for runtime validation of domain-defined values
var registry = new DomainRegistry(schema);
```

No schema changes to the JSON files. Type equivalence between the TS and C# representations. The `DomainRegistry` is constructed once at load time and injected into the engine and all services that create entities or relationships.

## Persistence — SQLite + EF Core

### Database Schema

```csharp
public class CanonryDbContext : DbContext
{
    // Simulation state
    public DbSet<SimulationSlot> SimulationSlots => Set<SimulationSlot>();
    public DbSet<Entity> Entities => Set<Entity>();
    public DbSet<Relationship> Relationships => Set<Relationship>();
    public DbSet<NarrativeEvent> NarrativeEvents => Set<NarrativeEvent>();

    // Illuminator enrichment
    public DbSet<Chronicle> Chronicles => Set<Chronicle>();
    public DbSet<HistorianRun> HistorianRuns => Set<HistorianRun>();
    public DbSet<EraNarrative> EraNarratives => Set<EraNarrative>();
    public DbSet<DynamicsRun> DynamicsRuns => Set<DynamicsRun>();
    public DbSet<SummaryRevisionRun> SummaryRevisionRuns => Set<SummaryRevisionRun>();

    // Image pipeline
    public DbSet<ImageRecord> Images => Set<ImageRecord>();
    public DbSet<StyleLibrary> StyleLibraries => Set<StyleLibrary>();
    public DbSet<TraitPalette> TraitPalettes => Set<TraitPalette>();

    // Task persistence
    public DbSet<EnrichmentJob> EnrichmentJobs => Set<EnrichmentJob>();

    // Cost tracking
    public DbSet<ApiCostEntry> Costs => Set<ApiCostEntry>();

    // Content / publishing
    public DbSet<ContentTree> ContentTrees => Set<ContentTree>();
    public DbSet<PageLayout> PageLayouts => Set<PageLayout>();
    public DbSet<StaticPage> StaticPages => Set<StaticPage>();
}
```

### File Storage Layout

```
%AppData%/TheCanonry/
├── data/
│   ├── canonry.db              # SQLite database
│   └── canonry.db-wal          # Write-ahead log
├── images/
│   ├── {slotId}/
│   │   ├── {imageId}.png       # Generated images
│   │   └── {imageId}.hq.png    # Upscaled variants
├── exports/                    # Web export output (catalog.json, etc.)
└── logs/                       # Application logs
```

Image blobs are files on disk, not database rows. The DB stores metadata + file paths. This is simpler, faster, and allows browsing/exporting images with normal file tools.

### Migration from IndexedDB

Migrating existing data from the TS app's IndexedDB stores into SQLite is a non-trivial one-time effort:

**What must be exported:** 21 IndexedDB object stores across Illuminator (entities, narrative events, relationships, chronicles, historian runs, era narratives, dynamics runs, images, image blobs, upscale blobs, style libraries, trait palettes, costs, content trees, page layouts, static pages, simulation slots, world schemas, coordinate states, summary revision runs, run indexes).

**Approach:** Build a browser-side export tool in the existing TS app that:
1. Reads all IndexedDB stores and serializes to JSON (one file per store)
2. Extracts image blobs to individual files with matching IDs
3. Packages everything into a ZIP or directory structure

Then build a C# import tool that:
1. Reads the exported JSON files
2. Deserializes using the C# domain types (validating type equivalence)
3. Writes to SQLite via EF Core
4. Copies image files to the filesystem layout

This is a dedicated migration milestone in the implementation plan, not an afterthought. The export side requires knowledge of every IndexedDB schema version and the import side must handle the data shape mapping. Estimate: 1-2 weeks of focused effort.

## Illuminator Architecture

### Enrichment Task System

Every enrichment task is a typed class. No Web Workers, no message serialization, no `postMessage`.

```csharp
public abstract class EnrichmentTask<TInput, TOutput>
    where TInput : class
    where TOutput : class
{
    public abstract string TaskType { get; }

    public abstract Task<TOutput> ExecuteAsync(
        TInput input,
        IProgress<TaskProgress> progress,
        CancellationToken ct);
}
```

Concrete task implementations (one per task type, ~21 currently in the TS codebase — exact count to be verified during implementation). The compiler enforces input/output contracts.

### Task Persistence & Observability

Every enrichment job gets a database record tracking its full lifecycle. This is a first-class improvement over the TypeScript implementation where the activity log cleared on refresh and tasks failed silently.

```csharp
public enum JobStatus { Queued, Running, Completed, Failed, Cancelled }

public class EnrichmentJob
{
    public long Id { get; private set; }
    public string TaskType { get; init; }
    public EntityId TargetEntityId { get; init; }
    public SimulationSlotId SlotId { get; init; }

    // Lifecycle
    public JobStatus Status { get; private set; } = JobStatus.Queued;
    public DateTime QueuedAt { get; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    // Cost tracking
    public int InputTokens { get; private set; }
    public int OutputTokens { get; private set; }
    public decimal EstimatedCost { get; private set; }

    // Failure handling — errors are captured, never swallowed
    public string? ErrorMessage { get; private set; }
    public string? ErrorDetail { get; private set; }
    public int AttemptCount { get; private set; }

    // Progress
    public string? ProgressMessage { get; private set; }
    public double? ProgressFraction { get; private set; }

    public void MarkRunning() { Status = JobStatus.Running; StartedAt = DateTime.UtcNow; AttemptCount++; }
    public void MarkCompleted(TokenUsage usage) { /* ... */ }
    public void MarkFailed(Exception ex) { /* captures message + full detail */ }
}
```

**Guarantees:**

- Jobs are persisted to DB *before* entering the processing channel — survive crashes
- Every failure writes error details to DB and fires a `JobFailed` event to the UI
- On startup, orphaned `Running` jobs are marked `Failed` with "process terminated"
- Failed jobs can be retried with `AttemptCount` preserved
- Cost is tracked per-job, queryable and aggregatable
- Full job history is queryable: `SELECT * FROM EnrichmentJobs WHERE SlotId = @slot ORDER BY QueuedAt`

### Enrichment Queue

```csharp
public class EnrichmentQueue
{
    private readonly Channel<long> _channel;
    private readonly IServiceScopeFactory _scopeFactory;

    public event EventHandler<EnrichmentJob>? JobEnqueued;
    public event EventHandler<EnrichmentJob>? JobStarted;
    public event EventHandler<EnrichmentJob>? JobCompleted;
    public event EventHandler<(EnrichmentJob Job, Exception Error)>? JobFailed;
    public event EventHandler<EnrichmentJob>? JobCancelled;

    public async Task<EnrichmentJob> EnqueueAsync<TInput>(
        string taskType, EntityId target, TInput input, CancellationToken ct) { /* ... */ }

    public async Task ProcessAsync(int maxConcurrency, CancellationToken ct) { /* ... */ }
}
```

### API Clients

All external API calls go through typed client interfaces. No CORS relay — `HttpClient` calls APIs directly from the desktop.

```csharp
public interface ILlmClient
{
    Task<LlmResponse> CompleteAsync(LlmRequest request, CancellationToken ct);
    IAsyncEnumerable<LlmChunk> StreamAsync(LlmRequest request, CancellationToken ct);
}

public interface IImageClient
{
    ImageProvider Provider { get; }
    Task<ImageResult> GenerateAsync(ImageRequest request, CancellationToken ct);
}
```

Implementations: `ClaudeLlmClient`, `OpenAiLlmClient`, `BflImageClient`, `FalImageClient`, `WaveSpeedImageClient`, `OpenAiImageClient`.

### Prompt Management

Each enrichment task type has prompt construction logic — system prompts, user prompt assembly from entity/chronicle data, response parsing. In the TS codebase, prompts are built inline in each task file via string interpolation.

In C#, prompts are managed as **embedded resource files** with typed builder classes:

```csharp
// Prompt templates as embedded .txt resources in the Enrichment/Prompts/ directory
// Each task has a system prompt template and a user prompt builder

public class DescriptionPromptBuilder
{
    private static readonly string SystemPrompt =
        EmbeddedResource.Load("Prompts.Description.System.txt");

    public LlmRequest Build(Entity entity, DomainSchema schema, NarrativeStyle style)
    {
        // Typed parameters — compiler catches missing fields
        var userPrompt = $"""
            Entity: {entity.Name} ({entity.Kind.Value} / {entity.Subtype})
            Culture: {entity.Culture.Value}
            Status: {entity.Status.Value}
            Era: {entity.EraId.Value}
            Existing tags: {entity.Tags.Format()}
            Narrative style: {style.Name}
            """;

        return new LlmRequest(SystemPrompt, userPrompt);
    }
}
```

Embedded resources are compiled into the assembly — no file path issues, no missing templates at runtime. Prompt versioning tracks with code versioning via git.

## WPF Shell — Native Desktop Interaction Model

### Design Principle

The interaction model is **native desktop from day one**, not web-style tabs retrofitted into a window. The application uses the full WPF interaction vocabulary:

- **Menu bar** with hierarchical drill-down menus (File, Edit, View, Simulation, Enrichment, Tools, Window, Help)
- **Toolbars** per-context, dockable, customizable
- **Context menus** on all interactive elements — right-click an entity to enrich, view in archivist, open chronicle, etc.
- **Keyboard shortcuts** via `RoutedCommand` — defined once, bound to menu items, toolbar buttons, context menus, and key gestures simultaneously
- **StatusBar** with live enrichment queue status, cost tracking, simulation progress
- **Dockable/resizable panes** via `GridSplitter` — sidebar, main content, detail panel, output log
- **Pop-out windows** — any panel detaches to its own OS-level window with full menu and toolbar

### Multi-Window Architecture

```csharp
public class WindowManager
{
    private readonly IServiceProvider _services;
    private readonly Dictionary<string, Window> _openWindows = [];

    public void OpenInNewWindow<TViewModel>(string windowKey)
        where TViewModel : ViewModelBase
    {
        if (_openWindows.TryGetValue(windowKey, out var existing))
        {
            existing.Activate();
            return;
        }

        var vm = _services.GetRequiredService<TViewModel>();
        var window = new FeatureWindow { DataContext = vm, Title = vm.DisplayName };
        window.Closed += (_, _) => _openWindows.Remove(windowKey);
        _openWindows[windowKey] = window;
        window.Show();
    }
}
```

Any functional area — Illuminator Catalog, Chronicle Editor, Archivist Graph, Coherence Dashboard — can be opened in its own window and dragged to a second monitor.

### Command System

```csharp
public static class CanonryCommands
{
    // Simulation
    public static RoutedUICommand RunSimulation { get; } = new("Run Simulation", "RunSimulation", typeof(CanonryCommands), new InputGestureCollection { new KeyGesture(Key.F5) });
    public static RoutedUICommand StopSimulation { get; } = new("Stop", "StopSimulation", typeof(CanonryCommands), new InputGestureCollection { new KeyGesture(Key.F5, ModifierKeys.Shift) });

    // Enrichment
    public static RoutedUICommand EnrichEntity { get; } = new("Enrich", "EnrichEntity", typeof(CanonryCommands));
    public static RoutedUICommand EnrichBulk { get; } = new("Enrich Selected", "EnrichBulk", typeof(CanonryCommands));

    // Navigation
    public static RoutedUICommand OpenInNewWindow { get; } = new("Open in New Window", "OpenInNewWindow", typeof(CanonryCommands));
    public static RoutedUICommand ViewInArchivist { get; } = new("View in Archivist", "ViewInArchivist", typeof(CanonryCommands));
}
```

A single command is surfaced in the menu bar, the toolbar, the context menu, and via keyboard shortcut — all bound to the same handler. This is how WPF is designed to work.

### MVVM Pattern

ViewModels expose observable properties. WPF data binding propagates state changes to the UI automatically.

```csharp
public class EnrichmentDashboardViewModel : ViewModelBase
{
    public ObservableCollection<EnrichmentJobViewModel> ActiveJobs { get; } = [];
    public ObservableCollection<EnrichmentJobViewModel> RecentFailures { get; } = [];
    public int QueuedCount { get => _queuedCount; private set => SetProperty(ref _queuedCount, value); }
    public decimal TotalCostToday { get => _totalCost; private set => SetProperty(ref _totalCost, value); }
}
```

No Zustand. No React re-render cycles. No stale closures. State changes flow through data binding.

## Visualization Strategy

Visualizations from the TypeScript app are reimplemented using .NET equivalents:

| Current (TS/Web) | C#/WPF Equivalent | Notes |
|---|---|---|
| Three.js / react-force-graph-3d | HelixToolkit.Wpf + custom force simulation | HelixToolkit provides 3D rendering but not force-directed layout. Force simulation must be implemented separately (port D3-force algorithm or use a graph layout library). This is the most technically challenging visualization to reimplement. |
| D3 / @visx charts | LiveCharts2 or ScottPlot | Good ecosystem match — heatmaps, hierarchies, axes, tooltips all available |
| Cytoscape.js | MSAGL for layout + WPF canvas for rendering | MSAGL computes static layouts, not interactive exploration. Interactive panning/zooming/selection is custom WPF work on top. |
| Canvas 2D drawing | SkiaSharp or WPF `DrawingVisual` | Direct equivalent, SkiaSharp is well-suited |
| SVG inline | WPF `Path` / `Geometry` (XAML vector graphics) | Native WPF, straightforward |
| react-markdown | Markdig + custom WPF renderer, or AvalonEdit | Markdig is the standard .NET markdown parser |

These are not 1:1 ports. Each visualization is reimplemented to take advantage of native rendering capabilities. The **Archivist's interactive 3D force-directed graph** is the highest-risk visualization — it requires combining a 3D rendering library with a custom force simulation loop and interactive controls (click to select, drag to reposition, hover to inspect). This should be one of the later migration items, after the core workflow tools are functional.

## What Disappears

| TS/Browser Concern | Status in C# Desktop |
|---|---|
| CORS relay server (BFL, fal.ai) | Eliminated — HttpClient calls APIs directly |
| Web Worker message serialization | Eliminated — Task.Run with typed parameters |
| IndexedDB schema migrations (manual JS) | Replaced — EF Core typed migrations |
| Zustand stores (20+) | Replaced — MVVM observable properties |
| Module Federation / micro-frontend wiring | Eliminated — single WPF application |
| Blob URL management | Eliminated — file paths on disk |
| SPA routing / navigation state | Eliminated — native window/pane management |
| postMessage / onmessage event wiring | Eliminated — direct method calls, events |
| Vite build configs (10 apps) | Eliminated — single MSBuild solution |
| Browser dev tools for debugging state | Replaced — Visual Studio debugger, breakpoints, watch windows |

## Migration Strategy

This is a **new repo rewrite**, not an in-place migration.

1. **The existing TypeScript repo is preserved.** It remains the running system until the C# app reaches feature parity for each workflow.
2. **JSON domain configs are copied, not changed.** The `domain/` directory carries over as-is.
3. **Pics and Viewer are copied into `web/` in the new repo.** They continue to work as standalone web apps.
4. **Migration is incremental by functional area.** The C# app doesn't need to replicate all 10 TS apps before being useful. Priority order:
   - Core engine + schema (foundation everything else depends on)
   - Persistence layer (SQLite, repositories)
   - API clients (LLM, image)
   - Illuminator enrichment pipeline (the highest-value workflow)
   - Forge (simulation runner UI)
   - Archivist + Chronicler (exploration tools)
   - Domain Editor, Coherence, Cosmographer (supporting tools)
5. **Data migration is a one-time export/import** from IndexedDB (via the TS app) into SQLite.

## Estimated Scale After Rewrite

Rough estimates. Note: WPF XAML can be more verbose than JSX for equivalent UI, and C# class definitions with explicit properties are longer than TS interfaces. However, entire categories of code disappear (CORS relay, worker message passing, IndexedDB boilerplate, SPA state management, Module Federation, Zustand stores, 58 repository files).

| Layer | TS Lines | Estimated C# Lines | Notes |
|---|---|---|---|
| Core engine + schema | ~80k | ~50-60k | Logic ports directly, no browser boilerplate |
| Illuminator domain logic | ~50k (logic portion) | ~35-45k | Workers → Task.Run eliminates serialization code |
| Infrastructure (persistence, API clients) | ~30k (DB repos, clients) | ~15-20k | EF Core replaces 58 manual IndexedDB repo files |
| Desktop UI (XAML + ViewModels) | ~90k (React + CSS) | ~70-90k | XAML is verbose; offset by eliminating CSS files and SPA concerns |
| **Total C# code** | | **~170-215k** |

The uncertainty in the UI layer is highest — XAML verbosity vs eliminated SPA complexity roughly offset each other, but exact ratios depend on how much WPF resource dictionary / template / style code is needed.
