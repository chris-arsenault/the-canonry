# Canonry World Schema

> The types and defaults that keep the suite speaking the same language.

@canonry/world-schema is a zero-runtime TypeScript package that defines the shared data model for Canonry. It covers schema definitions, world output shapes, style libraries, and helpers for framework defaults.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

## Features (One Schema, Many Tools)

- **Schema Types** - Entity kinds, relationships, cultures, tags, axes, and UI config
- **Framework Defaults** - Built-in kinds, tags, statuses, and merge helpers
- **Style Library** - Artistic, composition, palette, and narrative style types + defaults
- **World Output Types** - WorldOutput, narrative events, coordinates, validation
- **Prominence Helpers** - Labels, distributions, and scale utilities
- **Event Filters** - Helpers for prompt-friendly narrative summaries

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Common Exports](#common-exports)
- [Development](#development)
- [License](#license)

## Requirements

- Node.js 18+
- TypeScript 5.3+

## Installation

```bash
# From npm (when published)
npm install @canonry/world-schema

# Or link locally during development
npm install file:packages/world-schema
```

## Quick Start

```typescript
import {
  type CanonrySchemaSlice,
  mergeFrameworkSchemaSlice,
  PROMINENCE_LABELS,
} from '@canonry/world-schema';

const schema: CanonrySchemaSlice = {
  entityKinds: [
    { kind: 'npc', name: 'NPC', subtypes: [], statuses: [] },
  ],
  relationshipKinds: [
    { kind: 'member_of', srcKinds: ['npc'], dstKinds: ['faction'] },
  ],
  cultures: [{ id: 'world', name: 'World' }],
};

const fullSchema = mergeFrameworkSchemaSlice(schema);
console.log(PROMINENCE_LABELS);
```

## Common Exports

- `mergeFrameworkSchemaSlice` - Merge schema data with built-in framework defaults
- `WorldOutput` - The canonical simulation output shape for Lore Weave
- `StyleLibrary` - Narrative and visual style definitions used by Illuminator
- `PROMINENCE_LABELS` - Default prominence labels and scales

## Development

```bash
npm run build
npm run clean
```

## License

MIT
