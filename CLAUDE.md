# CLAUDE.md

## CRITICAL: Forbidden Git Commands

**NEVER run `git reset` in any form.** Not `git reset HEAD`, not `git reset --soft`, not `git reset --hard`, not `git reset` with any arguments. This command destroys work. If you need to unstage a file, use `git restore --staged <file>` instead. Violations of this rule are unacceptable.

**Note**: This project uses [bd (beads)](https://github.com/steveyegge/beads) for issue tracking. Use `bd` commands instead of markdown TODOs or plan files. When working on multi-step tasks, create a bead with `bd create` to track progress rather than writing implementation plans to markdown files. See AGENTS.md for workflow details.

**Bead Guidelines:**
- **Never create analysis-only tickets.** Analysis is not useful on its own - implementation is. If analysis is needed, do it as part of implementing the ticket, not as a separate task.
- When closing a ticket, ensure the work is actually done. If implementation remains, create a new implementation ticket before closing.
- Beads should track actionable work, not research or investigation.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **monorepo** containing framework tools for procedural world generation:

- **Lore Weave** (`apps/lore-weave/`) - Procedural world history generator that creates interconnected knowledge graphs through template-based entity generation and simulation-based relationship formation
- **Name Forge** (`apps/name-forge/`) - Domain-aware procedural name generation system
- **Canonry** (`apps/canonry/`) - Visual editor for domain configuration (JSON-based schemas, templates, systems, etc.)

The architecture provides a **domain-agnostic TypeScript framework** with **JSON-only domain configuration**. Domain-specific content is defined entirely in JSON files loaded by Canonry.

## Repository Structure

```
penguin-tales/                    # Repository root
├── apps/
│   ├── lore-weave/              # World generation framework
│   │   ├── lib/                 # Core library
│   │   │   ├── engine/          # WorldEngine, validators, interpreters
│   │   │   ├── core/            # HardState, worldTypes
│   │   │   ├── systems/         # Framework systems (catalyst, evolution, etc.)
│   │   │   ├── coordinates/     # Coordinate and region systems
│   │   │   ├── selection/       # Template and target selection
│   │   │   ├── statistics/      # Population tracking, distribution
│   │   │   ├── graph/           # Graph utilities, clustering
│   │   │   ├── naming/          # Name generation service
│   │   │   ├── observer/        # Event emitter for simulation
│   │   │   └── utils/           # Helpers, validators
│   │   └── webui/               # World explorer UI
│   │
│   ├── name-forge/              # Name generation framework
│   │   ├── lib/                 # Core generation library
│   │   └── webui/               # Name generation UI
│   │
│   ├── canonry/                 # Visual domain configuration editor
│   │   └── webui/               # Editor UI (default-project contains JSON configs)
│   │
│   ├── cosmographer/            # Coordinate/region visualization
│   ├── coherence-engine/        # Validation and coherence checking
│   └── archivist/               # History and lore browser
│
├── packages/
│   ├── world-schema/            # Shared schema definitions
│   └── shared-components/       # Shared UI components
│
├── docs/                        # Project documentation
└── infrastructure/              # CI/CD configuration
```

## Development Commands

### Lore Weave Framework

```bash
cd apps/lore-weave

# Build
npm run build

# Test
npm test
```

### Canonry (Full UI Suite)

```bash
# From repo root - starts all MFEs
npm run canonry
```

### Name Forge

```bash
cd apps/name-forge

# Run UI (API + frontend)
npm run ui

# Generate names via CLI
npm run cli

# Test
npm test
```

## Core Architecture (Lore Weave)

### The Hybrid Generation Model

The system alternates between two phases:

1. **Growth Phase**: Templates rapidly populate the graph by creating **batches of pre-connected entities**
2. **Simulation Phase**: Systems create **relationships between existing entities** and modify their states

### Framework + JSON Configuration

**Framework** (`apps/lore-weave/lib/`):
- `WorldEngine` - Core generation loop
- Type definitions (`HardState`, `Graph`, `Era`, `Pressure`, etc.)
- Declarative interpreters (templates, systems, pressures, actions)
- Services (statistics, selectors, naming)
- Generic systems (catalyst, evolution, contagion, etc.)
- Utilities (helpers, validators)

**Domain Configuration** (JSON in `apps/canonry/webui/public/default-project/`):
- `schema.json` - Entity kinds, relationship kinds, cultures
- `eras.json` - Era definitions with template weights
- `pressures.json` - Pressure configurations
- `generators.json` - Declarative templates
- `systems.json` - Declarative simulation systems
- `actions.json` - Agent action definitions
- `naming/*.json` - Culture-specific naming rules

### Framework Primitives

The framework defines a minimal set of entity kinds, relationship kinds, and status values in `apps/lore-weave/lib/core/frameworkPrimitives.ts` that **must be implemented** for the framework to function:

**Entity Kinds:**
- `era` - Time periods that structure the simulation
- `occurrence` - Events/happenings during the simulation

**Relationship Kinds:**
- `supersedes` - Era lineage (newer era supersedes older)
- `part_of` - Subsumption into meta-entity
- `active_during` - Temporal association with era

**Status Values:**
- `active` - Entity is currently active
- `historical` - Entity has been archived
- `current` - Era is currently running
- `future` - Era is queued for the future

**Important:** Domains are free to define additional entity kinds, relationship kinds, and status values beyond these framework primitives via their JSON configuration.

### Key Files

| Component | Location |
|-----------|----------|
| Engine | `apps/lore-weave/lib/engine/worldEngine.ts` |
| Types | `apps/lore-weave/lib/core/worldTypes.ts` |
| Template Interpreter | `apps/lore-weave/lib/engine/templateInterpreter.ts` |
| System Interpreter | `apps/lore-weave/lib/engine/systemInterpreter.ts` |
| Action Interpreter | `apps/lore-weave/lib/engine/actionInterpreter.ts` |
| Pressure Interpreter | `apps/lore-weave/lib/engine/pressureInterpreter.ts` |

## Type System

### Core Entity Structure (`apps/lore-weave/lib/core/worldTypes.ts`)

```typescript
HardState {
  id: string                    // Stable ID in graph
  kind: string                  // Domain-defined entity kind
  subtype: string               // e.g., 'merchant', 'colony', 'criminal'
  name: string
  description: string
  status: string                // Entity-kind specific
  prominence: Prominence        // 'forgotten' | 'marginal' | 'recognized' | 'renowned' | 'mythic'
  culture: string               // Cultural affiliation
  tags: EntityTags              // Key-value semantic tags
  links: Relationship[]         // Cached relationships
  coordinates: Point            // Position in semantic space
  createdAt: number             // Tick of creation
  updatedAt: number             // Last modification tick
}
```

### Engine Configuration

```typescript
const config: EngineConfig = {
  domain: domainSchema,         // From schema.json
  eras: eras,                   // From eras.json
  templates: templates,         // From generators.json (declarative)
  systems: systems,             // From systems.json (declarative)
  pressures: pressures,         // From pressures.json
  cultures: cultures,           // With naming config

  epochLength: 20,              // Ticks per epoch
  simulationTicksPerGrowth: 15, // Balance between growth and simulation
  distributionTargets: targets, // Per-subtype growth targets
  maxTicks: 500                 // Maximum simulation ticks
};
```

## Refactoring Rules

**CRITICAL: Always complete refactors. Never stop in the middle.**

1. **No "consolidation" modules without actual consolidation**: Do not create new shared modules/functions unless you immediately update ALL callers to use them.

2. **Delete duplicate code, don't add to it**: When fixing bugs in duplicated code, either fix all instances or consolidate to one implementation.

3. **Backwards compatibility is not an excuse**: In this codebase, prefer breaking changes over accumulating cruft.

4. **Complete the refactor in one session**: If you start consolidating code, finish it.

## API Discipline - CRITICAL

**This section exists because Claude repeatedly creates backwards-compatibility shims that cause architectural divergence. These rules are non-negotiable.**

### NEVER Do These Things

**1. NEVER add methods that return internal objects:**
```typescript
// FORBIDDEN - Creates escape hatch
getGraph(): Graph { return this.graph; }
getMapper(): RegionMapper { return this.mapper; }
getInternal*(): any { ... }
```
If code needs functionality, add a specific method to the wrapper class instead.

**2. NEVER add fallback defaults for required config:**
```typescript
// FORBIDDEN - Hides misconfiguration
const culture = config.culture ?? 'default';
const options = settings || {};
const value = context?.value ?? fallbackValue;
```
If config is required, make it required. If it's missing, throw an error.

**3. NEVER leave deprecated code "for compatibility":**
```typescript
// FORBIDDEN - Creates parallel paths
/** @deprecated Use newMethod instead */
oldMethod() { return this.newMethod(); }
```
Delete deprecated code immediately. Fix all callers in the same PR.

**4. NEVER create multiple ways to do the same thing:**
```typescript
// FORBIDDEN - Creates divergent paths
placeEntity()           // Method 1
addEntityInRegion()     // Method 2
deriveCoordinates()     // Method 3
placeWithCulture()      // Method 4
```
Have ONE canonical way. Delete the others.

### ALWAYS Do These Things

**1. ALWAYS throw on missing required config:**
```typescript
// CORRECT
if (!config.culture) {
  throw new Error('culture is required in PlacementConfig');
}
```

**2. ALWAYS delete old APIs when adding new ones:**
```typescript
// CORRECT - In the SAME PR:
// 1. Add new API
// 2. Update ALL callers to use new API
// 3. DELETE old API
// No deprecation period. No compatibility shims.
```

**3. ALWAYS make the type system enforce correct usage:**
```typescript
// CORRECT - Required, not optional
interface PlacementConfig {
  cultureId: string;      // NOT string | undefined
  coordinates: Point;     // NOT Point | undefined
}
```

**4. ALWAYS break code when framework changes:**
Code should fail to compile or fail at startup when framework APIs change. This is correct behavior - it forces immediate fixes rather than silent divergence.

### Validation

Run `./scripts/check-escape-hatches.sh` before committing. It checks for:
- Methods returning internal objects
- Fallback patterns for config
- @deprecated markers (code should be deleted)
- Legacy API usage

## UI Style: Dense Information Display

The north star for communicating dense metadata in list/card UIs is the **inline symbol + compact subtitle** pattern used in ChroniclePanel's card list. Prefer this over badge/pill components.

**Principles:**
- **Inline symbols** next to titles for boolean/categorical state (e.g. `◆` single focus, `◇◇` ensemble, `✦` perspective used, `⇄` backported). Colored, small, with hover `title` for discoverability.
- **Subtitle row** for the most useful textual label (e.g. narrative style name) on the left, **numeric counts** on the right using a symbol + number pattern (`☰ 5  ▣ 3`).
- **No badge boxes** unless the information is truly categorical with distinct groups. Symbols and compact text communicate the same info with far less visual weight.
- **Hover titles on everything** - symbols are terse by design, tooltips provide the full explanation.

**Reference implementation:** `ChronicleItemCard` in `apps/illuminator/webui/src/components/ChroniclePanel.jsx`.

## Debugging Tips

1. Set small distribution targets first (lower subtype targets in `distributionTargets`)
2. Enable verbose logging: Add `console.log` in templates/systems
3. Check sample history events and notable entities in output
4. Use `scaleFactor` parameter to control world size
