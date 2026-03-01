<!-- drift-generated -->
# ADR-043: Standardized WebUI Test Infrastructure

## Status
Accepted

## Context
The monorepo contains 9 webui apps but only 2 library-level apps (lore-weave, name-forge) had any test infrastructure configured. The remaining 7 webui apps (archivist, canonry, chronicler, coherence-engine, cosmographer, illuminator, viewer) had no vitest configuration, no test scripts, and no test-related devDependencies. This structural gap meant:

- No standard way to run tests in any webui app
- No convention for test file naming or location
- Risk of different apps adopting different test runners (jest vs vitest vs mocha) if tests were added ad hoc

## Decision
Every webui app gets a standardized vitest configuration:

- **Test runner:** vitest (matching the library-level canonical pattern)
- **Environment:** jsdom (React component testing)
- **Coverage:** @vitest/coverage-v8
- **File convention:** `ComponentName.test.tsx` (or `.test.jsx`) co-located with the component
- **Config file:** `vitest.config.ts` in each webui directory
- **Scripts:** `test` (single run), `test:watch` (dev mode), `test:coverage` (with coverage report)

We chose vitest over jest because:
1. The library apps already use vitest — consistency across the monorepo
2. Vitest shares the Vite transform pipeline, avoiding separate babel/ts-jest configuration
3. Native ESM support matches the project's `"type": "module"` setup

## Consequences
- All webui apps can now run `pnpm test` with consistent behavior
- Tests follow a single naming convention (`.test.`, not `.spec.`)
- Coverage reports use v8 provider across the board
- `turbo run test` finds and runs tests in every workspace

## Enforcement
- ESLint rule `local/no-non-vitest-testing` bans imports from `jest`, `@jest/*`, and `enzyme`, and warns on `.spec.` file naming
