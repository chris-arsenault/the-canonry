<!-- drift-generated -->
# ADR-023: CSS Component Deduplication via Shared-Components + Compact Overrides

**Status:** Accepted
**Date:** 2026-02-28
**Deciders:** tsonu
**Drift area:** css-css-cluster-009 (CSS Duplication: section.css), css-css-cluster-008 (CSS Duplication: form.css), css-css-cluster-007 (CSS Duplication: level-selector.css), css-css-cluster-006 (CSS Duplication: dropdown.css)

## Context

The drift audit found multiple cases where `apps/coherence-engine/webui/src/styles/components/`
contained near-complete duplicates (79% similarity) of files in
`packages/shared-components/src/styles/components/`. The affected files were:

- **section.css** — `.section`, `.section-header`, `.section-title`, `.nested-section`,
  `.info-box`, `.category-header`, etc.
- **form.css** — `.input`, `.textarea`, `.select`, `.checkbox`, `.label`, `.alert`, `.chip`,
  `.slider`, `.type-pill`, `.condition-editor`, etc.
- **level-selector.css** — `.level-selector`, `.level-selector-dots`, `.level-selector-dot`,
  `.level-selector-input`, etc. (86% similarity; the app version had stale classes that
  diverged from the actual SVG-based component implementation)
- **dropdown.css** — `.dropdown`, `.dropdown-trigger`, `.dropdown-menu`, `.dropdown-option`,
  `.dropdown-menu-item`, `.dropdown-menu-icon`, etc. (53% similarity; the app version used
  compact sizing with smaller padding, font sizes, and icon dimensions)

In each case, both files defined the same class names with minor value differences — the
app version used smaller fonts, tighter spacing, and compact padding — or, in the case of
level-selector.css, contained stale dead code from an earlier implementation approach.

Coherence-engine already imports `@the-canonry/shared-components/styles` in its entry
point, which loads the shared CSS. The app's local files then loaded AFTER the shared
version, overriding every rule. This meant:

- Two files to maintain for the same classes
- Changes to shared-components CSS had no effect in coherence-engine
- The override pattern was invisible — you had to know the load order to understand it

The app already had `compact-overrides.css` specifically designed for this purpose:
overriding shared-components base styles with tighter spacing for the dense config UI.

## Decision

### Shared-components owns all canonical component CSS

`packages/shared-components/src/styles/components/` is the single source of truth for
component-level CSS. Apps that import `@the-canonry/shared-components/styles` get all
component styles automatically.

### Apps override ONLY the properties that differ

When an app needs different spacing, sizing, or colors for shared component classes, it
overrides **only those specific properties** in its `compact-overrides.css` (or equivalent
app-level override file). It does NOT duplicate the entire CSS file.

### Apps MUST NOT have CSS files in `styles/components/` whose names match shared-components files

If `packages/shared-components/src/styles/components/section.css` exists, no app may have
its own `styles/components/section.css`. The override mechanism is `compact-overrides.css`,
not a parallel file.

## Consequences

### Positive

- Single source of truth for component CSS — changes in shared-components propagate everywhere
- Compact overrides are explicit — only differing properties listed, not full file copies
- `compact-overrides.css` is self-documenting: it shows exactly where the app diverges
- New shared-components CSS classes automatically apply to all apps

### Negative

- App-specific style differences must be carefully extracted into override-only rules
- Override specificity depends on CSS load order (shared loads first, overrides load after)

## Enforcement

- **ESLint rule:** `local/no-duplicate-component-css` — warns when an app's
  `styles/components/` directory contains a CSS file whose name matches one in
  `packages/shared-components/src/styles/components/`. The rule fires when processing JS
  files that import the app's `styles/index.css`.
- **Limitation:** ESLint cannot process CSS files directly. The rule detects filesystem
  duplication from JS entry points. CSS `@import` directives in CSS index files are not
  directly linted — developers adding new `@import` lines should check the review checklist.
- **Review checklist:** Before adding a CSS `@import` for a component CSS file, verify the
  file does not duplicate a shared-components CSS file. See `docs/REVIEW_CHECKLIST.md`.
- **Pattern documentation:** `docs/patterns/css-component-deduplication.md`
