<!-- drift-generated -->
# Vite Path Alias Configuration

## Permitted Patterns

### 1. `@lib` alias (apps with sibling `lib/` directory)

Apps that have a `lib/` + `webui/` split may configure a single `@lib` alias pointing to their sibling library directory:

```js
// apps/<app>/webui/vite.config.js
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@lib': resolve(__dirname, '../lib'),
    },
  },
  // ...
});
```

This applies to: **lore-weave**, **name-forge**, **illuminator**.

Usage in source files:
```js
// Instead of: import { generate } from '../../lib/generate.js'
import { generate } from '@lib/generate.js';
```

### 2. No aliases (all other apps)

Apps without a sibling `lib/` directory should not configure any `resolve.alias` entries. Use standard module resolution:

- **Workspace packages** → `import { foo } from '@the-canonry/world-store'` (resolved by pnpm workspace)
- **Shared components** → `import { Bar } from '@the-canonry/shared-components'`
- **Local files** → `import { baz } from './baz'` (relative paths)
- **Remote MFEs** → loaded via module federation (configured in `plugins`)

## Banned Patterns

### Cross-app source aliases

```js
// BANNED — breaks MFE isolation
resolve: {
  alias: {
    '@chronicler': resolve(__dirname, '../../chronicler/webui/src'),
    '@name-forge': resolve(__dirname, '../../name-forge/lib'),
  },
}
```

If you need functionality from another app, either:
- Extract it to a shared package in `packages/`
- Expose it via module federation

### Package source aliases

```js
// BANNED — redundant, workspace resolution already works
resolve: {
  alias: {
    '@the-canonry/world-store': path.resolve(__dirname, '../../../packages/world-store/src/index.ts'),
  },
}
```

Workspace packages that set `"exports": { ".": "./src/index.ts" }` in their `package.json` are already resolved to their source by the pnpm workspace linker. The alias duplicates what standard resolution already provides.

## Enforcement

The ESLint rule `local/no-cross-app-alias` runs on all `vite.config.*` files and warns on any alias entry that is not the canonical `@lib` → `../lib` pattern.
