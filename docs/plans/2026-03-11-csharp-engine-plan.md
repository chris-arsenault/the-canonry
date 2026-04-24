# Engine Port Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the lore-weave simulation engine from TypeScript to C#, creating `TheCanonry.Engine` project.

**Architecture:** Bottom-up port following dependency layers: Graph → Rules → Statistics/Selection → Coordinates → Runtime → Systems → Templates → WorldEngine. Each layer is testable in isolation. The TS source at `~/src/the-canonry/apps/lore-weave/lib/` is the reference implementation.

**Tech Stack:** .NET 10, xUnit, C# 13. No external packages beyond what's in the solution.

**Source Reference:** `~/src/the-canonry/apps/lore-weave/lib/` — read TS files for exact logic when implementing.

---

## Chunk 1: Project Scaffold + Graph Store

### Task 1: Create Engine Project and Test Project

**Files:**
- Create: `src/Core/TheCanonry.Engine/TheCanonry.Engine.csproj`
- Create: `tests/TheCanonry.Engine.Tests/TheCanonry.Engine.Tests.csproj`

- [ ] **Step 1: Create projects**

```bash
cd ~/src/the-canonry-desktop
mkdir -p src/Core/TheCanonry.Engine
dotnet new classlib -o src/Core/TheCanonry.Engine --no-restore
dotnet sln TheCanonry.slnx add src/Core/TheCanonry.Engine/TheCanonry.Engine.csproj
dotnet add src/Core/TheCanonry.Engine reference src/Core/TheCanonry.Schema/TheCanonry.Schema.csproj

mkdir -p tests/TheCanonry.Engine.Tests
dotnet new xunit -o tests/TheCanonry.Engine.Tests --no-restore
dotnet sln TheCanonry.slnx add tests/TheCanonry.Engine.Tests/TheCanonry.Engine.Tests.csproj
dotnet add tests/TheCanonry.Engine.Tests reference src/Core/TheCanonry.Engine/TheCanonry.Engine.csproj
dotnet add tests/TheCanonry.Engine.Tests reference src/Core/TheCanonry.Schema/TheCanonry.Schema.csproj
```

Delete auto-generated Class1.cs and UnitTest1.cs files. Ensure both .csproj files have `<TargetFramework>net10.0</TargetFramework>`.

- [ ] **Step 2: Verify solution builds**

```bash
dotnet test tests/TheCanonry.Engine.Tests/ --verbosity minimal
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: scaffold Engine project and test project"
```

---

### Task 2: Graph Store — Entity and Relationship Storage

Port `engine/types.ts` (Graph interface) and the graph module. The GraphStore is the in-memory entity/relationship store.

**Reference TS:** `engine/types.ts` (Graph interface, EntityCriteria, RelationshipCriteria), `graph/graphQueries.ts`, `graph/entityMutation.ts`, `graph/relationshipMutation.ts`, `graph/entityArchival.ts`, `graph/relationshipBuilder.ts`

**Files:**
- Create: `src/Core/TheCanonry.Engine/Graph/IGraph.cs`
- Create: `src/Core/TheCanonry.Engine/Graph/GraphStore.cs`
- Create: `src/Core/TheCanonry.Engine/Graph/EntityCriteria.cs`
- Create: `src/Core/TheCanonry.Engine/Graph/RelationshipCriteria.cs`
- Create: `src/Core/TheCanonry.Engine/Graph/GraphQueries.cs`
- Create: `src/Core/TheCanonry.Engine/Graph/EntityMutation.cs`
- Create: `src/Core/TheCanonry.Engine/Graph/EntityArchival.cs`
- Create: `src/Core/TheCanonry.Engine/Graph/RelationshipMutation.cs`
- Create: `src/Core/TheCanonry.Engine/Graph/RelationshipBuilder.cs`
- Create: `tests/TheCanonry.Engine.Tests/Graph/GraphStoreTests.cs`
- Create: `tests/TheCanonry.Engine.Tests/Graph/GraphQueriesTests.cs`

- [ ] **Step 1: Write IGraph interface**

