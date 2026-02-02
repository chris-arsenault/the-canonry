# Viewer

> A portable museum for Canonry bundles.

Viewer is a standalone, static-friendly app for exploring exported Canonry bundles. It loads a viewer bundle, provides searchable navigation, and embeds Archivist and Chronicler to browse graphs and narratives without running the full suite.

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-purple.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

## Features (Ship The World)

- **Bundle Loader** - Reads `canonry-viewer-bundle` JSON with world, lore, and media
- **Archivist + Chronicler** - Embedded graph explorer and wiki views
- **Global Search** - Search entities, chronicles, and static pages from the header
- **Chunked History** - Supports narrativeHistory chunk manifests for large worlds
- **Image Optimization** - Build scripts convert and re-point images for web delivery

## Table of Contents

- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Bundle Format](#bundle-format)
- [Build Pipeline](#build-pipeline)
- [Project Structure](#project-structure)
- [Development](#development)
- [License](#license)

## Requirements

- Node.js 18+
- npm 9+

## Quick Start

```bash
npm install
cd apps/viewer/webui
npm run dev
```

Open `http://localhost:5008`.

For local dev, run Archivist and Chronicler remotes too:

```bash
cd apps/archivist/webui && npm run dev
cd apps/chronicler/webui && npm run dev
```

## Bundle Format

Viewer expects a bundle at `apps/viewer/webui/public/bundles/default/bundle.json`.

```json
{
  "format": "canonry-viewer-bundle",
  "version": "1.0",
  "projectId": "project_001",
  "worldData": { "schema": {}, "hardState": [], "relationships": [] },
  "loreData": { "records": [] },
  "chronicles": [],
  "staticPages": [],
  "imageData": { "results": [] },
  "images": {}
}
```

If a `bundle.manifest.json` is present, Viewer will load chunked `narrativeHistory` data.

## Build Pipeline

`npm run build` executes:
- Vite build
- `npm run optimize-images` to convert images in the bundle
- `npm run chunk-bundle` to split large narrative history into chunks

Make sure the bundle exists in `public/bundles/default` before building so it is copied to `dist`.

## Project Structure

```
viewer/
  webui/
    src/            # Viewer shell and tab layout
    public/         # Default bundle location
    scripts/        # Bundle chunking and image optimization
```

## Development

```bash
npm run dev
npm run build
npm run lint
```

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) - free for non-commercial use.
