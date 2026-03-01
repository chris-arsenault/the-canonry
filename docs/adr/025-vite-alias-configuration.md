<!-- drift-generated -->
# ADR 025: Vite Path Alias Configuration

## Status

Accepted

## Context

The monorepo had four different Vite `resolve.alias` patterns across nine apps:

1. **`@lib` → `../lib`** (lore-weave, name-forge, illuminator) — aliases the app's sibling library directory for cleaner imports in webui code.
2. **`@the-canonry/world-store` → `../../../packages/world-store/src/index.ts`** (archivist, chronicler) — bypasses package resolution to import the workspace package's TypeScript source directly.
3. **Cross-app source aliases** (`@chronicler` → chronicler's src, `@name-forge` → name-forge's lib) (viewer, cosmographer) — imports directly from another app's source, breaking MFE isolation.
4. **No aliases** (canonry, coherence-engine) — relies entirely on standard module resolution.

The package source alias (pattern 2) was redundant because `@the-canonry/world-store`'s `package.json` already sets `"exports": { ".": "./src/index.ts" }`, meaning workspace resolution reaches the same file without an alias.

The cross-app source aliases (pattern 3) were the most architecturally problematic: they created build-time coupling between apps that should be independently deployable MFEs.

## Decision

Standardize on two permitted patterns:

- **`@lib` → `../lib`** — for apps that have a sibling `lib/` directory (lore-weave, name-forge, illuminator). This alias simplifies deep imports from webui code into the core library.
- **No aliases** — for all other apps. Standard workspace package resolution and module federation handle cross-boundary imports.

All cross-app source aliases and redundant package source aliases are removed.

## Consequences

- **Positive:** MFE isolation is restored. Apps no longer depend on each other's internal file structure at build time.
- **Positive:** Package resolution is standard and predictable — no hidden path rewrites in vite config.
- **Trade-off:** Viewer still imports from chronicler via relative paths (`../../../chronicler/webui/src/...`). This coupling is now explicit rather than hidden behind an alias. A future improvement would extract the shared components to a package.
- **Trade-off:** The `@lib` alias means the same import path (`@lib/...`) resolves to different directories in different apps. This is acceptable because each app's `@lib` always refers to its OWN sibling library.

## Enforcement

- ESLint rule `local/no-cross-app-alias` (in `eslint-rules/no-cross-app-alias.js`) runs on all `vite.config.*` files and warns on any alias that is not `@lib` → `../lib`.
