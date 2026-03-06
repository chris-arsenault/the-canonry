# Project Overview: The Canonry (the-canonry)

## Purpose
A **monorepo** containing framework tools for procedural world generation. The system provides a domain-agnostic TypeScript framework with JSON-only domain configuration.

## Core Applications
- **Lore Weave** (`apps/lore-weave/`) - Procedural world history generator using knowledge graphs
- **Name Forge** (`apps/name-forge/`) - Domain-aware procedural name generation
- **Canonry** (`apps/canonry/`) - Visual editor for domain configuration (JSON schemas)
- **Illuminator** (`apps/illuminator/`) - Chronicle writing and enrichment tool
- **Archivist** (`apps/archivist/`) - History and lore browser with 3D visualizations
- **Chronicler** (`apps/chronicler/`) - Wiki-style chronicle reader
- **Cosmographer** (`apps/cosmographer/`) - Coordinate/region visualization
- **Coherence Engine** (`apps/coherence-engine/`) - Validation and coherence checking
- **Viewer** (`apps/viewer/`) - Read-only world viewer

## Tech Stack
- **Language**: TypeScript + JavaScript (mixed JSX/TSX)
- **Runtime**: Node.js >= 22
- **Package Manager**: pnpm 10+ (enforced via devEngines)
- **Build System**: Turborepo
- **UI Framework**: React (Vite-based dev servers for each app)
- **Module System**: ESM (`"type": "module"`)
- **Linting**: ESLint 9 (flat config) + Stylelint + many custom drift-guard rules
- **Formatting**: Prettier (semi, double quotes, 2-space indent, 100 print width, es5 trailing commas)

## Shared Packages
- `packages/world-schema/` - Shared schema definitions
- `packages/shared-components/` - Shared UI components (being migrated JSX → TSX)
- `packages/world-store/` - World state store
- `packages/narrative-store/` - Narrative data store
- `packages/image-store/` - Image data store
- `packages/canonry-dsl/` and `packages/canonry-dsl-v2/` - Domain-specific language packages

## Workspace Structure
pnpm workspace with packages in `apps/*`, `apps/*/webui`, and `packages/*`.
