<!-- drift-generated -->
# ADR-030: Viewer CSS Consolidation

## Status
Accepted

## Context
The coherence-engine app maintained full local copies of `card.css` and `editor.css` in
`apps/coherence-engine/webui/src/styles/components/` that duplicated the canonical versions
in `packages/shared-components/src/styles/components/`. The local copies had compact sizing
baked in (smaller paddings, border-radii, font sizes) rather than expressing those
differences as overrides.

Additionally, three viewer components (dependency-viewer, naming-profile-viewer, validation)
each defined their own prefixed CSS classes for identical structural patterns: section cards,
collapsible headers, count badges, data rows, tables, and empty states.

## Decision
1. **Eliminate local card.css and editor.css** from coherence-engine. The canonical styles
   live in `packages/shared-components/src/styles/components/`. App-specific compact sizing
   is expressed as property-level overrides in `compact-overrides.css`, matching the
   established pattern already used for buttons, modals, toggles, sections, forms, and
   dropdowns.

2. **Create shared viewer utility classes** in
   `packages/shared-components/src/styles/components/viewer.css` that provide the common
   structural patterns (`.viewer-container`, `.viewer-section`, `.viewer-section-header`,
   `.viewer-item-row`, `.viewer-badge`, `.viewer-table`, `.viewer-empty-state`).

3. **New viewer components must use the shared `viewer-*` classes** instead of defining
   component-prefixed copies. Existing components (dependency-viewer, naming-profile-viewer,
   validation) retain their prefixed classes as migration backlog.

## Consequences
- **Positive:** Single source of truth for card and editor base styles. Compact overrides
  are explicit and localized. New viewer components get consistent structural styling
  without reinventing patterns.
- **Negative:** Existing viewer components still have prefixed CSS classes that duplicate
  the shared viewer patterns. Full migration requires JSX changes in those components.
- **Migration path:** Existing viewer components should progressively adopt `viewer-*`
  classes, replacing component-prefixed copies.

## Enforcement
- ESLint rule `local/no-duplicate-component-css` prevents apps from maintaining local
  copies of shared-components CSS files (catches the card.css/editor.css pattern)
- ESLint rule `local/no-viewer-pattern-drift` detects new component-prefixed CSS class
  names that duplicate shared viewer-* structural patterns in JSX files
- Pattern documentation: `docs/patterns/viewer-css.md`
