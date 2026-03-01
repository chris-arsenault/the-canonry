<!-- drift-generated -->
# ADR-036: App.css Arctic Theme Base Consolidation

## Status
Accepted (2026-02-28)

## Context
The illuminator and name-forge MFE apps each defined their own App.css with
identical `:root` custom properties for the Arctic Blue theme — backgrounds,
borders, text colors, arctic palette, spacing scale, font sizes, component
colors, semantic colors — plus identical CSS reset and body styles. This
amounted to ~82 lines of duplicated CSS per app.

The only differences between the two files were app-specific accent colors
(`--accent-color`, `--accent-hover`), app-specific theme variables
(`--purple-accent` vs `--gold-accent`), and button colors. Everything else
was copy-pasted verbatim.

This duplication meant:
- Any change to the shared base (e.g., adjusting spacing scale) required
  updating N files across N apps
- Drift was inevitable — one app's base would diverge over time
- New apps would copy-paste from an existing App.css, perpetuating the pattern

## Decision
Extract the shared Arctic Blue theme base into a single canonical file at
`packages/shared-components/src/styles/arctic-theme-base.css`. Each MFE
App.css imports this shared base via `@import` and only defines app-specific
accent overrides.

### What the shared base contains
- `:root` custom properties: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`,
  `--bg-sidebar`, `--border-color`, `--border-light`, `--text-color`,
  `--text-secondary`, `--text-muted`, arctic palette (`--arctic-*`), spacing
  (`--space-*`), font sizes (`--text-xs` through `--text-2xl`), component
  colors (`--card-bg`, `--card-border`, `--input-bg`), semantic colors
  (`--danger`, `--success`, `--warning`)
- CSS reset (`* { margin: 0; padding: 0; box-sizing: border-box; }`)
- Body styles (font-family, font-size, line-height, background, color)

### What each App.css keeps
Only accent overrides in a small `:root` block:
- `--accent-color`, `--accent-hover`
- App-specific palette vars (e.g., `--purple-accent` or `--gold-accent`)
- `--button-primary`, `--button-primary-hover`
- `--color-accent`, `--color-accent-light`, `--gradient-accent`

Plus all app-specific component classes (layout, sidebar, navigation, etc.).

## Consequences
- Single source of truth for shared theme base — changes propagate automatically
- New apps get the base by adding one `@import` line
- App-specific accent colors remain under each app's control
- Lore-weave's App.css was NOT included because it uses `--lw-` prefixed
  variable names — a separate naming-convention concern

## Enforcement
- ESLint rule `drift-guard/no-app-css-base-duplication` detects App.css files
  that redefine shared base variables instead of importing the shared base
- Pattern guide at `docs/patterns/app-css-theme.md`
