# The Canonry

> The command deck for your entire world-building pipeline.

The Canonry is the unified shell for the Penguin Tales toolset. It manages projects, stores data locally, and orchestrates schema definition, naming, semantic planes, simulation tuning, world generation, enrichment, and exploration.

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-purple.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

## Features (Suite, Not Spreadsheet)

- **Project Management** - Create, duplicate, import, export, and version projects
- **Enumerist Schema Editor** - Define entity kinds, relationships, cultures, tags, and axes
- **Integrated Tools** - Name Forge, Cosmographer, Coherence Engine, Lore Weave, Illuminator, Archivist, Chronicler
- **Run Slots** - Save and compare simulation outputs without overwriting your main project
- **Local Persistence** - IndexedDB storage for projects, world data, images, and chronicles
- **Cross-Tool Navigation** - Jump from graph nodes to wiki pages and back

## Table of Contents

- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Running Remotes](#running-remotes)
- [Project Storage](#project-storage)
- [Project Structure](#project-structure)
- [Development](#development)
- [License](#license)

## Requirements

- Node.js 18+
- npm 9+

## Quick Start

```bash
npm install
npm run canonry
```

This starts the dev proxy plus all remotes. Open `http://localhost:3000` to access the shell.

If you only want the shell UI without remotes:

```bash
cd apps/canonry/webui
npm run dev
```

Remote tools load through the dev proxy, so the full suite expects `http://localhost:3000`.

## Running Remotes

Canonry loads its micro-frontends via Module Federation. If you want a manual setup, run the dev proxy and the remotes you need:

```bash
node scripts/dev-proxy.js
cd apps/name-forge/webui && npm run dev
cd apps/cosmographer/webui && npm run dev
cd apps/coherence-engine/webui && npm run dev
cd apps/lore-weave/webui && npm run dev
cd apps/illuminator/webui && npm run dev
cd apps/archivist/webui && npm run dev
cd apps/chronicler/webui && npm run dev
```

Open `http://localhost:3000` once the proxy is running.

Default dev ports:
- 5000 - Canonry shell
- 5001 - Name Forge
- 5002 - Cosmographer
- 5003 - Coherence Engine
- 5004 - Lore Weave
- 5005 - Archivist
- 5006 - Illuminator
- 5007 - Chronicler

## Project Storage

Projects, run slots, lore, and images are persisted in IndexedDB. Imports and exports use `.canonry.zip` bundles so your configuration and outputs stay in sync.

## Project Structure

```
canonry/
  webui/
    src/
      components/   # Shell UI, schema editor, navigation
      remotes/      # Module Federation hosts
      storage/      # IndexedDB persistence
```

## Development

```bash
npm run dev
npm run build
npm run lint
```

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) - free for non-commercial use.
