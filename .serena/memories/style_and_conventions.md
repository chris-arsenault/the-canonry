# Code Style and Conventions

## Formatting (Prettier)
- Semicolons: yes
- Quotes: double quotes (not single)
- Tab width: 2 spaces
- Print width: 100
- Trailing commas: es5

## Language
- TypeScript + JavaScript (mixed codebase, migrating toward TypeScript)
- React with JSX/TSX
- ESM modules (`import`/`export`, `"type": "module"`)

## Naming Conventions
- Files: camelCase for JS/TS, PascalCase for React components
- Components: PascalCase
- Functions/variables: camelCase
- CSS classes: kebab-case

## Key Architectural Rules
1. **No escape hatches**: Never add methods returning internal objects
2. **No fallback defaults** for required config — throw errors instead
3. **No deprecated code** — delete immediately, fix all callers
4. **One canonical way** to do things — no parallel API paths
5. **Complete refactors** — never leave half-done
6. **No builds** — dev server handles compilation via HMR

## CSS Architecture
- Shared CSS in `packages/shared-components/src/styles/`
- Extensive custom ESLint rules to prevent CSS drift
- Component CSS co-located with components
- Many drift-guard rules enforce canonical CSS patterns

## UI Style
- Dense information display with inline symbols + compact subtitles
- No badge boxes unless truly categorical
- Hover titles on everything for discoverability
