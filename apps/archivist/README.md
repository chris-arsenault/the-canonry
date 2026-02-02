# Archivist

> Your world, archived in 2D, 3D, and time.

Archivist is the visual explorer for Lore Weave output. It turns a simulation run into navigable graphs, coordinate maps, and timelines, then lets you drill into entity details, lore, and relationships.

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-purple.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)

## Features (Curate Everything)

- **2D + 3D Graph Views** - Explore force layouts in Cytoscape (2D) and ForceGraph (3D)
- **Semantic Plane Maps** - Visualize entities on their axis-driven coordinate planes
- **Timeline Mode** - Anchor entities by era or tick to watch history unfold
- **Filter + Search** - Filter by kind, relationships, tags, prominence, time range, and strength
- **Lore + Media Panels** - Show Illuminator summaries, descriptions, and images alongside metadata
- **Micro-Frontend Ready** - Ships as a Module Federation remote for Canonry and Viewer

## Table of Contents

- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Running In The Canonry](#running-in-the-canonry)
- [Data Expectations](#data-expectations)
- [Project Structure](#project-structure)
- [Development](#development)
- [License](#license)

## Requirements

- Node.js 18+
- npm 9+

## Quick Start

```bash
npm install
cd apps/archivist/webui
npm run dev
```

Open `http://localhost:5005/archivist/` for the dev shell. For real data, run Canonry and load a simulation output.

## Running In The Canonry

Archivist is designed to run inside the Canonry shell.

```bash
npm run canonry
```

This starts the dev proxy plus all remotes. Open `http://localhost:3000` and navigate to the Archivist tab.

## Data Expectations

Archivist consumes Lore Weave output plus optional Illuminator enrichment.

```json
{
  "metadata": {
    "tick": 135,
    "epoch": 9,
    "entityCount": 187,
    "relationshipCount": 453,
    "currentEra": "The Golden Age"
  },
  "schema": {
    "entityKinds": [],
    "relationshipKinds": [],
    "cultures": []
  },
  "hardState": [
    {
      "id": "npc_001",
      "kind": "npc",
      "name": "Aldric the Bold",
      "prominence": "renowned",
      "tags": ["warrior"],
      "createdAt": 23,
      "updatedAt": 89
    }
  ],
  "relationships": [
    { "kind": "member_of", "src": "npc_001", "dst": "faction_005" }
  ],
  "narrativeHistory": []
}
```

Optional attachments:
- `loreData` for LLM-enriched summaries and descriptions
- `imageData` for entity image metadata and references

## Project Structure

```
archivist/
  webui/
    src/
      components/   # Graph views, filters, panels
      types/        # World and lore types
      utils/        # Data transforms and selectors
    vite.config.ts
```

## Development

```bash
npm run dev
npm run build
npm run lint
```

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) - free for non-commercial use.
