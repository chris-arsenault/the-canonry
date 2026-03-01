# Canonry DSL

> Parse .canon files into Canonry-ready JSON without losing your sanity.

@canonry/dsl provides the parser, compiler, and serializer for Canonry's .canon configuration language. It converts human-friendly DSL files into structured JSON configs and surfaces diagnostics with source spans.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

## Features (Language, Not Spreadsheet)

- **Peggy Parser** - Grammar-driven parsing of .canon files
- **AST + Diagnostics** - Source spans for precise error reporting
- **Config Compiler** - Emit Canonry config JSON for schema, eras, and simulation
- **Serializer** - Convert JSON configs back into .canon files
- **Static Pages** - Compile wiki pages for Chronicler and Viewer

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Static Pages](#static-pages)
- [Development](#development)
- [License](#license)

## Requirements

- Node.js 18+
- TypeScript 5.3+

## Installation

```bash
# From npm (when published)
npm install @canonry/dsl

# Or link locally during development
npm install file:packages/canonry-dsl
```

## Quick Start

```typescript
import { compileCanonProject, parseCanon, serializeCanonProject } from '@canonry/dsl';

const source = `project "My World"\nend`;

const ast = parseCanon(source, 'project.canon');
const { config, diagnostics } = compileCanonProject([
  { path: 'project.canon', content: source },
]);

if (diagnostics.length) {
  console.warn(diagnostics);
}

if (config) {
  const files = serializeCanonProject(config);
  console.log(files[0].path, files[0].content);
}
```

## Static Pages

```typescript
import { compileCanonStaticPages, serializeCanonStaticPages } from '@canonry/dsl';

const { pages, diagnostics } = compileCanonStaticPages([
  { path: 'pages.canon', content: 'static_page "atlas"\nend' },
]);

const files = serializeCanonStaticPages(pages || []);
```

## Development

```bash
npm run build
npm run clean
```

## License

MIT
