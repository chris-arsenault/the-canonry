# Canonry DSL v2

> The next-gen Canonry DSL compiler that powers the conduit pipeline.

@canonry/dsl-v2 is the updated parser, compiler, and serializer for Canonry .canon files. It mirrors the v1 API while evolving the grammar and compile rules used by the conduit scripts.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

## Features (Conduit Ready)

- **Drop-In API** - Same surface exports as @canonry/dsl
- **Peggy Grammar** - Parser backed by an updated .canon grammar
- **Config Compiler** - Emit Canonry config JSON used by the suite
- **Serializer** - Convert JSON configs back into .canon files
- **Static Pages** - Compile and serialize wiki page blocks

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Conduit Usage](#conduit-usage)
- [Development](#development)
- [License](#license)

## Requirements

- Node.js 18+
- TypeScript 5.3+

## Installation

```bash
# From npm (when published)
npm install @canonry/dsl-v2

# Or link locally during development
npm install file:packages/canonry-dsl-v2
```

## Quick Start

```typescript
import { compileCanonProject, serializeCanonProject } from '@canonry/dsl-v2';

const { config, diagnostics } = compileCanonProject([
  { path: 'project.canon', content: 'project "My World"\nend' },
]);

if (config) {
  const files = serializeCanonProject(config);
  console.log(files.map((file) => file.path));
}
```

## Conduit Usage

The repository scripts use DSL v2 for Canonry conversions.

```bash
node scripts/conduit.js --dir apps/canonry/webui/public/default-project --to canon
node scripts/conduit.js --dir apps/canonry/webui/public/default-project --to json
```

## Development

```bash
npm run build
npm run clean
```

## License

MIT
