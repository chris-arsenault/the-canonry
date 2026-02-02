# Lore Weave

> Run the procedural history and watch your world grow.

Lore Weave is the simulation engine behind the Canonry suite. It grows a world from a minimal seed into a dense knowledge graph by alternating growth templates and simulation systems, then emits world state, narrative history, and metrics for downstream tools.

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-purple.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

## Features (Make History, Not Just Data)

- **Template + Simulation Engine** - Growth templates create entities, systems evolve relationships
- **Eras + Pressures** - Historical phases and pressure signals shape the world over time
- **Schema-Aware Output** - Works with Canonry schema definitions for kinds and relationships
- **Narrative History** - Emits event timelines, pressures, and metric deltas
- **Web UI Dashboard** - Run simulations, inspect stats, and export results inside Canonry
- **Library + API Ready** - Use in Node/TypeScript without the UI

## Table of Contents

- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Web UI](#web-ui)
- [Simulation Output](#simulation-output)
- [Project Structure](#project-structure)
- [Development](#development)
- [License](#license)

## Requirements

- Node.js 18+
- npm 9+

## Quick Start

```typescript
import { WorldEngine, normalizeInitialState } from '@lore-weave/core';

const engine = new WorldEngine({
  eras: penguinEras,
  templates: allTemplates,
  systems: allSystems,
  domain: penguinSchema,
  initialState: normalizeInitialState(seedData),
  distributionTargets: penguinDistributionTargets,
  maxTicks: 500,
});

const result = await engine.run();
```

## Web UI

Lore Weave runs as a Canonry micro-frontend.

```bash
npm run canonry
```

This starts the dev proxy plus all remotes. Open `http://localhost:3000` and navigate to the Lore Weave tab.

## Simulation Output

A run produces world output compatible with Archivist and Chronicler.

```json
{
  "metadata": {
    "tick": 120,
    "entityCount": 160,
    "relationshipCount": 410,
    "currentEra": "The Great Thaw"
  },
  "schema": { "entityKinds": [], "relationshipKinds": [], "cultures": [] },
  "hardState": [],
  "relationships": [],
  "narrativeHistory": [],
  "pressures": []
}
```

## Project Structure

```
lore-weave/
  lib/             # Engine, schemas, and core types
  scripts/         # Validation and tooling
  webui/           # Canonry remote UI
```

## Development

```bash
npm run build
npm run ui
npm run typecheck
```

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) - free for non-commercial use.