Port the `Graph` interface from `engine/types.ts`. Key members:
- Entity CRUD: `GetEntity`, `HasEntity`, `GetEntities`, `FindEntities`, `GetEntitiesByKind`, `GetConnectedEntities`, `CreateEntity`, `UpdateEntity`, `DeleteEntity`
- Relationship CRUD: `GetRelationships`, `FindRelationships`, `GetEntityRelationships`, `HasRelationship`, `AddRelationship`, `RemoveRelationship`
- State properties: `Tick`, `CurrentEra`, `Pressures`, `NarrativeHistory`, `RateLimitState`

Use `Entity` and `Relationship` from `TheCanonry.Schema.World`. Use `Direction` enum (`Source`, `Target`, `Both`).

- [ ] **Step 2: Write EntityCriteria and RelationshipCriteria**

Port from `engine/types.ts`. Use record types with optional fields and factory methods.

- [ ] **Step 3: Write GraphStore implementation**

Port the `GraphStore` class. Internal storage: `Dictionary<EntityId, Entity>` for entities, `List<Relationship>` for relationships. Implement all IGraph methods. Read `engine/types.ts` for the `GraphStore.create()` factory.

- [ ] **Step 4: Write GraphQueries static helpers**

Port from `graph/graphQueries.ts`: `GetEntitiesByRelationship`, `GetRelationshipIdSet`, `CountRelationships`, `FindRelationship`, `GetRelatedEntity`.

- [ ] **Step 5: Write EntityMutation helpers**

Port from `graph/entityMutation.ts`: `SlugifyName`, `GenerateEntityIdFromName`, `NormalizeInitialState`, `AddEntity`, `UpdateEntity`.

- [ ] **Step 6: Write EntityArchival helpers**

Port from `graph/entityArchival.ts`: `ArchiveEntity`, `ArchiveEntities`, `TransferRelationships`, `CreatePartOfRelationships`, `SupersedeEntity`, etc.

- [ ] **Step 7: Write RelationshipMutation helpers**

Port from `graph/relationshipMutation.ts`: `AddRelationship`, `ArchiveRelationship`, `ModifyRelationshipStrength`, `CanFormRelationship`, `RecordRelationshipFormation`.

- [ ] **Step 8: Write RelationshipBuilder**

Port from `graph/relationshipBuilder.ts`: fluent builder with `Add`, `AddManyFrom`, `AddManyTo`, `AddBidirectional`, `AddIfNotExists`, `Build`.

- [ ] **Step 9: Write tests**

Test GraphStore: create entities, find by criteria, add/remove relationships, archive entities, relationship queries. Test GraphQueries: count relationships, find related entities. At least 15 tests.

- [ ] **Step 10: Run tests, commit**

```bash
dotnet test tests/TheCanonry.Engine.Tests/ --verbosity minimal
git add -A && git commit -m "feat: add GraphStore with entity/relationship CRUD, queries, mutations, archival"
```

---

## Chunk 2: Rules Library

### Task 3: Rules Type Definitions

Port the declarative rule types — conditions, filters, mutations, metrics.

**Reference TS:** `rules/types.ts`, `rules/conditions/types.ts`, `rules/filters/types.ts`, `rules/mutations/types.ts`, `rules/metrics/types.ts`, `rules/selection/types.ts`

**Files:**
- Create: `src/Core/TheCanonry.Engine/Rules/Types/Condition.cs` — sealed hierarchy for all condition types (PressureCondition, EntityCountCondition, EraMatchCondition, RandomChanceCondition, AndCondition, OrCondition, etc.)
- Create: `src/Core/TheCanonry.Engine/Rules/Types/SelectionFilter.cs` — sealed hierarchy for filter types (KindFilter, SubtypeFilter, StatusFilter, HasTagFilter, HasRelationshipFilter, ProminenceFilter, GraphPathFilter, etc.)
- Create: `src/Core/TheCanonry.Engine/Rules/Types/Mutation.cs` — sealed hierarchy for mutation types (SetTagMutation, RemoveTagMutation, ChangeStatusMutation, ModifyPressureMutation, ArchiveRelationshipMutation, etc.)
- Create: `src/Core/TheCanonry.Engine/Rules/Types/Metric.cs` — sealed hierarchy for metric types (EntityCountMetric, RelationshipCountMetric, TagCountMetric, RatioMetric, etc.)
- Create: `src/Core/TheCanonry.Engine/Rules/Types/SelectionRule.cs` — selection rule types
- Create: `src/Core/TheCanonry.Engine/Rules/Types/GraphPathTypes.cs` — GraphPathAssertion, PathStep, PathConstraint

