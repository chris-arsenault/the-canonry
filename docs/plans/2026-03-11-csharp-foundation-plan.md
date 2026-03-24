# Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the C# solution with core domain types, SQLite persistence, and a minimal WPF shell that opens and connects to the database.

**Architecture:** Layered solution — Schema (pure types) → Persistence (EF Core + SQLite) → Desktop (WPF shell). Schema has zero dependencies. Persistence depends on Schema. Desktop depends on both. All domain-extensible string fields use nominal value objects with runtime registry validation.

**Tech Stack:** .NET 10, WPF, EF Core 10, SQLite, xUnit, System.Text.Json source generators

**Design spec:** `docs/plans/2026-03-11-csharp-wpf-rewrite-design.md`

**New repo location:** To be created at `~/src/the-canonry-desktop/` (sibling to existing TS repo)

---

## Chunk 1: Solution Scaffold + Schema Value Objects

### Task 1: Create Solution and Project Structure

**Files:**
- Create: `TheCanonry.sln`
- Create: `src/Core/TheCanonry.Schema/TheCanonry.Schema.csproj`
- Create: `tests/TheCanonry.Schema.Tests/TheCanonry.Schema.Tests.csproj`
- Create: `global.json`
- Create: `.gitignore`
- Create: `Directory.Build.props`

- [ ] **Step 1: Create repo and solution**

```bash
mkdir -p ~/src/the-canonry-desktop
cd ~/src/the-canonry-desktop
git init
dotnet new sln -n TheCanonry
```

- [ ] **Step 2: Create global.json to pin .NET 9**

Create `global.json`:
```json
{
  "sdk": {
    "version": "10.0.0",
    "rollForward": "latestMinor"
  }
}
```

- [ ] **Step 3: Create Directory.Build.props for shared settings**

Create `Directory.Build.props` (note: no `TargetFramework` — set per-project so WPF can target `net10.0-windows`):
```xml
<Project>
  <PropertyGroup>
    <LangVersion>13</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>
</Project>
```

- [ ] **Step 4: Create .gitignore**

```bash
dotnet new gitignore
```

- [ ] **Step 5: Create Schema project**

```bash
mkdir -p src/Core/TheCanonry.Schema
dotnet new classlib -o src/Core/TheCanonry.Schema --no-restore
dotnet sln add src/Core/TheCanonry.Schema/TheCanonry.Schema.csproj
```

After creation, edit `src/Core/TheCanonry.Schema/TheCanonry.Schema.csproj` to add `<TargetFramework>net10.0</TargetFramework>` inside a `<PropertyGroup>` if not already present.

- [ ] **Step 6: Create Schema test project**

```bash
mkdir -p tests/TheCanonry.Schema.Tests
dotnet new xunit -o tests/TheCanonry.Schema.Tests --no-restore
dotnet sln add tests/TheCanonry.Schema.Tests/TheCanonry.Schema.Tests.csproj
dotnet add tests/TheCanonry.Schema.Tests/TheCanonry.Schema.Tests.csproj reference src/Core/TheCanonry.Schema/TheCanonry.Schema.csproj
```

After creation, edit `tests/TheCanonry.Schema.Tests/TheCanonry.Schema.Tests.csproj` to add `<TargetFramework>net10.0</TargetFramework>` inside a `<PropertyGroup>` if not already present.

- [ ] **Step 7: Verify solution builds**

```bash
cd ~/src/the-canonry-desktop
dotnet restore
dotnet build
```
Expected: Build succeeded.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold solution with Schema project and test project"
```

---

### Task 2: Nominal Value Object Types

These are the string-backed value objects that provide compile-time nominal typing for domain-extensible fields.

**Files:**
- Create: `src/Core/TheCanonry.Schema/Ids/EntityId.cs`
- Create: `src/Core/TheCanonry.Schema/Ids/ChronicleId.cs`
- Create: `src/Core/TheCanonry.Schema/Ids/CultureId.cs`
- Create: `src/Core/TheCanonry.Schema/Ids/EraId.cs`
- Create: `src/Core/TheCanonry.Schema/Ids/RegionId.cs`
- Create: `src/Core/TheCanonry.Schema/Ids/SimulationSlotId.cs`
- Create: `src/Core/TheCanonry.Schema/Domain/EntityKind.cs`
- Create: `src/Core/TheCanonry.Schema/Domain/RelationshipKind.cs`
- Create: `src/Core/TheCanonry.Schema/Domain/EntityStatus.cs`
- Create: `src/Core/TheCanonry.Schema/Domain/Prominence.cs`
- Create: `tests/TheCanonry.Schema.Tests/Ids/IdTypeTests.cs`
- Create: `tests/TheCanonry.Schema.Tests/Domain/DomainValueTests.cs`

- [ ] **Step 1: Write failing tests for nominal ID types**

Create `tests/TheCanonry.Schema.Tests/Ids/IdTypeTests.cs`:
```csharp
namespace TheCanonry.Schema.Tests.Ids;

using TheCanonry.Schema.Ids;

public class IdTypeTests
{
    [Fact]
    public void EntityId_wraps_string_value()
    {
        var id = new EntityId("entity-123");
        Assert.Equal("entity-123", id.Value);
        Assert.Equal("entity-123", id.ToString());
    }

    [Fact]
    public void EntityId_equality_is_by_value()
    {
        var a = new EntityId("abc");
        var b = new EntityId("abc");
        Assert.Equal(a, b);
    }

    [Fact]
    public void Different_id_types_are_not_assignable()
    {
        // This test verifies nominal typing at compile time.
        // If it compiles, the types are distinct.
        var entityId = new EntityId("x");
        var chronicleId = new ChronicleId("x");

        // They have the same string value but are different types
        Assert.NotEqual(entityId.GetType(), chronicleId.GetType());
    }

    [Fact]
    public void SimulationSlotId_wraps_int()
    {
        var slot = new SimulationSlotId(3);
        Assert.Equal(3, slot.Value);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: Compilation errors — types don't exist yet.

- [ ] **Step 3: Implement ID types**

Create `src/Core/TheCanonry.Schema/Ids/EntityId.cs`:
```csharp
namespace TheCanonry.Schema.Ids;

public readonly record struct EntityId(string Value)
{
    public override string ToString() => Value;
}
```

Create `src/Core/TheCanonry.Schema/Ids/ChronicleId.cs`:
```csharp
namespace TheCanonry.Schema.Ids;

public readonly record struct ChronicleId(string Value)
{
    public override string ToString() => Value;
}
```

Create `src/Core/TheCanonry.Schema/Ids/CultureId.cs`:
```csharp
namespace TheCanonry.Schema.Ids;

public readonly record struct CultureId(string Value)
{
    public override string ToString() => Value;
}
```

Create `src/Core/TheCanonry.Schema/Ids/EraId.cs`:
```csharp
namespace TheCanonry.Schema.Ids;

public readonly record struct EraId(string Value)
{
    public override string ToString() => Value;
}
```

Create `src/Core/TheCanonry.Schema/Ids/RegionId.cs`:
```csharp
namespace TheCanonry.Schema.Ids;

public readonly record struct RegionId(string Value)
{
    public override string ToString() => Value;
}
```

Create `src/Core/TheCanonry.Schema/Ids/SimulationSlotId.cs`:
```csharp
namespace TheCanonry.Schema.Ids;

public readonly record struct SimulationSlotId(int Value)
{
    public override string ToString() => Value.ToString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: All pass.

- [ ] **Step 5: Write failing tests for domain value objects**

Create `tests/TheCanonry.Schema.Tests/Domain/DomainValueTests.cs`:
```csharp
namespace TheCanonry.Schema.Tests.Domain;

using TheCanonry.Schema.Domain;

public class DomainValueTests
{
    [Fact]
    public void EntityKind_wraps_string()
    {
        var kind = new EntityKind("faction");
        Assert.Equal("faction", kind.Value);
    }

    [Fact]
    public void EntityKind_and_RelationshipKind_are_distinct_types()
    {
        var ek = new EntityKind("alliance");
        var rk = new RelationshipKind("alliance");
        Assert.NotEqual(ek.GetType(), rk.GetType());
    }

    [Fact]
    public void Prominence_label_derived_from_value()
    {
        Assert.Equal("Forgotten", new Prominence(0.5).Label);
        Assert.Equal("Marginal", new Prominence(1.5).Label);
        Assert.Equal("Recognized", new Prominence(2.5).Label);
        Assert.Equal("Renowned", new Prominence(3.5).Label);
        Assert.Equal("Mythic", new Prominence(4.5).Label);
    }

    [Fact]
    public void Prominence_equality_is_by_value()
    {
        Assert.Equal(new Prominence(2.0), new Prominence(2.0));
        Assert.NotEqual(new Prominence(1.0), new Prominence(2.0));
    }
}
```

- [ ] **Step 6: Run tests to verify they fail**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: Compilation errors.

- [ ] **Step 7: Implement domain value objects**

Create `src/Core/TheCanonry.Schema/Domain/EntityKind.cs`:
```csharp
namespace TheCanonry.Schema.Domain;

public readonly record struct EntityKind(string Value)
{
    public override string ToString() => Value;
}
```

Create `src/Core/TheCanonry.Schema/Domain/RelationshipKind.cs`:
```csharp
namespace TheCanonry.Schema.Domain;

public readonly record struct RelationshipKind(string Value)
{
    public override string ToString() => Value;
}
```

Create `src/Core/TheCanonry.Schema/Domain/EntityStatus.cs`:
```csharp
namespace TheCanonry.Schema.Domain;

public readonly record struct EntityStatus(string Value)
{
    public override string ToString() => Value;
}
```

Create `src/Core/TheCanonry.Schema/Domain/Prominence.cs`:
```csharp
namespace TheCanonry.Schema.Domain;

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

    public override string ToString() => $"{Value:F1} ({Label})";
}
```

- [ ] **Step 8: Run all tests**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: All pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add nominal ID types and domain value objects"
```

---

### Task 3: Framework Primitives

**Files:**
- Create: `src/Core/TheCanonry.Schema/Primitives/FrameworkPrimitives.cs`
- Create: `tests/TheCanonry.Schema.Tests/Primitives/FrameworkPrimitivesTests.cs`

- [ ] **Step 1: Write failing tests**

Create `tests/TheCanonry.Schema.Tests/Primitives/FrameworkPrimitivesTests.cs`:
```csharp
namespace TheCanonry.Schema.Tests.Primitives;

using TheCanonry.Schema.Domain;
using TheCanonry.Schema.Primitives;

public class FrameworkPrimitivesTests
{
    [Fact]
    public void Framework_entity_kinds_are_defined()
    {
        Assert.Equal("era", FrameworkPrimitives.EntityKinds.Era.Value);
        Assert.Equal("occurrence", FrameworkPrimitives.EntityKinds.Occurrence.Value);
    }

    [Fact]
    public void Framework_relationship_kinds_are_defined()
    {
        Assert.Equal("supersedes", FrameworkPrimitives.RelationshipKinds.Supersedes.Value);
        Assert.Equal("part_of", FrameworkPrimitives.RelationshipKinds.PartOf.Value);
        Assert.Equal("active_during", FrameworkPrimitives.RelationshipKinds.ActiveDuring.Value);
        Assert.Equal("participant_in", FrameworkPrimitives.RelationshipKinds.ParticipantIn.Value);
        Assert.Equal("epicenter_of", FrameworkPrimitives.RelationshipKinds.EpicenterOf.Value);
        Assert.Equal("triggered_by", FrameworkPrimitives.RelationshipKinds.TriggeredBy.Value);
        Assert.Equal("created_during", FrameworkPrimitives.RelationshipKinds.CreatedDuring.Value);
    }

    [Fact]
    public void Framework_statuses_are_defined()
    {
        Assert.Equal("active", FrameworkPrimitives.Statuses.Active.Value);
        Assert.Equal("historical", FrameworkPrimitives.Statuses.Historical.Value);
        Assert.Equal("current", FrameworkPrimitives.Statuses.Current.Value);
        Assert.Equal("future", FrameworkPrimitives.Statuses.Future.Value);
        Assert.Equal("subsumed", FrameworkPrimitives.Statuses.Subsumed.Value);
    }

    [Fact]
    public void Framework_relationship_default_strengths_are_defined()
    {
        Assert.Equal(0.7, FrameworkPrimitives.GetDefaultRelationshipStrength(
            FrameworkPrimitives.RelationshipKinds.Supersedes));
        Assert.Equal(1.0, FrameworkPrimitives.GetDefaultRelationshipStrength(
            FrameworkPrimitives.RelationshipKinds.ParticipantIn));
    }

    [Fact]
    public void IsFrameworkEntityKind_identifies_framework_kinds()
    {
        Assert.True(FrameworkPrimitives.IsFrameworkEntityKind(new EntityKind("era")));
        Assert.True(FrameworkPrimitives.IsFrameworkEntityKind(new EntityKind("occurrence")));
        Assert.False(FrameworkPrimitives.IsFrameworkEntityKind(new EntityKind("faction")));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: Compilation errors.

- [ ] **Step 3: Implement FrameworkPrimitives**

Create `src/Core/TheCanonry.Schema/Primitives/FrameworkPrimitives.cs`:
```csharp
namespace TheCanonry.Schema.Primitives;

using TheCanonry.Schema.Domain;
using TheCanonry.Schema.Ids;

public static class FrameworkPrimitives
{
    public static class EntityKinds
    {
        public static readonly EntityKind Era = new("era");
        public static readonly EntityKind Occurrence = new("occurrence");

