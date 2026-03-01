<!-- drift-generated -->
# ADR-027: Remote Shell CSS Consolidation

## Status
Accepted

## Context
Module Federation remote entry points (CoherenceEngineRemote, CosmographerRemote) each
had their own CSS file defining an identical sidebar + nav button + content layout. The
two files were 66% similar — the structural layout was identical, with only class name
prefixes (`cer-*` vs `cosmo-*`) and accent colors differing.

This duplication meant any layout change (e.g., sidebar width, button padding, font
sizing) had to be replicated across every remote, and inconsistencies could emerge
silently. New remotes would copy-paste one of the existing files and introduce yet
another prefix.

## Decision
Consolidate the shared remote shell layout into a single CSS file at
`packages/shared-components/src/styles/components/remote-shell.css` using the `rs-`
class prefix. Per-app accent customisation is handled via CSS custom properties on the
root container element:

- `--rs-active-from` / `--rs-active-to` — active button gradient endpoints
- `--rs-hover-bg` / `--rs-hover-color` — inactive button hover effect

Each remote app's companion CSS file is reduced to a small override block that sets
these variables (or omits them to use the shared defaults).

## Consequences
- **Single source of truth** for remote shell layout. Sidebar dimensions, nav button
  styling, and placeholder components are defined once.
- **New remotes** inherit the layout automatically by importing shared-components
  styles and using `rs-*` classes.
- **Per-app branding** is still possible through the CSS custom property mechanism —
  no loss of visual identity.
- App-specific companion CSS files (`CoherenceEngineRemote.css`, etc.) become
  minimal override files, not standalone layouts.

## Enforcement
- ESLint rule `local/no-remote-shell-drift` bans all old per-app class names
  (`cer-container`, `cer-sidebar`, `cosmo-container`, `cosmo-sidebar`, etc.) in JSX
  `className` attributes and template literals
- Pattern documentation: `docs/patterns/remote-shell.md`