All type hierarchies should use `abstract record` base + `sealed record` subtypes for exhaustive pattern matching.

- [ ] **Step 1: Read all TS type files, write C# sealed hierarchies**
- [ ] **Step 2: Verify compilation**
- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add Rules type definitions — conditions, filters, mutations, metrics, selection"
```

---

### Task 4: Rules Evaluation Engine

Port the evaluation logic for conditions, filters, mutations, metrics.

**Reference TS:** `rules/conditions/index.ts`, `rules/filters/index.ts`, `rules/mutations/index.ts`, `rules/metrics/index.ts`, `rules/selection/index.ts`, `rules/graphPath.ts`, `rules/resolver.ts`, `rules/context.ts`

**Files:**
- Create: `src/Core/TheCanonry.Engine/Rules/RuleContext.cs`
- Create: `src/Core/TheCanonry.Engine/Rules/IEntityResolver.cs`
- Create: `src/Core/TheCanonry.Engine/Rules/ConditionEvaluator.cs`
- Create: `src/Core/TheCanonry.Engine/Rules/FilterEvaluator.cs`
- Create: `src/Core/TheCanonry.Engine/Rules/MutationApplier.cs`
- Create: `src/Core/TheCanonry.Engine/Rules/MetricEvaluator.cs`
- Create: `src/Core/TheCanonry.Engine/Rules/EntitySelector.cs`
- Create: `src/Core/TheCanonry.Engine/Rules/GraphPathEvaluator.cs`
- Create: `tests/TheCanonry.Engine.Tests/Rules/ConditionEvaluatorTests.cs`
- Create: `tests/TheCanonry.Engine.Tests/Rules/FilterEvaluatorTests.cs`
- Create: `tests/TheCanonry.Engine.Tests/Rules/MutationApplierTests.cs`

- [ ] **Step 1: Write RuleContext and IEntityResolver**

`RuleContext` holds graph reference, entity resolver, current entity. `IEntityResolver` resolves `$variable` references.

- [ ] **Step 2: Write ConditionEvaluator**

Pattern match on Condition subtypes. Each condition type (pressure, entity count, era match, random chance, and/or) gets a case. Read `rules/conditions/index.ts` for exact logic.

- [ ] **Step 3: Write FilterEvaluator**

Pattern match on SelectionFilter subtypes. Filter entities by kind, subtype, status, tags, relationships, prominence, graph paths. Read `rules/filters/index.ts`.

- [ ] **Step 4: Write MutationApplier**

Pattern match on Mutation subtypes. Apply tag changes, status changes, pressure modifications. Read `rules/mutations/index.ts`.

- [ ] **Step 5: Write MetricEvaluator**

Pattern match on Metric subtypes. Calculate entity counts, relationship counts, ratios, tag counts. Read `rules/metrics/index.ts` and subdirectory evaluator files.

- [ ] **Step 6: Write EntitySelector**

Port `rules/selection/index.ts`: entity selection with criteria, preference, saturation limits.

- [ ] **Step 7: Write GraphPathEvaluator**

Port `rules/graphPath.ts`: multi-hop graph traversal with intermediate constraints.

- [ ] **Step 8: Write tests**

Test conditions (pressure above/below, entity count, and/or composition). Test filters (kind, subtype, tag presence). Test mutations (tag set/remove, status change). At least 15 tests.

- [ ] **Step 9: Run tests, commit**

```bash
dotnet test tests/TheCanonry.Engine.Tests/ --verbosity minimal
git add -A && git commit -m "feat: add Rules evaluation engine — conditions, filters, mutations, metrics, selection"
```

---

## Chunk 3: Statistics and Selection

### Task 5: Population Tracker and Distribution Calculations

**Reference TS:** `statistics/populationTracker.ts`, `statistics/distributionCalculations.ts`

**Files:**
- Create: `src/Core/TheCanonry.Engine/Statistics/PopulationTracker.cs`
- Create: `src/Core/TheCanonry.Engine/Statistics/PopulationMetrics.cs`
- Create: `src/Core/TheCanonry.Engine/Statistics/DistributionCalculations.cs`
- Create: `tests/TheCanonry.Engine.Tests/Statistics/PopulationTrackerTests.cs`

- [ ] **Step 1: Write PopulationMetrics types**

`EntityMetric`, `RelationshipMetric`, `PressureMetric`, `PopulationMetrics` — record types with count, target, deviation, trend, history.

- [ ] **Step 2: Write PopulationTracker**

Port from `statistics/populationTracker.ts`. Methods: `Update(graph)`, `GetMetrics()`, `GetOutliers(threshold)`, `GetSummary()`. Tracks per-subtype counts, targets, deviations, trends with 10-tick history window.

- [ ] **Step 3: Write DistributionCalculations**

Port from `statistics/distributionCalculations.ts`. Static methods: `CalculateEntityKindCounts`, `CalculateRatios`, `CalculateProminenceDistribution`, `CalculateRelationshipDistribution`, `CalculateConnectivityMetrics`.

- [ ] **Step 4: Write tests**

Test tracker update with mock graph, verify deviations and trends. Test distribution calculations. At least 8 tests.

- [ ] **Step 5: Run tests, commit**

```bash
dotnet test tests/TheCanonry.Engine.Tests/ --verbosity minimal
git add -A && git commit -m "feat: add PopulationTracker and distribution calculations"
```

---

### Task 6: Target Selector and Dynamic Weight Calculator

**Reference TS:** `selection/targetSelector.ts`, `selection/dynamicWeightCalculator.ts`

**Files:**
- Create: `src/Core/TheCanonry.Engine/Selection/TargetSelector.cs`
- Create: `src/Core/TheCanonry.Engine/Selection/SelectionBias.cs`
- Create: `src/Core/TheCanonry.Engine/Selection/SelectionResult.cs`
- Create: `src/Core/TheCanonry.Engine/Selection/DynamicWeightCalculator.cs`
- Create: `tests/TheCanonry.Engine.Tests/Selection/TargetSelectorTests.cs`

- [ ] **Step 1: Write SelectionBias and SelectionResult types**

Port from TS. SelectionBias has preferences (subtypes, tags, prominence), avoidance (relationship kinds, hub penalty), culture requirements.

- [ ] **Step 2: Write TargetSelector**

Port from `selection/targetSelector.ts`. Weighted entity selection that prevents super-hub formation. Methods: `SelectTargets(graph, kind, count, bias)`.

- [ ] **Step 3: Write DynamicWeightCalculator**

Port from `selection/dynamicWeightCalculator.ts`. Adjusts template weights based on population deviation. Methods: `CalculateWeight`, `CalculateAllWeights`.

- [ ] **Step 4: Write tests, commit**

```bash
dotnet test tests/TheCanonry.Engine.Tests/ --verbosity minimal
git add -A && git commit -m "feat: add TargetSelector and DynamicWeightCalculator"
```

---

## Chunk 4: Coordinate System

### Task 7: Semantic Coordinate Context

**Reference TS:** `coordinates/coordinateContext.ts`, `coordinates/types.ts`, `coordinates/coordinateStatistics.ts`

**Files:**
- Create: `src/Core/TheCanonry.Engine/Coordinates/CoordinateContext.cs`
- Create: `src/Core/TheCanonry.Engine/Coordinates/PlacementResult.cs`
- Create: `src/Core/TheCanonry.Engine/Coordinates/PlacementTypes.cs`
- Create: `src/Core/TheCanonry.Engine/Coordinates/CoordinateStatistics.cs`
- Create: `tests/TheCanonry.Engine.Tests/Coordinates/CoordinateContextTests.cs`

- [ ] **Step 1: Write PlacementTypes**

Port `coordinates/types.ts`: `PlacementContext`, `PlacementResult`, `Region`, `EmergentRegionResult`, `SparseAreaResult`, `RegionLookupResult`.

- [ ] **Step 2: Write CoordinateContext**

Port from `coordinates/coordinateContext.ts` (800 lines). Core methods:
- `DeriveCoordinatesWithCulture(cultureId, entityKind, references)` → coordinates + regionId + derived tags
- `FindNearestEntities`, `FindEntitiesInRadius`, `GetDistance`
- `PlaceWithCulture`, `PlaceInRegion`, `PlaceNearEntity`
- `CreateEmergentRegion`, `FindSparseArea`
- Seed region loading, culture bias, axis-derived tags

This is the most complex single class. Read the TS carefully for placement strategy priority: anchor region → seed region → sparse → random.

- [ ] **Step 3: Write CoordinateStatistics**

Port `coordinates/coordinateStatistics.ts`.

- [ ] **Step 4: Write tests**

Test placement near a reference entity, seed region selection, distance calculations. At least 6 tests.

- [ ] **Step 5: Run tests, commit**

```bash
dotnet test tests/TheCanonry.Engine.Tests/ --verbosity minimal
git add -A && git commit -m "feat: add CoordinateContext for semantic placement with culture biases"
```

---

## Chunk 5: Engine Configuration and Declarative Types

### Task 8: Engine Configuration Types

Port the EngineConfig and related types that tie everything together.

**Reference TS:** `engine/types.ts` (EngineConfig, Era, Pressure, SimulationSystem, GrowthTemplate, TemplateResult, SystemResult), `engine/declarativeTypes.ts`, `engine/declarativePressureTypes.ts`

**Files:**
- Create: `src/Core/TheCanonry.Engine/Engine/EngineConfig.cs`
- Create: `src/Core/TheCanonry.Engine/Engine/Era.cs`
- Create: `src/Core/TheCanonry.Engine/Engine/ISimulationSystem.cs`
- Create: `src/Core/TheCanonry.Engine/Engine/SystemResult.cs`
- Create: `src/Core/TheCanonry.Engine/Engine/INameGenerationService.cs`
- Create: `src/Core/TheCanonry.Engine/Engine/ISimulationEmitter.cs`
- Create: `src/Core/TheCanonry.Engine/Templates/DeclarativeTemplate.cs`
- Create: `src/Core/TheCanonry.Engine/Templates/TemplateResult.cs`
- Create: `src/Core/TheCanonry.Engine/Templates/CreationRule.cs`
- Create: `src/Core/TheCanonry.Engine/Templates/PlacementSpec.cs`
- Create: `src/Core/TheCanonry.Engine/Pressures/DeclarativePressure.cs`

- [ ] **Step 1: Write Era, ISimulationSystem, SystemResult, EngineConfig**

Port from `engine/types.ts`. Era has exit/entry conditions (using Condition type from Rules), template weights, system modifiers. `ISimulationSystem` interface: `Id`, `Name`, `Initialize()`, `Apply(runtime, modifier)`. `SystemResult`: relationships added/adjusted/archived, entities modified, pressure changes.

- [ ] **Step 2: Write DeclarativeTemplate and related types**

Port from `engine/declarativeTypes.ts`. Template has applicability rules, selection rule, creation rules, relationship rules, state updates, variables, variants. Use the Condition/Filter/Mutation types from Task 3.

- [ ] **Step 3: Write DeclarativePressure types**

Port from `engine/declarativePressureTypes.ts`.

- [ ] **Step 4: Write INameGenerationService and ISimulationEmitter interfaces**

Simple async interfaces. `INameGenerationService.GenerateAsync(kind, subtype, prominence, tags, culture, context)`. `ISimulationEmitter` for epoch/tick/system events.

- [ ] **Step 5: Verify compilation, commit**

```bash
dotnet test tests/TheCanonry.Engine.Tests/ --verbosity minimal
git add -A && git commit -m "feat: add EngineConfig, Era, ISimulationSystem, DeclarativeTemplate, DeclarativePressure types"
```

---

## Chunk 6: Runtime and Interpreters

### Task 9: WorldRuntime Facade

**Reference TS:** `runtime/worldRuntime.ts` (1000+ lines)

**Files:**
- Create: `src/Core/TheCanonry.Engine/Runtime/WorldRuntime.cs`
- Create: `tests/TheCanonry.Engine.Tests/Runtime/WorldRuntimeTests.cs`

- [ ] **Step 1: Write WorldRuntime**

Port from `runtime/worldRuntime.ts`. Wraps GraphStore + TargetSelector + CoordinateContext + EngineConfig. Exposes read/write graph access, coordinate placement, pressure management, selection. This is the primary interface that systems and templates use.

Key method groups:
- Graph access (delegates to GraphStore)
- Coordinate placement (delegates to CoordinateContext)
- Pressure management (getPressure, modifyPressure)
- Selection (selectTargets)
- Entity archival (delegates to EntityArchival)
- Logging/debugging

- [ ] **Step 2: Write tests**

Test that WorldRuntime correctly delegates to underlying components. At least 5 tests.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add WorldRuntime facade"
```

