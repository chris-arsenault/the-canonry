<!-- drift-generated -->
# ADR 042: Centered Message Layout — empty-state as Base, error-boundary as Extension

## Status
Accepted

## Context
The `empty-state.css` and `error-boundary.css` files in `packages/shared-components/src/styles/components/` both implemented a centered flex-column message layout with icon, title, and description slots. The error-boundary CSS duplicated the entire container layout (flex column, centering, padding, text alignment), the title typography (font-size-2xl, font-weight-medium), and the description styling (muted color, max-width 400px) — all identical to empty-state.css.

This structural duplication meant any change to the base centered layout (e.g., adjusting padding or centering behavior) had to be applied in two places, and new centered-message variants would likely copy from whichever file the author found first, perpetuating the drift.

## Decision
`empty-state.css` is the canonical base for all centered-message layouts. Components that need this layout compose by applying the `.empty-state` container class alongside their own modifier class.

Specifically:
- **Container**: Apply `empty-state <modifier>` (e.g., `empty-state error-boundary`)
- **Title**: Use `empty-state-title` directly
- **Description**: Use `empty-state-desc <modifier-desc>` for override needs
- **Unique elements**: Use modifier-prefixed classes (e.g., `error-boundary-icon`, `error-boundary-retry`)

The modifier CSS file (e.g., `error-boundary.css`) contains ONLY properties that differ from the base:
- Additional container constraints (`height`, `min-height`)
- Visually distinct sub-elements (danger-styled icon badge, retry button)
- Property overrides (smaller font-size on message, word-break)

## Consequences
- One place to change the base centered layout
- New centered-message variants extend `empty-state` rather than duplicating it
- Modifier CSS files are minimal — only overrides and additions
- Slightly more class names on elements (two classes instead of one), but this is standard CSS composition

## Enforcement
- ESLint rule `local/no-error-boundary-without-base` warns when a JSX element has `error-boundary` in className without also having `empty-state`
- The ErrorBoundary.jsx component itself is exempt from the rule (it already follows the pattern)
- Pattern documentation at `docs/patterns/centered-message-layout.md`
