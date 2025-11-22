# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **procedural world history generator** that creates rich, interconnected knowledge graphs through a hybrid approach combining **template-based entity generation** with **simulation-based relationship formation**. It generates a lived-in world starting from a minimal seed (~14 entities) and produces a dense graph (~150-200 entities, ~300-500 relationships) suitable for game initialization.

## Development Commands

```bash
# Development (TypeScript with ts-node)
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run compiled JavaScript
npm start

# Clean output directories
npm run clean
```

**Output Location**: `./output/generated_world.json` and `./output/graph_viz.json`

## Core Architecture

### The Hybrid Generation Model

The system alternates between two phases:

1. **Growth Phase**: Templates rapidly populate the graph by creating **batches of pre-connected entities**
2. **Simulation Phase**: Systems create **relationships between existing entities** and modify their states

This achieves 80% of full simulation depth with 20% of the complexity.

### Four Core Components

#### 1. Growth Templates (`src/templates/`)
- **Purpose**: Entity factories that create clusters of related entities in one operation
- **Interface**: `GrowthTemplate` with `canApply()`, `findTargets()`, and `expand()` methods
- **Key Pattern**: Templates create **pre-connected clusters**, not isolated nodes
- **ID Resolution**: Use placeholder IDs like `will-be-assigned-0` for entities created within the same template; the engine resolves these after assigning real IDs

**Template Categories**:
- `npc/npcTemplates.ts`: Family expansion, hero emergence, outlaw recruitment, succession
- `faction/factionTemplates.ts`: Faction splinters, guild establishment, cult formation
- `additionalTemplates.ts`: Rules, abilities, and location templates

#### 2. Simulation Systems (`src/systems/simulationSystems.ts`)
- **Purpose**: Relationship generators that operate on graph patterns, not specific entities
- **Interface**: `SimulationSystem` with `apply(graph, modifier)` method
- **Returns**: New relationships, entity modifications, pressure changes, and description
- **Key Pattern**: Systems observe graph state and react with modifications

**System Categories**:
- Social dynamics (relationship formation)
- Conflict spread (contagion through alliances)
- Economic dynamics (resource flow, status changes)
- Cultural drift (prominence evolution)

#### 3. Era Progression (`src/config/eras.ts`)
- **Purpose**: Temporal contexts that modify template weights and system behaviors
- **Five Eras**: Expansion → Conflict → Innovation → Invasion → Reconstruction
- **Each Era Defines**:
  - `templateWeights`: Multipliers for which templates run (0 = disabled, 2.0 = doubled)
  - `systemModifiers`: Multipliers for system effects
  - `specialRules`: Optional graph transformations

**Era Selection**: Progresses linearly through epochs via `selectEra(epoch, eras)`

#### 4. Pressure System (`src/config/pressures.ts`)
- **Purpose**: Background forces that accumulate based on graph state and enable certain templates
- **Six Pressures**: resource_scarcity, conflict, magical_instability, cultural_tension, stability, external_threat
- **Each Pressure Defines**:
  - `value`: Current level (0-100)
  - `growth(graph)`: Calculate delta from world state
  - `decay`: Natural decay per tick

### Execution Flow

```
Main Loop (worldEngine.ts):
  while (shouldContinue):
    1. Select era based on current epoch
    2. GROWTH PHASE:
       - Select templates weighted by era
       - Apply 5-15 templates to create entity batches
       - Each template creates 2-5 connected entities
    3. SIMULATION PHASE:
       - Run 10 simulation ticks
       - Each tick applies all systems with era modifiers
       - Systems create relationships and modify states
    4. Update pressures based on new world state
    5. Check stop conditions (maxTicks, target population, eras exhausted)
```

**Stop Conditions**:
- `tick >= maxTicks` (default: 500)
- `epoch >= eras.length * 2`
- `entities.size >= targetEntitiesPerKind * 5`

## Type System

### Core Entity Structure (`src/types/worldTypes.ts`)

```typescript
HardState {
  id: string                    // Stable ID in graph
  kind: 'npc' | 'location' | 'faction' | 'rules' | 'abilities'
  subtype: string               // e.g., 'merchant', 'colony', 'criminal'
  name: string
  description: string
  status: string                // Entity-kind specific
  prominence: Prominence        // 'forgotten' | 'marginal' | 'recognized' | 'renowned' | 'mythic'
  tags: string[]                // Maximum 5 elements
  links: Relationship[]         // Cached relationships
  createdAt: number             // Tick of creation
  updatedAt: number             // Last modification tick
}

Relationship {
  kind: string                  // Must be valid per worldSchema
  src: string                   // Entity ID
  dst: string                   // Entity ID
}
```