---

### Task 10: Template Interpreter

**Reference TS:** `engine/templateInterpreter.ts` (500+ lines)

**Files:**
- Create: `src/Core/TheCanonry.Engine/Templates/TemplateInterpreter.cs`
- Create: `src/Core/TheCanonry.Engine/Templates/ExecutionContext.cs`
- Create: `tests/TheCanonry.Engine.Tests/Templates/TemplateInterpreterTests.cs`

- [ ] **Step 1: Write ExecutionContext**

Variable resolution context. Stores resolved variables (`$target`, `$varName`), entity references. Implements IEntityResolver.

- [ ] **Step 2: Write TemplateInterpreter**

Port from `engine/templateInterpreter.ts`. Converts DeclarativeTemplate + target entity into TemplateResult. 6-phase execution:
1. Applicability check (evaluate conditions)
2. Selection (apply filters to find targets)
3. Variable resolution (resolve `$var` references from graph)
4. Entity creation (from CreationRules → Partial<Entity>)
5. Relationship creation (from RelationshipRules)
6. State updates (apply mutations)
7. Variants (conditional sub-templates)

- [ ] **Step 3: Write tests**

Test template expansion with a simple template that creates entities and relationships. At least 5 tests.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add TemplateInterpreter with 7-phase template expansion"
```

---

### Task 11: System Interpreter and Pressure Interpreter

**Reference TS:** `engine/systemInterpreter.ts`, `engine/pressureInterpreter.ts`

**Files:**
- Create: `src/Core/TheCanonry.Engine/Engine/SystemInterpreter.cs`
- Create: `src/Core/TheCanonry.Engine/Pressures/PressureInterpreter.cs`
- Create: `src/Core/TheCanonry.Engine/Pressures/Pressure.cs`

- [ ] **Step 1: Write SystemInterpreter**

Factory that converts DeclarativeSystem JSON configs into `ISimulationSystem` instances. Reads system type field, dispatches to appropriate system constructor.

- [ ] **Step 2: Write PressureInterpreter**

Port from `engine/pressureInterpreter.ts`. Converts DeclarativePressure configs into runtime Pressure objects. Pressure has `Id`, `Name`, `Value`, `Growth(graph)` function, `Homeostasis` target.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add SystemInterpreter and PressureInterpreter"
```

