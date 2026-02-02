# Illuminator

> Add light, lore, and visuals to a world that used to be just JSON.

Illuminator enriches Lore Weave output with LLM-generated text, images, and long-form chronicles. It is the authoring and enrichment hub for descriptions, summaries, style libraries, and scene imagery.

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-purple.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

## Features (Turn Data Into Story)

- **World Context + Guidance** - Define global lore, tone, and per-kind guidance
- **Culture Identity + Style Library** - Build visual and narrative identity per culture
- **Entity Enrichment** - Generate summaries, descriptions, aliases, and image prompts
- **Chronicle Generation** - Create long-form narratives and scene imagery
- **Static Pages** - Author wiki-ready pages for factions, regions, or histories
- **Queue + Activity** - Track enrichment tasks, progress, and API costs
- **Image Storage** - Persist and browse generated images in IndexedDB

## Table of Contents

- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Running In The Canonry](#running-in-the-canonry)
- [Workflow](#workflow)
- [Project Structure](#project-structure)
- [Development](#development)
- [License](#license)

## Requirements

- Node.js 18+
- npm 9+
- API keys for the LLM providers you plan to use (set inside the UI)

## Quick Start

```bash
npm install
cd apps/illuminator/webui
npm run dev
```

Open `http://localhost:5006/illuminator/` for the standalone dev shell.

## Running In The Canonry

Illuminator is designed to run inside the Canonry shell.

```bash
npm run canonry
```

This starts the dev proxy plus all remotes. Open `http://localhost:3000` and navigate to the Illuminator tab.

## Workflow

1. **Configure** - Add API keys and choose models.
2. **Context + Guidance** - Define world context, entity guidance, and culture identities.
3. **Styles** - Curate style fragments and trait palettes for visual prompts.
4. **Entities** - Generate summaries, descriptions, aliases, and images.
5. **Chronicle** - Build long-form narratives and scene imagery.
6. **Pages** - Author static wiki pages.
7. **Activity + Costs** - Monitor queue progress and spending.

Enrichment results are stored on entities and persisted in IndexedDB for use in Archivist and Chronicler.

## Project Structure

```
illuminator/
  webui/
    src/
      components/   # Panels, editors, and queues
      hooks/        # Enrichment queue management
      lib/          # Prompt builders and storage helpers
```

## Development

```bash
npm run dev
npm run build
```

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) - free for non-commercial use.