        public static readonly IReadOnlySet<EntityKind> All = new HashSet<EntityKind> { Era, Occurrence };
    }

    public static class RelationshipKinds
    {
        public static readonly RelationshipKind Supersedes = new("supersedes");
        public static readonly RelationshipKind PartOf = new("part_of");
        public static readonly RelationshipKind ActiveDuring = new("active_during");
        public static readonly RelationshipKind ParticipantIn = new("participant_in");
        public static readonly RelationshipKind EpicenterOf = new("epicenter_of");
        public static readonly RelationshipKind TriggeredBy = new("triggered_by");
        public static readonly RelationshipKind CreatedDuring = new("created_during");

        public static readonly IReadOnlySet<RelationshipKind> All = new HashSet<RelationshipKind>
        {
            Supersedes, PartOf, ActiveDuring, ParticipantIn, EpicenterOf, TriggeredBy, CreatedDuring
        };
    }

    public static class Statuses
    {
        public static readonly EntityStatus Active = new("active");
        public static readonly EntityStatus Historical = new("historical");
        public static readonly EntityStatus Current = new("current");
        public static readonly EntityStatus Future = new("future");
        public static readonly EntityStatus Subsumed = new("subsumed");

        public static readonly IReadOnlySet<EntityStatus> All = new HashSet<EntityStatus>
        {
            Active, Historical, Current, Future, Subsumed
        };
    }

    public static class Subtypes
    {
        public static readonly string Region = "region";
    }

    public static class Cultures
    {
        public static readonly CultureId World = new("world");
    }

    public static class Tags
    {
        public const string MetaEntity = "meta-entity";
        public const string Temporal = "temporal";
        public const string Era = "era";
        public const string EraId = "eraId";
        public const string ProminenceLocked = "prominence_locked";
    }

    private static readonly Dictionary<RelationshipKind, double> DefaultStrengths = new()
    {
        [RelationshipKinds.Supersedes] = 0.7,
        [RelationshipKinds.PartOf] = 0.5,
        [RelationshipKinds.ActiveDuring] = 0.3,
        [RelationshipKinds.ParticipantIn] = 1.0,
        [RelationshipKinds.EpicenterOf] = 1.0,
        [RelationshipKinds.TriggeredBy] = 0.8,
        [RelationshipKinds.CreatedDuring] = 0.5,
    };

    public static double GetDefaultRelationshipStrength(RelationshipKind kind)
    {
        return DefaultStrengths.TryGetValue(kind, out var strength)
            ? strength
            : throw new ArgumentException($"No default strength for relationship kind: {kind}");
    }

    public static bool IsFrameworkEntityKind(EntityKind kind) => EntityKinds.All.Contains(kind);
    public static bool IsFrameworkRelationshipKind(RelationshipKind kind) => RelationshipKinds.All.Contains(kind);
    public static bool IsFrameworkStatus(EntityStatus status) => Statuses.All.Contains(status);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add framework primitives with entity kinds, relationship kinds, statuses"
```

---

### Task 4: Core Supporting Types

Status types, execution context, semantic coordinates, entity tags — the building blocks referenced by Entity and Relationship.

**Files:**
- Create: `src/Core/TheCanonry.Schema/World/TickStatus.cs`
- Create: `src/Core/TheCanonry.Schema/World/EventCause.cs`
- Create: `src/Core/TheCanonry.Schema/World/ExecutionContext.cs`
- Create: `src/Core/TheCanonry.Schema/World/SemanticCoordinates.cs`
- Create: `src/Core/TheCanonry.Schema/World/EntityTags.cs`
- Create: `tests/TheCanonry.Schema.Tests/World/SupportingTypeTests.cs`

- [ ] **Step 1: Write failing tests**

Create `tests/TheCanonry.Schema.Tests/World/SupportingTypeTests.cs`:
```csharp
namespace TheCanonry.Schema.Tests.World;

using TheCanonry.Schema.World;

public class SupportingTypeTests
{
    [Fact]
    public void TickStatus_occurred_stores_tick()
    {
        var status = TickStatus.Occurred(42);
        Assert.True(status.HasOccurred);
        Assert.Equal(42, status.Tick);
    }

    [Fact]
    public void TickStatus_not_occurred()
    {
        var status = TickStatus.NotOccurred();
        Assert.False(status.HasOccurred);
        Assert.Equal(0, status.Tick);
    }

    [Fact]
    public void EventCause_with_cause()
    {
        var cause = EventCause.From("evt-1", "ent-1", "attack", true);
        Assert.True(cause.HasCause);
        Assert.Equal("evt-1", cause.EventId);
    }

    [Fact]
    public void EventCause_uncaused()
    {
        var cause = EventCause.Uncaused();
        Assert.False(cause.HasCause);
    }

    [Fact]
    public void SemanticCoordinates_has_xyz()
    {
        var coords = new SemanticCoordinates(1.0, 2.5, -0.5);
        Assert.Equal(1.0, coords.X);
        Assert.Equal(2.5, coords.Y);
        Assert.Equal(-0.5, coords.Z);
    }