---

## Chunk 7: Simulation Systems

### Task 12: Core Simulation Systems (5 systems)

**Reference TS:** `systems/eraSpawner.ts`, `systems/eraTransition.ts`, `systems/connectionEvolution.ts`, `systems/relationshipMaintenance.ts`, `systems/thresholdTrigger.ts`

**Files:**
- Create: `src/Core/TheCanonry.Engine/Systems/EraSpawner.cs`
- Create: `src/Core/TheCanonry.Engine/Systems/EraTransition.cs`
- Create: `src/Core/TheCanonry.Engine/Systems/ConnectionEvolution.cs`
- Create: `src/Core/TheCanonry.Engine/Systems/RelationshipMaintenance.cs`
- Create: `src/Core/TheCanonry.Engine/Systems/ThresholdTrigger.cs`
- Create: `tests/TheCanonry.Engine.Tests/Systems/SystemTests.cs`

- [ ] **Step 1: Port EraSpawner** — creates era entities at simulation start
- [ ] **Step 2: Port EraTransition** — manages era exit/entry conditions and effects
- [ ] **Step 3: Port ConnectionEvolution** — relationship strength changes over time
- [ ] **Step 4: Port RelationshipMaintenance** — decay, reinforce, cull relationships
- [ ] **Step 5: Port ThresholdTrigger** — condition detection, tag/pressure setting
- [ ] **Step 6: Write tests, commit**

