# Shared Components

> The UI glue that keeps every Canonry tool feeling like the same suite.

@penguin-tales/shared-components provides React components, utilities, and shared CSS for the Canonry micro-frontends. It exports form controls, validation badges, usage helpers, and a shared design system layer.

[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

## Features (One Suite, One UI)

- **Tag and Reference Controls** - TagSelector, dropdowns, and chip pickers
- **Usage + Validation** - Usage maps, badges, and schema validators
- **Layout Primitives** - Sections, empty states, cards, and modals
- **Shared Styles** - Importable CSS tokens and component styling

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Exports](#exports)
- [Development](#development)
- [License](#license)

## Requirements

- Node.js 18+
- React 19 (peer dependency)

## Installation

```bash
# From npm (when published)
npm install @penguin-tales/shared-components

# Or link locally during development
npm install file:packages/shared-components
```

## Quick Start

```jsx
import '@penguin-tales/shared-components/styles';
import { TagSelector, computeUsageMap } from '@penguin-tales/shared-components';

export function TagPicker({ tagRegistry, selectedTags, onChange }) {
  return (
    <TagSelector
      tagRegistry={tagRegistry}
      value={selectedTags}
      onChange={onChange}
      placeholder="Choose tags"
    />
  );
}

const usage = computeUsageMap(schema, pressures, eras, generators, systems, actions);
```

## Exports

Common entry points:

- `@penguin-tales/shared-components` - Components, hooks, and utilities
- `@penguin-tales/shared-components/styles` - Shared CSS bundle
- `@penguin-tales/shared-components/TagSelector` - Direct TagSelector export

## Development

This package is consumed directly from `src/` in the monorepo. There is no build step defined here; use the repo-level lint and build workflows when needed.

## License

See root `LICENSE`.
