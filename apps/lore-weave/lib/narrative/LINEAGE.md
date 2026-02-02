# Lineage System Design

## Overview

The lineage system tracks **why** changes happen during simulation, not just **what** changed.
This enables intelligent event generation that avoids duplicate/redundant narrative events.

## The Problem It Solves

Before lineage, event generation worked by diffing world state at tick start vs tick end:
- "New relationship detected" → emit relationship_formed
- "New tag detected" → emit tag_gained
- "Entity created" → emit creation_batch

This caused duplicate events because multiple detectors saw the same changes:
- Template creates hero with 5 relationships → creation_batch event
- Relationship detector sees 5 new relationships → 5 relationship_formed events
- Tag detector sees new tags → tag_gained events
- **Result: 8 events for one logical action (hero emergence)**

With lineage, we know that all those changes came from the same source (the template),
so we emit ONE event that captures the full story.

## Core Concept: ExecutionContext

Every mutation happens within an ExecutionContext:

```typescript
interface ExecutionContext {
  tick: number;
  source: 'template' | 'system' | 'action' | 'pressure' | 'seed' | 'framework';
  sourceId: string;  // e.g., "hero_emergence", "conflict_escalation"
}
```

## Hybrid Storage Strategy

The system uses two complementary approaches:

### 1. Persistent Lineage (Entities & Relationships)

Entities and relationships store their lineage in the world state via `createdBy`:

```typescript
interface WorldEntity {
  // ... existing fields ...
  createdBy?: ExecutionContext;
}

interface WorldRelationship {
  // ... existing fields ...
  createdBy?: ExecutionContext;
}
```

**Why persistent?**
- Useful for debugging ("why does this relationship exist?")
- Survives serialization/deserialization
- Enables queries like "show all entities created by template X"

### 2. Transient Lineage (All Mutations)

ALL mutations are tracked via MutationTracker during tick execution:

```typescript
type MutationType =
  | 'entity_created'
  | 'relationship_created'
  | 'relationship_archived'
  | 'tag_added'
  | 'tag_removed'
  | 'field_changed';

interface TrackedMutation {
  type: MutationType;
  tick: number;
  context: ExecutionContext;
  data: EntityCreatedData | RelationshipCreatedData | TagChangeData | FieldChangeData | ...;
}
```

**Why track everything transiently?**
- Enables grouping ALL changes by context for unified event generation
- One source of truth for "what happened this tick"
- Cleared at tick end after events are generated

## Unified Event Generation

StateChangeTracker.flush() generates ONE event per execution context:

```typescript
// StateChangeTracker.flush()

// 1. Get all mutations grouped by context
const contextGroups = mutationTracker.getMutationsByContext();
// Returns Map<contextKey, ContextMutationGroup>
// Each group has: entitiesCreated, relationshipsCreated, tagsAdded, fieldsChanged, etc.

// 2. Generate ONE event per context
for (const [key, group] of contextGroups) {
  const event = buildEventForContext(group);
  // Template context → creation_batch event
  // System context → system_action event
  // Action context → action_executed event
}
```

### Event Type Selection

| Context Source | Event Kind | Description |
|---------------|------------|-------------|
| `template` | `creation_batch` | Entities created with initial relationships/tags |
| `system` | `state_change` | System modified entities/relationships |
| `action` | `state_change` | Agent action executed |
| `framework` | `state_change` | Framework/initialization operation |

### Rich Event Content

Each context-based event contains:
- All entities created in that context
- All relationships created/archived
- All tag changes
- All field changes
- Computed significance based on impact
- Descriptive headline summarizing what happened

## Context Stack (Nested Execution)

Execution contexts naturally form a hierarchy. A system may run templates, a template may trigger actions:

```
system:framework-growth
  └─ template:hero_emergence    ← entities created here get this context
       └─ action:declare_war    ← relationships created here get this context
```

MutationTracker uses a **stack** to track nested contexts. The innermost (most specific) context
is what gets stamped on created entities/relationships:

```typescript
// WorldEngine enters system context
mutationTracker.enterContext('system', 'framework-growth');
// Stack: [system:framework-growth]

// GrowthSystem enters template context
mutationTracker.enterContext('template', 'hero_emergence');
// Stack: [system:framework-growth, template:hero_emergence]

// Entity created → createdBy: { source: 'template', sourceId: 'hero_emergence' }

// Template exits
mutationTracker.exitContext();
// Stack: [system:framework-growth]

// System exits
mutationTracker.exitContext();
// Stack: []
```

This gives us specific attribution ("created by template:hero_emergence") rather than
vague attribution ("created by system:framework-growth").

## Design Principles

1. **Context Stack for Nested Execution**
   - MutationTracker maintains a stack of contexts
   - Innermost context (top of stack) is used for stamping
   - Supports arbitrary nesting: system → template → action

2. **Fail-Safe Default**
   - If context stack is empty, mutations still work (backward compatible)
   - Events will be generated with source='framework', sourceId='unknown'
   - Prefer noisy events over lost data

3. **Lineage is Metadata, Not Logic**
   - Lineage doesn't change WHAT happens, only HOW it's reported
   - Simulation logic remains unchanged
   - Only event generation uses lineage

4. **Unified Mental Model**
   - External code sees one lineage system
   - Internal hybrid implementation is an optimization detail
   - API surface treats all mutations uniformly

## File Locations

- `packages/world-schema/src/world.ts` - ExecutionContext type, createdBy on entities/relationships
- `apps/lore-weave/lib/narrative/mutationTracker.ts` - Transient tag/field tracking + context stack
- `apps/lore-weave/lib/narrative/stateChangeTracker.ts` - Unified event generation
- `apps/lore-weave/lib/engine/worldEngine.ts` - System-level context management
- `apps/lore-weave/lib/systems/growthSystem.ts` - Template-level context management

## Future Considerations

- **Context inheritance**: Child entities could inherit parent's creation context
- **Lineage queries**: "Show causal chain for this entity's current state"