```bash
git add -A && git commit -m "feat: add core simulation systems — EraSpawner, EraTransition, ConnectionEvolution, RelationshipMaintenance, ThresholdTrigger"
```

---

### Task 13: Advanced Simulation Systems (5 systems)

**Reference TS:** `systems/graphContagion.ts`, `systems/clusterFormation.ts`, `systems/tagDiffusion.ts`, `systems/planeDiffusion.ts`, `systems/universalCatalyst.ts`

**Files:**
- Create: `src/Core/TheCanonry.Engine/Systems/GraphContagion.cs`
- Create: `src/Core/TheCanonry.Engine/Systems/ClusterFormation.cs`
- Create: `src/Core/TheCanonry.Engine/Systems/TagDiffusion.cs`
- Create: `src/Core/TheCanonry.Engine/Systems/PlaneDiffusion.cs`
- Create: `src/Core/TheCanonry.Engine/Systems/UniversalCatalyst.cs`
- Create: `src/Core/TheCanonry.Engine/Systems/CatalystHelpers.cs`

- [ ] **Step 1: Port GraphContagion** — BFS-based state spreading through network
- [ ] **Step 2: Port ClusterFormation** — meta-entity creation from similar entities
- [ ] **Step 3: Port TagDiffusion** — tag propagation/divergence through relationships
- [ ] **Step 4: Port PlaneDiffusion** — semantic field diffusion
- [ ] **Step 5: Port UniversalCatalyst** — agent actions with success/failure mechanics
- [ ] **Step 6: Port CatalystHelpers**
- [ ] **Step 7: Write tests, commit**

