<!-- drift-generated -->
# ADR-044: TypeScript as Canonical Language for All Source Files

## Status

Accepted

## Context

The monorepo had five distinct TypeScript adoption states across nine apps:

1. **Fully TypeScript** (archivist, chronicler, world-schema) — all source files `.ts`/`.tsx` with `strict: true`
2. **Library TS / UI JS** (lore-weave, name-forge, cosmographer) — core libraries typed, webuis untyped JavaScript
3. **Mixed same-directory** (illuminator) — `.ts` and `.js` files interleaved in the same directories, `strict: false`
4. **Fully JavaScript** (canonry, coherence-engine) — no tsconfig, no type annotations
5. **Shared-components JS with PropTypes** — the universal dependency consumed by all apps, using runtime PropTypes instead of compile-time interfaces

The critical structural issue was that `shared-components` — consumed by every MFE — remained JavaScript with PropTypes, creating a type safety gap at the foundation layer. TypeScript-consuming apps (archivist, chronicler) had to use it without type information.

## Decision

**All new source files must be TypeScript (`.ts`/`.tsx`).** Existing JavaScript files should be migrated incrementally.

The migration priority was:

1. **shared-components** — converted first because it's the universal dependency. All 39 files migrated from JavaScript/PropTypes to TypeScript/interfaces.
2. **tsconfig.json infrastructure** — added to all apps that lacked it (canonry, coherence-engine, name-forge, cosmographer) with `allowJs: true` / `strict: false` to enable TypeScript tooling without requiring immediate full conversion.
3. **illuminator hooks** — all 13 remaining JavaScript hooks converted to TypeScript, completing the hooks directory migration.
4. **Remaining app files** — ~320 JavaScript files in app webuis remain as a tracked backlog. These will be converted incrementally.

## Consequences

### Positive

- `shared-components` now provides TypeScript interfaces for all component props, immediately benefiting all consuming apps
- All apps have `tsconfig.json`, enabling IDE support (autocomplete, error highlighting) even for JavaScript files
- `prop-types` dependency can be removed from `shared-components`
- No more PropTypes runtime overhead in production bundles
- New code in any app gets TypeScript checking by default

### Negative

- ~320 existing JavaScript files still need conversion (tracked by `local/no-js-file-extension` warnings)
- Apps with `strict: false` don't get full TypeScript safety guarantees
- Incremental migration means the codebase will be mixed for some time

### Neutral

- The `allowJs: true` / `checkJs: false` configuration is intentionally permissive — it enables tooling without creating hundreds of type errors in unconverted files
- Once an app's files are fully converted, `strict: true` and `checkJs` removal can be enabled

## Enforcement

- ESLint rule `local/no-js-file-extension` warns on any `.js`/`.jsx` file in frontend source directories, surfacing the migration backlog
- ESLint `no-restricted-imports` bans `import ... from 'prop-types'`, preventing PropTypes regression in any file
- Pattern documentation at `docs/patterns/typescript-migration.md`
