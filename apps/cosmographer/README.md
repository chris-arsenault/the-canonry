# Cosmographer

> Semantic placement, world topology, and axes that actually mean something.

Cosmographer defines how your world exists in semantic space. It lets you design axes, semantic planes, culture biases, seed entities, and relationships in the UI, and it ships with a CLI for generating plane hierarchies from YAML or JSON specs.

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-purple.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

## Features (Map The Meaning)

- **Axis Registry** - Define reusable axes with low/high tags and descriptions
- **Semantic Planes** - Build per-kind 2D planes and draw regions for subtypes or statuses
- **Culture Biases** - Set cultural tendencies on each axis so placement feels intentional
- **Seed Entities + Relationships** - Lay down the initial world graph with real coordinates
- **Name Forge Integration** - Auto-generate entity names from culture naming rules
- **CLI Manifold Generation** - Produce plane hierarchies from YAML or JSON specs

## Table of Contents

- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Running In The Canonry](#running-in-the-canonry)
- [CLI Usage](#cli-usage)
- [Project Structure](#project-structure)
- [Development](#development)
- [License](#license)

## Requirements

- Node.js 18+
- npm 9+

## Quick Start

```bash
npm install
cd apps/cosmographer/webui
npm run dev
```

Open `http://localhost:5002/cosmographer/` for the standalone dev shell.

## Running In The Canonry

Cosmographer is remote-only in production and is designed to run inside the Canonry shell.

```bash
npm run canonry
```

This starts the dev proxy plus all remotes. Open `http://localhost:3000` and navigate to the Cosmographer tab.

## CLI Usage

The CLI generates semantic plane hierarchies from YAML or JSON input.

```bash
npm run cli -- generate path/to/spec.yaml -o manifold.json
npm run cli -- analyze "sacred" --domain metaphysical
npm run cli -- categories --domain conceptual
npm run cli -- vocabulary
```

Example input:

```yaml
domainId: world
spaceType: semantic
planes:
  - id: morality
    axes:
      x: { id: lawful_chaotic, lowTag: Lawful, highTag: Chaotic }
      y: { id: good_evil, lowTag: Good, highTag: Evil }
```

## Project Structure

```
cosmographer/
  cli/             # Command-line interface
  lib/             # Manifold generation and taxonomy logic
  webui/           # Canonry remote UI
```

## Development

```bash
npm run build
npm run typecheck
npm run test
```

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) - free for non-commercial use.