```bash
git add -A && git commit -m "feat: add advanced simulation systems — GraphContagion, ClusterFormation, TagDiffusion, PlaneDiffusion, UniversalCatalyst"
```

---

### Task 14: Growth System

**Reference TS:** `systems/growthSystem.ts` (500+ lines)

**Files:**
- Create: `src/Core/TheCanonry.Engine/Systems/GrowthSystem.cs`
- Create: `tests/TheCanonry.Engine.Tests/Systems/GrowthSystemTests.cs`

- [ ] **Step 1: Port GrowthSystem**

The growth system is a special system that creates entities via templates. It manages:
- Per-epoch budgeting and target management
- Template sampling (weighted by era + dynamic weights)
- Template application (via TemplateInterpreter)
- Culling, yield tracking
- Contract enforcement, narration generation

Key methods: `StartEpoch(era)`, `Apply(runtime, modifier)`, `CompleteEpoch()`.

- [ ] **Step 2: Write tests**

Test epoch budgeting, template selection with weights. At least 4 tests.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add GrowthSystem — template-based entity creation engine"
```

---

## Chunk 8: WorldEngine Orchestrator

### Task 15: WorldEngine

**Reference TS:** `engine/worldEngine.ts` (2400+ lines)

**Files:**
- Create: `src/Core/TheCanonry.Engine/Engine/WorldEngine.cs`
- Create: `src/Core/TheCanonry.Engine/Engine/EpochRunner.cs`
- Create: `src/Core/TheCanonry.Engine/Engine/SimulationTickRunner.cs`
- Create: `tests/TheCanonry.Engine.Tests/Engine/WorldEngineTests.cs`

Unlike the TS version which is one 2400-line file, split into:
- `WorldEngine` — initialization, main loop, public API
- `EpochRunner` — per-epoch lifecycle (growth + simulation)
- `SimulationTickRunner` — per-tick system execution

- [ ] **Step 1: Write SimulationTickRunner**

Runs all systems for one tick. Captures tick-start pressures, executes systems sequentially, applies results (entity/relationship changes, pressure deltas), emits events.

- [ ] **Step 2: Write EpochRunner**

Manages epoch lifecycle: start growth phase, run simulation ticks, complete growth, prune/consolidate, record statistics, emit events.

- [ ] **Step 3: Write WorldEngine**

Main orchestrator. `Run()` method: initialize → while(shouldContinue) → runEpoch → checkEraTransitions. Initialization: create GraphStore, build systems from declarative configs, build pressures, initialize coordinates, start growth system.

- [ ] **Step 4: Write tests**

Test engine initialization with minimal config. Test single-tick execution. Test era transition detection. At least 5 tests.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add WorldEngine orchestrator with epoch/tick loop"
```