    [Fact]
    public void EntityTags_get_set_contains()
    {
        var tags = new EntityTags();
        tags.Set("role", "leader");
        tags.Set("temporal", true);

        Assert.Equal("leader", tags.GetString("role")!);
        Assert.True(tags.GetBool("temporal"));
        Assert.True(tags.Contains("role"));
        Assert.False(tags.Contains("missing"));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: Compilation errors.

- [ ] **Step 3: Implement supporting types**

Create `src/Core/TheCanonry.Schema/World/TickStatus.cs`:
```csharp
namespace TheCanonry.Schema.World;

public sealed class TickStatus
{
    public bool HasOccurred { get; }
    public int Tick { get; }

    private TickStatus(bool hasOccurred, int tick)
    {
        HasOccurred = hasOccurred;
        Tick = tick;
    }

    public static TickStatus Occurred(int tick) => new(true, tick);
    public static TickStatus NotOccurred() => new(false, 0);
}
```

Create `src/Core/TheCanonry.Schema/World/EventCause.cs`:
```csharp
namespace TheCanonry.Schema.World;

public sealed class EventCause
{
    public bool HasCause { get; }
    public string EventId { get; }
    public string EntityId { get; }
    public string ActionType { get; }
    public bool Success { get; }

    private EventCause(bool hasCause, string eventId, string entityId, string actionType, bool success)
    {
        HasCause = hasCause;
        EventId = eventId;
        EntityId = entityId;
        ActionType = actionType;
        Success = success;
    }

    public static EventCause From(string eventId, string entityId, string actionType, bool success)
        => new(true, eventId, entityId, actionType, success);

    public static EventCause Uncaused()
        => new(false, "", "", "", true);
}
```

Create `src/Core/TheCanonry.Schema/World/ExecutionContext.cs`:
```csharp
namespace TheCanonry.Schema.World;

public sealed class ExecutionContext
{
    public int Tick { get; }
    public ExecutionSource Source { get; }
    public string SourceId { get; }
    public bool Success { get; }
    public string Narration { get; }

    public ExecutionContext(int tick, ExecutionSource source, string sourceId, bool success, string narration)
    {
        Tick = tick;
        Source = source;
        SourceId = sourceId;
        Success = success;
        Narration = narration;
    }
}

public enum ExecutionSource
{
    Template,
    System,
    Action,
    Pressure,
    Seed,
    Framework
}
```

Create `src/Core/TheCanonry.Schema/World/SemanticCoordinates.cs`:
```csharp
namespace TheCanonry.Schema.World;

public readonly record struct SemanticCoordinates(double X, double Y, double Z);
```

Create `src/Core/TheCanonry.Schema/World/EntityTags.cs`:
```csharp
namespace TheCanonry.Schema.World;

public class EntityTags
{
    private readonly Dictionary<string, object> _tags = [];

    public void Set(string key, string value) => _tags[key] = value;
    public void Set(string key, bool value) => _tags[key] = value;
    public void Remove(string key) => _tags.Remove(key);
    public bool Contains(string key) => _tags.ContainsKey(key);

    public string? GetString(string key) =>
        _tags.TryGetValue(key, out var val) && val is string s ? s : null;

    public bool GetBool(string key) =>
        _tags.TryGetValue(key, out var val) && val is true;

    public IReadOnlyDictionary<string, object> All => _tags;

    public EntityTags Clone()
    {
        var clone = new EntityTags();
        foreach (var (key, value) in _tags)
            clone._tags[key] = value;
        return clone;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add TickStatus, EventCause, ExecutionContext, SemanticCoordinates, EntityTags"
```

---

## Chunk 2: Entity and Relationship Domain Objects

### Task 5: Entity Domain Object

The core entity class — ports `WorldEntity` from `packages/world-schema/src/world.ts`.

**Files:**
- Create: `src/Core/TheCanonry.Schema/World/Entity.cs`
- Create: `src/Core/TheCanonry.Schema/World/TemporalSpan.cs`
- Create: `src/Core/TheCanonry.Schema/World/CatalystState.cs`
- Create: `tests/TheCanonry.Schema.Tests/World/EntityTests.cs`

- [ ] **Step 1: Write failing tests**

Create `tests/TheCanonry.Schema.Tests/World/EntityTests.cs`:
```csharp
namespace TheCanonry.Schema.Tests.World;

using TheCanonry.Schema.Domain;
using TheCanonry.Schema.Ids;
using TheCanonry.Schema.Primitives;
using TheCanonry.Schema.World;

public class EntityTests
{
    private Entity CreateTestEntity(string id = "e-1", string kind = "faction")
    {
        return new Entity(
            id: new EntityId(id),
            kind: new EntityKind(kind),
            subtype: "merchant",
            name: "The Silver Guild",
            culture: new CultureId("northern"),
            eraId: new EraId("era-1"),
            coordinates: new SemanticCoordinates(0.5, 0.3, 0.1),
            createdBy: new ExecutionContext(10, ExecutionSource.Template, "tmpl-1", true, "spawned"),
            tick: 10
        );
    }

    [Fact]
    public void Constructor_sets_all_required_fields()
    {
        var entity = CreateTestEntity();

        Assert.Equal(new EntityId("e-1"), entity.Id);
        Assert.Equal(new EntityKind("faction"), entity.Kind);
        Assert.Equal("merchant", entity.Subtype);
        Assert.Equal("The Silver Guild", entity.Name);
        Assert.Equal(new CultureId("northern"), entity.Culture);
        Assert.Equal(new EraId("era-1"), entity.EraId);
        Assert.Equal(FrameworkPrimitives.Statuses.Active, entity.Status);
        Assert.Equal(10, entity.CreatedAtTick);
        Assert.Equal(10, entity.UpdatedAtTick);
    }

    [Fact]
    public void Description_and_summary_start_empty()
    {
        var entity = CreateTestEntity();
        Assert.Equal("", entity.Description);
        Assert.Equal("", entity.Summary);
    }

    [Fact]
    public void UpdateStatus_changes_status_and_tick()
    {
        var entity = CreateTestEntity();
        entity.UpdateStatus(FrameworkPrimitives.Statuses.Historical, 25);

        Assert.Equal(FrameworkPrimitives.Statuses.Historical, entity.Status);
        Assert.Equal(25, entity.UpdatedAtTick);
    }

    [Fact]
    public void Links_are_empty_initially()
    {
        var entity = CreateTestEntity();
        Assert.Empty(entity.Links);
    }

    [Fact]
    public void Temporal_span_starts_at_creation_tick()
    {
        var entity = CreateTestEntity();
        Assert.Equal(10, entity.Temporal.StartTick);
        Assert.False(entity.Temporal.End.HasOccurred);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: Compilation errors.

- [ ] **Step 3: Implement TemporalSpan and CatalystState**

Create `src/Core/TheCanonry.Schema/World/TemporalSpan.cs`:
```csharp
namespace TheCanonry.Schema.World;

public class TemporalSpan
{
    public int StartTick { get; }
    public TickStatus End { get; private set; }

    public TemporalSpan(int startTick)
    {
        StartTick = startTick;
        End = TickStatus.NotOccurred();
    }

    public void EndAt(int tick) => End = TickStatus.Occurred(tick);
    public bool IsActive => !End.HasOccurred;
}
```

Create `src/Core/TheCanonry.Schema/World/CatalystState.cs`:
```csharp
namespace TheCanonry.Schema.World;

public readonly record struct CatalystState(bool CanAct);
```

- [ ] **Step 4: Implement Entity**

Create `src/Core/TheCanonry.Schema/World/Entity.cs`:
```csharp
namespace TheCanonry.Schema.World;

using TheCanonry.Schema.Domain;
using TheCanonry.Schema.Ids;
using TheCanonry.Schema.Primitives;

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
    public TemporalSpan Temporal { get; }
    public CatalystState Catalyst { get; }
    public RegionId RegionId { get; private set; }
    public IReadOnlyList<RegionId> AllRegionIds { get; private set; }
    public ExecutionContext CreatedBy { get; }
    public int CreatedAtTick { get; }
    public int UpdatedAtTick { get; private set; }

    private readonly List<Relationship> _links = [];
    public IReadOnlyList<Relationship> Links => _links;

    public Entity(
        EntityId id,
        EntityKind kind,
        string subtype,
        string name,
        CultureId culture,
        EraId eraId,
        SemanticCoordinates coordinates,
        ExecutionContext createdBy,
        int tick)
    {
        Id = id;
        Kind = kind;
        Subtype = subtype;
        Name = name;
        Description = "";
        Summary = "";
        NarrativeHint = "";
        LockedSummary = false;
        Status = FrameworkPrimitives.Statuses.Active;
        Prominence = new Prominence(0.0);
        Culture = culture;
        EraId = eraId;
        Tags = new EntityTags();
        Coordinates = coordinates;
        Temporal = new TemporalSpan(tick);
        Catalyst = new CatalystState(false);
        RegionId = new RegionId("");
        AllRegionIds = [];
        CreatedBy = createdBy;
        CreatedAtTick = tick;
        UpdatedAtTick = tick;
    }

    public void UpdateStatus(EntityStatus newStatus, int tick)
    {
        Status = newStatus;
        UpdatedAtTick = tick;
    }

    public void SetProminence(Prominence prominence, int tick)
    {
        Prominence = prominence;
        UpdatedAtTick = tick;
    }

    public void SetDescription(string description, int tick)
    {
        Description = description;
        UpdatedAtTick = tick;
    }

    public void SetSummary(string summary, int tick)
    {
        Summary = summary;
        UpdatedAtTick = tick;
    }

    public void SetNarrativeHint(string hint, int tick)
    {
        NarrativeHint = hint;
        UpdatedAtTick = tick;
    }

    public void LockSummary() => LockedSummary = true;

    public void SetName(string name, int tick)
    {
        Name = name;
        UpdatedAtTick = tick;
    }

    public void SetCoordinates(SemanticCoordinates coordinates, int tick)
    {
        Coordinates = coordinates;
        UpdatedAtTick = tick;
    }

    public void SetRegion(RegionId regionId, IReadOnlyList<RegionId> allRegionIds, int tick)
    {
        RegionId = regionId;
        AllRegionIds = allRegionIds;
        UpdatedAtTick = tick;
    }

    public void AddLink(Relationship relationship) => _links.Add(relationship);
    public void RemoveLink(Relationship relationship) => _links.Remove(relationship);

    public bool IsConnectedTo(EntityId other) =>
        _links.Any(l => l.SourceId == other || l.TargetId == other);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Entity domain object with TemporalSpan and CatalystState"
```

---

### Task 6: Relationship Domain Object

**Files:**
- Create: `src/Core/TheCanonry.Schema/World/Relationship.cs`
- Create: `tests/TheCanonry.Schema.Tests/World/RelationshipTests.cs`

- [ ] **Step 1: Write failing tests**

Create `tests/TheCanonry.Schema.Tests/World/RelationshipTests.cs`:
```csharp
namespace TheCanonry.Schema.Tests.World;

using TheCanonry.Schema.Domain;
using TheCanonry.Schema.Ids;
using TheCanonry.Schema.World;

public class RelationshipTests
{
    private Relationship CreateTestRelationship()
    {
        return new Relationship(
            sourceId: new EntityId("e-1"),
            targetId: new EntityId("e-2"),
            kind: new RelationshipKind("alliance"),
            strength: 0.8,
            distance: 0.2,
            category: "political",
            createdBy: new ExecutionContext(5, ExecutionSource.System, "sys-1", true, "formed"),
            tick: 5
        );
    }

    [Fact]
    public void Constructor_sets_all_fields()
    {
        var rel = CreateTestRelationship();

        Assert.Equal(new EntityId("e-1"), rel.SourceId);
        Assert.Equal(new EntityId("e-2"), rel.TargetId);
        Assert.Equal(new RelationshipKind("alliance"), rel.Kind);
        Assert.Equal(0.8, rel.Strength);
        Assert.Equal(0.2, rel.Distance);
        Assert.Equal("political", rel.Category);
        Assert.Equal(new EntityStatus("active"), rel.Status);
        Assert.False(rel.Archived.HasOccurred);
    }

    [Fact]
    public void Reinforce_increases_strength()
    {
        var rel = CreateTestRelationship();
        rel.Reinforce(0.1);
        Assert.Equal(0.9, rel.Strength, precision: 5);
    }

    [Fact]
    public void Decay_decreases_strength()
    {
        var rel = CreateTestRelationship();
        rel.Decay(0.5);
        Assert.Equal(0.4, rel.Strength, precision: 5);
    }

    [Fact]
    public void Archive_sets_status_and_tick()
    {
        var rel = CreateTestRelationship();
        rel.Archive(20);

        Assert.Equal(new EntityStatus("historical"), rel.Status);
        Assert.True(rel.Archived.HasOccurred);
        Assert.Equal(20, rel.Archived.Tick);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: Compilation errors.

- [ ] **Step 3: Implement Relationship**

Create `src/Core/TheCanonry.Schema/World/Relationship.cs`:
```csharp
namespace TheCanonry.Schema.World;

using TheCanonry.Schema.Domain;
using TheCanonry.Schema.Ids;
using TheCanonry.Schema.Primitives;

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
    public string CatalyzedBy { get; }
    public ExecutionContext CreatedBy { get; }
    public int CreatedAtTick { get; }

    public Relationship(
        EntityId sourceId,
        EntityId targetId,
        RelationshipKind kind,
        double strength,
        double distance,
        string category,
        ExecutionContext createdBy,
        int tick,
        string catalyzedBy = "")
    {
        SourceId = sourceId;
        TargetId = targetId;
        Kind = kind;
        Strength = strength;
        Distance = distance;
        Category = category;
        Status = FrameworkPrimitives.Statuses.Active;
        Archived = TickStatus.NotOccurred();
        CatalyzedBy = catalyzedBy;
        CreatedBy = createdBy;
        CreatedAtTick = tick;
    }

    public void Reinforce(double amount) => Strength = Math.Min(1.0, Strength + amount);
    public void Decay(double rate) => Strength = Math.Max(0.0, Strength * (1.0 - rate));

    public void Archive(int tick)
    {
        Status = FrameworkPrimitives.Statuses.Historical;
        Archived = TickStatus.Occurred(tick);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Relationship domain object"
```

---

### Task 7: NarrativeEvent Sealed Hierarchy

**Files:**
- Create: `src/Core/TheCanonry.Schema/World/NarrativeEvent.cs`
- Create: `src/Core/TheCanonry.Schema/World/EntityEffect.cs`
- Create: `src/Core/TheCanonry.Schema/World/NarrativeEventKind.cs`
- Create: `tests/TheCanonry.Schema.Tests/World/NarrativeEventTests.cs`

- [ ] **Step 1: Write failing tests**

Create `tests/TheCanonry.Schema.Tests/World/NarrativeEventTests.cs`:
```csharp
namespace TheCanonry.Schema.Tests.World;

using TheCanonry.Schema.Domain;
using TheCanonry.Schema.Ids;
using TheCanonry.Schema.World;

public class NarrativeEventTests
{
    [Fact]
    public void NarrativeEvent_constructor_sets_fields()
    {
        var subject = new NarrativeEntityRef(
            new EntityId("e-1"), "Guild", new EntityKind("faction"), "merchant");

        var evt = new NarrativeEvent(
            id: "evt-1",
            tick: 15,
            eraId: new EraId("era-1"),
            eventKind: NarrativeEventKind.RelationshipFormed,
            significance: 0.7,
            subject: subject,
            action: "formed alliance",
            description: "The guild allied with the crown",
            causedBy: EventCause.Uncaused()
        );

        Assert.Equal("evt-1", evt.Id);
        Assert.Equal(15, evt.Tick);
        Assert.Equal(NarrativeEventKind.RelationshipFormed, evt.EventKind);
        Assert.Equal(0.7, evt.Significance);
    }

    [Fact]
    public void EntityEffect_pattern_matching_is_exhaustive()
    {
        EntityEffect effect = new TagGainedEffect("leader", "gained leadership", "");

        var description = effect switch
        {
            CreatedEffect e => e.Description,
            EndedEffect e => e.Description,
            RelationshipFormedEffect e => e.Description,
            RelationshipEndedEffect e => e.Description,
            TagGainedEffect e => e.Description,
            TagLostEffect e => e.Description,
            FieldChangedEffect e => e.Description,
        };

        Assert.Equal("gained leadership", description);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: Compilation errors.

- [ ] **Step 3: Implement NarrativeEventKind enum**

Create `src/Core/TheCanonry.Schema/World/NarrativeEventKind.cs`:
```csharp
namespace TheCanonry.Schema.World;

public enum NarrativeEventKind
{
    StateChange,
    RelationshipDissolved,
    RelationshipEnded,
    EntityLifecycle,
    EraTransition,
    Succession,
    Coalescence,
    Betrayal,
    Reconciliation,
    RivalryFormed,
    AllianceFormed,
    RelationshipFormed,
    Downfall,
    Triumph,
    LeadershipEstablished,
    WarStarted,
    WarEnded,
    PowerVacuum,
    TagGained,
    TagLost,
    CreationBatch
}
```

- [ ] **Step 4: Implement EntityEffect sealed hierarchy**

Create `src/Core/TheCanonry.Schema/World/EntityEffect.cs`:
```csharp
namespace TheCanonry.Schema.World;

using TheCanonry.Schema.Domain;
using TheCanonry.Schema.Ids;

public abstract record EntityEffect(string Description, string SemanticKind);

public sealed record CreatedEffect(string Description, string SemanticKind)
    : EntityEffect(Description, SemanticKind);

public sealed record EndedEffect(string Description, string SemanticKind)
    : EntityEffect(Description, SemanticKind);

public sealed record RelationshipFormedEffect(
    RelationshipKind RelationshipKind,
    NarrativeEntityRef RelatedEntity,
    string Description,
    string SemanticKind) : EntityEffect(Description, SemanticKind);

public sealed record RelationshipEndedEffect(
    RelationshipKind RelationshipKind,
    NarrativeEntityRef RelatedEntity,
    string Description,
    string SemanticKind) : EntityEffect(Description, SemanticKind);

public sealed record TagGainedEffect(string Tag, string Description, string SemanticKind)
    : EntityEffect(Description, SemanticKind);

public sealed record TagLostEffect(string Tag, string Description, string SemanticKind)
    : EntityEffect(Description, SemanticKind);

public sealed record FieldChangedEffect(
    string Field,
    object? PreviousValue,
    object? NewValue,
    string Description,
    string SemanticKind) : EntityEffect(Description, SemanticKind);

public sealed record ParticipantEffect(
    NarrativeEntityRef Entity,
    IReadOnlyList<EntityEffect> Effects);

public sealed record NarrativeEntityRef(
    EntityId Id,
    string Name,
    EntityKind Kind,
    string Subtype);
```

- [ ] **Step 5: Implement NarrativeEvent**

Create `src/Core/TheCanonry.Schema/World/NarrativeEvent.cs`:
```csharp
namespace TheCanonry.Schema.World;

using TheCanonry.Schema.Ids;

public class NarrativeEvent
{
    public string Id { get; }
    public int Tick { get; }
    public EraId EraId { get; }
    public NarrativeEventKind EventKind { get; }
    public double Significance { get; }
    public NarrativeEntityRef Subject { get; }
    public string Action { get; }
    public string Description { get; }
    public EventCause CausedBy { get; }
    public IReadOnlyList<string> NarrativeTags { get; }

    private readonly List<ParticipantEffect> _participantEffects = [];
    public IReadOnlyList<ParticipantEffect> ParticipantEffects => _participantEffects;

    public NarrativeEvent(
        string id,
        int tick,
        EraId eraId,
        NarrativeEventKind eventKind,
        double significance,
        NarrativeEntityRef subject,
        string action,
        string description,
        EventCause causedBy,
        IReadOnlyList<string>? narrativeTags = null)
    {
        Id = id;
        Tick = tick;
        EraId = eraId;
        EventKind = eventKind;
        Significance = significance;
        Subject = subject;
        Action = action;
        Description = description;
        CausedBy = causedBy;
        NarrativeTags = narrativeTags ?? [];
    }

    public void AddParticipantEffect(ParticipantEffect effect) =>
        _participantEffects.Add(effect);
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add NarrativeEvent, EntityEffect hierarchy, NarrativeEventKind"
```

---

## Chunk 3: Domain Schema Definitions + DomainRegistry

### Task 8: Domain Schema Definition Types

These types describe the domain configuration loaded from JSON — entity kind definitions, relationship kind definitions, culture definitions.

**Files:**
- Create: `src/Core/TheCanonry.Schema/Config/EntityKindDefinition.cs`
- Create: `src/Core/TheCanonry.Schema/Config/RelationshipKindDefinition.cs`
- Create: `src/Core/TheCanonry.Schema/Config/CultureDefinition.cs`
- Create: `src/Core/TheCanonry.Schema/Config/DomainSchema.cs`
- Create: `src/Core/TheCanonry.Schema/Config/SemanticPlane.cs`
- Create: `tests/TheCanonry.Schema.Tests/Config/DomainSchemaTests.cs`

- [ ] **Step 1: Write failing test**

Create `tests/TheCanonry.Schema.Tests/Config/DomainSchemaTests.cs`:
```csharp
namespace TheCanonry.Schema.Tests.Config;

using TheCanonry.Schema.Config;
using TheCanonry.Schema.Domain;

public class DomainSchemaTests
{
    [Fact]
    public void EntityKindDefinition_has_required_properties()
    {
        var def = new EntityKindDefinition
        {
            Kind = new EntityKind("faction"),
            Description = "A political faction",
            IsFramework = false,
            Category = EntityCategory.Collective,
            Subtypes = [new SubtypeDefinition { Id = "merchant", Name = "Merchant Guild" }],
            Statuses = [new StatusDefinition { Id = "active", Name = "Active", IsTerminal = false, Polarity = Polarity.Neutral, TransitionVerb = "became" }],
            DefaultStatus = new EntityStatus("active"),
        };

        Assert.Equal(new EntityKind("faction"), def.Kind);
        Assert.Single(def.Subtypes);
    }

    [Fact]
    public void DomainSchema_has_entity_and_relationship_kinds()
    {
        var schema = new DomainSchema
        {
            Id = "test",
            Name = "Test Domain",
            Version = "1.0",
            EntityKinds = [],
            RelationshipKinds = [],
            Cultures = [],
        };

        Assert.Equal("test", schema.Id);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: Compilation errors.

- [ ] **Step 3: Implement domain schema types**

Create `src/Core/TheCanonry.Schema/Config/EntityKindDefinition.cs`:
```csharp
namespace TheCanonry.Schema.Config;

using TheCanonry.Schema.Domain;

public enum EntityCategory
{
    Character, Collective, Place, Object, Concept, Power, Era, Event
}

public enum Polarity
{
    Positive, Neutral, Negative
}

public class SubtypeDefinition
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public bool IsAuthority { get; init; }
}

public class StatusDefinition
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public bool IsTerminal { get; init; }
    public Polarity Polarity { get; init; } = Polarity.Neutral;
    public string TransitionVerb { get; init; } = "";
}

public class EntityKindDefinition
{
    public required EntityKind Kind { get; init; }
    public required string Description { get; init; }
    public required bool IsFramework { get; init; }
    public required EntityCategory Category { get; init; }
    public required IReadOnlyList<SubtypeDefinition> Subtypes { get; init; }
    public required IReadOnlyList<StatusDefinition> Statuses { get; init; }
    public required EntityStatus DefaultStatus { get; init; }
    public IReadOnlyList<RequiredRelationshipRule> RequiredRelationships { get; init; } = [];
    public EntityKindStyle? Style { get; init; }
    public SemanticPlane? SemanticPlane { get; init; }
    public IReadOnlyList<string> VisualIdentityKeys { get; init; } = [];
}

public class RequiredRelationshipRule
{
    public required string Kind { get; init; }
    public required string Description { get; init; }
}

public class EntityKindStyle
{
    public required string Color { get; init; }
    public required string Shape { get; init; }
    public required string DisplayName { get; init; }
}
```

Create `src/Core/TheCanonry.Schema/Config/SemanticPlane.cs`:
```csharp
namespace TheCanonry.Schema.Config;

using TheCanonry.Schema.World;

public class SemanticAxis
{
    public required string AxisId { get; init; }
}

public class SemanticPlane
{
    public required SemanticPlaneAxes Axes { get; init; }
    public IReadOnlyList<SemanticRegion> Regions { get; init; } = [];
}

public class SemanticPlaneAxes
{
    public required SemanticAxis X { get; init; }
    public required SemanticAxis Y { get; init; }
    public required SemanticAxis Z { get; init; }
}

public class SemanticRegion
{
    public required string Id { get; init; }
    public required string Label { get; init; }
    public required string Color { get; init; }
    public required string Culture { get; init; }
    public IReadOnlyList<string> Tags { get; init; } = [];
    public string Description { get; init; } = "";
    public required ZRange ZRange { get; init; }
    public string? ParentRegion { get; init; }
    public bool Emergent { get; init; }
    public int CreatedAt { get; init; }
    public string CreatedBy { get; init; } = "";
    public RegionBounds? Bounds { get; init; }
    public Dictionary<string, object?> Metadata { get; init; } = [];
}

public readonly record struct ZRange(double Min, double Max);

// Region bounds — discriminated union via sealed hierarchy
public abstract record RegionBounds(string Shape);
public sealed record CircleBounds(double CenterX, double CenterY, double Radius)
    : RegionBounds("circle");
public sealed record RectBounds(double X1, double Y1, double X2, double Y2)
    : RegionBounds("rect");
public sealed record PolygonBounds(IReadOnlyList<PolygonPoint> Points)
    : RegionBounds("polygon");
public readonly record struct PolygonPoint(double X, double Y);
```

Create `src/Core/TheCanonry.Schema/Config/RelationshipKindDefinition.cs`:
```csharp
namespace TheCanonry.Schema.Config;

using TheCanonry.Schema.Domain;

public class RelationshipVerbs
{
    public required string Formed { get; init; }
    public required string Ended { get; init; }
    public required string InverseFormed { get; init; }
    public required string InverseEnded { get; init; }
}

public class RelationshipKindDefinition
{
    public required RelationshipKind Kind { get; init; }
    public required string Name { get; init; }
    public required string Description { get; init; }
    public required bool IsFramework { get; init; }
    public IReadOnlyList<string> SrcKinds { get; init; } = [];
    public IReadOnlyList<string> DstKinds { get; init; } = [];
    public bool Symmetric { get; init; }
    public string Category { get; init; } = "";
    public bool Cullable { get; init; }
    public string DecayRate { get; init; } = "none";
    public Polarity Polarity { get; init; } = Polarity.Neutral;
    public RelationshipVerbs? Verbs { get; init; }
}
```

Create `src/Core/TheCanonry.Schema/Config/CultureDefinition.cs`:
```csharp
namespace TheCanonry.Schema.Config;

using TheCanonry.Schema.Ids;

public class AxisBias
{
    public required double X { get; init; }
    public required double Y { get; init; }
    public required double Z { get; init; }
}

public class CultureDefinition
{
    public required CultureId Id { get; init; }
    public required string Name { get; init; }
    public required string Description { get; init; }
    public required bool IsFramework { get; init; }
    public string Homeland { get; init; } = "";
    public string Color { get; init; } = "";
    public Dictionary<string, AxisBias> AxisBiases { get; init; } = [];
    public Dictionary<string, List<string>> HomeRegions { get; init; } = [];
    public string DefaultArtisticStyleId { get; init; } = "";
    public Dictionary<string, string> DefaultCompositionStyles { get; init; } = [];
    public IReadOnlyList<string> StyleKeywords { get; init; } = [];
    public Dictionary<string, string> VisualIdentity { get; init; } = [];
}
```

Create `src/Core/TheCanonry.Schema/Config/DomainSchema.cs`:
```csharp
namespace TheCanonry.Schema.Config;

public class DomainSchema
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Version { get; init; }
    public required IReadOnlyList<EntityKindDefinition> EntityKinds { get; init; }
    public required IReadOnlyList<RelationshipKindDefinition> RelationshipKinds { get; init; }
    public required IReadOnlyList<CultureDefinition> Cultures { get; init; }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add domain schema definition types (EntityKind, RelationshipKind, Culture)"
```

---

### Task 9: DomainRegistry

Runtime validation of domain-defined values against the loaded schema.

**Files:**
- Create: `src/Core/TheCanonry.Schema/Domain/DomainRegistry.cs`
- Create: `src/Core/TheCanonry.Schema/Domain/InvalidDomainValueException.cs`
- Create: `tests/TheCanonry.Schema.Tests/Domain/DomainRegistryTests.cs`

- [ ] **Step 1: Write failing tests**

Create `tests/TheCanonry.Schema.Tests/Domain/DomainRegistryTests.cs`:
```csharp
namespace TheCanonry.Schema.Tests.Domain;

using TheCanonry.Schema.Config;
using TheCanonry.Schema.Domain;
using TheCanonry.Schema.Primitives;

public class DomainRegistryTests
{
    private DomainSchema CreateTestSchema()
    {
        return new DomainSchema
        {
            Id = "test",
            Name = "Test",
            Version = "1.0",
            EntityKinds =
            [
                new EntityKindDefinition
                {
                    Kind = new EntityKind("faction"),
                    Description = "A faction",
                    IsFramework = false,
                    Category = EntityCategory.Collective,
                    Subtypes = [],
                    Statuses =
                    [
                        new StatusDefinition { Id = "active", Name = "Active" },
                        new StatusDefinition { Id = "dissolved", Name = "Dissolved", IsTerminal = true, Polarity = Polarity.Negative, TransitionVerb = "dissolved" },
                    ],
                    DefaultStatus = new EntityStatus("active"),
                }
            ],
            RelationshipKinds =
            [
                new RelationshipKindDefinition
                {
                    Kind = new RelationshipKind("rivalry"),
                    Name = "Rivalry",
                    Description = "A rivalry",
                    IsFramework = false,
                }
            ],
            Cultures = [],
        };
    }

    [Fact]
    public void Registry_includes_framework_entity_kinds()
    {
        var registry = new DomainRegistry(CreateTestSchema());
        registry.ValidateEntityKind(FrameworkPrimitives.EntityKinds.Era); // Should not throw
    }

    [Fact]
    public void Registry_includes_domain_entity_kinds()
    {
        var registry = new DomainRegistry(CreateTestSchema());
        registry.ValidateEntityKind(new EntityKind("faction")); // Should not throw
    }

    [Fact]
    public void Registry_rejects_unknown_entity_kinds()
    {
        var registry = new DomainRegistry(CreateTestSchema());
        Assert.Throws<InvalidDomainValueException>(() =>
            registry.ValidateEntityKind(new EntityKind("spaceship")));
    }

    [Fact]
    public void Registry_validates_status_for_entity_kind()
    {
        var registry = new DomainRegistry(CreateTestSchema());
        registry.ValidateStatus(new EntityKind("faction"), new EntityStatus("dissolved")); // Should not throw
    }

    [Fact]
    public void Registry_rejects_invalid_status_for_entity_kind()
    {
        var registry = new DomainRegistry(CreateTestSchema());
        Assert.Throws<InvalidDomainValueException>(() =>
            registry.ValidateStatus(new EntityKind("faction"), new EntityStatus("exploded")));
    }

    [Fact]
    public void Registry_includes_domain_relationship_kinds()
    {
        var registry = new DomainRegistry(CreateTestSchema());
        registry.ValidateRelationshipKind(new RelationshipKind("rivalry")); // Should not throw
    }

    [Fact]
    public void Registry_includes_framework_relationship_kinds()
    {
        var registry = new DomainRegistry(CreateTestSchema());
        registry.ValidateRelationshipKind(FrameworkPrimitives.RelationshipKinds.Supersedes); // Should not throw
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: Compilation errors.

- [ ] **Step 3: Implement DomainRegistry**

Create `src/Core/TheCanonry.Schema/Domain/InvalidDomainValueException.cs`:
```csharp
namespace TheCanonry.Schema.Domain;

public class InvalidDomainValueException : Exception
{
    public InvalidDomainValueException(string message) : base(message) { }
}
```

Create `src/Core/TheCanonry.Schema/Domain/DomainRegistry.cs`:
```csharp
namespace TheCanonry.Schema.Domain;

using TheCanonry.Schema.Config;
using TheCanonry.Schema.Primitives;

public class DomainRegistry
{
    private readonly HashSet<EntityKind> _validEntityKinds = [];
    private readonly HashSet<RelationshipKind> _validRelationshipKinds = [];
    private readonly Dictionary<EntityKind, HashSet<EntityStatus>> _validStatuses = [];

    public DomainRegistry(DomainSchema schema)
    {
        // Register framework primitives
        foreach (var kind in FrameworkPrimitives.EntityKinds.All)
            _validEntityKinds.Add(kind);

        foreach (var kind in FrameworkPrimitives.RelationshipKinds.All)
            _validRelationshipKinds.Add(kind);

        // Framework entity kinds get framework statuses
        foreach (var fwKind in FrameworkPrimitives.EntityKinds.All)
        {
            _validStatuses[fwKind] = [..FrameworkPrimitives.Statuses.All];
        }

        // Register domain-defined values from schema
        foreach (var kindDef in schema.EntityKinds)
        {
            _validEntityKinds.Add(kindDef.Kind);

            var statuses = new HashSet<EntityStatus>();
            foreach (var status in kindDef.Statuses)
                statuses.Add(new EntityStatus(status.Id));
            // Also include framework statuses for domain kinds
            foreach (var status in FrameworkPrimitives.Statuses.All)
                statuses.Add(status);
            _validStatuses[kindDef.Kind] = statuses;
        }

        foreach (var relDef in schema.RelationshipKinds)
            _validRelationshipKinds.Add(relDef.Kind);
    }

    public void ValidateEntityKind(EntityKind kind)
    {
        if (!_validEntityKinds.Contains(kind))
            throw new InvalidDomainValueException($"Unknown entity kind: {kind}");
    }

    public void ValidateRelationshipKind(RelationshipKind kind)
    {
        if (!_validRelationshipKinds.Contains(kind))
            throw new InvalidDomainValueException($"Unknown relationship kind: {kind}");
    }

    public void ValidateStatus(EntityKind kind, EntityStatus status)
    {
        if (!_validStatuses.TryGetValue(kind, out var valid) || !valid.Contains(status))
            throw new InvalidDomainValueException(
                $"Status '{status}' is not valid for entity kind '{kind}'");
    }

    public IReadOnlySet<EntityKind> EntityKinds => _validEntityKinds;
    public IReadOnlySet<RelationshipKind> RelationshipKinds => _validRelationshipKinds;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --verbosity quiet
```
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add DomainRegistry for runtime validation of domain-defined values"
```

---

## Chunk 4: Persistence Layer

### Task 10: Create Persistence Project with EF Core + SQLite

**Files:**
- Create: `src/Infrastructure/TheCanonry.Persistence/TheCanonry.Persistence.csproj`
- Create: `src/Infrastructure/TheCanonry.Persistence/CanonryDbContext.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Entities/SimulationSlotEntity.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Entities/PersistedEntity.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Entities/PersistedRelationship.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Entities/EnrichmentJobEntity.cs`
- Create: `tests/TheCanonry.Persistence.Tests/TheCanonry.Persistence.Tests.csproj`
- Create: `tests/TheCanonry.Persistence.Tests/DbContextTests.cs`

- [ ] **Step 1: Create Persistence project with EF Core packages**

```bash
cd ~/src/the-canonry-desktop
mkdir -p src/Infrastructure/TheCanonry.Persistence
dotnet new classlib -o src/Infrastructure/TheCanonry.Persistence --no-restore
dotnet add src/Infrastructure/TheCanonry.Persistence/TheCanonry.Persistence.csproj package Microsoft.EntityFrameworkCore.Sqlite --version 10.*
dotnet add src/Infrastructure/TheCanonry.Persistence/TheCanonry.Persistence.csproj package Microsoft.EntityFrameworkCore.Design --version 10.*
dotnet sln add src/Infrastructure/TheCanonry.Persistence/TheCanonry.Persistence.csproj
dotnet add src/Infrastructure/TheCanonry.Persistence/TheCanonry.Persistence.csproj reference src/Core/TheCanonry.Schema/TheCanonry.Schema.csproj
```

After creation, edit `src/Infrastructure/TheCanonry.Persistence/TheCanonry.Persistence.csproj` to add `<TargetFramework>net10.0</TargetFramework>` inside a `<PropertyGroup>` if not already present.

- [ ] **Step 2: Create test project**

```bash
cd ~/src/the-canonry-desktop
mkdir -p tests/TheCanonry.Persistence.Tests
dotnet new xunit -o tests/TheCanonry.Persistence.Tests --no-restore
dotnet add tests/TheCanonry.Persistence.Tests/TheCanonry.Persistence.Tests.csproj package Microsoft.EntityFrameworkCore.Sqlite --version 10.*
dotnet sln add tests/TheCanonry.Persistence.Tests/TheCanonry.Persistence.Tests.csproj
dotnet add tests/TheCanonry.Persistence.Tests/TheCanonry.Persistence.Tests.csproj reference src/Infrastructure/TheCanonry.Persistence/TheCanonry.Persistence.csproj
dotnet add tests/TheCanonry.Persistence.Tests/TheCanonry.Persistence.Tests.csproj reference src/Core/TheCanonry.Schema/TheCanonry.Schema.csproj
```

After creation, edit `tests/TheCanonry.Persistence.Tests/TheCanonry.Persistence.Tests.csproj` to add `<TargetFramework>net10.0</TargetFramework>` inside a `<PropertyGroup>` if not already present.

- [ ] **Step 3: Write failing test for DbContext**

Create `tests/TheCanonry.Persistence.Tests/DbContextTests.cs`:
```csharp
namespace TheCanonry.Persistence.Tests;

using Microsoft.EntityFrameworkCore;
using TheCanonry.Persistence;
using TheCanonry.Persistence.Entities;

public class DbContextTests : IDisposable
{
    private readonly CanonryDbContext _db;

    public DbContextTests()
    {
        var options = new DbContextOptionsBuilder<CanonryDbContext>()
            .UseSqlite("DataSource=:memory:")
            .Options;
        _db = new CanonryDbContext(options);
        _db.Database.OpenConnection();
        _db.Database.EnsureCreated();
    }

    [Fact]
    public async Task Can_create_and_retrieve_simulation_slot()
    {
        var slot = new SimulationSlotEntity
        {
            ProjectId = "proj-1",
            SlotIndex = 0,
            SimulationRunId = "run-abc",
            UpdatedAt = DateTime.UtcNow,
        };

        _db.SimulationSlots.Add(slot);
        await _db.SaveChangesAsync();

        var loaded = await _db.SimulationSlots.FirstAsync();
        Assert.Equal("proj-1", loaded.ProjectId);
        Assert.Equal("run-abc", loaded.SimulationRunId);
    }

    [Fact]
    public async Task Can_create_and_retrieve_enrichment_job()
    {
        var job = new EnrichmentJobEntity
        {
            TaskType = "description",
            TargetEntityId = "e-1",
            SlotSimulationRunId = "run-abc",
            Status = "Queued",
            QueuedAt = DateTime.UtcNow,
            AttemptCount = 0,
        };

        _db.EnrichmentJobs.Add(job);
        await _db.SaveChangesAsync();

        var loaded = await _db.EnrichmentJobs.FirstAsync();
        Assert.Equal("description", loaded.TaskType);
        Assert.Equal("Queued", loaded.Status);
    }

    public void Dispose() => _db.Dispose();
}
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
dotnet test tests/TheCanonry.Persistence.Tests/ --verbosity quiet
```
Expected: Compilation errors.

- [ ] **Step 5: Implement EF Core entity types**

Create `src/Infrastructure/TheCanonry.Persistence/Entities/SimulationSlotEntity.cs`:
```csharp
namespace TheCanonry.Persistence.Entities;

public class SimulationSlotEntity
{
    public long Id { get; set; }
    public required string ProjectId { get; set; }
    public required int SlotIndex { get; set; }
    public required string SimulationRunId { get; set; }
    public int? FinalTick { get; set; }
    public string? FinalEraId { get; set; }
    public string? Label { get; set; }
    public bool IsTemporary { get; set; }
    public required DateTime UpdatedAt { get; set; }
}
```

Create `src/Infrastructure/TheCanonry.Persistence/Entities/PersistedEntity.cs`:
```csharp
namespace TheCanonry.Persistence.Entities;

public class PersistedEntity
{
    public required string Id { get; set; }
    public required string SimulationRunId { get; set; }
    public required string Kind { get; set; }
    public required string Subtype { get; set; }
    public required string Name { get; set; }
    public required string Description { get; set; }
    public required string Summary { get; set; }
    public required string Status { get; set; }
    public required double Prominence { get; set; }
    public required string Culture { get; set; }
    public required string EraId { get; set; }
    public required double CoordX { get; set; }
    public required double CoordY { get; set; }
    public required double CoordZ { get; set; }
    public required int CreatedAtTick { get; set; }
    public required int UpdatedAtTick { get; set; }

    /// <summary>JSON-serialized EntityTags</summary>
    public string TagsJson { get; set; } = "{}";

    /// <summary>JSON-serialized enrichment data (from Illuminator)</summary>
    public string? EnrichmentJson { get; set; }
}
```

Create `src/Infrastructure/TheCanonry.Persistence/Entities/PersistedRelationship.cs`:
```csharp
namespace TheCanonry.Persistence.Entities;

public class PersistedRelationship
{
    public long Id { get; set; }
    public required string SimulationRunId { get; set; }
    public required string SourceId { get; set; }
    public required string TargetId { get; set; }
    public required string Kind { get; set; }
    public required double Strength { get; set; }
    public required double Distance { get; set; }
    public required string Category { get; set; }
    public required string Status { get; set; }
    public required int CreatedAtTick { get; set; }
}
```

Create `src/Infrastructure/TheCanonry.Persistence/Entities/EnrichmentJobEntity.cs`:
```csharp
namespace TheCanonry.Persistence.Entities;

public class EnrichmentJobEntity
{
    public long Id { get; set; }
    public required string TaskType { get; set; }
    public required string TargetEntityId { get; set; }
    public required string SlotSimulationRunId { get; set; }
    public required string Status { get; set; }
    public required DateTime QueuedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
    public decimal EstimatedCost { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ErrorDetail { get; set; }
    public required int AttemptCount { get; set; }
    public string? ProgressMessage { get; set; }
    public double? ProgressFraction { get; set; }
}
```

- [ ] **Step 6: Implement CanonryDbContext**

Create `src/Infrastructure/TheCanonry.Persistence/CanonryDbContext.cs`:
```csharp
namespace TheCanonry.Persistence;

using Microsoft.EntityFrameworkCore;
using TheCanonry.Persistence.Entities;

public class CanonryDbContext : DbContext
{
    public CanonryDbContext(DbContextOptions<CanonryDbContext> options) : base(options) { }

    public DbSet<SimulationSlotEntity> SimulationSlots => Set<SimulationSlotEntity>();
    public DbSet<PersistedEntity> Entities => Set<PersistedEntity>();
    public DbSet<PersistedRelationship> Relationships => Set<PersistedRelationship>();
    public DbSet<EnrichmentJobEntity> EnrichmentJobs => Set<EnrichmentJobEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SimulationSlotEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.ProjectId, x.SlotIndex }).IsUnique();
            e.HasIndex(x => x.SimulationRunId);
        });

        modelBuilder.Entity<PersistedEntity>(e =>
        {
            e.HasKey(x => new { x.Id, x.SimulationRunId });
            e.HasIndex(x => x.SimulationRunId);
            e.HasIndex(x => x.Kind);
            e.HasIndex(x => new { x.SimulationRunId, x.Kind });
        });

        modelBuilder.Entity<PersistedRelationship>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.SimulationRunId);
            e.HasIndex(x => x.SourceId);
            e.HasIndex(x => x.TargetId);
        });

        modelBuilder.Entity<EnrichmentJobEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.SlotSimulationRunId);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.TaskType);
        });
    }
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
dotnet test tests/TheCanonry.Persistence.Tests/ --verbosity quiet
```
Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Persistence project with EF Core SQLite, simulation slots, entities, enrichment jobs"
```

---

## Chunk 5: Minimal WPF Shell

### Task 11: Create WPF Desktop Project

**Files:**
- Create: `src/TheCanonry.Desktop/TheCanonry.Desktop.csproj`
- Create: `src/TheCanonry.Desktop/App.xaml`
- Create: `src/TheCanonry.Desktop/App.xaml.cs`
- Create: `src/TheCanonry.Desktop/Shell/ShellWindow.xaml`
- Create: `src/TheCanonry.Desktop/Shell/ShellWindow.xaml.cs`
- Create: `src/TheCanonry.Desktop/Shell/ShellViewModel.cs`

- [ ] **Step 1: Create WPF project**

```bash
cd ~/src/the-canonry-desktop
mkdir -p src/TheCanonry.Desktop
dotnet new wpf -o src/TheCanonry.Desktop --no-restore
```

Verify that `src/TheCanonry.Desktop/TheCanonry.Desktop.csproj` contains `<TargetFramework>net10.0-windows</TargetFramework>` and `<UseWPF>true</UseWPF>`. The `dotnet new wpf` template should set these automatically. If `Directory.Build.props` overrides the target framework, explicitly set it in this .csproj.

```bash
dotnet sln add src/TheCanonry.Desktop/TheCanonry.Desktop.csproj
dotnet add src/TheCanonry.Desktop/TheCanonry.Desktop.csproj reference src/Core/TheCanonry.Schema/TheCanonry.Schema.csproj
dotnet add src/TheCanonry.Desktop/TheCanonry.Desktop.csproj reference src/Infrastructure/TheCanonry.Persistence/TheCanonry.Persistence.csproj
dotnet add src/TheCanonry.Desktop/TheCanonry.Desktop.csproj package Microsoft.Extensions.DependencyInjection --version 10.*
dotnet add src/TheCanonry.Desktop/TheCanonry.Desktop.csproj package Microsoft.EntityFrameworkCore.Sqlite --version 10.*
```

- [ ] **Step 2: Create ShellWindow XAML with menu bar and status bar**

Create `src/TheCanonry.Desktop/Shell/ShellWindow.xaml`:
```xml
<Window x:Class="TheCanonry.Desktop.Shell.ShellWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="The Canonry" Height="800" Width="1200"
        WindowStartupLocation="CenterScreen">
    <DockPanel>
        <!-- Menu Bar -->
        <Menu DockPanel.Dock="Top">
            <MenuItem Header="_File">
                <MenuItem Header="_Open Project..." />
                <Separator />
                <MenuItem Header="E_xit" Click="Exit_Click" InputGestureText="Alt+F4" />
            </MenuItem>
            <MenuItem Header="_Simulation">
                <MenuItem Header="_Run" InputGestureText="F5" />
                <MenuItem Header="_Stop" InputGestureText="Shift+F5" />
            </MenuItem>
            <MenuItem Header="_Enrichment">
                <MenuItem Header="_Dashboard" />
                <MenuItem Header="_Queue Status" />
            </MenuItem>
            <MenuItem Header="_View">
                <MenuItem Header="_Illuminator" />
                <MenuItem Header="_Archivist" />
                <MenuItem Header="_Chronicler" />
                <MenuItem Header="_Forge" />
                <MenuItem Header="_Coherence" />
                <MenuItem Header="_Cosmographer" />
                <MenuItem Header="_Domain Editor" />
            </MenuItem>
            <MenuItem Header="_Window">
                <MenuItem Header="_New Window" />
            </MenuItem>
            <MenuItem Header="_Help">
                <MenuItem Header="_About" />
            </MenuItem>
        </Menu>

        <!-- Status Bar -->
        <StatusBar DockPanel.Dock="Bottom">
            <StatusBarItem>
                <TextBlock Text="{Binding StatusText}" />
            </StatusBarItem>
            <Separator />
            <StatusBarItem>
                <TextBlock Text="{Binding DatabaseStatus}" />
            </StatusBarItem>
        </StatusBar>

        <!-- Main Content Area -->
        <Grid>
            <TextBlock Text="The Canonry Desktop"
                       HorizontalAlignment="Center"
                       VerticalAlignment="Center"
                       FontSize="24"
                       Foreground="Gray" />
        </Grid>
    </DockPanel>
</Window>
```

Create `src/TheCanonry.Desktop/Shell/ShellWindow.xaml.cs`:
```csharp
namespace TheCanonry.Desktop.Shell;

using System.Windows;

public partial class ShellWindow : Window
{
    public ShellWindow(ShellViewModel viewModel)
    {
        InitializeComponent();
        DataContext = viewModel;
    }

    private void Exit_Click(object sender, RoutedEventArgs e) => Close();
}
```

- [ ] **Step 3: Create ShellViewModel**

Create `src/TheCanonry.Desktop/Shell/ShellViewModel.cs`:
```csharp
namespace TheCanonry.Desktop.Shell;

using System.ComponentModel;
using System.Runtime.CompilerServices;

public class ShellViewModel : INotifyPropertyChanged
{
    private string _statusText = "Ready";
    private string _databaseStatus = "Disconnected";

    public string StatusText
    {
        get => _statusText;
        set { _statusText = value; OnPropertyChanged(); }
    }

    public string DatabaseStatus
    {
        get => _databaseStatus;
        set { _databaseStatus = value; OnPropertyChanged(); }
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
```

- [ ] **Step 4: Wire up DI and database in App.xaml.cs**

Create `src/TheCanonry.Desktop/App.xaml`:
```xml
<Application x:Class="TheCanonry.Desktop.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <Application.Resources />
</Application>
```

Create `src/TheCanonry.Desktop/App.xaml.cs`:
```csharp
namespace TheCanonry.Desktop;

using System.IO;
using System.Windows;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TheCanonry.Desktop.Shell;
using TheCanonry.Persistence;

public partial class App : Application
{
    private ServiceProvider? _serviceProvider;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var dataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "TheCanonry");
        Directory.CreateDirectory(dataDir);
        var dbPath = Path.Combine(dataDir, "canonry.db");

        var services = new ServiceCollection();

        services.AddDbContext<CanonryDbContext>(options =>
            options.UseSqlite($"Data Source={dbPath}"));

        services.AddTransient<ShellViewModel>();
        services.AddTransient<ShellWindow>();

        _serviceProvider = services.BuildServiceProvider();

        // Ensure database is created
        using (var scope = _serviceProvider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CanonryDbContext>();
            db.Database.EnsureCreated();
        }

        var shell = _serviceProvider.GetRequiredService<ShellWindow>();
        var vm = (ShellViewModel)shell.DataContext;
        vm.DatabaseStatus = $"DB: {dbPath}";
        vm.StatusText = "Ready";
        shell.Show();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _serviceProvider?.Dispose();
        base.OnExit(e);
    }
}
```

- [ ] **Step 5: Verify the solution builds**

```bash
cd ~/src/the-canonry-desktop
dotnet build
```
Expected: Build succeeded. (The app won't launch in a headless environment, but it should compile.)

- [ ] **Step 6: Run all tests**

```bash
dotnet test --verbosity quiet
```
Expected: All tests pass across all test projects.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add WPF Desktop shell with menu bar, status bar, DI, and SQLite database"
```

---

### Task 12: Copy Domain JSON Configs and Web Apps

**Files:**
- Create: `domain/default-project/` (copy from TS repo)
- Create: `web/pics/` (copy from TS repo)
- Create: `web/viewer/` (copy from TS repo)

- [ ] **Step 1: Copy domain JSON configs from TS repo**

```bash
cd ~/src/the-canonry-desktop
mkdir -p domain
cp -r ~/src/the-canonry/apps/canonry/webui/public/default-project domain/
```

- [ ] **Step 2: Copy Pics web app**

```bash
mkdir -p web
cp -r ~/src/the-canonry/apps/pics web/
```

- [ ] **Step 3: Copy Viewer web app**

```bash
cp -r ~/src/the-canonry/apps/viewer web/
# Remove node_modules if copied
rm -rf web/pics/webui/node_modules web/viewer/webui/node_modules 2>/dev/null || true
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: copy domain JSON configs, Pics, and Viewer web apps from TS repo"
```

---

### Task 13: JSON Converters for Nominal Value Objects

The nominal value objects (`EntityKind`, `RelationshipKind`, `EntityStatus`, `CultureId`, `EraId`, `RegionId`) are `readonly record struct` wrappers around strings. `System.Text.Json` cannot deserialize a plain JSON string into them without custom converters.

**Files:**
- Create: `src/Core/TheCanonry.Schema/Json/DomainValueConverters.cs`
- Create: `src/Core/TheCanonry.Schema/Json/EnumConverterConfig.cs`
- Create: `tests/TheCanonry.Schema.Tests/Json/JsonConverterTests.cs`

- [ ] **Step 1: Write failing tests for JSON round-trip**

Create `tests/TheCanonry.Schema.Tests/Json/JsonConverterTests.cs`:
```csharp
namespace TheCanonry.Schema.Tests.Json;

using System.Text.Json;
using TheCanonry.Schema.Domain;
using TheCanonry.Schema.Json;

public class JsonConverterTests
{
    private static readonly JsonSerializerOptions Options = DomainJsonOptions.Default;

    [Fact]
    public void EntityKind_serializes_as_plain_string()
    {
        var kind = new EntityKind("faction");
        var json = JsonSerializer.Serialize(kind, Options);
        Assert.Equal("\"faction\"", json);
    }

    [Fact]
    public void EntityKind_deserializes_from_plain_string()
    {
        var kind = JsonSerializer.Deserialize<EntityKind>("\"faction\"", Options);
        Assert.Equal(new EntityKind("faction"), kind);
    }

    [Fact]
    public void RelationshipKind_round_trips()
    {
        var kind = new RelationshipKind("alliance");
        var json = JsonSerializer.Serialize(kind, Options);
        var back = JsonSerializer.Deserialize<RelationshipKind>(json, Options);
        Assert.Equal(kind, back);
    }

    [Fact]
    public void EntityStatus_round_trips()
    {
        var status = new EntityStatus("dissolved");
        var json = JsonSerializer.Serialize(status, Options);
        var back = JsonSerializer.Deserialize<EntityStatus>(json, Options);
        Assert.Equal(status, back);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --filter "JsonConverter" --verbosity quiet
```
Expected: Compilation errors — `DomainJsonOptions` doesn't exist.

- [ ] **Step 3: Implement JSON converters and shared options**

Create `src/Core/TheCanonry.Schema/Json/DomainValueConverters.cs`:
```csharp
namespace TheCanonry.Schema.Json;

using System.Text.Json;
using System.Text.Json.Serialization;
using TheCanonry.Schema.Domain;
using TheCanonry.Schema.Ids;

public class EntityKindConverter : JsonConverter<EntityKind>
{
    public override EntityKind Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => new(reader.GetString()!);
    public override void Write(Utf8JsonWriter writer, EntityKind value, JsonSerializerOptions options)
        => writer.WriteStringValue(value.Value);
}

public class RelationshipKindConverter : JsonConverter<RelationshipKind>
{
    public override RelationshipKind Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => new(reader.GetString()!);
    public override void Write(Utf8JsonWriter writer, RelationshipKind value, JsonSerializerOptions options)
        => writer.WriteStringValue(value.Value);
}

public class EntityStatusConverter : JsonConverter<EntityStatus>
{
    public override EntityStatus Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => new(reader.GetString()!);
    public override void Write(Utf8JsonWriter writer, EntityStatus value, JsonSerializerOptions options)
        => writer.WriteStringValue(value.Value);
}

public class CultureIdConverter : JsonConverter<CultureId>
{
    public override CultureId Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => new(reader.GetString()!);
    public override void Write(Utf8JsonWriter writer, CultureId value, JsonSerializerOptions options)
        => writer.WriteStringValue(value.Value);
}

public class EraIdConverter : JsonConverter<EraId>
{
    public override EraId Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => new(reader.GetString()!);
    public override void Write(Utf8JsonWriter writer, EraId value, JsonSerializerOptions options)
        => writer.WriteStringValue(value.Value);
}

public class RegionIdConverter : JsonConverter<RegionId>
{
    public override RegionId Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => new(reader.GetString()!);
    public override void Write(Utf8JsonWriter writer, RegionId value, JsonSerializerOptions options)
        => writer.WriteStringValue(value.Value);
}
```

Create `src/Core/TheCanonry.Schema/Json/DomainJsonOptions.cs`:
```csharp
namespace TheCanonry.Schema.Json;

using System.Text.Json;
using System.Text.Json.Serialization;
using TheCanonry.Schema.Config;

public static class DomainJsonOptions
{
    public static readonly JsonSerializerOptions Default = CreateOptions();

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        };

        // Nominal value object converters
        options.Converters.Add(new EntityKindConverter());
        options.Converters.Add(new RelationshipKindConverter());
        options.Converters.Add(new EntityStatusConverter());
        options.Converters.Add(new CultureIdConverter());
        options.Converters.Add(new EraIdConverter());
        options.Converters.Add(new RegionIdConverter());

        // Enum converters — JSON uses lowercase strings
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));

        return options;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --filter "JsonConverter" --verbosity quiet
```
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add JSON converters for nominal value objects and shared DomainJsonOptions"
```

---

### Task 14: JSON Deserialization Smoke Test Against Real Domain Files

Verify the domain JSON configs deserialize correctly into the C# types. The domain config is split across multiple files (`entityKinds.json`, `relationshipKinds.json`, `cultures.json`, etc.), not a single `schema.json`.

**Files:**
- Create: `src/Core/TheCanonry.Schema/Config/DomainSchemaLoader.cs`
- Create: `tests/TheCanonry.Schema.Tests/Config/JsonDeserializationTests.cs`

- [ ] **Step 1: Write failing test that loads actual domain JSON files**

Create `tests/TheCanonry.Schema.Tests/Config/JsonDeserializationTests.cs`:
```csharp
namespace TheCanonry.Schema.Tests.Config;

using System.Text.Json;
using TheCanonry.Schema.Config;
using TheCanonry.Schema.Json;

public class JsonDeserializationTests
{
    private static readonly string DomainDir = Path.GetFullPath(
        Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "domain", "default-project"));

    [SkippableFact]
    public void Can_deserialize_entityKinds_json()
    {
        var path = Path.Combine(DomainDir, "entityKinds.json");
        Skip.IfNot(File.Exists(path), "Domain files not yet copied");

        var json = File.ReadAllText(path);
        var kinds = JsonSerializer.Deserialize<List<EntityKindDefinition>>(json, DomainJsonOptions.Default);

        Assert.NotNull(kinds);
        Assert.NotEmpty(kinds);
    }

    [SkippableFact]
    public void Can_deserialize_relationshipKinds_json()
    {
        var path = Path.Combine(DomainDir, "relationshipKinds.json");
        Skip.IfNot(File.Exists(path), "Domain files not yet copied");

        var json = File.ReadAllText(path);
        var kinds = JsonSerializer.Deserialize<List<RelationshipKindDefinition>>(json, DomainJsonOptions.Default);

        Assert.NotNull(kinds);
        Assert.NotEmpty(kinds);
    }

    [SkippableFact]
    public void Can_deserialize_cultures_json()
    {
        var path = Path.Combine(DomainDir, "cultures.json");
        Skip.IfNot(File.Exists(path), "Domain files not yet copied");

        var json = File.ReadAllText(path);
        var cultures = JsonSerializer.Deserialize<List<CultureDefinition>>(json, DomainJsonOptions.Default);

        Assert.NotNull(cultures);
        Assert.NotEmpty(cultures);
    }

    [SkippableFact]
    public void Can_load_full_domain_schema()
    {
        Skip.IfNot(Directory.Exists(DomainDir), "Domain files not yet copied");

        var schema = DomainSchemaLoader.LoadFromDirectory(DomainDir);

        Assert.NotNull(schema);
        Assert.NotEmpty(schema.EntityKinds);
        Assert.NotEmpty(schema.RelationshipKinds);
        Assert.NotEmpty(schema.Cultures);
    }
}
```

Note: `[SkippableFact]` requires the `Xunit.SkippableFact` NuGet package. Add it to the test project:
```bash
dotnet add tests/TheCanonry.Schema.Tests/TheCanonry.Schema.Tests.csproj package Xunit.SkippableFact
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --filter "JsonDeserialization" --verbosity quiet
```
Expected: Compilation errors — `DomainSchemaLoader` doesn't exist.

- [ ] **Step 3: Implement DomainSchemaLoader**

Create `src/Core/TheCanonry.Schema/Config/DomainSchemaLoader.cs`:
```csharp
namespace TheCanonry.Schema.Config;

using System.Text.Json;
using TheCanonry.Schema.Json;

public static class DomainSchemaLoader
{
    public static DomainSchema LoadFromDirectory(string domainDir)
    {
        var manifestPath = Path.Combine(domainDir, "manifest.json");
        var manifest = File.Exists(manifestPath)
            ? JsonSerializer.Deserialize<DomainManifest>(File.ReadAllText(manifestPath), DomainJsonOptions.Default)
            : null;

        var entityKinds = LoadFile<List<EntityKindDefinition>>(domainDir, "entityKinds.json") ?? [];
        var relationshipKinds = LoadFile<List<RelationshipKindDefinition>>(domainDir, "relationshipKinds.json") ?? [];
        var cultures = LoadFile<List<CultureDefinition>>(domainDir, "cultures.json") ?? [];

        return new DomainSchema
        {
            Id = manifest?.Id ?? Path.GetFileName(domainDir),
            Name = manifest?.Name ?? Path.GetFileName(domainDir),
            Version = manifest?.Version ?? "0.0.0",
            EntityKinds = entityKinds,
            RelationshipKinds = relationshipKinds,
            Cultures = cultures,
        };
    }

    private static T? LoadFile<T>(string dir, string filename)
    {
        var path = Path.Combine(dir, filename);
        if (!File.Exists(path)) return default;
        return JsonSerializer.Deserialize<T>(File.ReadAllText(path), DomainJsonOptions.Default);
    }
}

public class DomainManifest
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public string Version { get; init; } = "";
}
```

- [ ] **Step 4: Run tests — fix any deserialization issues that surface**

```bash
dotnet test tests/TheCanonry.Schema.Tests/ --filter "JsonDeserialization" --verbosity normal
```

If specific fields fail to deserialize, fix the C# type definitions to match the actual JSON structure. Common issues: missing `[JsonPropertyName]` attributes, wrong types, fields present in JSON but absent from C# (add `[JsonExtensionData]` or explicit properties).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add DomainSchemaLoader and JSON deserialization smoke tests"
```

---

## Summary

After completing this plan, the new repo at `~/src/the-canonry-desktop/` contains:

| Component | Status |
|---|---|
| Solution structure | `.sln` with 3 src projects + 2 test projects |
| `TheCanonry.Schema` | Nominal IDs, domain value objects, framework primitives, Entity, Relationship, NarrativeEvent hierarchy, domain schema definitions, DomainRegistry, JSON converters, DomainSchemaLoader |
| `TheCanonry.Persistence` | EF Core + SQLite with SimulationSlots, Entities, Relationships, EnrichmentJobs |
| `TheCanonry.Desktop` | WPF shell with menu bar, status bar, DI, database initialization |
| `domain/` | JSON configs copied from TS repo |
| `web/` | Pics and Viewer apps copied from TS repo |
| Tests | ~30 tests covering type system, JSON converters, domain registry, persistence, domain file deserialization |

**Next plans:**
- **Plan 2: Engine** — Port the simulation engine (WorldEngine, systems, rules, interpreters)
- **Plan 3: Illuminator Core** — Enrichment tasks, queue, API clients
- **Plan 4: Illuminator UI** — WPF views for enrichment workflows
- **Plan 5: Archivist + Chronicler + Forge** — Exploration and simulation runner UI
- **Plan 6: Data Migration** — IndexedDB export/import tooling