### Graph Structure (`src/types/engine.ts`)

```typescript
Graph {
  entities: Map<string, HardState>
  relationships: Relationship[]
  tick: number
  currentEra: Era
  pressures: Map<string, number>
  history: HistoryEvent[]
}
```

## Key Invariants

1. Every entity has a unique ID
2. Every relationship's src/dst must exist in entities
3. Relationship kinds must be valid (would be validated against worldSchema if it existed)
4. Entity links array should match relationships
5. Prominence is bounded: forgotten ≤ p ≤ mythic
6. Tags array has maximum 5 elements

## Configuration (`src/main.ts`)

```typescript
const config: EngineConfig = {
  eras: penguinEras,
  templates: [...npcTemplates, ...factionTemplates, ...additionalTemplates],
  systems: allSystems,
  pressures: pressures,

  epochLength: 20,                    // Ticks per epoch
  simulationTicksPerGrowth: 10,       // Balance between growth and simulation
  targetEntitiesPerKind: 30,          // Final size (~150 total for 5 kinds)
  maxTicks: 500                       // Maximum simulation ticks
};
```

## Initial State (`data/initialState.json`)

The seed world contains 14 pre-defined entities:
- 1 iceberg (Aurora Berg)
- 5 locations (2 colonies, 3 geographic features/anomalies)
- 2 factions (merchant guild, criminal syndicate)
- 4 NPCs (2 mayors, 2 heroes)
- 2 abilities (magic and technology)

**Important**: Initial state entities are missing `id`, `createdAt`, and `updatedAt` fields. The engine adds these during initialization.

## Known Issues

### TypeScript Compilation Error
**Location**: `src/main.ts:46`
**Issue**: Initial state entities from JSON don't match `HardState` type (missing `id`, `createdAt`, `updatedAt`)
**Solution**: Either:
1. Type the initial state as `Partial<HardState>[]` and handle missing fields, or
2. Add the missing fields to the JSON data, or
3. Create a separate `InitialStateEntity` type

## Helper Utilities (`src/utils/helpers.ts`)

**Name Generation**: `generateName(type?)` - Generates penguin names with optional role titles
**ID Generation**: `generateId(prefix)` - Sequential ID generation with prefix
**Random Selection**: `pickRandom(array)`, `pickMultiple(array, count)`
**Entity Finding**: `findEntities(graph, criteria)` - Query entities by partial match
**Relationship Queries**:
- `getRelated(graph, entityId, kind?, direction?)` - Find related entities
- `getLocation(graph, entityId)` - Get entity's location
- `getFactionMembers(graph, factionId)` - Get faction members
- `hasRelationship(graph, srcId, dstId, kind?)` - Check if relationship exists

## Extending the System

### Adding New Templates
1. Create template in appropriate file (`src/templates/`)
2. Implement `GrowthTemplate` interface
3. Add to relevant array export (`npcTemplates`, `factionTemplates`, etc.)
4. Add template ID to era `templateWeights` in `src/config/eras.ts`

### Adding New Systems
1. Create system in `src/systems/simulationSystems.ts`
2. Implement `SimulationSystem` interface
3. Add to `allSystems` export
4. Add system ID to era `systemModifiers` in `src/config/eras.ts`

### Adding New Pressures
1. Create pressure definition in `src/config/pressures.ts`
2. Implement `Pressure` interface with `growth()` function
3. Add to `pressures` array export
4. Reference in template `canApply()` conditions or era `pressureModifiers`

## Design Patterns

- **Factory Pattern**: Templates are factories producing entity clusters
- **Observer Pattern**: Systems observe graph state and react
- **Strategy Pattern**: Eras modify behavior without code changes
- **Builder Pattern**: Entities built incrementally through growth + simulation

## Debugging Tips

1. Set small targets first: `targetEntitiesPerKind: 5` in `src/main.ts`
2. Enable verbose logging: Add `console.log` in templates/systems
3. Inspect single epochs: Add breakpoint after first epoch in `worldEngine.ts`
4. Track pressure evolution: Log pressure changes in simulation phase
5. Check sample history events and notable entities in output

## Missing Schema

**Note**: ARCHITECTURE.md references a `worldSchema.json` file that should define:
- Valid subtypes for each entity kind
- Valid status values for each entity kind
- Allowed relationship kinds between entity pairs (adjacency matrix)

This file does not currently exist in the repository. If strict validation is needed, create `worldSchema.json` based on the patterns used in templates and systems.
