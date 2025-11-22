# Procedural History Generation Engine - Architecture

## Executive Summary

This system generates rich, populated knowledge graphs representing world history through a hybrid approach combining **template-based entity generation** with **simulation-based relationship formation**. Starting from a minimal seed (~14 entities), it produces a dense, interconnected world state (~150-200 entities, ~300-500 relationships) that feels "lived-in" rather than randomly generated.

## Core Design Philosophy

### The Problem
- **Goal**: Generate a well-populated, mostly consistent world state for game initialization
- **Challenge**: Pure LLM generation produces disconnected entities; pure simulation is too complex to implement quickly
- **Solution**: Hybrid approach - templates for rapid population, simulation for coherence

### Key Insight
Instead of simulating every birth and death over centuries (like Dwarf Fortress), we:
1. Generate entity clusters through templates (families, factions, etc.)
2. Run lightweight simulation to form relationships and create dynamics
3. Alternate between growth and simulation phases
4. Use era progression to create narrative arc

## System Architecture

### Type System
```typescript
// Core entity structure (non-negotiable)
HardState {
  id: string
  kind: 'npc' | 'location' | 'faction' | 'rules' | 'abilities'
  subtype: string  // e.g., 'merchant', 'colony', 'criminal'
  name: string
  description: string
  status: string
  prominence: 'forgotten' | 'marginal' | 'recognized' | 'renowned' | 'mythic'
  tags: string[]
  links: Relationship[]
  createdAt: number
  updatedAt: number
}

// Relationship structure
Relationship {
  kind: string  // Must be valid per worldSchema matrix
  src: string   // Entity ID
  dst: string   // Entity ID
}
```

### Core Components

#### 1. Growth Templates
Templates are **entity factories** that create batches of related entities in one operation.

**Interface:**
```typescript
GrowthTemplate {
  id: string
  canApply: (graph) => boolean        // Can this template run?
  findTargets: (graph) => HardState[] // What entities to expand from?
  expand: (graph, target) => {
    entities: Partial<HardState>[]    // New entities to create
    relationships: Relationship[]      // How they connect
    description: string
  }
}
```

**Example Templates:**
- `family_expansion`: Creates 1-3 child NPCs from parent NPCs
- `faction_splinter`: Splits large faction into rival groups
- `colony_founding`: Establishes new colony on iceberg
- `cult_formation`: Creates cult around anomaly/magic

**Key Pattern:** Templates create **pre-connected clusters** of entities, not isolated nodes.

#### 2. Simulation Systems
Systems are **relationship generators** and **state modifiers** that run each tick.

**Interface:**
```typescript
SimulationSystem {
  id: string
  apply: (graph, modifier) => {
    relationshipsAdded: Relationship[]
    entitiesModified: {id: string, changes: Partial<HardState>}[]
    pressureChanges: Record<string, number>
    description: string
  }
}
```

**Example Systems:**
- `relationship_formation`: NPCs in same location form bonds/rivalries
- `conflict_contagion`: Conflicts spread through alliances
- `resource_flow`: Colony status changes based on resources
- `cultural_drift`: Isolated colonies diverge culturally
- `prominence_evolution`: Well-connected entities gain fame

**Key Pattern:** Systems operate on **graph patterns**, not specific entities.

#### 3. Era Progression
Eras are **temporal contexts** that modify template weights and system behaviors.

**Structure:**
```typescript
Era {
  id: string
  name: string
  templateWeights: Record<string, number>   // 0=disabled, 2=doubled
  systemModifiers: Record<string, number>   // Multipliers
  specialRules?: (graph) => void
}
```

**Penguin Colony Eras:**
1. **Expansion** - Colony founding, population growth (weights favor location/NPC templates)
2. **Conflict** - Resource wars, faction splintering (weights favor conflict templates)
3. **Innovation** - Tech/magic development (weights favor ability templates)
4. **Invasion** - External threat unites colonies (special rules suspend internal conflicts)
5. **Reconstruction** - Peace and consolidation (weights favor rule/treaty templates)

#### 4. Pressure System
Pressures are **background forces** that accumulate and enable certain templates.

**Structure:**
```typescript
Pressure {
  id: string
  value: number  // 0-100
  growth: (graph) => number  // Calculate delta from world state
  decay: number              // Natural decay per tick
}
```

**Example Pressures:**
- `resource_scarcity`: Ratio of NPCs to resource locations
- `conflict`: Count of hostile relationships
- `magical_instability`: Anomalies and magic use
- `cultural_tension`: Isolated colonies and splinter factions

## Execution Flow

### Main Loop
```
for each epoch (0 to 5):
  1. Select era based on epoch
  2. GROWTH PHASE:
     - Select templates weighted by era
     - Apply 5-15 templates to create entity batches
     - Each template creates 2-5 connected entities
  3. SIMULATION PHASE:
     - Run 10 simulation ticks
     - Each tick applies all systems with era modifiers
     - Systems create relationships and modify states
  4. Update pressures based on new world state
  5. Prune/consolidate (mark old entities as 'forgotten')
```

### Growth Phase Algorithm
```
1. Shuffle all templates for variety
2. For each template:
   - Check era weight (skip if 0)
   - Check canApply() condition
   - Find valid targets
   - Pick random target
   - Execute expand() to get new entities
   - Assign IDs to new entities
   - Resolve relationship placeholders
   - Add to graph
```

### Simulation Phase Algorithm
```
For each system:
  1. Apply system with era modifier
  2. Add generated relationships to graph
  3. Apply entity modifications
  4. Update pressure values
```

## Key Design Decisions

