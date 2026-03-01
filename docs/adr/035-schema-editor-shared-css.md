<!-- drift-generated -->
# ADR-035: Schema Editor Shared CSS Utilities

**Status:** Accepted
**Date:** 2026-02-28
**Deciders:** tsonu
**Drift area:** css-css-cluster-022 (RelationshipKindEditor.css / TagRegistryEditor.css duplication)

## Context

A drift audit found that `RelationshipKindEditor.css` and `TagRegistryEditor.css` — both in the SchemaEditor directory — contained three identical CSS rules under different prefixed class names:

| RelationshipKindEditor | TagRegistryEditor | Properties |
|----------------------|-------------------|------------|
| `.rke-select-compact` | `.tre-select-compact` | `width: auto; padding: 6px 10px;` |
| `.rke-checkbox` | `.tre-checkbox` | `width: 14px; height: 14px;` |
| `.rke-chip-framework` | `.tre-chip-framework` | `pointer-events: none; opacity: 0.6;` |

Both components live in the same `SchemaEditor/` directory, share the same parent layout (`SchemaEditor.css` with `se-` prefix), and use the same `ExpandableCard`-based editing pattern. The duplicated rules were byte-identical — only the prefix differed.

## Decision

Extract identical CSS rules into a shared `schema-editor-shared.css` file in the SchemaEditor directory. Both component CSS files import this shared file. The shared classes use the existing `se-` prefix (matching `SchemaEditor.css`):

- `.se-select-compact` — compact inline select styling
- `.se-checkbox-sm` — small checkbox sizing (14×14)
- `.se-chip-framework` — disabled appearance for framework-provided chips

Component-specific CSS remains in each component's own CSS file with its own prefix (`rke-`, `tre-`, `eke-`). Only rules that are identical across components go into the shared file.

## Consequences

### Positive
- Single source of truth for shared SchemaEditor utilities
- New sub-editors (e.g., a future CultureEditor rewrite) import the shared file instead of re-declaring
- Consistent visual appearance for compact selects, checkboxes, and framework chips

### Negative
- Extra import line in each sub-editor JSX file
- Developers must check `schema-editor-shared.css` before adding component-local utilities that might already exist

## Enforcement
- ESLint rule `local/no-schema-editor-css-drift` flags className strings in SchemaEditor sub-components that use component-prefixed versions of shared utilities (e.g., `tre-select-compact` instead of `se-select-compact`)
- Pattern documentation: `docs/patterns/schema-editor-shared-css.md`

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|---------------|
| Move shared styles to `packages/shared-components` | These utilities are specific to the SchemaEditor layout. They don't apply to other apps or component families. |
| Keep separate prefixed classes | Byte-identical rules under different names is textbook CSS drift. Future editors would copy-paste again. |
| Use a CSS preprocessor with mixins | The project uses plain CSS per ADR-004. Preprocessors add build complexity for a three-rule shared file. |
