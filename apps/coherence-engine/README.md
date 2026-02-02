# Coherence Engine

> The tuning console that keeps your simulation from devolving into a krill fight.

Coherence Engine is the configuration cockpit for Lore Weave. It lets you define eras, pressures, generators, systems, and actions, then validate and visualize how those pieces interact before you run a simulation.

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-purple.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

## Features (Turn Knobs, Not Prayers)

- **Eras + Phase Control** - Define historical phases with template and system weights
- **Pressures + Feedback** - Model forces like conflict, scarcity, or zeal with feedback loops
- **Generators + Systems** - Configure growth templates and simulation systems from the UI
- **Actions** - Define catalyst actions that entities can take during simulation
- **Validation** - Catch missing references, invalid tags, and weight gaps before runtime
- **Causal Loop Diagram** - Visualize feedback relationships across the configuration
- **Weight Matrix** - Spreadsheet-style editor for era weights across generators and systems

## Table of Contents

- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Running In The Canonry](#running-in-the-canonry)
- [Configuration Model](#configuration-model)
- [Project Structure](#project-structure)
- [Development](#development)
- [License](#license)

## Requirements

- Node.js 18+
- npm 9+

## Quick Start

```bash
npm install
cd apps/coherence-engine/webui
npm run dev
```

Open `http://localhost:5003/coherence-engine/` for the standalone dev shell.

## Running In The Canonry

Coherence Engine is designed to run inside the Canonry shell.

```bash
npm run canonry
```

This starts the dev proxy plus all remotes. Open `http://localhost:3000` and navigate to the Coherence Engine tab.

## Configuration Model

Coherence Engine edits the simulation configuration used by Lore Weave.

```json
{
  "pressures": [
    {
      "id": "pressure_conflict",
      "name": "Conflict",
      "initialValue": 15,
      "homeostasis": 5,
      "growth": {
        "positiveFeedback": [{ "type": "entity_count", "kind": "faction", "coefficient": 0.4 }],
        "negativeFeedback": [{ "type": "relationship_count", "kind": "peace_treaty", "coefficient": -0.6 }]
      }
    }
  ],
  "eras": [
    {
      "id": "era_founding",
      "name": "Founding Era",
      "templateWeights": { "settlement_seed": 1.0 },
      "systemModifiers": { "faction_growth": 0.6 }
    }
  ]
}
```

## Project Structure

```
coherence-engine/
  webui/
    src/
      components/   # Editors, validation, diagrams
      styles/       # Shared UI styles
```

## Development

```bash
npm run dev
npm run build
```

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) - free for non-commercial use.