---

## Chunk 9: Integration and Validation

### Task 16: Configuration Validation

**Reference TS:** `engine/validationOrchestrator.ts`, `engine/contractEnforcer.ts`, `engine/frameworkValidator.ts`

**Files:**
- Create: `src/Core/TheCanonry.Engine/Engine/ValidationOrchestrator.cs`
- Create: `src/Core/TheCanonry.Engine/Engine/ContractEnforcer.cs`
- Create: `src/Core/TheCanonry.Engine/Engine/FrameworkValidator.cs`

- [ ] **Step 1: Port validation chain** — validate config completeness, framework primitives, contracts
- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add configuration validation — ValidationOrchestrator, ContractEnforcer, FrameworkValidator"
```

---

### Task 17: JSON Deserialization for Engine Config

Add JSON converters and a loader for the engine configuration files (eras.json, generators.json, systems.json, pressures.json, actions.json).

**Files:**
- Create: `src/Core/TheCanonry.Engine/Config/EngineConfigLoader.cs`
- Create: `tests/TheCanonry.Engine.Tests/Config/EngineConfigLoaderTests.cs`

- [ ] **Step 1: Write EngineConfigLoader**

Loads from domain directory: `eras.json` → `Era[]`, `generators.json` → `DeclarativeTemplate[]`, `systems.json` → `DeclarativeSystem[]`, `pressures.json` → `DeclarativePressure[]`, `actions.json` → `DeclarativeAction[]`.

- [ ] **Step 2: Write smoke tests against real domain files**

SkippableFact tests loading from `domain/default-project/`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add EngineConfigLoader with JSON deserialization for all engine config files"
```

---

## Summary

After completing this plan, `TheCanonry.Engine` contains:

| Component | Files |
|---|---|
| Graph | GraphStore, IGraph, queries, mutations, archival, builder |
| Rules | Condition/Filter/Mutation/Metric hierarchies + evaluators |
| Statistics | PopulationTracker, distributions |
| Selection | TargetSelector, DynamicWeightCalculator |
| Coordinates | CoordinateContext, placement types |
| Engine | WorldEngine, EpochRunner, SimulationTickRunner, EngineConfig |
| Templates | TemplateInterpreter, DeclarativeTemplate, CreationRule |
| Systems | 11 system implementations + GrowthSystem |
| Pressures | PressureInterpreter, DeclarativePressure |
| Validation | ValidationOrchestrator, ContractEnforcer, FrameworkValidator |
| Config | EngineConfigLoader for JSON deserialization |

**Next plans:**
- **Plan 3: Illuminator Core** — Enrichment tasks, queue, API clients
- **Plan 4: Illuminator UI** — WPF views for enrichment workflows