### Why Templates + Simulation?
- **Templates alone** = Well-populated but disconnected
- **Simulation alone** = Coherent but sparse
- **Hybrid** = Dense AND interconnected

### Why Eras?
- Provides narrative structure without scripting events
- Ensures all entity types get created (each era favors different types)
- Creates recognizable historical periods

### Why Not Agent-Based?
- Agents require complex decision logic per entity type
- Our goal is population, not behavioral realism
- Systems achieve emergence through graph patterns

### Schema Coverage Strategy
Templates are designed to cover all combinations in worldSchema:
- Each template can generate multiple subtypes
- Templates are parameterized, not hardcoded
- Systems ensure all relationship types eventually appear

## File Structure
```
src/
├── engine/
│   └── worldEngine.ts         # Main orchestrator
├── templates/
│   ├── npc/
│   │   └── npcTemplates.ts   # NPC creation templates
│   ├── faction/
│   │   └── factionTemplates.ts # Faction templates
│   └── additionalTemplates.ts # Rules, abilities, locations
├── systems/
│   └── simulationSystems.ts  # All simulation systems
├── config/
│   ├── eras.ts               # Era definitions
│   └── pressures.ts          # Pressure definitions
├── types/
│   ├── engine.ts             # Engine interfaces
│   └── worldTypes.ts         # Core types
├── utils/
│   └── helpers.ts            # Graph manipulation utilities
└── main.ts                   # Entry point
```

## Critical Implementation Details

### ID Resolution in Templates
Templates create entities with placeholder relationships:
```typescript
relationships: [
  { kind: 'member_of', src: 'will-be-assigned-0', dst: factionId }
]
```
The engine resolves these after assigning real IDs.

### Relationship Validation
All relationships must exist in worldSchema.relationships matrix:
```typescript
relationships[srcKind][dstKind].includes(relationshipKind)
```

### Prominence Evolution
Entities gain/lose prominence based on:
- Number of relationships (connections = importance)
- Role bonuses (heroes, mayors naturally prominent)
- Age without connections (fade to 'forgotten')

### Template Selection
```typescript
weight = baseWeight * eraModifier * (random() > threshold ? 1 : 0)
```
This creates controlled randomness within era constraints.

## Extending for Glass Frontier

### Required Changes
1. **Update worldSchema.json** with your 11 entity kinds, 50+ relationships
2. **Create domain templates** for each entity kind
3. **Define setting-appropriate eras** (colonization, corporate wars, etc.)
4. **Adjust pressures** for sci-fi context (tech singularity, xenophobia, etc.)
5. **Modify name generators** in helpers.ts

### Scaling Considerations
Current system handles ~200 entities well. For larger worlds:
- Increase `targetEntitiesPerKind`
- Add spatial partitioning (only simulate local regions)
- Implement lazy relationship calculation
- Consider graph database for very large worlds (>10k entities)

## Running the System

### Quick Start
```bash
npm install
npm run dev  # Runs with ts-node
```

### Configuration (main.ts)
```typescript
const config = {
  epochLength: 20,              // Ticks per epoch
  simulationTicksPerGrowth: 10, // Simulation/growth balance  
  targetEntitiesPerKind: 30,    // Final size (~150 total)
  maxTicks: 500                 // Safety limit
}
```

### Output Format
```json
{
  "metadata": {
    "tick": 243,
    "epoch": 5,
    "entityCount": 156,
    "relationshipCount": 347
  },
  "hardState": [...],      // All entities
  "relationships": [...],   // All connections
  "pressures": {...},       // Final pressure values
  "history": [...]          // Event log
}
```

## Performance Characteristics
- **Runtime**: ~2-5 seconds for 150 entities
- **Memory**: ~50MB for full graph
- **Complexity**: O(n²) for relationship systems, O(n) for templates

## Design Patterns Used

### Factory Pattern
Templates are factories that produce entity clusters.

### Observer Pattern
Systems observe graph state and react with modifications.

### Strategy Pattern
Eras modify behavior without changing code.

### Builder Pattern
Entities built incrementally through growth + simulation.

## Future Enhancements

### Immediate
- Add validation for complete schema coverage
- Implement template prerequisites (tech tree)
- Add relationship decay over time

### Medium-term
- Spatial awareness (distance-based relationships)
- Event chains (template A enables template B)
- Save/load partial generation state

### Long-term
- ML-based template selection
- Natural language history generation
- Interactive visualization during generation

## Debugging Tips

1. **Set small targets first**: `targetEntitiesPerKind: 5`
2. **Enable verbose logging**: Add console.logs in templates
3. **Inspect single epochs**: Break after one epoch
4. **Validate relationships**: Check against worldSchema
5. **Track pressure evolution**: Log pressure changes

## Key Invariants

1. Every entity has a unique ID
2. Every relationship's src/dst must exist in entities
3. Relationship kinds must be valid per worldSchema
4. Entity links array matches relationships
5. Prominence is bounded: forgotten ≤ p ≤ mythic
6. Tags array has maximum 5 elements

## Conceptual Model

Think of the system as:
- **Templates** = Dungeon room generators
- **Systems** = Physics engines
- **Eras** = Weather/seasons
- **Pressures** = Temperature/humidity
- **Graph** = The game world

The innovation is recognizing that for a "lived-in" feel, you need:
1. **Density** (lots of stuff) - handled by templates
2. **Interconnection** (stuff relates) - handled by systems
3. **History** (stuff happened over time) - handled by eras
4. **Causality** (stuff happened for reasons) - handled by pressures

This achieves 80% of the depth of full simulation with 20% of the complexity.